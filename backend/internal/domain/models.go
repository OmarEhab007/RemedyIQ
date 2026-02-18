package domain

import (
	"time"

	"github.com/google/uuid"
)

// LogType represents the type of AR Server log entry.
type LogType string

const (
	LogTypeAPI        LogType = "API"
	LogTypeSQL        LogType = "SQL"
	LogTypeFilter     LogType = "FLTR"
	LogTypeEscalation LogType = "ESCL"
)

// JobStatus represents the lifecycle state of an analysis job.
type JobStatus string

const (
	JobStatusQueued    JobStatus = "queued"
	JobStatusParsing   JobStatus = "parsing"
	JobStatusAnalyzing JobStatus = "analyzing"
	JobStatusStoring   JobStatus = "storing"
	JobStatusComplete  JobStatus = "complete"
	JobStatusFailed    JobStatus = "failed"
)

// Tenant represents an organization using the platform.
type Tenant struct {
	ID             uuid.UUID `json:"id" db:"id"`
	ClerkOrgID     string    `json:"clerk_org_id" db:"clerk_org_id"`
	Name           string    `json:"name" db:"name"`
	Plan           string    `json:"plan" db:"plan"`
	StorageLimitGB int       `json:"storage_limit_gb" db:"storage_limit_gb"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// LogFile represents an uploaded log file.
type LogFile struct {
	ID             uuid.UUID `json:"id" db:"id"`
	TenantID       uuid.UUID `json:"tenant_id" db:"tenant_id"`
	Filename       string    `json:"filename" db:"filename"`
	SizeBytes      int64     `json:"size_bytes" db:"size_bytes"`
	S3Key          string    `json:"s3_key" db:"s3_key"`
	S3Bucket       string    `json:"s3_bucket" db:"s3_bucket"`
	ContentType    string    `json:"content_type" db:"content_type"`
	DetectedTypes  []string  `json:"detected_types" db:"detected_types"`
	ChecksumSHA256 string    `json:"checksum_sha256,omitempty" db:"checksum_sha256"`
	UploadedAt     time.Time `json:"uploaded_at" db:"uploaded_at"`
}

// AnalysisJob represents a log analysis run.
type AnalysisJob struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	TenantID       uuid.UUID  `json:"tenant_id" db:"tenant_id"`
	Status         JobStatus  `json:"status" db:"status"`
	FileID         uuid.UUID  `json:"file_id" db:"file_id"`
	JARFlags       JARFlags   `json:"jar_flags" db:"jar_flags"`
	JVMHeapMB      int        `json:"jvm_heap_mb" db:"jvm_heap_mb"`
	TimeoutSeconds int        `json:"timeout_seconds" db:"timeout_seconds"`
	ProgressPct    int        `json:"progress_pct" db:"progress_pct"`
	TotalLines     *int64     `json:"total_lines,omitempty" db:"total_lines"`
	ProcessedLines *int64     `json:"processed_lines,omitempty" db:"processed_lines"`
	APICount       *int64     `json:"api_count,omitempty" db:"api_count"`
	SQLCount       *int64     `json:"sql_count,omitempty" db:"sql_count"`
	FilterCount    *int64     `json:"filter_count,omitempty" db:"filter_count"`
	EscCount       *int64     `json:"esc_count,omitempty" db:"esc_count"`
	StartTime      *time.Time `json:"start_time,omitempty" db:"start_time"`
	EndTime        *time.Time `json:"end_time,omitempty" db:"end_time"`
	LogStart       *time.Time `json:"log_start,omitempty" db:"log_start"`
	LogEnd         *time.Time `json:"log_end,omitempty" db:"log_end"`
	LogDuration    *string    `json:"log_duration,omitempty" db:"log_duration"`
	ErrorMessage   *string    `json:"error_message,omitempty" db:"error_message"`
	JARStderr      *string    `json:"jar_stderr,omitempty" db:"jar_stderr"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
	CompletedAt    *time.Time `json:"completed_at,omitempty" db:"completed_at"`
}

