package storage

import (
	"context"
	"io"
	"time"

	"github.com/google/uuid"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

type PostgresStore interface {
	Ping(ctx context.Context) error
	SetTenantContext(ctx context.Context, tenantID string) error
	CreateTenant(ctx context.Context, t *domain.Tenant) error
	GetTenant(ctx context.Context, id uuid.UUID) (*domain.Tenant, error)
	GetTenantByClerkOrg(ctx context.Context, clerkOrgID string) (*domain.Tenant, error)
	CreateLogFile(ctx context.Context, f *domain.LogFile) error
	GetLogFile(ctx context.Context, tenantID uuid.UUID, fileID uuid.UUID) (*domain.LogFile, error)
	ListLogFiles(ctx context.Context, tenantID uuid.UUID) ([]domain.LogFile, error)
	CreateJob(ctx context.Context, job *domain.AnalysisJob) error
	GetJob(ctx context.Context, tenantID uuid.UUID, jobID uuid.UUID) (*domain.AnalysisJob, error)
	UpdateJobStatus(ctx context.Context, tenantID uuid.UUID, jobID uuid.UUID, status domain.JobStatus, errMsg *string) error
	UpdateJobProgress(ctx context.Context, tenantID uuid.UUID, jobID uuid.UUID, progressPct int, processedLines *int64) error
	ListJobs(ctx context.Context, tenantID uuid.UUID) ([]domain.AnalysisJob, error)
	CreateAIInteraction(ctx context.Context, ai *domain.AIInteraction) error
	UpdateAIInteraction(ctx context.Context, tenantID uuid.UUID, aiID uuid.UUID, outputText *string, tokensUsed *int, latencyMS *int, status string) error
	CreateSavedSearch(ctx context.Context, search *domain.SavedSearch) error
	ListSavedSearches(ctx context.Context, tenantID uuid.UUID, userID string) ([]domain.SavedSearch, error)
	DeleteSavedSearch(ctx context.Context, tenantID uuid.UUID, userID string, searchID uuid.UUID) error
	RecordSearchHistory(ctx context.Context, tenantID uuid.UUID, userID string, jobID *uuid.UUID, kqlQuery string, resultCount int) error
	GetSearchHistory(ctx context.Context, tenantID uuid.UUID, userID string, limit int) ([]domain.SearchHistoryEntry, error)
}

type ClickHouseStore interface {
	Ping(ctx context.Context) error
	BatchInsertEntries(ctx context.Context, entries []domain.LogEntry) error
	GetLogEntry(ctx context.Context, tenantID, jobID, entryID string) (*domain.LogEntry, error)
	GetDashboardData(ctx context.Context, tenantID, jobID string, topN int) (*domain.DashboardData, error)
	ComputeHealthScore(ctx context.Context, tenantID, jobID string) (*domain.HealthScore, error)
	GetAggregates(ctx context.Context, tenantID, jobID string) (*domain.AggregatesResponse, error)
	GetExceptions(ctx context.Context, tenantID, jobID string) (*domain.ExceptionsResponse, error)
	GetGaps(ctx context.Context, tenantID, jobID string) (*domain.GapsResponse, error)
	GetThreadStats(ctx context.Context, tenantID, jobID string) (*domain.ThreadStatsResponse, error)
	GetFilterComplexity(ctx context.Context, tenantID, jobID string) (*domain.FilterComplexityResponse, error)
	SearchEntries(ctx context.Context, tenantID, jobID string, q SearchQuery) (*SearchResult, error)
	GetHistogramData(ctx context.Context, tenantID, jobID string, timeFrom, timeTo time.Time) (*domain.HistogramResponse, error)
	GetEntryContext(ctx context.Context, tenantID, jobID, entryID string, window int) (*domain.ContextResponse, error)
	GetAutocompleteValues(ctx context.Context, tenantID, jobID, field, prefix string, limit int) ([]domain.AutocompleteValue, error)
	GetTraceEntries(ctx context.Context, tenantID, jobID, traceID string) ([]domain.LogEntry, error)
	GetJobTimeRange(ctx context.Context, tenantID, jobID string) (*JobTimeRange, error)
	GetFacets(ctx context.Context, tenantID, jobID string, q SearchQuery) (map[string][]FacetValue, error)
	Close() error
}

type RedisCache interface {
	Ping(ctx context.Context) error
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
	TenantKey(tenantID, category, id string) string
	CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, error)
}

type S3Storage interface {
	Upload(ctx context.Context, key string, reader io.Reader, size int64) error
	Download(ctx context.Context, key string) (io.ReadCloser, error)
}
