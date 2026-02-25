const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// Get reviews for a product
router.get('/:productId', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT r.*, u.full_name FROM product_reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = ? ORDER BY r.created_at DESC',
            [req.params.productId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add a review
router.post('/', async (req, res) => {
    try {
        const { product_id, user_id, rating, comment } = req.body;
        const { rows } = await db.query(
            'INSERT INTO product_reviews (id, product_id, user_id, rating, comment) VALUES (?, ?, ?, ?, ?) RETURNING *',
            [crypto.randomUUID(), product_id, user_id, rating, comment]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add review' });
    }
});

module.exports = router;
