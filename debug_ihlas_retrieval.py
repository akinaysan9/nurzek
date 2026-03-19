import json
import os
import sys

ROOT = r"C:\Users\aysan\Desktop\risale-nur-ai"
RAG_DIR = os.path.join(ROOT, "rag_service")

sys.path.insert(0, RAG_DIR)
os.chdir(RAG_DIR)

import app as rag_app

QUERY = "İhlas Risalesinin dört düsturu nelerdir?"

print("=== INIT ===")
# Build full runtime state (model + indices + dictionaries)
rag_app.startup_event()

print("=== DETECT_RISALE_REFERENCE ===")
detected = rag_app.detect_risale_reference(QUERY)
if not detected:
    print("DETECTED=None")
    primary_slugs = []
    secondary_slugs = []
else:
    primary_slugs = detected.get("primary", [])
    secondary_slugs = detected.get("secondary", [])
    print("PRIMARY_SLUGS=" + json.dumps(primary_slugs, ensure_ascii=False))
    print("SECONDARY_SLUGS=" + json.dumps(secondary_slugs, ensure_ascii=False))

print("=== RETRIEVE_POOL_DEBUG ===")
primary_pool = rag_app.build_candidate_pool(primary_slugs)
secondary_pool = rag_app.build_candidate_pool(secondary_slugs)
print(f"PRIMARY_POOL_SIZE={len(primary_pool)}")
print(f"SECONDARY_POOL_SIZE={len(secondary_pool)}")
print("PRIMARY_SLUGS_FOR_POOL=" + json.dumps(primary_slugs, ensure_ascii=False))
print("SECONDARY_SLUGS_FOR_POOL=" + json.dumps(secondary_slugs, ensure_ascii=False))

print("=== RETRIEVE_CHUNKS_TOP5 ===")
chunks = rag_app.retrieve_chunks(QUERY, top_k=5)
print(f"RETURNED_CHUNK_COUNT={len(chunks)}")
for i, ch in enumerate(chunks, start=1):
    md = ch.get("metadata", {})
    chapter = md.get("chapter") or ch.get("chapter") or ""
    source = md.get("source") or ch.get("source") or ""
    _, bolum_adi = rag_app.get_chunk_book_and_section(ch)
    canonical = md.get("risale_canonical_slug") or md.get("risale_slug") or ""
    print(
        f"CHUNK_{i}|chapter={chapter}|bolum_adi={bolum_adi}|canonical_slug={canonical}|source={source}"
    )

print("=== RISALE_SOZLUK_IHLAS_ALIAS ===")
sozluk_path = os.path.join(RAG_DIR, "risale_sozluk.json")
with open(sozluk_path, "r", encoding="utf-8") as f:
    payload = json.load(f)

aliases = payload.get("aliases", {}) if isinstance(payload, dict) else {}

# exact + normalized candidates
candidates = ["ihlas", "ihlas", "hlas"]
# keep unique readable
seen = set()
clean_candidates = []
for c in candidates:
    c = c.replace("\x07", "").replace("\x01", "")
    if c not in seen:
        seen.add(c)
        clean_candidates.append(c)

found = False
for key in aliases.keys():
    if rag_app.normalize_for_match(key) == "ihlas":
        found = True
        value = aliases[key]
        print(f"ALIAS_KEY={key}")
        if isinstance(value, dict):
            print("ALIAS_TYPE=dict")
            print("PRIMARY=" + json.dumps(value.get("primary", []), ensure_ascii=False))
            print("SECONDARY=" + json.dumps(value.get("secondary", []), ensure_ascii=False))
        elif isinstance(value, list):
            print("ALIAS_TYPE=list")
            primary = []
            secondary = []
            for item in value:
                if isinstance(item, dict):
                    slug = str(item.get("slug") or "").strip()
                    src = str(item.get("source") or "primary").strip().lower()
                    if not slug:
                        continue
                    if src == "secondary":
                        secondary.append(slug)
                    else:
                        primary.append(slug)
                else:
                    slug = str(item).strip()
                    if slug:
                        primary.append(slug)
            print("PRIMARY=" + json.dumps(sorted(set(primary)), ensure_ascii=False))
            print("SECONDARY=" + json.dumps(sorted(set(secondary)), ensure_ascii=False))
        else:
            print("ALIAS_TYPE=scalar")
            print("PRIMARY=" + json.dumps([str(value)], ensure_ascii=False))
            print("SECONDARY=[]")

if not found:
    print("ALIAS_IHLAS_NOT_FOUND")
