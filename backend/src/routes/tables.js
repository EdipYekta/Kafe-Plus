const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// GET /api/tables?cafe_id=
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT t.*, a.name as area_name,
        s.id as session_id, s.start_time, s.start_time as session_opened_at, s.guest_count,
        s.user_id as session_user_id,
        u.full_name as waiter_name,
        COALESCE((
          SELECT SUM(oi.quantity * oi.unit_price)
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          WHERE o.session_id = s.id AND o.status != 'cancelled' AND oi.status != 'cancelled'
        ), 0) as total_amount,
        COALESCE((
          SELECT COUNT(DISTINCT o.id)
          FROM orders o
          WHERE o.session_id = s.id AND o.status != 'cancelled'
        ), 0) as order_count
      FROM tables t
      LEFT JOIN areas a ON t.area_id = a.id
      LEFT JOIN sessions s ON t.current_session_id = s.id AND s.is_active = true
      LEFT JOIN users u ON s.user_id = u.id
      WHERE t.cafe_id = $1 AND t.is_active = true
      ORDER BY t.area_id, t.name
    `, [req.user.cafe_id]);

    // Natural numeric sorting (e.g. M1, M2, M3, ... M9, M10, M11)
    rows.sort((a, b) => {
      if ((a.area_id || 0) !== (b.area_id || 0)) {
        return (a.area_id || 0) - (b.area_id || 0);
      }
      return (a.name || '').localeCompare(b.name || '', 'tr', { numeric: true, sensitivity: 'base' });
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tables - Create table
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, area_id, capacity, type, pos_x, pos_y, shape } = req.body;
    const { rows } = await db.query(`
      INSERT INTO tables (cafe_id, area_id, name, capacity, type, pos_x, pos_y, shape)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [req.user.cafe_id, area_id, name, capacity || 4, type || 'Standard', pos_x || 0, pos_y || 0, shape || 'square']);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tables/bulk - Create multiple tables at once
router.post('/bulk', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { tables, prefix, start_number = 1, count, area_id, capacity = 4, type = 'Standard', shape = 'square' } = req.body;
    const cafeId = req.user.cafe_id;

    let itemsToInsert = [];

    if (Array.isArray(tables) && tables.length > 0) {
      itemsToInsert = tables.map(t => ({
        name: t.name,
        area_id: t.area_id || area_id,
        capacity: t.capacity || capacity || 4,
        type: t.type || type || 'Standard',
        shape: t.shape || shape || 'square',
      }));
    } else if (count && parseInt(count) > 0) {
      const start = parseInt(start_number) || 1;
      const total = Math.min(parseInt(count), 100); // max 100 at once
      const pfx = prefix !== undefined ? prefix : 'M';
      
      for (let i = 0; i < total; i++) {
        const num = start + i;
        itemsToInsert.push({
          name: `${pfx}${num}`,
          area_id: area_id || null,
          capacity: parseInt(capacity) || 4,
          type: type || 'Standard',
          shape: shape || 'square',
        });
      }
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Geçersiz toplu masa verisi' });
    }

    const createdTables = [];
    for (const item of itemsToInsert) {
      if (!item.name || !item.name.trim()) continue;
      const { rows: [created] } = await client.query(`
        INSERT INTO tables (cafe_id, area_id, name, capacity, type, pos_x, pos_y, shape)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
      `, [cafeId, item.area_id, item.name.trim(), item.capacity || 4, item.type || 'Standard', 0, 0, item.shape || 'square']);
      createdTables.push(created);
    }

    await client.query('COMMIT');
    res.json({ success: true, count: createdTables.length, tables: createdTables });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/tables/:id/position - Save table drag position
router.patch('/:id/position', authenticate, async (req, res) => {
  try {
    const { pos_x, pos_y } = req.body;
    const { rows } = await db.query(`
      UPDATE tables SET pos_x = $1, pos_y = $2 WHERE id = $3 AND cafe_id = $4 RETURNING *
    `, [pos_x, pos_y, req.params.id, req.user.cafe_id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tables/:id - Update table
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { name, area_id, capacity, type, shape, is_active } = req.body;
    const { rows } = await db.query(`
      UPDATE tables SET
        name = COALESCE($1, name),
        area_id = COALESCE($2, area_id),
        capacity = COALESCE($3, capacity),
        type = COALESCE($4, type),
        shape = COALESCE($5, shape),
        is_active = COALESCE($6, is_active)
      WHERE id = $7 AND cafe_id = $8 RETURNING *
    `, [name, area_id, capacity, type, shape, is_active, req.params.id, req.user.cafe_id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tables/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await db.query('UPDATE tables SET is_active = false WHERE id = $1 AND cafe_id = $2', [req.params.id, req.user.cafe_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
