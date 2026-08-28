const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// GET /api/orders?session_id= or ?status=
router.get('/', authenticate, async (req, res) => {
  try {
    const { session_id, status } = req.query;
    let query = `
      SELECT o.*, u.full_name as waiter_name,
        t.name as table_name, a.name as area_name,
        json_agg(json_build_object(
          'id', oi.id, 'product_id', oi.product_id, 'product_name', p.name,
          'quantity', oi.quantity, 'paid_quantity', oi.paid_quantity, 'unit_price', oi.unit_price,
          'note', oi.note, 'status', oi.status
        ) ORDER BY oi.id) as items
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN sessions s ON o.session_id = s.id
      JOIN tables t ON s.table_id = t.id
      LEFT JOIN areas a ON t.area_id = a.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.cafe_id = $1
    `;
    const params = [req.user.cafe_id];
    if (session_id) { params.push(session_id); query += ` AND o.session_id = $${params.length}`; }
    if (status) { params.push(status); query += ` AND o.status = $${params.length}`; }
    query += ' GROUP BY o.id, u.full_name, t.name, a.name ORDER BY o.created_at DESC';
    
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders - Create new order
router.post('/', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { session_id, items, kitchen_note } = req.body;
    
    // Check if cafe has kitchen workflow enabled
    const { rows: [cafe] } = await client.query('SELECT kitchen_enabled FROM cafes WHERE id=$1', [req.user.cafe_id]);
    const initialStatus = cafe?.kitchen_enabled ? 'pending' : 'delivered';
    
    const { rows: [order] } = await client.query(`
      INSERT INTO orders (session_id, cafe_id, user_id, kitchen_note, status)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [session_id, req.user.cafe_id, req.user.id, kitchen_note, initialStatus]);

    for (const item of items) {
      const { rows: [prod] } = await client.query('SELECT price FROM products WHERE id=$1', [item.product_id]);
      await client.query(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, note, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [order.id, item.product_id, item.quantity, prod.price, item.note || null, initialStatus]);
    }

    await client.query('COMMIT');
    
    // Broadcast to Kitchen only if kitchen is enabled
    if (cafe?.kitchen_enabled && req.app.get('broadcast')) {
      req.app.get('broadcast')(req.user.cafe_id, 'new_order', { order_id: order.id, session_id }, 'Kitchen');
    }
    
    res.json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const { rows: [order] } = await db.query(`
      UPDATE orders SET status = $1, updated_at = NOW()
      WHERE id = $2 AND cafe_id = $3 RETURNING *
    `, [status, req.params.id, req.user.cafe_id]);
    
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });

    // Also update all order items status
    await db.query('UPDATE order_items SET status = $1 WHERE order_id = $2', [status, order.id]);

    // Broadcast to waiters/cashier
    if (req.app.get('broadcast')) {
      req.app.get('broadcast')(req.user.cafe_id, 'order_status_updated', { order_id: order.id, status });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/kitchen (Active orders for KDS display)
router.get('/kitchen', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.*, u.full_name as waiter_name,
        t.name as table_name, a.name as area_name,
        EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 as minutes_elapsed,
        json_agg(json_build_object(
          'id', oi.id, 'product_id', oi.product_id, 'product_name', p.name,
          'quantity', oi.quantity, 'note', oi.note, 'status', oi.status
        ) ORDER BY oi.id) as items
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN sessions s ON o.session_id = s.id
      JOIN tables t ON s.table_id = t.id
      LEFT JOIN areas a ON t.area_id = a.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.cafe_id = $1 AND o.status IN ('pending', 'preparing', 'ready')
      GROUP BY o.id, u.full_name, t.name, a.name
      ORDER BY o.created_at ASC
    `, [req.user.cafe_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper permission check for table item modifications
function canEditTableItems(user) {
  if (['SuperAdmin', 'Admin', 'Manager', 'Owner'].includes(user.role_name)) return true;
  return !!user.permissions?.can_edit_table_items;
}

// PATCH /api/orders/items/:itemId - Update quantity of an order item
router.patch('/items/:itemId', authenticate, async (req, res) => {
  try {
    if (!canEditTableItems(req.user)) {
      return res.status(403).json({ error: 'Masadaki ürünleri düzenleme yetkiniz yok' });
    }

    const qty = parseInt(req.body.quantity);
    if (!qty || qty < 1 || qty > 99) {
      return res.status(400).json({ error: 'Geçersiz adet (1-99 arası olmalı)' });
    }
    const { rows: [item] } = await db.query(`
      UPDATE order_items oi SET quantity=$1
      FROM orders o
      WHERE oi.id=$2 AND oi.order_id=o.id AND o.cafe_id=$3
      RETURNING oi.*
    `, [qty, req.params.itemId, req.user.cafe_id]);
    if (!item) return res.status(404).json({ error: 'Sipariş kalemi bulunamadı' });

    if (req.app.get('broadcast')) {
      try {
        req.app.get('broadcast')(req.user.cafe_id, 'order_item_updated', { item_id: item.id, quantity: item.quantity });
      } catch (bcErr) {}
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/orders/items/:itemId - Delete an order item from active session
router.delete('/items/:itemId', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    if (!canEditTableItems(req.user)) {
      return res.status(403).json({ error: 'Masadaki ürünleri silme yetkiniz yok' });
    }

    await client.query('BEGIN');

    // Find the item and its order
    const { rows: [item] } = await client.query(`
      SELECT oi.*, o.session_id, o.cafe_id
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.id = $1 AND o.cafe_id = $2
    `, [req.params.itemId, req.user.cafe_id]);

    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sipariş kalemi bulunamadı' });
    }

    // Delete the order item
    await client.query('DELETE FROM order_items WHERE id = $1', [item.id]);

    // Check if order still has any items left
    const { rows: remainingItems } = await client.query(
      'SELECT id FROM order_items WHERE order_id = $1',
      [item.order_id]
    );

    // If order has no more items, clean up the order
    if (remainingItems.length === 0) {
      await client.query('DELETE FROM orders WHERE id = $1', [item.order_id]);
    }

    await client.query('COMMIT');

    if (req.app.get('broadcast')) {
      try {
        req.app.get('broadcast')(req.user.cafe_id, 'order_item_deleted', { item_id: item.id, session_id: item.session_id });
      } catch (bcErr) {}
    }

    res.json({ success: true, message: 'Ürün masadan kaldırıldı' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
