import { buildIndex, search } from './services/search_engine.js';

console.log("🚀 Testing Local Search Engine V3 (Concept-Aware)...");

// 1. Build Index
const count = buildIndex();
console.log(`📊 Index Count: ${count}`);

// 2. Test Fetching Metadata (Slugs)
const imanResults = search('iman', 1);
if (imanResults.length > 0) {
    const meta = imanResults[0].metadata;
    console.log(`✅ Metadata Verification:`);
    console.log(`   Book Slug: ${meta.book}`);
    console.log(`   Section Slug: ${meta.section}`);
    console.log(`   Title: ${meta.title}`);
    console.log(`   Section Title: ${meta.sectionTitle}`);
}

// 3. Test Bigram Support
const bigramQuery = 'iman-ı tahkiki';
console.log(`🔎 Searching for concept: "${bigramQuery}"`);
const conceptResults = search(bigramQuery, 3);

console.log("✅ Results:");
conceptResults.forEach((r, i) => {
    console.log(`${i + 1}. [${r.metadata.title} / ${r.metadata.sectionTitle}] (Score: ${r.score.toFixed(2)})`);
    console.log(`   Slug Link: /knowledge/kulliyat/${r.metadata.book}/${r.metadata.section}`);
});
