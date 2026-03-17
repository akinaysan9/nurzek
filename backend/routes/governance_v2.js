import { Router } from 'express';
import { getPgPool, isPostgresConfigured } from '../db/pg.js';

const router = Router();

router.get('/refinement-jobs/:id', async (req, res) => {
    if (!isPostgresConfigured) {
        return res.status(503).json({ error: 'Postgres is not configured' });
    }

    try {
        const pool = getPgPool();
        const result = await pool.query(
            `SELECT job_id, event_id, state, lease_owner, lease_expires_at, attempts, error, created_at, updated_at
             FROM refinement_jobs
             WHERE job_id = $1`,
            [req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'refinement job not found' });
        }

        return res.json(result.rows[0]);
    } catch (error) {
        console.error('refinement-jobs read error:', error);
        return res.status(500).json({ error: 'failed to fetch refinement job' });
    }
});

router.post('/rules/canary/promote', async (req, res) => {
    if (!isPostgresConfigured) {
        return res.status(503).json({ error: 'Postgres is not configured' });
    }

    const {
        rule_name,
        target_version,
        promoted_by,
        note
    } = req.body || {};

    if (!rule_name || !target_version) {
        return res.status(400).json({ error: 'rule_name and target_version are required' });
    }

    try {
        const pool = getPgPool();

        await pool.query(
            `UPDATE rule_versions
             SET state = CASE WHEN name = $1 AND version = $2 THEN 'active' ELSE 'inactive' END
             WHERE name = $1`,
            [rule_name, target_version]
        );

        return res.json({
            status: 'promoted',
            rule_name,
            target_version,
            promoted_by: promoted_by || null,
            note: note || null,
            promoted_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('canary promote error:', error);
        return res.status(500).json({ error: 'failed to promote canary rule' });
    }
});

export default router;