// JARFlags holds the configuration flags for ARLogAnalyzer.jar.
type JARFlags struct {
	TopN         int      `json:"top_n,omitempty"`
	GroupBy      []string `json:"group_by,omitempty"`
	SortBy       string   `json:"sort_by,omitempty"`
	UserFilter   string   `json:"user_filter,omitempty"`
	ExcludeUsers []string `json:"exclude_users,omitempty"`
	BeginTime    string   `json:"begin_time,omitempty"`
	EndTime      string   `json:"end_time,omitempty"`
	Locale       string   `json:"locale,omitempty"`
	DateFormat   string   `json:"date_format,omitempty"`
	SkipAPI      bool     `json:"skip_api,omitempty"`
	SkipSQL      bool     `json:"skip_sql,omitempty"`
	SkipEsc      bool     `json:"skip_esc,omitempty"`
	SkipFltr     bool     `json:"skip_fltr,omitempty"`
	IncludeFTS   bool     `json:"include_fts,omitempty"`
}

// LogEntry represents a single parsed log entry stored in ClickHouse.
type LogEntry struct {
	TenantID   string    `json:"tenant_id" ch:"tenant_id"`
	JobID      string    `json:"job_id" ch:"job_id"`
	EntryID    string    `json:"entry_id" ch:"entry_id"`
	LineNumber uint32    `json:"line_number" ch:"line_number"`
	FileNumber uint16    `json:"file_number" ch:"file_number"`
	Timestamp  time.Time `json:"timestamp" ch:"timestamp"`
	IngestedAt time.Time `json:"ingested_at" ch:"ingested_at"`
	LogType    LogType   `json:"log_type" ch:"log_type"`

	// Correlation
	TraceID  string `json:"trace_id" ch:"trace_id"`
	RPCID    string `json:"rpc_id" ch:"rpc_id"`
	ThreadID string `json:"thread_id" ch:"thread_id"`

	// Context
	Queue string `json:"queue" ch:"queue"`
	User  string `json:"user" ch:"user"`

	// Performance
	DurationMS  uint32 `json:"duration_ms" ch:"duration_ms"`
	QueueTimeMS uint32 `json:"queue_time_ms" ch:"queue_time_ms"`
	Success     bool   `json:"success" ch:"success"`

	// API-specific
	APICode string `json:"api_code,omitempty" ch:"api_code"`
	Form    string `json:"form,omitempty" ch:"form"`

	// SQL-specific
	SQLTable     string `json:"sql_table,omitempty" ch:"sql_table"`
	SQLStatement string `json:"sql_statement,omitempty" ch:"sql_statement"`

	// Filter-specific
	FilterName  string `json:"filter_name,omitempty" ch:"filter_name"`
	FilterLevel uint8  `json:"filter_level,omitempty" ch:"filter_level"`
	Operation   string `json:"operation,omitempty" ch:"operation"`
	RequestID   string `json:"request_id,omitempty" ch:"request_id"`

	// Escalation-specific
	EscName          string     `json:"esc_name,omitempty" ch:"esc_name"`
	EscPool          string     `json:"esc_pool,omitempty" ch:"esc_pool"`
	ScheduledTime    *time.Time `json:"scheduled_time,omitempty" ch:"scheduled_time"`
	DelayMS          uint32     `json:"delay_ms,omitempty" ch:"delay_ms"`
	ErrorEncountered bool       `json:"error_encountered,omitempty" ch:"error_encountered"`

	// Raw
	RawText      string `json:"raw_text,omitempty" ch:"raw_text"`
	ErrorMessage string `json:"error_message,omitempty" ch:"error_message"`
}

