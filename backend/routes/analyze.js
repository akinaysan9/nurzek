import express from 'express';
import { getAIResponseStream } from '../services/rag.js';

const router = express.Router();

/**
 * @route   POST /api/analyze/concept
 * @desc    Deep AI analysis of a concept/word from Risale-i Nur (Streaming)
 */
router.post('/concept', async (req, res) => {
    const { text, context } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Analyz edilecek metin bulunamadı.' });
    }

    const prompt = `
Aşağıdaki kavram veya ifadeyi Risale-i Nur perspektifinden derinlemesine analiz et. 
Lütfen şu başlıklar altında yapılandırılmış bir yanıt ver (Markdown formatında):

1. **Lügat Manası**: Kelimenin sözlükteki temel anlamı.
2. **Etimoloji ve Dil Bilgisi**: Kelimenin kökeni (Arapça/Farsça/Osmanlıca), kök anlamı ve dil bilgisi yapısı.
3. **Risale-i Nur'daki Istılahî Derinliği**: Bu kavram Risale-i Nur'da nasıl bir anlam derinliği kazanır? Bediüzzaman bu kavramı hangi hakikatleri açıklamak için kullanır?
4. **Bağlamsal Analiz**: (Eğer bağlam verilmişse) Bu ifade şu an geçtiği metinde neye işaret ediyor?
5. **İlgili Atıflar**: Bu kavramın yoğun işlendiği diğer Risale-i Nur bölümlerine kısa atıflar.

Analiz edilecek kavram: "${text}"
${context ? `Bağlam (Bulunduğu paragraf): "${context}"` : ''}

Lütfen çok derinlikli, ilmi ve Risale-i Nur terminolojisine sadık bir dil kullan.
`;

    try {
        console.log(`🔍 Concept Analysis Request (Streaming): "${text}"`);

        // Set up node-fetch
        const fetch = (await import('node-fetch')).default;

        const aiResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                stream: false
            })
        });

        if (!aiResponse.ok) {
            throw new Error(`DeepSeek API Error: ${aiResponse.statusText}`);
        }

        const data = await aiResponse.json();

        if (data.choices && data.choices.length > 0) {
            res.json({ result: data.choices[0].message.content });
        } else {
            res.status(500).json({ error: 'AI boş yanıt döndürdü.', details: data });
        }

    } catch (error) {
        console.error('AI Analysis Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Analiz sırasında bir hata oluştu.' });
        }
    }
});

/**
 * @route   POST /api/analyze/simplify
 * @desc    Stream faithful simplification of Risale-i Nur text
 */
router.post('/simplify', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Metin gerekli.' });
    }

    const prompt = `
Sen Risale-i Nur'un manasını ve derinliğini muhafaza ederek günümüz Türkçesine aktaran uzman bir dilbilimci ve ilim talibisin.
Aşağıdaki metni günümüz Türkçesine çevir, ancak şu KRİTİK KURALLARA HARFİYEN UY:

1. 🛡️ **KORUNACAKLAR (Asla Çevirme):**
   - Allah'ın İsimleri (Esma-i Hüsna) (Örn: Rahim, Hakim, Kadi, Cebbar...)
   - Allah'ın Sıfatları ve Şe'nleri (Örn: İlim, İrade, Kudret, Rububiyet, Uluhiyet...)
   - Temel İmani ve Kur'ani Terimler (Örn: Haşir, Ahiret, Nübüvvet, Ubudiyet, İhlas, Uhuvvet...)
   - Ayet ve Hadis lafızları.
   *Bu kelimeleri OLDUĞU GİBİ bırak. Asla "Güç, Tanrılık, Peygamberlik" gibi sığ kelimelerle değiştirme.*

2. 🔄 **SADELEŞTİRİLECEKLER:**
   - Eski Türkçe bağlaçlar ve edatlar (mamafih -> bununla birlikte, binaenaleyh -> bundan dolayı, keza -> aynı şekilde).
   - Günlük dilde hiç kullanılmayan ve anlaşılması çok zor olan Osmanlıca tamlamalar.
   - Çok uzun ve karmaşık cümle yapıları (Cümleleri bölerek daha anlaşılır hale getir).

3. ⚖️ **ÜSLUP VE TON:**
   - Asla yorum, şahsi fikir veya parantez içi açıklama ekleme. Sadece tercüme et.
   - Metnin akıcılığını sağla ama "basitleştirme" adına manayı sığlaştırma.
   - Orijinal metindeki o vakur, ciddi ve ilmi havayı koru.

Orijinal Metin:
"${text}"

Sadece sadeleştirilmiş metni ver. Giriş cümlesi ("İşte sadeleştirilmiş metin:") yazma.
`;

    try {
        console.log(`🔄 Simplification Request (Streaming)`);

        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        await getAIResponseStream(
            prompt,
            (token) => {
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
            },
            () => {
                res.write('data: [DONE]\n\n');
                res.end();
            },
            (err) => {
                console.error('Stream Error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Sadeleştirme hatası: ' + err });
                } else {
                    res.end();
                }
            }
        );

    } catch (error) {
        console.error('Simplification Error:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Sadeleştirme hatası: ' + error.message });
    }
});

/**
 * @route   POST /api/analyze/definition
 * @desc    Get a concise, context-aware definition/meaning
 */
console.log('  ✅ Analyze/Definition Route Registered');
router.post('/definition', async (req, res) => {
    const { text, context } = req.body;

    if (!text) return res.status(400).json({ error: 'Kelime gerekli.' });

    const prompt = `
Aşağıdaki kelimeyi/ifadeyi Risale-i Nur'un manevi iklimine uygun, tefekkür derinliğini koruyan fakat GÜNÜMÜZ TÜRKÇESİYLE anlaşılır bir şekilde kısaca açıkla.
Kesinlikle ansiklopedik veya kuru bir sözlük tanımı olmasın.
Maksimum 1-2 cümle olsun.

Kelime: "${text}"
${context ? `Bağlam: "${context}"` : ''}

Cevabı sadece tanım olarak ver, başlık veya giriş cümlesi kullanma.
`;

    try {
        console.log(`📖 Definition Request: "${text}"`);

        // We use non-streaming here for simplicity as it's short, but queryNurZeka is stream-based callback.
        let fullResponse = '';

        await getAIResponseStream(
            prompt,
            (token) => { fullResponse += token; },
            () => { res.json({ definition: fullResponse.trim() }); },
            (err) => {
                console.error('Stream Error:', err);
                // Usually err is a string message from rag.js
                res.status(500).json({ error: 'Tanım alınamadı: ' + err });
            }
        );

    } catch (error) {
        console.error('Definition Error:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

export default router;
