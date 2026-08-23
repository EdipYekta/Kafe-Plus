const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// GET /api/expenses
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT e.*, u.full_name as recorded_by, es.title as structure_title
      FROM expenses e LEFT JOIN users u ON e.user_id=u.id
      LEFT JOIN expense_structures es ON e.expense_structure_id = es.id
      WHERE e.cafe_id=$1 ORDER BY e.created_at DESC
    `, [req.user.cafe_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { title, expense_type, amount, description, expense_structure_id, expense_date } = req.body;
    const { rows } = await db.query(`
      INSERT INTO expenses (cafe_id, user_id, title, expense_type, amount, description, expense_structure_id, expense_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [req.user.cafe_id, req.user.id, title, expense_type, amount, description, expense_structure_id, expense_date || new Date()]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/structures
router.get('/structures', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM expense_structures WHERE cafe_id=$1 AND is_active=true ORDER BY title', [req.user.cafe_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/structures', authenticate, async (req, res) => {
  try {
    const { title, category, recurrence_type, amount, due_day } = req.body;
    const { rows } = await db.query(`
      INSERT INTO expense_structures (cafe_id, title, category, recurrence_type, amount, due_day)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [req.user.cafe_id, title, category, recurrence_type, amount, due_day]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
