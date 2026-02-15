-- RemedyIQ PostgreSQL Schema
-- Version: 002_search_features
-- Adds time_range support for saved searches and search_history table

-- T001: Add time_range column to saved_searches
ALTER TABLE saved_searches
    ADD COLUMN IF NOT EXISTS time_range JSONB DEFAULT NULL;

COMMENT ON COLUMN saved_searches.time_range IS 'Time range filter: {"type":"relative","value":"1h"} or {"type":"absolute","start":"...","end":"..."}';

-- T002: Create search_history table
CREATE TABLE IF NOT EXISTS search_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         TEXT NOT NULL,
    job_id          UUID REFERENCES analysis_jobs(id),
    kql_query       TEXT NOT NULL,
    result_count    INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(tenant_id, user_id, created_at DESC);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'search_history') THEN
        CREATE POLICY tenant_isolation ON search_history
            USING (tenant_id::TEXT = current_setting('app.tenant_id', true))
            WITH CHECK (tenant_id::TEXT = current_setting('app.tenant_id', true));
    END IF;
END $$;
