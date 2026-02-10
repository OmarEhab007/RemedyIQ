-- RemedyIQ PostgreSQL Schema
-- Version: 001_initial

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_org_id    TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    plan            TEXT NOT NULL DEFAULT 'free',
    storage_limit_gb INTEGER NOT NULL DEFAULT 10,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'tenants') THEN
        CREATE POLICY tenant_isolation ON tenants
            USING (id::TEXT = current_setting('app.tenant_id', true))
            WITH CHECK (id::TEXT = current_setting('app.tenant_id', true));
    END IF;
END $$;

-- Log Files
CREATE TABLE IF NOT EXISTS log_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    filename        TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    s3_key          TEXT NOT NULL,
    s3_bucket       TEXT NOT NULL,
    content_type    TEXT NOT NULL DEFAULT 'text/plain',
    detected_types  TEXT[] DEFAULT '{}',
    checksum_sha256 TEXT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_tenant ON log_files(tenant_id);

ALTER TABLE log_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'log_files') THEN
        CREATE POLICY tenant_isolation ON log_files
            USING (tenant_id::TEXT = current_setting('app.tenant_id', true))
            WITH CHECK (tenant_id::TEXT = current_setting('app.tenant_id', true));
    END IF;
END $$;

-- Analysis Jobs
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'parsing', 'analyzing', 'storing', 'complete', 'failed')),
    file_id         UUID NOT NULL REFERENCES log_files(id),
    jar_flags       JSONB NOT NULL DEFAULT '{}',
    jvm_heap_mb     INTEGER NOT NULL DEFAULT 4096,
    timeout_seconds INTEGER NOT NULL DEFAULT 1800,
    progress_pct    INTEGER NOT NULL DEFAULT 0,
    total_lines     BIGINT,
    processed_lines BIGINT,
    api_count       BIGINT,
    sql_count       BIGINT,
    filter_count    BIGINT,
    esc_count       BIGINT,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    log_start       TIMESTAMPTZ,
    log_end         TIMESTAMPTZ,
    log_duration    TEXT,
    error_message   TEXT,
    jar_stderr      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status ON analysis_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_created ON analysis_jobs(tenant_id, created_at DESC);

ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'analysis_jobs') THEN
        CREATE POLICY tenant_isolation ON analysis_jobs
            USING (tenant_id::TEXT = current_setting('app.tenant_id', true))
            WITH CHECK (tenant_id::TEXT = current_setting('app.tenant_id', true));
    END IF;
END $$;

-- AI Interactions
CREATE TABLE IF NOT EXISTS ai_interactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    job_id          UUID REFERENCES analysis_jobs(id),
    user_id         TEXT NOT NULL,
    skill_name      TEXT NOT NULL,
    input_text      TEXT NOT NULL,
    output_text     TEXT,
    referenced_lines JSONB DEFAULT '[]',
    tokens_used     INTEGER,
    latency_ms      INTEGER,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tenant ON ai_interactions(tenant_id, created_at DESC);

ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'ai_interactions') THEN
        CREATE POLICY tenant_isolation ON ai_interactions
            USING (tenant_id::TEXT = current_setting('app.tenant_id', true))
            WITH CHECK (tenant_id::TEXT = current_setting('app.tenant_id', true));
    END IF;
END $$;

-- Saved Searches
CREATE TABLE IF NOT EXISTS saved_searches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    kql_query       TEXT NOT NULL,
    filters         JSONB DEFAULT '{}',
    is_pinned       BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_tenant_id ON saved_searches(tenant_id);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'saved_searches') THEN
        CREATE POLICY tenant_isolation ON saved_searches
            USING (tenant_id::TEXT = current_setting('app.tenant_id', true))
            WITH CHECK (tenant_id::TEXT = current_setting('app.tenant_id', true));
    END IF;
END $$;
