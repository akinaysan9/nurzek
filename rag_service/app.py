import os
import pickle
import time
import logging
import json
import re
from typing import List, Optional, AsyncGenerator
from rank_bm25 import BM25Okapi
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from collections import Counter
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
from openai import OpenAI
from dotenv import load_dotenv
from conversations import router as conv_router
from database import get_db
import uuid
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
load_dotenv()

app = FastAPI(title="NurZeka V2 API")
app.include_router(conv_router)

# --- Auth Middleware ---
# Bu middleware her isteği yakalar, token'ı doğrular ve user_id'yi request.state'e ekler.
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Public endpoint'ler — token gerekmez
    PUBLIC_PATHS = ["/api/login", "/api/register", "/static", "/docs", "/openapi.json"]

    path = request.url.path
    if path == "/" or any(path.startswith(p) for p in PUBLIC_PATHS):
        return await call_next(request)

    # Node.js proxy'den gelen X-User-Id header'ı (JWT çözümlenmiş gerçek user_id)
    x_user_id = request.headers.get("x-user-id")
    if x_user_id:
        request.state.user_id = x_user_id
        return await call_next(request)

    # Doğrudan Python'a gelen istekler için fallback
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else None

    if not token:
        return await call_next(request)

    try:
        request.state.user_id = token
    except Exception:
        pass

    return await call_next(request)

# --- Configuration ---
INDEX_PATH = "risale_index.faiss"
METADATA_PATH = "risale_metadata.pkl"
BM25_INDEX_PATH = "bm25_index.pkl"
ALIAS_MAP_PATH = "alias_map.json"
EMBEDDING_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
deepseek_client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")

# Constants
SIMILARITY_THRESHOLD = 0.27
TOP_K = 5
MULTI_QUERY_COUNT = 3
CANDIDATES_PER_QUERY = 5
RERANK_TOP_K = 5
CHAPTER_TO_BOOK_SLUG = {}
BOOK_SLUGS = {
    "Sözler": "sozler",
    "Mektubat": "mektubat",
    "Lem'alar": "lemalar",
    "Şualar": "sualar",
    "Mesnevi-i Nuriye": "mesnevi-i-nuriye",
    "Barla Lahikası": "barla-lahikasi",
    "Kastamonu Lahikası": "kastamonu-lahikasi",
    "Emirdağ Lahikası I": "emirdag-lahikasi-i",
    "Emirdağ Lahikası II": "emirdag-lahikasi-ii",
    "Tarihçe-i Hayat": "tarihce-i-hayat",
    "Asâ-yı Musa": "asa-yi-musa",
    "İşaratü'l-İ'caz": "isaratul-icaz",
    "Sikke-i Tasdik-i Gaybî": "sikke-i-tasdik-i-gaybi",
    "Muhakemat": "muhakemat"
}

# Risale'ye özgü stop word listesi
STOP_WORDS = {
    # Bağlaçlar ve edatlar
    "içinde", "dışında", "işte", "mesela", "yani", "gibi",
    "kadar", "göre", "için", "bile", "dahi", "ise", "ile",
    "ve", "veya", "ama", "fakat", "ancak", "ki", "da", "de",
    "bir", "bu", "şu", "o", "her", "hiç", "çok", "daha",
    # Fiil kökleri
    "edip", "eder", "etmek", "olan", "olup", "olarak", "olmak",
    "gösterir", "gelir", "gider", "alır", "verir", "der", "dedi", "diyor",
    # Diğer anlamsız kelimeler
    "nihayet", "hükmünde", "birisi", "kendisi", "kendine",
    "şekilde", "tarzda", "surette", "veçhile", "itibarıyla", "kendi",
    # Ekstra (Test sonrası)
    "evet", "elbette", "çünkü", "zat-ı", "üçüncü", "birinci", "ikinci", "dördüncü",
    "beşinci", "altıncı", "yedinci", "sekizinci", "dokuzuncu", "onuncu",
    "risale-i", "risale", "kur'an", "kuran", "kuran'ın", "kur'an'ın",
    "bütün", "tam", "hiçbir", "yok", "var", "olan", "olmayan", "ile", "için", "dolayı",
    "hem", "nasıl", "niçin", "neden", "kim", "hangi", "herkes", "biri",
    "ona", "buna", "şuna", "ondan", "bundan", "şundan", "sonra", "önce", "üzere",
    "madem", "i̇şte", "cenab-ı", "rahman-ı", "hâlık", "rahîm", "hâlık'ın", "rahman", "cenab",
    "acaba", "sözler", "mektubat", "lem'alar", "şualar", "mesnevi-i", "nurlara", "nur", "nurlar",
    "risalesi", "hazret", "risalesinde", "risalelerde", "üstad", "bediüzzaman", "said", "nursi",
    "risaletü'n-nur", "risale-inur", "risaletü'n", "risaleler",
    "mesnevi", "nuriye", "lahika", "barla", "kastamonu", "emirdağ", "tarihçe", "muhakemat", "münazarat",
    "söz", "mektup", "lema", "şua", "mesele", "makam", "zeyl", "haşiye", "lem'a", "sikke", "gaybî",
    "aleviye", "tasdik", "risaletün"
}

# Initialize Clients
client = OpenAI(
    api_key=DEEPSEEK_API_KEY or "sk-placeholder", 
    base_url="https://api.deepseek.com"
)

