const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// Create order
router.post('/', async (req, res) => {
    try {
        const { user_id, total_amount, shipping_address, payment_method, items } = req.body;

        // Start transaction
        await db.query('BEGIN');

        const { rows } = await db.query(
            'INSERT INTO orders (id, user_id, total_amount, shipping_address, payment_method) VALUES (?, ?, ?, ?, ?) RETURNING id',
            [crypto.randomUUID(), user_id || null, total_amount, shipping_address, payment_method]
        );
        const order_id = rows[0].id;

        for (const item of items) {
            await db.query(
                'INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)',
                [crypto.randomUUID(), order_id, item.product_id, item.quantity, item.price]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ id: order_id });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Order creation failed' });
    }
});

// Get user orders
router.get('/user/:userId', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
