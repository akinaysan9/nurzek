import os
import glob
from typing import List, Dict, Any
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
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
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
CHUNK_SIZE_TOKENS = 800  # Target ~750-900
CHUNK_OVERLAP_TOKENS = 125 # Target ~100-150
# Estimating 1 token ~= 4 chars for a rough cut, but we'll try to respect sentence boundaries
# Turkish might be slightly different, but 3000 chars is a good starting point for 750 tokens
CHUNK_SIZE_CHARS = 3000
CHUNK_OVERLAP_CHARS = 500

def load_and_chunk_md_files(directory: str) -> List[Dict[str, Any]]:
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
                
                # Ensure all keys exist
                if 'book' not in metadata: metadata['book'] = "Unknown"
                if 'chapter' not in metadata: metadata['chapter'] = "Unknown"
                if 'sub_chapter' not in metadata: metadata['sub_chapter'] = "General"

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

def save_system(index, chunks, index_path, metadata_path):
    logging.info(f"Saving index to {index_path}...")
    faiss.write_index(index, index_path)
    
    logging.info(f"Saving metadata to {metadata_path}...")
    with open(metadata_path, 'wb') as f:
        pickle.dump(chunks, f)

if __name__ == "__main__":
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        logging.warning(f"Created {DATA_DIR}. Please add .md files there and run again.")
    else:
        chunks = load_and_chunk_md_files(DATA_DIR)
        if chunks:
            index = create_vector_db(chunks)
            save_system(index, chunks, INDEX_FILE, METADATA_FILE)
            logging.info("Ingestion complete!")
        else:
            logging.warning("No chunks generated. Check if data folder has valid .md files.")
