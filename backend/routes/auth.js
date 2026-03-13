// Auth Routes - User Registration & Login
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/database.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'nurzeka-secret-key-2026';

// Middleware: Verify JWT token
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Yetkilendirme gerekli' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
    }
}

// Optional auth
export function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            req.user = jwt.verify(token, JWT_SECRET);
        } catch (e) { /* ignore */ }
    }
    next();
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        if (!email || !password || !displayName) {
            return res.status(400).json({ error: 'E-posta, şifre ve ad gerekli' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
        }

        const existing = get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
        }

        const id = uuidv4();
        const passwordHash = await bcrypt.hash(password, 10);

        run(
            'INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
            [id, email, passwordHash, displayName]
        );

        const token = jwt.sign({ id, email, displayName }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            message: 'Kayıt başarılı!',
            user: { id, email, displayName },
            token
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'E-posta ve şifre gerekli' });
        }

        const user = get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
        }

        run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);

        const token = jwt.sign(
            { id: user.id, email: user.email, displayName: user.display_name },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            message: 'Giriş başarılı!',
            user: { id: user.id, email: user.email, displayName: user.display_name },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Giriş sırasında bir hata oluştu' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
    const user = get('SELECT id, email, display_name, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    res.json({ user: { ...user, displayName: user.display_name } });
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
    try {
        const { token } = req.body;
        const { OAuth2Client } = await import('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        let user = get('SELECT * FROM users WHERE google_id = ? OR email = ?', [googleId, email]);
        let userId;

        if (user) {
            userId = user.id;
            // Update existing user with google info if linked
            if (!user.google_id) {
                run('UPDATE users SET google_id = ?, picture = ? WHERE id = ?', [googleId, picture, userId]);
            } else if (user.picture !== picture) {
                run('UPDATE users SET picture = ? WHERE id = ?', [picture, userId]);
            }
            run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [userId]);
        } else {
            // Create new user
            userId = uuidv4();
            // Create a random password hash for google users (they won't use it but schema requires it)
            const randomPassword = Math.random().toString(36).slice(-8);
            const passwordHash = await bcrypt.hash(randomPassword, 10);

            run(
                'INSERT INTO users (id, email, password_hash, display_name, google_id, picture) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, email, passwordHash, name, googleId, picture]
            );
        }

        const jwtToken = jwt.sign(
            { id: userId, email, displayName: name, picture },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            message: 'Google ile giriş başarılı!',
            user: { id: userId, email, displayName: name, picture },
            token: jwtToken
        });

    } catch (error) {
        console.error('Google auth error:', error);
        res.status(401).json({ error: 'Google kimlik doğrulaması başarısız' });
    }
});

export default router;
