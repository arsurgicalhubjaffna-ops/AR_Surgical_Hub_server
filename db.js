const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// =========================================================
// DUAL DATABASE SUPPORT
// - Railway (Production): Uses PostgreSQL via DATABASE_URL
// - Local (Development):  Uses SQLite
// =========================================================

let query;
let db;

if (process.env.DATABASE_URL) {
    // ── POSTGRESQL (Railway Production) ──
    console.log('🐘 Using PostgreSQL database (Railway)');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    pool.on('error', (err) => {
        console.error('Unexpected PostgreSQL pool error:', err.message);
    });

    // PostgreSQL query - direct pass-through (uses $1, $2 placeholders natively)
    query = (text, params) => pool.query(text, params);

    module.exports = { query };

} else {
    // ── SQLITE (Local Development) ──
    console.log('🗄️  Using SQLite database (Local Dev)');

    const dbPath = path.join(__dirname, 'db.sqlite');

    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error connecting to SQLite:', err.message);
        } else {
            console.log('Connected to the SQLite database.');
        }
    });

    // SQLite query helper - converts $1, $2 → ? for SQLite compatibility
    // Also handles RETURNING clause by simulating it with a follow-up SELECT
    query = (text, params) => {
        return new Promise((resolve, reject) => {
            let sql = text.replace(/\$\d+/g, '?');

            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else {
                // Check for RETURNING clause (PostgreSQL feature)
                const returningMatch = sql.match(/RETURNING\s+(.+)$/i);
                const cleanSql = returningMatch ? sql.replace(/RETURNING\s+.+$/i, '').trim() : sql;

                db.run(cleanSql, params, function (err) {
                    if (err) return reject(err);

                    const lastID = this.lastID;
                    const changes = this.changes;

                    if (returningMatch) {
                        // Detect the table name from the SQL
                        const insertMatch = cleanSql.match(/INSERT\s+INTO\s+(\w+)/i);
                        const updateMatch = cleanSql.match(/UPDATE\s+(\w+)/i);
                        const tableName = (insertMatch && insertMatch[1]) || (updateMatch && updateMatch[1]);

                        if (tableName && lastID) {
                            db.all(`SELECT * FROM ${tableName} WHERE rowid = ?`, [lastID], (err2, rows) => {
                                if (err2) return reject(err2);
                                resolve({ rows: rows || [], lastID, changes });
                            });
                        } else {
                            resolve({ rows: [], lastID, changes });
                        }
                    } else {
                        resolve({ rows: [], lastID, changes });
                    }
                });
            }
        });
    };

}

