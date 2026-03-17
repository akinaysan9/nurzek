# 🕌 NurZeka — Yapay Zeka Destekli Risale-i Nur Tefekkür Platformu

AI destekli Risale-i Nur külliyat araştırma, tefekkür ve soru-cevap platformu.

## ⚡ Hızlı Başlangıç

```bash
# 1. Backend bağımlılıklarını yükle
cd backend
npm install

# 2. Bilgi tabanını oluştur (test modu - hızlı)
npm run scrape:test

# 3. Sunucuyu başlat
npm start

# 4. Tarayıcıda aç
# http://localhost:3001
```

## 🔧 Tam Scraping

```bash
# Tüm külliyatı, soru-cevapları ve makaleleri çek
npm run scrape
```

## 🐘 Postgres + Redis (V2 Governance)

Bu katman mevcut SQLite sistemi bozmadan paralel çalışır.

```bash
# 1. Altyapıyı başlat
docker compose up -d postgres redis

# 2. Backend ortam değişkenlerini doldur
# backend/.env içine DATABASE_URL ve REDIS_URL ekleyin

# 3. Backend'i çalıştır
cd backend
npm install
npm start
```

Varsayılan migration dosyası: `backend/db/migrations/001_init_schema.sql`

Yeni endpointler:
- `POST /api/concept-occurrences/v2`
- `GET /api/refinement-jobs/:id`
- `POST /api/rules/canary/promote`
- `POST /api/replay/:event_id` (Python servis)

Outbox worker:

```bash
cd backend
npm run outbox:worker
```

## 🏗️ Özellikler

| Özellik | Açıklama |
|---------|----------|
| 🤖 AI Chatbot | DeepSeek NurZeka ile RAG tabanlı soru-cevap |
| 📖 Külliyat Okuyucu | 25 kitabı okuma, Ottoman tooltip'ler |
| 📝 Metin Seçim → Sor | Külliyat'ta metin seçip AI'ya soru sorma |
| 📒 Not Sistemi | İlhamları kaydetme, paylaşma |
| 👤 Kullanıcı Hesapları | Kayıt, giriş, kişisel not defteri |
| 🔍 Anlamsal Arama | Külliyat üzerinde akıllı arama |
| 🔄 Otomatik Güncelleme | Zamanlanmış scraping ve indeksleme |
| 📚 Osmanlıca Sözlük | 150+ terim, hover ile anlam gösterme |

## 📁 Proje Yapısı

```
risale-nur-ai/
├── backend/         # Node.js + Express sunucu
├── frontend/        # Vanilla JS + CSS SPA
├── knowledge-base/  # MD dosyaları (scrape edilen)
└── data/            # İşlenmiş veri
```

## 🔑 Ortam Değişkenleri

`backend/.env` dosyasındaki ayarlar:
- `DEEPSEEK_API_KEY` — DeepSeek AI API anahtarı
- `PORT` — Sunucu portu (varsayılan: 3001)
- `JWT_SECRET` — Kullanıcı oturum güvenlik anahtarı
