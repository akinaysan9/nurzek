import { getPgPool, isPostgresConfigured } from '../db/pg.js';

const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 50);
const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS || 5000);
// After this many consecutive failures, alert and back off.
const MAX_CONSECUTIVE_ERRORS = Number(process.env.OUTBOX_MAX_CONSECUTIVE_ERRORS || 5);

async function processPendingOutbox() {
    if (!isPostgresConfigured) {
        throw new Error('Postgres is not configured. Set PG_DATABASE_URL.');
    }

    const pool = getPgPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const rowsResult = await client.query(
            `SELECT id, event_id, payload, attempts
             FROM audit_outbox
             WHERE status = 'pending'
               AND (next_retry_at IS NULL OR next_retry_at <= NOW())
             ORDER BY created_at ASC
             FOR UPDATE SKIP LOCKED
             LIMIT $1`,
            [BATCH_SIZE]
        );

        let processed = 0;

        for (const row of rowsResult.rows) {
            try {
                await client.query(
                    `INSERT INTO occurrence_events_audit (event_id, audit_payload)
                     VALUES ($1, $2::jsonb)`,
                    [row.event_id, JSON.stringify(row.payload)]
                );

                await client.query(
                    `UPDATE audit_outbox
                     SET status = 'sent', attempts = attempts + 1, updated_at = NOW(), last_error = NULL
                     WHERE id = $1`,
                    [row.id]
                );

                processed += 1;
            } catch (err) {
                const attempts = Number(row.attempts || 0) + 1;
                const finalStatus = attempts >= 5 ? 'failed' : 'pending';
                const retryDelaySeconds = Math.min(300, 5 * attempts);

                await client.query(
                    `UPDATE audit_outbox
                     SET status = $2,
                         attempts = attempts + 1,
                         last_error = $3,
                         next_retry_at = NOW() + ($4 * INTERVAL '1 second'),
                         updated_at = NOW()
                     WHERE id = $1`,
                    [row.id, finalStatus, String(err.message || err), retryDelaySeconds]
                );
            }
        }

        await client.query('COMMIT');
        return { processed, scanned: rowsResult.rows.length };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ── Main loop ────────────────────────────────────────────────────────────────
// Run as a long-lived daemon (managed by PM2 with restart: always).
// On consecutive failures it backs off exponentially so PM2 doesn't spin-loop.

if (!isPostgresConfigured) {
    console.error('[outbox] PG_DATABASE_URL not set — exiting.');
    process.exit(1);
}

let consecutiveErrors = 0;

async function tick() {
    try {
        const result = await processPendingOutbox();
        if (result.processed > 0) {
            console.log(`[outbox] processed=${result.processed} scanned=${result.scanned}`);
        }
        consecutiveErrors = 0;
    } catch (err) {
        consecutiveErrors += 1;
        const backoffMs = Math.min(60_000, POLL_INTERVAL_MS * Math.pow(2, consecutiveErrors));
        console.error(`[outbox] error #${consecutiveErrors}: ${err.message}`);

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            // Surface for PM2 log alerts / external monitoring.
            console.error(
                `[outbox] ALERT: ${consecutiveErrors} consecutive failures. ` +
                `audit_outbox may be accumulating. Check Postgres connectivity.`
            );
        }
        // Let PM2 see the process stayed alive; just slow down.
        await new Promise((r) => setTimeout(r, backoffMs));
        return;
    }
    setTimeout(tick, POLL_INTERVAL_MS);
}

// Graceful shutdown — let the current batch finish before exiting.
let shuttingDown = false;
process.on('SIGTERM', () => { shuttingDown = true; });
process.on('SIGINT',  () => { shuttingDown = true; });

(async function start() {
    console.log('[outbox] worker started, polling every', POLL_INTERVAL_MS, 'ms');
    while (!shuttingDown) {
        await tick();
        if (!shuttingDown) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
    }
    console.log('[outbox] graceful shutdown complete');
    process.exit(0);
})();
