const db = require('./db');

// Increment / decrement a cafe's daily sales summary row (UPSERT within a transaction).
// `client` is an in-transaction pg client. `dir` = 1 (add a payment) or -1 (revert a payment).
function bumpDaily(client, { cafeId, date, amount, payment_type, discount, dir = 1 }) {
  const amt = (parseFloat(amount) || 0) * dir;
  const disc = (parseFloat(discount) || 0) * dir;
  const cnt = dir;
  return client.query(
    `
    INSERT INTO daily_sales_summary
      (cafe_id, summary_date, total_revenue, cash_amount, card_amount, meal_amount, discount_total, payment_count, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (cafe_id, summary_date)
    DO UPDATE SET
      total_revenue = daily_sales_summary.total_revenue + EXCLUDED.total_revenue,
      cash_amount = daily_sales_summary.cash_amount + EXCLUDED.cash_amount,
      card_amount = daily_sales_summary.card_amount + EXCLUDED.card_amount,
      meal_amount = daily_sales_summary.meal_amount + EXCLUDED.meal_amount,
      discount_total = daily_sales_summary.discount_total + EXCLUDED.discount_total,
      payment_count = daily_sales_summary.payment_count + EXCLUDED.payment_count,
      updated_at = NOW()
    `,
    [
      cafeId,
      date,
      amt,
      payment_type === 'cash' ? amt : 0,
      payment_type === 'credit_card' ? amt : 0,
      payment_type === 'meal_card' ? amt : 0,
      disc,
      cnt,
    ]
  );
}

function addDaily(client, data) {
  return bumpDaily(client, { ...data, dir: 1 });
}
function removeDaily(client, data) {
  return bumpDaily(client, { ...data, dir: -1 });
}

// Read aggregated metrics (today / week / month / selected date) from summary rows.
async function getMetrics(cafeId, selectedDate) {
  const zero = () => ({ t: 0, c: 0, k: 0, m: 0, d: 0 });

  const todayQ = await db.query(
    `SELECT total_revenue t, cash_amount c, card_amount k, meal_amount m, discount_total d
     FROM daily_sales_summary WHERE cafe_id=$1 AND summary_date=CURRENT_DATE`,
    [cafeId]
  );
  const weekQ = await db.query(
    `SELECT COALESCE(SUM(total_revenue),0) t, COALESCE(SUM(cash_amount),0) c, COALESCE(SUM(card_amount),0) k,
            COALESCE(SUM(meal_amount),0) m, COALESCE(SUM(discount_total),0) d
     FROM daily_sales_summary WHERE cafe_id=$1 AND summary_date >= date_trunc('week', CURRENT_DATE)`,
    [cafeId]
  );
  const monthQ = await db.query(
    `SELECT COALESCE(SUM(total_revenue),0) t, COALESCE(SUM(cash_amount),0) c, COALESCE(SUM(card_amount),0) k,
            COALESCE(SUM(meal_amount),0) m, COALESCE(SUM(discount_total),0) d
     FROM daily_sales_summary WHERE cafe_id=$1 AND summary_date >= date_trunc('month', CURRENT_DATE)`,
    [cafeId]
  );
  const dateQ = await db.query(
    `SELECT total_revenue t, cash_amount c, card_amount k, meal_amount m, discount_total d
     FROM daily_sales_summary WHERE cafe_id=$1 AND summary_date=$2`,
    [cafeId, selectedDate]
  );

  const today = todayQ.rows[0] || zero();
  const week = weekQ.rows[0] || zero();
  const month = monthQ.rows[0] || zero();
  const date = dateQ.rows[0] || zero();

  return {
    today_total: today.t || 0, today_cash: today.c || 0, today_card: today.k || 0,
    today_meal: today.m || 0, today_discount: today.d || 0,
    week_total: week.t || 0, week_cash: week.c || 0, week_card: week.k || 0,
    week_meal: week.m || 0, week_discount: week.d || 0,
    month_total: month.t || 0, month_cash: month.c || 0, month_card: month.k || 0,
    month_meal: month.m || 0, month_discount: month.d || 0,
    date_total: date.t || 0, date_cash: date.c || 0, date_card: date.k || 0,
    date_meal: date.m || 0, date_discount: date.d || 0,
  };
}

// Recompute all daily summaries from the payments table (lazy backfill for pre-existing data).
async function backfillAll() {
  try {
    await db.query(`
      INSERT INTO daily_sales_summary
        (cafe_id, summary_date, total_revenue, cash_amount, card_amount, meal_amount, discount_total, payment_count, updated_at, created_at)
      SELECT
        p.cafe_id,
        DATE(p.created_at) as summary_date,
        SUM(p.amount) as total_revenue,
        SUM(CASE WHEN p.payment_type = 'cash' THEN p.amount ELSE 0 END) as cash_amount,
        SUM(CASE WHEN p.payment_type = 'credit_card' THEN p.amount ELSE 0 END) as card_amount,
        SUM(CASE WHEN p.payment_type = 'meal_card' THEN p.amount ELSE 0 END) as meal_amount,
        SUM(p.discount_amount) as discount_total,
        COUNT(*) as payment_count,
        NOW(),
        MIN(p.created_at)
      FROM payments p
      GROUP BY p.cafe_id, DATE(p.created_at)
      ON CONFLICT (cafe_id, summary_date) DO UPDATE SET
        total_revenue = EXCLUDED.total_revenue,
        cash_amount = EXCLUDED.cash_amount,
        card_amount = EXCLUDED.card_amount,
        meal_amount = EXCLUDED.meal_amount,
        discount_total = EXCLUDED.discount_total,
        payment_count = EXCLUDED.payment_count,
        updated_at = NOW()
    `);
  } catch (err) {
    console.error('summary backfill error:', err.message);
  }
}

module.exports = { addDaily, removeDaily, getMetrics, backfillAll };
