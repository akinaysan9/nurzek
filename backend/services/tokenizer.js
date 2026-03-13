
import { getEncoding } from 'js-tiktoken';

// Use cl100k_base which is standard for GPT-4 and modern embeddings
const enc = getEncoding("cl100k_base");

export const Tokenizer = {
    encode: (text) => {
        return enc.encode(text);
    },

    decode: (tokens) => {
        return enc.decode(tokens);
    },

    count: (text) => {
        // Handling possible non-string inputs safely
        if (typeof text !== 'string') return 0;
        return enc.encode(text).length;
    }
};

export default Tokenizer;