// AIInteraction represents a user's interaction with an AI skill.
type AIInteraction struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	TenantID        uuid.UUID  `json:"tenant_id" db:"tenant_id"`
	JobID           *uuid.UUID `json:"job_id,omitempty" db:"job_id"`
	UserID          string     `json:"user_id" db:"user_id"`
	SkillName       string     `json:"skill_name" db:"skill_name"`
	InputText       string     `json:"input_text" db:"input_text"`
	OutputText      *string    `json:"output_text,omitempty" db:"output_text"`
	ReferencedLines []byte     `json:"referenced_lines,omitempty" db:"referenced_lines"`
	TokensUsed      *int       `json:"tokens_used,omitempty" db:"tokens_used"`
	LatencyMS       *int       `json:"latency_ms,omitempty" db:"latency_ms"`
	Status          string     `json:"status" db:"status"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
}

// SavedSearch represents a saved KQL search query.
type SavedSearch struct {
	ID        uuid.UUID `json:"id" db:"id"`
	TenantID  uuid.UUID `json:"tenant_id" db:"tenant_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Name      string    `json:"name" db:"name"`
	KQLQuery  string    `json:"kql_query" db:"kql_query"`
	Filters   []byte    `json:"filters" db:"filters"`
	IsPinned  bool      `json:"is_pinned" db:"is_pinned"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// MessageRole represents the sender of a message in a conversation.
type MessageRole string

const (
	MessageRoleUser      MessageRole = "user"
	MessageRoleAssistant MessageRole = "assistant"
)

// MessageStatus represents the state of a message.
type MessageStatus string

const (
	MessageStatusPending   MessageStatus = "pending"
	MessageStatusStreaming MessageStatus = "streaming"
	MessageStatusComplete  MessageStatus = "complete"
	MessageStatusError     MessageStatus = "error"
)

// Conversation represents a chat session scoped to a tenant, user, and analysis job.
type Conversation struct {
	ID            uuid.UUID              `json:"id" db:"id"`
	TenantID      uuid.UUID              `json:"tenant_id" db:"tenant_id"`
	UserID        string                 `json:"user_id" db:"user_id"`
	JobID         uuid.UUID              `json:"job_id" db:"job_id"`
	Title         string                 `json:"title" db:"title"`
	CreatedAt     time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at" db:"updated_at"`
	MessageCount  int                    `json:"message_count" db:"message_count"`
	LastMessageAt *time.Time             `json:"last_message_at,omitempty" db:"last_message_at"`
	Metadata      map[string]interface{} `json:"metadata,omitempty" db:"metadata"`
	Messages      []Message              `json:"messages,omitempty" db:"-"`
}

// Message represents a single turn in a conversation.
type Message struct {
	ID             uuid.UUID     `json:"id" db:"id"`
	ConversationID uuid.UUID     `json:"conversation_id" db:"conversation_id"`
	TenantID       uuid.UUID     `json:"tenant_id" db:"tenant_id"`
	Role           MessageRole   `json:"role" db:"role"`
	Content        string        `json:"content" db:"content"`
	SkillName      string        `json:"skill_name,omitempty" db:"skill_name"`
	FollowUps      []string      `json:"follow_ups,omitempty" db:"follow_ups"`
	TokensUsed     int           `json:"tokens_used,omitempty" db:"tokens_used"`
	LatencyMS      int           `json:"latency_ms,omitempty" db:"latency_ms"`
	Status         MessageStatus `json:"status" db:"status"`
	ErrorMessage   string        `json:"error_message,omitempty" db:"error_message"`
	CreatedAt      time.Time     `json:"created_at" db:"created_at"`
}

// GeneralStatistics holds the top-level statistics from an analysis.
type GeneralStatistics struct {
	TotalLines   int64     `json:"total_lines"`
	APICount     int64     `json:"api_count"`
	SQLCount     int64     `json:"sql_count"`
	FilterCount  int64     `json:"filter_count"`
	EscCount     int64     `json:"esc_count"`
	UniqueUsers  int       `json:"unique_users"`
	UniqueForms  int       `json:"unique_forms"`
	UniqueTables int       `json:"unique_tables"`
	LogStart     time.Time `json:"log_start"`
	LogEnd       time.Time `json:"log_end"`
	LogDuration  string    `json:"log_duration"`
}

// TopNEntry represents a single entry in a top-N ranking.
type TopNEntry struct {
	Rank        int       `json:"rank"`
	LineNumber  int       `json:"line_number"`
	FileNumber  int       `json:"file_number"`
	Timestamp   time.Time `json:"timestamp"`
	TraceID     string    `json:"trace_id"`
	RPCID       string    `json:"rpc_id"`
	Queue       string    `json:"queue"`
	Identifier  string    `json:"identifier"`
	Form        string    `json:"form,omitempty"`
	User        string    `json:"user,omitempty"`
	DurationMS  int       `json:"duration_ms"`
	QueueTimeMS int       `json:"queue_time_ms,omitempty"`
	Success     bool      `json:"success"`
	Details     string    `json:"details,omitempty"`
}

