const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// Areas
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT a.*, COUNT(t.id) as table_count FROM areas a
      LEFT JOIN tables t ON t.area_id = a.id AND t.is_active = true
      WHERE a.cafe_id=$1 AND a.is_active=true GROUP BY a.id ORDER BY a.sort_order
    `, [req.user.cafe_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;
    const { rows } = await db.query(`
      INSERT INTO areas (cafe_id, name, description, sort_order) VALUES ($1,$2,$3,$4) RETURNING *
    `, [req.user.cafe_id, name, description, sort_order || 0]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;
    const { rows } = await db.query(`
      UPDATE areas SET name=COALESCE($1,name), description=COALESCE($2,description), sort_order=COALESCE($3,sort_order)
      WHERE id=$4 AND cafe_id=$5 RETURNING *
    `, [name, description, sort_order, req.params.id, req.user.cafe_id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await db.query('UPDATE areas SET is_active=false WHERE id=$1 AND cafe_id=$2', [req.params.id, req.user.cafe_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
