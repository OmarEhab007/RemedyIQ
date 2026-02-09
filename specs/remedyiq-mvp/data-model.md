# Data Model: RemedyIQ MVP

**Date**: 2026-02-09
**Databases**: ClickHouse (log entries), PostgreSQL (metadata)

## ClickHouse Schema

### log_entries (Main Log Storage)

```sql
CREATE TABLE log_entries (
    -- Identity
    tenant_id       String,
    job_id          String,
    entry_id        String DEFAULT generateUUIDv4(),

    -- Source tracking
    line_number     UInt32,
    file_number     UInt16 DEFAULT 1,

    -- Temporal
    timestamp       DateTime64(3),
    ingested_at     DateTime64(3) DEFAULT now64(3),

    -- Classification
    log_type        Enum8('API' = 1, 'SQL' = 2, 'FLTR' = 3, 'ESCL' = 4),

    -- Correlation
    trace_id        String DEFAULT '',
    rpc_id          String DEFAULT '',
    thread_id       String DEFAULT '',

    -- Context
    queue           String DEFAULT '',
    user            String DEFAULT '',

    -- Performance
    duration_ms     UInt32 DEFAULT 0,
    queue_time_ms   UInt32 DEFAULT 0,
    success         Bool DEFAULT true,

    -- Type-specific: API
    api_code        String DEFAULT '',
    form            String DEFAULT '',

    -- Type-specific: SQL
    sql_table       String DEFAULT '',
    sql_statement   String DEFAULT '',

    -- Type-specific: Filter
    filter_name     String DEFAULT '',
    filter_level    UInt8 DEFAULT 0,
    operation       String DEFAULT '',
    request_id      String DEFAULT '',

    -- Type-specific: Escalation
    esc_name        String DEFAULT '',
    esc_pool        String DEFAULT '',
    scheduled_time  Nullable(DateTime64(3)),
    delay_ms        UInt32 DEFAULT 0,
    error_encountered Bool DEFAULT false,

    -- Raw
    raw_text        String DEFAULT '',
    error_message   String DEFAULT ''
)
ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(timestamp))
ORDER BY (tenant_id, job_id, log_type, timestamp, line_number)
TTL timestamp + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;
```

### log_entries_aggregates (Materialized View for Dashboard)

```sql
CREATE MATERIALIZED VIEW log_entries_aggregates
ENGINE = AggregatingMergeTree()
PARTITION BY (tenant_id, toYYYYMM(period_start))
ORDER BY (tenant_id, job_id, log_type, period_start)
AS SELECT
    tenant_id,
    job_id,
    log_type,
    toStartOfMinute(timestamp) AS period_start,
    count() AS entry_count,
    countIf(success = true) AS success_count,
    countIf(success = false) AS failure_count,
    avg(duration_ms) AS avg_duration_ms,
    max(duration_ms) AS max_duration_ms,
    min(duration_ms) AS min_duration_ms,
    sum(duration_ms) AS sum_duration_ms,
    uniqExact(user) AS unique_users,
    uniqExact(form) AS unique_forms,
    uniqExact(sql_table) AS unique_tables
FROM log_entries
GROUP BY tenant_id, job_id, log_type, period_start;
```

### top_api_calls (Materialized View for Top-N)

```sql
CREATE MATERIALIZED VIEW top_api_calls
ENGINE = ReplacingMergeTree()
PARTITION BY (tenant_id)
ORDER BY (tenant_id, job_id, duration_ms, line_number)
AS SELECT
    tenant_id,
    job_id,
    line_number,
    file_number,
    timestamp,
    trace_id,
    rpc_id,
    queue,
    api_code,
    form,
    user,
    duration_ms,
    queue_time_ms,
    success,
    error_message
FROM log_entries
WHERE log_type = 'API'
ORDER BY duration_ms DESC;
```

## PostgreSQL Schema

### tenants

```sql
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_org_id    TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    plan            TEXT NOT NULL DEFAULT 'free',
    storage_limit_gb INTEGER NOT NULL DEFAULT 10,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants
    USING (id::TEXT = current_setting('app.tenant_id', true));
```

### analysis_jobs

```sql
CREATE TABLE analysis_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'parsing', 'analyzing', 'storing', 'complete', 'failed')),
    file_id         UUID NOT NULL REFERENCES log_files(id),

    -- JAR Configuration
    jar_flags       JSONB NOT NULL DEFAULT '{}',
    jvm_heap_mb     INTEGER NOT NULL DEFAULT 4096,
    timeout_seconds INTEGER NOT NULL DEFAULT 1800,

    -- Progress
    progress_pct    INTEGER NOT NULL DEFAULT 0,
    total_lines     BIGINT,
    processed_lines BIGINT,

    -- Results summary
    api_count       BIGINT,
    sql_count       BIGINT,
    filter_count    BIGINT,
    esc_count       BIGINT,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    log_start       TIMESTAMPTZ,
    log_end         TIMESTAMPTZ,
    log_duration    TEXT,

    -- Error tracking
    error_message   TEXT,
    jar_stderr      TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_jobs_tenant_status ON analysis_jobs(tenant_id, status);
CREATE INDEX idx_jobs_tenant_created ON analysis_jobs(tenant_id, created_at DESC);

ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON analysis_jobs
    USING (tenant_id::TEXT = current_setting('app.tenant_id', true));
```

### log_files

```sql
CREATE TABLE log_files (
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

CREATE INDEX idx_files_tenant ON log_files(tenant_id);

ALTER TABLE log_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON log_files
    USING (tenant_id::TEXT = current_setting('app.tenant_id', true));
```

### ai_interactions

```sql
CREATE TABLE ai_interactions (
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

CREATE INDEX idx_ai_tenant ON ai_interactions(tenant_id, created_at DESC);

ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_interactions
    USING (tenant_id::TEXT = current_setting('app.tenant_id', true));
```

### saved_searches

```sql
CREATE TABLE saved_searches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    kql_query       TEXT NOT NULL,
    filters         JSONB DEFAULT '{}',
    is_pinned       BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON saved_searches
    USING (tenant_id::TEXT = current_setting('app.tenant_id', true));
```

## Entity Relationships

```
tenants 1──N log_files
tenants 1──N analysis_jobs
log_files 1──N analysis_jobs
analysis_jobs 1──N log_entries (ClickHouse, via job_id)
analysis_jobs 1──N ai_interactions
tenants 1──N saved_searches
tenants 1──N ai_interactions
```

## NATS Subject Schema

```
# Job lifecycle
jobs.{tenant_id}.submit          # New job submitted
jobs.{tenant_id}.progress        # Job progress updates
jobs.{tenant_id}.complete        # Job completed

# Live tail
logs.{tenant_id}.tail.{log_type} # Live log entries for tailing

# AI
ai.{tenant_id}.request           # AI skill request
ai.{tenant_id}.response          # AI skill response
```

## Redis Key Schema

```
# Session/Cache
cache:{tenant_id}:dashboard:{job_id}      # Dashboard data cache (TTL: 5min)
cache:{tenant_id}:search:{query_hash}      # Search result cache (TTL: 2min)
cache:{tenant_id}:job:{job_id}:status      # Job status (TTL: until complete)

# Rate limiting
rate:{tenant_id}:ai:{user_id}             # AI requests per minute
rate:{tenant_id}:upload                     # Uploads per hour
```
