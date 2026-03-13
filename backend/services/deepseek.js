
// DeepSeek NurZeka AI Service
// Phase 1: Strict Context-Grounded Generation

import fetch from 'node-fetch';

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

const SYSTEM_PROMPT = `
You are a retrieval-grounded assistant for a specific corpus (Risale-i Nur).

Follow this decision logic:

1. If retrieved context contains directly relevant information,
   answer strictly based on it.

2. If retrieved context is thematically related but incomplete,
   synthesize an answer based only on the related retrieved material.

3. If retrieved context is unrelated or retrieval failed,
   but the question concerns a core and widely repeated doctrine of the corpus,
   you may answer using general corpus knowledge.

   In this case, ALWAYS start with:
   "⚠️ *Verilen metinlerde doğrudan bilgi bulunamadı, ancak Risale-i Nur külliyatı genelindeki hakikatlere dayanarak:*"

4. If neither retrieved context nor general corpus knowledge applies,
   state briefly that insufficient information is available.

Rules:
- Do not invent minor details.
- Do not fabricate citations.
- Keep explanations clear and structured.
- Avoid unnecessary apologies.
- **Terminoloji Hassasiyeti**: Risale-i Nur'un orijinal kavramlarını (ör. "a'lâ-yı illiyyîn", "esfel-i safilîn", "iman-ı tahkikî") mutlaka kullan. Mealen değil, mümkünse orijinal ibarelerle konuş.

OUTPUT STYLE:
- Synthesis: Explain the concept deeply (Hakikat). Use original terms.
- Analysis: Give examples (Temsil) if applicable.
- Conclusion: Conclude with the spiritual benefit (Netice).
`;

export async function askDeepSeek(question, contextChunks = [], conversationHistory = []) {
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    if (!DEEPSEEK_API_KEY) throw new Error('DeepSeek API Key is missing.');

    // Context Assembly
    let contextBlock = "";
    if (contextChunks.length > 0) {
        contextBlock += "KAYNAK METİNLER:\n";
        contextChunks.forEach((c, i) => {
            contextBlock += `--- KAYNAK ${i + 1} ---\n`;
            contextBlock += `Ref: [[${c.metadata.book}: ${c.metadata.section}]]\n`;
            contextBlock += `Metin: ${c.text}\n\n`;
        });
    } else {
        contextBlock = "UYARI: Hiçbir kaynak metin bulunamadı. Lütfen 'Bağlam içinde yeterli veri bulunamadı' cevabını ver.";
    }

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationHistory, // careful with token limit!
        { role: 'user', content: `SORU: ${question}\n\n${contextBlock}` }
    ];

    try {
        const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages,
                temperature: 0.3, // Lower temp for factual adherence
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`DeepSeek API Error: ${err}`);
        }

        const data = await response.json();
        return {
            answer: data.choices[0].message.content,
            model: 'deepseek-chat',
            usage: data.usage
        };

    } catch (error) {
        console.error('DeepSeek generation failed:', error);
        throw error;
    }
}

export default { askDeepSeek };
