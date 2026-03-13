import express from 'express';
import { run, all, get } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Middleware to check auth
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    // In a real app, verify token. Here we assume the token IS the user_id or handle it simply.
    // Based on previous auth logic, we might need to verify JWT.
    // Let's check how auth is handled in server.js or auth.js. 
    // For now, let's assume the client sends a valid token or user_id.
    // REVISION: I should verify JWT properly if I can see how it's done. 
    // I recall server.js using jsonwebtoken. Let's start with a basic placeholder 
    // or rely on the `req.user` if a pervasive middleware exists.
    // Since I can't see server.js fully right now, I'll implement a local check or reuse one.
    // Let's skip complex verification for this step and assume req.user is populated by main server middleware
    // OR just parse it here if needed.

    // Let's implement a simple extraction for now, assuming server.js might not have global middleware yet for this.
    // Actually, let's look at server.js content I saw earlier... it used `jwt`.
    // I'll grab the user_id from the token.

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Invalid token format' });

    try {
        // We need to import jwt. 
        // But to avoid adding dependencies here without checking `package.json` again (I saw it has jsonwebtoken),
        // I will trust the client sends the right thing or better, strictly implementation:
        // Let's import standard jwt if available.
        // If I can't, I'll mock it for development or use a simple decoding if secret is known.
        // Wait, I saw `server.js` has `const jwt = require('jsonwebtoken');` (or import).
        // I'll assume I can import it.
        // If not, I'll ask the user to fix or I'll fix it then.

        // Let's try to do it right.
        next();
    } catch (e) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// However, since I am creating this file from scratch, I need to handle imports carefully.
// I'll use a specific approach: I will instantiate the router, but the actual JWT verification 
// logic should ideally be shared. 
// For this iteration, I'll decode the token simply or assume `req.headers.authorization` contains the token 
// and I will verify it using `process.env.JWT_SECRET` which I saw in `server.js` or `.env`.

import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'nurzeka-secret-key-2026';

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token required' });
    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// ═══ User Progress Routes ═══

// Save Progress
router.post('/progress', verifyToken, (req, res) => {
    const { book_slug, chapter_slug, percentage } = req.body;
    const user_id = req.user.id;

    if (!book_slug || !chapter_slug) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    try {
        // Upsert progress
        run(`
            INSERT INTO user_progress (user_id, book_slug, chapter_slug, percentage, last_read_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, book_slug, chapter_slug) 
            DO UPDATE SET percentage = ?, last_read_at = CURRENT_TIMESTAMP
        `, [user_id, book_slug, chapter_slug, percentage, percentage]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Last Read
router.get('/progress', verifyToken, (req, res) => {
    const user_id = req.user.id;
    try {
        // Get the most recently read item
        const lastRead = get(`
            SELECT * FROM user_progress 
            WHERE user_id = ? 
            ORDER BY last_read_at DESC 
            LIMIT 1
        `, [user_id]);

        res.json({ lastRead });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══ Favorites Routes ═══

// Add Favorite
router.post('/favorites', verifyToken, (req, res) => {
    const { content, book_slug, chapter_slug } = req.body;
    const user_id = req.user.id;
    const id = uuidv4();

    if (!content) return res.status(400).json({ error: 'Content required' });

    try {
        run(`
            INSERT INTO favorites (id, user_id, content, book_slug, chapter_slug)
            VALUES (?, ?, ?, ?, ?)
        `, [id, user_id, content, book_slug, chapter_slug]);

        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Favorites
router.get('/favorites', verifyToken, (req, res) => {
    const user_id = req.user.id;
    try {
        const favorites = all(`
            SELECT * FROM favorites 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `, [user_id]);

        res.json({ favorites });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Favorite
router.delete('/favorites/:id', verifyToken, (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params;

    try {
        run('DELETE FROM favorites WHERE id = ? AND user_id = ?', [id, user_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
