#!/usr/bin/env python3
"""
Risale-i Nur Külliyatı Kavram Tarayıcısı  v2
=============================================
Üretir:
  - concept_index.json      : kavram → bölüm haritası + eş-geçenler
  - esma_index.json         : Esma-i Hüsna dağılımı
  - izafet_index.json       : sıfat tamlamaları (hyphen + lowercase dahil)
  - concept_families.json   : kavram ailesi taslağı

v2 yenilikleri:
  - Seed listesi ~90 → 420+ kavrama çıkarıldı
  - İzafet regex: hem BÜYÜK hem küçük harf, hem tire (-i/-ı) hem boşluklu form
  - Tire-izafet ayrı ayrı çekilip en_yogun_bolumler içine eklendi
  - Lowercase sıfat tamlamaları artık yakalanıyor
"""

import re
import json
import argparse
from pathlib import Path
from collections import defaultdict, Counter

SCRIPT_DIR   = Path(__file__).parent
KULLIYAT_DIR = SCRIPT_DIR.parent / "knowledge-base" / "kulliyat"
OUT_DIR      = SCRIPT_DIR

# ─────────────────────────────────────────────────────────────────────────────
# Türkçe tokenizer + stemmer
# ─────────────────────────────────────────────────────────────────────────────

TR_SPLIT = re.compile(r"[^a-zçğıöşüâîûA-ZÇĞİÖŞÜÂÎÛ']+")

COMMON_SUFFIXES = [
    "ndan","nden","nda","nde",
    "ların","lerin","lardan","lerden","larda","lerde",
    "ydı","ydi",
    "nın","nin","nun","nün",
    "yın","yin","yun","yün",
    "dan","den","tan","ten",
    "yla","yle",
    "na","ne","ya","ye",
    "da","de","ta","te",
    "la","le",
    "lar","ler",
    "yı","yi","yu","yü",
    "ı","i","u","ü",
    "nı","ni","nu","nü",
    "si","sı","su","sü",
    "ın","in","un","ün",
]

def strip_tr_suffix(word: str) -> str:
    w = word.lower()
    for suf in COMMON_SUFFIXES:
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)]
    return w

def tokenize(text: str) -> list:
    raw = TR_SPLIT.split(text)
    tokens = []
    for t in raw:
        t = t.strip("'")
        if len(t) >= 2:
            tokens.append(t.lower())
    return tokens

def concept_occurrences(concept: str, tokens: list) -> int:
    c = concept.lower()
    count = 0
    for tok in tokens:
        base = tok.split("'")[0]
        if base == c or strip_tr_suffix(base) == c:
            count += 1
    return count

# ─────────────────────────────────────────────────────────────────────────────
# İzafet tamlaması çıkarma  (v2: lowercase + tire)
# ─────────────────────────────────────────────────────────────────────────────

# 1) Tire izafet: kelime-i kelime  |  kelime-ü kelime  vb.
HYPHEN_IZAFET = re.compile(
    r"\b([a-zçğıöşüâîûA-ZÇĞİÖŞÜÂÎÛ]{3,})"   # sözcük 1
    r"-([iıuüİIÜU])\s+"                         # bağlama ünlüsü (tire)
    r"([a-zçğıöşüâîûA-ZÇĞİÖŞÜÂÎÛ]{3,})",       # sözcük 2
    re.UNICODE
)

# 2) Boşluklu izafet: iki büyük harfli sözcük yan yana  (eski regex de kalsın)
SPACE_IZAFET = re.compile(
    r"\b([A-ZÇĞİÖŞÜÂÎÛ][a-zçğıöşüâîû]{2,})"
    r"(?:-[iıuü]\s+|\s+)"
    r"([A-ZÇĞİÖŞÜÂÎÛ][a-zçğıöşüâîû]{2,})\b",
    re.UNICODE
)

