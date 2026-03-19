import asyncio
import os
import pickle
import re
from typing import Dict, List, Tuple

import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from sentence_transformers import SentenceTransformer

from nano_graphrag import GraphRAG, QueryParam
from nano_graphrag._utils import wrap_embedding_func_with_attrs


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env"), override=True)

CACHE_DIR = os.path.join(BASE_DIR, "nano_graphrag_cache")
METADATA_PATH = os.path.join(BASE_DIR, "risale_metadata.pkl")
EMBEDDING_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
TOP_K = 10

TURKISH_SYSTEM_PROMPT = """Sen Risale-i Nur odakli bir yardimcisin.
Kurallar:
1) Yanit dili sadece Turkce olsun.
2) Sadece verilen context'e dayan.
3) Context disina cikma, tahmin uretme.
4) Mumkun oldugunca kaynak baglamini koruyarak cevap ver.
"""


def strip_frontmatter(text: str) -> str:
    return re.sub(r"^---[\s\S]*?---\s*", "", text or "").strip()


def extract_chunk_ids(raw_text: str) -> List[int]:
    seen = set()
    ids: List[int] = []
    for match in re.findall(r"\[CHUNK_ID:(\d+)\]", str(raw_text or "")):
        idx = int(match)
        if idx in seen:
            continue
        seen.add(idx)
        ids.append(idx)
    return ids


def load_chunk_lookup() -> Dict[int, dict]:
    if not os.path.exists(METADATA_PATH):
        return {}

    with open(METADATA_PATH, "rb") as f:
        chunks = pickle.load(f)

    lookup: Dict[int, dict] = {}
    for i, chunk in enumerate(chunks or []):
        lookup[i] = chunk
    return lookup


def make_graphrag_client() -> GraphRAG:
    deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
    deepseek_base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    if not deepseek_api_key:
        raise RuntimeError("DEEPSEEK_API_KEY missing in .env")

    llm_client = OpenAI(api_key=deepseek_api_key, base_url=deepseek_base_url)
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME, device="cpu")
    embedding_dim = int(embedding_model.get_sentence_embedding_dimension())

    @wrap_embedding_func_with_attrs(embedding_dim=embedding_dim, max_token_size=8192)
    async def _embed(texts: list[str]) -> np.ndarray:
        vectors = embedding_model.encode(texts, convert_to_numpy=True)
        return np.asarray(vectors, dtype=np.float32)

    async def _llm(prompt, system_prompt=None, **kwargs):
        full_prompt = "\n\n".join(
            [
                TURKISH_SYSTEM_PROMPT,
                str(system_prompt or ""),
                str(prompt or ""),
            ]
        )
        response_format = kwargs.get("response_format") or {}

        def _call():
            return llm_client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": full_prompt[:12000]}],
                temperature=0.1,
                stream=False,
                response_format=response_format if isinstance(response_format, dict) and response_format else None,
            )

        resp = await asyncio.to_thread(_call)
        return str(resp.choices[0].message.content or "")

    return GraphRAG(
        working_dir=CACHE_DIR,
        enable_local=True,
        enable_naive_rag=False,
        always_create_working_dir=True,
        enable_llm_cache=False,
        embedding_func=_embed,
        best_model_func=_llm,
        cheap_model_func=_llm,
    )


def query_mode(graphrag: GraphRAG, question: str, mode: str, top_k: int) -> Tuple[str, str, List[int]]:
    answer_param = QueryParam(mode=mode, top_k=top_k)
    context_param = QueryParam(mode=mode, only_need_context=True, top_k=top_k)

    answer = graphrag.query(question, answer_param)
    context = graphrag.query(question, context_param)
    chunk_ids = extract_chunk_ids(context)

    return str(answer or ""), str(context or ""), chunk_ids


def print_sources(chunk_ids: List[int], chunk_lookup: Dict[int, dict]):
    if not chunk_ids:
        print("Kaynak chunk bulunamadi.")
        return

    for cid in chunk_ids:
        chunk = chunk_lookup.get(cid)
        if not chunk:
            print(f"- CHUNK_ID={cid} | source=UNKNOWN | text=NOT_FOUND")
            continue

        metadata = chunk.get("metadata", {}) if isinstance(chunk.get("metadata"), dict) else {}
        source_file = str(metadata.get("source") or "UNKNOWN")
        text = re.sub(r"\s+", " ", strip_frontmatter(str(chunk.get("text") or ""))).strip()
        snippet = text[:320] + ("..." if len(text) > 320 else "")

        print(f"- CHUNK_ID={cid}")
        print(f"  source_file={source_file}")
        print(f"  text={snippet}")


def main():
    if not os.path.isdir(CACHE_DIR):
        raise FileNotFoundError(f"Cache dir not found: {CACHE_DIR}")

    chunk_lookup = load_chunk_lookup()
    graphrag = make_graphrag_client()

    print("GraphRAG query test hazir.")
    print("Cikmak icin: q")

    while True:
        question = input("\nSoru: ").strip()
        if not question:
            continue
        if question.lower() in {"q", "quit", "exit"}:
            print("Cikis yapildi.")
            break

        for mode in ["local", "global"]:
            print("\n" + "=" * 80)
            print(f"MODE: {mode}")
            print("=" * 80)
            try:
                answer, context, chunk_ids = query_mode(graphrag, question, mode=mode, top_k=TOP_K)
                print("\nCevap:")
                print(answer if answer else "(bos cevap)")

                print("\nKaynak Chunk'lar:")
                print_sources(chunk_ids, chunk_lookup)

                print("\nContext Ozeti (ilk 1200 karakter):")
                print((context or "")[:1200])
            except Exception as exc:
                print(f"{mode} modunda hata: {exc}")


if __name__ == "__main__":
    main()
