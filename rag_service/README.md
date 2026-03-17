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

## Fihrist Katmanı

Servis artık opsiyonel bir `fihrist_index.json` dosyasını da yükleyebilir. Bu dosya,
cevap üretmek için değil, retrieval'a yön vermek için kullanılır.

- Truth layer: yerel markdown külliyat chunk'ları
- Hint layer: fihrist / kavram indeksleri

Fihrist verisi şu amaçlarla kullanılır:
- Kullanıcı sorusundaki kavramı risale yoğunluklarına bağlamak
- Ana risaleden sonra köprü risaleleri seçmek
- `Bakınız` / çapraz referansları düşük güvenli bridge sinyali olarak kullanmak

Servis opsiyonel olarak `nurpedia_index.json` da yükleyebilir. Bu ikinci katman,
özellikle kavram sayfalarındaki:

- ilgili risale bağlantıları
- ilgili maddeler
- mefhum sayfası başlıkları

üzerinden concept graph sinyali üretir. Güvenlik amacıyla, mevcut fihrist/glossary
zaten bir ana risale bulmuşsa Nurpedia bu sonucu ezmez; yalnızca bridge ve ontology
zenginleştirmesi yapar.

Fihrist verisini üretmek için yerel HTML/TXT exportlarından şu komutu çalıştırın:

```bash
python rag_service/build_fihrist_index.py --input path/to/fihrist_exports --output rag_service/fihrist_index.json
```

Beklenen çıktı şeması özetle şöyledir:

```json
{
	"meta": {
		"source": "Fihrist (Envar Neşriyat, Baskı: 2006)",
		"concept_count": 0
	},
	"alias_to_concepts": {
		"ihlas": ["ihlas"]
	},
	"concepts": {
		"ihlas": {
			"display": "İHLAS",
			"aliases": ["ihlas"],
			"cross_references": ["uhuvvet"],
			"related_concepts": ["uhuvvet"],
			"ranked_references": [
				{
					"book": "Lem'alar",
					"section": "21. Lem'a",
					"count": 4,
					"score": 24.0
				}
			]
		}
	}
}
```

Not: Baskı sayfa numaraları saklanabilir, fakat markdown chunk'lara bire bir eşlenmediği sürece
doğrudan retrieval locator olarak kullanılmamalıdır.

## Kalite Seti (Regression)

Retrieval/anchoring davranışını bozmadan ilerlemek için kalite seti eklenmiştir:

- Soru seti: `quality_set.json`
- Validator: `validate_quality_set.py`

Hızlı smoke test:

```bash
python rag_service/validate_quality_set.py --max-cases 4
```

Tam set:

```bash
python rag_service/validate_quality_set.py
```

Çıktı her vaka için `PASS/FAIL`, gözlenen `primary_slug`, main/bridge dağılımı ve
en sonda toplam skor verir. Fail olduğunda script `exit code 1` döner; böylece CI/CD
veya local automation içinde kolayca kullanılabilir.
