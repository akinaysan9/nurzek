// User Data Routes - Bookmarks, Highlights
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from './auth.js';
import { run, get, all, changes } from '../db/database.js';

const router = Router();

// --- Bookmarks ---

// GET /api/user/bookmarks
router.get('/bookmarks', authMiddleware, (req, res) => {
    try {
        const bookmarks = all('SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json({ bookmarks });
    } catch (error) {
        console.error('Get bookmarks error:', error);
        res.status(500).json({ error: 'Ayraçlar yüklenemedi' });
    }
});

// POST /api/user/bookmarks
router.post('/bookmarks', authMiddleware, (req, res) => {
    try {
        const { book_slug, chapter_slug, selector, label } = req.body;

        if (!book_slug || !chapter_slug) {
            return res.status(400).json({ error: 'Kitap ve bölüm bilgisi gerekli' });
        }

        const id = uuidv4();
        // Check if exists to avoid duplicates (optional, but good for bookmarks)
        const existing = get(
            'SELECT id FROM bookmarks WHERE user_id = ? AND book_slug = ? AND chapter_slug = ?',
            [req.user.id, book_slug, chapter_slug]
        );

        if (existing) {
            // Update existing
            run(
                'UPDATE bookmarks SET selector = ?, label = ?, created_at = datetime("now") WHERE id = ?',
                [selector, label || null, existing.id]
            );
            return res.json({ message: 'Ayraç güncellendi', bookmark: { id: existing.id, book_slug, chapter_slug, selector, label } });
        }

        run(
            'INSERT INTO bookmarks (id, user_id, book_slug, chapter_slug, selector, label) VALUES (?, ?, ?, ?, ?, ?)',
            [id, req.user.id, book_slug, chapter_slug, selector, label || null]
        );

        res.status(201).json({
            message: 'Ayraç eklendi',
            bookmark: { id, book_slug, chapter_slug, selector, label }
        });
    } catch (error) {
        console.error('Create bookmark error:', error);
        res.status(500).json({ error: 'Ayraç oluşturulamadı' });
    }
});

// DELETE /api/user/bookmarks/:id
router.delete('/bookmarks/:id', authMiddleware, (req, res) => {
    try {
        run('DELETE FROM bookmarks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (changes() === 0) return res.status(404).json({ error: 'Ayraç bulunamadı' });
        res.json({ message: 'Ayraç silindi' });
    } catch (error) {
        console.error('Delete bookmark error:', error);
        res.status(500).json({ error: 'Ayraç silinemedi' });
    }
});

// --- Highlights (Alt Çizme) ---

// GET /api/user/highlights
// Optional: Filter by book/chapter
router.get('/highlights', authMiddleware, (req, res) => {
    try {
        const { book, chapter } = req.query;
        let sql = 'SELECT * FROM highlights WHERE user_id = ?';
        const params = [req.user.id];

        if (book) {
            sql += ' AND book_slug = ?';
            params.push(book);
        }
        if (chapter) {
            sql += ' AND chapter_slug = ?';
            params.push(chapter);
        }

        sql += ' ORDER BY created_at DESC';

        const highlights = all(sql, params);
        res.json({ highlights });
    } catch (error) {
        console.error('Get highlights error:', error);
        res.status(500).json({ error: 'Alt çizmeler yüklenemedi' });
    }
});

// POST /api/user/highlights
router.post('/highlights', authMiddleware, (req, res) => {
    try {
        const { book_slug, chapter_slug, text, range_start, range_end, color } = req.body;

        if (!book_slug || !chapter_slug || !text) {
            return res.status(400).json({ error: 'Eksik bilgi' });
        }

        const id = uuidv4();
        console.log(`✨ Creating highlight: ID=${id}, User=${req.user.id}`);
        run(
            `INSERT INTO highlights (id, user_id, book_slug, chapter_slug, text, range_start, range_end, color) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.user.id, book_slug, chapter_slug, text, range_start, range_end, color || 'yellow']
        );

        res.status(201).json({
            message: 'Alt çizme kaydedildi',
            highlight: { id, book_slug, chapter_slug, text, range_start, range_end, color }
        });

    } catch (error) {
        console.error('Create highlight error:', error);
        res.status(500).json({ error: 'Alt çizme kaydedilemedi' });
    }
});

// DELETE /api/user/highlights/:id
router.delete('/highlights/:id', authMiddleware, (req, res) => {
    try {
        console.log('--- DELETE HIGHLIGHT DEBUG ---');
        console.log('Target ID:', req.params.id);
        console.log('User ID from Token:', req.user.id);

        run('DELETE FROM highlights WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (changes() === 0) return res.status(404).json({ error: 'Alt çizme bulunamadı' });
        res.json({ message: 'Alt çizme silindi' });
    } catch (error) {
        console.error('Delete highlight error:', error);
        res.status(500).json({ error: 'Alt çizme silinemedi' });
    }
});

export default router;
