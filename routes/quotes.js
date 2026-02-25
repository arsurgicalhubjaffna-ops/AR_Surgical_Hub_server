const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

router.post('/', async (req, res) => {
    try {
        const { message, user_id } = req.body;
        const { rows } = await db.query(
            'INSERT INTO quotes (id, user_id, message) VALUES (?, ?, ?) RETURNING id',
            [crypto.randomUUID(), user_id, message]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit quote' });
    }
});

module.exports = router;
