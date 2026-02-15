# Research: Complete Log Explorer

**Date**: 2026-02-14
**Feature**: 007-complete-log-explorer

## R1: Job-Scoped Search Migration Strategy

**Decision**: Refactor the existing search handler to extract job_id from the mux path variable and pass it to both Bleve and ClickHouse queries. The frontend `useSearch` hook switches from `/api/v1/search` to `/api/v1/analysis/{job_id}/search`.

**Rationale**: The router already has the route registered at `/analysis/{job_id}/search` (currently returns 501 stub). The ClickHouseClient already has `SearchEntries(ctx, tenantID, jobID, query)` which takes job_id. Bleve indexes entries with `job_id` as a keyword field, so we can add a mandatory `job_id` term query to filter results.

**Alternatives considered**:
- Keep global search with optional job_id filter — rejected because the spec and OpenAPI contract require job-scoped search, and global search creates confusing UX when multiple jobs exist.
- ClickHouse-only search (no Bleve) — rejected because Bleve provides full-text search and faceting that ClickHouse text search can't match efficiently.

## R2: Time Range Filtering Approach

**Decision**: Add `time_from` and `time_to` query parameters to the search endpoint. The frontend sends these as ISO 8601 timestamps. The backend adds `timestamp >= ? AND timestamp <= ?` to the ClickHouse WHERE clause, and a Bleve `DateRangeQuery` on the `timestamp` field.

**Rationale**: ClickHouse's `log_entries` table has `timestamp` in the ORDER BY key (`tenant_id, job_id, log_type, timestamp, line_number`), so time-range queries benefit from ClickHouse's primary index pruning. The `SearchQuery` struct in `storage/clickhouse.go` already has `TimeFrom` and `TimeTo` fields — they just need to be wired through the handler.

**Alternatives considered**:
- Client-side time filtering — rejected because it wastes bandwidth and doesn't scale to large result sets.
- Separate time-series endpoint — rejected because time filtering is integral to search, not an add-on.

## R3: Timeline Histogram Data Source

**Decision**: Use the existing `log_entries_aggregates` materialized view which already buckets by `toStartOfMinute(timestamp)` with counts per log_type. Add a new backend endpoint parameter `include_histogram=true` on the search endpoint (or a dedicated `/analysis/{job_id}/histogram` endpoint) that returns time-bucketed counts from the materialized view, filtered by the current search query's time range.

**Rationale**: The materialized view already computes `entry_count` grouped by `(tenant_id, job_id, log_type, period_start)`. For the histogram, we query this view with the active time range and aggregate to the appropriate bucket size. This avoids scanning the full `log_entries` table for counts.

**Alternatives considered**:
- Client-side aggregation of search results — rejected because results are paginated (only 25-100 entries visible), not representative of full distribution.
- New materialized view with finer granularity — rejected because minute-level granularity is sufficient; the frontend can aggregate minutes into hours/days as needed for larger time windows.
- Separate ClickHouse query per search — acceptable approach. We'll include histogram data in the search response to avoid an extra round-trip.

## R4: Autocomplete Implementation

**Decision**: Implement the autocomplete handler at `GET /api/v1/search/autocomplete` with two modes: (1) field name suggestions when prefix doesn't contain a colon, (2) field value suggestions when prefix contains "field:" pattern. Field names come from a static list (the KQL KnownFields mapping). Field values are queried from ClickHouse with `SELECT DISTINCT {field} FROM log_entries WHERE tenant_id = ? AND job_id = ? AND {field} LIKE ? LIMIT 10`.

**Rationale**: Field names are a fixed set (16 mappings in KQL parser). For values, ClickHouse's column-oriented storage makes DISTINCT queries fast, especially with the ORDER BY key pruning on tenant_id and job_id. Caching in Redis (30s TTL) prevents repeated queries for the same prefix.

**Alternatives considered**:
- Bleve-based autocomplete — rejected because Bleve's term enumeration is less efficient than ClickHouse DISTINCT for keyword/enum fields.
- Pre-computed value lists at ingestion time — over-engineering; ClickHouse queries are fast enough.

## R5: KQL Syntax Highlighting Approach

**Decision**: Reuse the existing KQL tokenizer (from `search/kql.go`) to produce token spans with types (field, operator, value, keyword, error). Create a lightweight TypeScript port of the tokenizer for the frontend that runs synchronously as the user types. Style tokens with CSS classes.

**Rationale**: The KQL parser already has a tokenizer that produces tokens with types. Porting just the tokenizer (not the full parser) to TypeScript is straightforward since KQL syntax is simple. This enables real-time highlighting without API calls.

**Alternatives considered**:
- Server-side highlighting (send query, get back annotated HTML) — rejected due to latency; must be instant as user types.
- CodeMirror/Monaco editor — over-engineering for a single-line search input; adds significant bundle size.
- Regex-based highlighting — fragile; the tokenizer approach is more accurate.

## R6: Context View Query Strategy

**Decision**: Query ClickHouse for surrounding entries by line number: `SELECT * FROM log_entries WHERE tenant_id = ? AND job_id = ? AND line_number BETWEEN ? AND ? ORDER BY line_number`. The frontend requests context with configurable window size (default 10 lines before/after).

**Rationale**: Line numbers are sequential within a job's log file. The ORDER BY key includes `line_number` as the last component, making range queries efficient. This is simpler than time-based context (which would miss entries at the same timestamp).

**Alternatives considered**:
- Time-based context (entries within N seconds) — rejected because multiple entries can share the same timestamp; line number ordering is more natural for log context.
- Bleve-based proximity search — rejected; Bleve doesn't support ordered proximity queries on line numbers.

## R7: Saved Searches Storage

**Decision**: Use the existing `saved_searches` PostgreSQL table (defined in data-model.md) which already has tenant_id, user_id, name, kql_query, filters, is_pinned, and created_at. Add a `time_range` JSONB column for storing the time range configuration. Query history will be stored in Redis as a capped list per user (tenant-prefixed key).

**Rationale**: The table already exists and matches our needs. PostgreSQL is the right choice for persistent user data. Redis is better for ephemeral query history since it's naturally capped and auto-expires.

**Alternatives considered**:
- Store history in PostgreSQL too — acceptable but Redis is simpler for capped lists with TTL.
- LocalStorage for history — rejected because it doesn't sync across devices/browsers.

## R8: Export Implementation

**Decision**: Implement CSV and JSON export as a streaming download from the backend. The frontend requests `GET /api/v1/analysis/{job_id}/search/export?q={query}&format=csv` which streams results directly to the response using ClickHouse's native streaming. Cap at 10,000 rows.

**Rationale**: Streaming avoids loading all 10,000 entries into memory at once. ClickHouse supports streaming result sets natively. The 10,000 row cap prevents abuse while covering most practical use cases.

**Alternatives considered**:
- Client-side export (generate CSV in browser) — rejected because it requires fetching all results first, which is slow for large sets.
- Background export with download link — over-engineering for 10K rows; streaming is fast enough.
