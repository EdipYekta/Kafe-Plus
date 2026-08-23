const jwt = require('jsonwebtoken');
const db = require('../db');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token gerekli' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // SuperAdmin token (userId=0) - no DB lookup needed
    if (decoded.role === 'SuperAdmin' && decoded.userId === 0) {
      req.user = {
        id: 0,
        full_name: 'Sistem Yöneticisi',
        username: 'superadmin',
        role_name: 'SuperAdmin',
        cafe_id: null,
        is_active: true,
      };
      return next();
    }

    const { rows } = await db.query(
      'SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1 AND u.is_active = true',
      [decoded.userId]
    );
    
    if (!rows[0]) return res.status(401).json({ error: 'Geçersiz token' });
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token geçersiz veya süresi dolmuş' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role_name)) {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
};

module.exports = { authenticate, requireRole };
