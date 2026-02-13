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

func newDashboardMocks() (*testutil.MockPostgresStore, *testutil.MockClickHouseStore, *testutil.MockRedisCache) {
	return new(testutil.MockPostgresStore), new(testutil.MockClickHouseStore), new(testutil.MockRedisCache)
}

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

func TestDashboardHandler_MissingTenantContext(t *testing.T) {
	pg, ch, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, ch, redis)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dashboard", nil)
	req = mux.SetURLVars(req, map[string]string{"job_id": "550e8400-e29b-41d4-a716-446655440000"})

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
	assert.Contains(t, errResp.Message, "missing tenant context")

	pg.AssertNotCalled(t, "GetJob")
	redis.AssertNotCalled(t, "Get")
}

func TestDashboardHandler_InvalidJobID(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

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

func TestDashboardHandler_EmptyJobID(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

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

func TestDashboardHandler_InvalidTenantIDFormat(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

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

func TestDashboardHandler_JobNotFound(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()

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
	redis.AssertNotCalled(t, "Get")
}

func TestDashboardHandler_PostgresGenericError(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

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

func TestDashboardHandler_JobNotComplete(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

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
}

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
			pg, _, redis := newDashboardMocks()
			handler := NewDashboardHandler(pg, nil, redis)

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
		})
	}
}

func TestDashboardHandler_CacheHit(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)

	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)

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
}

func TestDashboardHandler_CacheMiss_Returns500(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)

	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)

	redis.On("Get", mock.Anything, cacheKey).
		Return("", errors.New("cache miss"))

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInternalError, errResp.Code)
	assert.Contains(t, errResp.Message, "dashboard data not available")

	pg.AssertExpectations(t)
	redis.AssertExpectations(t)
}

func TestDashboardHandler_CacheCorruptJSON_Returns500(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)

	redis.On("Get", mock.Anything, cacheKey).
		Return("{invalid json!!!", nil)

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInternalError, errResp.Code)
	assert.Contains(t, errResp.Message, "failed to parse dashboard data")

	pg.AssertExpectations(t)
	redis.AssertExpectations(t)
}

func TestDashboardHandler_CacheEmptyString_Returns500(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)

	redis.On("Get", mock.Anything, cacheKey).
		Return("", nil)

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	pg.AssertExpectations(t)
	redis.AssertExpectations(t)
}

func TestDashboardHandler_ResponseStructure(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)

	cachedData := sampleDashboardData()
	cachedData.HealthScore = sampleHealthScore()
	cachedJSON, err := json.Marshal(cachedData)
	require.NoError(t, err)
	redis.On("Get", mock.Anything, cacheKey).
		Return(string(cachedJSON), nil)

	req := makeDashboardRequest(tenantID.String(), jobID.String())

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

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

	pg.AssertExpectations(t)
	redis.AssertExpectations(t)
}

func TestDashboardHandler_ContentType(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()
	cacheKey := "test-key"

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)

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
}

func TestDashboardHandler_ConcurrentRequests(t *testing.T) {
	tenantID := uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")
	jobID := uuid.New()

	const numRequests = 10
	done := make(chan struct{}, numRequests)

	for i := 0; i < numRequests; i++ {
		go func() {
			defer func() { done <- struct{}{} }()

			pg, _, redis := newDashboardMocks()
			cacheKey := "concurrent-key"

			pg.On("GetJob", mock.Anything, tenantID, jobID).
				Return(completedJob(tenantID, jobID), nil)
			redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
				Return(cacheKey)

			cachedData := sampleDashboardData()
			cachedData.HealthScore = sampleHealthScore()
			cachedJSON, _ := json.Marshal(cachedData)
			redis.On("Get", mock.Anything, cacheKey).
				Return(string(cachedJSON), nil)

			handler := NewDashboardHandler(pg, nil, redis)
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

func TestDashboardHandler_WithTestUtilHelpers(t *testing.T) {
	pg, _, redis := newDashboardMocks()
	handler := NewDashboardHandler(pg, nil, redis)

	tenantID := uuid.MustParse(testutil.TestTenantID)
	jobID := uuid.New()
	cacheKey := "helper-key"

	pg.On("GetJob", mock.Anything, tenantID, jobID).
		Return(completedJob(tenantID, jobID), nil)
	redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).
		Return(cacheKey)

	cachedData := sampleDashboardData()
	cachedData.HealthScore = sampleHealthScore()
	cachedJSON, err := json.Marshal(cachedData)
	require.NoError(t, err)
	redis.On("Get", mock.Anything, cacheKey).
		Return(string(cachedJSON), nil)

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
	redis.AssertExpectations(t)
}
