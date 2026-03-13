# Risale-i Nur Hybrid RAG Service

Bu servis, **Hibrit RAG Mimarisi** kullanır:
1. **Retrieval (Geri Çağırma):** Yerel CPU üzerinde FAISS + SentenceTransformers ile çalışır (Hızlı, Masrafsız, Güvenli).
2. **Generation (Üretim):** DeepSeek V3 API ile çalışır (Yüksek Zeka, Düşük Maliyet).

## Kurulum ve Başlatma

### 1. Hazırlık
`.env` dosyanıza DeepSeek API anahtarınızı ekleyin:
```bash
DEEPSEEK_API_KEY=sk-....
```

### 2. Bağımlılıkları Yükle
```bash
pip install -r rag_service/requirements.txt
```

### 3. Veri İndeksleme (Sadece ilk seferde)
Risale-i Nur `.md` dosyalarınızı `rag_service/data/` klasörüne koyun ve çalıştırın:
```bash
python rag_service/ingest.py
```
Bu işlem `risale_index.faiss` dosyasını oluşturacaktır.

### 4. Servisi Başlat
```bash
python rag_service/app.py
```
Servis `http://localhost:8000` adresinde çalışacaktır.

## Node.js Entegrasyonu
Backend servisi (`backend/services/rag.js`), bu Python servisine **Stream** (akış) modunda bağlanır. 
- Timeout süresi: 5 Dakika (300.000ms)
- Stream Pipe: Anlık token akışı sağlar.

## Özellikler
- **Nazm-ı Maâni Promptu**: Risale-i Nur usulüne uygun cevap üretimi.
- **Sıfır Halüsinasyon**: Sadece bağlamdaki (Context) veriyi kullanır.
- **Metadata Filtreleme**: Kitap ve Bölüm bazlı ayrıştırma.
- **Original Order Sort**: Metinleri yazarın mantık sırasına göre dizer.
