
import { VectorStore } from './vector_store.js';
import { getEmbedding } from './embeddings.js';

/**
 * Risale-i Nur Specialized Search Engine
 * Implements "Dual Retrieval" strategy:
 * 1. Canonical Reference Detection (Rule-Based)
 * 2. Semantic Vector Search (Embedding-Based)
 */

// Regex for detecting canonical references
// Matches: "10. Söz", "22. Mektup", "3. Lem'a", "3. Lema" "5. Şua" etc.
// Handles apostrophes and plurals loosely
const CANONICAL_REGEX = /(\d+)\.?\s*(Söz|Mektup|Lem'?a|Şua|Mesnevi)/i;

const BOOK_MAP = {
    'Söz': 'Sözler',
    'Mektup': 'Mektubat',
    "Lem'a": "Lem'alar",
    "Lema": "Lem'alar",
    'Şua': 'Şualar',
    'Mesnevi': 'Mesnevi-i Nuriye'
};

export class SearchEngine {

    static classifyQuery(query) {
        const match = query.match(CANONICAL_REGEX);
        if (match) {
            const number = match[1];
            const type = match[2];
            // Normalize book name
            let book = BOOK_MAP[Object.keys(BOOK_MAP).find(k => type.toLowerCase().includes(k.toLowerCase()))];

            // Construct canonical string format used in metadata: "Sözler / 10. Söz"
            // Note: Our metadata format might vary slightly, need to be fuzzy or consistent.
            // Adjusting based on standard naming trends.
            return {
                type: 'specific',
                book: book,
                section_number: number,
                raw_ref: `${number}. ${type}`
            };
        }
        return { type: 'concept' };
    }

    /**
     * Main Search Function
     * @param {string} query User query
     * @param {number} limit Max chunks
     */
    static async search(query, limit = 15) {
        // 1. Generate Embedding
        const vector = await getEmbedding(query);

        // 2. Classify
        const intent = this.classifyQuery(query);
        console.log(`Query Intent: ${JSON.stringify(intent)}`);

        let results = [];

        // 3. Strategy Execution
        if (intent.type === 'specific') {
            // STRATEGY A: Focused Retrieval (Canonical + Vector)

            // 3.1. Filter for specific section
            // We search significantly deeper (top 100) then filter
            const deepResults = VectorStore.search(vector, 200);

            const specificHits = deepResults.filter(item => {
                const meta = item.metadata;
                if (!meta.canonical) return false;
                // Loose match: "10. Söz" in metadata vs "10. Söz" in query
                return meta.canonical.includes(intent.raw_ref);
            });

            // 3.2. Also get top global hits (Context Expansion)
            const globalHits = VectorStore.search(vector, 10); // Standard top 10

            // 3.3. Merge & Boost
            // 3.3. Merge & Boost
            // Give specific hits a massive artificial boost to ensure they appear first
            const boostedSpecific = specificHits.map(h => ({ ...h, score: h.score + 0.3 })); // Strong Boost

            results = [...boostedSpecific, ...globalHits];

        } else {
            // STRATEGY B: Pure Concept Search with Keyword Boosting

            // 1. Get initial candidates (wider pool)
            let rawResults = VectorStore.search(vector, limit * 3);

            // 2. Keyword Boosting Logic
            // Split query into significant terms (3+ chars)
            const terms = query.toLowerCase().split(/\W+/).filter(t => t.length > 3);

            results = rawResults.map(item => {
                let boost = 0;
                const textLower = item.text.toLowerCase();

                // Boost for each matching term
                terms.forEach(term => {
                    if (textLower.includes(term)) {
                        boost += 0.05; // 5% boost per word
                    }
                });

                // Boost for exact phrase match (big bonus)
                if (textLower.includes(query.toLowerCase())) {
                    boost += 0.2;
                }

                return { ...item, score: item.score + boost };
            });

            // 3. Re-sort after boosting
            results.sort((a, b) => b.score - a.score);

            // 4. Cut to limit
            results = results.slice(0, limit);
        }

        // 4. Deduplicate & Re-Sort (Final Check)
        const seen = new Set();
        const final = [];

        for (const item of results) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            final.push(item);
        }

        return final.filter(item => item.score > 0.25);
    }
}
