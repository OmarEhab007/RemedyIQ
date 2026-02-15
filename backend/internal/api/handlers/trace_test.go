package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

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
// TraceHandler tests
// ---------------------------------------------------------------------------

func TestTraceHandler_MissingTenantContext(t *testing.T) {
	h := NewTraceHandler(nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/job-1/trace/T001", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
	assert.Contains(t, errResp.Message, "missing tenant context")
}

func TestTraceHandler_InvalidJobID(t *testing.T) {
	h := NewTraceHandler(nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/not-a-uuid/trace/T001", nil)
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "not-a-uuid", "trace_id": "T001"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "job_id")
}

func TestTraceHandler_EmptyTraceID(t *testing.T) {
	h := NewTraceHandler(nil)

	jobID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/trace/", nil)
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String(), "trace_id": ""})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "trace_id")
}

func TestTraceHandler_SearchError(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewTraceHandler(mockCH)

	jobID := uuid.New()
	traceID := "T001"
	tenantID := "test-tenant"

	mockCH.On("GetTraceEntries", mock.Anything, tenantID, jobID.String(), traceID).
		Return(nil, errors.New("clickhouse error"))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/trace/"+traceID, nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String(), "trace_id": traceID})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInternalError, errResp.Code)
	assert.Contains(t, errResp.Message, "trace search failed")

	mockCH.AssertExpectations(t)
}

func TestTraceHandler_EmptyResults(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewTraceHandler(mockCH)

	jobID := uuid.New()
	traceID := "T-nonexistent"
	tenantID := "test-tenant"

	mockCH.On("GetTraceEntries", mock.Anything, tenantID, jobID.String(), traceID).
		Return([]domain.LogEntry{}, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/trace/"+traceID, nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String(), "trace_id": traceID})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, traceID, resp["trace_id"])
	assert.Equal(t, float64(0), resp["entry_count"])
	assert.Equal(t, float64(0), resp["total_duration"])
	entries := resp["entries"].([]interface{})
	assert.Len(t, entries, 0)

	mockCH.AssertExpectations(t)
}

func TestTraceHandler_SuccessWithResults(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewTraceHandler(mockCH)

	jobID := uuid.New()
	traceID := "T001"
	tenantID := "test-tenant"

	entries := []domain.LogEntry{
		{
			EntryID:    "entry-1",
			TraceID:    traceID,
			JobID:      jobID.String(),
			LogType:    domain.LogTypeAPI,
			DurationMS: 150,
		},
		{
			EntryID:    "entry-2",
			TraceID:    traceID,
			JobID:      jobID.String(),
			LogType:    domain.LogTypeSQL,
			DurationMS: 300,
		},
		{
			EntryID:    "entry-3",
			TraceID:    traceID,
			JobID:      jobID.String(),
			LogType:    domain.LogTypeFilter,
			DurationMS: 50,
		},
	}
	mockCH.On("GetTraceEntries", mock.Anything, tenantID, jobID.String(), traceID).
		Return(entries, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/trace/"+traceID, nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String(), "trace_id": traceID})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")

	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))

	assert.Equal(t, traceID, resp["trace_id"])
	assert.Equal(t, float64(3), resp["entry_count"])
	// total_duration = 150 + 300 + 50 = 500
	assert.Equal(t, float64(500), resp["total_duration"])

	respEntries := resp["entries"].([]interface{})
	require.Len(t, respEntries, 3)

	// Verify first entry structure.
	firstEntry := respEntries[0].(map[string]interface{})
	assert.Equal(t, "entry-1", firstEntry["id"])
	fields := firstEntry["fields"].(map[string]interface{})
	assert.Equal(t, "API", fields["log_type"])
	assert.Equal(t, float64(150), fields["duration_ms"])

	mockCH.AssertExpectations(t)
}

func TestTraceHandler_TableDriven(t *testing.T) {
	validJobID := uuid.New()
	traceID := "trace-123"
	tenantID := "00000000-0000-0000-0000-000000000001"

	tests := []struct {
		name           string
		tenantID       string
		jobIDStr       string
		traceID        string
		setupMock      func(m *testutil.MockClickHouseStore)
		expectedStatus int
		checkBody      func(t *testing.T, body []byte)
	}{
		{
			name:           "missing_tenant_returns_401",
			tenantID:       "",
			jobIDStr:       validJobID.String(),
			traceID:        traceID,
			setupMock:      func(_ *testutil.MockClickHouseStore) {},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "invalid_job_id_returns_400",
			tenantID:       tenantID,
			jobIDStr:       "invalid",
			traceID:        traceID,
			setupMock:      func(_ *testutil.MockClickHouseStore) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "empty_trace_id_returns_400",
			tenantID:       tenantID,
			jobIDStr:       validJobID.String(),
			traceID:        "",
			setupMock:      func(_ *testutil.MockClickHouseStore) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:     "search_error_returns_500",
			tenantID: tenantID,
			jobIDStr: validJobID.String(),
			traceID:  traceID,
			setupMock: func(m *testutil.MockClickHouseStore) {
				m.On("GetTraceEntries", mock.Anything, tenantID, validJobID.String(), traceID).
					Return(nil, errors.New("search failed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:     "success_returns_200",
			tenantID: tenantID,
			jobIDStr: validJobID.String(),
			traceID:  traceID,
			setupMock: func(m *testutil.MockClickHouseStore) {
				m.On("GetTraceEntries", mock.Anything, tenantID, validJobID.String(), traceID).
					Return([]domain.LogEntry{
						{EntryID: "e1", DurationMS: 42},
					}, nil)
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp map[string]interface{}
				require.NoError(t, json.Unmarshal(body, &resp))
				assert.Equal(t, traceID, resp["trace_id"])
				assert.Equal(t, float64(1), resp["entry_count"])
				assert.Equal(t, float64(42), resp["total_duration"])
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mockCH := new(testutil.MockClickHouseStore)
			tc.setupMock(mockCH)

			handler := NewTraceHandler(mockCH)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+tc.jobIDStr+"/trace/"+tc.traceID, nil)
			if tc.tenantID != "" {
				ctx := middleware.WithTenantID(req.Context(), tc.tenantID)
				ctx = middleware.WithUserID(ctx, "test-user")
				req = req.WithContext(ctx)
			}
			req = mux.SetURLVars(req, map[string]string{"job_id": tc.jobIDStr, "trace_id": tc.traceID})

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)
			if tc.checkBody != nil {
				tc.checkBody(t, w.Body.Bytes())
			}

			mockCH.AssertExpectations(t)
		})
	}
}