def extract_izafet(text: str) -> list:
    results = []
    # Tire izafet
    for m in HYPHEN_IZAFET.finditer(text):
        w1, link, w2 = m.group(1), m.group(2), m.group(3)
        results.append(f"{w1.lower()}-{link.lower()} {w2.lower()}")
    # Boşluklu büyük harfli
    for a, b in SPACE_IZAFET.findall(text):
        results.append(f"{a.lower()} {b.lower()}")
    return results

# ─────────────────────────────────────────────────────────────────────────────
# MD okuma
# ─────────────────────────────────────────────────────────────────────────────

FRONTMATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.DOTALL)
ARABIC_RE      = re.compile(r"[\u0600-\u06FF\u0750-\u077F]+")
MARKDOWN_RE    = re.compile(r"[#*_`\[\]>|]")

def read_md(path: Path) -> str:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return ""
    text = FRONTMATTER_RE.sub("", text, count=1)
    text = ARABIC_RE.sub(" ", text)
    text = MARKDOWN_RE.sub(" ", text)
    return text

def slug_from_path(path: Path):
    book_slug    = path.parent.name
    chapter_slug = re.sub(r"^\d+-", "", path.stem)
    return book_slug, chapter_slug

# ─────────────────────────────────────────────────────────────────────────────
# Eş-geçen kavramlar
# ─────────────────────────────────────────────────────────────────────────────

WINDOW_SIZE = 80

