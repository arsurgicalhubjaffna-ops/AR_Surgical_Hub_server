const request = require('supertest');
const app = require('../index');
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ─── HELPERS ───────────────────────────────────────────────
let adminToken;
let customerToken;
let testUserId;
let testProductId;
let testCategoryId;
let testOrderId;
let testReviewId;

// Wait for SQLite to be ready
beforeAll(async () => {
    // Setup database tables & seed data
    await db.setupDatabase();

    // Create a JWT secret if not set
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing';
    }

    // Generate admin token from seeded admin user
    const { rows: adminRows } = await db.query(
        "SELECT u.id, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin' LIMIT 1"
    );
    if (adminRows.length > 0) {
        adminToken = jwt.sign(
            { id: adminRows[0].id, role: adminRows[0].role_name },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
    }
});

afterAll(async () => {
    // Cleanup: close SQLite connection if available
    if (db.db) {
        await new Promise((resolve) => db.db.close(resolve));
    }
});

// ═══════════════════════════════════════════════════════════
// 1. HEALTH & STATUS ENDPOINTS
// ═══════════════════════════════════════════════════════════
describe('Health & Status', () => {
    test('GET / - should return API status', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status');
    });

    test('GET /api/health - should return ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.message).toBe('AR Surgical Hub API is running');
    });
});