# V2 SYSTEM PROMPT
SYSTEM_PROMPT = """Sen "Nur Zekâ"sın.

Risale-i Nur Külliyatı'nın tamamına — Sözler, Mektubat, Lem'alar, Şualar,
Mesnevi-i Nuriye ve Lahikalar'a — derinlemesine vakıf; Kur'an'ın tefsir
metodolojisini, bilhassa "nazm" (kavramların dizilişindeki anlam) ilmini
bilen ve bu ilmi dijital bir müzakere ortamına taşıyan bir şarih ve
analistsin.

Görevin yalnızca bilgi aktarmak değil; metni okuyucunun önünde açmak,
kavramların içindeki gizli mimariye ışık tutmak ve bu hakikatlerin bugünkü
insan için ne anlam ifade ettiğini keşfettirmektir.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## I. EPİSTEMOLOJİK TEMEL: KAYNAĞA BAĞLILIK

Sana CONTEXT BLOCK içinde külliyat metinleri verilir. Cevabın bu metinlere
dayanır. Her çıkarımını metinden bir alıntıyla desteklersin.

Genel bilgi üretme. Tahmin yürütme.

Bir atıf veya alıntı yaparken o ifade kelimesi kelimesine CONTEXT BLOCK içinde geçmiyorsa asla alıntıymış gibi sunma. 'Bediüzzaman şöyle der:' kalıbını yalnızca context'te birebir bulunan ifadeler için kullan. Eğer kavram context'te işlenmiş ama o exact ifade yoksa 'bu metinde şu anlam öne çıkıyor' gibi yorumlayıcı bir dille sun, alıntı formatında değil.

Metinden beslenmeyen her cümle,
tefekkürün değil hayal gücünün ürünüdür — bu sisteme yabancıdır.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## II. METİN OKUMA METODOLOJİN: BEŞ KATMAN

Her metni bu beş katmanda analiz edersin:

### KATMAN 1 — NAZM: Kavramların Diziliş Sırası
Risale'deki her kavram sırası kasıtlıdır — Kur'an'ın nazm ilminden mülhem.
"Acz → Fakr → Şükür → Tefekkür" sırası rastlantı değildir; her kavram
bir sonrakinin kapısını açar. Bu sırayı tespit et ve neden böyle sıralandığını
açıkla. Sıranın kendisi bir argümandır.

### KATMAN 2 — TEMSİL → HAKİKAT → TATBİK ÜÇGENI
Bediüzzaman her büyük hakikati üç adımda sunar:
  a) TEMSİL: Bir analoji, mecaz veya somut örnek verir
  b) HAKİKAT: "İşte bunun gibi..." diyerek soyut gerçeğe geçer
  c) TATBİK: Bazen pratik hayata uygular

Bu üçgeni her metinde tespit et. Temsilin hangi hakikatin anahtarı
olduğunu göster. Cevabını da bu yapıyla kur.

### KATMAN 3 — DİYALEKTİK YAPI: İddia → İtiraz → Cevap
Bediüzzaman her büyük iddiasını bir itirazla sınar:
  "Vehim:" / "Sual:" / "İ'tiraz:" ile başlayan kısımlar bu itirazlardır.
  Sonraki "Cevap:" / "Elcevap:" ise hakikatin sınanmış halidir.

Bu yapıyı fark et. Kullanıcının sorusunda gizli bir itiraz varsa onu da
yüzeye çıkar ve Bediüzzaman'ın metodu gibi hem soruyu hem karşı-soruyu
birlikte cevapla.

### KATMAN 4 — KÜLLİYAT İÇİ ÇAPRAZ REFERANS
Hiçbir kavram Risale'de tek bir yerde işlenmez. "Ene" 30. Söz'de bir
boyutuyla, Mesnevi-i Nuriye'de başka bir boyutuyla, Şualar'da farklı
bir tezahürüyle karşımıza çıkar. Context'teki metin hangi külliyat
bölümünden geliyorsa, o kavramın diğer bölümlerdeki yankısını da —
eğer context'te mevcutsa — bağlaştır. Bağlantı yoksa işaret et:
"Bu mesele [diğer bölüm adı]'nda farklı bir pencereden ele alınır."

### KATMAN 5 — TERMİNOLOJİ HARİTASI
Osmanlıca ve Arapça terimleri üç boyutuyla sun:
  • Sözlük anlamı (kelimenin aslı)
  • Risale'deki teknik anlamı (nasıl kullanılıyor)
  • Modern karşılığı (bugünkü insanın dünyasında ne demek)

Örnek:
"Vahidiyet" → sözlükte "birlik", Risale'de "Allah'ın isimlerinin kâinatta
toplu tezahürü", modern karşılığı "evrensel yasaların tek kaynağa işaret
etmesi".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## III. CEVAP YAPISI: AKAN NESİR, ROBOTIK BAŞLIK YOK

Cevabını numaralı başlıklar ve maddeler olarak değil; akan, nefes alan,
birbiriyle konuşan paragraflar olarak yaz. İlim meclisinde konuşur gibi.

Takip edeceğin iç sıra (ama bunu başlık olarak gösterme):

1. Metinden vurucu bir alıntıyla başla — hemen ardından [Kitap, Bölüm] yaz
2. O metindeki nazm sırasını ve temsil-hakikat köprüsünü açık et
3. Kavramların birbirine nasıl kapı açtığını göster
4. Külliyat içi bağlantıyı kur (context'te varsa)
5. Terminolojiyi doğal şekilde aç
6. Modern insanın dünyasına bir köprü kur — soyut kalma, elle tutulur ol
7. Gerekirse diyalektik yap: gizli itirazı yüzeye çıkar ve cevapla

Uzunluk: 450–650 kelime. Ne özet ne deneme — tefekkür.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## IV. ÜSLUP VE TON

• Alıntılar daima "tırnak içinde", hemen ardından [Kitap — Bölüm] ile
• Osmanlıca terim ilk kullanımda parantez içinde açıklanır, sonra serbestçe kullanılır
• Kendi görüşünü sunmak yerine metnin görüşünü keşfettir — "görüyoruz ki",
  "Bediüzzaman burada şunu gösteriyor" gibi
• Kullanıcıya öğretme — onunla birlikte metni gez, onu metnin içine al
• Uzun listeler ve maddeler kullanma — her fikir bir paragrafta nefes alsın

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## V. ÖZEL DURUMLAR

### Kullanıcı Kısa / Net Bir Tanım Sorarsa
"İman nedir?" gibi doğrudan sorularda önce kısa ve güçlü bir metin alıntısı,
sonra o alıntının açılımı. Uzun şerhe gerek yok — derinlik, uzunlukta değil.

### Kullanıcı Kendi Yorumunu Getirirse
"Bence bu metin şunu söylüyor..." derse: önce onun yorumunu ciddiye al,
sonra metinden destek veya düzeltme sun. "Haklısınız, şu ifade bunu
doğruluyor" ya da "Şu metin bize farklı bir yön gösteriyor" de.

### Kullanıcı Uzun Bir Metin Gönderirse
Retrieval'a gerek yok — doğrudan o metni analiz et. "Bu metni
birlikte okuyalım..." diyerek başla.

### İki Kavramı Karşılaştırma
"Vahidiyet ile Ehadiyet farkı nedir?" gibi sorularda her kavramı önce
kendi bağlamında tanı, sonra Bediüzzaman'ın ikisini nasıl ilişkilendirdiğini
göster. Karşıtlık değil, tamamlayıcılık vurgula.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## VI. SNAP ANI VE AÇIK UÇLU SORU

Her cevabın sonunda, kullanıcının kendi aklıyla bir adım daha atmasını
sağlayacak tek bir açık uçlu soru sor. Bu soru:

- Dogmatik değil, keşifsel olsun — "doğru cevap" bekleme
- Metinden organik doğsun — sonradan yapıştırılmış gibi durmasın
- Kullanıcıyı metne değil, kendi tecrübesine veya düşüncesine yöneltsin
- Kısa ve keskin olsun — tek cümle, fazlası değil

Örnek: "Peki sence Bediüzzaman 'acz'i neden 'fakr'dan önce zikrediyor —
bu sıra senin için ne değiştirir?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## VII. ÇAPRAZ MEDENİYET KÖPRÜSÜ

Uygun bağlamlarda — kullanıcı doğrudan sormasa bile — ele alınan kavramın
İslam dışı düşünce geleneklerindeki yankısını kur. Bu köprü zorunlu değil,
organik olduğunda kurulsun.

Kaynak havuzu:
- İslam Klasikleri: Gazali (İhya), İbn Arabi (Fusus), Mevlana (Mesnevi)
- Batı Felsefesi: Spinoza, Kant, Kierkegaard, Heidegger
- Edebiyat: Goethe (Faust), Dostoyevski, Dante
- Psikoloji: Jung (gölge / kendilik), Frankl (anlam), Maslow
- Stoacılık: Epiktetos, Marcus Aurelius

Sunum kuralları:
- Uyuşan fikir: "Goethe de Faust'ta benzer bir gerilimi işler —
  insanın içindeki karanlık güç yok edilemez, dönüştürülür."
- Tezat fikir: "Nietzsche burada tam karşı cephede durur — acz değil,
  güç iradesi. Bu farkın kaynağı nedir sence?"
- Tarafsız kal — "Bediüzzaman haklı, Nietzsche yanılıyor" deme,
  farkı göster, soruyu kullanıcıya bırak
- En fazla bir karşılaştırma per cevap — çok sayıda isim sıralama

Açıklamalarını yaparken sadece sana verilen metinlere sadık kal. Her önemli bilgi veya yorumdan sonra, o bilginin geldiği kaynağı mutlaka [[Kitap Adı, Bölüm Adı]] formatında tam olarak belirt. Kendi genel bilgilerinden veya sunulan metinlerde bulunmayan kaynaklardan atıf yapma.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTEXT BLOCK:
{context}
"""

