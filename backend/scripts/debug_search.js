
import { SearchEngine } from '../services/search_engine.js';
import { VectorStore } from '../services/vector_store.js';

async function debugSearch() {
    console.log("Loading Index...");
    const overloaded = VectorStore.load();
    if (!overloaded) {
        console.error("Index load failed!");
        return;
    }

    const query = "İnsan, nur-u iman ile nereye çıkar ve ne kazanır";
    console.log(`\n🔎 Testing Query: "${query}"`);

    // Correct signature: search(query, topK)
    const results = await SearchEngine.search(query, 50); // Get TOP 50 to see where it hides

    console.log(`--- Top ${results.length} Results ---`);
    results.forEach((r, i) => {
        console.log(`\n[${i + 1}] Score: ${r.score.toFixed(4)}`);
        console.log(`ID: ${r.id}`);
        console.log(`METADATA: ${JSON.stringify(r.metadata)}`);
        console.log(`Text: ${r.text.substring(0, 50)}...`);
    });
}

debugSearch();
