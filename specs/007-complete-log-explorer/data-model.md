# Data Model: Complete Log Explorer

**Date**: 2026-02-14
**Feature**: 007-complete-log-explorer
**Databases**: ClickHouse (log queries), PostgreSQL (saved searches, history), Redis (query history cache)

## Changes to Existing Tables

### PostgreSQL: saved_searches (ALTER)

Add `time_range` column for persisting time range selection with saved queries.

```sql
ALTER TABLE saved_searches
    ADD COLUMN time_range JSONB DEFAULT NULL;
```

**time_range JSONB structure**:
```json
{
  "type": "relative",
  "value": "1h"
}
```
or
```json
{
  "type": "absolute",
  "start": "2024-01-15T10:00:00Z",
  "end": "2024-01-15T11:00:00Z"
}
```

### PostgreSQL: search_history (NEW)

```sql
CREATE TABLE search_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         TEXT NOT NULL,
    job_id          UUID REFERENCES analysis_jobs(id),
    kql_query       TEXT NOT NULL,
    result_count    INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_history_user ON search_history(tenant_id, user_id, created_at DESC);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON search_history
    USING (tenant_id::TEXT = current_setting('app.tenant_id', true));
```

**Retention**: Keep last 20 entries per user via application-level cleanup (DELETE oldest when count > 20 on insert).

## New ClickHouse Queries

### Histogram Query (using existing materialized view)

```sql
-- Uses log_entries_aggregates materialized view
SELECT
    toStartOfInterval(period_start, INTERVAL {bucket_size}) AS bucket,
    log_type,
    sum(entry_count) AS count
FROM log_entries_aggregates
WHERE tenant_id = {tenant_id}
  AND job_id = {job_id}
  AND period_start >= {time_from}
  AND period_start <= {time_to}
GROUP BY bucket, log_type
ORDER BY bucket ASC
```

**Bucket size logic**:
| Time Range | Bucket Size |
|------------|-------------|
| <= 1 hour  | 1 minute    |
| <= 6 hours | 5 minutes   |
| <= 24 hours | 15 minutes |
| <= 7 days  | 1 hour      |
| > 7 days   | 6 hours     |

### Autocomplete Value Query

```sql
-- Field value suggestions with counts
SELECT
    {field} AS value,
    count() AS count
FROM log_entries
WHERE tenant_id = {tenant_id}
  AND job_id = {job_id}
  AND {field} LIKE {prefix_pattern}
  AND {field} != ''
GROUP BY value
ORDER BY count DESC
LIMIT 10
```

### Context Window Query

```sql
SELECT *
FROM log_entries
WHERE tenant_id = {tenant_id}
  AND job_id = {job_id}
  AND line_number BETWEEN {target_line - window} AND {target_line + window}
ORDER BY line_number ASC
```

### Entry by ID Query (existing)

```sql
-- Already implemented in ClickHouseClient.GetLogEntry()
SELECT * FROM log_entries
WHERE tenant_id = {tenant_id}
  AND job_id = {job_id}
  AND entry_id = {entry_id}
LIMIT 1
```

### Trace Entries Query (existing)

```sql
-- Already implemented in ClickHouseClient.GetTraceEntries()
SELECT * FROM log_entries
WHERE tenant_id = {tenant_id}
  AND job_id = {job_id}
  AND trace_id = {trace_id}
ORDER BY timestamp ASC, line_number ASC
```

## Redis Key Schema (additions)

```
# Autocomplete cache (30s TTL)
cache:{tenant_id}:autocomplete:{job_id}:{field}:{prefix}

# Query history (list, max 20 items, 30-day TTL)
history:{tenant_id}:{user_id}:searches
```

## Entity Relationships (additions)

```
tenants 1──N search_history
analysis_jobs 1──N search_history
saved_searches ──> time_range (JSONB column)
```