// TimeSeriesPoint represents a single data point in a time series.
type TimeSeriesPoint struct {
	Timestamp     time.Time `json:"timestamp"`
	APICount      int       `json:"api_count"`
	SQLCount      int       `json:"sql_count"`
	FilterCount   int       `json:"filter_count"`
	EscCount      int       `json:"esc_count"`
	AvgDurationMS float64   `json:"avg_duration_ms"`
	ErrorCount    int       `json:"error_count"`
}

// DashboardData holds all data needed for the analysis dashboard.
type DashboardData struct {
	GeneralStats   GeneralStatistics         `json:"general_stats"`
	TopAPICalls    []TopNEntry               `json:"top_api_calls"`
	TopSQL         []TopNEntry               `json:"top_sql_statements"`
	TopFilters     []TopNEntry               `json:"top_filters"`
	TopEscalations []TopNEntry               `json:"top_escalations"`
	TimeSeries     []TimeSeriesPoint         `json:"time_series"`
	Distribution   map[string]map[string]int `json:"distribution"`
	HealthScore    *HealthScore              `json:"health_score,omitempty"`
}

// --- Enhanced Analysis Dashboard Types ---

// AggregateGroup represents a single aggregation group (e.g., by user, form, queue).
type AggregateGroup struct {
	Name         string  `json:"name"`
	Count        int64   `json:"count"`
	TotalMS      int64   `json:"total_ms"`
	AvgMS        float64 `json:"avg_ms"`
	MinMS        int64   `json:"min_ms"`
	MaxMS        int64   `json:"max_ms"`
	ErrorCount   int64   `json:"error_count"`
	ErrorRate    float64 `json:"error_rate"`
	UniqueTraces int     `json:"unique_traces"`
}

// AggregateSection holds groups and an optional grand total for an aggregation.
type AggregateSection struct {
	Groups     []AggregateGroup `json:"groups"`
	GrandTotal *AggregateGroup  `json:"grand_total,omitempty"`
}

// GapEntry represents a detected gap (idle period) in log activity.
type GapEntry struct {
	StartTime  time.Time `json:"start_time"`
	EndTime    time.Time `json:"end_time"`
	DurationMS int64     `json:"duration_ms"`
	BeforeLine int       `json:"before_line"`
	AfterLine  int       `json:"after_line"`
	LogType    LogType   `json:"log_type"`
	Queue      string    `json:"queue,omitempty"`
	ThreadID   string    `json:"thread_id,omitempty"`
}

// ThreadStatsEntry holds per-thread statistics from log analysis.
type ThreadStatsEntry struct {
	ThreadID    string  `json:"thread_id"`
	TotalCalls  int64   `json:"total_calls"`
	TotalMS     int64   `json:"total_ms"`
	AvgMS       float64 `json:"avg_ms"`
	MaxMS       int64   `json:"max_ms"`
	ErrorCount  int64   `json:"error_count"`
	BusyPct     float64 `json:"busy_pct"`
	ActiveStart string  `json:"active_start,omitempty"`
	ActiveEnd   string  `json:"active_end,omitempty"`
}

// ExceptionEntry represents a single exception/error occurrence from logs.
type ExceptionEntry struct {
	ErrorCode   string    `json:"error_code"`
	Message     string    `json:"message"`
	Count       int64     `json:"count"`
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
	LogType     LogType   `json:"log_type"`
	Queue       string    `json:"queue,omitempty"`
	Form        string    `json:"form,omitempty"`
	User        string    `json:"user,omitempty"`
	SampleLine  int       `json:"sample_line"`
	SampleTrace string    `json:"sample_trace,omitempty"`
}

// HealthScoreFactor is a single factor contributing to the overall health score.
type HealthScoreFactor struct {
	Name        string  `json:"name"`
	Score       int     `json:"score"`
	MaxScore    int     `json:"max_score"`
	Weight      float64 `json:"weight"`
	Description string  `json:"description"`
	Severity    string  `json:"severity"`
}

// HealthScore represents the overall health assessment of an AR Server log.
type HealthScore struct {
	Score   int                 `json:"score"`
	Status  string              `json:"status"`
	Factors []HealthScoreFactor `json:"factors"`
}

// QueueHealthSummary provides per-queue health metrics.
type QueueHealthSummary struct {
	Queue      string  `json:"queue"`
	TotalCalls int64   `json:"total_calls"`
	AvgMS      float64 `json:"avg_ms"`
	ErrorRate  float64 `json:"error_rate"`
	P95MS      int64   `json:"p95_ms"`
}

