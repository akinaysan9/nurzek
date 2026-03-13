import os

base_path = r"C:\Users\AkınAysan\Desktop\risale-nur-ai\knowledge-base\kulliyat\asa-yi-musa"
file_001 = os.path.join(base_path, "001-birinci-mesele-on-birinci-sua.md")

with open(file_001, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extraction
# 013-on-ucuncu-sua.md: 1336-1800 (1-indexed) -> 1335:1800 (0-indexed)
on_ucuncu_sua = lines[1335:1800]
# 012-on-ikinci-sua.md: 1801-3499 (1-indexed) -> 1800:3499 (0-indexed)
on_ikinci_sua = lines[1800:3499]
# 014-genclik-rehberi-appendix.md: 3500-5204 (1-indexed) -> 3499:5204 (0-indexed)
genclik_rehberi = lines[3499:5204]

def write_extracted(filename, content, title):
    header = [
        "---\n",
        'kitap: "Asa-yı Musa"\n',
        f'bölüm: "{title}"\n',
        "tarih: 2026-02-13T07:20:00.000Z\n",
        "---\n\n"
    ]
    # Remove existing YAML if present in extracted lines (unlikely but safe)
    clean_content = content
    if content[0].startswith("---"):
        # find end of yaml
        try:
            end_idx = content[1:].index("---\n") + 2
            clean_content = content[end_idx:]
        except ValueError:
            pass
            
    with open(os.path.join(base_path, filename), 'w', encoding='utf-8') as f:
        f.writelines(header)
        f.writelines(clean_content)

write_extracted("012-on-ikinci-sua.md", on_ikinci_sua, "On İkinci Şuâ")
write_extracted("013-on-ucuncu-sua.md", on_ucuncu_sua, "On Üçüncü Şuâ")
write_extracted("014-genclik-rehberi-appendix.md", genclik_rehberi, "Gençlik Rehberinin Küçük Bir Haşiyesi")

# Truncation of 001-011
# We'll look for the first occurrence of "• • •" or a jump to "Yedinci Mesele" to truncate.
# Specifically for 001 and 002 we saw it's very early.
# For others, we'll find the first line that starts with "#" after the initial header, 
# or look for "On Üçüncü Şuâ" or "Yedinci Mesele" if it shouldn't be there.

for i in range(1, 12):
    fname = f"{i:03d}-"
    # Find the actual filename
    actual_fname = None
    for f in os.listdir(base_path):
        if f.startswith(fname):
            actual_fname = f
            break
    
    if not actual_fname: continue
    
    fpath = os.path.join(base_path, actual_fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        file_lines = f.readlines()
    
    # Keep YAML (lines 0-4)
    # Search for truncation point starting after line 7
    trunc_point = len(file_lines)
    for idx, line in enumerate(file_lines[7:], 7):
        if line.strip() == "Yedinci Mesele" or line.strip() == "On Üçüncü Şuâ" or line.strip() == "On İkinci Şuâ":
            trunc_point = idx - 1 # One line before
            # Check if there is a separator before it
            if file_lines[idx-1].strip() == "• • •":
                trunc_point = idx - 1
            if file_lines[idx-2].strip() == "• • •":
                 trunc_point = idx - 2
            break
            
    # For file 011, it might actually be the 11th Mesele. 
    # Let's see if 011 has "On Birinci Mesele" as its main content.
    # From my view, 011 starts with "On Birinci Mesele" and then has the redundant stuff.
    
    new_lines = file_lines[:trunc_point]
    with open(fpath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f"Truncated {actual_fname} to {trunc_point} lines.")
