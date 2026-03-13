import sys
# Mock faiss 
class MockIndex:
    def __init__(self, d, metric):
        self.d = d
        self.ntotal = 0
    def add(self, vectors):
        self.ntotal += len(vectors)
    def search(self, query, k):
        return [[0.1]*k], [[0]*k]

class MockModule:
    IndexHNSWFlat = MockIndex
    write_index = lambda x, y: None
    read_index = lambda x: MockIndex(384, None)

sys.modules['faiss'] = MockModule()

# Mock sentence_transformers
class MockModel:
    def __init__(self, name, device):
        pass
    def encode(self, texts, show_progress_bar=True, convert_to_numpy=True):
        import numpy as np
        return np.random.rand(len(texts), 384)

class MockST:
    SentenceTransformer = MockModel

sys.modules['sentence_transformers'] = MockST()
sys.modules['sentence_transformers.SentenceTransformer'] = MockModel

# Mock Llama
class MockLlama:
    def __init__(self, model_path, n_ctx, n_threads, n_batch, verbose):
        pass
    def __call__(self, prompt, max_tokens, stop, echo):
        return {'choices': [{'text': "Mock response"}]}

sys.modules['llama_cpp'] = type('module', (), {'Llama': MockLlama})

# Now import ingestion and run it
import ingest
try:
    chunks = ingest.load_and_chunk_md_files("rag_service/data")
    print(f"Chunks generated: {len(chunks)}")
    if len(chunks) > 0:
        print(f"First chunk metadata: {chunks[0]['metadata']}")
except Exception as e:
    print(f"Error: {e}")
