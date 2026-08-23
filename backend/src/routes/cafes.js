const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/cafes/all (SuperAdmin or Admin: list all cafes)
router.get('/all', authenticate, requireRole('SuperAdmin', 'Admin'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM users u WHERE u.cafe_id = c.id AND u.is_active = true) as user_count,
        (SELECT COUNT(*) FROM tables t WHERE t.cafe_id = c.id AND t.is_active = true) as table_count
      FROM cafes c ORDER BY c.id ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cafes (Current user's cafe, or all for SuperAdmin)
router.get('/', authenticate, async (req, res) => {
  try {
    if (!req.user.cafe_id) {
      const { rows } = await db.query('SELECT * FROM cafes ORDER BY id ASC');
      return res.json(rows);
    }
    const { rows } = await db.query('SELECT * FROM cafes WHERE id=$1', [req.user.cafe_id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cafes (SuperAdmin or Admin: create a new cafe)
router.post('/', authenticate, requireRole('SuperAdmin', 'Admin'), async (req, res) => {
  try {
    const { name, phone, address, logo_url, timezone, currency, kitchen_enabled } = req.body;
    if (!name) return res.status(400).json({ error: 'Kafe adı zorunludur' });

    const { rows } = await db.query(`
      INSERT INTO cafes (name, phone, address, logo_url, timezone, currency, kitchen_enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, phone, address, logo_url, timezone || 'Europe/Istanbul', currency || 'TRY', kitchen_enabled || false]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/cafes/:id (Update cafe)
router.patch('/:id', authenticate, requireRole('SuperAdmin', 'Admin', 'Manager'), async (req, res) => {
  try {
    const { name, phone, address, logo_url, timezone, currency, kitchen_enabled, is_active } = req.body;
    const { rows } = await db.query(`
      UPDATE cafes SET
        name=COALESCE($1, name),
        phone=COALESCE($2, phone),
        address=COALESCE($3, address),
        logo_url=COALESCE($4, logo_url),
        timezone=COALESCE($5, timezone),
        currency=COALESCE($6, currency),
        kitchen_enabled=COALESCE($7, kitchen_enabled),
        is_active=COALESCE($8, is_active)
      WHERE id=$9 RETURNING *
    `, [name, phone, address, logo_url, timezone, currency,
        kitchen_enabled !== undefined ? kitchen_enabled : null,
        is_active !== undefined ? is_active : null,
        req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/cafes/:id (SuperAdmin only)
router.delete('/:id', authenticate, requireRole('SuperAdmin'), async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM cafes WHERE id=$1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Kafe bulunamadı' });
    res.json({ success: true, message: 'Kafe silindi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
