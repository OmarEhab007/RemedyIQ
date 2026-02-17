package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/search"
)

// JobTimeRange holds the min/max timestamps for a job's log entries.
type JobTimeRange struct {
	Start time.Time
	End   time.Time
}

// SearchQuery defines the parameters for a paginated log search.
type SearchQuery struct {
	Query       string     `json:"query"`
	LogTypes    []string   `json:"log_types,omitempty"`
	TimeFrom    *time.Time `json:"time_from,omitempty"`
	TimeTo      *time.Time `json:"time_to,omitempty"`
	UserFilter  string     `json:"user_filter,omitempty"`
	Users       []string   `json:"users,omitempty"`
	QueueFilter string     `json:"queue_filter,omitempty"`
	Queues      []string   `json:"queues,omitempty"`
	SortBy      string     `json:"sort_by,omitempty"`
	SortOrder   string     `json:"sort_order,omitempty"`
	Page        int        `json:"page"`
	PageSize    int        `json:"page_size"`
	ExportMode  bool       `json:"-"` // bypass page_size cap (export only)
}

// SearchResult holds the results from a paginated log search.
type SearchResult struct {
	Entries    []domain.LogEntry `json:"entries"`
	TotalCount int64             `json:"total_count"`
	TookMS     int               `json:"took_ms"`
}

// FacetValue holds a single value and its count for faceted search results.
type FacetValue struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
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

	var (
		totalLines   uint64
		apiCount     uint64
		sqlCount     uint64
		filterCount  uint64
		escCount     uint64
		uniqueUsers  uint64
		uniqueForms  uint64
		uniqueTables uint64
		logStart     time.Time
		logEnd       time.Time
	)
	if err := row.Scan(
		&totalLines,
		&apiCount,
		&sqlCount,
		&filterCount,
		&escCount,
		&uniqueUsers,
		&uniqueForms,
		&uniqueTables,
		&logStart,
		&logEnd,
	); err != nil {
		return fmt.Errorf("clickhouse: general stats scan: %w", err)
	}
	stats.TotalLines = int64(totalLines)
	stats.APICount = int64(apiCount)
	stats.SQLCount = int64(sqlCount)
	stats.FilterCount = int64(filterCount)
	stats.EscCount = int64(escCount)
	stats.UniqueUsers = int(uniqueUsers)
	stats.UniqueForms = int(uniqueForms)
	stats.UniqueTables = int(uniqueTables)
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
		return nil, fmt.Errorf("clickhouse: topN query (%s): %w", logType, err)
	}
	defer rows.Close()

	var results []domain.TopNEntry
	rank := 1
	for rows.Next() {
		var e domain.TopNEntry
		var lineNumber uint32
		var fileNumber uint16
		var durationMS, queueTimeMS uint32
		var threadID, rawText string

		// Build detail map for JSON encoding
		details := make(map[string]interface{})

		switch logType {
		case domain.LogTypeSQL:
			var sqlStatement, sqlTable string
			if err := rows.Scan(
				&lineNumber, &fileNumber, &e.Timestamp,
				&e.TraceID, &e.RPCID, &e.Queue,
				&e.Identifier,
				&e.Form, &e.User,
				&durationMS, &queueTimeMS, &e.Success,
				&threadID, &rawText,
				&sqlStatement, &sqlTable,
			); err != nil {
				return nil, fmt.Errorf("clickhouse: topN scan (%s): %w", logType, err)
			}
			details["sql_statement"] = sqlStatement
			details["sql_table"] = sqlTable

		case domain.LogTypeFilter:
			var filterName string
			var filterLevel uint8
			if err := rows.Scan(
				&lineNumber, &fileNumber, &e.Timestamp,
				&e.TraceID, &e.RPCID, &e.Queue,
				&e.Identifier,
				&e.Form, &e.User,
				&durationMS, &queueTimeMS, &e.Success,
				&threadID, &rawText,
				&filterName, &filterLevel,
			); err != nil {
				return nil, fmt.Errorf("clickhouse: topN scan (%s): %w", logType, err)
			}
			details["filter_name"] = filterName
			details["filter_level"] = filterLevel

		case domain.LogTypeEscalation:
			var escName, escPool string
			var delayMS uint32
			var errorEncountered bool
			if err := rows.Scan(
				&lineNumber, &fileNumber, &e.Timestamp,
				&e.TraceID, &e.RPCID, &e.Queue,
				&e.Identifier,
				&e.Form, &e.User,
				&durationMS, &queueTimeMS, &e.Success,
				&threadID, &rawText,
				&escName, &escPool, &delayMS, &errorEncountered,
			); err != nil {
				return nil, fmt.Errorf("clickhouse: topN scan (%s): %w", logType, err)
			}
			details["esc_name"] = escName
			details["esc_pool"] = escPool
			details["delay_ms"] = delayMS
			details["error_encountered"] = errorEncountered

		default:
			if err := rows.Scan(
				&lineNumber, &fileNumber, &e.Timestamp,
				&e.TraceID, &e.RPCID, &e.Queue,
				&e.Identifier,
				&e.Form, &e.User,
				&durationMS, &queueTimeMS, &e.Success,
				&threadID, &rawText,
			); err != nil {
				return nil, fmt.Errorf("clickhouse: topN scan (%s): %w", logType, err)
			}
		}

		details["thread_id"] = threadID
		details["raw_text"] = rawText

		if detailsJSON, err := json.Marshal(details); err == nil {
			e.Details = string(detailsJSON)
		}

		e.Rank = rank
		e.LineNumber = int(lineNumber)
		e.FileNumber = int(fileNumber)
		e.DurationMS = int(durationMS)
		e.QueueTimeMS = int(queueTimeMS)
		rank++
		results = append(results, e)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: topN rows (%s): %w", logType, err)
	}

	return results, nil
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
		return nil, fmt.Errorf("clickhouse: time series query: %w", err)
	}
	defer rows.Close()

	var results []domain.TimeSeriesPoint
	for rows.Next() {
		var (
			p          domain.TimeSeriesPoint
			apiCount   uint64
			sqlCount   uint64
			filterCnt  uint64
			escCount   uint64
			errorCount uint64
		)
		if err := rows.Scan(
			&p.Timestamp,
			&apiCount, &sqlCount, &filterCnt, &escCount,
			&p.AvgDurationMS,
			&errorCount,
		); err != nil {
			return nil, fmt.Errorf("clickhouse: time series scan: %w", err)
		}
		p.APICount = int(apiCount)
		p.SQLCount = int(sqlCount)
		p.FilterCount = int(filterCnt)
		p.EscCount = int(escCount)
		p.ErrorCount = int(errorCount)
		results = append(results, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: time series rows: %w", err)
	}

	return results, nil
}

