import { Router } from 'express';
import { withPgTransaction, isPostgresConfigured } from '../db/pg.js';

const router = Router();

function mentionWeight(mentionType) {
    if (mentionType === 'central') return 1.0;
    if (mentionType === 'relevant') return 0.7;
    return 0.4;
}

function normalizeConfidence(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    if (num < 0) return 0;
    if (num > 1) return 1;
    return Number(num.toFixed(4));
}

router.post('/v2', async (req, res) => {
    if (!isPostgresConfigured) {
        return res.status(503).json({
            error: 'Postgres is not configured',
            degraded: true
        });
    }

    const {
        concept_name,
        mention_type,
        confidence,
        source_refs,
        decision_trace,
        rule_snapshot_hash,
        ontology_snapshot_hash,
        engine_build_id,
        feature_schema_version,
        lane
    } = req.body || {};

    if (!concept_name || !mention_type || !feature_schema_version) {
        return res.status(400).json({
            error: 'concept_name, mention_type and feature_schema_version are required'
        });
    }

    if (!['mention', 'relevant', 'central'].includes(mention_type)) {
        return res.status(400).json({ error: 'mention_type must be mention|relevant|central' });
    }

    const effectiveLane = lane === 'shadow' ? 'shadow' : 'production';
    const normalizedConfidence = normalizeConfidence(confidence);
    const deterministicScore = Number((normalizedConfidence * mentionWeight(mention_type)).toFixed(4));

    const payload = {
        concept_name: String(concept_name),
        mention_type,
        confidence: normalizedConfidence,
        source_refs: Array.isArray(source_refs) ? source_refs : [],
        decision_trace: typeof decision_trace === 'object' && decision_trace ? decision_trace : {},
        rule_snapshot_hash: rule_snapshot_hash || null,
        ontology_snapshot_hash: ontology_snapshot_hash || null,
        engine_build_id: engine_build_id || null,
        feature_schema_version: String(feature_schema_version),
        lane: effectiveLane,
        deterministic_score: deterministicScore
    };

    try {
        const result = await withPgTransaction(async (client) => {
            const insertEvent = await client.query(
                `INSERT INTO occurrence_events_core (
                    concept_name,
                    mention_type,
                    confidence,
                    source_refs,
                    decision_trace,
                    rule_snapshot_hash,
                    ontology_snapshot_hash,
                    engine_build_id,
                    feature_schema_version,
                    lane,
                    status
                ) VALUES (
                    $1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,'accepted'
                )
                RETURNING event_id, created_at`,
                [
                    payload.concept_name,
                    payload.mention_type,
                    payload.confidence,
                    JSON.stringify(payload.source_refs),
                    JSON.stringify(payload.decision_trace),
                    payload.rule_snapshot_hash,
                    payload.ontology_snapshot_hash,
                    payload.engine_build_id,
                    payload.feature_schema_version,
                    payload.lane
                ]
            );

            const event = insertEvent.rows[0];
            const outboxPayload = {
                event_id: event.event_id,
                emitted_at: new Date().toISOString(),
                payload
            };

            await client.query(
                `INSERT INTO audit_outbox (event_id, payload, status) VALUES ($1, $2::jsonb, 'pending')`,
                [event.event_id, JSON.stringify(outboxPayload)]
            );

            return event;
        });

        const degraded = !rule_snapshot_hash || !ontology_snapshot_hash || !engine_build_id;

        return res.status(200).json({
            event_id: result.event_id,
            created_at: result.created_at,
            lane: effectiveLane,
            deterministic_score: deterministicScore,
            degraded
        });
    } catch (error) {
        console.error('concept-occurrences v2 error:', error);
        return res.status(500).json({ error: 'Failed to persist concept occurrence v2' });
    }
});

export default router;
