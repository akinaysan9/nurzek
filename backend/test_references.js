import { search, buildIndex } from './services/rag.js';

async function test() {
    try {
        console.log("Building Index...");
        const count = buildIndex();
        console.log(`Indexed ${count} items.`);

        console.log("Searching for 'iman'...");
        const results = search('iman', 5);
        console.log("Results:", results);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
