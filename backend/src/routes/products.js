const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/products
router.get('/', authenticate, async (req, res) => {
  try {
    const { category_id, search, quick } = req.query;
    let query = `
      SELECT p.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.cafe_id = $1 AND p.is_active = true
    `;
    const params = [req.user.cafe_id];
    if (quick === 'true') { query += ` AND p.is_quick_access = true`; }
    if (category_id) { params.push(category_id); query += ` AND p.category_id = $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND p.name ILIKE $${params.length}`; }
    query += ' ORDER BY p.is_quick_access DESC, c.sort_order, p.sort_order, p.name';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products (Admin or Manager)
router.post('/', authenticate, requireRole('SuperAdmin', 'Owner', 'Admin', 'Manager'), async (req, res) => {
  try {
    const { category_id, name, description, price, cost, image_url, stock_quantity, track_stock, preparation_time, is_quick_access } = req.body;
    const { rows } = await db.query(`
      INSERT INTO products (cafe_id, category_id, name, description, price, cost, image_url, stock_quantity, track_stock, preparation_time, is_quick_access)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [req.user.cafe_id, category_id, name, description, price, cost || 0, image_url, stock_quantity || 0, track_stock || false, preparation_time || 0, !!is_quick_access]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/:id (Admin or Manager)
router.patch('/:id', authenticate, requireRole('SuperAdmin', 'Owner', 'Admin', 'Manager'), async (req, res) => {
  try {
    const { name, description, price, cost, category_id, image_url, stock_quantity, track_stock, is_active, preparation_time, is_quick_access } = req.body;
    const { rows } = await db.query(`
      UPDATE products SET name=COALESCE($1,name), description=COALESCE($2,description),
        price=COALESCE($3,price), cost=COALESCE($4,cost), category_id=COALESCE($5,category_id),
        image_url=COALESCE($6,image_url), stock_quantity=COALESCE($7,stock_quantity),
        track_stock=COALESCE($8,track_stock), is_active=COALESCE($9,is_active),
        preparation_time=COALESCE($10,preparation_time),
        is_quick_access=COALESCE($11,is_quick_access)
      WHERE id=$12 AND cafe_id=$13 RETURNING *
    `, [name, description, price, cost, category_id, image_url, stock_quantity, track_stock, is_active, preparation_time, is_quick_access, req.params.id, req.user.cafe_id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id (Admin or Manager)
router.delete('/:id', authenticate, requireRole('SuperAdmin', 'Owner', 'Admin', 'Manager'), async (req, res) => {
  try {
    await db.query('UPDATE products SET is_active=false WHERE id=$1 AND cafe_id=$2', [req.params.id, req.user.cafe_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/import-json - SuperAdmin bulk import from [{ category, items:[{name,description,price}] }]
router.post('/import-json', authenticate, requireRole('SuperAdmin'), async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { cafe_id, data } = req.body;
    if (!cafe_id) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'cafe_id zorunludur' }); }
    if (!Array.isArray(data)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'data bir dizi olmalıdır' }); }

    let catCount = 0, prodCount = 0;
    for (let i = 0; i < data.length; i++) {
      const group = data[i];
      const catName = (group.category || '').toString().trim();
      if (!catName) continue;

      // Find or create category
      const { rows: existingCats } = await client.query(
        'SELECT id FROM categories WHERE cafe_id=$1 AND name=$2 AND is_active=true', [cafe_id, catName]
      );
      let categoryId = existingCats[0]?.id;
      if (!categoryId) {
        const { rows: [newCat] } = await client.query(
          'INSERT INTO categories (cafe_id, name, icon, sort_order) VALUES ($1,$2,$3,$4) RETURNING id',
          [cafe_id, catName, '☕', i]
        );
        categoryId = newCat.id;
        catCount++;
      }

      const items = Array.isArray(group.items) ? group.items : [];
      for (const item of items) {
        const name = (item.name || '').toString().trim();
        if (!name) continue;
        const price = parseFloat(item.price) || 0;
        const description = (item.description || '').toString().trim() || null;

        // Skip duplicates by name within cafe + category
        const { rows: dup } = await client.query(
          'SELECT id FROM products WHERE cafe_id=$1 AND category_id=$2 AND name=$3 AND is_active=true',
          [cafe_id, categoryId, name]
        );
        if (dup[0]) continue;

        await client.query(
          'INSERT INTO products (cafe_id, category_id, name, description, price) VALUES ($1,$2,$3,$4,$5)',
          [cafe_id, categoryId, name, description, price]
        );
        prodCount++;
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, categories_created: catCount, products_created: prodCount });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
