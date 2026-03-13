
// Embedding Service (Local - Xenova)
// Reverted to L12 for Quality

import { pipeline } from '@xenova/transformers';

const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'; // High Quality
let extractor = null;

// Singleton pattern to load model once
export async function getExtractor() {
    if (!extractor) {
        console.log(`Loading local embedding model: ${MODEL_NAME}...`);
        extractor = await pipeline('feature-extraction', MODEL_NAME, {
            quantized: true,
        });
    }
    return extractor;
}

export async function getEmbedding(text) {
    const pipe = await getExtractor();

    // Normalize text: remove newlines, multiple spaces
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Generate embedding
    const output = await pipe(cleanText, { pooling: 'mean', normalize: true });

    // Convert to regular array
    const embedding = Array.from(output.data);

    // Verify dimension (384 for MiniLM-L12-v2)
    if (embedding.length !== 384) {
        console.warn(`Warning: Embedding dimension mismatch. Expected 384, got ${embedding.length}`);
    }

    return embedding;
}

export default { getEmbedding };
