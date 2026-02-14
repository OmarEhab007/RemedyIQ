package handlers

import (
	"bytes"
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
// Helper: build a sample dashboard JSON string for Redis mock responses.
// ---------------------------------------------------------------------------

func sampleDashboardJSON() string {
	dashboard := domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			TotalLines:  10000,
			APICount:    500,
			SQLCount:    1200,
			FilterCount: 300,
			EscCount:    50,
			UniqueUsers: 5,
			UniqueForms: 12,
			LogDuration: "02:30:00",
		},
		TopAPICalls: []domain.TopNEntry{
			{Rank: 1, Identifier: "GetEntry", Form: "HPD:Help Desk", DurationMS: 5000, Success: true},
		},
		TopSQL: []domain.TopNEntry{
			{Rank: 1, Identifier: "SELECT * FROM t", DurationMS: 3000, Success: true},
		},
	}
	b, _ := json.Marshal(dashboard)
	return string(b)
}

// setupRedisForReport configures the mock Redis to return cached dashboard data.
func setupRedisForReport(redis *testutil.MockRedisCache, tenantID, jobID string) {
	cacheKey := tenantID + ":dashboard:" + jobID
	redis.On("TenantKey", tenantID, "dashboard", jobID).Return(cacheKey)
	redis.On("Get", mock.Anything, cacheKey).Return(sampleDashboardJSON(), nil)

	// Section caches — return empty so getOrCompute falls through to compute.
	redis.On("Get", mock.Anything, cacheKey+":agg").Return("", errors.New("miss"))
	redis.On("Get", mock.Anything, cacheKey+":exc").Return("", errors.New("miss"))
	redis.On("Get", mock.Anything, cacheKey+":gaps").Return("", errors.New("miss"))
	redis.On("Get", mock.Anything, cacheKey+":threads").Return("", errors.New("miss"))
	redis.On("Get", mock.Anything, cacheKey+":filters").Return("", errors.New("miss"))

	// Allow Set calls for computed sections.
	redis.On("Set", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Maybe()
}

// setupRedisForReportCacheMiss configures Redis to return cache miss for dashboard.
func setupRedisForReportCacheMiss(redis *testutil.MockRedisCache, tenantID, jobID string) {
	cacheKey := tenantID + ":dashboard:" + jobID
	redis.On("TenantKey", tenantID, "dashboard", jobID).Return(cacheKey)
	redis.On("Get", mock.Anything, cacheKey).Return("", errors.New("miss"))
}

// ---------------------------------------------------------------------------
// ReportHandler tests
// ---------------------------------------------------------------------------

func TestReportHandler_MissingTenantContext(t *testing.T) {
	h := NewReportHandler(nil, nil)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/report", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
	assert.Contains(t, errResp.Message, "missing tenant context")
}

func TestReportHandler_InvalidJobID(t *testing.T) {
	h := NewReportHandler(nil, nil)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/not-a-uuid/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "550e8400-e29b-41d4-a716-446655440000")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "not-a-uuid"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "job_id")
}

func TestReportHandler_InvalidFormat(t *testing.T) {
	pg := new(testutil.MockPostgresStore)
	redis := new(testutil.MockRedisCache)
	h := NewReportHandler(pg, redis)

	body := `{"format":"pdf"}`
	jobID := uuid.New()
	tenantID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "format")
}

func TestReportHandler_InvalidFormat_XML(t *testing.T) {
	pg := new(testutil.MockPostgresStore)
	redis := new(testutil.MockRedisCache)
	h := NewReportHandler(pg, redis)

	body := `{"format":"xml"}`
	jobID := uuid.New()
	tenantID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestReportHandler_DefaultFormatHTML(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)

	redis := new(testutil.MockRedisCache)
	setupRedisForReport(redis, tenantID.String(), jobID.String())

	h := NewReportHandler(pg, redis)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString("{}"))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp reportResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "html", resp.Format)
	assert.Equal(t, jobID.String(), resp.JobID)
	assert.Equal(t, "report_generator", resp.Skill)
	assert.NotEmpty(t, resp.Content)
	assert.NotEmpty(t, resp.Generated)

	pg.AssertExpectations(t)
}

