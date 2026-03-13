
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
console.log(`Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Error loading .env:", result.error);
}

console.log(`DEEPSEEK_API_KEY loaded: ${process.env.DEEPSEEK_API_KEY ? 'Yes' : 'No'}`);

if (!process.env.DEEPSEEK_API_KEY) {
    console.error("CRITICAL: API Key not found in environment variables.");
    process.exit(1);
}

// Dynamic import AFTER env is loaded
console.log("Importing RAG service...");
const { buildIndex } = await import('../services/rag.js');

console.log("Starting Re-Indexer...");

buildIndex().then(stats => {
    console.log("Re-indexing finished successfully.");
    process.exit(0);
}).catch(err => {
    console.error("Re-indexing failed:", err);
    process.exit(1);
});
