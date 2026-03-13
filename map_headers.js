const fs = require('fs');

const filePath = "C:\\Users\\AkınAysan\\Desktop\\risale-nur-ai\\knowledge-base\\kulliyat\\asa-yi-musa\\001-birinci-mesele-on-birinci-sua.md";
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const results = [];
lines.forEach((line, index) => {
    if (line.trim().startsWith('#') || line.trim().match(/^[A-ZİÖÜŞÇ][a-ziöüşç]+\s[A-ZİÖÜŞÇ][a-ziöüşç]+/)) {
        // Look for potential headers (even if not #)
        if (line.length < 100 && line.trim().length > 3) {
            results.push({ line: index + 1, content: line.trim() });
        }
    }
});

fs.writeFileSync('all_headers_001.json', JSON.stringify(results, null, 2));
console.log(`Found ${results.length} potential headers.`);
