CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS rule_versions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, version)
);

CREATE TABLE IF NOT EXISTS rule_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id BIGINT REFERENCES rule_versions(id),
    snapshot_json JSONB NOT NULL,
    snapshot_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engine_builds (
    id TEXT PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ontology_versions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, version)
);

CREATE TABLE IF NOT EXISTS ontology_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ontology_version_id BIGINT REFERENCES ontology_versions(id),
    snapshot_json JSONB NOT NULL,
    snapshot_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS occurrence_events_core (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_name TEXT NOT NULL,
    mention_type TEXT NOT NULL CHECK (mention_type IN ('mention', 'relevant', 'central')),
    confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
    source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision_trace JSONB NOT NULL DEFAULT '{}'::jsonb,
    rule_snapshot_hash TEXT,
    ontology_snapshot_hash TEXT,
    engine_build_id TEXT,
    feature_schema_version TEXT NOT NULL,
    lane TEXT NOT NULL DEFAULT 'production' CHECK (lane IN ('production', 'shadow')),
    status TEXT NOT NULL DEFAULT 'accepted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_occurrence_core_created_at ON occurrence_events_core (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_occurrence_core_concept ON occurrence_events_core (concept_name);
CREATE INDEX IF NOT EXISTS idx_occurrence_core_lane ON occurrence_events_core (lane);

CREATE TABLE IF NOT EXISTS audit_outbox (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES occurrence_events_core(event_id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_outbox_status_created ON audit_outbox (status, created_at);

CREATE TABLE IF NOT EXISTS occurrence_events_audit (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL,
    audit_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_occurrence_audit_event_id ON occurrence_events_audit (event_id);

CREATE TABLE IF NOT EXISTS refinement_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES occurrence_events_core(event_id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'running', 'completed', 'failed')),
    lease_owner TEXT,
    lease_expires_at TIMESTAMPTZ,
    attempts INT NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_job_per_event
ON refinement_jobs(event_id)
WHERE state IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS embedding_store_hot (
    id BIGSERIAL PRIMARY KEY,
    concept_name TEXT NOT NULL,
    embedding DOUBLE PRECISION[] NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS embedding_store_archive (
    id BIGSERIAL PRIMARY KEY,
    concept_name TEXT NOT NULL,
    embedding DOUBLE PRECISION[] NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS occurrence_labels_gold (
    label_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES occurrence_events_core(event_id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    notes TEXT,
    labeled_by TEXT,
    labeled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replay_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES occurrence_events_core(event_id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('strict', 'compat')),
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
