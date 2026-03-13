
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

console.log(`Testing API Key: ${API_KEY ? 'Present' : 'Missing'}`);
console.log(`Base URL: ${BASE_URL}`);

async function testEndpoint(url, body, label) {
    console.log(`\n--- Testing ${label} ---`);
    console.log(`URL: ${url}`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(body)
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Body: ${text.substring(0, 200)}...`); // truncate
    } catch (error) {
        console.error("Fetch error:", error.message);
    }
}

async function runTests() {
    // 1. Test Chat (Baseline)
    await testEndpoint(
        `${BASE_URL}/chat/completions`,
        { model: "deepseek-chat", messages: [{ role: "user", content: "hi" }] },
        "Chat Completion"
    );

    // 2. Test Embeddings (Standard v1)
    await testEndpoint(
        `${BASE_URL}/embeddings`, // usually defaults to v1
        { model: "deepseek-embeddings", input: "test" },
        "Embeddings (Root)"
    );

    // 3. Test Embeddings (v1 explicit)
    await testEndpoint(
        `${BASE_URL}/v1/embeddings`,
        { model: "deepseek-embeddings", input: "test" },
        "Embeddings (/v1)"
    );

    // 4. Test Embeddings (beta)
    await testEndpoint(
        `${BASE_URL}/beta/embeddings`,
        { model: "deepseek-embeddings", input: "test" },
        "Embeddings (/beta)"
    );
}

runTests();
