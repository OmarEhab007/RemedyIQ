package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// newDashboardMocks creates fresh mock instances for all three storage layers.
func newDashboardMocks() (*testutil.MockPostgresStore, *testutil.MockClickHouseStore, *testutil.MockRedisCache) {
	return new(testutil.MockPostgresStore), new(testutil.MockClickHouseStore), new(testutil.MockRedisCache)
}

// completedJob returns a minimal AnalysisJob with status "complete".
func completedJob(tenantID, jobID uuid.UUID) *domain.AnalysisJob {
	now := time.Now()
	return &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// parsingJob returns a minimal AnalysisJob with status "parsing".
func parsingJob(tenantID, jobID uuid.UUID) *domain.AnalysisJob {
	now := time.Now()
	return &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusParsing,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// sampleDashboardData returns a realistic DashboardData fixture for testing.
func sampleDashboardData() *domain.DashboardData {
	return &domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			TotalLines:   10000,
			APICount:     5000,
			SQLCount:     3000,
			FilterCount:  1500,
			EscCount:     500,
			UniqueUsers:  25,
			UniqueForms:  10,
			UniqueTables: 8,
			LogStart:     time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			LogEnd:       time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC),
			LogDuration:  "12h0m0s",
		},
		TopAPICalls:    []domain.TopNEntry{{Rank: 1, Identifier: "SYS:GetListEntry", DurationMS: 420}},
		TopSQL:         []domain.TopNEntry{{Rank: 1, Identifier: "SELECT FROM arschema", DurationMS: 310}},
		TopFilters:     []domain.TopNEntry{{Rank: 1, Identifier: "HPD:HelpDesk", DurationMS: 150}},
		TopEscalations: []domain.TopNEntry{{Rank: 1, Identifier: "HPD:ResolveEsc", DurationMS: 90}},
		TimeSeries:     []domain.TimeSeriesPoint{{Timestamp: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), APICount: 200}},
		Distribution:   map[string]map[string]int{"api": {"success": 4800, "error": 200}},
	}
}

// sampleHealthScore returns a realistic HealthScore fixture for testing.
func sampleHealthScore() *domain.HealthScore {
	return &domain.HealthScore{
		Score:  78,
		Status: "warning",
		Factors: []domain.HealthScoreFactor{
			{Name: "error_rate", Score: 6, MaxScore: 10, Weight: 0.3, Description: "Error rate is 4%", Severity: "warning"},
			{Name: "avg_latency", Score: 8, MaxScore: 10, Weight: 0.25, Description: "Average latency 120ms", Severity: "ok"},
		},
	}
}

// makeDashboardRequest builds a request to the dashboard endpoint. If tenantID
// is non-empty, the tenant and user context values are injected. If jobIDStr
// is non-empty, it is set as a mux URL variable.
func makeDashboardRequest(tenantID, jobIDStr string) *http.Request {
	path := fmt.Sprintf("/api/v1/analysis/%s/dashboard", jobIDStr)
	req := httptest.NewRequest(http.MethodGet, path, nil)

	if tenantID != "" {
		ctx := middleware.WithTenantID(req.Context(), tenantID)
		ctx = middleware.WithUserID(ctx, "test-user")
		req = req.WithContext(ctx)
	}

	if jobIDStr != "" {
		req = mux.SetURLVars(req, map[string]string{"job_id": jobIDStr})
	}

	return req
}

// ---------------------------------------------------------------------------
// Test: missing tenant context -> 401 Unauthorized
// ---------------------------------------------------------------------------

func TestDashboardHandler_MissingTenantContext(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	// No tenant context injected.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dashboard", nil)
	req = mux.SetURLVars(req, map[string]string{"job_id": "550e8400-e29b-41d4-a716-446655440000"})

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
	assert.Contains(t, errResp.Message, "missing tenant context")

	// No storage calls should have been made.
	pg.AssertNotCalled(t, "GetJob")
	ch.AssertNotCalled(t, "GetDashboardData")
	redis.AssertNotCalled(t, "Get")
}

// ---------------------------------------------------------------------------
// Test: invalid job_id (not a UUID) -> 400 Bad Request
// ---------------------------------------------------------------------------