# --- Global State ---
class GlobalState:
    embedding_model: Optional[SentenceTransformer] = None
    index: Optional[faiss.Index] = None
    chunks: Optional[List[dict]] = None
    bm25_index: Optional[BM25Okapi] = None
    alias_map: dict = {}
    section_chunk_index: dict = {}  # section_name -> [chunk_indices]

state = GlobalState()

# --- Helpers ---
def load_alias_map():
    if os.path.exists(ALIAS_MAP_PATH):
        with open(ALIAS_MAP_PATH, 'r', encoding='utf-8') as f:
            state.alias_map = json.load(f)

def normalize_query(query: str) -> str:
    query_lower = query.lower()
    for key, val in state.alias_map.items():
        if key in query_lower:
            return query_lower.replace(key, val)
    return query

def get_temperature(question: str) -> float:
    q = question.lower()
    if any(k in q for k in ["nedir", "ne demek", "tanımla"]): return 0.2
    if any(k in q for k in ["nasıl", "neden", "anlat", "açıkla"]): return 0.35
    if any(k in q for k in ["bağlantı", "ilişki", "fark", "karşılaştır"]): return 0.4
    if any(k in q for k in ["günümüz", "modern", "bugün", "hayatımız"]): return 0.45
    return 0.3

def to_slug(text: str) -> str:
    text = str(text or "").lower()
    text = text.replace('ğ', 'g').replace('ü', 'u').replace('ş', 's')
    text = text.replace('ı', 'i').replace('ö', 'o').replace('ç', 'c')
    text = text.replace('â', 'a').replace('î', 'i').replace('û', 'u')
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'\s+', '-', text.strip())
    return text

def prettify_chapter_name(value: str) -> str:
    name = str(value or '').replace('.md', '').replace('-', ' ').strip()
    parts = name.split()
    if parts and parts[0].isdigit():
        parts = parts[1:]
    return ' '.join(parts).title() if parts else 'Belirtilmemiş'

def strip_frontmatter(text: str) -> str:
    return re.sub(r'^---[\s\S]*?---\s*', '', text or '').strip()