// MostExecutedFilter represents a frequently executed filter.
type MostExecutedFilter struct {
	Name    string `json:"name"`
	Count   int64  `json:"count"`
	TotalMS int64  `json:"total_ms"`
}

// FilterPerTransaction holds filter execution metrics per transaction.
type FilterPerTransaction struct {
	TransactionID  string  `json:"transaction_id"`
	FilterName     string  `json:"filter_name"`
	ExecutionCount int     `json:"execution_count"`
	TotalMS        int64   `json:"total_ms"`
	AvgMS          float64 `json:"avg_ms"`
	MaxMS          int64   `json:"max_ms"`
	Queue          string  `json:"queue,omitempty"`
	Form           string  `json:"form,omitempty"`
}

// FilterComplexityData holds aggregated filter complexity analysis data.
type FilterComplexityData struct {
	MostExecuted      []MostExecutedFilter   `json:"most_executed"`
	PerTransaction    []FilterPerTransaction `json:"per_transaction"`
	TotalFilterTimeMS int64                  `json:"total_filter_time_ms"`
}

// --- Section Response Types ---

// AggregatesResponse is the API response for the aggregates endpoint.
type AggregatesResponse struct {
	API    *AggregateSection `json:"api,omitempty"`
	SQL    *AggregateSection `json:"sql,omitempty"`
	Filter *AggregateSection `json:"filter,omitempty"`
}

// ExceptionsResponse is the API response for the exceptions endpoint.
type ExceptionsResponse struct {
	Exceptions []ExceptionEntry   `json:"exceptions"`
	TotalCount int64              `json:"total_count"`
	ErrorRates map[string]float64 `json:"error_rates"`
	TopCodes   []string           `json:"top_codes"`
}

// GapsResponse is the API response for the gaps endpoint.
type GapsResponse struct {
	Gaps        []GapEntry           `json:"gaps"`
	QueueHealth []QueueHealthSummary `json:"queue_health"`
}

// ThreadStatsResponse is the API response for the thread stats endpoint.
type ThreadStatsResponse struct {
	Threads      []ThreadStatsEntry `json:"threads"`
	TotalThreads int                `json:"total_threads"`
}

// FilterComplexityResponse is the API response for the filter complexity endpoint.
type FilterComplexityResponse struct {
	MostExecuted      []MostExecutedFilter   `json:"most_executed"`
	PerTransaction    []FilterPerTransaction `json:"per_transaction"`
	TotalFilterTimeMS int64                  `json:"total_filter_time_ms"`
}

// QueuedCallsResponse holds the queued API call data for a specific job.
type QueuedCallsResponse struct {
	JobID          string     `json:"job_id"`
	QueuedAPICalls []TopNEntry `json:"queued_api_calls"`
	Total          int        `json:"total"`
}

// DelayedEscalationEntry represents an escalation that ran later than scheduled.
type DelayedEscalationEntry struct {
	EscName       string     `json:"esc_name"`
	EscPool       string     `json:"esc_pool"`
	ScheduledTime *time.Time `json:"scheduled_time"`
	ActualTime    time.Time  `json:"actual_time"`
	DelayMS       uint32     `json:"delay_ms"`
	ThreadID      string     `json:"thread_id"`
	TraceID       string     `json:"trace_id"`
	LineNumber    int64      `json:"line_number"`
}

// DelayedEscalationsResponse wraps the delayed escalations data.
type DelayedEscalationsResponse struct {
	JobID      string                   `json:"job_id"`
	Entries    []DelayedEscalationEntry `json:"entries"`
	Total      int                      `json:"total"`
	AvgDelayMS float64                  `json:"avg_delay_ms"`
	MaxDelayMS uint32                   `json:"max_delay_ms"`
}

// --- JAR-Native Types (parsed directly from JAR v3.2.2 output) ---

// JARGapEntry represents a single line gap or thread gap from the JAR output.
type JARGapEntry struct {
	GapDuration float64   `json:"gap_duration"`
	LineNumber  int       `json:"line_number"`
	TraceID     string    `json:"trace_id"`
	Timestamp   time.Time `json:"timestamp"`
	Details     string    `json:"details"`
}