func TestReportHandler_InvalidTenantIDFormat(t *testing.T) {
	pg := new(testutil.MockPostgresStore)
	redis := new(testutil.MockRedisCache)
	h := NewReportHandler(pg, redis)

	jobID := uuid.New()
	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "not-a-valid-uuid")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "tenant_id")
}

func TestReportHandler_InvalidJSONBody(t *testing.T) {
	pg := new(testutil.MockPostgresStore)
	redis := new(testutil.MockRedisCache)
	h := NewReportHandler(pg, redis)

	jobID := uuid.New()
	tenantID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString("{invalid"))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Contains(t, errResp.Message, "invalid JSON")
}

func TestReportHandler_JobNotFound(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()

	pg := new(testutil.MockPostgresStore)
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(nil, fmt.Errorf("not found"))

	redis := new(testutil.MockRedisCache)
	h := NewReportHandler(pg, redis)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeNotFound, errResp.Code)
	assert.Contains(t, errResp.Message, "not found")

	pg.AssertExpectations(t)
}

func TestReportHandler_JobGetInternalError(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()

	pg := new(testutil.MockPostgresStore)
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(nil, errors.New("database connection timeout"))

	redis := new(testutil.MockRedisCache)
	h := NewReportHandler(pg, redis)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInternalError, errResp.Code)
	assert.Contains(t, errResp.Message, "failed to retrieve analysis job")

	pg.AssertExpectations(t)
}

func TestReportHandler_JobNotComplete(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	parsingJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusParsing,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(parsingJob, nil)

	redis := new(testutil.MockRedisCache)
	h := NewReportHandler(pg, redis)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "not yet complete")

	pg.AssertExpectations(t)
}

func TestReportHandler_JobQueued_Returns409(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	queuedJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusQueued,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(queuedJob, nil)

	redis := new(testutil.MockRedisCache)
	h := NewReportHandler(pg, redis)

	body := `{"format":"json"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)

	pg.AssertExpectations(t)
}

func TestReportHandler_CacheMiss_Returns500(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)

	redis := new(testutil.MockRedisCache)
	setupRedisForReportCacheMiss(redis, tenantID.String(), jobID.String())

	h := NewReportHandler(pg, redis)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Contains(t, errResp.Message, "report generation failed")

	pg.AssertExpectations(t)
}

func TestReportHandler_SuccessHTML(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)

	redis := new(testutil.MockRedisCache)
	setupRedisForReport(redis, tenantID.String(), jobID.String())

	h := NewReportHandler(pg, redis)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp reportResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, jobID.String(), resp.JobID)
	assert.Equal(t, "html", resp.Format)
	assert.Contains(t, resp.Content, "RemedyIQ Log Analysis Report")
	assert.Contains(t, resp.Content, jobID.String())
	assert.Equal(t, "report_generator", resp.Skill)
	assert.NotEmpty(t, resp.Generated)

	// Verify generated_at is a valid RFC3339 timestamp.
	_, err := time.Parse(time.RFC3339, resp.Generated)
	assert.NoError(t, err)

	// Verify HTML contains actual data from the dashboard.
	assert.Contains(t, resp.Content, "10000")  // TotalLines
	assert.Contains(t, resp.Content, "GetEntry") // Top API call

	pg.AssertExpectations(t)
}

func TestReportHandler_SuccessJSON(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)

	redis := new(testutil.MockRedisCache)
	setupRedisForReport(redis, tenantID.String(), jobID.String())

	h := NewReportHandler(pg, redis)

	body := `{"format":"json"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp reportResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "json", resp.Format)
	assert.Equal(t, jobID.String(), resp.JobID)
	assert.Equal(t, "report_generator", resp.Skill)
	assert.NotEmpty(t, resp.Content)

	// Verify the content is valid JSON with expected fields.
	var reportJSON map[string]any
	require.NoError(t, json.Unmarshal([]byte(resp.Content), &reportJSON))
	assert.Equal(t, jobID.String(), reportJSON["job_id"])
	assert.NotNil(t, reportJSON["dashboard"])

	pg.AssertExpectations(t)
}

