const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Register
router.post('/register', async (req, res) => {
    try {
        const { full_name, email, password, phone } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if user already exists
        const { rows: existingUser } = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) return res.status(400).json({ error: 'User already exists' });

        // Get customer role id
        const roleResult = await db.query('SELECT id FROM roles WHERE name = ?', ['customer']);
        const roleId = roleResult.rows[0].id;

        const { rows } = await db.query(
            'INSERT INTO users (id, full_name, email, password_hash, phone, role_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, full_name, email',
            [crypto.randomUUID(), full_name, email, hashedPassword, phone, roleId]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const { rows } = await db.query('SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?', [email]);

        if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role_name }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role_name } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});

module.exports = router;