func (c *ClickHouseClient) queryDistribution(ctx context.Context, tenantID, jobID string, dash *domain.DashboardData) error {
	// Distribution by log type.
	typeRows, err := c.conn.Query(ctx, `
		SELECT toString(log_type) AS lt, count() AS cnt
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID
		GROUP BY lt
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	)
	if err != nil {
		return fmt.Errorf("clickhouse: distribution by type query: %w", err)
	}
	defer typeRows.Close()

	byType := make(map[string]int)
	for typeRows.Next() {
		var lt string
		var cnt uint64
		if err := typeRows.Scan(&lt, &cnt); err != nil {
			return fmt.Errorf("clickhouse: distribution by type scan: %w", err)
		}
		byType[lt] = int(cnt)
	}
	if err := typeRows.Err(); err != nil {
		return fmt.Errorf("clickhouse: distribution by type rows: %w", err)
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
		return fmt.Errorf("clickhouse: distribution by queue query: %w", err)
	}
	defer queueRows.Close()

	byQueue := make(map[string]int)
	for queueRows.Next() {
		var q string
		var cnt uint64
		if err := queueRows.Scan(&q, &cnt); err != nil {
			return fmt.Errorf("clickhouse: distribution by queue scan: %w", err)
		}
		byQueue[q] = int(cnt)
	}
	if err := queueRows.Err(); err != nil {
		return fmt.Errorf("clickhouse: distribution by queue rows: %w", err)
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
	var logType string
	var scheduledTime time.Time
	if err := row.Scan(
		&e.TenantID, &e.JobID, &e.EntryID, &e.LineNumber, &e.FileNumber,
		&e.Timestamp, &e.IngestedAt, &logType,
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
	e.LogType = domain.LogType(logType)

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
	maxPageSize := 500
	if q.ExportMode {
		maxPageSize = 50000
	}
	if q.PageSize > maxPageSize {
		q.PageSize = maxPageSize
	}
	if q.Page < 1 {
		q.Page = 1
	}

	// Determine sort column and direction.
	sortCol := "timestamp"
	switch q.SortBy {
	case "duration_ms", "line_number", "timestamp", "user", "log_type":
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

	if q.Query != "" && q.Query != "*" {
		parsed, parseErr := search.ParseKQL(q.Query)
		if parseErr == nil && parsed != nil {
			kqlSQL, kqlParams := parsed.ToClickHouseWhere()
			// Convert positional ? params to named @kql_N params for
			// compatibility with the rest of the named-arg query.
			paramIdx := 0
			var converted strings.Builder
			for _, ch := range kqlSQL {
				if ch == '?' && paramIdx < len(kqlParams) {
					paramName := fmt.Sprintf("kql_%d", paramIdx)
					converted.WriteString("@" + paramName)
					namedArgs = append(namedArgs, driver.NamedValue{Name: paramName, Value: kqlParams[paramIdx]})
					paramIdx++
				} else {
					converted.WriteRune(ch)
				}
			}
			where += " AND (" + converted.String() + ")"
		} else {
			// Fallback to ILIKE for unparseable queries
			escaped := escapeLikePattern(q.Query)
			where += " AND (raw_text ILIKE @query OR error_message ILIKE @query)"
			namedArgs = append(namedArgs, driver.NamedValue{Name: "query", Value: "%" + escaped + "%"})
		}
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

	if len(q.Users) > 0 {
		where += " AND user IN (@users)"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "users", Value: q.Users})
	} else if q.UserFilter != "" {
		where += " AND user = @userFilter"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "userFilter", Value: q.UserFilter})
	}

	if len(q.Queues) > 0 {
		where += " AND queue IN (@queues)"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "queues", Value: q.Queues})
	} else if q.QueueFilter != "" {
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
	var totalCount uint64
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
		var logType string
		var scheduledTime time.Time
		if err := rows.Scan(
			&e.TenantID, &e.JobID, &e.EntryID, &e.LineNumber, &e.FileNumber,
			&e.Timestamp, &e.IngestedAt, &logType,
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
		e.LogType = domain.LogType(logType)
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
		TotalCount: int64(totalCount),
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
		var logType string
		var scheduledTime time.Time
		if err := rows.Scan(
			&e.TenantID, &e.JobID, &e.EntryID, &e.LineNumber, &e.FileNumber,
			&e.Timestamp, &e.IngestedAt, &logType,
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
		e.LogType = domain.LogType(logType)
		if !scheduledTime.IsZero() {
			e.ScheduledTime = &scheduledTime
		}
		entries = append(entries, e)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: trace rows: %w", err)
	}

	return entries, nil
}

// GetAggregates returns performance aggregates grouped by form (API), user (API), and table (SQL).
func (c *ClickHouseClient) GetAggregates(ctx context.Context, tenantID, jobID string) (*domain.AggregatesResponse, error) {
	resp := &domain.AggregatesResponse{}

	// API by form
	apiByForm, err := c.queryAggregateGroups(ctx, tenantID, jobID, "API", "form")
	if err != nil {
		return nil, fmt.Errorf("clickhouse: aggregates api by form: %w", err)
	}
	if len(apiByForm.Groups) > 0 {
		resp.API = apiByForm
	}

	// SQL by table
	sqlByTable, err := c.queryAggregateGroups(ctx, tenantID, jobID, "SQL", "sql_table")
	if err != nil {
		return nil, fmt.Errorf("clickhouse: aggregates sql by table: %w", err)
	}
	if len(sqlByTable.Groups) > 0 {
		resp.SQL = sqlByTable
	}

	// Filter by name
	filterByName, err := c.queryAggregateGroups(ctx, tenantID, jobID, "FLTR", "filter_name")
	if err != nil {
		return nil, fmt.Errorf("clickhouse: aggregates filter by name: %w", err)
	}
	if len(filterByName.Groups) > 0 {
		resp.Filter = filterByName
	}

	return resp, nil
}

func (c *ClickHouseClient) queryAggregateGroups(ctx context.Context, tenantID, jobID, logType, groupCol string) (*domain.AggregateSection, error) {
	var groupExpr, filterExpr string
	switch groupCol {
	case "form":
		groupExpr, filterExpr = "form", "form != ''"
	case "sql_table":
		groupExpr, filterExpr = "sql_table", "sql_table != ''"
	case "filter_name":
		groupExpr, filterExpr = "filter_name", "filter_name != ''"
	case "user":
		groupExpr, filterExpr = "user", "user != ''"
	default:
		return nil, fmt.Errorf("clickhouse: invalid aggregate group column: %s", groupCol)
	}

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
	`, groupExpr, filterExpr)

	rows, err := c.conn.Query(ctx, query,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
		clickhouse.Named("logType", logType),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: aggregates query (%s/%s): %w", logType, groupCol, err)
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
			return nil, fmt.Errorf("clickhouse: aggregates scan (%s/%s): %w", logType, groupCol, err)
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
		return nil, fmt.Errorf("clickhouse: aggregates rows (%s/%s): %w", logType, groupCol, err)
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
		var logType string
		var sampleLine uint32
		if err := rows.Scan(
			&e.ErrorCode, &e.Message, &e.Count,
			&e.FirstSeen, &e.LastSeen,
			&logType, &e.Queue, &e.Form, &e.User,
			&sampleLine, &e.SampleTrace,
		); err != nil {
			return nil, fmt.Errorf("clickhouse: exceptions scan: %w", err)
		}
		e.LogType = domain.LogType(logType)
		e.SampleLine = int(sampleLine)
		resp.Exceptions = append(resp.Exceptions, e)
		resp.TotalCount += e.Count
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: exceptions rows: %w", err)
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
			return nil, fmt.Errorf("clickhouse: error rates scan: %w", err)
		}
		if total > 0 {
			resp.ErrorRates[lt] = float64(errors) / float64(total)
		}
	}

	if err := rateRows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: error rates rows: %w", err)
	}

	return resp, nil
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
			return nil, fmt.Errorf("clickhouse: line gaps scan: %w", err)
		}
		g.BeforeLine = int(beforeLine)
		g.AfterLine = int(afterLine)
		resp.Gaps = append(resp.Gaps, g)
	}
	if err := lineRows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: line gaps rows: %w", err)
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
			return nil, fmt.Errorf("clickhouse: queue health scan: %w", err)
		}
		resp.QueueHealth = append(resp.QueueHealth, q)
	}

	if err := qRows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: queue health rows: %w", err)
	}

	return resp, nil
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
			return nil, fmt.Errorf("clickhouse: thread stats scan: %w", err)
		}
		resp.Threads = append(resp.Threads, t)
		resp.TotalThreads++
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: thread stats rows: %w", err)
	}

	return resp, nil
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
			return nil, fmt.Errorf("clickhouse: most executed filters scan: %w", err)
		}
		resp.MostExecuted = append(resp.MostExecuted, f)
	}
	if err := meRows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: most executed filters rows: %w", err)
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
			return nil, fmt.Errorf("clickhouse: filter per transaction scan: %w", err)
		}
		resp.PerTransaction = append(resp.PerTransaction, f)
	}
	if err := ptRows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: filter per transaction rows: %w", err)
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
		return nil, fmt.Errorf("clickhouse: filter total time: %w", err)
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
		return nil, fmt.Errorf("clickhouse: health score busy pct: %w", err)
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
		return nil, fmt.Errorf("clickhouse: health score gaps: %w", err)
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

