package testutil

import (
	"context"
	"io"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
	"github.com/blevesearch/bleve/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

type MockPostgresStore struct {
	mock.Mock
}

func (m *MockPostgresStore) Ping(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockPostgresStore) SetTenantContext(ctx context.Context, tenantID string) error {
	args := m.Called(ctx, tenantID)
	return args.Error(0)
}

func (m *MockPostgresStore) CreateTenant(ctx context.Context, t *domain.Tenant) error {
	args := m.Called(ctx, t)
	return args.Error(0)
}

func (m *MockPostgresStore) GetTenant(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Tenant), args.Error(1)
}

func (m *MockPostgresStore) GetTenantByClerkOrg(ctx context.Context, clerkOrgID string) (*domain.Tenant, error) {
	args := m.Called(ctx, clerkOrgID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Tenant), args.Error(1)
}

func (m *MockPostgresStore) CreateLogFile(ctx context.Context, f *domain.LogFile) error {
	args := m.Called(ctx, f)
	return args.Error(0)
}

func (m *MockPostgresStore) GetLogFile(ctx context.Context, tenantID, fileID uuid.UUID) (*domain.LogFile, error) {
	args := m.Called(ctx, tenantID, fileID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.LogFile), args.Error(1)
}

func (m *MockPostgresStore) ListLogFiles(ctx context.Context, tenantID uuid.UUID) ([]domain.LogFile, error) {
	args := m.Called(ctx, tenantID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.LogFile), args.Error(1)
}

func (m *MockPostgresStore) CreateJob(ctx context.Context, job *domain.AnalysisJob) error {
	args := m.Called(ctx, job)
	return args.Error(0)
}

func (m *MockPostgresStore) GetJob(ctx context.Context, tenantID, jobID uuid.UUID) (*domain.AnalysisJob, error) {
	args := m.Called(ctx, tenantID, jobID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.AnalysisJob), args.Error(1)
}

func (m *MockPostgresStore) UpdateJobStatus(ctx context.Context, tenantID, jobID uuid.UUID, status domain.JobStatus, errMsg *string) error {
	args := m.Called(ctx, tenantID, jobID, status, errMsg)
	return args.Error(0)
}

func (m *MockPostgresStore) UpdateJobProgress(ctx context.Context, tenantID, jobID uuid.UUID, progressPct int, processedLines *int64) error {
	args := m.Called(ctx, tenantID, jobID, progressPct, processedLines)
	return args.Error(0)
}

func (m *MockPostgresStore) ListJobs(ctx context.Context, tenantID uuid.UUID) ([]domain.AnalysisJob, error) {
	args := m.Called(ctx, tenantID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.AnalysisJob), args.Error(1)
}

func (m *MockPostgresStore) CreateAIInteraction(ctx context.Context, ai *domain.AIInteraction) error {
	args := m.Called(ctx, ai)
	return args.Error(0)
}

func (m *MockPostgresStore) UpdateAIInteraction(ctx context.Context, tenantID, aiID uuid.UUID, outputText *string, tokensUsed *int, latencyMS *int, status string) error {
	args := m.Called(ctx, tenantID, aiID, outputText, tokensUsed, latencyMS, status)
	return args.Error(0)
}

func (m *MockPostgresStore) CreateSavedSearch(ctx context.Context, search *domain.SavedSearch) error {
	args := m.Called(ctx, search)
	return args.Error(0)
}

func (m *MockPostgresStore) ListSavedSearches(ctx context.Context, tenantID uuid.UUID, userID string) ([]domain.SavedSearch, error) {
	args := m.Called(ctx, tenantID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.SavedSearch), args.Error(1)
}

func (m *MockPostgresStore) DeleteSavedSearch(ctx context.Context, tenantID uuid.UUID, userID string, searchID uuid.UUID) error {
	args := m.Called(ctx, tenantID, userID, searchID)
	return args.Error(0)
}

func (m *MockPostgresStore) RecordSearchHistory(ctx context.Context, tenantID uuid.UUID, userID string, jobID *uuid.UUID, kqlQuery string, resultCount int) error {
	args := m.Called(ctx, tenantID, userID, jobID, kqlQuery, resultCount)
	return args.Error(0)
}

func (m *MockPostgresStore) GetSearchHistory(ctx context.Context, tenantID uuid.UUID, userID string, limit int) ([]domain.SearchHistoryEntry, error) {
	args := m.Called(ctx, tenantID, userID, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.SearchHistoryEntry), args.Error(1)
}

func (m *MockPostgresStore) Close() {
	m.Called()
}

type MockClickHouseStore struct {
	mock.Mock
}