// ── DATABASE SETUP & SEEDING ────────────────────────────
async function setupDatabase() {
    try {
        console.log('🌱 Starting database setup...');

        // 1. Create essential tables if they don't exist
        await query(`
            CREATE TABLE IF NOT EXISTS roles (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                role_id VARCHAR(255) REFERENCES roles(id),
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(50),
                password_hash TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS categories (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(255) PRIMARY KEY,
                category_id VARCHAR(255) REFERENCES categories(id),
                name VARCHAR(200) NOT NULL,
                description TEXT,
                price DECIMAL(12,2) NOT NULL,
                stock INTEGER DEFAULT 0,
                image_url TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) REFERENCES users(id),
                total_amount DECIMAL(12,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                shipping_address TEXT,
                payment_method VARCHAR(50),
                payment_status VARCHAR(50) DEFAULT 'unpaid',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id VARCHAR(255) PRIMARY KEY,
                order_id VARCHAR(255) REFERENCES orders(id),
                product_id VARCHAR(255) REFERENCES products(id),
                quantity INTEGER NOT NULL,
                price DECIMAL(12,2) NOT NULL
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS product_reviews (
                id VARCHAR(255) PRIMARY KEY,
                product_id VARCHAR(255) REFERENCES products(id),
                user_id VARCHAR(255) REFERENCES users(id),
                rating INTEGER NOT NULL,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS quotes (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) REFERENCES users(id),
                message TEXT,
                status VARCHAR(50) DEFAULT 'new',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS vacancies (
                id VARCHAR(255) PRIMARY KEY,
                career_id VARCHAR(255),
                position VARCHAR(200) NOT NULL,
                location VARCHAR(150),
                salary_range VARCHAR(100),
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration: Add image_url to categories if missing
        try {
            if (process.env.DATABASE_URL) {
                await query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT');
            } else {
                await query('ALTER TABLE categories ADD COLUMN image_url TEXT');
            }
            console.log('✅ Column image_url verified for categories');
        } catch (e) {
            // Column likely already exists or table doesn't exist yet (unlikely)
        }

        // 2. Create Roles
        const roles = ['admin', 'customer'];
        for (const role of roles) {
            const { rows } = await query('SELECT id FROM roles WHERE name = $1', [role]);
            if (rows.length === 0) {
                const roleId = role === 'admin' ? 'admin-role-id' : 'customer-role-id';
                await query('INSERT INTO roles (id, name) VALUES ($1, $2)', [roleId, role]);
                console.log(`✅ Created role: ${role}`);
            }
        }

        // 3. Create Default Admin
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@arsurgical.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

        const { rows: adminRows } = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (adminRows.length === 0) {
            const bcrypt = require('bcryptjs');
            const crypto = require('crypto');
            const hashedPassword = await bcrypt.hash(adminPassword, 10);

            // Get admin role id
            const { rows: roleRes } = await query('SELECT id FROM roles WHERE name = $1', ['admin']);
            if (roleRes.length > 0) {
                const adminRoleId = roleRes[0].id;
                await query(
                    'INSERT INTO users (id, full_name, email, password_hash, role_id) VALUES ($1, $2, $3, $4, $5)',
                    [crypto.randomUUID(), 'System Admin', adminEmail, hashedPassword, adminRoleId]
                );
                console.log(`✅ Created default admin: ${adminEmail}`);
            }
        }
        await seedDatabase();
        console.log('✅ Database setup and seeding completed successfully.');
    } catch (err) {
        console.error('❌ Database setup failed:', err.message);
    }
}

async function seedDatabase() {
    console.log('🌱 Checking for sample data...');
    try {
        const crypto = require('crypto');

        // 1. Seed Categories
        const { rows: existingCats } = await query('SELECT count(*) as count FROM categories');
        if (parseInt(existingCats[0].count) === 0) {
            console.log('📂 Seeding categories...');
            const categories = [
                { name: 'Diagnostic Instruments', desc: 'High-precision tools for clinical diagnosis.', img: 'https://images.unsplash.com/photo-1584982324671-93959baa1264?w=400' },
                { name: 'Surgical Equipment', desc: 'Critical tools for general and specialized surgery.', img: 'https://images.unsplash.com/photo-1579154341098-e4e158cc7f55?w=400' },
                { name: 'Dental Supplies', desc: 'Professional dental care and surgery equipment.', img: 'https://images.unsplash.com/photo-1588776814546-1ffce47267a5?w=400' },
                { name: 'Laboratory Tools', desc: 'Advanced equipment for medical research and testing.', img: 'https://images.unsplash.com/photo-1581093196277-9f608ed1c58e?w=400' }
            ];
            for (const cat of categories) {
                await query(
                    'INSERT INTO categories (id, name, description, image_url) VALUES ($1, $2, $3, $4)',
                    [crypto.randomUUID(), cat.name, cat.desc, cat.img]
                );
            }
        }

        // 2. Seed Products
        const { rows: existingProds } = await query('SELECT count(*) as count FROM products');
        if (parseInt(existingProds[0].count) === 0) {
            console.log('📦 Seeding products...');
            const { rows: cats } = await query('SELECT id, name FROM categories');

            const products = [
                { name: 'Digital Stethoscope', price: 299.99, stock: 45, cat: 'Diagnostic Instruments', img: 'https://images.unsplash.com/photo-1584982324671-93959baa1264?w=500' },
                { name: 'Surgical Scalpel Set', price: 89.50, stock: 120, cat: 'Surgical Equipment', img: 'https://images.unsplash.com/photo-1579154341098-e4e158cc7f55?w=500' },
                { name: 'Professional Otoscope', price: 150.00, stock: 30, cat: 'Diagnostic Instruments', img: 'https://images.unsplash.com/photo-1581595219315-a187dd40c322?w=500' },
                { name: 'Dental Mirror Kit', price: 35.00, stock: 200, cat: 'Dental Supplies', img: 'https://images.unsplash.com/photo-1588776814546-1ffce47267a5?w=500' },
                { name: 'Microscope Model-X1', price: 1200.00, stock: 12, cat: 'Laboratory Tools', img: 'https://images.unsplash.com/photo-1581093196277-9f608ed1c58e?w=500' }
            ];

            for (const prod of products) {
                const catId = cats.find(c => c.name === prod.cat)?.id;
                if (catId) {
                    await query(
                        'INSERT INTO products (id, name, description, price, stock, category_id, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [crypto.randomUUID(), prod.name, `Professional grade ${prod.name.toLowerCase()}.`, prod.price, prod.stock, catId, prod.img]
                    );
                }
            }
        }

        console.log('✨ Seeding check completed.');
    } catch (err) {
        console.error('❌ Seeding failed:', err.message);
    }
}

// Initial setup removed from here as it's called in index.js

// Ensure exports include setupDatabase
if (process.env.DATABASE_URL) {
    module.exports = { query, setupDatabase };
} else {
    module.exports = { db, query, setupDatabase };
}