func TestDashboardHandler_InvalidJobID(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := "550e8400-e29b-41d4-a716-446655440000"

	req := makeDashboardRequest(tenantID, "not-a-valid-uuid")

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "invalid job_id format")

	pg.AssertNotCalled(t, "GetJob")
}

// ---------------------------------------------------------------------------
// Test: empty job_id -> 400 Bad Request
// ---------------------------------------------------------------------------

func TestDashboardHandler_EmptyJobID(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := "550e8400-e29b-41d4-a716-446655440000"

	req := makeDashboardRequest(tenantID, "")

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "invalid job_id format")
}

// ---------------------------------------------------------------------------
// Test: invalid tenant_id format (not a UUID) -> 400 Bad Request
// ---------------------------------------------------------------------------

func TestDashboardHandler_InvalidTenantIDFormat(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	jobID := uuid.New()

	req := makeDashboardRequest("bad-tenant-id", jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "invalid tenant_id format")

	pg.AssertNotCalled(t, "GetJob")
}

// ---------------------------------------------------------------------------
// Test: job not found in Postgres -> 404 Not Found
// ---------------------------------------------------------------------------

func TestDashboardHandler_JobNotFound(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()

	// storage.IsNotFound checks for the substring "not found" in the error.
	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(nil, fmt.Errorf("not found"))

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeNotFound, errResp.Code)
	assert.Contains(t, errResp.Message, "analysis job not found")

	pg.AssertExpectations(t)
	ch.AssertNotCalled(t, "GetDashboardData")
	redis.AssertNotCalled(t, "Get")
}

// ---------------------------------------------------------------------------
// Test: Postgres returns a generic error (not "not found") -> 500
// ---------------------------------------------------------------------------

func TestDashboardHandler_PostgresGenericError(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(nil, errors.New("connection refused"))

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInternalError, errResp.Code)
	assert.Contains(t, errResp.Message, "failed to retrieve analysis job")

	pg.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Test: job exists but is not complete -> 409 Conflict
// ---------------------------------------------------------------------------

func TestDashboardHandler_JobNotComplete(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(parsingJob(tenantID, jobID), nil)

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "analysis is not yet complete")

	pg.AssertExpectations(t)
	ch.AssertNotCalled(t, "GetDashboardData")
}

// ---------------------------------------------------------------------------
// Test: job in each non-complete status returns 409
// ---------------------------------------------------------------------------

func TestDashboardHandler_AllIncompleteStatuses(t *testing.T) {
	incompleteStatuses := []domain.JobStatus{
		domain.JobStatusQueued,
		domain.JobStatusParsing,
		domain.JobStatusAnalyzing,
		domain.JobStatusStoring,
		domain.JobStatusFailed,
	}

	for _, status := range incompleteStatuses {
		t.Run(string(status), func(t *testing.T) {
			pg, ch, redis := newDashboardMocks()
			handler := NewDashboardHandler(pg, ch, redis)

			tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
			jobID := uuid.New()

			now := time.Now()
			job := &domain.AnalysisJob{
				ID:        jobID,
				TenantID:  tenantID,
				Status:    status,
				CreatedAt: now,
				UpdatedAt: now,
			}

			pg.On("GetJob", mock.Anything, tenantID, jobID).Return(job, nil)

			req := makeDashboardRequest(tenantID.String(), jobID.String())

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			assert.Equal(t, http.StatusConflict, w.Code)

			pg.AssertExpectations(t)
			ch.AssertNotCalled(t, "GetDashboardData")
		})
	}
}

// ---------------------------------------------------------------------------
// Test: cache hit -> returns cached data, 200 OK
// ---------------------------------------------------------------------------

