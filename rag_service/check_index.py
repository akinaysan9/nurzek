import faiss
import pickle
import os

INDEX_PATH = "rag_service/risale_index.faiss"
METADATA_PATH = "rag_service/risale_metadata.pkl"

print("Checking RAG Index Status...")

if os.path.exists(INDEX_PATH):
    index = faiss.read_index(INDEX_PATH)
    print(f"✅ FAISS Index Found at: {INDEX_PATH}")
    print(f"📊 Total Vectors in Index: {index.ntotal}")
else:
    print(f"❌ FAISS Index NOT FOUND at: {INDEX_PATH}")

if os.path.exists(METADATA_PATH):
    with open(METADATA_PATH, 'rb') as f:
        chunks = pickle.load(f)
    print(f"✅ Metadata Found at: {METADATA_PATH}")
    print(f"📊 Total Chunks in Metadata: {len(chunks)}")
    if chunks:
        print(f"📝 Sample Chunk 1: {chunks[0].get('text', '')[:50]}...")
else:
    print(f"❌ Metadata NOT FOUND at: {METADATA_PATH}")

print("\nIf Total Vectors is 0, please run: python rag_service/ingest.py")
