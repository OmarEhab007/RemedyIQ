package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/blevesearch/bleve/v2"
	bleveSearch "github.com/blevesearch/bleve/v2/search"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
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
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewTraceHandler(mockSearcher)

	jobID := uuid.New()
	traceID := "T001"
	tenantID := "test-tenant"

	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(nil, errors.New("index corrupted"))

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

	mockSearcher.AssertExpectations(t)
}

func TestTraceHandler_EmptyResults(t *testing.T) {
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewTraceHandler(mockSearcher)

	jobID := uuid.New()
	traceID := "T-nonexistent"
	tenantID := "test-tenant"

	emptyResult := &bleve.SearchResult{
		Hits:  bleveSearch.DocumentMatchCollection{},
		Total: 0,
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(emptyResult, nil)

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

	mockSearcher.AssertExpectations(t)
}

func TestTraceHandler_SuccessWithResults(t *testing.T) {
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewTraceHandler(mockSearcher)

	jobID := uuid.New()
	traceID := "T001"
	tenantID := "test-tenant"

	result := &bleve.SearchResult{
		Hits: bleveSearch.DocumentMatchCollection{
			&bleveSearch.DocumentMatch{
				ID:    "entry-1",
				Score: 1.5,
				Fields: map[string]interface{}{
					"trace_id":    traceID,
					"job_id":      jobID.String(),
					"log_type":    "API",
					"duration_ms": float64(150),
				},
			},
			&bleveSearch.DocumentMatch{
				ID:    "entry-2",
				Score: 1.2,
				Fields: map[string]interface{}{
					"trace_id":    traceID,
					"job_id":      jobID.String(),
					"log_type":    "SQL",
					"duration_ms": float64(300),
				},
			},
			&bleveSearch.DocumentMatch{
				ID:    "entry-3",
				Score: 0.8,
				Fields: map[string]interface{}{
					"trace_id":    traceID,
					"job_id":      jobID.String(),
					"log_type":    "FLTR",
					"duration_ms": float64(50),
				},
			},
		},
		Total: 3,
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(result, nil)

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

	entries := resp["entries"].([]interface{})
	require.Len(t, entries, 3)

	// Verify first entry structure.
	firstEntry := entries[0].(map[string]interface{})
	assert.Equal(t, "entry-1", firstEntry["id"])
	assert.Equal(t, 1.5, firstEntry["score"])
	fields := firstEntry["fields"].(map[string]interface{})
	assert.Equal(t, "API", fields["log_type"])
	assert.Equal(t, float64(150), fields["duration_ms"])

	mockSearcher.AssertExpectations(t)
}

func TestTraceHandler_DurationAccumulatesOnlyFloat64(t *testing.T) {
	// Verify that non-float64 duration_ms values are silently skipped.
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewTraceHandler(mockSearcher)

	jobID := uuid.New()
	traceID := "T002"
	tenantID := "test-tenant"

	result := &bleve.SearchResult{
		Hits: bleveSearch.DocumentMatchCollection{
			&bleveSearch.DocumentMatch{
				ID:    "entry-1",
				Score: 1.0,
				Fields: map[string]interface{}{
					"duration_ms": float64(100),
				},
			},
			&bleveSearch.DocumentMatch{
				ID:    "entry-2",
				Score: 1.0,
				Fields: map[string]interface{}{
					// duration_ms as string -- should not be accumulated.
					"duration_ms": "not-a-number",
				},
			},
			&bleveSearch.DocumentMatch{
				ID:    "entry-3",
				Score: 1.0,
				Fields: map[string]interface{}{
					"duration_ms": float64(200),
				},
			},
		},
		Total: 3,
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(result, nil)

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

	// Only entry-1 (100) and entry-3 (200) should be counted.
	assert.Equal(t, float64(300), resp["total_duration"])

	mockSearcher.AssertExpectations(t)
}

func TestTraceHandler_NoDurationField(t *testing.T) {
	// When no entries have duration_ms, total_duration should be 0.
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewTraceHandler(mockSearcher)

	jobID := uuid.New()
	traceID := "T003"
	tenantID := "test-tenant"

	result := &bleve.SearchResult{
		Hits: bleveSearch.DocumentMatchCollection{
			&bleveSearch.DocumentMatch{
				ID:     "entry-1",
				Score:  1.0,
				Fields: map[string]interface{}{"log_type": "API"},
			},
		},
		Total: 1,
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(result, nil)

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
	assert.Equal(t, float64(1), resp["entry_count"])
	assert.Equal(t, float64(0), resp["total_duration"])

	mockSearcher.AssertExpectations(t)
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
		setupMock      func(m *testutil.MockSearchIndexer)
		expectedStatus int
		checkBody      func(t *testing.T, body []byte)
	}{
		{
			name:           "missing_tenant_returns_401",
			tenantID:       "",
			jobIDStr:       validJobID.String(),
			traceID:        traceID,
			setupMock:      func(_ *testutil.MockSearchIndexer) {},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "invalid_job_id_returns_400",
			tenantID:       tenantID,
			jobIDStr:       "invalid",
			traceID:        traceID,
			setupMock:      func(_ *testutil.MockSearchIndexer) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "empty_trace_id_returns_400",
			tenantID:       tenantID,
			jobIDStr:       validJobID.String(),
			traceID:        "",
			setupMock:      func(_ *testutil.MockSearchIndexer) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:     "search_error_returns_500",
			tenantID: tenantID,
			jobIDStr: validJobID.String(),
			traceID:  traceID,
			setupMock: func(m *testutil.MockSearchIndexer) {
				m.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
					Return(nil, errors.New("search failed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:     "success_returns_200",
			tenantID: tenantID,
			jobIDStr: validJobID.String(),
			traceID:  traceID,
			setupMock: func(m *testutil.MockSearchIndexer) {
				result := &bleve.SearchResult{
					Hits: bleveSearch.DocumentMatchCollection{
						&bleveSearch.DocumentMatch{
							ID:     "e1",
							Score:  1.0,
							Fields: map[string]interface{}{"duration_ms": float64(42)},
						},
					},
					Total: 1,
				}
				m.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
					Return(result, nil)
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
			mockSearcher := new(testutil.MockSearchIndexer)
			tc.setupMock(mockSearcher)

			handler := NewTraceHandler(mockSearcher)

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

			mockSearcher.AssertExpectations(t)
		})
	}
}