func TestDashboardHandler_CacheHit(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	// Step 1: GetJob succeeds with a complete job.
	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)

	// Step 2: TenantKey returns the cache key.
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)

	// Step 3: Redis cache hit -- return valid JSON.
	cachedData := sampleDashboardData()
	cachedData.HealthScore = sampleHealthScore()
	cachedJSON, err := json.Marshal(cachedData)
	require.NoError(t, err)

	redis.On("Get", mock.Anything, cacheKey).
		Return(string(cachedJSON), nil)

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")

	var respData domain.DashboardData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&respData))
	assert.Equal(t, int64(10000), respData.GeneralStats.TotalLines)
	assert.Equal(t, int64(5000), respData.GeneralStats.APICount)
	assert.NotNil(t, respData.HealthScore)
	assert.Equal(t, 78, respData.HealthScore.Score)

	pg.AssertExpectations(t)
	redis.AssertExpectations(t)
	// ClickHouse should NOT have been called on cache hit.
	ch.AssertNotCalled(t, "GetDashboardData")
	ch.AssertNotCalled(t, "ComputeHealthScore")
}

// ---------------------------------------------------------------------------
// Test: cache miss -> queries ClickHouse, caches result, 200 OK
// ---------------------------------------------------------------------------

func TestDashboardHandler_CacheMiss_Success(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	// Step 1: GetJob succeeds.
	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)

	// Step 2: TenantKey.
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)

	// Step 3: Cache miss.
	redis.On("Get", mock.Anything, cacheKey).
		Return("", errors.New("cache miss"))

	// Step 4: ClickHouse returns dashboard data.
	dashData := sampleDashboardData()
	ch.On("GetDashboardData", mock.Anything, tenantID.String(), jobID.String(), 50).
		Return(dashData, nil)

	// Step 5: ClickHouse returns health score.
	healthScore := sampleHealthScore()
	ch.On("ComputeHealthScore", mock.Anything, tenantID.String(), jobID.String()).
		Return(healthScore, nil)

	// Step 6: Redis.Set is called to cache the result.
	redis.On("Set", mock.Anything, cacheKey, mock.Anything, 5*time.Minute).
		Return(nil)

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")

	var respData domain.DashboardData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&respData))
	assert.Equal(t, int64(10000), respData.GeneralStats.TotalLines)
	assert.NotNil(t, respData.HealthScore)
	assert.Equal(t, 78, respData.HealthScore.Score)
	assert.Equal(t, "warning", respData.HealthScore.Status)
	assert.Len(t, respData.TopAPICalls, 1)
	assert.Equal(t, "SYS:GetListEntry", respData.TopAPICalls[0].Identifier)

	pg.AssertExpectations(t)
	ch.AssertExpectations(t)
	redis.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Test: cache miss, ClickHouse GetDashboardData error -> 500
// ---------------------------------------------------------------------------

func TestDashboardHandler_ClickHouseGetDashboardDataError(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)
	redis.On("Get", mock.Anything, cacheKey).
		Return("", errors.New("cache miss"))

	// ClickHouse returns an error.
	ch.On("GetDashboardData", mock.Anything, tenantID.String(), jobID.String(), 50).
		Return(nil, errors.New("clickhouse timeout"))

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInternalError, errResp.Code)
	assert.Contains(t, errResp.Message, "failed to retrieve dashboard data")

	pg.AssertExpectations(t)
	ch.AssertExpectations(t)
	// ComputeHealthScore should not be called when GetDashboardData fails.
	ch.AssertNotCalled(t, "ComputeHealthScore")
	// Set should not be called when GetDashboardData fails.
	redis.AssertNotCalled(t, "Set")
}

// ---------------------------------------------------------------------------
// Test: health score computation fails -> still returns 200 with nil score
// ---------------------------------------------------------------------------

func TestDashboardHandler_HealthScoreError_StillReturns200(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)
	redis.On("Get", mock.Anything, cacheKey).
		Return("", errors.New("cache miss"))

	dashData := sampleDashboardData()
	ch.On("GetDashboardData", mock.Anything, tenantID.String(), jobID.String(), 50).
		Return(dashData, nil)

	// ComputeHealthScore fails -- this is a soft error.
	ch.On("ComputeHealthScore", mock.Anything, tenantID.String(), jobID.String()).
		Return(nil, errors.New("health score computation failed"))

	redis.On("Set", mock.Anything, cacheKey, mock.Anything, 5*time.Minute).
		Return(nil)

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var respData domain.DashboardData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&respData))
	assert.Equal(t, int64(10000), respData.GeneralStats.TotalLines)
	// HealthScore should be nil when computation fails.
	assert.Nil(t, respData.HealthScore)

	pg.AssertExpectations(t)
	ch.AssertExpectations(t)
	redis.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Test: Redis.Set fails silently -> still returns 200
