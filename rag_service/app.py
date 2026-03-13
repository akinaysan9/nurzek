import os
import pickle
import time
import logging
import json
import re
from typing import List, Optional, AsyncGenerator
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
ALIAS_MAP_PATH = "alias_map.json"
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
deepseek_client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")

# Constants
SIMILARITY_THRESHOLD = 0.27
TOP_K = 7
CHAPTER_TO_BOOK_SLUG = {}

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

Sana CONTEXT BLOCK içinde külliyat pasajları verilir. Cevabın bu pasajlara
dayanır. Her çıkarımını metinden bir alıntıyla desteklersin.

Eğer soru bağlamla karşılanamıyorsa şunu söyle:
"Bu soruya dair bağlamımda doğrudan bir pasaj bulunmuyor; ancak külliyatta
[ilgili bölüm adı] bu meseleyi merkeze alır. O bölümden bir pasaj iletirseniz
daha derinlikli bir şerh sunabilirim."

Genel bilgi üretme. Tahmin yürütme. Metinden beslenmeyen her cümle,
tefekkürün değil hayal gücünün ürünüdür — bu sisteme yabancıdır.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## II. METİN OKUMA METODOLOJİN: BEŞ KATMAN

Her pasajı bu beş katmanda analiz edersin:

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

Bu üçgeni her pasajda tespit et. Temsilin hangi hakikatin anahtarı
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
bir tezahürüyle karşımıza çıkar. Context'teki pasaj hangi külliyat
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

1. Pasajdan vurucu bir alıntıyla başla — hemen ardından [Kitap, Bölüm] yaz
2. O pasajdaki nazm sırasını ve temsil-hakikat köprüsünü açık et
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
• Kullanıcıya öğretme — onunla birlikte metni gez, onu pasajın içine al
• Uzun listeler ve maddeler kullanma — her fikir bir paragrafta nefes alsın

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## V. ÖZEL DURUMLAR

### Kullanıcı Kısa / Net Bir Tanım Sorarsa
"İman nedir?" gibi doğrudan sorularda önce kısa ve güçlü bir pasaj alıntısı,
sonra o alıntının açılımı. Uzun şerhe gerek yok — derinlik, uzunlukta değil.

### Kullanıcı Kendi Yorumunu Getirirse
"Bence bu pasaj şunu söylüyor..." derse: önce onun yorumunu ciddiye al,
sonra metinden destek veya düzeltme sun. "Haklısınız, şu ifade bunu
doğruluyor" ya da "Şu pasaj bize farklı bir yön gösteriyor" de.

### Kullanıcı Uzun Bir Pasaj Gönderirse
Retrieval'a gerek yok — doğrudan o pasajı analiz et. "Bu pasajı
birlikte okuyalım..." diyerek başla.

### İki Kavramı Karşılaştırma
"Vahidiyet ile Ehadiyet farkı nedir?" gibi sorularda her kavramı önce
kendi bağlamında tanı, sonra Bediüzzaman'ın ikisini nasıl ilişkilendirdiğini
göster. Karşıtlık değil, tamamlayıcılık vurgula.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTEXT BLOCK:
{context}
"""

# --- Global State ---
class GlobalState:
    embedding_model: Optional[SentenceTransformer] = None
    index: Optional[faiss.Index] = None
    chunks: Optional[List[dict]] = None
    alias_map: dict = {}

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

def build_context(chunks: list, max_tokens: int = 5000) -> str:
    # Epistemological sort: by original order index
    sorted_chunks = sorted(chunks, key=lambda x: x.get('metadata', {}).get('original_order_index', 0))
    
    context_parts = []
    total_tokens = 0
    
    for i, chunk in enumerate(sorted_chunks):
        meta = chunk.get('metadata', {})
        kitap = meta.get('book', 'Belirtilmemiş')
        bolum = meta.get('chapter', 'Belirtilmemiş')
        metin = chunk['text'].strip()
        
        block = f"[PASAJ {i+1} — {kitap}, {bolum}]\n{metin}\n"
        
        estimated_tokens = len(block.split()) * 1.3
        if total_tokens + estimated_tokens > max_tokens:
            break
            
        context_parts.append(block)
        total_tokens += estimated_tokens
        
    return "\n\n---\n\n".join(context_parts)

def retrieve_chunks(query: str, top_k: int = TOP_K, book_hint: Optional[str] = None, chapter_hint: Optional[str] = None) -> list:
    if not state.index: return []
    
    query_embedding = state.embedding_model.encode([query], convert_to_numpy=True)
    distances, indices = state.index.search(query_embedding, top_k * 2)
    
    results = []
    for score, idx in zip(distances[0], indices[0]):
        if idx == -1: continue
        
        chunk = state.chunks[idx].copy()
        
        # Kitap filtresi uygula
        if book_hint:
            chunk_book = chunk.get("book", "").lower()
            hint_book = book_hint.lower()
            
            # Öncelik puanı hesapla
            priority_score = 1.0
            
            # Kitap eşleşmesi varsa yüksek öncelik
            if hint_book in chunk_book or chunk_book in hint_book:
                priority_score = 2.0
            # Bölüm eşleşmesi varsa daha da yüksek öncelik
            if chapter_hint and chapter_hint.lower() in chunk.get("chapter", "").lower():
                priority_score = 3.0
            
            chunk["_priority"] = priority_score
            chunk["_score"] = float(score) / priority_score
        else:
            chunk["_score"] = float(score)
        
        results.append(chunk)
    
    # Önceliğe göre sırala
    if book_hint:
        results.sort(key=lambda x: x.get("_score", 100))
    
    return results[:top_k]

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
        with open(METADATA_PATH, 'rb') as f: state.chunks = pickle.load(f)
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
    chunks = retrieve_chunks(normalized_q, book_hint=book_hint, chapter_hint=chapter_hint)
    context = build_context(chunks)
    
    if not chunks:
        async def no_context_stream():
            msg = "Bu soruya dair bağlamımda doğrudan bir pasaj bulunmuyor. İlgili bölümden bir metin iletirseniz birlikte inceleyebiliriz."
            yield f"data: {json.dumps({'token': msg}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(no_context_stream(), media_type="text/event-stream")
        
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
            full_response = resp.choices[0].message.content or ""
            for tok in full_response.split(" "):
                if tok:
                    d = json.dumps({"token": tok + " "}, ensure_ascii=False)
                    yield ("data: " + d + "\n\n")
                    await asyncio.sleep(0)
            
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

    KITAP_SLUG = {
        "Sözler":              "sozler",
        "Mektubat":            "mektubat",
        "Lem'alar":            "lemalar",
        "Şualar":              "sualar",
        "Mesnevi-i Nuriye":    "mesnevi-i-nuriye",
        "Barla Lahikası":      "barla-lahikasi",
        "Kastamonu Lahikası":  "kastamonu-lahikasi",
        "Emirdağ Lahikası I":  "emirdag-lahikasi-i",
        "Emirdağ Lahikası II": "emirdag-lahikasi-ii",
        "Tarihçe-i Hayat":     "tarihce-i-hayat",
        "Asâ-yı Musa":         "asa-yi-musa",
        "İşaratü'l-İ'caz":     "isaratul-icaz",
        "Sikke-i Tasdik-i Gaybî": "sikke-i-tasdik-i-gaybi",
        "Muhakemat":           "muhakemat"
    }
    
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
                book_slug = CHAPTER_TO_BOOK_SLUG.get(chapter_slug) or KITAP_SLUG.get(kitap, to_slug(kitap))

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
