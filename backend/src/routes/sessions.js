const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// POST /api/sessions - Open session
router.post('/', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { table_id, guest_count, notes } = req.body;

    // Check if table is available
    const { rows: [table] } = await client.query('SELECT * FROM tables WHERE id=$1 AND cafe_id=$2', [table_id, req.user.cafe_id]);
    if (!table) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Masa bulunamadı' });
    }

    // If there is an existing active session, return it instead of throwing error
    if (table.current_session_id) {
      const { rows: [existing] } = await client.query('SELECT * FROM sessions WHERE id=$1 AND is_active=true', [table.current_session_id]);
      if (existing) {
        await client.query('COMMIT');
        return res.json(existing);
      }
    }

    const { rows: [session] } = await client.query(`
      INSERT INTO sessions (table_id, cafe_id, user_id, guest_count, notes)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [table_id, req.user.cafe_id, req.user.id, guest_count || 1, notes]);

    await client.query('UPDATE tables SET current_session_id=$1, status=$2 WHERE id=$3', [session.id, 'occupied', table_id]);
    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (typeof broadcast === 'function') {
      try {
        broadcast(req.user.cafe_id, 'session_opened', { table_id, session_id: session.id });
      } catch (bcErr) {}
    }

    res.json(session);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/sessions/:id - Get session details with mathematically precise calculations
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows: [session] } = await db.query(`
      SELECT s.*, t.name as table_name, a.name as area_name, u.full_name as opened_by,
        COALESCE((
          SELECT SUM(oi.quantity * oi.unit_price)
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          WHERE o.session_id = s.id AND o.status != 'cancelled' AND oi.status != 'cancelled'
        ), 0) as total_amount,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          WHERE p.session_id = s.id
        ), 0) as paid_amount,
        COALESCE((
          SELECT SUM(p.discount_amount)
          FROM payments p
          WHERE p.session_id = s.id
        ), 0) as total_discount,
        COALESCE((
          SELECT COUNT(DISTINCT o.id)
          FROM orders o
          WHERE o.session_id = s.id AND o.status != 'cancelled'
        ), 0) as order_count
      FROM sessions s
      JOIN tables t ON s.table_id = t.id
      LEFT JOIN areas a ON t.area_id = a.id
      JOIN users u ON s.user_id = u.id
      WHERE s.id = $1 AND s.cafe_id = $2
    `, [req.params.id, req.user.cafe_id]);
    
    if (!session) return res.status(404).json({ error: 'Oturum bulunamadı' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/close - Close session
router.post('/:id/close', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows: [session] } = await client.query('SELECT * FROM sessions WHERE id=$1 AND cafe_id=$2', [req.params.id, req.user.cafe_id]);
    if (!session) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Oturum bulunamadı' });
    }

    await client.query('UPDATE sessions SET is_active=false, end_time=NOW() WHERE id=$1', [req.params.id]);
    await client.query('UPDATE tables SET current_session_id=NULL, status=$1 WHERE id=$2', ['empty', session.table_id]);
    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (typeof broadcast === 'function') {
      try {
        broadcast(req.user.cafe_id, 'session_closed', { table_id: session.table_id, session_id: session.id });
      } catch (bcErr) {}
    }

    res.json({ success: true, table_id: session.table_id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/sessions/:id/cancel - Cancel / abort empty or unneeded session
router.post('/:id/cancel', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows: [session] } = await client.query('SELECT * FROM sessions WHERE id=$1 AND cafe_id=$2', [req.params.id, req.user.cafe_id]);
    if (!session) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Oturum bulunamadı' });
    }

    // Check if session has active unpaid orders
    const { rows: [orderCheck] } = await client.query(`
      SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_amount
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.session_id = $1 AND o.status != 'cancelled' AND oi.status != 'cancelled'
    `, [req.params.id]);

    const totalOrderAmount = parseFloat(orderCheck?.total_amount || '0');
    if (totalOrderAmount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'İçinde ürün olan masa direkt kapatılamaz. Lütfen önce ödeme alınız veya ürünleri iptal ediniz.'
      });
    }

    // Cancel empty session
    await client.query('UPDATE sessions SET is_active=false, end_time=NOW() WHERE id=$1', [req.params.id]);
    await client.query('UPDATE tables SET current_session_id=NULL, status=$1 WHERE id=$2', ['empty', session.table_id]);
    await client.query('COMMIT');

    const broadcast = req.app.get('broadcast');
    if (typeof broadcast === 'function') {
      try {
        broadcast(req.user.cafe_id, 'session_closed', { table_id: session.table_id, session_id: session.id });
      } catch (bcErr) {}
    }

    res.json({ success: true, table_id: session.table_id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/sessions/:id/transfer - Transfer or merge table
router.post('/:id/transfer', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { target_table_name, target_table_id } = req.body;

    const { rows: [session] } = await client.query('SELECT * FROM sessions WHERE id=$1 AND cafe_id=$2 AND is_active=true', [req.params.id, req.user.cafe_id]);
    if (!session) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aktif oturum bulunamadı' });
    }

    let targetTable;
    if (target_table_id) {
      const { rows } = await client.query('SELECT * FROM tables WHERE id=$1 AND cafe_id=$2', [target_table_id, req.user.cafe_id]);
      targetTable = rows[0];
    } else if (target_table_name) {
      const { rows } = await client.query('SELECT * FROM tables WHERE LOWER(name)=$1 AND cafe_id=$2', [String(target_table_name).trim().toLowerCase(), req.user.cafe_id]);
      targetTable = rows[0];
    }

    if (!targetTable) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `"${target_table_name || target_table_id}" masası bulunamadı` });
    }

    if (targetTable.id === session.table_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Aynı masaya aktarma yapılamaz' });
    }

    // If target table has an active session -> MERGE orders
    if (targetTable.current_session_id) {
      const targetSessionId = targetTable.current_session_id;
      await client.query('UPDATE orders SET session_id=$1 WHERE session_id=$2', [targetSessionId, session.id]);
      await client.query('UPDATE payments SET session_id=$1 WHERE session_id=$2', [targetSessionId, session.id]);
      await client.query('UPDATE sessions SET is_active=false, end_time=NOW() WHERE id=$1', [session.id]);
      await client.query('UPDATE tables SET current_session_id=NULL, status=$1 WHERE id=$2', ['empty', session.table_id]);
      await client.query('COMMIT');
      return res.json({ success: true, merged: true, target_session_id: targetSessionId });
    } else {
      // Empty target table -> MOVE session
      await client.query('UPDATE sessions SET table_id=$1 WHERE id=$2', [targetTable.id, session.id]);
      await client.query('UPDATE tables SET current_session_id=$1, status=$2 WHERE id=$3', [session.id, 'occupied', targetTable.id]);
      await client.query('UPDATE tables SET current_session_id=NULL, status=$1 WHERE id=$2', ['empty', session.table_id]);
      await client.query('COMMIT');
      return res.json({ success: true, moved: true, target_session_id: session.id });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
