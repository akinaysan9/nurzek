// import fetch from 'node-fetch'; // Not needed in Node 18+

const API_URL = 'http://localhost:3001/api';

async function test() {
    console.log('--- Testing User Flow ---');
    const email = 'debug_user_' + Date.now() + '@test.com';
    const password = 'password123';
    let token = null;

    // 1. Register
    try {
        console.log(`1. Registering ${email}...`);
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, displayName: 'Debug User' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        console.log('   ✅ Registered:', data.user.id);
        token = data.token;
    } catch (e) {
        console.error('   ❌ Register Failed:', e.message);
        return;
    }

    // 2. Create Note
    try {
        console.log('2. Creating Note...');
        const res = await fetch(`${API_URL}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: 'Test Note',
                content: 'This is a debug note.',
                sourceBook: 'genclik',
                sourceSection: '1'
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        console.log('   ✅ Note Created:', data.note.id);
    } catch (e) {
        console.error('   ❌ Create Note Failed:', e.message);
    }

    // 3. Fetch Notes
    try {
        console.log('3. Fetching Notes...');
        const res = await fetch(`${API_URL}/notes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        console.log('   ✅ Notes Fetched:', data.notes.length);
        if (data.notes.length > 0) console.log('   ✅ Persistence Verified!');
        else console.error('   ❌ Persistence Failed: 0 notes returned.');
    } catch (e) {
        console.error('   ❌ Fetch Notes Failed:', e.message);
    }
}

test();
