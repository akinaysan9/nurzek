
import { VectorStore } from '../services/vector_store.js';
import { getEmbedding } from '../services/embeddings.js';

console.log("Analyzing Vector Index...");
if (VectorStore.load()) {
    const stats = VectorStore.stats();
    console.log("Basic Stats:", stats);

    // Test Distribution
    const testQuery = "Ene ve Zerre";
    console.log(`Getting embedding for query: "${testQuery}"...`);

    getEmbedding(testQuery).then(vec => {
        const simStats = VectorStore.getSimilarityStats(vec);
        console.log("Similarity Distribution for 'Ene ve Zerre':");
        console.log("Min:", simStats.min);
        console.log("Max:", simStats.max);
        console.log("Avg:", simStats.avg);
        console.log("StdDev:", simStats.stdDev);
        console.log("Histogram (0.0 - 1.0):", simStats.histogram);
    }).catch(err => console.error("Embedding failed:", err));

} else {
    console.error("No index found to analyze.");
}
