package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

// SearchQuery defines the parameters for a paginated log search.
type SearchQuery struct {
	Query     string   `json:"query"`
	LogTypes  []string `json:"log_types,omitempty"`
	TimeFrom  *time.Time `json:"time_from,omitempty"`
	TimeTo    *time.Time `json:"time_to,omitempty"`
	UserFilter  string `json:"user_filter,omitempty"`
	QueueFilter string `json:"queue_filter,omitempty"`
	SortBy      string `json:"sort_by,omitempty"`
	SortOrder   string `json:"sort_order,omitempty"`
	Page        int    `json:"page"`
	PageSize    int    `json:"page_size"`
}

// SearchResult holds the results from a paginated log search.
type SearchResult struct {
	Entries    []domain.LogEntry `json:"entries"`
	TotalCount int64            `json:"total_count"`
	TookMS     int              `json:"took_ms"`
}

// ClickHouseClient wraps a ClickHouse connection pool.
type ClickHouseClient struct {
	conn driver.Conn
}

// NewClickHouseClient creates a new ClickHouse client from the given DSN.
// The DSN format follows the clickhouse-go v2 convention, e.g.
// "clickhouse://localhost:9000/remedyiq".
func NewClickHouseClient(ctx context.Context, dsn string) (*ClickHouseClient, error) {
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: parse dsn: %w", err)
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: open: %w", err)
	}

	if err := conn.Ping(ctx); err != nil {
		return nil, fmt.Errorf("clickhouse: ping: %w", err)
	}

	return &ClickHouseClient{conn: conn}, nil
}

// Close releases the underlying connection pool.
func (c *ClickHouseClient) Close() error {
	return c.conn.Close()
}

// Ping verifies connectivity to ClickHouse.
func (c *ClickHouseClient) Ping(ctx context.Context) error {
	return c.conn.Ping(ctx)
}

// BatchInsertEntries inserts a batch of log entries into the log_entries table.
// All entries are inserted within a single batch for optimal throughput.
func (c *ClickHouseClient) BatchInsertEntries(ctx context.Context, entries []domain.LogEntry) error {
	if len(entries) == 0 {
		return nil
	}

	batch, err := c.conn.PrepareBatch(ctx, `
		INSERT INTO log_entries (
			tenant_id, job_id, entry_id, line_number, file_number,
			timestamp, ingested_at, log_type,
			trace_id, rpc_id, thread_id,
			queue, user,
			duration_ms, queue_time_ms, success,
			api_code, form,
			sql_table, sql_statement,
			filter_name, filter_level, operation, request_id,
			esc_name, esc_pool, scheduled_time, delay_ms, error_encountered,
			raw_text, error_message
		)
	`)
	if err != nil {
		return fmt.Errorf("clickhouse: prepare batch: %w", err)
	}

	for i := range entries {
		e := &entries[i]

		// Normalise nil scheduled_time to zero value for ClickHouse.
		scheduledTime := time.Time{}
		if e.ScheduledTime != nil {
			scheduledTime = *e.ScheduledTime
		}

		if err := batch.Append(
			e.TenantID, e.JobID, e.EntryID, e.LineNumber, e.FileNumber,
			e.Timestamp, e.IngestedAt, string(e.LogType),
			e.TraceID, e.RPCID, e.ThreadID,
			e.Queue, e.User,
			e.DurationMS, e.QueueTimeMS, e.Success,
			e.APICode, e.Form,
			e.SQLTable, e.SQLStatement,
			e.FilterName, e.FilterLevel, e.Operation, e.RequestID,
			e.EscName, e.EscPool, scheduledTime, e.DelayMS, e.ErrorEncountered,
			e.RawText, e.ErrorMessage,
		); err != nil {
			return fmt.Errorf("clickhouse: append row %d: %w", i, err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send batch: %w", err)
	}

	return nil
}

// GetDashboardData queries ClickHouse for all dashboard-level analytics for
// a given tenant and job. topN controls how many entries to return in each
// "top" ranking.
func (c *ClickHouseClient) GetDashboardData(ctx context.Context, tenantID, jobID string, topN int) (*domain.DashboardData, error) {
	if topN <= 0 {
		topN = 25
	}

	dash := &domain.DashboardData{
		Distribution: make(map[string]map[string]int),
	}

	// --- General statistics ---
	if err := c.queryGeneralStats(ctx, tenantID, jobID, &dash.GeneralStats); err != nil {
		return nil, fmt.Errorf("clickhouse: general stats: %w", err)
	}

	// --- Top-N per log type ---
	var err error
	dash.TopAPICalls, err = c.queryTopN(ctx, tenantID, jobID, domain.LogTypeAPI, topN)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: top api: %w", err)
	}

	dash.TopSQL, err = c.queryTopN(ctx, tenantID, jobID, domain.LogTypeSQL, topN)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: top sql: %w", err)
	}

	dash.TopFilters, err = c.queryTopN(ctx, tenantID, jobID, domain.LogTypeFilter, topN)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: top filters: %w", err)
	}

	dash.TopEscalations, err = c.queryTopN(ctx, tenantID, jobID, domain.LogTypeEscalation, topN)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: top escalations: %w", err)
	}

	// --- Time series ---
	dash.TimeSeries, err = c.queryTimeSeries(ctx, tenantID, jobID)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: time series: %w", err)
	}

	// --- Distribution ---
	if err := c.queryDistribution(ctx, tenantID, jobID, dash); err != nil {
		return nil, fmt.Errorf("clickhouse: distribution: %w", err)
	}

	return dash, nil
}

