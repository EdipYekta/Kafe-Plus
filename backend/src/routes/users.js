const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/users/roles
router.get('/roles', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM roles ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users?cafe_id=X (SuperAdmin can get users for any cafe)
router.get('/', authenticate, requireRole('SuperAdmin', 'Admin', 'Manager'), async (req, res) => {
  try {
    const cafeId = req.query.cafe_id || req.user.cafe_id;
    if (!cafeId) return res.status(400).json({ error: 'cafe_id gerekli' });

    const { rows } = await db.query(`
      SELECT u.id, u.full_name, u.username, u.avatar_color, u.is_active, u.last_login, u.created_at, u.pin_code,
        r.name as role_name, r.id as role_id, u.cafe_id
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.cafe_id=$1 ORDER BY u.full_name
    `, [cafeId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users (SuperAdmin can create users for any cafe)
router.post('/', authenticate, requireRole('SuperAdmin', 'Admin', 'Manager'), async (req, res) => {
  try {
    const { full_name, username, password, role_id, avatar_color, pin_code, cafe_id } = req.body;
    if (!password) return res.status(400).json({ error: 'Şifre zorunludur' });

    const targetCafeId = cafe_id || req.user.cafe_id;
    if (!targetCafeId) return res.status(400).json({ error: 'cafe_id gerekli' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(`
      INSERT INTO users (cafe_id, role_id, full_name, username, password_hash, avatar_color, pin_code)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, full_name, username, role_id, avatar_color, is_active, created_at, cafe_id
    `, [targetCafeId, role_id, full_name, username, hash, avatar_color || '#6366f1', pin_code]);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanımda' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id
router.patch('/:id', authenticate, requireRole('SuperAdmin', 'Admin', 'Manager'), async (req, res) => {
  try {
    const { full_name, role_id, avatar_color, is_active, pin_code, password } = req.body;
    let hash = undefined;
    if (password) hash = await bcrypt.hash(password, 10);

    // SuperAdmin can edit any user, others only their cafe's users
    const cafeFilter = req.user.role_name === 'SuperAdmin' ? '' : `AND cafe_id=${req.user.cafe_id}`;

    const { rows } = await db.query(`
      UPDATE users SET
        full_name=COALESCE($1,full_name), role_id=COALESCE($2,role_id),
        avatar_color=COALESCE($3,avatar_color), is_active=COALESCE($4,is_active),
        pin_code=COALESCE($5,pin_code),
        password_hash=COALESCE($6,password_hash)
      WHERE id=$7 ${cafeFilter}
      RETURNING id, full_name, username, role_id, avatar_color, is_active, cafe_id
    `, [full_name, role_id, avatar_color, is_active, pin_code, hash, req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authenticate, requireRole('SuperAdmin', 'Admin'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
    }
    const cafeFilter = req.user.role_name === 'SuperAdmin' ? '' : `AND cafe_id=${req.user.cafe_id}`;
    try {
      const { rowCount } = await db.query(`DELETE FROM users WHERE id=$1 ${cafeFilter}`, [req.params.id]);
      if (rowCount === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      res.json({ success: true, message: 'Kullanıcı silindi' });
    } catch (fkErr) {
      await db.query(`UPDATE users SET is_active=false WHERE id=$1 ${cafeFilter}`, [req.params.id]);
      res.json({ success: true, message: 'Kullanıcı pasife alındı' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
