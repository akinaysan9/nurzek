
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const INDEX_FILE = path.join(DATA_DIR, 'vector_index.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let vectorIndex = [];
let metadataStore = {}; // Map id -> metadata + text to save memory in search? 
// actually, keeping it simple: array of { id, metadata, text, vector } is fine for 3000 items. 
// V8 handles ~10k objects easily.

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA 
 * @param {number[]} vecB 
 * @returns {number} -1 to 1
 */
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const VectorStore = {

    /**
     * Clear the index
     */
    clear: () => {
        vectorIndex = [];
    },

    /**
     * Add document to index
     * @param {object} doc { id, text, metadata, vector }
     */
    add: (doc) => {
        if (!doc.vector || !Array.isArray(doc.vector)) {
            throw new Error("Document must have a vector array");
        }
        vectorIndex.push(doc);
    },

    /**
     * Add multiple documents
     * @param {object[]} docs 
     */
    addBatch: (docs) => {
        docs.forEach(doc => VectorStore.add(doc));
    },

    /**
     * Save index to disk
     */
    save: () => {
        const data = JSON.stringify(vectorIndex); // vectors are large, file will be large (~50MB??)
        // 3200 chunks * 1536 dims * 8 bytes (approx string) ... 
        // actually 1536 floats * 4 bytes = 6KB per chunk. 
        // 3200 * 6KB = ~19MB. JSON overhead... maybe 40-50MB. Safe for Node fs.
        fs.writeFileSync(INDEX_FILE, data, 'utf-8');
        console.log(`Saved vector index to ${INDEX_FILE} (${vectorIndex.length} items)`);
    },

    /**
     * Load index from disk
     */
    load: () => {
        if (fs.existsSync(INDEX_FILE)) {
            console.log(`Loading vector index from ${INDEX_FILE}...`);
            const raw = fs.readFileSync(INDEX_FILE, 'utf-8');
            vectorIndex = JSON.parse(raw);
            console.log(`Loaded ${vectorIndex.length} items.`);
            return true;
        }
        return false;
    },

    /**
     * Search for similar documents
     * @param {number[]} queryVector 
     * @param {number} topK 
     * @param {object} filter (optional) { book: 'Sözler' } exact match on metadata
     * @returns {object[]} Array of { id, text, metadata, score }
     */
    search: (queryVector, topK = 10, filter = null) => {
        if (vectorIndex.length === 0) return [];

        // 1. Filter (if any)
        let candidates = vectorIndex;
        if (filter) {
            candidates = vectorIndex.filter(item => {
                for (const key in filter) {
                    if (item.metadata[key] !== filter[key]) return false;
                }
                return true;
            });
        }

        // 2. Score
        const scored = candidates.map(item => ({
            id: item.id,
            text: item.text,
            metadata: item.metadata,
            score: cosineSimilarity(queryVector, item.vector)
        }));

        // 3. Sort
        scored.sort((a, b) => b.score - a.score);

        // 4. Slice
        return scored.slice(0, topK);
    },

    /**
     * Get basic stats
     */
    stats: () => {
        return {
            count: vectorIndex.length,
            books: [...new Set(vectorIndex.map(i => i.metadata?.book).filter(Boolean))],
            avgLength: vectorIndex.length > 0
                ? vectorIndex.reduce((acc, i) => acc + i.text.length, 0) / vectorIndex.length
                : 0
        };
    },

    /**
     * Generate similarity histogram stats for a query vector
     * Used for "Similarity Distribution" report
     * @param {number[]} queryVector 
     */
    getSimilarityStats: (queryVector) => {
        const scores = vectorIndex.map(item => cosineSimilarity(queryVector, item.vector));

        // Calculate basic stats
        const sum = scores.reduce((a, b) => a + b, 0);
        const avg = sum / scores.length;
        const squareDiffs = scores.map(v => Math.pow(v - avg, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / scores.length;
        const stdDev = Math.sqrt(avgSquareDiff);

        // Histogram buckets (0.0 - 1.0, 0.1 steps)
        const histogram = new Array(11).fill(0); // 0.0, 0.1 ... 1.0
        scores.forEach(s => {
            // score -1 to 1. clamp to 0-1 for simplicity or handle neg?
            // embedding cosine sim usually 0-1 for text unless completely opposite
            const val = Math.max(0, s);
            const bucket = Math.floor(val * 10);
            histogram[bucket]++;
        });

        return {
            min: Math.min(...scores),
            max: Math.max(...scores),
            avg,
            stdDev,
            histogram
        };
    }
};

export default VectorStore;
