// routes/dict.js
// GET /api/dict/meaning/:word
// Hover tooltip için RAG destekli Osmanlıca/Arapça kavram açıklama endpoint'i
//
// Akış:
//   1. In-memory cache kontrol et
//   2. SearchEngine.search(term) → Külliyattan en iyi 3 chunk
//   3. DeepSeek → Risale bağlamında 1-2 cümle kısa tanım
//   4. Cevabı cache'le, döndür

import { Router } from 'express';
import { SearchEngine } from '../services/search_engine.js';
import fetch from 'node-fetch';

const router = Router();

// ── In-memory cache (sunucu yeniden başlayana kadar saklar) ────────────────
const meaningCache = new Map();

// ── DeepSeek config ─────────────────────────────────────────────────────────
const DS_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com') + '/v1/chat/completions';
const DS_MODEL = 'deepseek-chat';

const SYSTEM_PROMPT = `Sen Risale-i Nur külliyatı uzmanısın.
Sana bir kavram ve bu kavramın geçtiği Risale metinleri verilecek.
Verilen metne dayanarak o kavramın Risale-i Nur'daki ÖZEL ANLAMINI yaz.
- Maksimum 2 cümle, Türkçe.
- Genel sözlük tanımı değil, Risale bağlamındaki derin anlam.
- Eğer metinde yeterli bilgi yoksa genel İslami bağlamı kullanabilirsin.
- Sadece tanımı yaz, "Bu kavram..." gibi giriş cümlesi ekleme.`;

async function getRisaleMeaning(term) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY eksik');

    // 1. Külliyatta ara
    let chunks = [];
    try {
        const results = await SearchEngine.search(term, 3);
        chunks = results.slice(0, 3);
    } catch (e) {
        console.warn(`SearchEngine hatası (${term}):`, e.message);
    }

    // 2. Bağlam bloğu oluştur
    let contextBlock = '';
    if (chunks.length > 0) {
        contextBlock = chunks.map((c, i) =>
            `[${i + 1}] ${c.metadata?.book || ''} - ${c.metadata?.section || ''}\n${(c.text || '').slice(0, 400)}`
        ).join('\n\n');
    } else {
        contextBlock = 'Metinde doğrudan geçmiyor — genel İslami/Osmanlıca bağlamı kullan.';
    }

    // 3. DeepSeek'e sor
    const resp = await fetch(DS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: DS_MODEL,
            temperature: 0.2,
            max_tokens: 120,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Kavram: "${term}"\n\nRisale metinleri:\n${contextBlock}` }
            ]
        })
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`DeepSeek API hatası: ${err}`);
    }

    const data = await resp.json();
    return data.choices[0].message.content.trim();
}

// ── GET /api/dict/meaning/:word ──────────────────────────────────────────────
router.get('/:word', async (req, res) => {
    const term = decodeURIComponent(req.params.word).trim();
    if (!term || term.length < 2) {
        return res.status(400).json({ error: 'Geçersiz kelime' });
    }

    const cacheKey = term.toLowerCase();

    // Cache hit
    if (meaningCache.has(cacheKey)) {
        return res.json({ term, meaning: meaningCache.get(cacheKey), cached: true });
    }

    try {
        const meaning = await getRisaleMeaning(term);
        meaningCache.set(cacheKey, meaning);
        res.json({ term, meaning, cached: false });
    } catch (err) {
        console.error(`Dict meaning error (${term}):`, err.message);
        res.status(500).json({ error: 'Anlam bulunamadı: ' + err.message });
    }
});

// Cache istatistiği (debug)
router.get('/_cache/stats', (req, res) => {
    res.json({ size: meaningCache.size, keys: [...meaningCache.keys()].slice(0, 20) });
});

export default router;
