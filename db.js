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
        console.log('✅ Database setup completed successfully.');
    } catch (err) {
        console.error('❌ Database setup failed:', err.message);
    }
}

// Initial setup removed from here as it's called in index.js

// Ensure exports include setupDatabase
if (process.env.DATABASE_URL) {
    module.exports = { query, setupDatabase };
} else {
    module.exports = { db, query, setupDatabase };
}
