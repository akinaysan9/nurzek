import { Router } from 'express';
import { SearchEngine } from '../services/search_engine.js';

const router = Router();

// Risale-i Nur Book Order for grouping/sorting
const BOOK_ORDER = [
    'Sözler',
    'Mektubat',
    "Lem'alar",
    'Şualar',
    'Tarihçe-i Hayat',
    'Mesnevi-i Nuriye',
    "İşaratü'l-İ'caz",
    'Sikke-i Tasdik-i Gaybî',
    'Barla Lâhikası',
    'Kastamonu Lâhikası',
    'Emirdağ Lâhikası I',
    'Emirdağ Lâhikası II',
    'Asâ-yı Musa',
    'Muhakemat',
    'Hutbe-i Şâmiye',
    'Münâzarat'
];

function getBookSortOrder(bookName) {
    if (!bookName) return 999;
    const index = BOOK_ORDER.findIndex(b => bookName.includes(b) || b.includes(bookName));
    return index !== -1 ? index : 999;
}

router.get('/', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }

        // Search using the local vector/keyword search engine (no LLM)
        let results = await SearchEngine.search(query, 20); // Get top 20 hits

        // Map results if needed to expose only required fields
        results = results.map(item => ({
            id: item.id,
            text: item.text,
            score: item.score,
            book: item.metadata?.book || '',
            section: item.metadata?.section || '',
            canonical: item.metadata?.canonical || ''
        }));

        // Sort by book order then by score if in same book
        results.sort((a, b) => {
            const orderA = getBookSortOrder(a.book);
            const orderB = getBookSortOrder(b.book);

            if (orderA !== orderB) {
                return orderA - orderB;
            }
            // If same book, sort by score descending
            return b.score - a.score;
        });

        res.json({
            query: query,
            count: results.length,
            results: results
        });

    } catch (err) {
        console.error('Concept Search error:', err);
        res.status(500).json({ error: 'Arama sırasında bir hata oluştu.' });
    }
});

// A simple approach to build a "Concept Map" without LLM
// 1. Search the text for the root concept
// 2. Extract frequent long words from the matching chunks
// 3. Return as nodes and edges for vis.js
router.get('/map', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Query parameter required' });

        // Get limited results for speed
        const results = await SearchEngine.search(query, 15);

        const stopWords = new Set(['bir', 've', 'ile', 'için', 'bu', 'da', 'de', 'gibi', 'olarak', 'olan', 'ki', 'ise', 'çok', 'daha', 'en', 'kadar', 'sonra', 'önce', 'göre', 'kendi', 'hem', 'ya', 'veya', 'yahut', 'ama', 'fakat', 'lakin', 'ancak', 'yani']);

        const wordCounts = {};

        results.forEach(item => {
            if (!item.text) return;
            // Tokenize and clean
            const words = item.text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()""''\n]/g, " ").split(/\s+/);
            words.forEach(w => {
                if (w.length > 3 && !stopWords.has(w) && w !== query.toLowerCase() && !w.includes(query.toLowerCase()) && !query.toLowerCase().includes(w)) {
                    wordCounts[w] = (wordCounts[w] || 0) + 1;
                }
            });
        });

        // Get top 8 related concepts
        const topConcepts = Object.entries(wordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(entry => entry[0]);

        // Build Graph Data
        const nodes = [
            { id: 1, label: query.toUpperCase(), color: '#D4AF37', shape: 'ellipse', font: { size: 20 } } // Root node
        ];
        const edges = [];

        topConcepts.forEach((concept, index) => {
            const nodeId = index + 2;
            nodes.push({ id: nodeId, label: concept, color: '#f0f0f0', shape: 'box' });
            edges.push({ from: 1, to: nodeId });
        });

        res.json({ nodes, edges });

    } catch (err) {
        console.error('Map Generation error:', err);
        res.status(500).json({ error: 'Harita oluşturulurken bir hata oluştu.' });
    }
});

export default router;
