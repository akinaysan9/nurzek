import os
import re
import json
import glob
import pickle
import shutil
import asyncio
import logging
import unicodedata
import hashlib
import sys
import time
from typing import List, Dict, Any

import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

from nano_graphrag import GraphRAG
from nano_graphrag._utils import wrap_embedding_func_with_attrs


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
ROOT_ENV_PATH = os.path.join(ROOT_DIR, ".env")
load_dotenv(dotenv_path=ROOT_ENV_PATH, override=True)


def _force_utf8_stdio():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


_force_utf8_stdio()

DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "knowledge-base", "kulliyat")
METADATA_FILE = os.path.join(BASE_DIR, "risale_metadata.pkl")
NANO_GRAPHRAG_WORK_DIR = os.path.join(BASE_DIR, "nano_graphrag_cache")
CHECKPOINT_FILE = os.path.join(NANO_GRAPHRAG_WORK_DIR, "ingest_checkpoint.json")
EMBEDDING_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

CHUNK_SIZE_CHARS = 3000
CHUNK_OVERLAP_CHARS = 500

# Test mode: process only first N chunks when not None.
TEST_MODE_LIMIT = None

# GraphRAG insertion batch size for checkpointed progress.
BATCH_SIZE = 25
MAX_API_CONCURRENCY = 12
DEEPSEEK_TIMEOUT_SEC = 60
DEEPSEEK_MAX_RETRIES = 2
INGEST_LLM_MODEL = "openai/gpt-4o-mini"
CHECKPOINT_WRITE_MAX_RETRIES = 5
CHECKPOINT_WRITE_RETRY_WAIT_SEC = 5

DEEPSEEK_API_KEY = os.getenv("OPENROUTER_API_KEY")
DEEPSEEK_CLIENT = OpenAI(
    api_key=DEEPSEEK_API_KEY or "sk-placeholder",
    base_url="https://openrouter.ai/api/v1",
    timeout=DEEPSEEK_TIMEOUT_SEC,
    max_retries=DEEPSEEK_MAX_RETRIES,
)


def normalize_alias(value: str) -> str:
    text = str(value or "").strip()
    text = text.replace("İ", "i").replace("I", "i").replace("ı", "i")
    text = text.lower()
    text = "".join(ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch))
    text = text.replace("ğ", "g").replace("ü", "u").replace("ş", "s")
    text = text.replace("ö", "o").replace("ç", "c")
    text = text.replace("â", "a").replace("î", "i").replace("û", "u")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def to_slug(value: str) -> str:
    return re.sub(r"\s+", "-", normalize_alias(value)).strip("-")


def extract_first_h1(text: str) -> str:
    match = re.search(r"^#\s+(.+?)\s*$", text or "", flags=re.MULTILINE)
    return match.group(1).strip() if match else ""


def parse_frontmatter_book_chapter(text: str) -> tuple[str, str]:
    fm = re.match(r"^---\s*\n([\s\S]*?)\n---\s*", text or "")
    if not fm:
        return "", ""

    values = {}
    for line in fm.group(1).splitlines():
        kv = re.match(r"^\s*([^:#\n]+)\s*:\s*(.*?)\s*$", line.strip())
        if kv:
            values[kv.group(1).strip().casefold()] = kv.group(2).strip().strip("\"").strip("'")

    book = values.get("kitap") or values.get("book") or ""
    chapter = values.get("bölüm") or values.get("bolum") or values.get("chapter") or ""
    return book, chapter


def derive_book_from_path(filepath: str) -> str:
    folder = os.path.basename(os.path.dirname(filepath)).replace("-", " ").replace("_", " ").strip()
    return " ".join(word.capitalize() for word in folder.split())


def strip_frontmatter(text: str) -> str:
    return re.sub(r"^---[\s\S]*?---\s*", "", text or "").strip()


