import { initDB, all } from '../backend/db/database.js';

async function checkUsers() {
    console.log('--- Checking Users & Ownership ---');
    try {
        await initDB();

        // 1. List Users
        const users = all("SELECT id, email, display_name FROM users");
        console.log('Users:', users);

        // 2. Group Notes by User ID
        const notes = all("SELECT user_id, count(*) as count FROM notes GROUP BY user_id");
        console.log('Notes per User:', notes);

    } catch (e) {
        console.error('Error:', e);
    }
}

checkUsers();
