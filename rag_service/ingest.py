import os
import glob
import json
import re
from typing import List, Dict, Any
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
import faiss
import numpy as np
import pickle
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Constants
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "knowledge-base", "kulliyat")
INDEX_FILE = os.path.join(os.path.dirname(__file__), "risale_index.faiss")
METADATA_FILE = os.path.join(os.path.dirname(__file__), "risale_metadata.pkl")
BM25_FILE = os.path.join(os.path.dirname(__file__), "bm25_index.pkl")
CITATION_GRAPH_FILE = os.path.join(os.path.dirname(__file__), "citation_graph.json")
# Keep this in sync with rag_service/app.py so the runtime uses the same embedding model as the index.
EMBEDDING_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
CHUNK_SIZE_TOKENS = 800  # Target ~750-900
CHUNK_OVERLAP_TOKENS = 125 # Target ~100-150
# Estimating 1 token ~= 4 chars for a rough cut, but we'll try to respect sentence boundaries
# Turkish might be slightly different, but 3000 chars is a good starting point for 750 tokens
CHUNK_SIZE_CHARS = 3000
CHUNK_OVERLAP_CHARS = 500

FRONTMATTER_RE = re.compile(r"^---\s*\n([\s\S]*?)\n---\s*", flags=re.MULTILINE)
KV_RE = re.compile(r"^\s*([^:#\n]+)\s*:\s*(.*?)\s*$")

def parse_frontmatter_book_chapter(text: str) -> tuple[str, str]:
    """Extract kitap/bölüm from markdown frontmatter and map to book/chapter."""
    fm_match = FRONTMATTER_RE.match(text or "")
    if not fm_match:
        return "", ""

    frontmatter = fm_match.group(1)
    values = {}
    for line in frontmatter.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        kv_match = KV_RE.match(line)
        if not kv_match:
            continue
        key = kv_match.group(1).strip().casefold()
        raw_val = kv_match.group(2).strip().strip('"').strip("'")
        values[key] = raw_val

    # Accept both Turkish and ASCII variants for robustness.
    book = values.get("kitap") or values.get("book") or ""
    chapter = values.get("bölüm") or values.get("bolum") or values.get("chapter") or ""
    return book, chapter

