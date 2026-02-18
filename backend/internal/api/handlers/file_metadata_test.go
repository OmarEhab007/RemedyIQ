package handlers

import (
	"encoding/json"
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

func TestFileMetadataHandler_ServeHTTP(t *testing.T) {
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

	sampleResponse := &domain.FileMetadataResponse{
		JobID: jobID.String(),
		Files: []domain.FileMetadata{
			{
				FileNumber: 1,
				FileName:   "arserver_20260203.log",
				StartTime:  time.Date(2026, 2, 3, 10, 0, 0, 0, time.UTC),
				EndTime:    time.Date(2026, 2, 3, 14, 0, 0, 0, time.UTC),
				DurationMS: 14400000,
			},
			{
				FileNumber: 2,
				FileName:   "arserver_20260204.log",
				StartTime:  time.Date(2026, 2, 4, 8, 0, 0, 0, time.UTC),
				EndTime:    time.Date(2026, 2, 4, 16, 30, 0, 0, time.UTC),
				DurationMS: 30600000,
			},
		},
		Total: 2,
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
			name:     "cache_hit_returns_200_with_file_metadata",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore, redis *testutil.MockRedisCache) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)
				baseKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())
				redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).Return(baseKey)
				redis.On("Get", mock.Anything, baseKey+":file-metadata").Return(string(cachedJSON), nil)
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp domain.FileMetadataResponse
				require.NoError(t, json.Unmarshal(body, &resp))
				assert.Len(t, resp.Files, 2)
				assert.Equal(t, 2, resp.Total)
				assert.Equal(t, "arserver_20260203.log", resp.Files[0].FileName)
				assert.Equal(t, 1, resp.Files[0].FileNumber)
			},
		},
		{
			name:     "cache_miss_returns_empty_array",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore, redis *testutil.MockRedisCache) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)
				baseKey := fmt.Sprintf("tenant:%s:dashboard:%s", tenantID.String(), jobID.String())
				redis.On("TenantKey", tenantID.String(), "dashboard", jobID.String()).Return(baseKey)
				redis.On("Get", mock.Anything, baseKey+":file-metadata").Return("", fmt.Errorf("cache miss"))
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp domain.FileMetadataResponse
				require.NoError(t, json.Unmarshal(body, &resp))
				assert.Empty(t, resp.Files)
				assert.Equal(t, 0, resp.Total)
			},
		},
		{
			name:     "missing_tenant_returns_401",
			tenantID: "",
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore, redis *testutil.MockRedisCache) {
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
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pg := new(testutil.MockPostgresStore)
			ch := new(testutil.MockClickHouseStore)
			redis := new(testutil.MockRedisCache)
			tc.setupMocks(pg, ch, redis)

			handler := NewFileMetadataHandler(pg, ch, redis)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+tc.jobIDStr+"/dashboard/file-metadata", nil)
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
			redis.AssertExpectations(t)
		})
	}
}
