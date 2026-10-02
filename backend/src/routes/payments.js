const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { addDaily, removeDaily, getMetrics } = require('../summary');
const router = express.Router();

// POST /api/payments
router.post('/', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const perms = req.user.permissions || {};
    if (req.user.role_name !== 'SuperAdmin' && req.user.role_name !== 'Owner' &&
        req.user.role_name !== 'Admin' && req.user.role_name !== 'Manager' && !perms.can_take_payment) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Ödeme alma yetkiniz yok' });
    }

    const { session_id, amount, payment_type, discount_amount, discount_reason, notes, items } = req.body;

    // If per-item quantities are provided (partial/unit-based payment), validate & sum them.
    let numAmount = parseFloat(amount) || 0;
    const numDiscount = parseFloat(discount_amount) || 0;
    let paidItems = [];

    if (Array.isArray(items) && items.length > 0) {
      let computed = 0;
      for (const it of items) {
        const orderItemId = parseInt(it.order_item_id);
        const qty = parseInt(it.quantity);
        if (!orderItemId || !qty || qty < 1) {

          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Geçersiz ödeme kalemi' });
        }
        const { rows: [oi] } = await client.query(
          `SELECT oi.id, oi.quantity, oi.paid_quantity, oi.unit_price, o.id as order_id, o.session_id
           FROM order_items oi JOIN orders o ON oi.order_id = o.id
           WHERE oi.id = $1 AND o.cafe_id = $2 AND o.session_id = $3 AND oi.status != 'cancelled'`,
          [orderItemId, req.user.cafe_id, session_id]
        );
        if (!oi) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Sipariş kalemi bulunamadı' });
        }
        const remainingUnits = oi.quantity - (oi.paid_quantity || 0);
        if (qty > remainingUnits) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `"${orderItemId}" için yalnızca ${remainingUnits} adet ödenecek durumda` });
        }
        computed += qty * Number(oi.unit_price);
        paidItems.push({ order_item_id: orderItemId, quantity: qty });
      }
      numAmount = numAmount || computed;
    }

    if (numAmount <= 0 && numDiscount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Geçersiz ödeme tutarı' });
    }

    const { rows: [payment] } = await client.query(`
      INSERT INTO payments (session_id, cafe_id, user_id, amount, payment_type, discount_amount, discount_reason, notes, items)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [session_id, req.user.cafe_id, req.user.id, numAmount, payment_type || 'cash', numDiscount, discount_reason || null, notes || null, JSON.stringify(paidItems)]);

    // Mark paid units on each order item.
    for (const pi of paidItems) {
      await client.query(
        'UPDATE order_items SET paid_quantity = paid_quantity + $1 WHERE id = $2',
        [pi.quantity, pi.order_item_id]
      );
    }

    // Update daily sales summary (denormalized metrics) within the same transaction.
    const payDate = payment.created_at ? new Date(payment.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    await addDaily(client, {
      cafeId: req.user.cafe_id,
      date: payDate,
      amount: numAmount,
      payment_type: payment_type || 'cash',
      discount: numDiscount,
    });

    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (typeof broadcast === 'function') {
      try {
        broadcast(req.user.cafe_id, 'payment_received', { session_id, amount: numAmount, payment_type });
      } catch (bcErr) {
        console.error('Broadcast error:', bcErr.message);
      }
    }

    res.json(payment);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/payments/session/:sessionId
router.get('/session/:sessionId', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*, u.full_name as cashier_name
      FROM payments p JOIN users u ON p.user_id = u.id
      WHERE p.session_id = $1 AND p.cafe_id = $2
      ORDER BY p.created_at ASC
    `, [req.params.sessionId, req.user.cafe_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/payments/:id - Undo/revert payment while session is still active
router.delete('/:id', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const paymentId = req.params.id;
    const cafeId = req.user.cafe_id;

    const { rows: [payment] } = await client.query(`
      SELECT p.*, s.is_active as session_active, s.table_id
      FROM payments p
      JOIN sessions s ON p.session_id = s.id
      WHERE p.id = $1 AND p.cafe_id = $2
    `, [paymentId, cafeId]);

    if (!payment) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ödeme kaydı bulunamadı' });
    }

    if (!payment.session_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Masa kapatıldığı için bu ödeme artık geri alınamaz' });
    }

    // Revert daily sales summary before deleting.
    const payDate = payment.created_at ? new Date(payment.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    await removeDaily(client, {
      cafeId,
      date: payDate,
      amount: Number(payment.amount) || 0,
      payment_type: payment.payment_type,
      discount: Number(payment.discount_amount) || 0,
    });

    // Return paid units to their order items.
    if (Array.isArray(payment.items)) {
      for (const pi of payment.items) {
        if (pi && pi.order_item_id && pi.quantity) {
          await client.query(
            'UPDATE order_items SET paid_quantity = GREATEST(0, paid_quantity - $1) WHERE id = $2',
            [pi.quantity, pi.order_item_id]
          );
        }
      }
    }

    await client.query('DELETE FROM payments WHERE id = $1 AND cafe_id = $2', [paymentId, cafeId]);
    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (typeof broadcast === 'function') {
      try {
        broadcast(cafeId, 'payment_reverted', {
          session_id: payment.session_id,
          payment_id: paymentId,
          amount: payment.amount,
        });
      } catch (bcErr) {}
    }

    res.json({ success: true, message: 'Ödeme başarıyla geri alındı', payment_id: paymentId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/payments/history - Table bills grouped by session, paginated, with cached metrics
router.get('/history', authenticate, async (req, res) => {
  try {
    const role = req.user.role_name;
    const perms = req.user.permissions || {};
    const isMgmt = role === 'SuperAdmin' || role === 'Owner' || role === 'Admin' || role === 'Manager';
    const canSeeWeeklyMonthly = isMgmt || !!perms.can_view_weekly_monthly;
    const canViewRevenue = isMgmt || !!perms.can_view_revenue;

    if (!isMgmt && perms.can_view_history === false) {
      return res.status(403).json({ error: 'İşlem geçmişini görüntüleme yetkiniz yok' });
    }

    const { page = 1, limit = 8, search = '', payment_type } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 8));
    const offset = (pageNum - 1) * limitNum;
    const cafeId = req.user.cafe_id;
    const today = new Date().toISOString().split('T')[0];

    // If user cannot see weekly/monthly or history is restricted to today_only, force date to today
    let date = req.query.date ? String(req.query.date).slice(0, 10) : null;
    if (!canSeeWeeklyMonthly || perms.can_view_history === 'today_only') {
      date = today;
    }

    // Build WHERE for the day + param list
    const params = [cafeId];
    let dateClause = '';
    if (date) {
      params.push(date);
      dateClause = `AND DATE(p.created_at) = $${params.length}`;
    }

    // Per-session filter conditions (HAVING) for search & payment type.
    // Placeholder numbers must account for base params (cafeId + optional date).
    const having = [];
    const havingParams = [];
    const havingPos = () => params.length + havingParams.length;
    if (search && search.trim()) {
      havingParams.push(`%${search.trim()}%`);
      having.push(`(BOOL_OR(t.name ILIKE $${havingPos()}) OR BOOL_OR(a.name ILIKE $${havingPos()}) OR BOOL_OR(u.full_name ILIKE $${havingPos()}) OR BOOL_OR((p.notes)::text ILIKE $${havingPos()}))`);
    }
    if (payment_type && payment_type !== 'all') {
      havingParams.push(payment_type);
      having.push(`BOOL_OR(p.payment_type = $${havingPos()})`);
    }
    const havingClause = having.length > 0 ? 'HAVING ' + having.join(' AND ') : '';

    // Merge params: base (cafeId + date) come first, then having params, then limit/offset
    const mergedParams = [...params, ...havingParams];

    const txQuery = `
      SELECT
        s.id as session_id,
        s.start_time as session_opened_at,
        t.name as table_name,
        a.name as area_name,
        MAX(p.created_at) as paid_at,
        COALESCE(SUM(p.amount), 0) as paid_amount,
        COALESCE(s.discount_amount, 0) + COALESCE(SUM(p.discount_amount), 0) as discount_amount,
        COALESCE(SUM(CASE WHEN p.payment_type = 'cash' THEN p.amount ELSE 0 END), 0) as cash_amount,
        COALESCE(SUM(CASE WHEN p.payment_type = 'credit_card' THEN p.amount ELSE 0 END), 0) as card_amount,
        COALESCE(SUM(CASE WHEN p.payment_type = 'meal_card' THEN p.amount ELSE 0 END), 0) as meal_amount,
        COUNT(DISTINCT p.id) as payment_count,
        STRING_AGG(DISTINCT u.full_name, ', ') as cashier_names,
        COALESCE(sess.total_amount, 0) as session_total
      FROM payments p
      JOIN sessions s ON p.session_id = s.id
      JOIN tables t ON s.table_id = t.id
      LEFT JOIN areas a ON t.area_id = a.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT SUM(oi.quantity * oi.unit_price) as total_amount
        FROM orders o JOIN order_items oi ON oi.order_id = o.id
        WHERE o.session_id = s.id AND o.status != 'cancelled' AND oi.status != 'cancelled'
      ) sess ON true
      WHERE p.cafe_id = $1 ${dateClause}
      GROUP BY s.id, t.name, a.name, s.discount_amount, sess.total_amount
      ${havingClause}
      ORDER BY MAX(p.created_at) DESC
      LIMIT $${mergedParams.length + 1} OFFSET $${mergedParams.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) as total_count FROM (
        SELECT s.id
        FROM payments p
        JOIN sessions s ON p.session_id = s.id
        JOIN tables t ON s.table_id = t.id
        LEFT JOIN areas a ON t.area_id = a.id
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.cafe_id = $1 ${dateClause}
        GROUP BY s.id
        ${havingClause}
      ) sub
    `;

    let metrics = {};
    if (canViewRevenue) {
      const fullMetrics = await getMetrics(cafeId, date || today);
      if (!canSeeWeeklyMonthly) {
        metrics = {
          today_total: fullMetrics.today_total,
          today_cash: fullMetrics.today_cash,
          today_card: fullMetrics.today_card,
          today_meal: fullMetrics.today_meal,
          today_discount: fullMetrics.today_discount,
        };
      } else {
        metrics = fullMetrics;
      }
    }

    const [transactionsRes, countRes] = await Promise.all([
      db.query(txQuery, [...mergedParams, limitNum, offset]),
      db.query(countQuery, mergedParams),
    ]);

    res.json({
      transactions: transactionsRes.rows,
      totalCount: parseInt(countRes.rows[0].total_count || '0'),
      page: pageNum,
      limit: limitNum,
      filterDate: date,
      metrics,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to get the next 1-based placeholder number for the running having-params array.
function dbiNum(arr) {
  return arr.length;
}

module.exports = router;