// JARGapsResponse contains both line gaps and thread gaps from the GAP ANALYSIS section.
type JARGapsResponse struct {
	LineGaps    []JARGapEntry        `json:"line_gaps"`
	ThreadGaps  []JARGapEntry        `json:"thread_gaps"`
	QueueHealth []QueueHealthSummary `json:"queue_health"`
	Source      string               `json:"source"`
}

// JARAggregateRow represents one row in a JAR aggregate table.
type JARAggregateRow struct {
	OperationType string  `json:"operation_type"`
	OK            int     `json:"ok"`
	Fail          int     `json:"fail"`
	Total         int     `json:"total"`
	MinTime       float64 `json:"min_time"`
	MinLine       int     `json:"min_line"`
	MaxTime       float64 `json:"max_time"`
	MaxLine       int     `json:"max_line"`
	AvgTime       float64 `json:"avg_time"`
	SumTime       float64 `json:"sum_time"`
}

// JARAggregateGroup represents one entity with its operation breakdowns.
type JARAggregateGroup struct {
	EntityName string            `json:"entity_name"`
	Rows       []JARAggregateRow `json:"rows"`
	Subtotal   *JARAggregateRow  `json:"subtotal"`
}

// JARAggregateTable represents a complete aggregate section.
type JARAggregateTable struct {
	GroupedBy  string              `json:"grouped_by"`
	SortedBy   string              `json:"sorted_by"`
	Groups     []JARAggregateGroup `json:"groups"`
	GrandTotal *JARAggregateRow    `json:"grand_total"`
}

// JARAggregatesResponse contains all aggregate tables parsed from JAR output.
type JARAggregatesResponse struct {
	APIByForm     *JARAggregateTable `json:"api_by_form"`
	APIByClient   *JARAggregateTable `json:"api_by_client"`
	APIByClientIP *JARAggregateTable `json:"api_by_client_ip"`
	SQLByTable    *JARAggregateTable `json:"sql_by_table"`
	EscByForm     *JARAggregateTable `json:"esc_by_form"`
	EscByPool     *JARAggregateTable `json:"esc_by_pool"`
	Source        string             `json:"source"`
}

// JARThreadStat represents one thread's statistics within a queue.
type JARThreadStat struct {
	Queue     string    `json:"queue"`
	ThreadID  string    `json:"thread_id"`
	FirstTime time.Time `json:"first_time"`
	LastTime  time.Time `json:"last_time"`
	Count     int       `json:"count"`
	QCount    int       `json:"q_count"`
	QTime     float64   `json:"q_time"`
	TotalTime float64   `json:"total_time"`
	BusyPct   float64   `json:"busy_pct"`
}

// JARThreadStatsResponse contains thread statistics for both API and SQL sections.
type JARThreadStatsResponse struct {
	APIThreads []JARThreadStat `json:"api_threads"`
	SQLThreads []JARThreadStat `json:"sql_threads"`
	Source     string          `json:"source"`
}

// JARAPIError represents one API call that errored out.
type JARAPIError struct {
	EndLine      int       `json:"end_line"`
	TraceID      string    `json:"trace_id"`
	Queue        string    `json:"queue"`
	API          string    `json:"api"`
	Form         string    `json:"form"`
	User         string    `json:"user"`
	StartTime    time.Time `json:"start_time"`
	ErrorMessage string    `json:"error_message"`
}

// JARExceptionEntry represents one entry from an API or SQL exception report.
type JARExceptionEntry struct {
	LineNumber   int    `json:"line_number"`
	TraceID      string `json:"trace_id"`
	Type         string `json:"type"`
	Message      string `json:"message"`
	SQLStatement string `json:"sql_statement"`
}

// JARExceptionsResponse contains all error and exception data from JAR output.
type JARExceptionsResponse struct {
	APIErrors     []JARAPIError       `json:"api_errors"`
	APIExceptions []JARExceptionEntry `json:"api_exceptions"`
	SQLExceptions []JARExceptionEntry `json:"sql_exceptions"`
	Source        string              `json:"source"`
}

// JARFilterMostExecuted represents one filter in the "50 MOST EXECUTED FLTR" section.
type JARFilterMostExecuted struct {
	FilterName string `json:"filter_name"`
	PassCount  int    `json:"pass_count"`
	FailCount  int    `json:"fail_count"`
}

