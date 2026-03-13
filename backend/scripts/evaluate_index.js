
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VectorStore } from '../services/vector_store.js';
import { getEmbedding } from '../services/embeddings.js';
import { SearchEngine } from '../services/search_engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QUESTIONS_FILE = path.join(__dirname, 'test_questions.json');

console.log("Loading Evaluation Set...");
const questions = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf-8'));

async function evaluate() {
    console.log("Loading Vector Index...");

    console.log("Loading Vector Index...");
    if (!VectorStore.load()) {
        console.error("Vector Index not found. Please run reindex first.");
        return;
    }

    console.log(`Starting Evaluation on ${questions.length} questions...`);

    let hits = 0;
    const results = [];

    for (const q of questions) {
        process.stdout.write(`Evaluating Q${q.id} [${q.type}]: ${q.question.substring(0, 30)}... `);

        try {
            // USE NEW SEARCH ENGINE
            // Note: search now handles embedding internally
            const retrieved = await SearchEngine.search(q.question, 5);

            // Check for Canonical Match
            // Canonical format in metadata: "Book / Section" e.g. "Sözler / 30. Söz"
            let match = false;

            if (q.expected_canonical) {
                match = retrieved.some(doc => {
                    const ref = doc.metadata.canonical || "";
                    // Normalize for comparison
                    return ref.toLowerCase().includes(q.expected_canonical.toLowerCase());
                });
            } else {
                // If no expected canonical (Concept question without specific target),
                // we consider it a subjective pass if it returned *any* relevant chunk.
                // For automated test, we just assume True if score > 0.45 (Meaningful Hit)
                match = retrieved.length > 0 && retrieved[0].score > 0.45;
            }

            if (match) {
                hits++;
                console.log("✅ HIT");
            } else {
                console.log("❌ MISS");
                if (q.expected_canonical) console.log(`   Expected: ${q.expected_canonical}`);
                console.log(`   Got Top 1: ${retrieved[0]?.metadata.canonical} (${retrieved[0]?.score.toFixed(3)})`);
            }

            results.push({
                id: q.id,
                question: q.question,
                hit: match,
                top_result: retrieved[0]?.metadata.canonical,
                top_score: retrieved[0]?.score
            });

        } catch (e) {
            console.error(`Error on Q${q.id}:`, e);
        }
    }

    const hitRate = (hits / questions.length) * 100;
    console.log("\n--- Evaluation Results ---");
    console.log(`Total Questions: ${questions.length}`);
    console.log(`Hits (@Top5): ${hits}`);
    console.log(`Hit Rate: ${hitRate.toFixed(1)}%`);

    // Save Report
    fs.writeFileSync(path.join(__dirname, '..', 'logs', 'eval_report.json'), JSON.stringify({
        hitRate,
        results
    }, null, 2));
}

evaluate();
