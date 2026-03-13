// Notes Routes - CRUD for user's notes, saved AI responses, and sharing
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, optionalAuth } from './auth.js';
import { run, get, all, changes } from '../db/database.js';

const router = Router();

// GET /api/notes
router.get('/', authMiddleware, (req, res) => {
    try {
        const notes = all('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
        res.json({ notes: notes.map(n => ({ ...n, tags: n.tags ? JSON.parse(n.tags) : [] })) });
    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({ error: 'Notlar yüklenemedi' });
    }
});

// POST /api/notes
router.post('/', authMiddleware, (req, res) => {
    try {
        const { title, content, source_text, source_book, source_section, ai_response, tags, color,
            // Fallbacks for camelCase if legacy
            sourceText, sourceBook, sourceSection, aiResponse } = req.body;

        const sText = source_text || sourceText;
        const sBook = source_book || sourceBook;
        const sSection = source_section || sourceSection;
        const aiRes = ai_response || aiResponse;

        if (!content && !sText) return res.status(400).json({ error: 'Not içeriği veya kaynak metin gerekli' });

        const id = uuidv4();
        const shareLink = uuidv4().substring(0, 8);

        run(
            `INSERT INTO notes (id, user_id, title, content, source_text, source_book, source_section, ai_response, tags, color, share_link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.user.id, title || 'Başlıksız Not', content || '', sText || null,
                sBook || null, sSection || null, aiRes || null,
                tags ? JSON.stringify(tags) : null, color || 'yellow', shareLink]
        );

        const note = get('SELECT * FROM notes WHERE id = ?', [id]);
        res.status(201).json({ note: { ...note, tags: note.tags ? JSON.parse(note.tags) : [] } });
    } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({ error: 'Not oluşturulamadı' });
    }
});

// PUT /api/notes/:id
router.put('/:id', authMiddleware, (req, res) => {
    try {
        const { title, content, tags, is_public, color } = req.body;
        const note = get('SELECT * FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!note) return res.status(404).json({ error: 'Not bulunamadı' });

        run(
            `UPDATE notes SET 
        title = COALESCE(?, title), content = COALESCE(?, content),
        tags = COALESCE(?, tags), is_public = COALESCE(?, is_public),
        color = COALESCE(?, color),
        updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
            [title || null, content || null, tags ? JSON.stringify(tags) : null,
            is_public !== undefined ? (is_public ? 1 : 0) : null, color || null, req.params.id, req.user.id]
        );

        const updated = get('SELECT * FROM notes WHERE id = ?', [req.params.id]);
        res.json({ note: { ...updated, tags: updated.tags ? JSON.parse(updated.tags) : [] } });
    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({ error: 'Not güncellenemedi' });
    }
});

// DELETE /api/notes/:id
router.delete('/:id', authMiddleware, (req, res) => {
    try {
        run('DELETE FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        const ch = changes();
        if (ch === 0) return res.status(404).json({ error: 'Not bulunamadı' });
        res.json({ message: 'Not silindi' });
    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({ error: 'Not silinemedi' });
    }
});

// GET /api/notes/shared/:shareLink
router.get('/shared/:shareLink', (req, res) => {
    try {
        const note = get(
            `SELECT n.*, u.display_name as author_name 
       FROM notes n JOIN users u ON n.user_id = u.id 
       WHERE n.share_link = ? AND n.is_public = 1`,
            [req.params.shareLink]
        );
        if (!note) return res.status(404).json({ error: 'Paylaşılan not bulunamadı' });
        res.json({ note: { ...note, tags: note.tags ? JSON.parse(note.tags) : [], authorName: note.author_name } });
    } catch (error) {
        console.error('Shared note error:', error);
        res.status(500).json({ error: 'Not yüklenemedi' });
    }
});

export default router;