def is_unknown_value(value: Optional[str]) -> bool:
    if value is None:
        return True
    normalized = str(value).strip().lower()
    return normalized in {'', 'unknown', 'none', 'null', 'n/a', 'belirtilmemis'}

def pick_first_valid(*values, fallback: str = 'Belirtilmemiş') -> str:
    for value in values:
        if not is_unknown_value(value):
            return str(value).strip()
    return fallback

def get_chunk_book_and_section(chunk: dict) -> tuple:
    metadata = chunk.get('metadata', {})
    source_path = str(metadata.get('source') or chunk.get('source') or '')
    chapter_slug = os.path.basename(source_path).replace('.md', '')

    kitap = pick_first_valid(
        metadata.get('kitap'),
        metadata.get('book'),
        metadata.get('book_name'),
        chunk.get('kitap'),
        chunk.get('book'),
        chunk.get('book_name')
    )

    bolum_adi = pick_first_valid(
        metadata.get('bolum_adi'),
        metadata.get('chapter'),
        metadata.get('section'),
        metadata.get('title'),
        metadata.get('chapter_title'),
        metadata.get('bolum'),
        chunk.get('bolum_adi'),
        chunk.get('chapter'),
        chunk.get('section'),
        chunk.get('title'),
        chunk.get('chapter_title'),
        chunk.get('bolum'),
        fallback='Belirtilmemiş'
    )

    if not chapter_slug and not is_unknown_value(bolum_adi):
        chapter_slug = to_slug(bolum_adi)

    if (is_unknown_value(bolum_adi) or bolum_adi == 'Belirtilmemiş') and chapter_slug:
        bolum_adi = prettify_chapter_name(chapter_slug)

    return kitap, bolum_adi

def get_chunk_source_label(chunk: dict) -> str:
    kitap, bolum_adi = get_chunk_book_and_section(chunk)
    return f"{kitap}, {bolum_adi}"

def extract_source_labels_from_answer(answer_text: str) -> list:
    if not answer_text:
        return []

    matches = re.findall(r'\[\[\s*([^\[\]]+?)\s*\]\]', answer_text)
    labels = []
    seen = set()
    for match in matches:
        candidate = re.sub(r'^KAYNAK ETİKETİ\s*:\s*', '', match, flags=re.IGNORECASE).strip()
        if ',' not in candidate:
            continue
        if candidate not in seen:
            seen.add(candidate)
            labels.append(candidate)
    return labels

def strip_source_labels_from_answer(answer_text: str) -> str:
    if not answer_text:
        return ''

    cleaned = re.sub(r'\s*\[\[\s*[^\[\]]+?\s*\]\]', '', answer_text)
    cleaned = re.sub(r'\s{2,}', ' ', cleaned)
    cleaned = re.sub(r'\s+([,.;:!?])', r'\1', cleaned)
    return cleaned.strip()

def select_source_chunks_from_labels(answer_text: str, ordered_chunks: list) -> list:
    if not answer_text or not ordered_chunks:
        return []

    requested_labels = extract_source_labels_from_answer(answer_text)
    if not requested_labels:
        return []

    chunk_map = {}
    for chunk in ordered_chunks:
        label = get_chunk_source_label(chunk)
        if label not in chunk_map:
            chunk_map[label] = chunk

    matched_chunks = []
    for label in requested_labels:
        chunk = chunk_map.get(label)
        if chunk is not None:
            matched_chunks.append(chunk)
    return matched_chunks

def build_source_payload(chunks: list) -> list:
    sources = []

    for chunk in chunks:
        metadata = chunk.get('metadata', {})
        raw_text = strip_frontmatter(chunk.get('text', ''))
        pasaj = re.sub(r'\s+', ' ', raw_text).strip()
        pasaj = pasaj[:280] + ('...' if len(pasaj) > 280 else '')

        source_path = str(metadata.get('source') or chunk.get('source') or '')
        chapter_slug = os.path.basename(source_path).replace('.md', '')

        kitap, bolum_adi = get_chunk_book_and_section(chunk)

        book_slug = CHAPTER_TO_BOOK_SLUG.get(chapter_slug) or metadata.get('book_slug') or chunk.get('book_slug') or BOOK_SLUGS.get(kitap) or to_slug(kitap)

        sources.append({
            'chunk_id': chunk.get('id') or metadata.get('id') or '',
            'kitap': kitap,
            'bolum_adi': bolum_adi,
            'book_slug': book_slug,
            'chapter_slug': chapter_slug,
            'pasaj': pasaj,
            'book': kitap,
            'section': bolum_adi,
            'excerpt': pasaj
        })

    return sources

def build_context(chunks: list, max_tokens: int = 5000) -> str:
    # Epistemological sort: by original order index
    sorted_chunks = sorted(chunks, key=lambda x: x.get('metadata', {}).get('original_order_index', 0))
    
    context_parts = []
    total_tokens = 0
    
    for chunk in sorted_chunks:
        kaynak_etiketi = get_chunk_source_label(chunk)
        metin = chunk['text'].strip()

        block = f"[[KAYNAK ETİKETİ: {kaynak_etiketi}]]\n{metin}\n"
        
        estimated_tokens = len(block.split()) * 1.3
        if total_tokens + estimated_tokens > max_tokens:
            break
            
        context_parts.append(block)
        total_tokens += estimated_tokens
        
    return "\n\n---\n\n".join(context_parts)

GRAPH_NEIGHBOR_LIMIT = 2  # Max extra chunks to add from citation neighbors

def tokenize_for_bm25(text: str) -> list[str]:
    return re.findall(r"[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû0-9']+", (text or "").lower())

def minmax_normalize(score_map: dict, invert: bool = False) -> dict:
    if not score_map:
        return {}
    values = list(score_map.values())
    min_v = min(values)
    max_v = max(values)
    if max_v == min_v:
        return {k: 1.0 for k in score_map.keys()}
    normalized = {k: (v - min_v) / (max_v - min_v) for k, v in score_map.items()}
    if invert:
        normalized = {k: 1.0 - v for k, v in normalized.items()}
    return normalized

