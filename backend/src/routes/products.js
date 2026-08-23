const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/products
router.get('/', authenticate, async (req, res) => {
  try {
    const { category_id, search } = req.query;
    let query = `
      SELECT p.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.cafe_id = $1 AND p.is_active = true
    `;
    const params = [req.user.cafe_id];
    if (category_id) { params.push(category_id); query += ` AND p.category_id = $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND p.name ILIKE $${params.length}`; }
    query += ' ORDER BY c.sort_order, p.sort_order, p.name';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products (Only Admin can add coffees/products)
router.post('/', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const { category_id, name, description, price, cost, image_url, stock_quantity, track_stock, preparation_time } = req.body;
    const { rows } = await db.query(`
      INSERT INTO products (cafe_id, category_id, name, description, price, cost, image_url, stock_quantity, track_stock, preparation_time)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [req.user.cafe_id, category_id, name, description, price, cost || 0, image_url, stock_quantity || 0, track_stock || false, preparation_time || 0]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/:id (Only Admin can update coffees/products)
router.patch('/:id', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const { name, description, price, cost, category_id, image_url, stock_quantity, track_stock, is_active, preparation_time } = req.body;
    const { rows } = await db.query(`
      UPDATE products SET name=COALESCE($1,name), description=COALESCE($2,description),
        price=COALESCE($3,price), cost=COALESCE($4,cost), category_id=COALESCE($5,category_id),
        image_url=COALESCE($6,image_url), stock_quantity=COALESCE($7,stock_quantity),
        track_stock=COALESCE($8,track_stock), is_active=COALESCE($9,is_active),
        preparation_time=COALESCE($10,preparation_time)
      WHERE id=$11 AND cafe_id=$12 RETURNING *
    `, [name, description, price, cost, category_id, image_url, stock_quantity, track_stock, is_active, preparation_time, req.params.id, req.user.cafe_id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id (Only Admin can delete coffees/products)
router.delete('/:id', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    await db.query('UPDATE products SET is_active=false WHERE id=$1 AND cafe_id=$2', [req.params.id, req.user.cafe_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
