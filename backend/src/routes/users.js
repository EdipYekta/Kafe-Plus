const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/users/roles
router.get('/roles', authenticate, async (req, res) => {
  try {
    // SuperAdmin sees Owner/Manager/Cashier/Waiter/Kitchen (everything except SuperAdmin)
    if (req.user.role_name === 'SuperAdmin') {
      const { rows } = await db.query("SELECT * FROM roles WHERE name != 'SuperAdmin' ORDER BY id");
      return res.json(rows);
    }
    // Owner/Manager/etc. cannot see Owner/Admin/SuperAdmin roles
    const { rows } = await db.query("SELECT * FROM roles WHERE name NOT IN ('SuperAdmin','Owner','Admin') ORDER BY id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users
router.get('/', authenticate, requireRole('SuperAdmin', 'Owner', 'Admin', 'Manager'), async (req, res) => {
  try {
    const cafeId = req.query.cafe_id || req.user.cafe_id;
    if (!cafeId && req.user.role_name !== 'SuperAdmin') {
      return res.status(400).json({ error: 'cafe_id gerekli' });
    }

    let query = `
      SELECT u.id, u.full_name, u.username, u.avatar_color, u.is_active, u.last_login, u.created_at, u.pin_code, u.permissions,
        r.name as role_name, r.id as role_id, u.cafe_id
      FROM users u JOIN roles r ON u.role_id = r.id
    `;
    const params = [];

    if (cafeId) {
      // Exclude SuperAdmin from staff lists
      params.push(cafeId);
      query += ` WHERE u.cafe_id = $1 AND r.name NOT IN ('SuperAdmin') ORDER BY u.full_name`;
    } else {
      // SuperAdmin: all users except other superadmins
      query += ` WHERE r.name != 'SuperAdmin' ORDER BY u.cafe_id, u.full_name`;
    }

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post('/', authenticate, requireRole('SuperAdmin', 'Owner', 'Admin', 'Manager'), async (req, res) => {
  try {
    const { full_name, username, password, role_id, avatar_color, pin_code, cafe_id, permissions } = req.body;
    if (!password) return res.status(400).json({ error: 'Şifre zorunludur' });
    if (!full_name) return res.status(400).json({ error: 'Ad Soyad zorunludur' });

    const targetCafeId = (req.user.role_name === 'SuperAdmin' ? cafe_id : req.user.cafe_id);
    if (!targetCafeId) return res.status(400).json({ error: 'cafe_id gerekli' });

    // Owner/Manager can only assign non-admin roles
    if (req.user.role_name === 'Owner' || req.user.role_name === 'Manager') {
      const { rows: roleCheck } = await db.query(
        "SELECT name FROM roles WHERE id = $1", [role_id]
      );
      if (roleCheck[0] && ['Owner', 'Admin', 'SuperAdmin'].includes(roleCheck[0].name)) {
        return res.status(403).json({ error: 'Bu rol için yetkiniz yok' });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(`
      INSERT INTO users (cafe_id, role_id, full_name, username, password_hash, avatar_color, pin_code, permissions)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id, full_name, username, role_id, avatar_color, is_active, created_at, cafe_id, permissions
    `, [targetCafeId, role_id, full_name, username, hash, avatar_color || '#6366f1', pin_code || null,
        permissions ? JSON.stringify(permissions) : '{}']);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanımda' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id
router.patch('/:id', authenticate, requireRole('SuperAdmin', 'Owner', 'Admin', 'Manager'), async (req, res) => {
  try {
    const { full_name, role_id, avatar_color, is_active, pin_code, password, permissions } = req.body;

    const cafeFilter = req.user.role_name === 'SuperAdmin' ? '' : `AND cafe_id=${req.user.cafe_id}`;

    const { rows: current } = await db.query(
      `SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1 ${cafeFilter}`,
      [req.params.id]
    );
    if (!current[0]) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    // Owner/Manager cannot edit Owner/Admin users
    if ((req.user.role_name === 'Owner' || req.user.role_name === 'Manager') && ['Owner', 'Admin', 'SuperAdmin'].includes(current[0].role_name)) {
      return res.status(403).json({ error: 'Bu kullanıcıyı düzenleme yetkiniz yok' });
    }

    let hash = undefined;
    if (password) hash = await bcrypt.hash(password, 10);

    const { rows } = await db.query(`
      UPDATE users SET
        full_name=COALESCE($1,full_name), role_id=COALESCE($2,role_id),
        avatar_color=COALESCE($3,avatar_color), is_active=COALESCE($4,is_active),
        pin_code=COALESCE($5,pin_code),
        password_hash=COALESCE($6,password_hash),
        permissions=COALESCE($7::jsonb,permissions)
      WHERE id=$8 ${cafeFilter}
      RETURNING id, full_name, username, role_id, avatar_color, is_active, cafe_id, permissions
    `, [full_name, role_id, avatar_color, is_active, pin_code, hash,
        permissions ? JSON.stringify(permissions) : null,
        req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authenticate, requireRole('SuperAdmin', 'Owner', 'Admin', 'Manager'), async (req, res) => {
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