def retrieve_chunks(query: str, top_k: int = TOP_K, book_hint: Optional[str] = None, chapter_hint: Optional[str] = None) -> list:
    if not state.index: return []

    query_embedding = state.embedding_model.encode([query], convert_to_numpy=True)

    # 1) FAISS top-10 (distance: lower is better)
    faiss_distances, faiss_indices = state.index.search(query_embedding, 10)
    faiss_raw = {}
    for score, idx in zip(faiss_distances[0], faiss_indices[0]):
        if idx == -1:
            continue
        faiss_raw[int(idx)] = float(score)

    # 2) BM25 top-10 (score: higher is better)
    bm25_raw = {}
    if state.bm25_index is not None:
        query_tokens = tokenize_for_bm25(query)
        bm25_scores = state.bm25_index.get_scores(query_tokens)
        top_bm25_indices = np.argsort(bm25_scores)[::-1][:10]
        for idx in top_bm25_indices:
            bm25_raw[int(idx)] = float(bm25_scores[idx])

    # 3) Normalize and combine: 0.5 FAISS + 0.5 BM25
    faiss_norm = minmax_normalize(faiss_raw, invert=True)
    bm25_norm = minmax_normalize(bm25_raw, invert=False)

    candidate_indices = set(faiss_norm.keys()) | set(bm25_norm.keys())
    combined_scores = {}
    for idx in candidate_indices:
        combined_scores[idx] = 0.5 * faiss_norm.get(idx, 0.0) + 0.5 * bm25_norm.get(idx, 0.0)

    ranked_candidates = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)

    results = []
    for idx, combined in ranked_candidates:
        if idx < 0 or idx >= len(state.chunks):
            continue
        chunk = state.chunks[idx].copy()

        # Kitap/bölüm hint önceliği
        priority_multiplier = 1.0
        if book_hint:
            chunk_book = chunk.get('metadata', {}).get('book', chunk.get('book', '')).lower()
            hint_book = book_hint.lower()
            if hint_book in chunk_book or chunk_book in hint_book:
                priority_multiplier = 1.2
        if chapter_hint:
            chunk_chapter = chunk.get('metadata', {}).get('chapter', chunk.get('chapter', '')).lower()
            hint_chapter = chapter_hint.lower()
            if hint_chapter in chunk_chapter or chunk_chapter in hint_chapter:
                priority_multiplier = max(priority_multiplier, 1.3)

        chunk['_score'] = combined * priority_multiplier
        results.append(chunk)

    results.sort(key=lambda x: x.get('_score', 0.0), reverse=True)
    results = results[:top_k]

    # --- Citation-graph neighbor expansion ---
    # Collect neighbor sections cited by or citing the retrieved chunks
    neighbor_sections = set()
    for chunk in results:
        meta = chunk.get('metadata', {})
        for sec in meta.get('cites', []):
            neighbor_sections.add(sec)
        for sec in meta.get('cited_by', []):
            neighbor_sections.add(sec)

    # Remove sections already present in results
    retrieved_sections = {get_chunk_book_and_section(c)[1] for c in results}
    neighbor_sections -= retrieved_sections
    neighbor_sections.discard('')
    neighbor_sections.discard('Belirtilmemiş')

    if neighbor_sections and state.section_chunk_index:
        # Collect candidate chunk indices from neighbor sections
        candidate_indices = []
        for sec in neighbor_sections:
            candidate_indices.extend(state.section_chunk_index.get(sec, []))

        if candidate_indices:
            # Score by L2 distance to query embedding
            qvec = query_embedding[0]
            scored = []
            for i in candidate_indices:
                try:
                    vec = state.index.reconstruct(i)
                    dist = float(np.sum((qvec - vec) ** 2))
                    scored.append((dist, i))
                except Exception:
                    continue
            scored.sort(key=lambda x: x[0])

            # Add top-2 best-scoring neighbors, one per section
            seen_neigh_sections = set()
            for dist, i in scored:
                if len(seen_neigh_sections) >= GRAPH_NEIGHBOR_LIMIT:
                    break
                sec = get_chunk_book_and_section(state.chunks[i])[1]
                if sec in seen_neigh_sections:
                    continue
                seen_neigh_sections.add(sec)
                neighbor_chunk = state.chunks[i].copy()
                neighbor_chunk['_score'] = dist
                neighbor_chunk['_graph_neighbor'] = True
                results.append(neighbor_chunk)

    return results

def parse_json_payload(raw_text: str, fallback):
    try:
        cleaned = re.sub(r'```json|```', '', raw_text or '').strip()
        return json.loads(cleaned)
    except Exception:
        return fallback

def dedupe_chunks(chunks: list) -> list:
    seen = set()
    deduped = []
    for chunk in chunks:
        chunk_id = chunk.get('id') or chunk.get('metadata', {}).get('id') or chunk.get('metadata', {}).get('source') or chunk.get('source')
        if not chunk_id:
            chunk_id = id(chunk)
        if chunk_id in seen:
            continue
        seen.add(chunk_id)
        deduped.append(chunk)
    return deduped

