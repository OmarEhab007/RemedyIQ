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
}
