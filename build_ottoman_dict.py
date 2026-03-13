#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_ottoman_dict.py
=====================
Risale-i Nur külliyatından Osmanlıca/Arapça kelimeleri çıkarır,
DeepSeek API'siyle toplu anlamlandırır ve ottoman_dict.json kaydeder.

Kullanım:
    python build_ottoman_dict.py

Çıktı:
    frontend/src/ottoman_dict.json   ← frontend'de yüklenecek sözlük
    ottoman_raw_words.txt            ← ham kelime listesi (debug)
"""

import os
import re
import json
import sys
import time
import pathlib
import urllib.request
import urllib.error

# ─── Konfigürasyon ────────────────────────────────────────────────────────────

# .env dosyasından DEEPSEEK_API_KEY oku
def load_env(env_path):
    env = {}
    if not os.path.exists(env_path):
        return env
    with open(env_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
    return env

SCRIPT_DIR   = pathlib.Path(__file__).parent
ENV_PATH     = SCRIPT_DIR / 'backend' / '.env'
KB_DIR       = SCRIPT_DIR / 'knowledge-base' / 'kulliyat'
OUTPUT_JSON  = SCRIPT_DIR / 'frontend' / 'src' / 'ottoman_dict.json'
RAW_WORDS    = SCRIPT_DIR / 'ottoman_raw_words.txt'

env = load_env(ENV_PATH)
API_KEY      = env.get('DEEPSEEK_API_KEY', os.environ.get('DEEPSEEK_API_KEY', ''))
API_URL      = env.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com') + '/v1/chat/completions'
MODEL        = 'deepseek-chat'

if not API_KEY:
    print("❌ DEEPSEEK_API_KEY bulunamadı. backend/.env dosyasını kontrol et.")
    sys.exit(1)

# ─── 1. Tüm MD dosyalarını oku ────────────────────────────────────────────────

def read_all_chunks() -> str:
    """Tüm külliyat markdown dosyalarını birleştirip tek metin döndürür."""
    texts = []
    md_files = sorted(KB_DIR.rglob('*.md'))
    print(f"📚 {len(md_files)} markdown dosyası bulundu.")

    for fp in md_files:
        try:
            content = fp.read_text(encoding='utf-8', errors='ignore')
            # YAML frontmatter'ı at (--- ... ---)
            content = re.sub(r'^---[\s\S]*?---\s*', '', content, count=1)
            # Arapça satırları at (Unicode Arapça blok)
            content = re.sub(r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+', ' ', content)
            # Markdown başlık işaretlerini at
            content = re.sub(r'^#+\s*', '', content, flags=re.MULTILINE)
            texts.append(content)
        except Exception as e:
            print(f"  ⚠ {fp.name}: {e}")

    combined = '\n'.join(texts)
    print(f"📝 Toplam metin uzunluğu: {len(combined):,} karakter")
    return combined

# ─── 2. Osmanlıca/Arapça görünümlü kelimeleri çıkar ─────────────────────────

# Günümüz Türkçesinde yaygın olan ve sözlükte yer almaması gereken kelimeler
COMMON_TR = {
    # Çok yaygın bağlaçlar, edatlar, zamir vb.
    'bir', 'bu', 'şu', 'o', 'ki', 'de', 'da', 'ile', 'için', 'ama', 'fakat',
    'lakin', 've', 'veya', 'ya', 'hem', 've', 'gibi', 'dahi', 'ise', 'bile',
    'üzere', 'göre', 'beri', 'kadar', 'dek', 'itibaren', 'doğru', 'karşı',
    'önce', 'sonra', 'içinde', 'dışında', 'üstünde', 'altında', 'yanında',
    # Sık geçen ama Osmanlıca olmayan kelimeler
    'insan', 'allah', 'hakk', 'hak', 'nur', 'kalp', 'akıl', 'ruh', 'can',
    'yer', 'gök', 'arz', 'hava', 'su', 'ateş', 'ışık', 'gece', 'gündüz',
    # İsimler, zamirler
    'ben', 'sen', 'biz', 'siz', 'onlar', 'bana', 'sana', 'bizi', 'sizi',
    'onu', 'onları', 'kendi', 'kendisi', 'herkes', 'kimse', 'hiç', 'her',
    'çok', 'az', 'daha', 'en', 'pek', 'çünkü', 'zira', 'hatta', 'ancak',
    # Zaman kelimeleri
    'zaman', 'an', 'vakti', 'daima', 'bazen', 'artık', 'yine', 'tekrar',
    # Sık geçen ama modern Türkçede bilinen Osmanlıca kelimeler
    'millet', 'devlet', 'hükümet', 'şehir', 'köy', 'yol', 'kitap', 'sayfa',
    'kelime', 'söz', 'cümle', 'paragraf', 'bölüm', 'fasıl', 'kısım', 'madde',
    'mesela', 'misal', 'örnek', 'yani', 'demek', 'şöyle', 'böyle', 'öyle',
    # Çok kısa kelimeler (3 harf ve altı çoğu zaman yaygın)
}

# Osmanlıca/Arapça kelime kalıpları
OTTOMAN_PATTERNS = [
    # -iyet, -iyyet, -iyet eki (uluhiyet, rahmaniyyet)
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{4,}iyet\b',
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{4,}iyyet\b',
    # -ane, -âne eki (meyusane, âşıkane)
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{3,}ane\b',
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{3,}âne\b',
    # -perest (putperest, dünyaperest)
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{3,}perest\b',
    # -dar (kahraman-dar gibi değil, sadece özgün Osmanlıca -dar)
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{4,}dar\b',
    # -kâr, -kar (günahkâr, hizmetkâr)
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{3,}kâr\b',
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{4,}kar\b',
    # -name (mektupname, risalename)
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{3,}name\b',
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{3,}nâme\b',
    # -hane (matemhane, dershane)
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{3,}hane\b',
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{3,}hâne\b',
    # Tire ile bağlı tamlamalar: nur-u tevhid, sırr-ı ehadiyet
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{2,}-[ui]-[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{2,}\b',
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{2,}-ı-[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{2,}\b',
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{2,}-i-[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{2,}\b',
    # -âb (âb-ı hayat)
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{3,}ât\b',
    # Çoğul -at (tahribat, müşahedat)
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{4,}at\b',
    # -yet eki
    r'\b[A-Za-zğüşöçıİĞÜŞÖÇÂÎÛâîû]{4,}yet\b',
    # Şedd işareti içeren (müdakkik vb.) — uzun kelimeler büyük harfle başlayan
    r'\b[A-ZÂÎÛİ][a-zğüşöçıâîûĞÜŞÖÇ]{4,}\b',
    # mu- / mü- önekli kelimeler (müteessir, muhteşem)
    r'\bmü[a-zğüşöçıâîûĞÜŞÖÇ]{4,}\b',
    r'\bmu[a-zğüşöçıâîûĞÜŞÖÇ]{4,}\b',
    # ma- önekli (mahiyet, mahluk)
    r'\bma[a-zğüşöçıâîûĞÜŞÖÇ]{4,}\b',
    # me- önekli (mevcudat, medar)
    r'\bme[a-zğüşöçıâîûĞÜŞÖÇ]{4,}\b',
    # te-/ta- önekli (tefekkür, tahkik)
    r'\bte[a-zğüşöçıâîûĞÜŞÖÇ]{4,}\b',
    r'\bta[a-zğüşöçıâîûĞÜŞÖÇ]{4,}\b',
    # is-/is- önekli (istikamet, istifade)
    r'\bisti[a-zğüşöçıâîûĞÜŞÖÇ]{3,}\b',
]

def extract_ottoman_words(text: str) -> list[str]:
    """Metinden Osmanlıca/Arapça görünümlü kelimeleri çıkarır."""
    found = set()

    for pattern in OTTOMAN_PATTERNS:
        matches = re.findall(pattern, text)
        for m in matches:
            # Temizle
            word = m.strip().strip('.,;:!?()[]{}"\'"')
            if not word:
                continue
            # Uzunluk filtresi
            if len(word) < 4 or len(word) > 35:
                continue
            # Tamamen büyük harf ise atla (kısaltma)
            if word.isupper():
                continue
            # Sayı içeriyorsa atla
            if re.search(r'\d', word):
                continue
            # Yaygın kelimeler listesinde mi?
            if word.lower() in COMMON_TR:
                continue
            found.add(word.lower())

    # Ekstra: tire-bağlı tek-token tamlamaları (sırr-ı-ehadiyet)
    tamlamalar = re.findall(
        r'\b[a-zğüşöçıâîûA-ZÂÎÛİĞÜŞÖÇ]{2,}-[uıiü]-[a-zğüşöçıâîûA-ZÂÎÛİĞÜŞÖÇ]{2,}\b',
        text
    )
    for t in tamlamalar:
        t = t.strip()
        if 4 <= len(t) <= 40 and not t.lower() in COMMON_TR:
            found.add(t.lower())

    print(f"🔍 Regex ile {len(found)} unique tek-kelime çıkarıldı.")
    return sorted(found)


def extract_izafet_tamlamalari(text: str) -> list[str]:
    """
    Boşluklu izafet tamlamalarını çıkarır:
      kemâl-i merhamet, sırr-ı ehadiyet, nur-u tevhid,
      hakikat-i uzmâ, cilve-i rahmet, âb-ı hayat ...

    Kural: "kelime-[iıuü] kelime" yapısı (boşlukla ayrılmış)
    """
    # Türkçe/Osmanlıca karakter sınıfı
    TR = r'[A-Za-zâîûÂÎÛıİğüşöçĞÜŞÖÇ]'
    pattern = re.compile(
        rf'\b({TR}{{2,}}-[iıuü]\s+{TR}{{3,}})\b',
        re.UNICODE
    )

    found = set()
    for m in pattern.finditer(text):
        phrase = m.group(1).strip()
        # Uzunluk filtresi: en az 7, en fazla 50 karakter
        if not (7 <= len(phrase) <= 50):
            continue
        # Sayı içermesin
        if re.search(r'\d', phrase):
            continue
        # Her iki parça da en az 2 harf olsun
        parts = phrase.split()
        if len(parts) != 2:
            continue
        found.add(phrase.lower())

    print(f"🔍 İzafet tamlaması: {len(found)} unique tamlama çıkarıldı.")
    return sorted(found)

# ─── 3. DeepSeek'e tek seferlik istek gönder ─────────────────────────────────

PROMPT_TEMPLATE = """Aşağıdaki kelimeler Risale-i Nur külliyatından alınmıştır (Osmanlıca/Arapça kökenli).

