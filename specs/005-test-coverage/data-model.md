# Data Model: Comprehensive Test Coverage

**Branch**: `005-test-coverage` | **Date**: 2026-02-12

This feature does not introduce new application data entities. Instead, it defines the test infrastructure entities and their relationships.

## Test Infrastructure Entities

### Interface Definitions (New)

These interfaces extract the implicit contracts from existing concrete types to enable mocking.

#### PostgresStore Interface

```go
type PostgresStore interface {
    Ping(ctx context.Context) error
    SetTenantContext(ctx context.Context, tenantID string) error
    CreateTenant(ctx context.Context, t *domain.Tenant) error
    GetTenant(ctx context.Context, id uuid.UUID) (*domain.Tenant, error)
    GetTenantByClerkOrg(ctx context.Context, clerkOrgID string) (*domain.Tenant, error)
    CreateLogFile(ctx context.Context, f *domain.LogFile) error
    GetLogFile(ctx context.Context, tenantID uuid.UUID, fileID uuid.UUID) (*domain.LogFile, error)
    ListLogFiles(ctx context.Context, tenantID uuid.UUID) ([]*domain.LogFile, error)
    CreateJob(ctx context.Context, job *domain.AnalysisJob) error
    GetJob(ctx context.Context, tenantID uuid.UUID, jobID uuid.UUID) (*domain.AnalysisJob, error)
    UpdateJobStatus(ctx context.Context, tenantID uuid.UUID, jobID uuid.UUID, status string, errMsg *string) error
    UpdateJobProgress(ctx context.Context, tenantID uuid.UUID, jobID uuid.UUID, progressPct int, processedLines *int64) error
    ListJobs(ctx context.Context, tenantID uuid.UUID) ([]*domain.AnalysisJob, error)
    CreateAIInteraction(ctx context.Context, ai *domain.AIInteraction) error
    UpdateAIInteraction(ctx context.Context, tenantID uuid.UUID, aiID uuid.UUID, output *string, tokens *int, latency *int, status string) error
    CreateSavedSearch(ctx context.Context, search *domain.SavedSearch) error
    ListSavedSearches(ctx context.Context, tenantID uuid.UUID, userID string) ([]*domain.SavedSearch, error)
    DeleteSavedSearch(ctx context.Context, tenantID uuid.UUID, userID string, searchID uuid.UUID) error
    Close()
}
```

#### ClickHouseStore Interface

```go
type ClickHouseStore interface {
    Ping(ctx context.Context) error
    BatchInsertEntries(ctx context.Context, entries []domain.LogEntry) error
    GetDashboardData(ctx context.Context, tenantID, jobID string, topN int) (*domain.DashboardData, error)
    ComputeHealthScore(ctx context.Context, tenantID, jobID string) (float64, error)
    Search(ctx context.Context, query *SearchQuery) (*SearchResult, error)
    Close()
}
```

#### RedisCache Interface

```go
type RedisCache interface {
    Ping(ctx context.Context) error
    Get(ctx context.Context, key string) (string, error)
    Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error
    Delete(ctx context.Context, key string) error
    TenantKey(tenantID, category, id string) string
    CheckRateLimit(ctx context.Context, tenantID, userID string, limit, windowSeconds int) (bool, error)
    Close()
}
```

#### S3Storage Interface

```go
type S3Storage interface {
    Upload(ctx context.Context, key string, reader io.Reader, size int64) error
    Download(ctx context.Context, key string) (io.ReadCloser, error)
}
```

#### AIClient Interface

```go
type AIClient interface {
    Query(ctx context.Context, systemPrompt string, messages []Message, maxTokens int) (*Response, error)
    IsAvailable() bool
}
```

#### NATSStreamer Interface

```go
type NATSStreamer interface {
    EnsureStreams(ctx context.Context) error
    SubscribeJobSubmit(ctx context.Context, tenantID string, callback func(job domain.AnalysisJob)) error
    PublishJobProgress(ctx context.Context, progress *JobProgress) error
    Close()
}
```

### Mock Implementations (New)

Each interface gets a corresponding testify/mock implementation in `backend/internal/testutil/mocks.go`:

- `MockPostgresStore` - implements PostgresStore
- `MockClickHouseStore` - implements ClickHouseStore
- `MockRedisCache` - implements RedisCache
- `MockS3Storage` - implements S3Storage
- `MockAIClient` - implements AIClient
- `MockNATSStreamer` - implements NATSStreamer

### Test Fixture Registry

| Fixture File | Source Directory | Used By | Format |
|-------------|-----------------|---------|--------|
| arerror.log | error_logs/ | parser, AI skills | AR timestamp + message |
| armonitor.log | error_logs/ | parser | AR timestamp + metrics |
| ardebug.log | error_logs/ | parser | AR timestamp + debug |
| arexception.log | error_logs/ | parser, error_explainer | AR timestamp + stack traces |
| ServiceContext.log | error_logs/ | parser | Service context format |
| log1-5.log | error_logs/ | parser, search | Mixed formats |
| arapi_sample.log | backend/testdata/ | parser, handlers | API log type |
| arsql_sample.log | backend/testdata/ | parser, handlers | SQL log type |
| arfilter_sample.log | backend/testdata/ | parser, handlers | Filter log type |
| aresc_sample.log | backend/testdata/ | parser, handlers | Escalation log type |
| combined_sample.log | backend/testdata/ | parser, search | Multi-type combined |

### Relationships

```
Interface Definitions ──extracts-from──> Concrete Storage Clients
Mock Implementations ──implements──> Interface Definitions
Test Files ──depend-on──> Mock Implementations
Test Files ──depend-on──> Test Fixtures
Handler Tests ──use──> MockPostgresStore, MockClickHouseStore, MockRedisCache
AI Skill Tests ──use──> MockAIClient, Test Fixtures
Worker Tests ──use──> MockPostgresStore, MockClickHouseStore, MockNATSStreamer, MockS3Storage
Integration Tests ──use──> Real Docker Services (no mocks)
Frontend Tests ──use──> Mocked fetch/WebSocket APIs
```
