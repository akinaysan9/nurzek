// NurZek - Premium Dictionary & Analysis Logic
const API_BASE = '/api';

export async function analyzeConcept(text, context = '') {
    const resultDiv = document.getElementById('concept-result');
    const panel = document.getElementById('analysis-panel');

    panel.classList.add('open');
    document.querySelector('[data-tab="concepts"]').click();

    resultDiv.innerHTML = `
        <div class="analysis-loading" style="text-align:center; padding:40px;">
            <div class="loader"></div>
            <p style="color:#d4a373; font-weight:700; margin-top:15px; font-size:15px;">Hakikatler derleniyor...</p>
            <p style="color:#999; font-size:12px; margin-top:5px;">Yapay zeka derin tahlil gerçekleştiriyor.</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/analyze/concept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, context })
        });

        const data = await response.json();
        const markdown = data.result || "Analiz sonucu alınamadı.";

        if (!response.ok) throw new Error('Servis hatası');

        resultDiv.innerHTML = `<div class="risale-text" style="font-size:18px;">${window.app.renderMarkdown(markdown)}</div>`;
        const panelBody = document.querySelector('.panel-body');
        panelBody.scrollTop = panelBody.scrollHeight;

    } catch (e) {
        console.error('Analiz hatası:', e);
        resultDiv.innerHTML = `
            <div class="error-state" style="text-align:center; padding:20px;">
                <i class="fas fa-exclamation-circle" style="color:#e74c3c; font-size:30px;"></i>
                <p style="margin-top:10px;">Analiz servisine ulaşılamadı. Lütfen internetinizi veya sunucuyu kontrol edin.</p>
            </div>
        `;
    }
}

export function initTooltips() {
    console.log('Lügat sistemi v3 hazır.');
}

window.analyzeConcept = analyzeConcept;
window.initTooltips = initTooltips;
