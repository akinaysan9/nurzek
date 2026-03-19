import json
import os
import sys

ROOT = r"C:\Users\aysan\Desktop\risale-nur-ai"
RAG_DIR = os.path.join(ROOT, "rag_service")
os.chdir(RAG_DIR)
sys.path.insert(0, RAG_DIR)

import app as rag_app

QUERY = "İhlas Risalesinin dört düsturu nelerdir?"

print("=== INIT ===")
rag_app.startup_event()

print("=== IHLAS_MEMBERSHIP ===")
print(f"ihlas_in_non_standalone={ 'ihlas' in rag_app.state.non_standalone_alias_terms }")
print(f"ihlas_in_general={ 'ihlas' in rag_app.state.general_alias_terms }")

print("=== DETECT_STEP_BY_STEP ===")
normalized_query = rag_app.normalize_for_match(QUERY)
print("normalized_query=" + normalized_query)

matched_terms = []
for term, payload in rag_app.state.risale_lookup.items():
    if not term or term not in normalized_query:
        continue
    primary = set(payload.get('primary', []))
    secondary = set(payload.get('secondary', []))
    if not primary and not secondary:
        continue
    matched_terms.append((term, primary, secondary))

print(f"matched_terms_count={len(matched_terms)}")
for term, primary, secondary in matched_terms:
    flags = []
    if term in rag_app.state.non_standalone_alias_terms:
        flags.append("NON_STANDALONE")
    if term in rag_app.state.general_alias_terms:
        flags.append("GENERAL")
    flag_text = ",".join(flags) if flags else "-"
    print(
        "MATCH term={term} flags={flags} primary_count={pc} secondary_count={sc}".format(
            term=term,
            flags=flag_text,
            pc=len(primary),
            sc=len(secondary),
        )
    )

meaningful_terms = [
    (term, p, s)
    for term, p, s in matched_terms
    if term not in rag_app.state.non_standalone_alias_terms
]

filtered_non_standalone = [
    term for term, _, _ in matched_terms
    if term in rag_app.state.non_standalone_alias_terms
]

print("filtered_non_standalone=" + json.dumps(filtered_non_standalone, ensure_ascii=False))
print(f"meaningful_terms_count={len(meaningful_terms)}")

specific_terms = [
    (term, p, s)
    for term, p, s in meaningful_terms
    if term not in rag_app.state.general_alias_terms
]

filtered_general = [
    term for term, _, _ in meaningful_terms
    if term in rag_app.state.general_alias_terms
]

print("filtered_general=" + json.dumps(filtered_general, ensure_ascii=False))
print(f"specific_terms_count={len(specific_terms)}")

selected_terms = specific_terms or meaningful_terms
print("selected_terms=" + json.dumps([t for t, _, _ in selected_terms], ensure_ascii=False))

if not specific_terms and all(t in rag_app.state.general_alias_terms for t, _, _ in selected_terms):
    print("all_selected_are_general=True -> return None")
    result = None
else:
    matched_primary = set()
    matched_secondary = set()
    for _, p, s in selected_terms:
        matched_primary.update(p)
        matched_secondary.update(s)
    matched_secondary -= matched_primary
    result = {
        'primary': sorted(matched_primary),
        'secondary': sorted(matched_secondary),
    }

print("=== RESULT ===")
print(json.dumps(result, ensure_ascii=False))
