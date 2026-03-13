// Seed Admin User
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { run, get, initDB } from '../db/database.js';

async function seedAdmin() {
    console.log('--- Admin Seeding Started ---');

    // Initialize DB first
    await initDB();

    const adminEmail = 'admin@nurzek.com';
    const adminPass = 'admin123';
    const adminName = 'Admin (NurZek)';

    try {
        const existing = get('SELECT id FROM users WHERE email = ?', [adminEmail]);
        if (existing) {
            console.log('✅ Admin user already exists.');
            return;
        }

        const id = uuidv4();
        const passwordHash = await bcrypt.hash(adminPass, 10);

        run(
            'INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
            [id, adminEmail, passwordHash, adminName]
        );

        console.log('🚀 Admin user created successfully!');
        console.log(`📧 Email: ${adminEmail}`);
        console.log(`🔑 Password: ${adminPass}`);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
    }
}

seedAdmin();
