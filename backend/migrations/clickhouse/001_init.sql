-- RemedyIQ ClickHouse Schema

CREATE DATABASE IF NOT EXISTS remedyiq;

CREATE TABLE IF NOT EXISTS remedyiq.log_entries (
    tenant_id       String,
    job_id          String,
    entry_id        String DEFAULT generateUUIDv4(),
    line_number     UInt32,
    file_number     UInt16 DEFAULT 1,
    timestamp       DateTime64(3),
    ingested_at     DateTime64(3) DEFAULT now64(3),
    log_type        Enum8('API' = 1, 'SQL' = 2, 'FLTR' = 3, 'ESCL' = 4),
    trace_id        String DEFAULT '',
    rpc_id          String DEFAULT '',
    thread_id       String DEFAULT '',
    queue           String DEFAULT '',
    user            String DEFAULT '',
    duration_ms     UInt32 DEFAULT 0,
    queue_time_ms   UInt32 DEFAULT 0,
    success         Bool DEFAULT true,
    api_code        String DEFAULT '',
    form            String DEFAULT '',
    sql_table       String DEFAULT '',
    sql_statement   String DEFAULT '',
    filter_name     String DEFAULT '',
    filter_level    UInt8 DEFAULT 0,
    operation       String DEFAULT '',
    request_id      String DEFAULT '',
    esc_name        String DEFAULT '',
    esc_pool        String DEFAULT '',
    scheduled_time  Nullable(DateTime64(3)),
    delay_ms        UInt32 DEFAULT 0,
    error_encountered Bool DEFAULT false,
    raw_text        String DEFAULT '',
    error_message   String DEFAULT ''
)
ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(timestamp))
ORDER BY (tenant_id, job_id, log_type, timestamp, line_number)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;

-- AggregatingMergeTree materialized views store intermediate aggregation states,
-- NOT final values. All aggregate functions in the SELECT must use -State variants
-- (e.g., countState(), avgState()). When querying this view, use the corresponding
-- -Merge variants (e.g., countMerge(entry_count), avgMerge(avg_duration_ms)) to
-- finalize the aggregated result from the stored states.
CREATE MATERIALIZED VIEW IF NOT EXISTS remedyiq.log_entries_aggregates
ENGINE = AggregatingMergeTree()
PARTITION BY (tenant_id, toYYYYMM(period_start))
ORDER BY (tenant_id, job_id, log_type, period_start)
AS SELECT
    tenant_id,
    job_id,
    log_type,
    toStartOfMinute(timestamp) AS period_start,
    countState() AS entry_count,
    countIfState(success = true) AS success_count,
    countIfState(success = false) AS failure_count,
    avgState(duration_ms) AS avg_duration_ms,
    maxState(duration_ms) AS max_duration_ms,
    minState(duration_ms) AS min_duration_ms,
    sumState(duration_ms) AS sum_duration_ms,
    uniqExactState(user) AS unique_users,
    uniqExactState(form) AS unique_forms,
    uniqExactState(sql_table) AS unique_tables
FROM remedyiq.log_entries
GROUP BY tenant_id, job_id, log_type, period_start;
