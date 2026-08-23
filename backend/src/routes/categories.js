const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// GET /api/categories
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
      WHERE c.cafe_id=$1 AND c.is_active=true
      GROUP BY c.id ORDER BY c.sort_order, c.name
    `, [req.user.cafe_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, icon, color, sort_order } = req.body;
    const { rows } = await db.query(`
      INSERT INTO categories (cafe_id, name, icon, color, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [req.user.cafe_id, name, icon, color || '#6366f1', sort_order || 0]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { name, icon, color, sort_order, is_active } = req.body;
    const { rows } = await db.query(`
      UPDATE categories SET name=COALESCE($1,name), icon=COALESCE($2,icon), color=COALESCE($3,color),
        sort_order=COALESCE($4,sort_order), is_active=COALESCE($5,is_active)
      WHERE id=$6 AND cafe_id=$7 RETURNING *
    `, [name, icon, color, sort_order, is_active, req.params.id, req.user.cafe_id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await db.query('UPDATE categories SET is_active=false WHERE id=$1 AND cafe_id=$2', [req.params.id, req.user.cafe_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
