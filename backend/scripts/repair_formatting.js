import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust path to point to knowledge-base/kulliyat
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

    // 1. HEADER FIX: Ensure "## Haşiyeler" is correct
    // Matches any # combination followed by Haşiyeler, replaces with clean ## Haşiyeler
    // Also handling potential "# # Haşiyeler" or "##Haşiyeler"
    content = content.replace(/^#+\s*Haşiyeler/gm, '## Haşiyeler');

    // Repair other headers similarly if they look broken " # Baslik"
    content = content.replace(/^#+\s+#+\s+(.+)$/gm, '## $1'); // # # Header -> ## Header

    // 2. FOOTNOTE NUMBER FORMATTING
    // Problem: Solitary numbers " 1 " appear as text inside content.
    // Solution: Wrap them in a special format that main.js can detect, or just leave them clean?
    // User says "black small text". Formatting them as [1] might help, but ideally main.js should style them.
    // Let's standardise them to `[footnote-ref:1]` for robust parsing, OR just rely on main.js regex.
    // Given the user wants "interactive", modifying main.js is better.
    // BUT, cleaning up the markdown to not have "1" hanging on a separate line might be good.
    // If "1" is on a line by itself, it breaks flow.
    // CHECK if "1" is on its own line
    // content = content.replace(/^\s*(\d+)\s*$/gm, '**$1**'); // Boldify? No.

    // Let's just fix the headers effectively first, as that's the "diez" issue.
    // And ensure no weird "# #" remains.

    // Clean up any double hashes with spaces "## # "
    content = content.replace(/^#+\s+#+/gm, '##');

    if (content !== original) {
        console.log(`Repaired: ${path.basename(filePath)}`);
        fs.writeFileSync(filePath, content, 'utf-8');
    }
}

console.log('Starting Header Repair...');
walkDir(KULLIYAT_DIR, proc);
console.log('Done.');
