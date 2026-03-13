import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust path to point to knowledge-base/kulliyat
// Windows path handling
const KULLIYAT_DIR = path.resolve(__dirname, '../../knowledge-base/kulliyat');

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) {
        console.error(`Directory not found: ${dir}`);
        return;
    }
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(path.join(dir, f));
        }
    });
}

function proc(filePath) {
    if (!filePath.endsWith('.md')) return;

    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // FIX PREVIOUS ERROR: "# # " -> "## "
    // Rejoin split headers - Aggressive match
    content = content.replace(/^#\s+#/gm, '##');

    // 1. Spacing Fix
    content = content.replace(/([a-zğüşiöç])\.([A-ZĞÜŞİÖÇ])/g, '$1. $2');
    content = content.replace(/([a-zğüşiöç])\?([A-ZĞÜŞİÖÇ])/g, '$1? $2');
    content = content.replace(/([a-zğüşiöç])\!([A-ZĞÜŞİÖÇ])/g, '$1! $2');

    // 2. Keyword Formatting
    const keywords = ['SUAL', 'ELCEVAP', 'İHTAR', 'İhtar', 'Elhasıl', 'ELHASIL', 'TENBİH', 'Tenbih'];
    keywords.forEach(kw => {
        const regex = new RegExp(`(?<!\\*\\*)(\\b${kw}):`, 'g');
        content = content.replace(regex, '\n\n**$1:**');
        const regexDot = new RegExp(`\\.(${kw}):`, 'g');
        content = content.replace(regexDot, '.\n\n**$1:**');
    });

    // 3. CORRECT Header Spacing
    // Ensure space after # if missing
    content = content.replace(/^(#+)(?=[^ \n])/gm, '$1 ');

    if (content !== original) {
        console.log(`Fixing: ${path.basename(filePath)}`);
        fs.writeFileSync(filePath, content, 'utf-8');
    }
}

console.log('Starting Fix Restore Aggressive...');
walkDir(KULLIYAT_DIR, proc);
console.log('Done.');