def load_and_chunk_md_files(directory: str) -> List[Dict[str, Any]]:
    headers_to_split_on = [("#", "book"), ("##", "chapter"), ("###", "sub_chapter")]
    markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE_CHARS,
        chunk_overlap=CHUNK_OVERLAP_CHARS,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    files = glob.glob(os.path.join(directory, "**", "*.md"), recursive=True)
    logging.info("Found %s markdown files in %s", len(files), directory)

    all_chunks = []
    global_index = 0

    for filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()

        source_name = os.path.basename(filepath)
        fm_book, fm_chapter = parse_frontmatter_book_chapter(text)
        chapter_name = fm_chapter or extract_first_h1(text) or source_name.replace(".md", "")
        book_name = fm_book or derive_book_from_path(filepath)
        canonical_slug = to_slug(chapter_name)

        md_docs = markdown_splitter.split_text(text)
        for doc in md_docs:
            chunk_texts = text_splitter.split_text(doc.page_content)
            for chunk_text in chunk_texts:
                metadata = doc.metadata.copy()
                metadata["source"] = source_name
                metadata["book"] = book_name
                metadata["chapter"] = chapter_name
                metadata["risale_slug"] = source_name.replace(".md", "")
                metadata["risale_canonical_slug"] = canonical_slug
                metadata["original_order_index"] = global_index

                all_chunks.append({
                    "id": str(global_index),
                    "text": chunk_text,
                    "metadata": metadata,
                })
                global_index += 1

    logging.info("Total chunks created: %s", len(all_chunks))
    return all_chunks


def save_metadata(chunks: List[Dict[str, Any]]):
    with open(METADATA_FILE, "wb") as f:
        pickle.dump(chunks, f)
    logging.info("Metadata saved: %s (chunks=%s)", METADATA_FILE, len(chunks))


def make_graph_docs(chunks: List[Dict[str, Any]]) -> List[str]:
    docs = []
    for idx, chunk in enumerate(chunks):
        metadata = chunk.get("metadata", {}) if isinstance(chunk.get("metadata"), dict) else {}
        source = str(metadata.get("source") or "")
        book = str(metadata.get("book") or "")
        chapter = str(metadata.get("chapter") or "")
        canonical_slug = str(metadata.get("risale_canonical_slug") or "")
        text = re.sub(r"\s+", " ", strip_frontmatter(chunk.get("text", ""))).strip()
        docs.append(
            "\n".join(
                [
                    f"[CHUNK_ID:{idx}]",
                    f"[SOURCE:{source}]",
                    f"[BOOK:{book}]",
                    f"[CHAPTER:{chapter}]",
                    f"[SLUG:{canonical_slug}]",
                    text,
                ]
            )
        )
    return docs


def _make_embedding_model() -> SentenceTransformer:
    logging.info("Loading embedding model: %s", EMBEDDING_MODEL_NAME)
    return SentenceTransformer(EMBEDDING_MODEL_NAME, device="cpu")


def _make_embedding_func(model: SentenceTransformer):
    embedding_dim = int(model.get_sentence_embedding_dimension())

    @wrap_embedding_func_with_attrs(embedding_dim=embedding_dim, max_token_size=8192)
    async def _embed(texts: list[str]) -> np.ndarray:
        vectors = model.encode(texts, convert_to_numpy=True)
        return np.asarray(vectors, dtype=np.float32)

    return _embed


async def _deepseek_llm(prompt, system_prompt=None, **kwargs):
    full_prompt = str(system_prompt or "") + "\n\n" + str(prompt or "")
    response_format = kwargs.get("response_format") or {}

    def _call():
        return DEEPSEEK_CLIENT.chat.completions.create(
            model=INGEST_LLM_MODEL,
            messages=[{"role": "user", "content": full_prompt[:12000]}],
            temperature=0.1,
            stream=False,
            response_format=response_format if isinstance(response_format, dict) and response_format else None,
        )

    try:
        resp = await asyncio.to_thread(_call)
        return str(resp.choices[0].message.content or "")
    except Exception as exc:
        logging.warning("DeepSeek request failed (timeout/retry path): %s", exc)
        if isinstance(response_format, dict) and response_format.get("type") == "json_object":
            return json.dumps({"points": [{"description": "timeout_fallback", "score": 0.1}]}, ensure_ascii=False)
        return "timeout_fallback"


def _reset_workdir(path: str):
    if os.path.isdir(path):
        shutil.rmtree(path)
    os.makedirs(path, exist_ok=True)


def _install_clustering_fallback_if_needed(graphrag: GraphRAG):
    try:
        from graspologic.partition import hierarchical_leiden  # noqa: F401
        logging.info("graspologic available; default Leiden clustering will be used")
        return
    except Exception:
        logging.warning("graspologic unavailable; enabling fallback single-cluster mode")

    storage = graphrag.chunk_entity_relation_graph

    async def _fallback_leiden():
        graph = storage._graph
        node_communities = {
            node_id: [{"level": 1, "cluster": 0}]
            for node_id in graph.nodes()
        }
        storage._cluster_data_to_subgraphs(node_communities)
        logging.info("Fallback clustering applied: all nodes assigned to cluster=0")

    storage._clustering_algorithms["leiden"] = _fallback_leiden


