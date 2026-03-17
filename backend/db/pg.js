import pg from 'pg';

const { Pool } = pg;

// PG_DATABASE_URL is intentionally separate from any legacy DATABASE_URL that
// SQLite-based v1 routes might reference, preventing cross-adapter contamination.
const databaseUrl = process.env.PG_DATABASE_URL;

export const isPostgresConfigured = Boolean(databaseUrl);

let pool = null;

if (isPostgresConfigured) {
    pool = new Pool({
        connectionString: databaseUrl,
        max: Number(process.env.PG_POOL_MAX || 10),
        idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
        connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 5000),
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });

    pool.on('error', (err) => {
        console.error('Postgres pool error:', err.message);
    });
}

export function getPgPool() {
    if (!pool) {
        throw new Error('Postgres is not configured. Set PG_DATABASE_URL first.');
    }
    return pool;
}

export async function withPgTransaction(work) {
    const client = await getPgPool().connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
