import { getPgPool, isPostgresConfigured } from '../db/pg.js';

const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 50);

async function processPendingOutbox() {
    if (!isPostgresConfigured) {
        throw new Error('Postgres is not configured. Set DATABASE_URL.');
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

processPendingOutbox()
    .then((result) => {
        console.log(`outbox worker finished: processed=${result.processed} scanned=${result.scanned}`);
        process.exit(0);
    })
    .catch((error) => {
        console.error('outbox worker failed:', error.message);
        process.exit(1);
    });
