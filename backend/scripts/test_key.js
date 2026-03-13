
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

console.log(`Testing API Key: ${API_KEY ? 'Present' : 'Missing'}`);
console.log(`Base URL: ${BASE_URL}`);

async function testEmbedding() {
    try {
        const response = await fetch(`${BASE_URL}/v1/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-embeddings", // verifying model name
                input: "Test sentence for embedding."
            })
        });

        if (!response.ok) {
            console.error(`Status: ${response.status}`);
            const text = await response.text();
            console.error(`Body: ${text}`);
        } else {
            const data = await response.json();
            console.log("Success!");
            console.log("Vector dim:", data.data[0].embedding.length);
        }
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

testEmbedding();