func (m *MockClickHouseStore) Ping(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockClickHouseStore) BatchInsertEntries(ctx context.Context, entries []domain.LogEntry) error {
	args := m.Called(ctx, entries)
	return args.Error(0)
}

func (m *MockClickHouseStore) GetLogEntry(ctx context.Context, tenantID, jobID, entryID string) (*domain.LogEntry, error) {
	args := m.Called(ctx, tenantID, jobID, entryID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.LogEntry), args.Error(1)
}

func (m *MockClickHouseStore) GetDashboardData(ctx context.Context, tenantID, jobID string, topN int) (*domain.DashboardData, error) {
	args := m.Called(ctx, tenantID, jobID, topN)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.DashboardData), args.Error(1)
}

func (m *MockClickHouseStore) ComputeHealthScore(ctx context.Context, tenantID, jobID string) (*domain.HealthScore, error) {
	args := m.Called(ctx, tenantID, jobID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.HealthScore), args.Error(1)
}

func (m *MockClickHouseStore) GetAggregates(ctx context.Context, tenantID, jobID string) (*domain.AggregatesResponse, error) {
	args := m.Called(ctx, tenantID, jobID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.AggregatesResponse), args.Error(1)
}

func (m *MockClickHouseStore) GetExceptions(ctx context.Context, tenantID, jobID string) (*domain.ExceptionsResponse, error) {
	args := m.Called(ctx, tenantID, jobID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.ExceptionsResponse), args.Error(1)
}

func (m *MockClickHouseStore) GetGaps(ctx context.Context, tenantID, jobID string) (*domain.GapsResponse, error) {
	args := m.Called(ctx, tenantID, jobID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.GapsResponse), args.Error(1)
}

func (m *MockClickHouseStore) GetThreadStats(ctx context.Context, tenantID, jobID string) (*domain.ThreadStatsResponse, error) {
	args := m.Called(ctx, tenantID, jobID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.ThreadStatsResponse), args.Error(1)
}

func (m *MockClickHouseStore) GetFilterComplexity(ctx context.Context, tenantID, jobID string) (*domain.FilterComplexityResponse, error) {
	args := m.Called(ctx, tenantID, jobID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.FilterComplexityResponse), args.Error(1)
}

func (m *MockClickHouseStore) SearchEntries(ctx context.Context, tenantID, jobID string, q storage.SearchQuery) (*storage.SearchResult, error) {
	args := m.Called(ctx, tenantID, jobID, q)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*storage.SearchResult), args.Error(1)
}

func (m *MockClickHouseStore) GetHistogramData(ctx context.Context, tenantID, jobID string, timeFrom, timeTo time.Time) (*domain.HistogramResponse, error) {
	args := m.Called(ctx, tenantID, jobID, timeFrom, timeTo)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.HistogramResponse), args.Error(1)
}

func (m *MockClickHouseStore) GetEntryContext(ctx context.Context, tenantID, jobID, entryID string, window int) (*domain.ContextResponse, error) {
	args := m.Called(ctx, tenantID, jobID, entryID, window)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.ContextResponse), args.Error(1)
}

func (m *MockClickHouseStore) GetAutocompleteValues(ctx context.Context, tenantID, jobID, field, prefix string, limit int) ([]domain.AutocompleteValue, error) {
	args := m.Called(ctx, tenantID, jobID, field, prefix, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.AutocompleteValue), args.Error(1)
}

func (m *MockClickHouseStore) GetTraceEntries(ctx context.Context, tenantID, jobID, traceID string) ([]domain.LogEntry, error) {
	args := m.Called(ctx, tenantID, jobID, traceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.LogEntry), args.Error(1)
}

func (m *MockClickHouseStore) GetJobTimeRange(ctx context.Context, tenantID, jobID string) (*storage.JobTimeRange, error) {
	args := m.Called(ctx, tenantID, jobID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*storage.JobTimeRange), args.Error(1)
}

func (m *MockClickHouseStore) GetFacets(ctx context.Context, tenantID, jobID string, q storage.SearchQuery) (map[string][]storage.FacetValue, error) {
	args := m.Called(ctx, tenantID, jobID, q)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string][]storage.FacetValue), args.Error(1)
}

func (m *MockClickHouseStore) SearchTransactions(ctx context.Context, tenantID, jobID string, params domain.TransactionSearchParams) (*domain.TransactionSearchResponse, error) {
	args := m.Called(ctx, tenantID, jobID, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.TransactionSearchResponse), args.Error(1)
}

func (m *MockClickHouseStore) QueryDelayedEscalations(ctx context.Context, tenantID, jobID string, minDelayMS int, limit int) ([]domain.DelayedEscalationEntry, error) {
	args := m.Called(ctx, tenantID, jobID, minDelayMS, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.DelayedEscalationEntry), args.Error(1)
}

