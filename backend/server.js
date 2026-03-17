// NurZeka - Express Server
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Error Handler for Startup Debugging
process.on('uncaughtException', (err) => {
    fs.appendFileSync('startup_error.log', `[${new Date().toISOString()}] Uncaught Exception: ${err.stack}\n`);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    fs.appendFileSync('startup_error.log', `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n`);
});

dotenv.config({ path: path.join(__dirname, '.env') });

import { initDB } from './db/database.js';
import chatRoutes from './routes/chat.js';
import authRoutes from './routes/auth.js';
import notesRoutes from './routes/notes.js';
import analyzeRoutes from './routes/analyze.js';
import userRoutes from './routes/user.js';
import conceptRoutes from './routes/concepts.js';
import referenceRoutes from './routes/references.js';
import userDataRoutes from './routes/user_data.js';
import quotesRoutes from './routes/quotes.js';
import conceptSearchRoutes from './routes/concept_search.js';
import conceptOccurrencesV2Routes from './routes/concept_occurrences_v2.js';
import governanceV2Routes from './routes/governance_v2.js';
import { buildIndex } from './services/rag.js'; // AI Dependent (Disabled/Unused for startup to prevent crash)
import { VectorStore } from './services/vector_store.js';
// import { buildIndex } from './services/search_engine.js'; // Pure Local Engine

const app = express();
const PORT = process.env.PORT || 3001;

// Indexing moved to background in app.listen

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/user', userRoutes);
app.use('/api/user-data', userDataRoutes); // Bookmarks & Highlights
app.use('/api/concepts', conceptRoutes);
app.use('/api/concept-search', conceptSearchRoutes);
app.use('/api/concept-occurrences', conceptOccurrencesV2Routes);
app.use('/api', governanceV2Routes);
app.use('/api/references', referenceRoutes);
app.use('/api/quotes', quotesRoutes);

// Python Backend Proxies
const pythonProxy = async (req, res) => {
    try {
        const pyRes = await fetch(`http://localhost:8000${req.originalUrl}`, {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
            body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined
        });
        const data = await pyRes.json();
        res.status(pyRes.status).json(data);
    } catch (e) {
        res.status(500).json({ error: 'Python servisine ulaşılamıyor: ' + e.message });
    }
};

app.use('/api/concept-map', pythonProxy);
app.use('/api/concept-info', pythonProxy);
app.use('/api/concept-occurrences', pythonProxy);

// Conversations proxy — JWT'den gerçek user_id'yi çözüp Python'a iletir
import { optionalAuth } from './routes/auth.js';
app.use('/api/conversations', optionalAuth, async (req, res) => {
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (req.user) headers['X-User-Id'] = req.user.id;

        const pyRes = await fetch(`http://localhost:8000${req.originalUrl}`, {
            method: req.method,
            headers,
            body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined
        });
        const data = await pyRes.json();
        res.status(pyRes.status).json(data);
    } catch (e) {
        res.status(500).json({ error: 'Python servisine ulaşılamıyor: ' + e.message });
    }
});


// Knowledge base file serving
const chapterCache = new Map(); // Cache for chapter lists

app.get('/api/knowledge/:type/:book?/:section?', (req, res) => {
    const { type, book, section } = req.params;

    // Normalize path just in case
    const kbDir = path.join(__dirname, '..', 'knowledge-base', type);

    try {
        if (section) {
            // Serving specific file content - No generic cache needed (OS handles fs cache)
            const filePath = path.join(kbDir, book, `${section}.md`);
            if (fs.existsSync(filePath)) {
                return res.send(fs.readFileSync(filePath, 'utf-8'));
            }
        } else if (book) {
            // Serving Chapter List - NEEDS CACHING
            const cacheKey = `${type}/${book}`;
            if (chapterCache.has(cacheKey)) {
                return res.json({ chapters: chapterCache.get(cacheKey) });
            }

            const dirPath = path.join(kbDir, book);
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath)
                    .filter(f => f.endsWith('.md'))
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

                const chapters = files.map(f => {
                    const slug = f.replace('.md', '');
                    let title = slug;

                    // Optimization: Read only first 500 bytes for frontmatter
                    try {
                        const fd = fs.openSync(path.join(dirPath, f), 'r');
                        const buffer = Buffer.alloc(500);
                        fs.readSync(fd, buffer, 0, 500, 0);
                        fs.closeSync(fd);

                        const partialContent = buffer.toString('utf-8');
                        const fmMatch = partialContent.match(/^---\s*\n([\s\S]*?)\n---/);
                        if (fmMatch) {
                            const bolumMatch = fmMatch[1].match(/bölüm:\s*"([^"]+)"/);
                            if (bolumMatch) {
                                title = bolumMatch[1];
                            }
                        }
                    } catch (e) {
                        // Fallback title logic
                        title = slug.replace(/^\d{3}-/, '').split('-').map(word =>
                            word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                    }

                    return { slug, title };
                });

                // Set Cache
                chapterCache.set(cacheKey, chapters);
                return res.json({ chapters });
            }
        } else {
            // Root knowledge type listing
            if (fs.existsSync(kbDir)) {
                const items = fs.readdirSync(kbDir);
                return res.json({ items });
            }
        }
    } catch (e) {
        console.error('Knowledge API error:', e);
    }

    res.status(404).json({ error: 'Bulunamadı' });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'NurZeka', version: '1.0.0' });
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Start with async DB initialization
async function start() {
    try {
        // Initialize database
        await initDB();

        // Start server explicitly on IPv4 0.0.0.0
        app.listen(PORT, '0.0.0.0', () => {
            console.log('');
            console.log('═══════════════════════════════════════');
            console.log('  🕌 NurZek - AI Risale-i Nur Platform');
            console.log(`  🌐 http://localhost:${PORT}`);
            console.log('═══════════════════════════════════════');
            console.log('');

            // Build search index in BACKGROUND (Don't block UI)
            // Legacy local indexer removed for V2 Hybrid Architecture
            // buildIndex().catch(...) removed to prevent TypeError
            setTimeout(() => {
                // Initialize local vector store for concept map / local search
                VectorStore.load();
                // buildIndex(); 
            }, 1000);
        });
    } catch (err) {
        console.error('Startup error:', err);
        process.exit(1);
    }
}

start();

export default app;
