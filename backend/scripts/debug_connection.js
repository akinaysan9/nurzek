
import fetch from 'node-fetch';

async function testConnection() {
    const urls = [
        'http://localhost:3001/api/health',
        'http://localhost:3001/',
        'http://localhost:3001/src/main.js'
    ];

    console.log("🔍 Testing Server Response Times...");

    for (const url of urls) {
        const start = Date.now();
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const res = await fetch(url, { signal: controller.signal });
            const duration = Date.now() - start;
            clearTimeout(timeout);

            console.log(`✅ ${url} - Status: ${res.status} - Time: ${duration}ms`);
        } catch (e) {
            console.error(`❌ ${url} - FAILED: ${e.message} (Time: ${Date.now() - start}ms)`);
        }
    }
}

testConnection();
