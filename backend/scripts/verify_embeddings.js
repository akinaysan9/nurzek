
import { getEmbedding } from '../services/embeddings.js';

async function verify() {
    console.log("Verifying Embedding Model...");

    // 1. Generate Vector
    const text = "Risale-i Nur Külliyatı";
    const vec = await getEmbedding(text);

    console.log(`Vector Generated. Length: ${vec.length}`);

    // 2. Check Dimension
    if (vec.length !== 384) {
        console.error("FAIL: Dimension is not 384.");
        process.exit(1);
    }

    // 3. Check Normalization (L2 Norm)
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    console.log(`L2 Norm: ${norm.toFixed(4)}`);

    if (Math.abs(norm - 1.0) > 0.01) {
        console.error("FAIL: Vector is not normalized.");
        process.exit(1);
    }

    console.log("SUCCESS: Embeddings are correct (384-dim, Normalized).");
}

verify();
