
import { pipeline } from '@xenova/transformers';

async function test() {
    console.log("Testing model...");
    try {
        const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log("Model loaded successfully!");
        const out = await pipe("Merhaba dünya", { pooling: 'mean', normalize: true });
        console.log("Output shape:", out.data.length);
    } catch (e) {
        console.error("Failed:", e);
    }
}
test();
