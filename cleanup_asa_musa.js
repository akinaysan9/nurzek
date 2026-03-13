const fs = require('fs');
const path = require('path');

const basePath = "C:\\Users\\AkınAysan\\Desktop\\risale-nur-ai\\knowledge-base\\kulliyat\\asa-yi-musa";
const file001 = path.join(basePath, "001-birinci-mesele-on-birinci-sua.md");

const content001 = fs.readFileSync(file001, 'utf8');
const linesArr = content001.split('\n');

function writeExtracted(filename, lines, title) {
    const header = [
        "---",
        'kitap: "Asa-yı Musa"',
        `bölüm: "${title}"`,
        "tarih: 2026-02-13T07:20:00.000Z",
        "---",
        "",
        ""
    ].join('\n');

    fs.writeFileSync(path.join(basePath, filename), header + lines.join('\n'));
}

// Extraction (0-based indices)
// On Üçüncü Şuâ: 1336-1800 (1-indexed) -> 1335:1800
const onUcuncuSua = linesArr.slice(1335, 1800);
// On İkinci Şuâ: 1801-3499 (1-indexed) -> 1800:3499
const onIkinciSua = linesArr.slice(1800, 3499);
// Gençlik Rehberi: 3500-5204 (1-indexed) -> 3499:5204
const genclikRehberi = linesArr.slice(3499, 5204);

writeExtracted("012-on-ikinci-sua.md", onIkinciSua, "On İkinci Şuâ");
writeExtracted("013-on-ucuncu-sua.md", onUcuncuSua, "On Üçüncü Şuâ");
writeExtracted("014-genclik-rehberi-appendix.md", genclikRehberi, "Gençlik Rehberinin Küçük Bir Haşiyesi");

// Truncation 001-011
const files = fs.readdirSync(basePath);
for (let i = 1; i <= 11; i++) {
    const prefix = i.toString().padStart(3, '0') + '-';
    const actualFname = files.find(f => f.startsWith(prefix));

    if (!actualFname) continue;

    const fpath = path.join(basePath, actualFname);
    const fContent = fs.readFileSync(fpath, 'utf8');
    const fLines = fContent.split('\n');

    let truncPoint = fLines.length;
    // We search after line 7 (the header)
    for (let idx = 7; idx < fLines.length; idx++) {
        const line = fLines[idx].trim();
        if (line === "Yedinci Mesele" || line === "On Üçüncü Şuâ" || line === "On İkinci Şuâ") {
            truncPoint = idx;
            // Check for separator
            if (idx > 0 && fLines[idx - 1].trim() === "• • •") truncPoint = idx - 1;
            if (idx > 1 && fLines[idx - 2].trim() === "• • •") truncPoint = idx - 2;
            break;
        }
    }

    const newContent = fLines.slice(0, truncPoint).join('\n');
    fs.writeFileSync(fpath, newContent);
    console.log(`Truncated ${actualFname} to ${truncPoint} lines.`);
}