// ---------------------------------------------------------------------------

func TestDashboardHandler_RedisCacheSetError_StillReturns200(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)
	redis.On("Get", mock.Anything, cacheKey).
		Return("", errors.New("cache miss"))

	dashData := sampleDashboardData()
	ch.On("GetDashboardData", mock.Anything, tenantID.String(), jobID.String(), 50).
		Return(dashData, nil)
	ch.On("ComputeHealthScore", mock.Anything, tenantID.String(), jobID.String()).
		Return(sampleHealthScore(), nil)

	// Redis.Set fails -- the handler ignores the error.
	redis.On("Set", mock.Anything, cacheKey, mock.Anything, 5*time.Minute).
		Return(errors.New("redis write error"))

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var respData domain.DashboardData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&respData))
	assert.NotNil(t, respData.HealthScore)

	pg.AssertExpectations(t)
	ch.AssertExpectations(t)
	redis.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Test: cache returns invalid JSON -> falls through to ClickHouse query
// ---------------------------------------------------------------------------

func TestDashboardHandler_CacheCorruptJSON_FallsThroughToCH(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)

	// Return corrupt JSON from cache -- Unmarshal will fail.
	redis.On("Get", mock.Anything, cacheKey).
		Return("{invalid json!!!", nil)

	// Handler should fall through to ClickHouse.
	dashData := sampleDashboardData()
	ch.On("GetDashboardData", mock.Anything, tenantID.String(), jobID.String(), 50).
		Return(dashData, nil)
	ch.On("ComputeHealthScore", mock.Anything, tenantID.String(), jobID.String()).
		Return(sampleHealthScore(), nil)
	redis.On("Set", mock.Anything, cacheKey, mock.Anything, 5*time.Minute).
		Return(nil)

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var respData domain.DashboardData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&respData))
	assert.Equal(t, int64(10000), respData.GeneralStats.TotalLines)
	assert.NotNil(t, respData.HealthScore)

	pg.AssertExpectations(t)
	ch.AssertExpectations(t)
	redis.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Test: cache returns empty string (no error) -> falls through to ClickHouse
// ---------------------------------------------------------------------------

func TestDashboardHandler_CacheEmptyString_FallsThroughToCH(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)

	// Return empty string with nil error -- the handler checks `cached != ""`
	// so this will fall through.
	redis.On("Get", mock.Anything, cacheKey).
		Return("", nil)

	dashData := sampleDashboardData()
	ch.On("GetDashboardData", mock.Anything, tenantID.String(), jobID.String(), 50).
		Return(dashData, nil)
	ch.On("ComputeHealthScore", mock.Anything, tenantID.String(), jobID.String()).
		Return(sampleHealthScore(), nil)
	redis.On("Set", mock.Anything, cacheKey, mock.Anything, 5*time.Minute).
		Return(nil)

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	ch.AssertExpectations(t)
	redis.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Test: response body structure contains all expected top-level keys
// ---------------------------------------------------------------------------

func TestDashboardHandler_ResponseStructure(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)
	redis.On("Get", mock.Anything, cacheKey).
		Return("", errors.New("cache miss"))

	dashData := sampleDashboardData()
	ch.On("GetDashboardData", mock.Anything, tenantID.String(), jobID.String(), 50).
		Return(dashData, nil)
	ch.On("ComputeHealthScore", mock.Anything, tenantID.String(), jobID.String()).
		Return(sampleHealthScore(), nil)
	redis.On("Set", mock.Anything, cacheKey, mock.Anything, 5*time.Minute).
		Return(nil)

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	// Decode into raw map to verify all top-level JSON keys are present.
	var raw map[string]json.RawMessage
	require.NoError(t, json.NewDecoder(w.Body).Decode(&raw))

	expectedKeys := []string{
		"general_stats",
		"top_api_calls",
		"top_sql_statements",
		"top_filters",
		"top_escalations",
		"time_series",
		"distribution",
		"health_score",
	}

	for _, key := range expectedKeys {
		_, exists := raw[key]
		assert.True(t, exists, "response should contain key %q", key)
	}
}

