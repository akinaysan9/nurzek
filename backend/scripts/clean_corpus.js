import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KB_DIR = path.join(__dirname, '../../knowledge-base/kulliyat');
// Default to write mode if argument provided, else dry run? 
// Let's make it easy: node clean_corpus.js --write
const WRITE_MODE = process.argv.includes('--write');

console.log(`Starting cleanup... WRITE_MODE=${WRITE_MODE}`);

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const TOC_REGEX = /Bölümler\s+Giriş\s+Birinci Pencere\s+İkinci Pencere[\s\S]*?Otuz Üçüncü Pencere İhtar/g;

walkDir(KB_DIR, (filePath) => {
    if (!filePath.endsWith('.md')) return;

    let content = fs.readFileSync(filePath, 'utf-8');

    if (TOC_REGEX.test(content)) {
        console.log(`[MATCH] ${path.basename(filePath)}`);

        if (WRITE_MODE) {
            const newContent = content.replace(TOC_REGEX, '');
            fs.writeFileSync(filePath, newContent, 'utf-8');
            console.log(`  -> Cleaned.`);
        }
    }
});

if (!WRITE_MODE) {
    console.log("Run with --write to apply changes.");
}
console.log("Cleanup finished.");