// JARFilterPerTransaction represents one entry in "50 MOST FILTERS PER TRANSACTION".
type JARFilterPerTransaction struct {
	LineNumber    int     `json:"line_number"`
	TraceID       string  `json:"trace_id"`
	FilterCount   int     `json:"filter_count"`
	Operation     string  `json:"operation"`
	Form          string  `json:"form"`
	RequestID     string  `json:"request_id"`
	FiltersPerSec float64 `json:"filters_per_sec"`
}

// JARFilterExecutedPerTxn represents one entry in "50 MOST EXECUTED FLTR PER TRANSACTION".
type JARFilterExecutedPerTxn struct {
	LineNumber int    `json:"line_number"`
	TraceID    string `json:"trace_id"`
	FilterName string `json:"filter_name"`
	PassCount  int    `json:"pass_count"`
	FailCount  int    `json:"fail_count"`
}

// JARFilterLevel represents one entry in "50 MOST FILTER LEVELS IN TRANSACTIONS".
type JARFilterLevel struct {
	LineNumber  int    `json:"line_number"`
	TraceID     string `json:"trace_id"`
	FilterLevel int    `json:"filter_level"`
	Operation   string `json:"operation"`
	Form        string `json:"form"`
	RequestID   string `json:"request_id"`
}

// JARFilterComplexityResponse contains all 5 filter sub-sections from JAR output.
type JARFilterComplexityResponse struct {
	LongestRunning []TopNEntry               `json:"longest_running"`
	MostExecuted   []JARFilterMostExecuted   `json:"most_executed"`
	PerTransaction []JARFilterPerTransaction `json:"per_transaction"`
	ExecutedPerTxn []JARFilterExecutedPerTxn `json:"executed_per_txn"`
	FilterLevels   []JARFilterLevel          `json:"filter_levels"`
	Source         string                    `json:"source"`
}

// JARAPIAbbreviation maps an API abbreviation to its full name.
type JARAPIAbbreviation struct {
	Abbreviation string `json:"abbreviation"`
	FullName     string `json:"full_name"`
}

// ParseResult wraps the DashboardData with optional section-specific data
// populated during enhanced analysis.
type ParseResult struct {
	Dashboard   *DashboardData            `json:"dashboard"`
	Aggregates  *AggregatesResponse       `json:"aggregates,omitempty"`
	Exceptions  *ExceptionsResponse       `json:"exceptions,omitempty"`
	Gaps        *GapsResponse             `json:"gaps,omitempty"`
	ThreadStats *ThreadStatsResponse      `json:"thread_stats,omitempty"`
	Filters     *FilterComplexityResponse `json:"filters,omitempty"`

	// JAR-native types (parsed directly from JAR output)
	JARGaps        *JARGapsResponse             `json:"jar_gaps,omitempty"`
	JARAggregates  *JARAggregatesResponse       `json:"jar_aggregates,omitempty"`
	JARExceptions  *JARExceptionsResponse       `json:"jar_exceptions,omitempty"`
	JARThreadStats *JARThreadStatsResponse      `json:"jar_thread_stats,omitempty"`
	JARFilters     *JARFilterComplexityResponse `json:"jar_filters,omitempty"`

	// Supplementary data
	APIAbbreviations  []JARAPIAbbreviation `json:"api_abbreviations,omitempty"`
	QueuedAPICalls    []TopNEntry          `json:"queued_api_calls,omitempty"`
	LoggingActivities []LoggingActivity    `json:"logging_activities,omitempty"`
	FileMetadataList  []FileMetadata       `json:"file_metadata,omitempty"`
}

// --- Logging Activity & File Metadata Types ---

// LoggingActivity represents the logging duration for one log type from JAR output.
type LoggingActivity struct {
	LogType        string    `json:"log_type"`
	FirstTimestamp time.Time `json:"first_timestamp"`
	LastTimestamp  time.Time `json:"last_timestamp"`
	DurationMS     int64     `json:"duration_ms"`
	EntryCount     int       `json:"entry_count"`
}

// LoggingActivityResponse wraps the logging activity data.
type LoggingActivityResponse struct {
	JobID      string            `json:"job_id"`
	Activities []LoggingActivity `json:"activities"`
}