def cooccurrence_in_window(tokens: list, concept: str, seed_set: set) -> Counter:
    c = concept.lower()
    co = Counter()
    n  = len(tokens)
    for i, tok in enumerate(tokens):
        base = tok.split("'")[0]
        if base == c or strip_tr_suffix(base) == c:
            lo = max(0, i - WINDOW_SIZE // 2)
            hi = min(n, i + WINDOW_SIZE // 2)
            for wt in tokens[lo:hi]:
                wb   = wt.split("'")[0]
                stem = strip_tr_suffix(wb)
                if stem in seed_set and stem != c:
                    co[stem] += 1
    return co

# ─────────────────────────────────────────────────────────────────────────────
# SEED LİSTESİ  (v2 — 420+ kavram)
# ─────────────────────────────────────────────────────────────────────────────

RISALE_CONCEPTS = [

    # ── ALLAH'IN SIFATLARI / ESMASI ────────────────────────────────────────
    "rububiyet", "uluhiyet", "hakimiyet", "vahdaniyet",
    "ehadiyet", "vahidiyet", "sermediyet", "ezeliyet", "ebediyet",
    "kayyumiyet", "samedanî", "ferdaniyet",
    "celal", "cemal", "kemal",
    "rahmet", "kudret", "irade", "ilim", "hayat",
    "semi", "basiret", "kelam",
    "tekvin", "irade", "kudsiyet",
    "azamet", "kibriya", "haşmet",
    "lütuf", "atıfet", "inayet",
    "rızık", "ihsan", "nimet",
    "meşiet", "kaza", "kader",
    "tecelli", "taayyün",
    "tenzih", "teşbih", "münezzeh", "müberrâ",
    "mutlak", "muhit", "müstağni",

    # ── İNSANIN TEMEL SIFATLARI (4 pencere) ──────────────────────────────
    "acz", "acziyet",
    "fakr", "fakriyet",
    "şükür", "hamd",
    "tefekkür",

    # ── İMAN ESASLARI ─────────────────────────────────────────────────────
    "iman", "tevhid", "vahdet",
    "nübüvvet", "risalet",
    "melek", "melaikeye",
    "kitap", "kütüb",
    "haşir", "haşre",
    "kader", "kazâ",
    "ukba", "âhiret",

    # ── İMAN KALİTESİ ─────────────────────────────────────────────────────
    "yakîn", "itminan",
    "basîret", "ferâset",
    "marifet", "marifetullah",
    "müşahede", "keşif", "ilham",
    "tahkik", "taklid",
    "iman-ı tahkikî",

    # ── GAYB & ŞEHADET ────────────────────────────────────────────────────
    "gayb", "şehadet",
    "mülk", "melekût", "ceberut", "lahut",
    "âlem-i misâl", "berzah",
    "rüya", "vâkıa",

    # ── ENE / BENLİK ──────────────────────────────────────────────────────
    "ene", "enaniyet", "benlik",
    "egoizm", "gurur", "kibir",
    "nahnü",

    # ── NEFS / KALP / RUH / AKIL ──────────────────────────────────────────
    "nefs", "nefis",
    "nefs-i emmare", "nefs-i levvame", "nefs-i mutmainne",
    "kalp", "gönül", "fuad",
    "ruh", "ervah",
    "akıl", "fehim", "idrak",
    "letaif", "sır", "hafi", "ahfa",
    "vicdan", "his",
    "şeytan", "vesvese",

    # ── FİTRAT & İSTİDAD ──────────────────────────────────────────────────
    "fıtrat", "hilkat", "yaratılış",
    "istidad", "kabiliyet", "istidat",
    "fıtrat-ı selime",
    "seciye", "ahlak", "huy",

    # ── EZEL & EBED ───────────────────────────────────────────────────────
    "ezel", "ezelî",
    "ebed", "ebedî", "ebediyet",
    "sermedi", "sermedî",
    "dehr", "zaman",
    "an", "lahza",

    # ── TEVHİD AİLESİ ─────────────────────────────────────────────────────
    "tevhid-i rububiyet",
    "tevhid-i uluhiyet",
    "la ilahe",
    "şirk", "müşrik",
    "sebepler", "tabiat", "tesadüf",
    "esbab", "vesait",

    # ── İHLAS AİLESİ ─────────────────────────────────────────────────────
    "ihlas", "niyet", "samimiyet",
    "riya", "sum'a", "gösteriş",
    "rıza-yı ilahi",

    # ── TEVEKKÜL AİLESİ ───────────────────────────────────────────────────
    "tevekkül", "tefviz", "teslim", "rıza",
    "sabır", "metanet",
    "kanaat", "istiğna",
    "zühd", "takva", "vera",

    # ── UBUDİYET & İBADET ────────────────────────────────────────────────
    "ubudiyet", "ibadet",
    "namaz", "salat",
    "oruç", "savm",
    "zekât", "hac",
    "dua", "niyaz", "münâcât",
    "zikir", "evrad",
    "tesbih", "tahmid", "tekbir",

    # ── HİKMET & HAKIKAT ──────────────────────────────────────────────────
    "hikmet", "maslahat",
    "hakikat", "gerçek",
    "marifet", "irfan",
    "ilim", "felsefe",
    "belagat", "fesahat",
    "remiz", "işaret", "ima",
    "mecaz", "temsil", "misal",
    "burhan", "hüccet", "delil",
    "kıyas", "istidlal",
    "bürhan-ı limmî", "bürhan-ı innî",

    # ── KÂİNAT & VARLIK ───────────────────────────────────────────────────
    "kâinat", "âlem",
    "varlık", "mevcudat",
    "zerre", "atom",
    "unsur", "cevher",
    "madde", "mana",
    "suret", "mahiyet",
    "vücud", "vücut",
    "adem", "yokluk",
    "mümkin", "vacip", "mümteni",
    "hudûs", "kıdem",

    # ── HAYAT & ÖLÜM ──────────────────────────────────────────────────────
    "hayat", "heyat",
    "mevt", "ölüm",
    "beka", "fena",
    "ebediyet", "sermediyet",
    "ihya", "diriliş",
    "haşir", "neşir",
    "mahşer", "mizan",
    "cennet", "cehennem",
    "şefaat",

    # ── NÜBÜVVET & RİSALET ────────────────────────────────────────────────
    "nübüvvet", "risalet", "velâyet",
    "vahiy", "vahy", "ilham",
    "mucize", "mucizat",
    "keramet",
    "sünnet", "hadis",
    "sünnet-i seniyye",
    "şeriat", "fıkıh",
    "Kur'an", "kuran",

    # ── CELAL & CEMAL ─────────────────────────────────────────────────────
    "celal", "celalî", "celil",
    "cemal", "cemalî", "cemil",
    "kemal", "kemalat",
    "sıfât-ı celâliye",
    "sıfât-ı cemaliye",

    # ── RAHMET & ŞEFKAT ───────────────────────────────────────────────────
    "rahmet", "merhame", "şefkat",
    "muhabbet", "aşk", "sevgi",
    "muhabbetullah", "aşk-ı ilahi",
    "rıfk", "lütuf", "atıfet",

    # ── RUBUBIYET TERKİBLERİ (ayrı kavramlar olarak) ─────────────────────
    "rububiyet-i ilahiye",
    "rububiyet-i mutlaka",
    "rububiyet-i umumiye",
    "uluhiyet-i mutlaka",
    "hakimiyet-i ezeliye",
    "hakimiyet-i mutlaka",
    "kudret-i mutlaka",
    "kudret-i ilahiye",
    "irade-i külliye",
    "irade-i cüziye",
    "ilm-i muhit",
    "ilm-i ezeli",
    "rahmet-i ilahiye",
    "rahmet-i umumiye",
    "cemal-i baki",
    "cemal-i sermedî",
    "celal-i ehadî",
    "kemal-i mutlak",
    "hayat-ı ebediye",
    "hayat-ı sermediye",
    "vücud-u vacibî",
    "tecelli-i ehadî",
    "tecelli-i samedî",

    # ── İNSAN & TOPLUM ────────────────────────────────────────────────────
    "insan", "beşer", "ins",
    "mümin", "kâfir",
    "münafık", "fasık",
    "mütefekkir", "âlim", "ârif",
    "ümmet", "millet",
    "uhuvvet", "kardeşlik",
    "tesanüt", "teavün",
    "ittifak", "ittihat",
    "adalet", "zulüm",
    "hürriyet", "istibdat",
    "meşveret", "şûra",
    "hak", "hukuk",
    "vazife", "hizmet",

    # ── AHLAK & ERDEM ─────────────────────────────────────────────────────
    "ahlak", "fazilet",
    "edep", "haya",
    "vefa", "sadakat",
    "emanet", "istikam",
    "istikamet", "hidayet",
    "tevazu", "mahviyet",
    "cömertlik", "sehâvet",
    "merhamet", "rikkat",
    "hased", "haset", "gıbta",
    "kibir", "tekebbür",
    "kin", "buğz",
    "fahr", "iftihar",

    # ── GAYRİ İSLAMİ ─────────────────────────────────────────────────────
    "küfür", "inkâr", "ilhad",
    "dalâlet", "sapkınlık",
    "günah", "isyan",
    "şirk", "müşrik",
    "münkir", "zındık",
    "sefahet", "gaflet",

    # ── TEFEKKÜR & MÜŞAHEDESİ ────────────────────────────────────────────
    "tefekkür", "teemmül", "tedebbür",
    "müşahede", "keşif", "seyir",
    "ibret", "ders",
    "nazar", "bakış",

    # ── KUR'AN BELAGATİ ───────────────────────────────────────────────────
    "icaz", "icaz-ı Kur'an",
    "beyan", "tebyin",
    "belagat", "fesahat",
    "nazm", "nazm-ı maani",
    "üslup", "tarz",
    "tefsir", "te'vil",

    # ── TASAVVUF KAVRAMLARI ────────────────────────────────────────────────
    "fenafillah", "bekabillah",
    "seyr-i süluk", "süluk",
    "velayet", "evliya",
    "zevk", "hal", "makam",
    "ilham", "keşif",
    "feyiz", "bereket",
    "berzah",
    "levh-i mahfuz",

    # ── ZİKİR & TESBIH ────────────────────────────────────────────────────
    "zikir", "tesbih", "tahmid",
    "tekbir", "tahlil",
    "salâvat",

    # ── RİSALE-İ NUR'A ÖZGÜ TERİMLER ────────────────────────────────────
    "nur", "nuraniyet",
    "külliyat", "risale",
    "ders", "sohbet",
    "talebe", "şakirt",
    "hizmet-i imaniye",
    "hizmet-i Kur'aniye",
    "medrese-i nuriye",
    "ittihad-ı İslam",
    "itikad", "akide",
    "kesinlik", "kat'iyet",
    "ihtiyat", "temkin",

    # ── BERZAH & HAŞIR ────────────────────────────────────────────────────
    "berzah", "kabir",
    "mahşer", "haşir",
    "ba's", "neşir",
    "mizan", "hesap",
    "sırat", "cennet", "cehennem",

    # ── KOZMOLOJİ ─────────────────────────────────────────────────────────
    "arş", "kürsî",
    "levh", "kalem",
    "sema", "semavat",
    "arz", "zemin",
    "güneş", "ay", "yıldız",
    "mevsim", "bahar",
    "nebat", "hayvan",

    # ── İLİM & İRFAN ──────────────────────────────────────────────────────
    "ilim", "irfan",
    "felsefe", "hikmet",
    "kelam", "mantık",
    "akl-ı selim",
    "kalb-i selim",

    # ── DEVLET & SİYASET ──────────────────────────────────────────────────
    "hilafet", "saltanat",
    "adalet", "meşrutiyet",
    "siyaset", "idare",
    "kanun", "hukuk",
]

# Tekrar ve kısa olanları temizle
RISALE_CONCEPTS = list(dict.fromkeys(
    [c.lower().strip() for c in RISALE_CONCEPTS if len(c.strip()) >= 3]
))
SEED_SET = set(RISALE_CONCEPTS)

# ─────────────────────────────────────────────────────────────────────────────
# ESMA-İ HÜSNA
# ─────────────────────────────────────────────────────────────────────────────

ESMA = [
    "Allah","Rahman","Rahim","Melik","Kuddüs","Selam",
    "Müheymin","Aziz","Cebbâr","Mütekebbir",
    "Hâlık","Bâri","Musavvir","Gaffâr","Kahhâr","Vehhâb",
    "Rezzâk","Fettâh","Alîm","Kâbız","Bâsıt",
    "Râfi","Muiz","Müzill","Semi","Basîr","Hakem","Adl",
    "Latîf","Habîr","Halîm","Azîm","Gafûr","Şekûr",
    "Alî","Kebîr","Mukît","Hasîb","Celîl","Kerîm",
    "Rakîb","Mücîb","Vâsi","Hakîm","Vedûd","Mecîd",
    "Bâis","Şehîd","Hak","Vekîl","Kavî","Metîn",
    "Velî","Hamîd","Muhsî","Mübdi","Muîd","Muhyî","Mümît",
    "Hay","Kayyûm","Vâcid","Mâcid","Vâhid","Ehad","Samed","Ferd",
    "Kâdir","Muktedir","Mukaddim","Muahhir",
    "Evvel","Âhir","Zâhir","Bâtın",
    "Vâlî","Müteâlî","Berr","Tevvâb","Afüvv","Raûf",
    "Muksit","Câmi","Ganî","Muğnî","Mâni",
    "Nûr","Hâdî","Bedî","Bâkî","Vâris","Reşîd","Sabûr",
    # Risale'de öne çıkan formlar
    "Kayyum","Ehad","Ferd","Hay",
    "Fâtır","Fettah","Rezzak",
    "Muhyi","Mümit","Bedi","Baki",
]
ESMA = list(dict.fromkeys([e for e in ESMA if len(e) >= 2]))

# ─────────────────────────────────────────────────────────────────────────────
# ANA TARAMA
# ─────────────────────────────────────────────────────────────────────────────

def scan_all():
    concept_chapter_counts = defaultdict(Counter)
    concept_cooc           = defaultdict(Counter)
    esma_chapter_counts    = defaultdict(Counter)
    global_izafet          = Counter()

    md_files = sorted(KULLIYAT_DIR.rglob("*.md"))
    total    = len(md_files)
    print(f"Toplam {total} MD dosyasi taranıyor…\n")

    for idx, md_path in enumerate(md_files, 1):
        book_slug, chap_slug = slug_from_path(md_path)
        key  = f"{book_slug}/{chap_slug}"
        text = read_md(md_path)
        if not text.strip():
            continue

        tokens = tokenize(text)
        print(f"[{idx:3}/{total}] {key} ({len(tokens)} token)", end="\r")

        # Kavram sayımı
        for concept in RISALE_CONCEPTS:
            cnt = concept_occurrences(concept, tokens)
            if cnt > 0:
                concept_chapter_counts[concept][key] = cnt

        # Eş-geçen kavramlar
        for concept in RISALE_CONCEPTS:
            if concept_chapter_counts[concept].get(key, 0) >= 3:
                co = cooccurrence_in_window(tokens, concept, SEED_SET)
                concept_cooc[concept].update(co)

        # Esma sayımı
        for esm in ESMA:
            cnt = concept_occurrences(esm.lower(), tokens)
            if cnt > 0:
                esma_chapter_counts[esm][key] = cnt

        # İzafet tamlamaları (v2)
        global_izafet.update(extract_izafet(text))

    print(f"\n\nTarama tamamlandı. {total} dosya islendi.")
    return concept_chapter_counts, concept_cooc, esma_chapter_counts, global_izafet

# ─────────────────────────────────────────────────────────────────────────────
# ÇIKTI ÜRETME
# ─────────────────────────────────────────────────────────────────────────────

def build_concept_index(concept_counts, concept_cooc):
    index = {}
    for concept in RISALE_CONCEPTS:
        chapter_map = concept_counts.get(concept, {})
        if not chapter_map:
            continue
        top_chapters = sorted(chapter_map.items(), key=lambda x: x[1], reverse=True)[:15]
        total_count  = sum(chapter_map.values())
        co           = concept_cooc.get(concept, Counter())
        top_co       = [term for term, _ in co.most_common(12)]
        index[concept] = {
            "toplam_gecis"          : total_count,
            "bolum_sayisi"          : len(chapter_map),
            "en_yogun_bolumler"     : [{"bolum": c, "sayi": s} for c, s in top_chapters],
            "birlikte_gecen_kavramlar": top_co,
        }
    return dict(sorted(index.items(), key=lambda x: x[1]["toplam_gecis"], reverse=True))


def build_esma_index(esma_counts):
    index = {}
    for esm in ESMA:
        chapter_map = esma_counts.get(esm, {})
        if not chapter_map:
            continue
        top_chapters = sorted(chapter_map.items(), key=lambda x: x[1], reverse=True)[:10]
        index[esm] = {
            "toplam"           : sum(chapter_map.values()),
            "bolum_sayisi"     : len(chapter_map),
            "en_yogun_bolumler": [{"bolum": c, "sayi": s} for c, s in top_chapters],
        }
    return dict(sorted(index.items(), key=lambda x: x[1]["toplam"], reverse=True))


def build_concept_families(concept_index):
    """Mevcut concept_families.json varsa onu güncelle, yoksa sıfırdan oluştur."""
    cf_path = OUT_DIR / "concept_families.json"
    existing = {}
    if cf_path.exists():
        try:
            existing = json.loads(cf_path.read_text(encoding="utf-8"))
        except Exception:
            existing = {}

    for concept, data in concept_index.items():
        if concept in existing:
            # Sadece otomatik alanları güncelle, elle doldurulanları koru
            existing[concept]["co_occurring"]  = data["birlikte_gecen_kavramlar"][:6]
            existing[concept]["related"]        = data["birlikte_gecen_kavramlar"][6:12]
            # kok_risale: elle girilmişse (aliases doluysa) ÜSTÜNE YAZMA
            existing_kok = existing[concept].get("kok_risale", "")
            existing_aliases = existing[concept].get("aliases", [])
            auto_kok = data["en_yogun_bolumler"][0]["bolum"] if data["en_yogun_bolumler"] else ""
            if not existing_aliases:
                # Alias yok → otomatik üretilmiş, güncelle
                existing[concept]["kok_risale"] = auto_kok
            elif not existing_kok:
                # Alias var ama kok yoktu → otomatiği yaz
                existing[concept]["kok_risale"] = auto_kok
            # else: alias de var, kok da var → elle girilmiş, dokunma
            existing[concept]["_toplam_gecis"]  = data["toplam_gecis"]
        else:
            co = data["birlikte_gecen_kavramlar"]
            existing[concept] = {
                "aliases"      : [],
                "co_occurring" : co[:6],
                "antonyms"     : [],
                "related"      : co[6:12],
                "kok_risale"   : (
                    data["en_yogun_bolumler"][0]["bolum"]
                    if data["en_yogun_bolumler"] else ""
                ),
                "word_boundary": True,
                "_toplam_gecis": data["toplam_gecis"],
                "_note"        : "auto-generated — aliases/antonyms elle tamamlanmali",
            }
    return existing

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def safe_print(s):
    try:
        print(s)
    except UnicodeEncodeError:
        print(s.encode("ascii", "replace").decode("ascii"))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not KULLIYAT_DIR.exists():
        print(f"HATA: {KULLIYAT_DIR} bulunamadı")
        return

    cc, cooc, ec, iz = scan_all()

    ci = build_concept_index(cc, cooc)
    ei = build_esma_index(ec)
    cf = build_concept_families(ci)

    safe_print(f"\n{'='*60}")
    safe_print(f"KAVRAM INDEKSI  : {len(ci)} kavram")
    safe_print(f"ESMA INDEKSI    : {len(ei)} isim")
    safe_print(f"IZAFET TAMLAMASI: {len(iz)} benzersiz form")
    safe_print(f"{'='*60}")

    safe_print("\nEn sik 20 kavram:")
    for c, d in list(ci.items())[:20]:
        co3 = str(d["birlikte_gecen_kavramlar"][:3]).encode("ascii","replace").decode()
        safe_print(f"  {c:<30} toplam={d['toplam_gecis']:>5}  bolum={d['bolum_sayisi']:>3}  es={co3}")

    safe_print("\nEn sik 10 Esma:")
    for e, d in list(ei.items())[:10]:
        top = d["en_yogun_bolumler"][0]["bolum"] if d["en_yogun_bolumler"] else "-"
        safe_print(f"  {e:<15} toplam={d['toplam']:>5}  en yogun={top}")

    safe_print("\nEn sik 20 izafet tamlamasi (v2 - hyphen dahil):")
    for term, cnt in iz.most_common(20):
        safe_print(f"  {term.encode('ascii','replace').decode():<50} {cnt:>4}")

    if args.dry_run:
        safe_print("\n--dry-run: dosyalar yazılmadı.")
        return

    ci_path = OUT_DIR / "concept_index.json"
    ei_path = OUT_DIR / "esma_index.json"
    cf_path = OUT_DIR / "concept_families.json"
    iz_path = OUT_DIR / "izafet_index.json"

    ci_path.write_text(json.dumps(ci, ensure_ascii=False, indent=2), encoding="utf-8")
    ei_path.write_text(json.dumps(ei, ensure_ascii=False, indent=2), encoding="utf-8")
    cf_path.write_text(json.dumps(cf, ensure_ascii=False, indent=2), encoding="utf-8")
    iz_path.write_text(
        json.dumps(dict(iz.most_common(1000)), ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    safe_print(f"\nDosyalar yazıldı: {OUT_DIR}")

if __name__ == "__main__":
    main()
