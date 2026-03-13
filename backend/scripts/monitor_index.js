import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexFile = path.join(__dirname, '..', 'data', 'vector_index.json');

console.log('Waiting for vector_index.json to appear...');

const check = setInterval(() => {
    if (fs.existsSync(indexFile)) {
        const stats = fs.statSync(indexFile);
        console.log(`✅ Index file found! Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        if (stats.size > 15 * 1024 * 1024) { // Wait until > 15MB
            console.log('Index likely ready.');
            clearInterval(check);
            process.exit(0);
        }
    } else {
        process.stdout.write('.');
    }
}, 5000);