// FileMetadata represents per-file metadata from JAR output.
type FileMetadata struct {
	FileNumber int       `json:"file_number"`
	FileName   string    `json:"file_name"`
	StartTime  time.Time `json:"start_time"`
	EndTime    time.Time `json:"end_time"`
	DurationMS int64     `json:"duration_ms"`
	EntryCount int       `json:"entry_count"`
}

// FileMetadataResponse wraps the file metadata list.
type FileMetadataResponse struct {
	JobID string         `json:"job_id"`
	Files []FileMetadata `json:"files"`
	Total int            `json:"total"`
}

// --- Trace Transaction Types (008-trace-transaction) ---

// SpanNode represents a single span in the trace hierarchy tree.
type SpanNode struct {
	ID             string                 `json:"id"`
	ParentID       string                 `json:"parent_id,omitempty"`
	Depth          int                    `json:"depth"`
	LogType        LogType                `json:"log_type"`
	StartOffsetMS  int64                  `json:"start_offset_ms"`
	DurationMS     int                    `json:"duration_ms"`
	Fields         map[string]interface{} `json:"fields"`
	Children       []SpanNode             `json:"children"`
	OnCriticalPath bool                   `json:"on_critical_path"`
	HasError       bool                   `json:"has_error"`
	Timestamp      time.Time              `json:"timestamp"`
	ThreadID       string                 `json:"thread_id"`
	TraceID        string                 `json:"trace_id"`
	RPCID          string                 `json:"rpc_id,omitempty"`
	User           string                 `json:"user,omitempty"`
	Queue          string                 `json:"queue,omitempty"`
	Form           string                 `json:"form,omitempty"`
	Operation      string                 `json:"operation,omitempty"`
	LineNumber     int                    `json:"line_number"`
	FileNumber     int                    `json:"file_number"`
	Success        bool                   `json:"success"`
	ErrorMessage   string                 `json:"error_message,omitempty"`
}

// WaterfallResponse is the enhanced trace endpoint response.
type WaterfallResponse struct {
	TraceID         string         `json:"trace_id"`
	CorrelationType string         `json:"correlation_type"`
	TotalDurationMS int64          `json:"total_duration_ms"`
	SpanCount       int            `json:"span_count"`
	ErrorCount      int            `json:"error_count"`
	PrimaryUser     string         `json:"primary_user"`
	PrimaryQueue    string         `json:"primary_queue"`
	TypeBreakdown   map[string]int `json:"type_breakdown"`
	TraceStart      string         `json:"trace_start"`
	TraceEnd        string         `json:"trace_end"`
	Spans           []SpanNode     `json:"spans"`
	FlatSpans       []SpanNode     `json:"flat_spans"`
	CriticalPath    []string       `json:"critical_path"`
	TookMS          int            `json:"took_ms"`
}

// TransactionSummary is a single transaction in search results.
type TransactionSummary struct {
	TraceID          string `json:"trace_id"`
	CorrelationType  string `json:"correlation_type"`
	PrimaryUser      string `json:"primary_user"`
	PrimaryForm      string `json:"primary_form"`
	PrimaryOperation string `json:"primary_operation"`
	TotalDurationMS  int64  `json:"total_duration_ms"`
	SpanCount        int    `json:"span_count"`
	ErrorCount       int    `json:"error_count"`
	FirstTimestamp   string `json:"first_timestamp"`
	LastTimestamp    string `json:"last_timestamp"`
	PrimaryQueue     string `json:"primary_queue,omitempty"`
}

// TransactionSearchResponse is the response for transaction discovery.
type TransactionSearchResponse struct {
	Transactions []TransactionSummary `json:"transactions"`
	Total        int                  `json:"total"`
	TookMS       int                  `json:"took_ms"`
}

// TransactionSearchParams holds parameters for transaction search.
type TransactionSearchParams struct {
	User        string `json:"user,omitempty"`
	ThreadID    string `json:"thread_id,omitempty"`
	TraceID     string `json:"trace_id,omitempty"`
	RPCID       string `json:"rpc_id,omitempty"`
	HasErrors   *bool  `json:"has_errors,omitempty"`
	MinDuration int    `json:"min_duration_ms,omitempty"`
	Limit       int    `json:"limit,omitempty"`
	Offset      int    `json:"offset,omitempty"`
}
