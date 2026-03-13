import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();

// LCG (Linear Congruential Generator) for deterministic random based on seed string
function seededRandom(seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0;
    }
    let seed = Math.abs(hash);
    return function () {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

// Memory cache for today's quote so we don't parse files on every hit
let cachedQuote = null;
let cachedDate = null;

router.get('/daily', (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Return from cache if valid for today
        if (cachedQuote && cachedDate === today) {
            return res.json(cachedQuote);
        }

        const metadataPath = path.join(__dirname, '..', '..', 'knowledge-base', 'metadata.json');

        if (!fs.existsSync(metadataPath)) {
            return res.status(500).json({ error: "Metadata bulunamadı" });
        }

        const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        const chapters = meta.kulliyat || [];

        if (chapters.length === 0) {
            return res.status(500).json({ error: "Bölüm listesi boş" });
        }

        // Initialize RNG with today's date
        const rng = seededRandom(today);

        // 1. Pick a chapter deterministically
        const chapterIndex = Math.floor(rng() * chapters.length);
        const selectedChapter = chapters[chapterIndex];

        const filePath = path.join(__dirname, '..', '..', 'knowledge-base', selectedChapter.filePath);

        if (!fs.existsSync(filePath)) {
            return res.status(500).json({ error: "Bölüm dosyası bulunamadı" });
        }

        const fileContent = fs.readFileSync(filePath, 'utf-8');

        // 2. Extract paragraphs
        // Split by double newline, remove markdown frontmatter and headers
        const rawParagraphs = fileContent.split(/\n\s*\n/);

        const validParagraphs = rawParagraphs.map(p => p.trim())
            .filter(p => p.length > 80 && p.length < 350) // Kısa ve vurucu
            .filter(p => !p.startsWith('#') && !p.startsWith('---') && !p.includes(': "')); // Exclude headers/frontmatter

        if (validParagraphs.length === 0) {
            // Fallback if no valid short paragraph is found in this chapter
            cachedQuote = {
                text: "Güzel gören güzel düşünür. Güzel düşünen, hayatından lezzet alır.",
                source: "Mektubat - Hakikat Çekirdekleri",
                book: "Mektubat",
                section: "Hakikat Çekirdekleri"
            };
        } else {
            // 3. Pick a paragraph deterministically
            const paragraphIndex = Math.floor(rng() * validParagraphs.length);
            const selectedText = validParagraphs[paragraphIndex]
                // Temizleme: olası markdown bold/italic işaretlerini kaldır
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/_ /g, '')
                .replace(/\n/g, ' ');

            cachedQuote = {
                text: selectedText,
                source: `${selectedChapter.book} - ${selectedChapter.section}`,
                book: selectedChapter.book,
                section: selectedChapter.section
            };
        }

        cachedDate = today;
        return res.json(cachedQuote);

    } catch (err) {
        console.error("Daily Quote Error:", err);
        res.status(500).json({ error: "Bir hata oluştu" });
    }
});

export default router;