func computeBucketSize(rangeStart, rangeEnd time.Time) string {
	duration := rangeEnd.Sub(rangeStart)
	switch {
	case duration <= 30*time.Second:
		return "1 SECOND"
	case duration <= 2*time.Minute:
		return "5 SECOND"
	case duration <= 5*time.Minute:
		return "10 SECOND"
	case duration <= 15*time.Minute:
		return "30 SECOND"
	case duration <= time.Hour:
		return "1 MINUTE"
	case duration <= 6*time.Hour:
		return "5 MINUTE"
	case duration <= 24*time.Hour:
		return "15 MINUTE"
	case duration <= 7*24*time.Hour:
		return "1 HOUR"
	default:
		return "6 HOUR"
	}
}

func (c *ClickHouseClient) GetHistogramData(ctx context.Context, tenantID, jobID string, timeFrom, timeTo time.Time) (*domain.HistogramResponse, error) {
	bucketSize := computeBucketSize(timeFrom, timeTo)

	// INTERVAL cannot be passed as a named parameter; interpolate directly.
	// bucketSize is computed internally (not user input), so this is safe.
	// Time values are formatted as strings to avoid DateTime64(3) parse issues.
	query := fmt.Sprintf(`
		SELECT
			toStartOfInterval(timestamp, INTERVAL %s) AS bucket,
			toString(log_type) AS lt,
			count() AS cnt
		FROM log_entries
		WHERE tenant_id = {tenant_id:String}
		  AND job_id = {job_id:String}
		  AND timestamp >= toDateTime64({time_from:String}, 3)
		  AND timestamp <= toDateTime64({time_to:String}, 3)
		GROUP BY bucket, lt
		ORDER BY bucket ASC
	`, bucketSize)

	rows, err := c.conn.Query(ctx, query,
		clickhouse.Named("tenant_id", tenantID),
		clickhouse.Named("job_id", jobID),
		clickhouse.Named("time_from", timeFrom.UTC().Format("2006-01-02 15:04:05.000")),
		clickhouse.Named("time_to", timeTo.UTC().Format("2006-01-02 15:04:05.000")),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: histogram query: %w", err)
	}
	defer rows.Close()

	bucketMap := make(map[time.Time]*domain.HistogramBucket)
	for rows.Next() {
		var bucket time.Time
		var logType string
		var cnt uint64
		if err := rows.Scan(&bucket, &logType, &cnt); err != nil {
			return nil, fmt.Errorf("clickhouse: histogram scan: %w", err)
		}

		if _, ok := bucketMap[bucket]; !ok {
			bucketMap[bucket] = &domain.HistogramBucket{Timestamp: bucket}
		}

		c := int64(cnt)
		switch logType {
		case "API":
			bucketMap[bucket].Counts.API += c
		case "SQL":
			bucketMap[bucket].Counts.SQL += c
		case "FLTR":
			bucketMap[bucket].Counts.FLTR += c
		case "ESCL":
			bucketMap[bucket].Counts.ESCL += c
		}
		bucketMap[bucket].Counts.Total += c
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: histogram rows: %w", err)
	}

	buckets := make([]domain.HistogramBucket, 0, len(bucketMap))
	for _, b := range bucketMap {
		buckets = append(buckets, *b)
	}

	sort.Slice(buckets, func(i, j int) bool {
		return buckets[i].Timestamp.Before(buckets[j].Timestamp)
	})

	return &domain.HistogramResponse{
		Buckets:    buckets,
		BucketSize: bucketSize,
	}, nil
}