def _is_timeout_like_error(exc: Exception) -> bool:
    message = str(exc or "").lower()
    timeout_keywords = ["timeout", "timed out", "read timeout", "connect timeout"]
    return any(keyword in message for keyword in timeout_keywords)


def _repair_corrupt_cache_json_files():
    if not os.path.isdir(NANO_GRAPHRAG_WORK_DIR):
        return

    checkpoint_abs = os.path.abspath(CHECKPOINT_FILE)
    for file_path in glob.glob(os.path.join(NANO_GRAPHRAG_WORK_DIR, "*.json")):
        abs_path = os.path.abspath(file_path)
        if abs_path == checkpoint_abs:
            continue

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                json.load(f)
        except json.JSONDecodeError as exc:
            backup_path = f"{file_path}.corrupt"
            try:
                if os.path.exists(backup_path):
                    os.remove(backup_path)
                os.replace(file_path, backup_path)
            except Exception as backup_exc:
                logging.warning("Corrupt JSON backup failed (%s): %s", file_path, backup_exc)

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump({}, f, ensure_ascii=False)

            logging.warning("Corrupt JSON repaired: %s (backup=%s, err=%s)", file_path, backup_path, exc)


def _limit_chunks_for_test_mode(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if TEST_MODE_LIMIT is None:
        logging.info("TEST_MODE_LIMIT=None; full ingestion mode")
        return chunks

    limited = chunks[: int(TEST_MODE_LIMIT)]
    logging.info("TEST_MODE_LIMIT=%s active; processing %s/%s chunks", TEST_MODE_LIMIT, len(limited), len(chunks))
    return limited


def _dataset_signature(chunks: List[Dict[str, Any]]) -> str:
    if not chunks:
        return "empty"

    basis = [
        str(len(chunks)),
        str(chunks[0].get("id") or ""),
        str(chunks[-1].get("id") or ""),
        str((chunks[0].get("metadata") or {}).get("source") or ""),
        str((chunks[-1].get("metadata") or {}).get("source") or ""),
    ]
    raw = "|".join(basis).encode("utf-8", errors="ignore")
    return hashlib.sha1(raw).hexdigest()


def _load_checkpoint() -> dict:
    if not os.path.exists(CHECKPOINT_FILE):
        return {}
    try:
        with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
            payload = json.load(f)
        if isinstance(payload, dict):
            return payload
    except Exception as exc:
        logging.warning("Checkpoint read failed; restarting from scratch: %s", exc)
    return {}


def _save_checkpoint(payload: dict):
    os.makedirs(NANO_GRAPHRAG_WORK_DIR, exist_ok=True)
    last_error = None
    for attempt in range(1, CHECKPOINT_WRITE_MAX_RETRIES + 1):
        try:
            with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            return
        except Exception as exc:
            last_error = exc
            logging.warning(
                "Checkpoint write failed (attempt %s/%s): %s",
                attempt,
                CHECKPOINT_WRITE_MAX_RETRIES,
                exc,
            )
            if attempt < CHECKPOINT_WRITE_MAX_RETRIES:
                time.sleep(CHECKPOINT_WRITE_RETRY_WAIT_SEC)

    raise RuntimeError(f"Checkpoint write failed after retries: {last_error}")


def _prepare_run(chunks: List[Dict[str, Any]]) -> tuple[int, dict]:
    signature = _dataset_signature(chunks)
    total = len(chunks)
    checkpoint = _load_checkpoint()

    if checkpoint:
        same_dataset = checkpoint.get("dataset_signature") == signature
        same_total = int(checkpoint.get("total_chunks") or -1) == total
        processed = int(checkpoint.get("processed_chunks") or 0)

        if same_dataset and same_total and 0 <= processed <= total:
            logging.info(
                "Checkpoint found: resume from %s/%s (last_completed_batch=%s)",
                processed,
                total,
                checkpoint.get("last_completed_batch", 0),
            )
            return processed, checkpoint

        # Allow seamless continuation from a smaller completed test-mode run.
        previous_total = int(checkpoint.get("total_chunks") or -1)
        if 0 < processed <= previous_total < total:
            logging.info(
                "Checkpoint from smaller run detected: continue from %s/%s into full dataset (%s)",
                processed,
                previous_total,
                total,
            )
            checkpoint.update(
                {
                    "dataset_signature": signature,
                    "total_chunks": total,
                    "test_mode_limit": TEST_MODE_LIMIT,
                    "status": "running",
                }
            )
            _save_checkpoint(checkpoint)
            return processed, checkpoint

        logging.info("Checkpoint incompatible with current dataset; cache reset required")

    logging.info("Starting fresh run: resetting GraphRAG work dir")
    _reset_workdir(NANO_GRAPHRAG_WORK_DIR)
    fresh = {
        "dataset_signature": signature,
        "total_chunks": total,
        "processed_chunks": 0,
        "batch_size": BATCH_SIZE,
        "test_mode_limit": TEST_MODE_LIMIT,
        "last_completed_batch": 0,
        "status": "running",
    }
    _save_checkpoint(fresh)
    return 0, fresh


def build_graphrag_cache(chunks: List[Dict[str, Any]]):
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY not found")
    if not chunks:
        raise RuntimeError("No chunks available for GraphRAG ingestion")

    chunks = _limit_chunks_for_test_mode(chunks)
    resume_from, checkpoint = _prepare_run(chunks)
    _repair_corrupt_cache_json_files()

    model = _make_embedding_model()
    graphrag = GraphRAG(
        working_dir=NANO_GRAPHRAG_WORK_DIR,
        enable_local=True,
        enable_naive_rag=False,
        always_create_working_dir=True,
        enable_llm_cache=False,
        best_model_max_async=MAX_API_CONCURRENCY,
        cheap_model_max_async=MAX_API_CONCURRENCY,
        embedding_func_max_async=MAX_API_CONCURRENCY,
        embedding_func=_make_embedding_func(model),
        best_model_func=_deepseek_llm,
        cheap_model_func=_deepseek_llm,
    )
    _install_clustering_fallback_if_needed(graphrag)

    docs = make_graph_docs(chunks)
    total = len(docs)
    if resume_from >= total:
        logging.info("All chunks already processed according to checkpoint (%s/%s)", resume_from, total)
        checkpoint["status"] = "completed"
        _save_checkpoint(checkpoint)
        return

    remaining = total - resume_from
    total_batches = (remaining + BATCH_SIZE - 1) // BATCH_SIZE
    logging.info(
        "GraphRAG insert started: total=%s resume_from=%s remaining=%s batch_size=%s batches=%s",
        total,
        resume_from,
        remaining,
        BATCH_SIZE,
        total_batches,
    )

    for batch_no, start_idx in enumerate(range(resume_from, total, BATCH_SIZE), start=1):
        end_idx = min(start_idx + BATCH_SIZE, total)
        logging.info("Batch %s/%s isleniyor... (chunk %s-%s)", batch_no, total_batches, start_idx, end_idx - 1)

        batch_docs = docs[start_idx:end_idx]
        logging.info("DeepSeek'e toplu gonderiliyor... batch_docs=%s", len(batch_docs))
        try:
            graphrag.insert(batch_docs)
        except Exception as exc:
            if _is_timeout_like_error(exc):
                logging.warning("Batch %s timeout aldi; sonraki batch'e geciliyor: %s", batch_no, exc)
                continue
            raise

        processed = end_idx
        checkpoint.update(
            {
                "processed_chunks": processed,
                "last_completed_batch": int(checkpoint.get("last_completed_batch", 0)) + 1,
                "status": "running",
            }
        )
        _save_checkpoint(checkpoint)
        logging.info("Batch %s tamamlandi. Checkpoint kaydedildi: %s/%s", batch_no, processed, total)
        time.sleep(1)

    checkpoint["status"] = "completed"
    _save_checkpoint(checkpoint)
    logging.info("GraphRAG cache ready at: %s", NANO_GRAPHRAG_WORK_DIR)
    logging.info("Ingest tamamlandi. Checkpoint status=completed")


if __name__ == "__main__":
    if not os.path.exists(DATA_DIR):
        raise FileNotFoundError(f"Knowledge base directory not found: {DATA_DIR}")

    chunks = load_and_chunk_md_files(DATA_DIR)
    save_metadata(chunks)
    build_graphrag_cache(chunks)
    logging.info("Ingestion complete (GraphRAG native pipeline)")
