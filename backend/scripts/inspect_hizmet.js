
import fetch from 'node-fetch';
import fs from 'fs';

async function main() {
    console.log('Fetching Render Content URL...');
    // Identified from custom.js: base_url + 'kulliyat-render/' + yol
    const url = 'https://www.risalekulliyati.com/kulliyat-render/sozler/birinci-soz-1';
    try {
        const res = await fetch(url);
        const text = await res.text();
        fs.writeFileSync('debug_render_result.html', text);
        console.log('Saved debug_render_result.html');
        console.log('Preview of content (first 1000 chars):');
        console.log(text.substring(0, 1000));

        if (text.includes('Bismillah')) {
            console.log('SUCCESS: "Bismillah" found in content!');
        } else {
            console.log('WARNING: "Bismillah" NOT found. Content might be structured differently.');
        }

        if (text.includes('Haşiye') || text.includes('Hâşiye')) {
            console.log('SUCCESS: Footnote (Haşiye) indicator found!');
        }
    } catch (e) {
        console.error('Failed to fetch render url:', e);
    }
}

main();