func TestReportHandler_EmptyBody_DefaultsToHTML(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)

	redis := new(testutil.MockRedisCache)
	setupRedisForReport(redis, tenantID.String(), jobID.String())

	h := NewReportHandler(pg, redis)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(""))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp reportResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "html", resp.Format)

	pg.AssertExpectations(t)
}

func TestReportHandler_TableDriven(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}

	failedJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusFailed,
		CreatedAt: now,
		UpdatedAt: now,
	}

	tests := []struct {
		name           string
		tenantID       string
		jobIDStr       string
		body           string
		setupMocks     func(pg *testutil.MockPostgresStore, redis *testutil.MockRedisCache)
		expectedStatus int
		checkBody      func(t *testing.T, body []byte)
	}{
		{
			name:     "missing_tenant_returns_401",
			tenantID: "",
			jobIDStr: jobID.String(),
			body:     `{"format":"html"}`,
			setupMocks: func(_ *testutil.MockPostgresStore, _ *testutil.MockRedisCache) {
			},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:     "invalid_job_id_returns_400",
			tenantID: tenantID.String(),
			jobIDStr: "bad-uuid",
			body:     `{"format":"html"}`,
			setupMocks: func(_ *testutil.MockPostgresStore, _ *testutil.MockRedisCache) {
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:     "invalid_format_returns_400",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			body:     `{"format":"csv"}`,
			setupMocks: func(_ *testutil.MockPostgresStore, _ *testutil.MockRedisCache) {
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:     "job_not_found_returns_404",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			body:     `{"format":"html"}`,
			setupMocks: func(pg *testutil.MockPostgresStore, _ *testutil.MockRedisCache) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(nil, fmt.Errorf("not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:     "failed_job_returns_409",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			body:     `{"format":"html"}`,
			setupMocks: func(pg *testutil.MockPostgresStore, _ *testutil.MockRedisCache) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(failedJob, nil)
			},
			expectedStatus: http.StatusConflict,
		},
		{
			name:     "cache_miss_returns_500",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			body:     `{"format":"html"}`,
			setupMocks: func(pg *testutil.MockPostgresStore, redis *testutil.MockRedisCache) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)
				setupRedisForReportCacheMiss(redis, tenantID.String(), jobID.String())
			},
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:     "success_returns_200",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			body:     `{"format":"json"}`,
			setupMocks: func(pg *testutil.MockPostgresStore, redis *testutil.MockRedisCache) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)
				setupRedisForReport(redis, tenantID.String(), jobID.String())
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp reportResponse
				require.NoError(t, json.Unmarshal(body, &resp))
				assert.Equal(t, jobID.String(), resp.JobID)
				assert.Equal(t, "json", resp.Format)
				assert.Equal(t, "report_generator", resp.Skill)
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pg := new(testutil.MockPostgresStore)
			redis := new(testutil.MockRedisCache)
			tc.setupMocks(pg, redis)

			handler := NewReportHandler(pg, redis)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+tc.jobIDStr+"/report", bytes.NewBufferString(tc.body))
			if tc.tenantID != "" {
				ctx := middleware.WithTenantID(req.Context(), tc.tenantID)
				ctx = middleware.WithUserID(ctx, "test-user")
				req = req.WithContext(ctx)
			}
			req = mux.SetURLVars(req, map[string]string{"job_id": tc.jobIDStr})

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)
			if tc.checkBody != nil {
				tc.checkBody(t, w.Body.Bytes())
			}

			pg.AssertExpectations(t)
		})
	}
}
