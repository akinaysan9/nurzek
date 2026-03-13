// RAG Service - NurZeka V2 (SSE Manual Parsing)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_SERVICE_URL = 'http://localhost:8000/api/search';
const RAG_TIMEOUT_MS = 300000;

export async function queryNurZeka(question, onToken, onDone, onError, options = {}) {
    const { conversationId, userId, book_hint, chapter_hint } = options;
    console.log('NurZeka V2 Query:', question, 'Conv:', conversationId, 'User:', userId, 'Book:', book_hint, 'Chapter:', chapter_hint);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (userId) headers['X-User-Id'] = userId;

        const response = await fetch(PYTHON_SERVICE_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                question,
                conversation_id: conversationId,
                user_id: userId,
                book_hint: book_hint || null,
                chapter_hint: chapter_hint || null
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ' - ' + response.statusText);
        }

        const stream = response.body;
        let buffer = '';

        stream.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                const raw = line.slice(6).trim();
                if (raw === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(raw);
                    if (parsed.token) {
                        onToken(parsed.token);
                    }
                    if (parsed.error) {
                        onError(parsed.error);
                    }
                } catch (e) {}
            }
        });

        stream.on('end', () => {
            clearTimeout(timeoutId);
            onDone();
        });

        stream.on('error', (err) => {
            clearTimeout(timeoutId);
            onError(err.message);
        });

    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            onError('Zaman aşımı: NurZeka 300 saniyede yanıt vermedi.');
        } else {
            console.error('NurZeka Connection Error:', err.message);
            if (err.code === 'ECONNREFUSED') {
                onError('⚠️ Yapay Zeka Motoru (Port 8000) erişilemez durumda. Lütfen başlatın.');
            } else {
                onError(err.message);
            }
        }
    }
}

export async function ragQuery(question, options = {}) {
    let fullAnswer = '';
    return new Promise((resolve, reject) => {
        queryNurZeka(
            question,
            (token) => { fullAnswer += token; },
            () => resolve({
                answer: fullAnswer,
                sources: [],
                model: 'NurZeka V2',
                noContext: false
            }),
            (err) => reject(new Error(err)),
            options
        );
    });
}

export { queryNurZeka as ragQueryStreamAdapter };
export function getIndexStats() { return { status: 'Managed by Python V2' }; }
export function reindex() { return 'Managed by Python V2'; }
export function buildIndex() { return 'Managed by Python V2'; }
export function semanticChunking() { return []; }
export const getAIResponseStream = queryNurZeka;
export default { ragQuery, queryNurZeka, getIndexStats, getAIResponseStream };