// ═══════════════════════════════════════════════════════════
// 2. USER ROUTES (/api/users)
// ═══════════════════════════════════════════════════════════
describe('User Routes', () => {
    const testEmail = `testuser_${Date.now()}@test.com`;

    test('POST /api/users/register - should register a new user', async () => {
        const res = await request(app)
            .post('/api/users/register')
            .send({
                full_name: 'Test User',
                email: testEmail,
                password: 'password123',
                phone: '1234567890',
            });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('email', testEmail);
        testUserId = res.body.id;
    });

    test('POST /api/users/register - should reject duplicate email', async () => {
        const res = await request(app)
            .post('/api/users/register')
            .send({
                full_name: 'Duplicate User',
                email: testEmail,
                password: 'password123',
                phone: '0000000000',
            });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('User already exists');
    });

    test('POST /api/users/login - should login with valid credentials', async () => {
        const res = await request(app)
            .post('/api/users/login')
            .send({ email: testEmail, password: 'password123' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).toHaveProperty('email', testEmail);
        expect(res.body.user).toHaveProperty('role', 'customer');
        customerToken = res.body.token;
    });

    test('POST /api/users/login - should reject invalid password', async () => {
        const res = await request(app)
            .post('/api/users/login')
            .send({ email: testEmail, password: 'wrong_password' });
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
    });

    test('POST /api/users/login - should reject non-existent email', async () => {
        const res = await request(app)
            .post('/api/users/login')
            .send({ email: 'noone@nowhere.com', password: 'test' });
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
    });
});

// ═══════════════════════════════════════════════════════════
// 3. CATEGORY ROUTES (/api/categories)
// ═══════════════════════════════════════════════════════════
describe('Category Routes', () => {
    test('GET /api/categories - should return all categories', async () => {
        const res = await request(app).get('/api/categories');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        // Store a category id for later tests
        testCategoryId = res.body[0].id;
    });
});

// ═══════════════════════════════════════════════════════════
// 4. PRODUCT ROUTES (/api/products)
// ═══════════════════════════════════════════════════════════
describe('Product Routes', () => {
    test('GET /api/products - should return all active products', async () => {
        const res = await request(app).get('/api/products');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        // Store first product id
        testProductId = res.body[0].id;
    });

    test('GET /api/products?category=<id> - should filter by category', async () => {
        const res = await request(app).get(`/api/products?category=${testCategoryId}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/products/:id - should return a single product', async () => {
        const res = await request(app).get(`/api/products/${testProductId}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('id', testProductId);
        expect(res.body).toHaveProperty('name');
    });

    test('GET /api/products/:id - should 404 for non-existent product', async () => {
        const res = await request(app).get('/api/products/non-existent-id');
        expect(res.statusCode).toBe(404);
        expect(res.body.error).toBe('Product not found');
    });
});

// ═══════════════════════════════════════════════════════════
// 5. VACANCY ROUTES (/api/vacancies)
// ═══════════════════════════════════════════════════════════
describe('Vacancy Routes', () => {
    test('GET /api/vacancies - should return vacancies (may be empty)', async () => {
        const res = await request(app).get('/api/vacancies');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════
// 6. QUOTE ROUTES (/api/quotes)
// ═══════════════════════════════════════════════════════════
describe('Quote Routes', () => {
    test('POST /api/quotes - should create a quote', async () => {
        const res = await request(app)
            .post('/api/quotes')
            .send({ message: 'I need a bulk order of scalpels', user_id: testUserId });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('id');
    });
});

// ═══════════════════════════════════════════════════════════
// 7. REVIEW ROUTES (/api/reviews)
// ═══════════════════════════════════════════════════════════
describe('Review Routes', () => {
    test('POST /api/reviews - should add a review', async () => {
        const res = await request(app)
            .post('/api/reviews')
            .send({
                product_id: testProductId,
                user_id: testUserId,
                rating: 5,
                comment: 'Excellent product!',
            });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('id');
        testReviewId = res.body.id;
    });

    test('GET /api/reviews/:productId - should return reviews for a product', async () => {
        const res = await request(app).get(`/api/reviews/${testProductId}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0]).toHaveProperty('rating', 5);
        expect(res.body[0]).toHaveProperty('full_name');
    });

    test('GET /api/reviews/:productId - should return empty for non-existent product', async () => {
        const res = await request(app).get('/api/reviews/non-existent-id');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════
// 8. ORDER ROUTES (/api/orders)
// ═══════════════════════════════════════════════════════════
describe('Order Routes', () => {
    test('POST /api/orders - should create an order with items', async () => {
        const res = await request(app)
            .post('/api/orders')
            .send({
                user_id: testUserId,
                total_amount: 299.99,
                shipping_address: '123 Test St, Test City',
                payment_method: 'credit_card',
                items: [
                    { product_id: testProductId, quantity: 1, price: 299.99 },
                ],
            });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('id');
        testOrderId = res.body.id;
    });

    test('GET /api/orders/user/:userId - should return user orders', async () => {
        const res = await request(app).get(`/api/orders/user/${testUserId}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0]).toHaveProperty('total_amount');
    });

    test('GET /api/orders/user/:userId - should return empty for unknown user', async () => {
        const res = await request(app).get('/api/orders/user/unknown-user-id');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════
// 9. MIDDLEWARE - AUTH
// ═══════════════════════════════════════════════════════════
describe('Auth Middleware', () => {
    test('Admin route without token - should return 401', async () => {
        const res = await request(app).get('/api/admin/stats');
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('No token provided');
    });

    test('Admin route with invalid token - should return 401', async () => {
        const res = await request(app)
            .get('/api/admin/stats')
            .set('Authorization', 'Bearer invalid_token_here');
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('Invalid token');
    });

    test('Admin route with customer token - should return 403', async () => {
        const res = await request(app)
            .get('/api/admin/stats')
            .set('Authorization', `Bearer ${customerToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe('Admin access required');
    });
});

// ═══════════════════════════════════════════════════════════
// 10. ADMIN ROUTES (/api/admin) — requires admin token
// ═══════════════════════════════════════════════════════════
describe('Admin Routes', () => {
    // ── Stats ──
    test('GET /api/admin/stats - should return dashboard stats', async () => {
        const res = await request(app)
            .get('/api/admin/stats')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('products');
        expect(res.body).toHaveProperty('users');
        expect(res.body).toHaveProperty('orders');
        expect(res.body).toHaveProperty('revenue');
    });

    // ── Admin Products ──
    test('GET /api/admin/products - should list all products', async () => {
        const res = await request(app)
            .get('/api/admin/products')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    let adminCreatedProductId;

    test('POST /api/admin/products - should create a product', async () => {
        const res = await request(app)
            .post('/api/admin/products')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test Surgical Gloves',
                description: 'Latex-free surgical gloves',
                price: 19.99,
                stock: 500,
                category_id: testCategoryId,
                image_url: 'https://example.com/gloves.jpg',
            });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('Test Surgical Gloves');
        adminCreatedProductId = res.body.id;
    });

    test('PUT /api/admin/products/:id - should update a product', async () => {
        const res = await request(app)
            .put(`/api/admin/products/${adminCreatedProductId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Updated Surgical Gloves',
                description: 'Updated description',
                price: 24.99,
                stock: 600,
                category_id: testCategoryId,
                image_url: 'https://example.com/gloves_v2.jpg',
                is_active: 1,
            });
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Product updated');
    });

    test('DELETE /api/admin/products/:id - should delete a product', async () => {
        const res = await request(app)
            .delete(`/api/admin/products/${adminCreatedProductId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Product deleted');
    });

    // ── Admin Orders ──
    test('GET /api/admin/orders - should list all orders', async () => {
        const res = await request(app)
            .get('/api/admin/orders')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('PUT /api/admin/orders/:id/status - should update order status', async () => {
        const res = await request(app)
            .put(`/api/admin/orders/${testOrderId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'shipped' });
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Order status updated');
    });

    // ── Admin Users ──
    test('GET /api/admin/users - should list all users', async () => {
        const res = await request(app)
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    // ── Admin Categories ──
    test('GET /api/admin/categories - should list all categories', async () => {
        const res = await request(app)
            .get('/api/admin/categories')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    let adminCreatedCategoryId;

    test('POST /api/admin/categories - should create a category', async () => {
        const res = await request(app)
            .post('/api/admin/categories')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test Category',
                description: 'A test category for testing',
                image_url: 'https://example.com/test.jpg',
            });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('Test Category');
        adminCreatedCategoryId = res.body.id;
    });

    test('PUT /api/admin/categories/:id - should update a category', async () => {
        const res = await request(app)
            .put(`/api/admin/categories/${adminCreatedCategoryId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Updated Test Category',
                description: 'Updated description',
                image_url: 'https://example.com/updated.jpg',
            });
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Category updated');
    });

    test('DELETE /api/admin/categories/:id - should delete a category', async () => {
        const res = await request(app)
            .delete(`/api/admin/categories/${adminCreatedCategoryId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Category deleted');
    });
});

// ═══════════════════════════════════════════════════════════
// 11. ERROR HANDLING
// ═══════════════════════════════════════════════════════════
describe('Error Handling', () => {
    test('Non-existent route - should return 404 or fallback', async () => {
        const res = await request(app).get('/api/non-existent-route');
        // Express returns 404 by default for undefined routes
        expect(res.statusCode).toBe(404);
    });
});
