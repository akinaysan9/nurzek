import express from 'express';
import { SearchEngine } from '../services/search_engine.js';
import { getEmbedding } from '../services/embeddings.js';

const router = express.Router();

// Expanded Turkish Stopwords List for Better Relevance
const STOPWORDS = new Set([
    'bir', 've', 'ile', 'de', 'da', 'bu', 'şu', 'o', 'için', 'diye',
    'gibi', 'kadar', 'sonra', 'önce', 'ama', 'fakat', 'lakin', 'ancak',
    'ise', 'ki', 'mu', 'mı', 'mi', 'mü', 'daha', 'çok', 'en', 'var',
    'yok', 'olan', 'olarak', 'oldu', 'olduğu', 'tarafından', 'kendi',
    'bunu', 'şunu', 'onu', 'ben', 'sen', 'biz', 'siz', 'onlar', 'ne',
    'nasıl', 'neden', 'niçin', 'kim', 'hangi', 'her', 'hep', 'hiç',
    'bazı', 'bütün', 'tüm', 'veya', 'ya', 'ya da', 'hem', 'eğer',
    'yani', 'çünkü', 'zira', 'madem', 'hatta', 'belki', 'gerçi',
    'falan', 'filan', 'işte', 'böyle', 'öyle', 'şöyle', 'üzerine',
    'dedi', 'dedim', 'diyor', 'demek', 'diye', 'eder', 'etti', 'ediyor',
    'olur', 'oldu', 'olmuş', 'vardır', 'yoktur', 'aziz', 'sıddık',
    'kardeşlerim', 'evet', 'hayır', 'fakat', 'lakin', 'ancak', 'belki',
    'hatta', 'zira', 'çünkü', 'binaenaleyh', 'elhasıl', 'velhasıl',
    'netice', 'sonuç', 'göre', 'itibariyle', 'cihetiyle', 'noktasında',
    'hakkında', 'birinci', 'ikinci', 'üçüncü', 'dördüncü', 'beşinci',
    'altınca', 'yedinci', 'sekizinci', 'dokuzuncu', 'onuncu',
    'kısım', 'taraf', 'yüz', 'iki', 'üç', 'dört', 'beş', 'altı',
    'yedi', 'sekiz', 'dokuz', 'on', 'yüz', 'bin', 'milyon'
]);

function extractKeywords(text) {
    if (!text) return '';

    const words = text.toLowerCase()
        .replace(/[^\wığüşöçİĞÜŞÖÇ\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOPWORDS.has(w));

    const freq = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);

    const uniqueWords = Object.keys(freq).sort((a, b) => {
        if (freq[b] !== freq[a]) return freq[b] - freq[a];
        return b.length - a.length;
    });

    return uniqueWords.slice(0, 30).join(' ');
}

/**
 * @route   POST /api/references
 * @desc    Find cross-references for a given text snippet
 */
router.post('/', async (req, res) => {
    try {
        const { text, currentBook, currentChapter } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Metin gerekli.' });
        }

        const keywords = extractKeywords(text);

        // Debug: Log keywords
        try {
            const fs = await import('fs');
            fs.appendFileSync('debug_hit.log', `[${new Date().toISOString()}] KW: ${keywords}\n`);
        } catch (e) { }

        // Use SearchEngine
        // SearchEngine expects raw text query, but keywords is a space-separated string.
        // It generates embedding for it.
        const results = await SearchEngine.search(keywords, 30);

        // Filter and Format
        const references = results
            .filter(r => {
                if (currentBook && currentChapter) {
                    return !(r.metadata.book === currentBook && r.metadata.section === currentChapter);
                }
                return true;
            })
            .map(r => ({
                book: r.metadata.book,
                section: r.metadata.section,
                bookTitle: r.metadata.title,
                sectionTitle: r.metadata.sectionTitle,
                score: r.score,
                excerpt: r.text.substring(0, 200) + '...',
                fullText: r.text,
                ref: r.metadata.canonical || `${r.metadata.book} / ${r.metadata.section}`
            }))
            .slice(0, 15);

        res.json({
            keywords,
            references,
            count: references.length
        });

    } catch (error) {
        console.error('Reference Search Error:', error);
        res.status(500).json({ error: 'Atıf araması başarısız.' });
    }
});

export default router;
