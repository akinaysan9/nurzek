
import re
import os

file_path = r"C:\Users\AkınAysan\Desktop\risale-nur-ai\knowledge-base\kulliyat\asa-yi-musa\001-birinci-mesele-on-birinci-sua.md"

# Pattern to match potential sections
patterns = [
    r"(Birinci|İkinci|Üçüncü|Dördüncü|Beşinci|Altıncı|Yedinci|Sekizinci|Dokuzuncu|Onuncu|On Birinci) Mesele",
    r"(Birinci|İkinci|Üçüncü|Dördüncü|Beşinci|Altıncı|Yedinci|Sekizinci|Dokuzuncu|Onuncu|On Birinci) Hüccet",
    r"On İkinci Şuâ",
    r"On Üçüncü Şuâ",
    r"Gençlik Rehberi",
    r"Fihrist"
]

combined_pattern = re.compile("|".join(patterns), re.IGNORECASE)

with open(file_path, "r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if combined_pattern.search(line):
            print(f"{i}: {line.strip()[:100]}")
