const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// POST /api/payments
router.post('/', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { session_id, amount, payment_type, discount_amount, discount_reason, notes } = req.body;

    const numAmount = parseFloat(amount) || 0;
    const numDiscount = parseFloat(discount_amount) || 0;

    if (numAmount <= 0 && numDiscount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Geçersiz ödeme tutarı' });
    }

    const { rows: [payment] } = await client.query(`
      INSERT INTO payments (session_id, cafe_id, user_id, amount, payment_type, discount_amount, discount_reason, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [session_id, req.user.cafe_id, req.user.id, numAmount, payment_type || 'cash', numDiscount, discount_reason || null, notes || null]);

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

    // Check payment & session status
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

    // Delete payment
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

// GET /api/payments/history - Full Kasa & Payment History (Wireframe Screen)
router.get('/history', authenticate, async (req, res) => {
  try {
    const { date, page = 1, limit = 10, search = '', payment_type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const cafeId = req.user.cafe_id;
    const filterDate = date || new Date().toISOString().split('T')[0];

    let whereClause = `WHERE p.cafe_id = $1`;
    const params = [cafeId];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClause += ` AND (t.name ILIKE $${params.length} OR a.name ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR p.notes ILIKE $${params.length})`;
    }

    if (payment_type && payment_type !== 'all') {
      params.push(payment_type);
      whereClause += ` AND p.payment_type = $${params.length}`;
    }

    // 1. Transaction list with table and session breakdown
    const queryParams = [...params, parseInt(limit), offset];
    const transactionsQuery = `
      SELECT
        p.id,
        p.created_at,
        p.amount,
        p.discount_amount,
        p.discount_reason,
        p.payment_type,
        p.notes,
        t.name as table_name,
        a.name as area_name,
        u.full_name as cashier_name,
        COALESCE(sess_info.total_amount, p.amount) as session_total,
        CASE WHEN p.payment_type = 'credit_card' THEN p.amount ELSE 0 END as card_amount,
        CASE WHEN p.payment_type = 'cash' THEN p.amount ELSE 0 END as cash_amount,
        CASE WHEN p.payment_type = 'meal_card' THEN p.amount ELSE 0 END as meal_amount
      FROM payments p
      LEFT JOIN sessions s ON p.session_id = s.id
      LEFT JOIN tables t ON s.table_id = t.id
      LEFT JOIN areas a ON t.area_id = a.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT SUM(oi.quantity * oi.unit_price) as total_amount
        FROM orders o JOIN order_items oi ON oi.order_id = o.id
        WHERE o.session_id = p.session_id AND o.status != 'cancelled' AND oi.status != 'cancelled'
      ) sess_info ON true
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM payments p
      LEFT JOIN sessions s ON p.session_id = s.id
      LEFT JOIN tables t ON s.table_id = t.id
      LEFT JOIN areas a ON t.area_id = a.id
      LEFT JOIN users u ON p.user_id = u.id
      ${whereClause}
    `;

    // 2. Metrics Summary for Today, This Week, This Month, and Selected Date
    const metricsQuery = `
      SELECT
        -- TODAY
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN amount ELSE 0 END), 0) as today_total,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE AND payment_type = 'credit_card' THEN amount ELSE 0 END), 0) as today_card,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE AND payment_type = 'cash' THEN amount ELSE 0 END), 0) as today_cash,

        -- THIS WEEK (Monday to Sunday)
        COALESCE(SUM(CASE WHEN DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE) THEN amount ELSE 0 END), 0) as week_total,
        COALESCE(SUM(CASE WHEN DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE) AND payment_type = 'credit_card' THEN amount ELSE 0 END), 0) as week_card,
        COALESCE(SUM(CASE WHEN DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE) AND payment_type = 'cash' THEN amount ELSE 0 END), 0) as week_cash,

        -- THIS MONTH
        COALESCE(SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN amount ELSE 0 END), 0) as month_total,
        COALESCE(SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) AND payment_type = 'credit_card' THEN amount ELSE 0 END), 0) as month_card,
        COALESCE(SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) AND payment_type = 'cash' THEN amount ELSE 0 END), 0) as month_cash,

        -- SELECTED DATE
        COALESCE(SUM(CASE WHEN DATE(created_at) = $2::DATE THEN amount ELSE 0 END), 0) as date_total,
        COALESCE(SUM(CASE WHEN DATE(created_at) = $2::DATE AND payment_type = 'credit_card' THEN amount ELSE 0 END), 0) as date_card,
        COALESCE(SUM(CASE WHEN DATE(created_at) = $2::DATE AND payment_type = 'cash' THEN amount ELSE 0 END), 0) as date_cash
      FROM payments
      WHERE cafe_id = $1
    `;

    const [transactionsRes, countRes, metricsRes] = await Promise.all([
      db.query(transactionsQuery, queryParams),
      db.query(countQuery, params),
      db.query(metricsQuery, [cafeId, filterDate]),
    ]);

    res.json({
      transactions: transactionsRes.rows,
      totalCount: parseInt(countRes.rows[0].total_count || '0'),
      page: parseInt(page),
      limit: parseInt(limit),
      filterDate,
      metrics: metricsRes.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