Her kelime/tamlama için Risale bağlamındaki **kısa Türkçe anlamı**nı yaz (maksimum 8 kelime).
- Günümüz Türkçesinde zaten herkesin bildiği kelimeleri listeye ALMA (örn: kitap, yol, şehir).
- Arapça köklü ama anlamı açık olanları da gerek yok (örn: namaz, oruç, hac).
- Yalnızca gerçekten Osmanlıca/arkaik/uzmanlık gerektiren kelime ve tamlamaları dahil et.
- İzafet tamlamaları (örn: "kemâl-i merhamet", "sırr-ı ehadiyet") özellikle önemlidir — bunları dahil et.
- Sadece bu kelimeleri içeren JSON döndür. Başka hiçbir şey yazma.
- Format: {{"kelime": "kısa Türkçe anlam", ...}}

Kelimeler/Tamlamalar:
{words}"""

MAX_WORDS_PER_BATCH = 500   # DeepSeek context limit güvenliği için
MAX_RETRIES = 3

def call_deepseek(prompt: str) -> str | None:
    """DeepSeek API'sine istek gönderir, ham yanıt döndürür."""
    payload = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 8000,
    }).encode('utf-8')

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}',
        },
        method='POST'
    )

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = json.loads(resp.read().decode('utf-8'))
                return body['choices'][0]['message']['content'].strip()
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='replace')
            print(f"  ⚠ HTTP {e.code} (deneme {attempt}/{MAX_RETRIES}): {body[:200]}")
            if e.code == 429:
                time.sleep(10 * attempt)
            elif e.code >= 500:
                time.sleep(5 * attempt)
            else:
                break
        except Exception as e:
            print(f"  ⚠ Hata (deneme {attempt}/{MAX_RETRIES}): {e}")
            time.sleep(5 * attempt)

    return None

