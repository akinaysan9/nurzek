
import { buildIndex, search } from './services/search_engine.js';

console.log('--- Testing Search Engine ---');

try {
    console.log('1. Building Index...');
    const count = buildIndex();
    console.log(`   Index built with ${count} items.`);

    if (count === 0) {
        console.error('CRITICAL: Index is empty! Check KB_DIR path.');
        process.exit(1);
    }

    console.log('2. performing search...');
    const results = search('iman', 5);
    console.log('   Results found:', results.length);

    if (results.length > 0) {
        console.log('   First result:', results[0].metadata.title);
    } else {
        console.warn('   No results found for "iman".');
    }

} catch (error) {
    console.error('CRITICAL ERROR:', error);
}