func (c *ClickHouseClient) GetEntryContext(ctx context.Context, tenantID, jobID, entryID string, window int) (*domain.ContextResponse, error) {
	if window <= 0 {
		window = 10
	}
	if window > 50 {
		window = 50
	}

	row := c.conn.QueryRow(ctx, `
		SELECT line_number FROM log_entries
		WHERE tenant_id = {tenant_id:String} AND job_id = {job_id:String} AND entry_id = {entry_id:String}
		LIMIT 1
	`,
		clickhouse.Named("tenant_id", tenantID),
		clickhouse.Named("job_id", jobID),
		clickhouse.Named("entry_id", entryID),
	)

	var targetLineNumber uint32
	if err := row.Scan(&targetLineNumber); err != nil {
		return nil, fmt.Errorf("clickhouse: get entry context target: %w", err)
	}

	startLine := int(targetLineNumber) - window
	if startLine < 1 {
		startLine = 1
	}
	endLine := int(targetLineNumber) + window

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
		WHERE tenant_id = {tenant_id:String}
		  AND job_id = {job_id:String}
		  AND line_number BETWEEN {start_line:Int32} AND {end_line:Int32}
		ORDER BY line_number ASC
	`,
		clickhouse.Named("tenant_id", tenantID),
		clickhouse.Named("job_id", jobID),
		clickhouse.Named("start_line", startLine),
		clickhouse.Named("end_line", endLine),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: get entry context query: %w", err)
	}
	defer rows.Close()

	var target *domain.LogEntry
	var before, after []domain.LogEntry

	for rows.Next() {
		var e domain.LogEntry
		var logType string
		var scheduledTime time.Time
		if err := rows.Scan(
			&e.TenantID, &e.JobID, &e.EntryID, &e.LineNumber, &e.FileNumber,
			&e.Timestamp, &e.IngestedAt, &logType,
			&e.TraceID, &e.RPCID, &e.ThreadID,
			&e.Queue, &e.User,
			&e.DurationMS, &e.QueueTimeMS, &e.Success,
			&e.APICode, &e.Form,
			&e.SQLTable, &e.SQLStatement,
			&e.FilterName, &e.FilterLevel, &e.Operation, &e.RequestID,
			&e.EscName, &e.EscPool, &scheduledTime, &e.DelayMS, &e.ErrorEncountered,
			&e.RawText, &e.ErrorMessage,
		); err != nil {
			return nil, fmt.Errorf("clickhouse: get entry context scan: %w", err)
		}
		e.LogType = domain.LogType(logType)
		if !scheduledTime.IsZero() {
			e.ScheduledTime = &scheduledTime
		}

		if e.EntryID == entryID {
			target = &e
		} else if e.LineNumber < targetLineNumber {
			before = append(before, e)
		} else {
			after = append(after, e)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: get entry context rows: %w", err)
	}

	if target == nil {
		return nil, fmt.Errorf("clickhouse: entry not found: %s", entryID)
	}

	return &domain.ContextResponse{
		Target:     *target,
		Before:     before,
		After:      after,
		WindowSize: window,
	}, nil
}

// GetFacets returns facet counts for log_type, user, and queue columns,
// applying the same KQL-based WHERE clause as SearchEntries so facets reflect
// the current search context.
func (c *ClickHouseClient) GetFacets(ctx context.Context, tenantID, jobID string, q SearchQuery) (map[string][]FacetValue, error) {
	where := "tenant_id = @tenantID AND job_id = @jobID"
	namedArgs := []driver.NamedValue{
		{Name: "tenantID", Value: tenantID},
		{Name: "jobID", Value: jobID},
	}

	if q.Query != "" && q.Query != "*" {
		parsed, parseErr := search.ParseKQL(q.Query)
		if parseErr == nil && parsed != nil {
			kqlSQL, kqlParams := parsed.ToClickHouseWhere()
			paramIdx := 0
			var converted strings.Builder
			for _, ch := range kqlSQL {
				if ch == '?' && paramIdx < len(kqlParams) {
					paramName := fmt.Sprintf("kql_%d", paramIdx)
					converted.WriteString("@" + paramName)
					namedArgs = append(namedArgs, driver.NamedValue{Name: paramName, Value: kqlParams[paramIdx]})
					paramIdx++
				} else {
					converted.WriteRune(ch)
				}
			}
			where += " AND (" + converted.String() + ")"
		}
	}

	if q.TimeFrom != nil {
		where += " AND timestamp >= @timeFrom"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "timeFrom", Value: *q.TimeFrom})
	}
	if q.TimeTo != nil {
		where += " AND timestamp <= @timeTo"
		namedArgs = append(namedArgs, driver.NamedValue{Name: "timeTo", Value: *q.TimeTo})
	}

	chArgs := make([]any, len(namedArgs))
	for i, na := range namedArgs {
		chArgs[i] = clickhouse.Named(na.Name, na.Value)
	}

	facetFields := []string{"log_type", "user", "queue"}
	// Enum/Bool columns cannot be compared with != '' — skip the empty filter for them.
	enumFields := map[string]bool{"log_type": true, "success": true}
	result := make(map[string][]FacetValue)

	for _, field := range facetFields {
		emptyFilter := fmt.Sprintf("AND %s != ''", field)
		if enumFields[field] {
			emptyFilter = "" // Enum columns are never empty
		}
		query := fmt.Sprintf(`
			SELECT toString(%s) AS value, count() AS cnt
			FROM log_entries
			WHERE %s %s
			GROUP BY value
			ORDER BY cnt DESC
			LIMIT 10
		`, field, where, emptyFilter)

		rows, err := c.conn.Query(ctx, query, chArgs...)
		if err != nil {
			slog.Warn("facet query failed", "field", field, "error", err, "query", query)
			continue // non-fatal: skip this facet
		}

		var values []FacetValue
		for rows.Next() {
			var val string
			var cnt uint64
			if err := rows.Scan(&val, &cnt); err != nil {
				slog.Warn("facet scan failed", "field", field, "error", err)
				break
			}
			values = append(values, FacetValue{Value: val, Count: int64(cnt)})
		}
		rows.Close()

		if len(values) > 0 {
			result[field] = values
		}
	}

	return result, nil
}

var knownFields = map[string]bool{
	"log_type":          true,
	"user":              true,
	"queue":             true,
	"thread_id":         true,
	"trace_id":          true,
	"rpc_id":            true,
	"api_code":          true,
	"form":              true,
	"operation":         true,
	"request_id":        true,
	"sql_table":         true,
	"filter_name":       true,
	"esc_name":          true,
	"esc_pool":          true,
	"duration_ms":       true,
	"success":           true,
	"error_encountered": true,
}

func IsKnownField(field string) bool {
	return knownFields[field]
}

func (c *ClickHouseClient) GetAutocompleteValues(ctx context.Context, tenantID, jobID, field, prefix string, limit int) ([]domain.AutocompleteValue, error) {
	if !IsKnownField(field) {
		return nil, fmt.Errorf("clickhouse: unknown field for autocomplete: %s", field)
	}

	if limit <= 0 || limit > 50 {
		limit = 10
	}

	pattern := escapeLikePattern(prefix) + "%"

	// Enum/Bool columns need toString() for LIKE and cannot use != ''
	enumOrBoolFields := map[string]bool{"log_type": true, "success": true}

	// field is already validated against knownFields whitelist, safe to interpolate as identifier
	var query string
	if enumOrBoolFields[field] {
		query = fmt.Sprintf(`
			SELECT toString(%s) AS value, count() AS cnt
			FROM log_entries
			WHERE tenant_id = {tenant_id:String}
			  AND job_id = {job_id:String}
			  AND toString(%s) LIKE {pattern:String}
			GROUP BY value
			ORDER BY cnt DESC
			LIMIT {limit:Int32}
		`, field, field)
	} else {
		query = fmt.Sprintf(`
			SELECT %s AS value, count() AS cnt
			FROM log_entries
			WHERE tenant_id = {tenant_id:String}
			  AND job_id = {job_id:String}
			  AND %s LIKE {pattern:String}
			  AND %s != ''
			GROUP BY value
			ORDER BY cnt DESC
			LIMIT {limit:Int32}
		`, field, field, field)
	}

	rows, err := c.conn.Query(ctx, query,
		clickhouse.Named("tenant_id", tenantID),
		clickhouse.Named("job_id", jobID),
		clickhouse.Named("pattern", pattern),
		clickhouse.Named("limit", limit),
	)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: autocomplete query: %w", err)
	}
	defer rows.Close()

	var values []domain.AutocompleteValue
	for rows.Next() {
		var val string
		var cnt uint64
		if err := rows.Scan(&val, &cnt); err != nil {
			return nil, fmt.Errorf("clickhouse: autocomplete scan: %w", err)
		}
		values = append(values, domain.AutocompleteValue{Value: val, Count: int64(cnt)})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: autocomplete rows: %w", err)
	}

	return values, nil
}

// GetJobTimeRange returns the min and max timestamps for a job's log entries.
func (c *ClickHouseClient) GetJobTimeRange(ctx context.Context, tenantID, jobID string) (*JobTimeRange, error) {
	var minTS, maxTS time.Time
	err := c.conn.QueryRow(ctx, `
		SELECT min(timestamp), max(timestamp)
		FROM log_entries
		WHERE tenant_id = @tenantID AND job_id = @jobID
	`,
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	).Scan(&minTS, &maxTS)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: get job time range: %w", err)
	}

	if minTS.IsZero() && maxTS.IsZero() {
		return nil, fmt.Errorf("clickhouse: no entries found for job %s", jobID)
	}

	return &JobTimeRange{Start: minTS, End: maxTS}, nil
}

func (c *ClickHouseClient) SearchTransactions(ctx context.Context, tenantID, jobID string, params domain.TransactionSearchParams) (*domain.TransactionSearchResponse, error) {
	start := time.Now()

	if params.Limit <= 0 {
		params.Limit = 50
	}
	if params.Limit > 100 {
		params.Limit = 100
	}

	where := "tenant_id = @tenantID AND job_id = @jobID AND (trace_id != '' OR rpc_id != '')"
	namedArgs := []any{
		clickhouse.Named("tenantID", tenantID),
		clickhouse.Named("jobID", jobID),
	}

	if params.User != "" {
		where += " AND user = @user"
		namedArgs = append(namedArgs, clickhouse.Named("user", params.User))
	}
	if params.ThreadID != "" {
		where += " AND thread_id = @threadID"
		namedArgs = append(namedArgs, clickhouse.Named("threadID", params.ThreadID))
	}
	if params.TraceID != "" {
		where += " AND trace_id = @traceID"
		namedArgs = append(namedArgs, clickhouse.Named("traceID", params.TraceID))
	}
	if params.RPCID != "" {
		where += " AND rpc_id = @rpcID"
		namedArgs = append(namedArgs, clickhouse.Named("rpcID", params.RPCID))
	}
	if params.HasErrors != nil {
		if *params.HasErrors {
			where += " AND success = false"
		} else {
			where += " AND success = true"
		}
	}
	// MinDuration is applied as HAVING clause after GROUP BY to filter on total transaction duration
	var havingClause string
	if params.MinDuration > 0 {
		havingClause = "HAVING dateDiff('millisecond', min(timestamp), max(timestamp)) >= @minDuration"
		namedArgs = append(namedArgs, clickhouse.Named("minDuration", params.MinDuration))
	}

	var countQuery string
	if havingClause != "" {
		countQuery = fmt.Sprintf(`
			SELECT count() FROM (
				SELECT if(trace_id != '', trace_id, rpc_id) AS corr_id
				FROM log_entries
				WHERE %s
				GROUP BY corr_id
				%s
			)
		`, where, havingClause)
	} else {
		countQuery = fmt.Sprintf(`
			SELECT uniqExact(if(trace_id != '', trace_id, rpc_id))
			FROM log_entries
			WHERE %s
		`, where)
	}

	var total uint64
	if err := c.conn.QueryRow(ctx, countQuery, namedArgs...).Scan(&total); err != nil {
		return nil, fmt.Errorf("clickhouse: search transactions count: %w", err)
	}

	dataQuery := fmt.Sprintf(`
		SELECT
			if(trace_id != '', trace_id, rpc_id) AS corr_id,
			if(trace_id != '', 'trace_id', 'rpc_id') AS corr_type,
			any(user) AS primary_user,
			any(form) AS primary_form,
			any(operation) AS primary_operation,
			any(queue) AS primary_queue,
			dateDiff('millisecond', min(timestamp), max(timestamp)) AS total_duration_ms,
			count() AS span_count,
			countIf(success = false) AS error_count,
			min(timestamp) AS first_timestamp,
			max(timestamp) AS last_timestamp
		FROM log_entries
		WHERE %s
		GROUP BY corr_id, corr_type
		%s
		ORDER BY first_timestamp DESC
		LIMIT %d OFFSET %d
	`, where, havingClause, params.Limit, params.Offset)

	rows, err := c.conn.Query(ctx, dataQuery, namedArgs...)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: search transactions query: %w", err)
	}
	defer rows.Close()

	transactions := make([]domain.TransactionSummary, 0)
	for rows.Next() {
		var ts domain.TransactionSummary
		var firstTS, lastTS time.Time
		var spanCount, errorCount uint64
		if err := rows.Scan(
			&ts.TraceID,
			&ts.CorrelationType,
			&ts.PrimaryUser,
			&ts.PrimaryForm,
			&ts.PrimaryOperation,
			&ts.PrimaryQueue,
			&ts.TotalDurationMS,
			&spanCount,
			&errorCount,
			&firstTS,
			&lastTS,
		); err != nil {
			return nil, fmt.Errorf("clickhouse: search transactions scan: %w", err)
		}
		ts.SpanCount = int(spanCount)
		ts.ErrorCount = int(errorCount)
		ts.FirstTimestamp = firstTS.Format(time.RFC3339)
		ts.LastTimestamp = lastTS.Format(time.RFC3339)
		transactions = append(transactions, ts)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("clickhouse: search transactions rows: %w", err)
	}

	return &domain.TransactionSearchResponse{
		Transactions: transactions,
		Total:        int(total),
		TookMS:       int(time.Since(start).Milliseconds()),
	}, nil
}
