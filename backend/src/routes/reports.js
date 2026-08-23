const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// GET /api/reports/dashboard
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [revenue, topProducts, hourly] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(p.amount), 0) as today_revenue,
          COUNT(DISTINCT s.id) as today_sessions,
          COALESCE(AVG(sess_total.total), 0) as avg_ticket
        FROM payments p
        JOIN sessions s ON p.session_id = s.id
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(oi.quantity * oi.unit_price),0) as total
          FROM orders o JOIN order_items oi ON oi.order_id = o.id
          WHERE o.session_id = s.id AND o.status != 'cancelled' AND oi.status != 'cancelled'
        ) sess_total
        WHERE p.cafe_id = $1 AND DATE(p.created_at) = $2
      `, [req.user.cafe_id, today]),
      db.query(`
        SELECT p.name, SUM(oi.quantity) as sold, SUM(oi.quantity * oi.unit_price) as revenue
        FROM order_items oi JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.cafe_id = $1 AND DATE(o.created_at) = $2 AND o.status != 'cancelled'
        GROUP BY p.id, p.name ORDER BY sold DESC LIMIT 5
      `, [req.user.cafe_id, today]),
      db.query(`
        SELECT EXTRACT(HOUR FROM p.created_at) as hour, COALESCE(SUM(p.amount),0) as revenue
        FROM payments p
        WHERE p.cafe_id = $1 AND DATE(p.created_at) = $2
        GROUP BY hour ORDER BY hour
      `, [req.user.cafe_id, today])
    ]);

    res.json({
      today: revenue.rows[0],
      top_products: topProducts.rows,
      hourly: hourly.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/range?start=&end=
router.get('/range', authenticate, async (req, res) => {
  try {
    const { start, end } = req.query;
    const { rows } = await db.query(`
      SELECT DATE(p.created_at) as date,
        SUM(p.amount) as revenue,
        SUM(p.discount_amount) as discounts,
        COUNT(DISTINCT p.session_id) as sessions,
        SUM(CASE WHEN p.payment_type='cash' THEN p.amount ELSE 0 END) as cash,
        SUM(CASE WHEN p.payment_type='credit_card' THEN p.amount ELSE 0 END) as card,
        SUM(CASE WHEN p.payment_type='meal_card' THEN p.amount ELSE 0 END) as meal_card
      FROM payments p
      WHERE p.cafe_id=$1 AND DATE(p.created_at) BETWEEN $2 AND $3
      GROUP BY DATE(p.created_at) ORDER BY date
    `, [req.user.cafe_id, start, end]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/end-of-day - Perform End of Day / Z-Raporu Closure
router.post('/end-of-day', authenticate, async (req, res) => {
  try {
    const cafeId = req.user.cafe_id;
    const { notes } = req.body;

    const { rows: [summary] } = await db.query(`
      SELECT
        COALESCE(SUM(amount), 0) as total_revenue,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN amount ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN payment_type = 'credit_card' THEN amount ELSE 0 END), 0) as card_total,
        COALESCE(SUM(CASE WHEN payment_type = 'meal_card' THEN amount ELSE 0 END), 0) as meal_total,
        COUNT(DISTINCT session_id) as total_tables,
        COUNT(*) as total_payments
      FROM payments
      WHERE cafe_id = $1 AND DATE(created_at) = CURRENT_DATE
    `, [cafeId]);

    res.json({
      success: true,
      closed_at: new Date().toISOString(),
      closed_by: req.user.full_name,
      summary,
      notes: notes || 'Gün sonu işlemi başarıyla tamamlandı.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