def parse_json_response(raw: str) -> dict:
    """API yanıtından JSON bloğu çıkarır."""
    # Markdown kod bloğu varsa temizle
    raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'```\s*$', '', raw, flags=re.MULTILINE)
    raw = raw.strip()

    # İlk { ile son } arasını al
    start = raw.find('{')
    end = raw.rfind('}')
    if start == -1 or end == -1:
        return {}

    json_str = raw[start:end+1]
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"  ⚠ JSON parse hatası: {e}")
        # Satır satır düzelt: trailing comma vb.
        json_str = re.sub(r',\s*}', '}', json_str)
        json_str = re.sub(r',\s*]', ']', json_str)
        try:
            return json.loads(json_str)
        except Exception:
            return {}

def enrich_with_deepseek(words: list[str]) -> dict:
    """
    Kelime listesini DeepSeek'e gönderir.
    2000'den fazla kelime varsa MAX_WORDS_PER_BATCH'e böler.
    """
    all_results = {}
    batches = [words[i:i+MAX_WORDS_PER_BATCH] for i in range(0, len(words), MAX_WORDS_PER_BATCH)]

    print(f"🤖 DeepSeek'e {len(words)} kelime gönderiliyor ({len(batches)} batch)...")

    for idx, batch in enumerate(batches, 1):
        word_list = ', '.join(batch)
        prompt = PROMPT_TEMPLATE.format(words=word_list)

        print(f"  📨 Batch {idx}/{len(batches)} ({len(batch)} kelime) gönderiliyor...")
        raw = call_deepseek(prompt)

        if not raw:
            print(f"  ❌ Batch {idx} yanıt alınamadı, atlanıyor.")
            continue

        parsed = parse_json_response(raw)
        print(f"  ✅ Batch {idx}: {len(parsed)} kelimeye anlam eklendi.")
        all_results.update(parsed)

        # Batch'ler arası kısa bekleme (rate limit)
        if idx < len(batches):
            time.sleep(2)

    return all_results

