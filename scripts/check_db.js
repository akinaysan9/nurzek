import { initDB, all } from '../backend/db/database.js';

async function check() {
    console.log('--- Checking Database ---');
    try {
        const db = await initDB();

        // 1. Check Tables
        const tables = all("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('Tables:', tables.map(t => t.name));

        // 2. Check Notes Table Schema
        const notesInfo = all("PRAGMA table_info(notes)");
        console.log('Notes Table Columns:', notesInfo.map(c => c.name));

        // 3. Check Row Count
        const count = all("SELECT COUNT(*) as c FROM notes");
        console.log('Notes Count:', count[0].c);

    } catch (e) {
        console.error('Error:', e);
    }
}

check();
