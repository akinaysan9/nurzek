// NurZek - Premium Reference Logic
const API_BASE = '/api';

export async function analyzeReferences(text, force = false) {
    const list = document.getElementById('references-list');
    const book = window.app.currentBook;
    const chapter = window.app.currentChapter;

    if (!text || !book || !chapter) return;

    list.innerHTML = `
        <div class="analysis-loading" style="text-align:center; padding:30px;">
            <div class="loader"></div>
            <p style="color:#999; font-size:13px; margin-top:10px;">En derin sırlar taranıyor...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/analyze/references`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                book_slug: book,
                chapter_slug: chapter,
                force
            })
        });

        const data = await response.json();

        if (data.references && data.references.length > 0) {
            list.innerHTML = data.references.map(ref => {
                // Robust score calculation (fixes %NaN)
                const scoreValue = parseFloat(ref.score);
                const score = isNaN(scoreValue) ? 0 : Math.round(scoreValue * 100);

                return `
                <div class="reference-item" onclick="window.app.loadChapter('${ref.book_slug}', '${ref.chapter_slug || ref.chapter}')">
                    <div class="ref-meta">
                        <span class="ref-book">${ref.book || ref.book_slug.toUpperCase()}</span>
                        <span class="ref-score">%${score} Alaka</span>
                    </div>
                    <p class="ref-excerpt">${ref.excerpt || 'Bu bölüm alakasız/boş olabilir.'}</p>
                    <div class="ref-footer">
                        <small>Kaynak: ${ref.chapter_slug || ref.chapter}</small>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `}).join('');
        } else {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search-minus" style="font-size:30px; color:#ddd; margin-bottom:15px;"></i>
                    <p>Tam eşleşen bir atıf bulunamadı.</p>
                </div>
            `;
        }

    } catch (e) {
        console.error('Atıf analizi hatası:', e);
        list.innerHTML = '<div class="error-state"><p>Bağlantı hatası.</p></div>';
    }
}

window.analyzeReferences = analyzeReferences;
