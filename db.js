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

    module.exports = { db, query };
}
