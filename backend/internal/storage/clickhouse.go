package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
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

// escapeLikePattern escapes the SQL LIKE metacharacters % and _ so they are
// treated as literals. Backslash is used as the escape character (the
// ClickHouse default for ILIKE/LIKE).
func escapeLikePattern(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
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
	var extraCols string
	switch logType {
	case domain.LogTypeSQL:
		identifierExpr = "sql_table"
		extraCols = ", sql_statement, sql_table"
	case domain.LogTypeFilter:
		identifierExpr = "filter_name"
		extraCols = ", filter_name AS detail_filter_name, filter_level"
	case domain.LogTypeEscalation:
		identifierExpr = "esc_name"
		extraCols = ", esc_name AS detail_esc_name, esc_pool, delay_ms, error_encountered"
	default:
		extraCols = ""
	}

	query := fmt.Sprintf(`
		SELECT
			line_number, file_number, timestamp,
			trace_id, rpc_id, queue,
			%s AS identifier,
			form, user,
			duration_ms, queue_time_ms, success,
			thread_id, raw_text
			%s
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND log_type = @logType
		ORDER BY duration_ms DESC
		LIMIT @topN
	`, identifierExpr, extraCols)

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
		var threadID, rawText string

		// Build detail map for JSON encoding
		details := make(map[string]interface{})

		switch logType {
		case domain.LogTypeSQL:
			var sqlStatement, sqlTable string
			if err := rows.Scan(
				&e.LineNumber, &e.FileNumber, &e.Timestamp,
				&e.TraceID, &e.RPCID, &e.Queue,
				&e.Identifier,
				&e.Form, &e.User,
				&durationMS, &queueTimeMS, &e.Success,
				&threadID, &rawText,
				&sqlStatement, &sqlTable,
			); err != nil {
				return nil, err
			}
			details["sql_statement"] = sqlStatement
			details["sql_table"] = sqlTable

		case domain.LogTypeFilter:
			var filterName string
			var filterLevel uint8
			if err := rows.Scan(
				&e.LineNumber, &e.FileNumber, &e.Timestamp,
				&e.TraceID, &e.RPCID, &e.Queue,
				&e.Identifier,
				&e.Form, &e.User,
				&durationMS, &queueTimeMS, &e.Success,
				&threadID, &rawText,
				&filterName, &filterLevel,
			); err != nil {
				return nil, err
			}
			details["filter_name"] = filterName
			details["filter_level"] = filterLevel

		case domain.LogTypeEscalation:
			var escName, escPool string
			var delayMS uint32
			var errorEncountered bool
			if err := rows.Scan(
				&e.LineNumber, &e.FileNumber, &e.Timestamp,
				&e.TraceID, &e.RPCID, &e.Queue,
				&e.Identifier,
				&e.Form, &e.User,
				&durationMS, &queueTimeMS, &e.Success,
				&threadID, &rawText,
				&escName, &escPool, &delayMS, &errorEncountered,
			); err != nil {
				return nil, err
			}
			details["esc_name"] = escName
			details["esc_pool"] = escPool
			details["delay_ms"] = delayMS
			details["error_encountered"] = errorEncountered

		default:
			if err := rows.Scan(
				&e.LineNumber, &e.FileNumber, &e.Timestamp,
				&e.TraceID, &e.RPCID, &e.Queue,
				&e.Identifier,
				&e.Form, &e.User,
				&durationMS, &queueTimeMS, &e.Success,
				&threadID, &rawText,
			); err != nil {
				return nil, err
			}
		}

		details["thread_id"] = threadID
		details["raw_text"] = rawText

		if detailsJSON, err := json.Marshal(details); err == nil {
			e.Details = string(detailsJSON)
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
		escaped := escapeLikePattern(q.Query)
		where += " AND (raw_text ILIKE @query OR error_message ILIKE @query)"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "query", Value: "%" + escaped + "%"})
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

