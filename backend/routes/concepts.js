import express from 'express';
import { all, run } from '../db/database.js';
import { authMiddleware as authenticateToken } from './auth.js';

const router = express.Router();

// Middleware for authentication
const authMiddleware = authenticateToken;

// Check if a concept has been analyzed before
router.get('/check', authMiddleware, (req, res) => {
    const { q } = req.query;
    const userId = req.user.id;

    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

    const searchTerm = `%${q.trim()}%`;

    const sql = `
        SELECT id, concept, book_slug, chapter_slug, created_at, substr(response, 1, 100) as preview 
        FROM concept_logs 
        WHERE user_id = ? AND (concept LIKE ? OR query LIKE ?) 
        ORDER BY created_at DESC 
        LIMIT 5
    `;

    try {
        const rows = all(sql, [userId, searchTerm, searchTerm]);
        res.json({
            exists: rows.length > 0,
            matches: rows
        });
    } catch (err) {
        console.error('Check concept error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Log a new analysis
router.post('/log', authMiddleware, (req, res) => {
    const { concept, query, response, book_slug, chapter_slug, context_text } = req.body;
    const userId = req.user.id;

    const sql = `
        INSERT INTO concept_logs (user_id, concept, query, response, book_slug, chapter_slug, context_text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        run(sql, [userId, concept, query, response, book_slug, chapter_slug, context_text]);
        res.json({ success: true, message: 'Analiz kaydedildi.' });
    } catch (err) {
        console.error('Log concept error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get workspace data (previous concepts for this chapter)
router.get('/workspace/:book/:chapter', authMiddleware, (req, res) => {
    const { book, chapter } = req.params;
    const userId = req.user.id;

    const sql = `
        SELECT * FROM concept_logs 
        WHERE user_id = ? AND book_slug = ? AND chapter_slug = ?
        ORDER BY created_at DESC
    `;

    try {
        const rows = all(sql, [userId, book, chapter]);
        res.json({
            concepts: rows
        });
    } catch (err) {
        console.error('Workspace data error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
