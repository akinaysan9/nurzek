import { buildIndex, search } from './services/search_engine.js';

console.log("🚀 Testing Local Search Engine...");

// 1. Build Index
const count = buildIndex();
console.log(`📊 Index Count: ${count}`);

// 2. Search
const query = 'iman ve küfür';
console.log(`🔎 Searching for: "${query}"`);
const results = search(query, 3);

console.log("✅ Results:");
results.forEach((r, i) => {
    console.log(`${i + 1}. [${r.metadata.book} / ${r.metadata.section}] (Score: ${r.score.toFixed(2)})`);
    console.log(`   Excerpt: ${r.text.substring(0, 50)}...`);
});