def generate_multi_queries(question: str, book_hint: Optional[str] = None, chapter_hint: Optional[str] = None) -> list:
    hint_parts = []
    if book_hint:
        hint_parts.append(f"Kitap ipucu: {book_hint}")
    if chapter_hint:
        hint_parts.append(f"Bölüm ipucu: {chapter_hint}")
    hint_block = "\n".join(hint_parts) if hint_parts else "Ek ipucu yok."

    prompt = f"""
Kullanıcı sorusu:
{question}

{hint_block}

Görev:
Bu soruyu Risale-i Nur içinde aramak için 3 farklı arama sorgusu üret.
Sorgular kısa, aranabilir ve bölüm/risale isimlerini içermeye elverişli olsun.
Mümkünse ilgili risale/bölüm adlarını da dahil et.

Sadece şu JSON formatında cevap ver:
{{"queries": ["sorgu1", "sorgu2", "sorgu3"]}}
"""

    try:
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            stream=False,
            temperature=0.1
        )
        payload = parse_json_payload(response.choices[0].message.content, {"queries": []})
        queries = [str(q).strip() for q in payload.get("queries", []) if str(q).strip()]
    except Exception as exc:
        logging.warning(f"Multi-query generation failed: {exc}")
        queries = []

    base_query = normalize_query(question)
    merged = [base_query]
    for query in queries:
        if query not in merged:
            merged.append(query)
    return merged[:MULTI_QUERY_COUNT]

def rerank_chunks_with_llm(question: str, chunks: list) -> tuple[list, bool]:
    if not chunks:
        return [], False

    candidate_blocks = []
    for idx, chunk in enumerate(chunks[:15], start=1):
        label = get_chunk_source_label(chunk)
        excerpt = re.sub(r'\s+', ' ', strip_frontmatter(chunk.get('text', ''))).strip()[:420]
        candidate_blocks.append(
            f"[ADAY {idx}]\nKAYNAK: {label}\nMETİN: {excerpt}"
        )

    prompt = f"""
Kullanıcı sorusu:
{question}

Aşağıda 15 adaya kadar pasaj var. Yalnızca doğrudan bu soruyla alakalı olan pasajları seç.
Eğer doğrudan alakalı pasaj yoksa relevant=false dön.
Varsa en alakalı en fazla 5 adayın ADAY numarasını seç.
Zorlama yorum yapma; konu dışı pasajları seçme.

Sadece şu JSON formatında cevap ver:
{{"relevant": true, "selected_ids": [1,2,3], "reason": "kısa açıklama"}}

Pasajlar:
{chr(10).join(candidate_blocks)}
"""

    try:
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            stream=False,
            temperature=0.0
        )
        payload = parse_json_payload(response.choices[0].message.content, {"relevant": False, "selected_ids": []})
        relevant = bool(payload.get("relevant"))
        selected_ids = []
        for item in payload.get("selected_ids", []):
            try:
                candidate_id = int(item)
            except Exception:
                continue
            if 1 <= candidate_id <= min(len(chunks), 15) and candidate_id not in selected_ids:
                selected_ids.append(candidate_id)
        selected_chunks = [chunks[i - 1] for i in selected_ids[:RERANK_TOP_K]]
        return selected_chunks, relevant and len(selected_chunks) > 0
    except Exception as exc:
        logging.warning(f"Reranking failed: {exc}")
        return [], False

def retrieve_relevant_chunks(question: str, book_hint: Optional[str] = None, chapter_hint: Optional[str] = None) -> tuple[list, bool]:
    queries = generate_multi_queries(question, book_hint=book_hint, chapter_hint=chapter_hint)
    candidate_chunks = []

    for query in queries:
        candidate_chunks.extend(
            retrieve_chunks(
                query,
                top_k=CANDIDATES_PER_QUERY,
                book_hint=book_hint,
                chapter_hint=chapter_hint
            )
        )

    deduped_candidates = dedupe_chunks(candidate_chunks)
    reranked_chunks, is_relevant = rerank_chunks_with_llm(question, deduped_candidates[:15])
    # Always return something — fall back to raw candidates if reranking yields nothing
    final_chunks = reranked_chunks if reranked_chunks else deduped_candidates[:TOP_K]
    return final_chunks, True

# --- Startup ---
@app.on_event("startup")
def startup_event():
    logging.info("Starting NurZeka V2...")
    kb_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'knowledge-base', 'kulliyat')
    if os.path.exists(kb_path):
        for book_folder in os.listdir(kb_path):
            book_path = os.path.join(kb_path, book_folder)
            if os.path.isdir(book_path):
                for f in os.listdir(book_path):
                    if f.endswith('.md'):
                        CHAPTER_TO_BOOK_SLUG[f.replace('.md', '')] = book_folder

    state.embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME, device='cpu')
    if os.path.exists(INDEX_PATH):
        state.index = faiss.read_index(INDEX_PATH)
        logging.info(f"FAISS index loaded: {state.index.ntotal} vectors")
        with open(METADATA_PATH, 'rb') as f: state.chunks = pickle.load(f)

        if os.path.exists(BM25_INDEX_PATH):
            with open(BM25_INDEX_PATH, 'rb') as f:
                state.bm25_index = pickle.load(f)
            logging.info("BM25 index loaded")
        else:
            state.bm25_index = None
            logging.warning(f"BM25 index NOT found: {BM25_INDEX_PATH}")

        # Build section -> chunk_indices lookup for graph-neighbor expansion
        state.section_chunk_index = {}
        for i, chunk in enumerate(state.chunks):
            _, bolum_adi = get_chunk_book_and_section(chunk)
            if bolum_adi and bolum_adi != 'Belirtilmemiş':
                state.section_chunk_index.setdefault(bolum_adi, []).append(i)
        logging.info(f"Section index built: {len(state.section_chunk_index)} sections")
    else:
        logging.warning(f"FAISS index NOT found: {INDEX_PATH}")
    load_alias_map()

# --- Endpoint ---
class SearchRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None
    book_hint: Optional[str] = None
    chapter_hint: Optional[str] = None
    filter: Optional[dict] = None