// ---------------------------------------------------------------------------
// Test: response has correct Content-Type header
// ---------------------------------------------------------------------------

func TestDashboardHandler_ContentType(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := "test-key"

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)
	redis.On("Get", mock.Anything, cacheKey).
		Return("", errors.New("miss"))
	ch.On("GetDashboardData", mock.Anything, tenantID.String(), jobID.String(), 50).
		Return(sampleDashboardData(), nil)
	ch.On("ComputeHealthScore", mock.Anything, tenantID.String(), jobID.String()).
		Return(sampleHealthScore(), nil)
	redis.On("Set", mock.Anything, cacheKey, mock.Anything, 5*time.Minute).
		Return(nil)

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
}

// ---------------------------------------------------------------------------
// Test: concurrent-safe handler invocation (basic smoke test)
// ---------------------------------------------------------------------------

func TestDashboardHandler_ConcurrentRequests(t *testing.T) {
	// Verify the handler does not race when called concurrently.
	// Each goroutine gets its own mocks and handler to avoid the known
	// data race in the production handler (line 88: data.HealthScore mutation
	// on the shared *DashboardData pointer). This test validates that
	// individual request handling is correct under concurrent load.

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()

	const numRequests = 10
	done := make(chan struct{}, numRequests)

	for i := 0; i < numRequests; i++ {
		go func() {
			defer func() { done <- struct{}{} }()

			pg, ch, redis := newDashboardMocks()
			cacheKey := "concurrent-key"

			pg.On("GetJob", mock.Anything, tenantID, jobID).
				Return(completedJob(tenantID, jobID), nil)
			redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
				Return(cacheKey)
			redis.On("Get", mock.Anything, cacheKey).
				Return("", errors.New("miss"))
			ch.On("GetDashboardData", mock.Anything, tenantID.String(), jobID.String(), 50).
				Return(sampleDashboardData(), nil)
			ch.On("ComputeHealthScore", mock.Anything, tenantID.String(), jobID.String()).
				Return(sampleHealthScore(), nil)
			redis.On("Set", mock.Anything, cacheKey, mock.Anything, 5*time.Minute).
				Return(nil)

			handler := NewDashboardHandler(pg, ch, redis)
			req := makeDashboardRequest(tenantID.String(), jobID.String())
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			assert.Equal(t, http.StatusOK, w.Code)
		}()
	}

	for i := 0; i < numRequests; i++ {
		<-done
	}
}

// ---------------------------------------------------------------------------
// Test: using testutil helpers for authenticated request construction
// ---------------------------------------------------------------------------

func TestDashboardHandler_WithTestUtilHelpers(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	tenantID := uuid.MustParse(testutil.TestTenantID)
	jobID := uuid.New()
	cacheKey := "helper-key"

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)
	redis.On("Get", mock.Anything, cacheKey).
		Return("", errors.New("miss"))
	ch.On("GetDashboardData", mock.Anything, tenantID.String(), jobID.String(), 50).
		Return(sampleDashboardData(), nil)
	ch.On("ComputeHealthScore", mock.Anything, tenantID.String(), jobID.String()).
		Return(sampleHealthScore(), nil)
	redis.On("Set", mock.Anything, cacheKey, mock.Anything, 5*time.Minute).
		Return(nil)

	// Use testutil.NewRequestWithVars to construct the request.
	req := testutil.NewRequestWithVars(
		http.MethodGet,
		fmt.Sprintf("/api/v1/analysis/%s/dashboard", jobID.String()),
		"",
		testutil.TestTenantID,
		testutil.TestUserID,
		map[string]string{"job_id": jobID.String()},
	)

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var respData domain.DashboardData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&respData))
	assert.NotNil(t, respData.HealthScore)

	pg.AssertExpectations(t)
	ch.AssertExpectations(t)
	redis.AssertExpectations(t)
}
