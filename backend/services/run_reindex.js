import { buildIndex } from './rag.js';

console.log('Starting manual re-index...');
buildIndex().then(() => {
    console.log('Re-index complete.');
    process.exit(0);
}).catch(err => {
    console.error('Re-index failed:', err);
    process.exit(1);
});