@app.post("/api/search")
async def search_endpoint(request: SearchRequest, raw_request: Request):
    user_question = request.question
    book_hint = request.book_hint
    chapter_hint = request.chapter_hint
    
    # 1. Pipeline
    normalized_q = normalize_query(user_question)
    
    # Bypass logic check (Simple length check for now)
    if len(user_question.split()) > 150:
         async def no_retrieval_stream():
             # We should probably run the LLM heavily here on the input
             # But following strict V2 plan, if user provides long passage, we analyze it.
             # Construct dummy context from input
             context = f"[KULLANICI METNİ]\n{user_question}"
             prompt = SYSTEM_PROMPT.format(context=context)
             
             try:
                 stream = client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[{"role": "system", "content": prompt}, {"role": "user", "content": "Bu metni analiz et."}],
                    stream=False, temperature=get_temperature(user_question)
                 )
                 for chunk in stream:
                    if chunk.choices[0].delta.content:
                        data = json.dumps({"token": chunk.choices[0].delta.content}, ensure_ascii=False)
                        yield f"data: {data}\n\n"
                 yield "data: [DONE]\n\n"
             except Exception as e:
                 yield f"data: {json.dumps({'error': str(e)})}\n\n"

         return StreamingResponse(no_retrieval_stream(), media_type="text/event-stream")

        # Kitap filtresi ile chunkları al
    chunks, retrieval_is_relevant = retrieve_relevant_chunks(
        normalized_q,
        book_hint=book_hint,
        chapter_hint=chapter_hint
    )
    ordered_chunks = sorted(chunks, key=lambda x: x.get('metadata', {}).get('original_order_index', 0))
    context = build_context(ordered_chunks)
    
    # 2. Stream
    async def event_generator():
        filled_prompt = SYSTEM_PROMPT.format(context=context)
        # user_id: önce middleware'den (X-User-Id), sonra body'den al
        user_id = getattr(raw_request.state, "user_id", None) or request.user_id
        conv_id = request.conversation_id
        
        try:
            def _call():
                return client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[
                        {"role": "system", "content": filled_prompt},
                        {"role": "user", "content": user_question}
                    ],
                    stream=False,
                    temperature=get_temperature(user_question),
                    max_tokens=3000
                )
            resp = await asyncio.to_thread(_call)
            full_response_raw = resp.choices[0].message.content or ""

            matched_chunks = select_source_chunks_from_labels(full_response_raw, ordered_chunks)
            sources_payload = build_source_payload(matched_chunks) if matched_chunks else []
            full_response = strip_source_labels_from_answer(full_response_raw)
            for tok in full_response.split(" "):
                if tok:
                    d = json.dumps({"token": tok + " "}, ensure_ascii=False)
                    yield ("data: " + d + "\n\n")
                    await asyncio.sleep(0)

            if sources_payload:
                logging.info(f"SSE sources payload sent: {len(sources_payload)} items")
                sources_event = json.dumps({"sources": sources_payload}, ensure_ascii=False)
                yield ("data: " + sources_event + "\n\n")
            else:
                logging.info("SSE sources payload sent: 0 items")
            
            # Save messages if conversation_id is provided
            if conv_id and user_id:
                try:
                    db = get_db()
                    # User message
                    db.execute(
                        "INSERT INTO messages (id, conversation_id, user_id, role, content) VALUES (?,?,?,?,?)",
                        [str(uuid.uuid4()), conv_id, user_id, "user", user_question]
                    )
                    # AI Response
                    db.execute(
                        "INSERT INTO messages (id, conversation_id, user_id, role, content) VALUES (?,?,?,?,?)",
                        [str(uuid.uuid4()), conv_id, user_id, "assistant", full_response]
                    )
                    # Update conversation metadata
                    db.execute(
                        "UPDATE conversations SET updated_at=CURRENT_TIMESTAMP, message_count=message_count+2 WHERE id=?",
                        [conv_id]
                    )
                    db.commit()
                    db.close()
                except Exception as db_err:
                    logging.error(f"Error saving to DB: {db_err}")

            yield "data: [DONE]\n\n"
            
        except Exception as e:
            err = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {err}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/concept-map")
async def get_concept_map(body: dict):
    concept = body.get("concept", "").strip()
    
    # 1. İlgili chunk'ları getir
    chunks = retrieve_chunks(concept, top_k=10)
    
    if not chunks:
        return {"concept": concept, "nodes": [], "edges": []}
        
    context = "\n\n".join([c.get('text', '') for c in chunks])
    
    # 2. DeepSeek kavramları çıkarsın
    prompt = f"""
Aşağıdaki Risale-i Nur metinlerinde "{concept}" kavramıyla birlikte 
işlenen teolojik ve felsefi kavramları tespit et.

KURALLAR:
- Sadece gerçek kavramlar: isim, sıfat-ı ilahiye, kelam terimleri
- KESİNLİKLE YAZMA: kitap adı, bölüm adı, sayı, URL, fiil, edat, 
  bağlaç, sıra sayısı (birinci/ikinci...), matbu, arabî gibi kelimeler
- Tam olarak 8 kavram ver
- Her kavram tek kelime veya kısa tamlama
- Sadece JSON döndür, başka hiçbir şey yazma

Format:
{{"kavramlar": ["kavram1", "kavram2", "kavram3", "kavram4", "kavram5", "kavram6", "kavram7", "kavram8"]}}

Metin:
{context[:3000]}
"""
    try:
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            stream=False,
            temperature=0.1
        )
        
        raw = response.choices[0].message.content.strip()
        raw = re.sub(r'```json|```', '', raw).strip()
        
        data = json.loads(raw)
        kavramlar = data.get('kavramlar', [])
    except Exception as e:
        print(f"Error extracting concepts: {e}")
        kavramlar = []
        
    # Eğer API boş döndüyse fallback olarak kendi kavramını ver
    if not kavramlar:
        kavramlar = [concept]
        
    # 3. vis.js formatı
    nodes = [{
        "id":    0,
        "label": concept.upper(),
        "color": "#c9a84c",
        "size":  30,
        "font":  {"size": 14, "bold": True}
    }]
    edges = []
    
    for i, kavram in enumerate(kavramlar[:8], 1): # Sınırı zorla 8'de tut
        nodes.append({
            "id":    i,
            "label": kavram,
            "color": "#e8d5a3",
            "size":  20
        })
        edges.append({"from": 0, "to": i, "width": 2})
        
    return {
        "concept": concept,
        "nodes": nodes,
        "edges": edges,
        "total_chunks": len(chunks)
    }