func (m *MockClickHouseStore) Close() error {
	args := m.Called()
	return args.Error(0)
}

type MockRedisCache struct {
	mock.Mock
}

func (m *MockRedisCache) Ping(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockRedisCache) Get(ctx context.Context, key string) (string, error) {
	args := m.Called(ctx, key)
	return args.String(0), args.Error(1)
}

func (m *MockRedisCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	args := m.Called(ctx, key, value, ttl)
	return args.Error(0)
}

func (m *MockRedisCache) Delete(ctx context.Context, key string) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

func (m *MockRedisCache) TenantKey(tenantID, category, id string) string {
	args := m.Called(tenantID, category, id)
	return args.String(0)
}

func (m *MockRedisCache) CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	args := m.Called(ctx, key, limit, window)
	return args.Bool(0), args.Error(1)
}

type MockS3Storage struct {
	mock.Mock
}

func (m *MockS3Storage) Upload(ctx context.Context, key string, reader io.Reader, size int64) error {
	args := m.Called(ctx, key, reader, size)
	return args.Error(0)
}

func (m *MockS3Storage) Download(ctx context.Context, key string) (io.ReadCloser, error) {
	args := m.Called(ctx, key)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(io.ReadCloser), args.Error(1)
}

type MockAIClient struct {
	mock.Mock
}

func (m *MockAIClient) Query(ctx context.Context, systemPrompt string, messages []ai.Message, maxTokens int) (*ai.Response, error) {
	args := m.Called(ctx, systemPrompt, messages, maxTokens)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ai.Response), args.Error(1)
}

func (m *MockAIClient) IsAvailable() bool {
	args := m.Called()
	return args.Bool(0)
}

type MockNATSStreamer struct {
	mock.Mock
}

func (m *MockNATSStreamer) EnsureStreams(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockNATSStreamer) SubscribeJobSubmit(ctx context.Context, tenantID string, callback func(domain.AnalysisJob)) error {
	args := m.Called(ctx, tenantID, callback)
	return args.Error(0)
}

func (m *MockNATSStreamer) SubscribeAllJobSubmits(ctx context.Context, handler func(domain.AnalysisJob)) error {
	args := m.Called(ctx, mock.AnythingOfType("func(domain.AnalysisJob)"))
	return args.Error(0)
}

func (m *MockNATSStreamer) SubscribeJobProgress(ctx context.Context, tenantID string, handler func(streaming.JobProgress)) error {
	args := m.Called(ctx, tenantID, mock.AnythingOfType("func(streaming.JobProgress)"))
	return args.Error(0)
}

func (m *MockNATSStreamer) SubscribeLiveTail(ctx context.Context, tenantID string, logType string, handler func(domain.LogEntry)) error {
	args := m.Called(ctx, tenantID, logType, mock.AnythingOfType("func(domain.LogEntry)"))
	return args.Error(0)
}

func (m *MockNATSStreamer) PublishJobSubmit(ctx context.Context, tenantID string, job domain.AnalysisJob) error {
	args := m.Called(ctx, tenantID, job)
	return args.Error(0)
}

func (m *MockNATSStreamer) PublishJobProgress(ctx context.Context, tenantID string, jobID string, progress int, status string, message string) error {
	args := m.Called(ctx, tenantID, jobID, progress, status, message)
	return args.Error(0)
}

func (m *MockNATSStreamer) PublishJobComplete(ctx context.Context, tenantID string, jobID string, result domain.AnalysisJob) error {
	args := m.Called(ctx, tenantID, jobID, result)
	return args.Error(0)
}

func (m *MockNATSStreamer) PublishLiveTailEntry(ctx context.Context, tenantID string, logType string, entry domain.LogEntry) error {
	args := m.Called(ctx, tenantID, logType, entry)
	return args.Error(0)
}

func (m *MockNATSStreamer) Ping() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockNATSStreamer) Close() {
	m.Called()
}

type MockSearchIndexer struct {
	mock.Mock
}

func (m *MockSearchIndexer) Index(ctx context.Context, tenantID string, entries []domain.LogEntry) error {
	args := m.Called(ctx, tenantID, entries)
	return args.Error(0)
}

func (m *MockSearchIndexer) Search(ctx context.Context, tenantID string, req *bleve.SearchRequest) (*bleve.SearchResult, error) {
	args := m.Called(ctx, tenantID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*bleve.SearchResult), args.Error(1)
}

func (m *MockSearchIndexer) Delete(tenantID string) error {
	args := m.Called(tenantID)
	return args.Error(0)
}

func (m *MockSearchIndexer) Close() error {
	args := m.Called()
	return args.Error(0)
}
