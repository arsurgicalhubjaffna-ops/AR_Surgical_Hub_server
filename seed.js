const db = require('./db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const seed = async () => {
    try {
        console.log('Starting SQLite database seed...');

        // Read and execute schema
        const schemaPath = path.join(__dirname, 'schema_sqlite.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await new Promise((resolve, reject) => {
            db.db.exec(schema, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Schema applied.');

        // Roles
        const roles = [
            { id: crypto.randomUUID(), name: 'admin' },
            { id: crypto.randomUUID(), name: 'manager' },
            { id: crypto.randomUUID(), name: 'customer' }
        ];

        for (const role of roles) {
            await db.query('INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)', [role.id, role.name]);
        }

        // Fetch actual IDs (in case they existed)
        const { rows: dbRoles } = await db.query('SELECT * FROM roles');
        const adminId = dbRoles.find(r => r.name === 'admin').id;
        const customerId = dbRoles.find(r => r.name === 'customer').id;

        // Seed admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        await db.query(
            'INSERT OR IGNORE INTO users (id, full_name, email, password_hash, phone, role_id) VALUES (?, ?, ?, ?, ?, ?)',
            [crypto.randomUUID(), 'Admin User', 'admin@arsurgical.com', adminPassword, '+1 555 000 0000', adminId]
        );
        console.log('Admin user seeded: admin@arsurgical.com / admin123');

        // Categories
        const categories = [
            { id: crypto.randomUUID(), name: 'Diagnostic', description: 'Instruments for medical diagnosis' },
            { id: crypto.randomUUID(), name: 'Surgical', description: 'General surgical instruments' },
            { id: crypto.randomUUID(), name: 'Ophthalmic', description: 'Specialized eye surgery tools' },
            { id: crypto.randomUUID(), name: 'Orthopedic', description: 'Bone and joint surgical tools' },
        ];

        for (const cat of categories) {
            await db.query('INSERT OR IGNORE INTO categories (id, name, description) VALUES (?, ?, ?)', [cat.id, cat.name, cat.description]);
        }

        const { rows: dbCats } = await db.query('SELECT * FROM categories');
        const diagId = dbCats.find(c => c.name === 'Diagnostic').id;
        const surgId = dbCats.find(c => c.name === 'Surgical').id;
        const ophthId = dbCats.find(c => c.name === 'Ophthalmic').id;
        const orthoId = dbCats.find(c => c.name === 'Orthopedic').id;

        // Products
        const products = [
            { name: 'Premium Stethoscope', description: 'High-quality acoustic stethoscope for professionals.', price: 120.0, stock: 50, cat: diagId, img: 'https://images.unsplash.com/photo-1584982324671-93959baa1264?w=400' },
            { name: 'Surgical Scalpel Set', description: 'Reusable stainless steel scalpel handles and blades.', price: 45.5, stock: 200, cat: surgId, img: 'https://images.unsplash.com/photo-1579154341098-e4e158cc7f55?w=400' },
            { name: 'Digital Reflex Hammer', description: 'Electronic diagnostic hammer for reflex testing.', price: 85.0, stock: 30, cat: diagId, img: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400' },
            { name: 'Hemostat Forceps', description: 'Precision locking forceps for surgical procedures.', price: 25.99, stock: 150, cat: surgId, img: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=400' },
            { name: 'Ophthalmoscope', description: 'Direct ophthalmoscope for retinal examination.', price: 240.0, stock: 20, cat: ophthId, img: 'https://images.unsplash.com/photo-1581595219315-a187dd40c322?w=400' },
            { name: 'Bone Saw', description: 'Oscillating bone saw for orthopedic surgery.', price: 680.0, stock: 10, cat: orthoId, img: 'https://images.unsplash.com/photo-1590012314607-cda9d9b699ae?w=400' },
        ];

        for (const p of products) {
            await db.query(
                'INSERT OR IGNORE INTO products (id, name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [crypto.randomUUID(), p.name, p.description, p.price, p.stock, p.cat, p.img]
            );
        }

        // Careers & Vacancies
        const careerId = crypto.randomUUID();
        await db.query('INSERT OR IGNORE INTO careers (id, title, description) VALUES (?, ?, ?)', [careerId, 'Medical Sales Representative', 'Join our sales team to expand our footprint in the surgical market.']);
        await db.query('INSERT OR IGNORE INTO careers (id, title, description) VALUES (?, ?, ?)', [crypto.randomUUID(), 'Software Engineer', 'Build digital solutions for medical procurement.']);

        await db.query(
            'INSERT OR IGNORE INTO vacancies (id, career_id, position, location, salary_range) VALUES (?, ?, ?, ?, ?)',
            [crypto.randomUUID(), careerId, 'Senior Sales Executive', 'New York, US', '$80k - $120k']
        );
        await db.query(
            'INSERT OR IGNORE INTO vacancies (id, career_id, position, location, salary_range) VALUES (?, ?, ?, ?, ?)',
            [crypto.randomUUID(), careerId, 'Product Specialist', 'London, UK', '£45k - £65k']
        );

        console.log('Seed completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Seed failed:', err);
        process.exit(1);
    }
};

seed();