func (c *ClickHouseClient) queryGeneralStats(ctx context.Context, tenantID, jobID string, stats *domain.GeneralStatistics) error {
	row := c.conn.QueryRow(ctx, `
		SELECT
			count()                                             AS total_lines,
			countIf(log_type = 'API')                           AS api_count,
			countIf(log_type = 'SQL')                           AS sql_count,
			countIf(log_type = 'FLTR')                          AS filter_count,
			countIf(log_type = 'ESCL')                          AS esc_count,
			uniqExact(user)                                     AS unique_users,
			uniqExactIf(form, form != '')                       AS unique_forms,
			uniqExactIf(sql_table, sql_table != '')             AS unique_tables,
			min(timestamp)                                      AS log_start,
			max(timestamp)                                      AS log_end
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)

	var logStart, logEnd time.Time
	if err := row.Scan(
		&stats.TotalLines,
		&stats.APICount,
		&stats.SQLCount,
		&stats.FilterCount,
		&stats.EscCount,
		&stats.UniqueUsers,
		&stats.UniqueForms,
		&stats.UniqueTables,
		&logStart,
		&logEnd,
	); err != nil {
		return err
	}
	stats.LogStart = logStart
	stats.LogEnd = logEnd

	if !logStart.IsZero() && !logEnd.IsZero() {
		stats.LogDuration = logEnd.Sub(logStart).String()
	}

	return nil
}

func (c *ClickHouseClient) queryTopN(ctx context.Context, tenantID, jobID string, logType domain.LogType, topN int) ([]domain.TopNEntry, error) {
	// Identifier column varies by log type.
	identifierExpr := "api_code"
	switch logType {
	case domain.LogTypeSQL:
		identifierExpr = "sql_table"
	case domain.LogTypeFilter:
		identifierExpr = "filter_name"
	case domain.LogTypeEscalation:
		identifierExpr = "esc_name"
	}

	query := fmt.Sprintf(`
		SELECT
			line_number, file_number, timestamp,
			trace_id, rpc_id, queue,
			%s AS identifier,
			form, user,
			duration_ms, queue_time_ms, success
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND log_type = @logType
		ORDER BY duration_ms DESC
		LIMIT @topN
	`, identifierExpr)

	rows, err := c.conn.Query(ctx, query,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
		clickhouse.Named("logType", string(logType)),
		clickhouse.Named("topN", topN),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.TopNEntry
	rank := 1
	for rows.Next() {
		var e domain.TopNEntry
		var durationMS, queueTimeMS uint32
		if err := rows.Scan(
			&e.LineNumber, &e.FileNumber, &e.Timestamp,
			&e.TraceID, &e.RPCID, &e.Queue,
			&e.Identifier,
			&e.Form, &e.User,
			&durationMS, &queueTimeMS, &e.Success,
		); err != nil {
			return nil, err
		}
		e.Rank = rank
		e.DurationMS = int(durationMS)
		e.QueueTimeMS = int(queueTimeMS)
		rank++
		results = append(results, e)
	}

	return results, rows.Err()
}

func (c *ClickHouseClient) queryTimeSeries(ctx context.Context, tenantID, jobID string) ([]domain.TimeSeriesPoint, error) {
	rows, err := c.conn.Query(ctx, `
		SELECT
			toStartOfMinute(timestamp)     AS ts,
			countIf(log_type = 'API')      AS api_count,
			countIf(log_type = 'SQL')      AS sql_count,
			countIf(log_type = 'FLTR')     AS filter_count,
			countIf(log_type = 'ESCL')     AS esc_count,
			avg(duration_ms)               AS avg_duration_ms,
			countIf(success = false)       AS error_count
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID
		GROUP BY ts
		ORDER BY ts
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.TimeSeriesPoint
	for rows.Next() {
		var p domain.TimeSeriesPoint
		if err := rows.Scan(
			&p.Timestamp,
			&p.APICount, &p.SQLCount, &p.FilterCount, &p.EscCount,
			&p.AvgDurationMS,
			&p.ErrorCount,
		); err != nil {
			return nil, err
		}
		results = append(results, p)
	}

	return results, rows.Err()
}

func (c *ClickHouseClient) queryDistribution(ctx context.Context, tenantID, jobID string, dash *domain.DashboardData) error {
	// Distribution by log type.
	typeRows, err := c.conn.Query(ctx, `
		SELECT log_type, count() AS cnt
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID
		GROUP BY log_type
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err != nil {
		return err
	}
	defer typeRows.Close()

	byType := make(map[string]int)
	for typeRows.Next() {
		var lt string
		var cnt int
		if err := typeRows.Scan(&lt, &cnt); err != nil {
			return err
		}
		byType[lt] = cnt
	}
	if err := typeRows.Err(); err != nil {
		return err
	}
	dash.Distribution["by_type"] = byType

	// Distribution by queue (top 20).
	queueRows, err := c.conn.Query(ctx, `
		SELECT queue, count() AS cnt
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND queue != ''
		GROUP BY queue
		ORDER BY cnt DESC
		LIMIT 20
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err != nil {
		return err
	}
	defer queueRows.Close()

	byQueue := make(map[string]int)
	for queueRows.Next() {
		var q string
		var cnt int
		if err := queueRows.Scan(&q, &cnt); err != nil {
			return err
		}
		byQueue[q] = cnt
	}
	if err := queueRows.Err(); err != nil {
		return err
	}
	dash.Distribution["by_queue"] = byQueue

	return nil
}

// GetLogEntry retrieves a single log entry by its composite key.
func (c *ClickHouseClient) GetLogEntry(ctx context.Context, tenantID, jobID, entryID string) (*domain.LogEntry, error) {
	row := c.conn.QueryRow(ctx, `
		SELECT
			tenant_id, job_id, entry_id, line_number, file_number,
			timestamp, ingested_at, log_type,
			trace_id, rpc_id, thread_id,
			queue, user,
			duration_ms, queue_time_ms, success,
			api_code, form,
			sql_table, sql_statement,
			filter_name, filter_level, operation, request_id,
			esc_name, esc_pool, scheduled_time, delay_ms, error_encountered,
			raw_text, error_message
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND entry_id = @entryID
		LIMIT 1
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
		clickhouse.Named("entryID", entryID),
	)

	var e domain.LogEntry
	var scheduledTime time.Time
	if err := row.Scan(
		&e.TenantID, &e.JobID, &e.EntryID, &e.LineNumber, &e.FileNumber,
		&e.Timestamp, &e.IngestedAt, &e.LogType,
		&e.TraceID, &e.RPCID, &e.ThreadID,
		&e.Queue, &e.User,
		&e.DurationMS, &e.QueueTimeMS, &e.Success,
		&e.APICode, &e.Form,
		&e.SQLTable, &e.SQLStatement,
		&e.FilterName, &e.FilterLevel, &e.Operation, &e.RequestID,
		&e.EscName, &e.EscPool, &scheduledTime, &e.DelayMS, &e.ErrorEncountered,
		&e.RawText, &e.ErrorMessage,
	); err != nil {
		return nil, fmt.Errorf("clickhouse: get entry: %w", err)
	}

	if !scheduledTime.IsZero() {
		e.ScheduledTime = &scheduledTime
	}

	return &e, nil
}

// SearchEntries performs a paginated search over log entries with optional
// filters. All queries are tenant-scoped.
func (c *ClickHouseClient) SearchEntries(ctx context.Context, tenantID, jobID string, q SearchQuery) (*SearchResult, error) {
	start := time.Now()

	if q.PageSize <= 0 {
		q.PageSize = 50
	}
	if q.PageSize > 500 {
		q.PageSize = 500
	}
	if q.Page < 1 {
		q.Page = 1
	}

	// Determine sort column and direction.
	sortCol := "timestamp"
	switch q.SortBy {
	case "duration_ms", "line_number", "timestamp":
		sortCol = q.SortBy
	}
	sortDir := "DESC"
	if q.SortOrder == "asc" || q.SortOrder == "ASC" {
		sortDir = "ASC"
	}

	// Build the WHERE clause dynamically.
	where := "tenant_id = @tenantID AND job_id = @jobID"
	namedArgs := []driver.NamedValue{
		{Name: "tenantID", Value: tenantID},
		{Name: "jobID", Value: jobID},
	}

	if q.Query != "" {
		where += " AND (raw_text ILIKE @query OR error_message ILIKE @query)"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "query", Value: "%" + q.Query + "%"})
	}

	if len(q.LogTypes) > 0 {
		where += " AND log_type IN (@logTypes)"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "logTypes", Value: q.LogTypes})
	}

	if q.TimeFrom != nil {
		where += " AND timestamp >= @timeFrom"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "timeFrom", Value: *q.TimeFrom})
	}

	if q.TimeTo != nil {
		where += " AND timestamp <= @timeTo"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "timeTo", Value: *q.TimeTo})
	}

	if q.UserFilter != "" {
		where += " AND user = @userFilter"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "userFilter", Value: q.UserFilter})
	}

	if q.QueueFilter != "" {
		where += " AND queue = @queueFilter"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "queueFilter", Value: q.QueueFilter})
	}

	// Convert named args to clickhouse.Named parameters.
	chArgs := make([]any, len(namedArgs))
	for i, na := range namedArgs {
		chArgs[i] = clickhouse.Named(na.Name, na.Value)
	}

	// Count query.
	countQuery := fmt.Sprintf("SELECT count() FROM log_entries WHERE %s", where)
	var totalCount int64
	if err := c.conn.QueryRow(ctx, countQuery, chArgs...).Scan(&totalCount); err != nil {
		return nil, fmt.Errorf("clickhouse: search count: %w", err)
	}

	// Data query.
	offset := (q.Page - 1) * q.PageSize
	dataQuery := fmt.Sprintf(`
		SELECT
			tenant_id, job_id, entry_id, line_number, file_number,
			timestamp, ingested_at, log_type,
			trace_id, rpc_id, thread_id,
			queue, user,
			duration_ms, queue_time_ms, success,
			api_code, form,
			sql_table, sql_statement,
			filter_name, filter_level, operation, request_id,
			esc_name, esc_pool, scheduled_time, delay_ms, error_encountered,
			raw_text, error_message
		FROM log_entries
		WHERE %s
		ORDER BY %s %s
		LIMIT %d OFFSET %d
	`, where, sortCol, sortDir, q.PageSize, offset)

	rows, err := c.conn.Query(ctx, dataQuery, chArgs...)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: search query: %w", err)
	}
	defer rows.Close()

	var entries []domain.LogEntry
	for rows.Next() {
		var e domain.LogEntry
		var scheduledTime time.Time
		if err := rows.Scan(
			&e.TenantID, &e.JobID, &e.EntryID, &e.LineNumber, &e.FileNumber,
			&e.Timestamp, &e.IngestedAt, &e.LogType,
			&e.TraceID, &e.RPCID, &e.ThreadID,
			&e.Queue, &e.User,
			&e.DurationMS, &e.QueueTimeMS, &e.Success,
			&e.APICode, &e.Form,
			&e.SQLTable, &e.SQLStatement,
			&e.FilterName, &e.FilterLevel, &e.Operation, &e.RequestID,
			&e.EscName, &e.EscPool, &scheduledTime, &e.DelayMS, &e.ErrorEncountered,
			&e.RawText, &e.ErrorMessage,
		); err != nil {
			return nil, fmt.Errorf("clickhouse: scan entry: %w", err)
		}
		if !scheduledTime.IsZero() {
			e.ScheduledTime = &scheduledTime
		}
		entries = append(entries, e)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: rows: %w", err)
	}

	return &SearchResult{
		Entries:    entries,
		TotalCount: totalCount,
		TookMS:     int(time.Since(start).Milliseconds()),
	}, nil
}

// GetTraceEntries returns all log entries sharing a trace_id, ordered by
// timestamp. Results are tenant-scoped.
func (c *ClickHouseClient) GetTraceEntries(ctx context.Context, tenantID, jobID, traceID string) ([]domain.LogEntry, error) {
	rows, err := c.conn.Query(ctx, `
		SELECT
			tenant_id, job_id, entry_id, line_number, file_number,
			timestamp, ingested_at, log_type,
			trace_id, rpc_id, thread_id,
			queue, user,
			duration_ms, queue_time_ms, success,
			api_code, form,
			sql_table, sql_statement,
			filter_name, filter_level, operation, request_id,
			esc_name, esc_pool, scheduled_time, delay_ms, error_encountered,
			raw_text, error_message
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND trace_id = @traceID
		ORDER BY timestamp ASC
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
		clickhouse.Named("traceID", traceID),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: trace query: %w", err)
	}
	defer rows.Close()

	var entries []domain.LogEntry
	for rows.Next() {
		var e domain.LogEntry
		var scheduledTime time.Time
		if err := rows.Scan(
			&e.TenantID, &e.JobID, &e.EntryID, &e.LineNumber, &e.FileNumber,
			&e.Timestamp, &e.IngestedAt, &e.LogType,
			&e.TraceID, &e.RPCID, &e.ThreadID,
			&e.Queue, &e.User,
			&e.DurationMS, &e.QueueTimeMS, &e.Success,
			&e.APICode, &e.Form,
			&e.SQLTable, &e.SQLStatement,
			&e.FilterName, &e.FilterLevel, &e.Operation, &e.RequestID,
			&e.EscName, &e.EscPool, &scheduledTime, &e.DelayMS, &e.ErrorEncountered,
			&e.RawText, &e.ErrorMessage,
		); err != nil {
			return nil, fmt.Errorf("clickhouse: scan trace entry: %w", err)
		}
		if !scheduledTime.IsZero() {
			e.ScheduledTime = &scheduledTime
		}
		entries = append(entries, e)
	}

	return entries, rows.Err()
}
