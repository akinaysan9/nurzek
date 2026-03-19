"""
NurZeka - FAISS + BM25 Index Builder
API harcamaz. Sadece lokal SentenceTransformer kullanır.
Kullanım: python rag_service/build_index.py
"""

import os
import glob
import pickle
import logging
import re
import unicodedata
from typing import List, Dict, Any

import numpy as np
import faiss
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

DATA_DIR = os.path.join(ROOT_DIR, "knowledge-base", "kulliyat")
INDEX_PATH = os.path.join(BASE_DIR, "risale_index.faiss")
METADATA_PATH = os.path.join(BASE_DIR, "risale_metadata.pkl")
BM25_INDEX_PATH = os.path.join(BASE_DIR, "bm25_index.pkl")

EMBEDDING_MODEL_NAME = "BAAI/bge-m3"
CHUNK_SIZE_CHARS = 3000
CHUNK_OVERLAP_CHARS = 500
BATCH_SIZE = 256  # GPU batch size


def strip_frontmatter(text: str) -> str:
    return re.sub(r"^---\s*\n.*?\n---\s*\n", "", text, flags=re.DOTALL)


def extract_first_h1(text: str) -> str:
    m = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    return m.group(1).strip() if m else ""


def parse_frontmatter_book_chapter(text: str):
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not m:
        return None, None
    fm = m.group(1)
    book_m = re.search(r'kitap:\s*"([^"]+)"', fm)
    chap_m = re.search(r'bölüm:\s*"([^"]+)"', fm)
    return (book_m.group(1) if book_m else None), (chap_m.group(1) if chap_m else None)


def derive_book_from_path(filepath: str) -> str:
    parts = filepath.replace("\\", "/").split("/")
    try:
        kb_idx = parts.index("kulliyat")
        return parts[kb_idx + 1] if kb_idx + 1 < len(parts) else "Bilinmiyor"
    except ValueError:
        return "Bilinmiyor"


def to_slug(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "-", text).strip("-")


def tokenize_for_bm25(text: str) -> List[str]:
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return [t for t in text.split() if len(t) > 1]


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
    logging.info("Bulunan .md dosyası: %s", len(files))

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

    logging.info("Toplam chunk: %s", len(all_chunks))
    return all_chunks


def build_faiss_index(chunks: List[Dict[str, Any]], model: SentenceTransformer):
    texts = [c["text"] for c in chunks]
    logging.info("Vektörler hesaplanıyor (%s chunk, batch=%s)...", len(texts), BATCH_SIZE)

    all_vectors = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        vecs = model.encode(batch, convert_to_numpy=True, show_progress_bar=False)
        all_vectors.append(vecs)
        if (i // BATCH_SIZE) % 10 == 0:
            logging.info("  %s / %s chunk işlendi", i + len(batch), len(texts))

    vectors = np.vstack(all_vectors).astype("float32")
    dim = vectors.shape[1]

    logging.info("FAISS index oluşturuluyor (dim=%s)...", dim)
    index = faiss.IndexFlatL2(dim)
    index.add(vectors)

    faiss.write_index(index, INDEX_PATH)
    logging.info("FAISS index kaydedildi: %s (%s vektör)", INDEX_PATH, index.ntotal)
    return index


def build_bm25_index(chunks: List[Dict[str, Any]]):
    logging.info("BM25 index oluşturuluyor...")
    tokenized = [tokenize_for_bm25(c["text"]) for c in chunks]
    bm25 = BM25Okapi(tokenized)
    with open(BM25_INDEX_PATH, "wb") as f:
        pickle.dump(bm25, f)
    logging.info("BM25 index kaydedildi: %s", BM25_INDEX_PATH)


def save_metadata(chunks: List[Dict[str, Any]]):
    with open(METADATA_PATH, "wb") as f:
        pickle.dump(chunks, f)
    logging.info("Metadata kaydedildi: %s (%s chunk)", METADATA_PATH, len(chunks))


if __name__ == "__main__":
    if not os.path.exists(DATA_DIR):
        raise FileNotFoundError(f"Knowledge base klasörü bulunamadı: {DATA_DIR}")

    logging.info("Model yükleniyor: %s", EMBEDDING_MODEL_NAME)
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logging.info("Cihaz: %s", device)
    model = SentenceTransformer(EMBEDDING_MODEL_NAME, device=device)

    chunks = load_and_chunk_md_files(DATA_DIR)
    save_metadata(chunks)
    build_faiss_index(chunks, model)
    build_bm25_index(chunks)

    logging.info("=== BUILD TAMAMLANDI ===")
    logging.info("FAISS: %s", INDEX_PATH)
    logging.info("BM25:  %s", BM25_INDEX_PATH)
    logging.info("Meta:  %s", METADATA_PATH)
