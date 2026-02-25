const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ── API ROUTES ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'AR Surgical Hub API is running' });
});

const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');

app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);

const orderRoutes = require('./routes/orders');
const quoteRoutes = require('./routes/quotes');
const vacancyRoutes = require('./routes/vacancies');
const reviewRoutes = require('./routes/reviews');

app.use('/api/orders', orderRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/vacancies', vacancyRoutes);
app.use('/api/reviews', reviewRoutes);

const adminRoutes = require('./routes/admin');
const { requireAdmin } = require('./middleware/auth');
app.use('/api/admin', requireAdmin, adminRoutes);

// ── API STATUS ──────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ status: 'AR Surgical Hub API is running', env: process.env.NODE_ENV });
});

// ── ERROR HANDLING ──────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
