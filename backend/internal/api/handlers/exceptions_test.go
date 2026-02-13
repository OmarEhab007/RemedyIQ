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

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
)

func TestExceptionsHandler_ServeHTTP(t *testing.T) {
	tenantID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	jobID := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	now := time.Now()

	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}

	parsingJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusParsing,
		CreatedAt: now,
		UpdatedAt: now,
	}

	sampleResponse := &domain.ExceptionsResponse{
		Exceptions: []domain.ExceptionEntry{
			{ErrorCode: "ARERR-500", Message: "timeout", Count: 12},
		},
		TotalCount: 12,
		ErrorRates: map[string]float64{"API": 0.05},
		TopCodes:   []string{"ARERR-500"},
	}

	cachedJSON, err := json.Marshal(sampleResponse)
	require.NoError(t, err)

	tests := []struct {
		name           string
		tenantID       string
		jobIDStr       string
		setupMocks     func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore, redis *testutil.MockRedisCache)
		expectedStatus int
		checkBody      func(t *testing.T, body []byte)
	}{
		{
			name:     "cache_miss_queries_clickhouse_returns_200",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore, redis *testutil.MockRedisCache) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)
				cacheKey := fmt.Sprintf("tenant:%s:exceptions:%s", tenantID.String(), jobID.String())
				redis.On("TenantKey", tenantID.String(), "exceptions", jobID.String()).Return(cacheKey)
				redis.On("Get", mock.Anything, cacheKey).Return("", errors.New("cache miss"))
				ch.On("GetExceptions", mock.Anything, tenantID.String(), jobID.String()).Return(sampleResponse, nil)
				redis.On("Set", mock.Anything, cacheKey, sampleResponse, 5*time.Minute).Return(nil)
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp domain.ExceptionsResponse
				require.NoError(t, json.Unmarshal(body, &resp))
				assert.Equal(t, int64(12), resp.TotalCount)
				assert.Len(t, resp.Exceptions, 1)
				assert.Equal(t, "ARERR-500", resp.Exceptions[0].ErrorCode)
			},
		},
		{
			name:     "cache_hit_returns_200_with_cached_data",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore, redis *testutil.MockRedisCache) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)
				cacheKey := fmt.Sprintf("tenant:%s:exceptions:%s", tenantID.String(), jobID.String())
				redis.On("TenantKey", tenantID.String(), "exceptions", jobID.String()).Return(cacheKey)
				redis.On("Get", mock.Anything, cacheKey).Return(string(cachedJSON), nil)
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp domain.ExceptionsResponse
				require.NoError(t, json.Unmarshal(body, &resp))
				assert.Equal(t, int64(12), resp.TotalCount)
				assert.Len(t, resp.Exceptions, 1)
			},
		},
		{
			name:     "missing_tenant_returns_401",
			tenantID: "",
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore, redis *testutil.MockRedisCache) {
				// No mocks needed; handler exits early.
			},
			expectedStatus: http.StatusUnauthorized,
			checkBody: func(t *testing.T, body []byte) {
				assert.Contains(t, string(body), "missing tenant context")
			},
		},
		{
			name:     "invalid_job_id_returns_400",
			tenantID: tenantID.String(),
			jobIDStr: "not-a-uuid",
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore, redis *testutil.MockRedisCache) {
				// No mocks needed; handler exits early.
			},
			expectedStatus: http.StatusBadRequest,
			checkBody: func(t *testing.T, body []byte) {
				assert.Contains(t, string(body), "invalid job_id format")
			},
		},
		{
			name:     "job_not_found_returns_404",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore, redis *testutil.MockRedisCache) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(nil, fmt.Errorf("not found"))
			},
			expectedStatus: http.StatusNotFound,
			checkBody: func(t *testing.T, body []byte) {
				assert.Contains(t, string(body), "analysis job not found")
			},
		},
		{
			name:     "job_not_complete_returns_409",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore, redis *testutil.MockRedisCache) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(parsingJob, nil)
			},
			expectedStatus: http.StatusConflict,
			checkBody: func(t *testing.T, body []byte) {
				assert.Contains(t, string(body), "analysis is not yet complete")
			},
		},
		{
			name:     "clickhouse_error_returns_500",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore, redis *testutil.MockRedisCache) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)
				cacheKey := fmt.Sprintf("tenant:%s:exceptions:%s", tenantID.String(), jobID.String())
				redis.On("TenantKey", tenantID.String(), "exceptions", jobID.String()).Return(cacheKey)
				redis.On("Get", mock.Anything, cacheKey).Return("", errors.New("cache miss"))
				ch.On("GetExceptions", mock.Anything, tenantID.String(), jobID.String()).Return(nil, fmt.Errorf("clickhouse connection failed"))
			},
			expectedStatus: http.StatusInternalServerError,
			checkBody: func(t *testing.T, body []byte) {
				assert.Contains(t, string(body), "failed to retrieve exceptions data")
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pg := new(testutil.MockPostgresStore)
			ch := new(testutil.MockClickHouseStore)
			redis := new(testutil.MockRedisCache)
			tc.setupMocks(pg, ch, redis)

			handler := NewExceptionsHandler(pg, ch, redis)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+tc.jobIDStr+"/dashboard/exceptions", nil)
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
			ch.AssertExpectations(t)
			redis.AssertExpectations(t)
		})
	}
}
