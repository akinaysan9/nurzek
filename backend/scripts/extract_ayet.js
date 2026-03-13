import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio'; // ES modules import

// Configuration
const HTML_FILE_PATH = "C:\\Users\\AkınAysan\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\ayet_temp.html";
const OUTPUT_FILE_PATH = "C:\\Users\\AkınAysan\\Desktop\\risale-nur-ai\\knowledge-base\\kulliyat\\asa-yi-musa\\012-birinci-huccet-i-imaniye-yedinci-sua-ayetul-kubra.md";

// Read HTML
console.log(`Reading HTML from ${HTML_FILE_PATH}...`);
const html = fs.readFileSync(HTML_FILE_PATH, 'utf8');
const $ = cheerio.load(html);

// Select Content
const contentDiv = $('.entry-content');
if (!contentDiv.length) {
    console.error("Could not find .entry-content div!");
    process.exit(1);
}

// Helper to process nodes recursively
function processNode(node) {
    if (node.type === 'text') {
        return node.data;
    }
    if (node.type === 'tag') {
        const tagName = node.name;
        const children = node.children.map(processNode).join('');

        switch (tagName) {
            case 'h1': return `\n# ${children}\n\n`;
            case 'h2': return `\n## ${children}\n\n`;
            case 'h3': return `\n### ${children}\n\n`;
            case 'h4': return `\n#### ${children}\n\n`;
            case 'h5': return `\n##### ${children}\n\n`;
            case 'h6': return `\n###### ${children}\n\n`;
            case 'p': return `${children}\n\n`;
            case 'strong':
            case 'b': return `**${children}**`;
            case 'em':
            case 'i': return `*${children}*`;
            case 'br': return '\n';
            case 'a': return children; // Keep text, ignore link for now unless it's a footnote
            // Handle lists if present (simple approach) or other tags
            case 'ul': return `${children}\n`;
            case 'ol': return `${children}\n`;
            case 'li': return `- ${children}\n`;
            case 'div': return `${children}\n`;
            case 'span': return children;
            default: return children;
        }
    }
    return '';
}

// Extract and specific formatting
// We iterate over top-level children of .entry-content to keep spacing clean
let markdownBody = "";

contentDiv.contents().each((i, el) => {
    // Only process element nodes and text nodes
    const md = processNode(el);
    if (md.trim()) {
        markdownBody += md.trim() + "\n\n";
    }
});

// Post-processing cleanup
markdownBody = markdownBody
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
    .replace(/&nbsp;/g, ' ');

// Add Metadata Header
const header = `---
kitap: "Asa-yı Musa"
bölüm: "Birinci Hüccet-i İmâniye (Yedinci Şuâ, Âyetü’l-Kübrâ)"
tarih: ${new Date().toISOString()}
---

# Birinci Hüccet-i İmâniye (Yedinci Şuâ, Âyetü’l-Kübrâ)

`;

const finalContent = header + markdownBody;

// Write to file
fs.writeFileSync(OUTPUT_FILE_PATH, finalContent, 'utf8');
console.log(`Successfully wrote to ${OUTPUT_FILE_PATH}`);
console.log(`Total length: ${finalContent.length} chars`);
