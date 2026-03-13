import { all, initDB } from './db/database.js';

async function debug() {
    await initDB();

    console.log('--- EXHAUSTIVE ID AUDIT ---');
    const allNotes = all('SELECT id, user_id, title FROM notes');
    allNotes.forEach(n => {
        console.log(`[${n.user_id}] ID: ${n.id} | Title: ${n.title}`);
    });

    const allHighlights = all('SELECT id, user_id FROM highlights');
    allHighlights.forEach(h => {
        console.log(`[HIGHLIGHT][${h.user_id}] ID: ${h.id}`);
    });

    const targetId = '9f0e0853-3beb-4ff8-8b39-ea98742b2ad5';
    const found = [...allNotes, ...allHighlights].find(item => item.id === targetId);
    if (found) {
        console.log(`\n!!! TARGET ID FOUND !!!`);
        console.log(JSON.stringify(found, null, 2));
    } else {
        console.log(`\nTarget ID ${targetId} NOT FOUND anywhere in DB.`);
    }
}

debug().catch(console.error);
