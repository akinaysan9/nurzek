import os, sys, json, logging
logging.disable(logging.CRITICAL)
BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE, 'rag_service'))
os.chdir(os.path.join(BASE, 'rag_service'))
import app
app.startup_event()

q = "İhlas Risalesinin dört düsturu nelerdir?"
nq = app.normalize_query(q)

for run in range(1, 4):
    print(f"\n========== RUN {run} ==========")

    # Step 1: detect on original normalized query (deterministic)
    det = app.detect_risale_reference(nq) or {"primary": [], "secondary": []}
    print(f"  [1-DETECT] primary={det['primary']}")

    # Step 2: multi-queries (LLM call - potential non-determinism here)
    queries = app.generate_multi_queries(q)
    print(f"  [2-MULTI_QUERIES] {queries}")

    # Step 3: retrieve chunks per query (deterministic FAISS+BM25, but detect runs on each query)
    all_cands = []
    for qi, query in enumerate(queries):
        sub_det = app.detect_risale_reference(query) or {"primary": [], "secondary": []}
        chunks = app.retrieve_chunks(query, top_k=app.CANDIDATES_PER_QUERY)
        slugs = [str(c.get("metadata", {}).get("risale_canonical_slug") or c.get("metadata", {}).get("risale_slug", ""))[:35] for c in chunks]
        print(f"    [3-QUERY-{qi+1}] detect_primary={sub_det['primary']} slugs={slugs}")
        all_cands.extend(chunks)

    deduped = app.dedupe_chunks(all_cands)
    print(f"  [3-CANDIDATES] after dedup: {len(deduped)} chunks")
    cand_slugs = sorted(set(str(c.get("metadata", {}).get("risale_canonical_slug") or c.get("metadata", {}).get("risale_slug", ""))[:35] for c in deduped))
    print(f"  [3-CANDIDATES] unique slugs={cand_slugs}")

    # Step 4: rerank (LLM call - potential non-determinism even at temperature=0)
    reranked, is_rel = app.rerank_chunks_with_llm(q, deduped[:15])
    r_slugs = [str(c.get("metadata", {}).get("risale_canonical_slug") or c.get("metadata", {}).get("risale_slug", ""))[:35] for c in reranked]
    r_chapters = [str(c.get("metadata", {}).get("chapter", ""))[:50] for c in reranked]
    print(f"  [4-RERANK] is_relevant={is_rel}")
    print(f"  [4-RERANK] slugs={r_slugs}")
    print(f"  [4-RERANK] chapters={r_chapters}")

    # --- NEW: call the actual retrieve_relevant_chunks to see fast-path output ---
    print(f"  --- fast-path via retrieve_relevant_chunks ---")
    fp_chunks, _ = app.retrieve_relevant_chunks(q)
    fp_slugs = [str(c.get("metadata", {}).get("risale_canonical_slug") or c.get("metadata", {}).get("risale_slug", ""))[:35] for c in fp_chunks]
    fp_chapters = [str(c.get("metadata", {}).get("chapter", ""))[:50] for c in fp_chunks]
    print(f"  [FINAL-FAST] slugs={fp_slugs}")
    print(f"  [FINAL-FAST] chapters={fp_chapters}")
    has_ybr = any("yirmi-birinci-lema" in s for s in fp_slugs)
    print(f"  [FINAL-FAST] HAS_yirmi-birinci-lema={has_ybr}")