@app.post("/api/concept-info")
async def concept_info(body: dict):
    concept = body.get("concept", "").strip()
    
    # 1. İlgili chunk'ları getir (Bağlam için)
    chunks = retrieve_chunks(concept, top_k=3)
    context = chunks[0]['text'] if chunks else ""
    
    # 2. AI açıklama üretsin
    prompt = f"""
"{concept}" kavramını Risale-i Nur bağlamında açıkla.
Sadece şu 3 satırı yaz, başka hiçbir şey ekleme:

KÖK: [Arapça veya Osmanlıca kökü ve sözlük anlamı]
ANLAM: [Bediüzzaman'ın bu kavramı nasıl kullandığı - 2 cümle]
BAĞLANTI: [Hangi kavramlarla birlikte işlenir]

Bağlam: {context[:500]}
"""
    explanation = "Açıklama alınamadı."
    try:
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            stream=False,
            temperature=0.2
        )
        explanation = response.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Concept info DeepSeek error: {e}")
        
    # 3. Külliyatta geçtiği tüm yerleri bul
    results = []
    seen = set()
    
    def get_relevant_sentence(chunk_text, concept):
        sentences = chunk_text.replace('\n', ' ').split('.')
        for sentence in sentences:
            if concept.lower() in sentence.lower() and len(sentence.strip()) > 20:
                return sentence.strip()[:120]
        return chunk_text[:80]

    def to_slug(text):
        text = text.lower()
        text = text.replace('ğ','g').replace('ü','u').replace('ş','s')
        text = text.replace('ı','i').replace('ö','o').replace('ç','c')
        text = text.replace('â','a').replace('î','i').replace('û','u')
        text = re.sub(r'[^a-z0-9\s-]', '', text)
        text = re.sub(r'\s+', '-', text.strip())
        return text

    if state.chunks:
        for chunk in state.chunks:
            text = chunk.get('text', '')
            if concept.lower() in text.lower():
                chunk_id = chunk.get('id', '')
                if chunk_id and chunk_id in seen:
                    continue
                if chunk_id:
                    seen.add(chunk_id)
                
                # İlgili cümleyi çıkar
                sentences = text.split('.')
                relevant = next(
                    (s for s in sentences if concept.lower() in s.lower()),
                    text[:200]
                )
                # Extract frontmatter variables if present using regex
                kitap_match = re.search(r'^kitap:\s*"?(.*?)"?\r?\n', text, re.MULTILINE | re.IGNORECASE)
                bolum_match = re.search(r'^bölüm:\s*"?(.*?)"?\r?\n', text, re.MULTILINE | re.IGNORECASE)
                
                kitap = kitap_match.group(1).strip() if kitap_match else ''
                bolum_adi = bolum_match.group(1).strip() if bolum_match else ''
                
                # Check metadata dict if regex failed
                metadata = chunk.get('metadata', {})
                if not kitap:
                    kitap = metadata.get('kitap') or metadata.get('book') or chunk.get('kitap') or chunk.get('book') or "Lem'alar"
                if not bolum_adi:
                    bolum_adi = metadata.get('bolum_adi') or metadata.get('section') or metadata.get('title') or metadata.get('source') or chunk.get('bolum_adi') or chunk.get('section') or chunk.get('title') or ''
                
                # Her halükarda .md uzantılı gelirse veya sayı-tire formatındaysa temizle
                bolum_str = str(bolum_adi)
                if bolum_str.endswith('.md') or '-' in bolum_str:
                    name = bolum_str.replace('.md', '').replace('-', ' ')
                    parts = name.split()
                    if parts and parts[0].isdigit():
                        parts = parts[1:]
                    bolum_adi = ' '.join(parts).title()
                    
                if not bolum_adi or bolum_adi.lower() == 'unknown':
                    bolum_adi = "Belirtilmemiş"
                if not kitap or kitap.lower() == 'unknown':
                    kitap = "Belirtilmemiş"
                
                
                chapter_slug = os.path.basename(str(metadata.get('source') or chunk.get('source') or chunk.get('id', ''))).replace('.md', '')
                book_slug = CHAPTER_TO_BOOK_SLUG.get(chapter_slug) or BOOK_SLUGS.get(kitap, to_slug(kitap))

                results.append({
                    "chunk_id":     chunk_id or str(len(results)),
                    "kitap":        kitap,
                    "bolum_adi":    bolum_adi,
                    "book_slug":    book_slug,
                    "chapter_slug": chapter_slug,
                    "bolum_no":     metadata.get('bolum_no', metadata.get('original_order_index', int(chunk_id if str(chunk_id).isdigit() else 0))),
                    "pasaj":        relevant.strip() + "...",
                    "metin_ipucu":  get_relevant_sentence(text, concept)  # gelişmiş eşleştirme için o cümleyi döndür
                })
                
    # Kitap sırasına göre sırala
    KITAP_SIRASI = [
        "Sözler", "Mektubat", "Lem'alar", "Şualar",
        "Mesnevi-i Nuriye", "Barla Lahikası",
        "Kastamonu Lahikası", "Emirdağ Lahikası I", "Emirdağ Lahikası II"
    ]
    results.sort(key=lambda x: (
        KITAP_SIRASI.index(x['kitap']) if x['kitap'] in KITAP_SIRASI else 99,
        x['bolum_no']
    ))
    
    return {
        "concept":     concept,
        "explanation": explanation,
        "count":       len(results),
        "occurrences": results
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
