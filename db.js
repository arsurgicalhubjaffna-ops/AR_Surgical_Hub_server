const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// =========================================================
// DUAL DATABASE SUPPORT
// - Railway (Production): Uses PostgreSQL via DATABASE_URL
// - Local (Development):  Uses SQLite
// =========================================================

let query;

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

    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error connecting to SQLite:', err.message);
        } else {
            console.log('Connected to the SQLite database.');
        }
    });

    // SQLite query helper - converts $1, $2 → ? for SQLite compatibility
    query = (text, params) => {
        return new Promise((resolve, reject) => {
            const sql = text.replace(/\$\d+/g, '?');

            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else {
                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve({ rows: [], lastID: this.lastID, changes: this.changes });
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
