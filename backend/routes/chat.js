
// Chat Routes - NurZeka V2 Adapter
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryNurZeka, ragQuery } from '../services/rag.js';
import { optionalAuth } from './auth.js';
import { run } from '../db/database.js';

const router = Router();

// POST /api/chat - Standard (Blocking)
router.post('/', optionalAuth, async (req, res) => {
    try {
        const { question, conversationHistory, conversationId, book_hint, chapter_hint } = req.body;
        if (!question) return res.status(400).json({ error: 'Soru gerekli' });

        const result = await ragQuery(question, {
            conversationId,
            userId: req.user ? req.user.id : null,
            book_hint,
            chapter_hint,
            conversationHistory: Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : []
        }); // Uses V2 Blocking Adapter

        // Save History (Legacy sync, the new message system is handled by Python/Search)
        if (req.user && !conversationId) {
            run(
                'INSERT INTO chat_history (id, user_id, question, answer, sources, ai_model) VALUES (?, ?, ?, ?, ?, ?)',
                [uuidv4(), req.user.id, question, result.answer, "[]", result.model]
            );
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET/POST /api/chat/stream - Streaming (V2 Protocol)
router.all('/stream', optionalAuth, (req, res) => {
    const question = req.query.question || req.body.question;
    const conversationId = req.query.conversationId || req.body.conversationId;

    if (!question) return res.status(400).send("No question provided");

    // SSE Headers
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Use V2 callback to write to express response
    queryNurZeka(
        question,
        (token) => res.write(token),
        () => res.end(),
        (err) => {
            console.error("Stream Error:", err);
            res.write(`\n[HATA: ${err}]`);
            res.end();
        },
        {
            conversationId,
            userId: req.user ? req.user.id : null
        }
    );
});

export default router;
