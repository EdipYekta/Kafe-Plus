const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });

    const { rows } = await db.query(`
      SELECT u.*, r.name as role_name, c.name as cafe_name, c.logo_url
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN cafes c ON u.cafe_id = c.id
      WHERE LOWER(u.username) = LOWER($1) AND u.is_active = true
    `, [username.trim()]);

    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });

    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { userId: user.id, cafeId: user.cafe_id, role: user.role_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        role: user.role_name,
        cafe_id: user.cafe_id,
        cafe_name: user.cafe_name || 'Kafe+',
        logo_url: user.logo_url,
        avatar_color: user.avatar_color || '#f97316'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/pin-login
router.post('/pin-login', async (req, res) => {
  try {
    const { pin_code, cafe_id, username } = req.body;
    if (!pin_code) return res.status(400).json({ error: 'PIN kodu gerekli' });

    let query = `
      SELECT u.*, r.name as role_name, c.name as cafe_name, c.logo_url
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN cafes c ON u.cafe_id = c.id
      WHERE u.pin_code = $1 AND u.is_active = true
    `;
    const params = [String(pin_code).trim()];

    if (username) {
      params.push(String(username).trim());
      query += ` AND LOWER(u.username) = LOWER($${params.length})`;
    }
    if (cafe_id) {
      params.push(cafe_id);
      query += ` AND u.cafe_id = $${params.length}`;
    }

    const { rows } = await db.query(query, params);

    if (!rows[0]) return res.status(401).json({ error: 'Geçersiz veya bulunamayan PIN kodu' });
    const user = rows[0];

    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { userId: user.id, cafeId: user.cafe_id, role: user.role_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        role: user.role_name,
        cafe_id: user.cafe_id,
        cafe_name: user.cafe_name || 'Kafe+',
        logo_url: user.logo_url,
        avatar_color: user.avatar_color || '#f97316'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/admin-login (Super Admin - hardcoded password)
router.post('/admin-login', async (req, res) => {
  try {
    const { password } = req.body;
    const ADMIN_PASSWORD = 'Yekta1346!';

    if (!password || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Yanlış şifre' });
    }

    const token = jwt.sign(
      { userId: 0, cafeId: null, role: 'SuperAdmin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: 0,
        full_name: 'Sistem Yöneticisi',
        username: 'superadmin',
        role: 'SuperAdmin',
        cafe_id: null,
        cafe_name: 'Kafe+ Yönetim',
        avatar_color: '#ef4444'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
const { authenticate } = require('../middleware/auth');
router.get('/me', authenticate, (req, res) => {
  const { password_hash, ...user } = req.user;
  res.json(user);
});

module.exports = router;
