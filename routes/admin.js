const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
    try {
        const [products, users, orders, revenue] = await Promise.all([
            db.query('SELECT COUNT(*) as count FROM products'),
            db.query('SELECT COUNT(*) as count FROM users'),
            db.query('SELECT COUNT(*) as count FROM orders'),
            db.query("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE payment_status = 'paid'"),
        ]);
        res.json({
            products: products.rows[0].count,
            users: users.rows[0].count,
            orders: orders.rows[0].count,
            revenue: revenue.rows[0].total,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/products
router.get('/products', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/products
router.post('/products', async (req, res) => {
    try {
        const { name, description, price, stock, category_id, image_url } = req.body;
        const { rows } = await db.query(
            'INSERT INTO products (id, name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *',
            [crypto.randomUUID(), name, description, price, stock, category_id, image_url]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// PUT /api/admin/products/:id
router.put('/products/:id', async (req, res) => {
    try {
        const { name, description, price, stock, category_id, image_url, is_active } = req.body;
        await db.query(
            'UPDATE products SET name=?, description=?, price=?, stock=?, category_id=?, image_url=?, is_active=? WHERE id=?',
            [name, description, price, stock, category_id, image_url, is_active ?? 1, req.params.id]
        );
        res.json({ message: 'Product updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM products WHERE id=?', [req.params.id]);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// GET /api/admin/orders
router.get('/orders', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT o.*, u.full_name, u.email FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/orders/:id/status
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await db.query('UPDATE orders SET status=? WHERE id=?', [status, req.params.id]);
        res.json({ message: 'Order status updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.created_at, r.name as role FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/categories
router.get('/categories', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM categories ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