def load_and_chunk_md_files(directory: str, citation_by_section: dict = None) -> List[Dict[str, Any]]:
    headers_to_split_on = [
        ("#", "book"),
        ("##", "chapter"),
        ("###", "sub_chapter"),
    ]
    
    markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
    
    # Text splitter for chunking within the markdown sections
    # Using a large chunk size to hit the token target, respecting sentence boundaries
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE_CHARS,
        chunk_overlap=CHUNK_OVERLAP_CHARS,
        separators=["\n\n", "\n", ". ", " ", ""], # Try to split at paragraph or sentence level
        length_function=len,
    )

    all_chunks = []
    global_index = 0
    
    files = glob.glob(os.path.join(directory, "**", "*.md"), recursive=True)
    print(f"DEBUG: Searching in: {directory}")
    print(f"DEBUG: Absolute path: {os.path.abspath(directory)}")
    print(f"DEBUG: Files found: {len(files)}")
    logging.info(f"Found {len(files)} markdown files in {directory}...")
    
    for filepath in files:
        logging.info(f"Processing {filepath}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()

        fm_book, fm_chapter = parse_frontmatter_book_chapter(text)
            
        # 1. Split by Markdown Headers to get structural context
        md_docs = markdown_splitter.split_text(text)
        
        # 2. Further split into token-sized chunks, preserving metadata
        for doc in md_docs:
            chunks = text_splitter.split_text(doc.page_content)
            
            for chunk_text in chunks:
                # Combine metadata
                metadata = doc.metadata.copy()
                metadata['original_order_index'] = global_index
                metadata['source'] = os.path.basename(filepath)

                # Prefer explicit frontmatter mapping: kitap -> book, bölüm -> chapter
                if fm_book:
                    metadata['book'] = fm_book
                elif 'book' not in metadata or not metadata.get('book'):
                    metadata['book'] = "Unknown"

                if fm_chapter:
                    metadata['chapter'] = fm_chapter
                elif 'chapter' not in metadata or not metadata.get('chapter'):
                    metadata['chapter'] = "Unknown"

                if 'sub_chapter' not in metadata: metadata['sub_chapter'] = "General"

                # Enrich with citation graph data
                section_key = metadata.get('chapter', 'Unknown')
                if section_key == 'Unknown':
                    section_key = metadata.get('book', 'Unknown')

                if citation_by_section and section_key != 'Unknown':
                    graph_entry = citation_by_section.get(section_key, {})
                    metadata['cites'] = graph_entry.get('verdigii_atiflar', [])
                    metadata['cited_by'] = graph_entry.get('bu_bolume_atif_yapanlar', [])
                else:
                    metadata['cites'] = []
                    metadata['cited_by'] = []

                all_chunks.append({
                    "text": chunk_text,
                    "metadata": metadata
                })
                global_index += 1
                
    logging.info(f"Total chunks created: {len(all_chunks)}")
    return all_chunks

def create_vector_db(chunks: List[Dict[str, Any]]):
    logging.info("Loading embedding model...")
    model = SentenceTransformer(EMBEDDING_MODEL_NAME, device='cpu') # Force CPU
    
    texts = [chunk['text'] for chunk in chunks]
    logging.info("Generating embeddings...")
    embeddings = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
    
    # HNSW Index
    d = embeddings.shape[1]
    # HNSW64 for better recall, or HNSW32 for speed. 
    # Using HNSW32 as a balance for the requested "CPU optimized" spec
    index = faiss.IndexHNSWFlat(d, 32) 
    index.add(embeddings)
    
    logging.info(f"Index created with {index.ntotal} vectors.")
    return index

def tokenize_for_bm25(text: str) -> list[str]:
    return re.findall(r"[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû0-9']+", (text or "").lower())

def create_bm25_index(chunks: List[Dict[str, Any]]):
    tokenized_corpus = [tokenize_for_bm25(chunk.get('text', '')) for chunk in chunks]
    bm25 = BM25Okapi(tokenized_corpus)
    logging.info(f"BM25 index created with {len(tokenized_corpus)} documents.")
    return bm25

def save_system(index, chunks, bm25_index, index_path, metadata_path, bm25_path):
    logging.info(f"Saving index to {index_path}...")
    faiss.write_index(index, index_path)
    
    logging.info(f"Saving metadata to {metadata_path}...")
    with open(metadata_path, 'wb') as f:
        pickle.dump(chunks, f)

    logging.info(f"Saving BM25 index to {bm25_path}...")
    with open(bm25_path, 'wb') as f:
        pickle.dump(bm25_index, f)

if __name__ == "__main__":
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        logging.warning(f"Created {DATA_DIR}. Please add .md files there and run again.")
    else:
        # Load citation graph for metadata enrichment
        citation_by_section = {}
        if os.path.exists(CITATION_GRAPH_FILE):
            with open(CITATION_GRAPH_FILE, 'r', encoding='utf-8') as f:
                cg = json.load(f)
            citation_by_section = cg.get('by_section', {})
            logging.info(f"Citation graph loaded: {len(citation_by_section)} sections")
        else:
            logging.warning("citation_graph.json not found — skipping citation metadata enrichment")

        chunks = load_and_chunk_md_files(DATA_DIR, citation_by_section=citation_by_section)
        if chunks:
            index = create_vector_db(chunks)
            bm25_index = create_bm25_index(chunks)
            save_system(index, chunks, bm25_index, INDEX_FILE, METADATA_FILE, BM25_FILE)
            logging.info("Ingestion complete!")
        else:
            logging.warning("No chunks generated. Check if data folder has valid .md files.")
