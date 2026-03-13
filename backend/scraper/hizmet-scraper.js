
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KB_DIR = path.join(__dirname, '..', '..', 'knowledge-base');

const BASE_URL = 'https://risaleinur.hizmetvakfi.org';
const DELAY_MS = 1000;

// Book List (Manual Mapping to be safe)
const BOOKS = [
    { name: 'Sözler', slug: 'sozler' },
    { name: 'Mektubat', slug: 'mektubat' },
    { name: 'Lem\'alar', slug: 'lemalar' },
    { name: 'Şualar', slug: 'sualar' },
    { name: 'Barla Lâhikası', slug: 'barla-lahikasi' },
    { name: 'Kastamonu Lâhikası', slug: 'kastamonu-lahikasi' },
    { name: 'Emirdağ Lâhikası', slug: 'emirdag-lahikasi' },
    { name: 'Tarihçe-i Hayat', slug: 'tarihce-i-hayat' },
    { name: 'İşaratü\'l-İ\'caz', slug: 'isaratul-icaz' },
    { name: 'Mesnevi-i Nuriye', slug: 'mesnevi-i-nuriye' },
    { name: 'Sikke-i Tasdik-i Gaybi', slug: 'sikke-i-tasdik-i-gaybi' },
    { name: 'Asa-yı Musa', slug: 'asa-yi-musa' },
    { name: 'Muhakemat', slug: 'muhakemat' },
    { name: 'Münâzarat', slug: 'munazarat' }, // Might be under different slug
    { name: 'Hutbe-i Şâmiye', slug: 'hutbe-i-samiye' }
];

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
    try {
        console.log(`  📥 Fetching: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NurZeka-Scraper/1.0'
            },
            timeout: 30000
        });

        if (!response.ok) {
            console.warn(`  ⚠️ HTTP ${response.status}: ${url}`);
            return null;
        }
        return await response.text();
    } catch (error) {
        console.error(`  ❌ Error: ${error.message} - ${url}`);
        return null;
    }
}

function cleanText(text) {
    return text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Extract Chapters from Book Index Page
async function getBookChapters(bookSlug) {
    const url = `${BASE_URL}/kulliyat/${bookSlug}`;
    const html = await fetchPage(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const links = [];
    const seen = new Set();

    // Look for links in the main content area
    // Helper to add link
    const addLink = (text, href) => {
        if (!href || href.includes('#') || href.includes('javascript')) return;
        if (!href.startsWith('http')) href = `${BASE_URL}${href}`;
        // Verify it belongs to this book
        if (!href.includes(`/${bookSlug}/`)) return;

        // Clean text
        text = text.replace(/\s+/g, ' ').trim();
        if (text.length < 3) return;
        if (text.includes('Sonraki') || text.includes('Önceki')) return;

        if (!seen.has(href)) {
            seen.add(href);
            links.push({ title: text, url: href, slug: href.split('/').filter(Boolean).pop() });
        }
    };

    $('.entry-content a, #content a, .post-content a').each((i, el) => {
        addLink($(el).text(), $(el).attr('href'));
    });

    // Sort or filter if needed? 
    // Usually they are in order.
    return links;
}

// Extract Content from Chapter Page
async function scrapeChapter(url) {
    const html = await fetchPage(url);
    if (!html) return null;

    const $ = cheerio.load(html);

    // Select Content
    const contentEl = $('.entry-content, .post-content, #content, article').first();
    if (!contentEl.length) return null;

    // 1. Extract Title
    const title = $('h1').first().text().trim() || $('title').text().split('-')[0].trim();

    // 2. Extract Footnotes (Haşiye)
    // Hizmet Vakfı might use tooltips or bottom section
    let footnotes = [];

    // Strategy: Look for superscript links or specific classes
    // Assumption: they might be in separate divs or tooltips.
    // Let's look for "dipnot" or "hasiye" or "footnote" classes

    // If they are separate content at bottom:
    $('.footnote, .dipnot, .hasiye').each((i, el) => {
        // preserve content
    });

    // Cleanup
    const removeSelectors = [
        'script', 'style', 'nav', '.sidebar', '.footer', '.header',
        '.navigation', '.breadcrumbs', '.share', '.comments',
        '.related-posts', '.post-meta', '.reply'
    ];
    $(removeSelectors.join(', ')).remove();

    // Format Text
    // Replace <br> with newlines
    contentEl.find('br').replaceWith('\n');

    // Handle Paragraphs
    contentEl.find('p, div').each((i, el) => {
        const t = $(el).text().trim();
        if (t.length > 0) {
            $(el).replaceWith(`\n\n${$(el).html()}\n\n`);
        }
    });

    let rawText = contentEl.text();
    let cleanedText = cleanText(rawText);

    return {
        title,
        content: cleanedText,
        footnotes: footnotes // TODO: Refine this based on actual structure
    };
}

async function main() {
    const args = process.argv.slice(2);
    const testMode = args.includes('--test');

    console.log('--- Hizmet Vakfı Scraper Started ---');
    ensureDir(path.join(KB_DIR, 'kulliyat'));

    const targetBooks = testMode ? [BOOKS[0], BOOKS[12]] : BOOKS; // Sözler & Muhakemat for test

    for (const book of targetBooks) {
        console.log(`\n📚 Processing Book: ${book.name}`);
        const bookDir = path.join(KB_DIR, 'kulliyat', book.slug);
        ensureDir(bookDir);

        // 1. Get Chapters
        let chapters = await getBookChapters(book.slug);
        console.log(`   Found ${chapters.length} chapters.`);

        if (chapters.length === 0) {
            console.warn(`   ⚠️ No chapters found for ${book.name} via listing. Trying direct guess?`);
            // Check if user provided direct link logic is needed
            continue;
        }

        // Limit for test
        const limit = testMode ? 3 : 1000;

        for (let i = 0; i < Math.min(chapters.length, limit); i++) {
            const chapter = chapters[i];
            const fileSlug = String(i + 1).padStart(3, '0') + '-' + chapter.slug;
            const filePath = path.join(bookDir, `${fileSlug}.md`);

            // Skip if exists (unless forced? na, incremental is good)
            if (fs.existsSync(filePath) && !testMode) {
                console.log(`   ⏭️ Skipping: ${chapter.title}`);
                continue;
            }

            console.log(`   ⬇️ Scraping: ${chapter.url}`);

            await delay(DELAY_MS);
            const data = await scrapeChapter(chapter.url);

            if (data && data.content.length > 100) {
                const md = `---
kitap: "${book.name}"
bölüm: "${data.title}"
url: "${chapter.url}"
tarih: ${new Date().toISOString()}
---

# ${data.title}

${data.content}
`;
                fs.writeFileSync(filePath, md, 'utf-8');
                console.log(`   ✅ Saved: ${fileSlug}.md (${data.content.length} chars)`);
            } else {
                console.warn(`   ⚠️ Failed/Empty: ${chapter.url}`);
            }
        }
    }
}

main();