# ─── 4. Mevcut ottoman_dict.js ile birleştir ─────────────────────────────────

EXISTING_JS_DICT = {
    'hodbin': 'Kendini beğenmiş, bencil, kibirli',
    'hüdabin': "Allah'ı gören, hakikati bulan",
    'süluk': 'Manevi yolculuk, seyr ü sefer',
    'müteessir': 'Etkilenen, üzülen, acı duyan',
    'hazin': 'Hüzünlü, kederli, acıklı',
    'meyusane': "Ümitsizce, çaresizce, ye'se düşmüş halde",
    'ecnebi': 'Yabancı, el, başka milletten olan',
    'tahribat': 'Tahribatlar, yıkımlar, hasar',
    'vaveyla': 'Feryat, bağırış, âh u figan',
    'matemhane': 'Yas evi, matem yeri, hüzün mekânı',
    'tevekkül': "Allah'a dayanıp güvenme, işi O'na bırakma",
    'istikamet': 'Doğruluk, dürüstlük, doğru yolda olma',
    'inayet': 'İlahi yardım, lütuf, ihsan',
    'münasebet': 'İlgi, alaka, bağlantı, ilişki',
    'hakikat': 'Gerçek, asıl, özün özü',
    'tefekkür': 'Derin düşünme, ibret alarak düşünme',
    'enaniyet': "Benlik duygusu, egoizm, ben'lik",
    'taziye': 'Baş sağlığı dileme, acıyı paylaşma',
    'istikbal': 'Gelecek, ilerde gelen zaman',
    'kader': "Allah'ın ezeli takdiri, ilahi plân",
}

# ─── 5. Ana akış ─────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  Risale-i Nur Osmanlıca Sözlük Oluşturucusu")
    print("=" * 60)

    # 1. Tüm metinleri oku
    text = read_all_chunks()

    # 2a. Tek kelime Osmanlıca çıkar
    words = extract_ottoman_words(text)

    # 2b. Boşluklu izafet tamlamalarını çıkar (kemâl-i merhamet vb.)
    tamlamalar = extract_izafet_tamlamalari(text)

    # Birleştir
    all_terms = sorted(set(words + tamlamalar))

    # Ham liste kaydet
    RAW_WORDS.write_text('\n'.join(all_terms), encoding='utf-8')
    print(f"💾 Ham liste kaydedildi: {len(words)} kelime + {len(tamlamalar)} tamlama = {len(all_terms)} toplam")

    # 3. Zaten bilinen kelimeleri çıkar
    #    — Hem hardcoded dict hem de mevcut ottoman_dict.json'daki kelimeler
    known = set(EXISTING_JS_DICT.keys())
    if OUTPUT_JSON.exists():
        try:
            with open(OUTPUT_JSON, encoding='utf-8') as f:
                existing_json = json.load(f)
            known.update(existing_json.keys())
            print(f"📂 Mevcut ottoman_dict.json'dan {len(existing_json)} kelime yüklendi.")
        except Exception as e:
            print(f"  ⚠ JSON okunamadı: {e}")
    new_words = [w for w in all_terms if w not in known]
    print(f"🆕 {len(known)} bilinen, {len(new_words)} yeni terim DeepSeek'e gönderiliyor.")

    # 4. DeepSeek ile zenginleştir
    deepseek_results = {}
    if new_words:
        deepseek_results = enrich_with_deepseek(new_words)
    else:
        print("ℹ Tüm kelimeler zaten biliniyordu, DeepSeek atlanıyor.")

    # 5. Birleştir: mevcut sözlük + DeepSeek sonuçları
    final_dict = {}
    final_dict.update(EXISTING_JS_DICT)        # önce mevcut
    final_dict.update(deepseek_results)         # üzerine yeni ekle

    # Boş/anlamsız anlamları temizle
    final_dict = {
        k: v for k, v in final_dict.items()
        if v and len(v.strip()) > 2 and k.strip()
    }

    # Alfabetik sırala
    final_dict = dict(sorted(final_dict.items()))

    # 6. JSON olarak kaydet
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(final_dict, f, ensure_ascii=False, indent=2)

    print()
    print("=" * 60)
    print(f"✅ TAMAMLANDI!")
    print(f"   Toplam sözlük boyutu : {len(final_dict)} kelime")
    print(f"   JSON çıktı           : {OUTPUT_JSON}")
    print(f"   Ham liste            : {RAW_WORDS}")
    print()
    print("Sonraki adım:")
    print("  ottoman_dict.js içindeki OTTOMAN_DICT'i JSON'dan yükleyecek")
    print("  şekilde güncellemek için update_dict_loader.py'yi çalıştır.")
    print("=" * 60)

if __name__ == '__main__':
    main()
