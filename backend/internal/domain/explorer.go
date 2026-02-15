package domain

import (
	"time"

	"github.com/google/uuid"
)

type HistogramCounts struct {
	API   int64 `json:"api"`
	SQL   int64 `json:"sql"`
	FLTR  int64 `json:"fltr"`
	ESCL  int64 `json:"escl"`
	Total int64 `json:"total"`
}

type HistogramBucket struct {
	Timestamp time.Time       `json:"timestamp"`
	Counts    HistogramCounts `json:"counts"`
}

type HistogramResponse struct {
	Buckets    []HistogramBucket `json:"buckets"`
	BucketSize string            `json:"bucket_size"`
}

type ContextEntry struct {
	Entry    LogEntry `json:"entry"`
	IsTarget bool     `json:"is_target"`
}

type ContextResponse struct {
	Target     LogEntry   `json:"target"`
	Before     []LogEntry `json:"before"`
	After      []LogEntry `json:"after"`
	WindowSize int        `json:"window_size"`
}

type AutocompleteValue struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

type AutocompleteField struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type AutocompleteResponse struct {
	Fields  []AutocompleteField `json:"fields,omitempty"`
	Values  []AutocompleteValue `json:"values,omitempty"`
	IsField bool                `json:"is_field"`
}

type SearchHistoryEntry struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	TenantID    uuid.UUID  `json:"tenant_id" db:"tenant_id"`
	UserID      string     `json:"user_id" db:"user_id"`
	JobID       *uuid.UUID `json:"job_id,omitempty" db:"job_id"`
	KQLQuery    string     `json:"kql_query" db:"kql_query"`
	ResultCount int        `json:"result_count" db:"result_count"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

type TimeRange struct {
	Type  string     `json:"type"`
	Value string     `json:"value,omitempty"`
	Start *time.Time `json:"start,omitempty"`
	End   *time.Time `json:"end,omitempty"`
}

type SavedSearchWithTimeRange struct {
	SavedSearch
	TimeRange *TimeRange `json:"time_range,omitempty" db:"time_range"`
}