// GetAggregates returns performance aggregates grouped by form (API), user (API), and table (SQL).
func (c *ClickHouseClient) GetAggregates(ctx context.Context, tenantID, jobID string) (*domain.AggregatesResponse, error) {
	resp := &domain.AggregatesResponse{}

	// API by form
	apiByForm, err := c.queryAggregateGroups(ctx, tenantID, jobID, "API", "form", "form != ''")
	if err != nil {
		return nil, fmt.Errorf("clickhouse: aggregates api by form: %w", err)
	}
	if len(apiByForm.Groups) > 0 {
		resp.API = apiByForm
	}

	// SQL by table
	sqlByTable, err := c.queryAggregateGroups(ctx, tenantID, jobID, "SQL", "sql_table", "sql_table != ''")
	if err != nil {
		return nil, fmt.Errorf("clickhouse: aggregates sql by table: %w", err)
	}
	if len(sqlByTable.Groups) > 0 {
		resp.SQL = sqlByTable
	}

	// Filter by name
	filterByName, err := c.queryAggregateGroups(ctx, tenantID, jobID, "FLTR", "filter_name", "filter_name != ''")
	if err != nil {
		return nil, fmt.Errorf("clickhouse: aggregates filter by name: %w", err)
	}
	if len(filterByName.Groups) > 0 {
		resp.Filter = filterByName
	}

	return resp, nil
}

