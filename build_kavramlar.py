#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_kavramlar.py
==================
Risale-i Nur külliyatından çok kelimeli kavramları çıkarır.
DeepSeek KULLANMAZ — kavramın geçtiği cümleyi doğrudan anlam olarak kullanır.

Her kavram için:
  - Külliyattaki bağlam cümlesini (Said Nursi'nin kendi sözü) saklar
  - Tüm geçiş yerlerini (kitap/bölüm) atıf olarak kaydeder

Çıktı (kavramlar.json):
  {
    "sırr-ı ehadiyet": {
      "baglam": "O sırr-ı ehadiyet ile her bir çiçek...",
      "atiflar": [
        {"kitap": "Sözler", "bolum": "10. Söz"},
        {"kitap": "Lem'alar", "bolum": "30. Lem'a"}
      ]
    }
  }

Kullanım:
    python build_kavramlar.py                 # minimum 3 atıf (önemli kavramlar)
    python build_kavramlar.py --min-ref 1     # tüm kavramlar
    python build_kavramlar.py --min-ref 5     # çok önemli kavramlar
"""

import os
import re
import json
import sys
import pathlib

# ─── Konfigürasyon ────────────────────────────────────────────────────────────

# Minimum atıf sayısı (parser argümanla değiştirilebilir)
MIN_REF = 3
for arg in sys.argv[1:]:
    if arg.startswith('--min-ref'):
        if '=' in arg:
            MIN_REF = int(arg.split('=')[1])
        else:
            idx = sys.argv.index(arg)
            if idx + 1 < len(sys.argv):
                MIN_REF = int(sys.argv[idx + 1])

SCRIPT_DIR  = pathlib.Path(__file__).parent
KB_DIR      = SCRIPT_DIR / 'knowledge-base' / 'kulliyat'
OUTPUT_JSON = SCRIPT_DIR / 'frontend' / 'src' / 'kavramlar.json'
RAW_LIST    = SCRIPT_DIR / 'kavramlar_raw.txt'

# ─── Bölüm/kitap güzelleştirme ────────────────────────────────────────────────

def prettify_section(slug):
    """001-birinci-soz → Birinci Söz"""
    name = re.sub(r'^\d{1,3}-', '', slug)
    return name.replace('-', ' ').title()

BOOK_MAP = {
    'sozler': 'Sözler', 'mektubat': 'Mektubat', 'lemalar': "Lem'alar",
    'sualar': 'Şualar', 'mesnevi-i-nuriye': 'Mesnevi-i Nuriye',
    'isaratul-icaz': "İşaratü'l-İ'caz", 'tarihce-i-hayat': 'Tarihçe-i Hayat',
    'sikke-i-tasdik-i-gaybi': 'Sikke-i Tasdik-i Gaybî',
    'barla-lahikasi': 'Barla Lâhikası', 'kastamonu-lahikasi': 'Kastamonu Lâhikası',
    'emirdag-lahikasi-1': 'Emirdağ Lâhikası I', 'emirdag-lahikasi-2': 'Emirdağ Lâhikası II',
    'asa-yi-musa': 'Asâ-yı Musa', 'muhakemat': 'Muhakemat',
    'hutbe-i-samiye': 'Hutbe-i Şâmiye', 'munazarat': 'Münâzarat',
}

def prettify_book(name):
    return BOOK_MAP.get(name.lower(), name.replace('-', ' ').title())

# ─── 1. Tüm cümleleri oku ────────────────────────────────────────────────────

def read_all_sentences():
    all_sentences = []
    md_files = sorted(KB_DIR.rglob('*.md'))
    print(f"📚 {len(md_files)} dosya bulundu.")

    for fp in md_files:
        try:
            content = fp.read_text(encoding='utf-8', errors='ignore')
            content = re.sub(r'^---[\s\S]*?---\s*', '', content, count=1)
            content = re.sub(r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+', ' ', content)
            content = re.sub(r'^#+\s*', '', content, flags=re.MULTILINE)
            content = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', content)

            sentences = re.split(r'(?<=[.!?])\s+|\n{2,}', content)
            book = prettify_book(fp.parent.name)
            section = prettify_section(fp.stem)

            for s in sentences:
                s = s.strip()
                if len(s) > 20:
                    all_sentences.append((s, book, section))
        except Exception as e:
            print(f"  ⚠ {fp.name}: {e}")

    print(f"📝 {len(all_sentences):,} cümle çıkarıldı.")
    return all_sentences

# ─── 2. Kavramları çıkar (atıflarıyla) ────────────────────────────────────────

TR = r"[A-Za-zğüşöçıİĞÜŞÖÇâîûÂÎÛêÊ'']"

KAVRAM_PATTERNS = [
    re.compile(rf'({TR}{{2,}}-[iıuü]\s+{TR}{{3,}})', re.UNICODE),
    re.compile(rf"({TR}{{2,}}[üu]['']l-{TR}{{3,}})", re.UNICODE),
    re.compile(rf"({TR}{{2,}}[''][ln]-{TR}{{2,}})", re.UNICODE),
]

SKIP_WORDS = {
    'bir', 'bu', 'şu', 'çok', 'daha', 'her', 'hem', 'olan', 'olarak',
    'onun', 'bunun', 'ise', 'gibi', 'kadar', 'böyle', 'şöyle', 'bütün',
    'başka', 'ancak', 'fakat', 'üzere', 'sonra', 'önce', 'dolayı', 'yani',
    'hatta', 'mesela', 'demek', 'eder', 'eden', 'olur', 'etmek',
    'veya', 'yahut', 'amma', 'lakin', 'nasıl', 'neden', 'iken',
}

def extract_kavramlar(sentences):
    kavram_data = {}

    for sentence, book, section in sentences:
        for pattern in KAVRAM_PATTERNS:
            for m in pattern.finditer(sentence):
                kavram = m.group(1).strip()

                if len(kavram) < 5 or len(kavram) > 60:
                    continue
                if re.search(r'\d', kavram):
                    continue

                words_raw = re.split(r'[\s-]+', kavram.lower())
                words = [w.strip("''") for w in words_raw if len(w) > 1]
                if any(w in SKIP_WORDS for w in words):
                    continue

                key = kavram.lower().strip()

                if key not in kavram_data:
                    kavram_data[key] = {
                        "display": kavram,
                        "atiflar": [],
                        "best_context": "",
                        "best_context_score": 0,
                    }

                # Atıf ekle (aynı kitap/bölüm tekrarı engelle)
                ref = {"kitap": book, "bolum": section}
                existing_refs = kavram_data[key]["atiflar"]
                if not any(r["kitap"] == book and r["bolum"] == section for r in existing_refs):
                    existing_refs.append(ref)

                # En iyi bağlam cümlesini seç:
                # Kavramın mümkün olduğunca ortasında olduğu, yeterli uzunluktaki cümle
                pos = m.start()
                ctx = sentence.strip()
                # Skor: cümle uzunluğu (çok kısa olmasın) + kavram pozisyonuna yakınlık
                score = min(len(ctx), 200) - abs(pos - len(ctx) // 3)
                if score > kavram_data[key]["best_context_score"]:
                    kavram_data[key]["best_context"] = ctx[:250]
                    kavram_data[key]["best_context_score"] = score

    print(f"🔍 {len(kavram_data)} unique kavram çıkarıldı.")
    multi = sum(1 for v in kavram_data.values() if len(v["atiflar"]) > 1)
    print(f"   ↳ {multi} kavram birden fazla yerde geçiyor")
    return kavram_data


# ─── 3. Final JSON üret ──────────────────────────────────────────────────────

def build_json(kavram_data):
    final = {}

    for key, data in sorted(kavram_data.items()):
        refs = data["atiflar"]

        # Minimum atıf filtresi
        if len(refs) < MIN_REF:
            continue

        ctx = data["best_context"]
        if not ctx or len(ctx) < 10:
            continue

        final[key] = {
            "baglam": ctx,
            "atiflar": [{"kitap": r["kitap"], "bolum": r["bolum"]} for r in refs[:15]]
        }

    return final


# ─── 4. Ana akış ──────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  Risale-i Nur Kavram Haritası (Offline)")
    print(f"  Minimum atıf: {MIN_REF}")
    print("=" * 60)

    sentences = read_all_sentences()
    kavram_data = extract_kavramlar(sentences)

    # Ham listeyi kaydet
    raw_lines = []
    for k, v in sorted(kavram_data.items(), key=lambda x: len(x[1]["atiflar"]), reverse=True):
        refs_str = ", ".join(f'{r["kitap"]}/{r["bolum"]}' for r in v["atiflar"][:5])
        raw_lines.append(f"{k}\t[{len(v['atiflar'])} atıf]\t{refs_str}")
    RAW_LIST.write_text('\n'.join(raw_lines), encoding='utf-8')

    # JSON oluştur
    final = build_json(kavram_data)

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(final, f, ensure_ascii=False, indent=2)

    print()
    print("=" * 60)
    print(f"✅ TAMAMLANDI!")
    print(f"   Toplam kavram (filtresiz) : {len(kavram_data)}")
    print(f"   Sonuç ({MIN_REF}+ atıf)        : {len(final)} kavram")
    print(f"   JSON çıktı               : {OUTPUT_JSON}")
    print(f"   Ham liste                : {RAW_LIST}")
    print("=" * 60)

    # Top 20
    top = sorted(final.items(), key=lambda x: len(x[1]["atiflar"]), reverse=True)[:20]
    print(f"\n🏆 En çok geçen 20 kavram:")
    for i, (k, v) in enumerate(top, 1):
        refs = ", ".join(f'{r["kitap"]}/{r["bolum"]}' for r in v["atiflar"][:3])
        print(f"  {i:2d}. {k:30s} [{len(v['atiflar']):3d} atıf]  {refs}...")


if __name__ == '__main__':
    main()