func (c *ClickHouseClient) queryAggregateGroups(ctx context.Context, tenantID, jobID, logType, groupCol, extraFilter string) (*domain.AggregateSection, error) {
	query := fmt.Sprintf(`
		SELECT
			%s AS name,
			count() AS cnt,
			toInt64(sum(duration_ms)) AS total_ms,
			avg(duration_ms) AS avg_ms,
			toInt64(min(duration_ms)) AS min_ms,
			toInt64(max(duration_ms)) AS max_ms,
			countIf(success = false) AS error_count,
			if(count() > 0, countIf(success = false) / count(), 0) AS error_rate,
			uniqExact(trace_id) AS unique_traces
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND log_type = @logType AND %s
		GROUP BY name
		ORDER BY total_ms DESC
	`, groupCol, extraFilter)

	rows, err := c.conn.Query(ctx, query,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
		clickhouse.Named("logType", logType),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	section := &domain.AggregateSection{}
	var grandCount, grandTotalMS, grandMinMS, grandMaxMS, grandErrors int64
	var grandTraces int
	first := true

	for rows.Next() {
		var g domain.AggregateGroup
		if err := rows.Scan(
			&g.Name, &g.Count, &g.TotalMS, &g.AvgMS,
			&g.MinMS, &g.MaxMS, &g.ErrorCount, &g.ErrorRate, &g.UniqueTraces,
		); err != nil {
			return nil, err
		}
		section.Groups = append(section.Groups, g)

		grandCount += g.Count
		grandTotalMS += g.TotalMS
		grandErrors += g.ErrorCount
		grandTraces += g.UniqueTraces
		if first || g.MinMS < grandMinMS {
			grandMinMS = g.MinMS
		}
		if g.MaxMS > grandMaxMS {
			grandMaxMS = g.MaxMS
		}
		first = false
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if grandCount > 0 {
		section.GrandTotal = &domain.AggregateGroup{
			Name:         "Total",
			Count:        grandCount,
			TotalMS:      grandTotalMS,
			AvgMS:        float64(grandTotalMS) / float64(grandCount),
			MinMS:        grandMinMS,
			MaxMS:        grandMaxMS,
			ErrorCount:   grandErrors,
			ErrorRate:    float64(grandErrors) / float64(grandCount),
			UniqueTraces: grandTraces,
		}
	}

	return section, nil
}

// GetExceptions returns exception entries grouped by error code with frequency and error rates.
func (c *ClickHouseClient) GetExceptions(ctx context.Context, tenantID, jobID string) (*domain.ExceptionsResponse, error) {
	rows, err := c.conn.Query(ctx, `
		SELECT
			if(error_message != '', substring(error_message, 1, 100), 'Unknown Error') AS error_code,
			any(error_message) AS message,
			count() AS cnt,
			min(timestamp) AS first_seen,
			max(timestamp) AS last_seen,
			any(log_type) AS log_type,
			any(queue) AS queue,
			any(form) AS form,
			any(user) AS usr,
			any(line_number) AS sample_line,
			any(trace_id) AS sample_trace
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND success = false
		GROUP BY error_code
		ORDER BY cnt DESC
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: exceptions query: %w", err)
	}
	defer rows.Close()

	resp := &domain.ExceptionsResponse{
		Exceptions: []domain.ExceptionEntry{},
		ErrorRates: make(map[string]float64),
		TopCodes:   []string{},
	}

	for rows.Next() {
		var e domain.ExceptionEntry
		var sampleLine uint32
		if err := rows.Scan(
			&e.ErrorCode, &e.Message, &e.Count,
			&e.FirstSeen, &e.LastSeen,
			&e.LogType, &e.Queue, &e.Form, &e.User,
			&sampleLine, &e.SampleTrace,
		); err != nil {
			return nil, err
		}
		e.SampleLine = int(sampleLine)
		resp.Exceptions = append(resp.Exceptions, e)
		resp.TotalCount += e.Count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Top codes (up to 10)
	for i, ex := range resp.Exceptions {
		if i >= 10 {
			break
		}
		resp.TopCodes = append(resp.TopCodes, ex.ErrorCode)
	}

	// Error rates per log type
	rateRows, err := c.conn.Query(ctx, `
		SELECT
			log_type,
			countIf(success = false) AS errors,
			count() AS total
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID
		GROUP BY log_type
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: error rates: %w", err)
	}
	defer rateRows.Close()

	for rateRows.Next() {
		var lt string
		var errors, total int64
		if err := rateRows.Scan(&lt, &errors, &total); err != nil {
			return nil, err
		}
		if total > 0 {
			resp.ErrorRates[lt] = float64(errors) / float64(total)
		}
	}

	return resp, rateRows.Err()
}

// GetGaps detects time gaps between consecutive log entries.
func (c *ClickHouseClient) GetGaps(ctx context.Context, tenantID, jobID string) (*domain.GapsResponse, error) {
	resp := &domain.GapsResponse{
		Gaps:        []domain.GapEntry{},
		QueueHealth: []domain.QueueHealthSummary{},
	}

	// Line gaps — gaps across all entries ordered by timestamp
	lineRows, err := c.conn.Query(ctx, `
		SELECT
			start_time, end_time, gap_ms,
			before_line, after_line, log_type
		FROM (
			SELECT
				timestamp AS start_time,
				neighbor(timestamp, 1) AS end_time,
				dateDiff('millisecond', timestamp, neighbor(timestamp, 1)) AS gap_ms,
				line_number AS before_line,
				neighbor(line_number, 1) AS after_line,
				log_type
			FROM log_entries
			WHERE tenant_id = @tenantID AND job_id = @jobID
			ORDER BY timestamp ASC
		)
		WHERE gap_ms > 0 AND end_time != toDateTime64('1970-01-01 00:00:00', 3)
		ORDER BY gap_ms DESC
		LIMIT 50
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: line gaps: %w", err)
	}
	defer lineRows.Close()

	for lineRows.Next() {
		var g domain.GapEntry
		var beforeLine, afterLine uint32
		if err := lineRows.Scan(
			&g.StartTime, &g.EndTime, &g.DurationMS,
			&beforeLine, &afterLine, &g.LogType,
		); err != nil {
			return nil, err
		}
		g.BeforeLine = int(beforeLine)
		g.AfterLine = int(afterLine)
		resp.Gaps = append(resp.Gaps, g)
	}
	if err := lineRows.Err(); err != nil {
		return nil, err
	}

	// Queue health
	qRows, err := c.conn.Query(ctx, `
		SELECT
			queue,
			count() AS total_calls,
			avg(duration_ms) AS avg_ms,
			if(count() > 0, countIf(success = false) / count(), 0) AS error_rate,
			toInt64(quantile(0.95)(duration_ms)) AS p95_ms
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND queue != ''
		GROUP BY queue
		ORDER BY total_calls DESC
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: queue health: %w", err)
	}
	defer qRows.Close()

	for qRows.Next() {
		var q domain.QueueHealthSummary
		if err := qRows.Scan(&q.Queue, &q.TotalCalls, &q.AvgMS, &q.ErrorRate, &q.P95MS); err != nil {
			return nil, err
		}
		resp.QueueHealth = append(resp.QueueHealth, q)
	}

	return resp, qRows.Err()
}

// GetThreadStats returns per-thread utilization statistics.
func (c *ClickHouseClient) GetThreadStats(ctx context.Context, tenantID, jobID string) (*domain.ThreadStatsResponse, error) {
	rows, err := c.conn.Query(ctx, `
		SELECT
			thread_id,
			count() AS total_calls,
			toInt64(sum(duration_ms)) AS total_ms,
			avg(duration_ms) AS avg_ms,
			toInt64(max(duration_ms)) AS max_ms,
			countIf(success = false) AS error_count,
			if(
				dateDiff('millisecond', min(timestamp), max(timestamp)) > 0,
				least((sum(duration_ms) / dateDiff('millisecond', min(timestamp), max(timestamp))) * 100, 100),
				0
			) AS busy_pct,
			formatDateTime(min(timestamp), '%Y-%m-%d %H:%M:%S') AS active_start,
			formatDateTime(max(timestamp), '%Y-%m-%d %H:%M:%S') AS active_end
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND thread_id != ''
		GROUP BY thread_id
		ORDER BY busy_pct DESC
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: thread stats: %w", err)
	}
	defer rows.Close()

	resp := &domain.ThreadStatsResponse{
		Threads: []domain.ThreadStatsEntry{},
	}

	for rows.Next() {
		var t domain.ThreadStatsEntry
		if err := rows.Scan(
			&t.ThreadID, &t.TotalCalls, &t.TotalMS, &t.AvgMS,
			&t.MaxMS, &t.ErrorCount, &t.BusyPct,
			&t.ActiveStart, &t.ActiveEnd,
		); err != nil {
			return nil, err
		}
		resp.Threads = append(resp.Threads, t)
		resp.TotalThreads++
	}

	return resp, rows.Err()
}

// GetFilterComplexity returns filter execution complexity metrics.
func (c *ClickHouseClient) GetFilterComplexity(ctx context.Context, tenantID, jobID string) (*domain.FilterComplexityResponse, error) {
	resp := &domain.FilterComplexityResponse{
		MostExecuted:   []domain.MostExecutedFilter{},
		PerTransaction: []domain.FilterPerTransaction{},
	}

	// Most executed filters
	meRows, err := c.conn.Query(ctx, `
		SELECT
			filter_name AS name,
			count() AS cnt,
			toInt64(sum(duration_ms)) AS total_ms
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND log_type = 'FLTR' AND filter_name != ''
		GROUP BY filter_name
		ORDER BY cnt DESC
		LIMIT 50
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: most executed filters: %w", err)
	}
	defer meRows.Close()

	for meRows.Next() {
		var f domain.MostExecutedFilter
		if err := meRows.Scan(&f.Name, &f.Count, &f.TotalMS); err != nil {
			return nil, err
		}
		resp.MostExecuted = append(resp.MostExecuted, f)
	}
	if err := meRows.Err(); err != nil {
		return nil, err
	}

	// Per transaction
	ptRows, err := c.conn.Query(ctx, `
		SELECT
			trace_id AS transaction_id,
			filter_name,
			count() AS execution_count,
			toInt64(sum(duration_ms)) AS total_ms,
			avg(duration_ms) AS avg_ms,
			toInt64(max(duration_ms)) AS max_ms,
			any(queue) AS queue,
			any(form) AS form
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND log_type = 'FLTR' AND filter_name != '' AND trace_id != ''
		GROUP BY trace_id, filter_name
		ORDER BY total_ms DESC
		LIMIT 100
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: filter per transaction: %w", err)
	}
	defer ptRows.Close()

	for ptRows.Next() {
		var f domain.FilterPerTransaction
		if err := ptRows.Scan(
			&f.TransactionID, &f.FilterName, &f.ExecutionCount,
			&f.TotalMS, &f.AvgMS, &f.MaxMS, &f.Queue, &f.Form,
		); err != nil {
			return nil, err
		}
		resp.PerTransaction = append(resp.PerTransaction, f)
	}
	if err := ptRows.Err(); err != nil {
		return nil, err
	}

	// Total filter time
	var totalMS int64
	row := c.conn.QueryRow(ctx, `
		SELECT toInt64(sum(duration_ms))
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID AND log_type = 'FLTR'
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err := row.Scan(&totalMS); err != nil {
		// If no rows, total is 0
		totalMS = 0
	}
	resp.TotalFilterTimeMS = totalMS

	return resp, nil
}

// ComputeHealthScore calculates a composite health score (0-100) from 4 weighted factors.
func (c *ClickHouseClient) ComputeHealthScore(ctx context.Context, tenantID, jobID string) (*domain.HealthScore, error) {
	// Fetch metrics in a single query
	row := c.conn.QueryRow(ctx, `
		SELECT
			if(count() > 0, countIf(success = false) / count(), 0) AS error_rate,
			avg(duration_ms) AS avg_duration_ms
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)

	var errorRate, avgDuration float64
	if err := row.Scan(&errorRate, &avgDuration); err != nil {
		return nil, fmt.Errorf("clickhouse: health score base metrics: %w", err)
	}

	// Max thread busy pct
	var maxBusyPct float64
	busyRow := c.conn.QueryRow(ctx, `
		SELECT if(
			count() > 0,
			max(busy_pct),
			0
		) FROM (
			SELECT
				if(
					dateDiff('millisecond', min(timestamp), max(timestamp)) > 0,
					least((sum(duration_ms) / dateDiff('millisecond', min(timestamp), max(timestamp))) * 100, 100),
					0
				) AS busy_pct
			FROM log_entries
			WHERE tenant_id = @tenantID AND job_id = @jobID AND thread_id != ''
			GROUP BY thread_id
		)
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err := busyRow.Scan(&maxBusyPct); err != nil {
		maxBusyPct = 0
	}

	// Max gap duration
	var maxGapMS int64
	gapRow := c.conn.QueryRow(ctx, `
		SELECT if(count() > 0, max(gap_ms), 0)
		FROM (
			SELECT dateDiff('millisecond', timestamp, neighbor(timestamp, 1)) AS gap_ms
			FROM log_entries
			WHERE tenant_id = @tenantID AND job_id = @jobID
			ORDER BY timestamp ASC
		)
		WHERE gap_ms > 0
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err := gapRow.Scan(&maxGapMS); err != nil {
		maxGapMS = 0
	}

	// Compute factor scores
	factors := make([]domain.HealthScoreFactor, 4)

	// Error Rate (weight: 0.30)
	errScore := scoreErrorRate(errorRate)
	factors[0] = domain.HealthScoreFactor{
		Name:        "Error Rate",
		Score:       errScore,
		MaxScore:    100,
		Weight:      0.30,
		Description: fmt.Sprintf("%.2f%% of operations failed", errorRate*100),
		Severity:    scoreSeverity(errScore),
	}

	// Avg Response Time (weight: 0.25)
	rtScore := scoreResponseTime(avgDuration)
	factors[1] = domain.HealthScoreFactor{
		Name:        "Avg Response Time",
		Score:       rtScore,
		MaxScore:    100,
		Weight:      0.25,
		Description: fmt.Sprintf("%.0fms average duration", avgDuration),
		Severity:    scoreSeverity(rtScore),
	}

	// Thread Saturation (weight: 0.25)
	tsScore := scoreThreadSaturation(maxBusyPct)
	factors[2] = domain.HealthScoreFactor{
		Name:        "Thread Saturation",
		Score:       tsScore,
		MaxScore:    100,
		Weight:      0.25,
		Description: fmt.Sprintf("%.0f%% max thread utilization", maxBusyPct),
		Severity:    scoreSeverity(tsScore),
	}

	// Gap Frequency (weight: 0.20)
	gapSecs := float64(maxGapMS) / 1000.0
	gfScore := scoreGapFrequency(gapSecs)
	factors[3] = domain.HealthScoreFactor{
		Name:        "Gap Frequency",
		Score:       gfScore,
		MaxScore:    100,
		Weight:      0.20,
		Description: fmt.Sprintf("%.1fs longest gap", gapSecs),
		Severity:    scoreSeverity(gfScore),
	}

	// Weighted composite
	composite := float64(errScore)*0.30 + float64(rtScore)*0.25 + float64(tsScore)*0.25 + float64(gfScore)*0.20
	score := int(math.Round(composite))

	status := "green"
	if score < 50 {
		status = "red"
	} else if score <= 80 {
		status = "yellow"
	}

	return &domain.HealthScore{
		Score:   score,
		Status:  status,
		Factors: factors,
	}, nil
}

func scoreErrorRate(rate float64) int {
	switch {
	case rate < 0.01:
		return 100
	case rate < 0.02:
		return 80
	case rate < 0.05:
		return 50
	case rate < 0.10:
		return 25
	default:
		return 0
	}
}

func scoreResponseTime(avgMS float64) int {
	switch {
	case avgMS < 500:
		return 100
	case avgMS < 1000:
		return 80
	case avgMS < 2000:
		return 50
	case avgMS < 5000:
		return 25
	default:
		return 0
	}
}

func scoreThreadSaturation(maxBusyPct float64) int {
	switch {
	case maxBusyPct < 50:
		return 100
	case maxBusyPct < 70:
		return 80
	case maxBusyPct < 85:
		return 50
	case maxBusyPct < 95:
		return 25
	default:
		return 0
	}
}

func scoreGapFrequency(maxGapSecs float64) int {
	switch {
	case maxGapSecs < 5:
		return 100
	case maxGapSecs < 15:
		return 80
	case maxGapSecs < 30:
		return 50
	case maxGapSecs < 60:
		return 25
	default:
		return 0
	}
}

func scoreSeverity(score int) string {
	if score > 80 {
		return "green"
	} else if score >= 50 {
		return "yellow"
	}
	return "red"
}
