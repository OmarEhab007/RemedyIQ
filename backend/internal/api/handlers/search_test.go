package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
)

func setupSearchLogsHandler() (*SearchLogsHandler, *testutil.MockClickHouseStore, *testutil.MockSearchIndexer) {
	mockCH := new(testutil.MockClickHouseStore)
	mockBleve := new(testutil.MockSearchIndexer)
	return NewSearchLogsHandler(mockCH, mockBleve, nil, nil), mockCH, mockBleve
}

func makeJobSearchRequest(method, jobID, path string, body []byte, tenantID string) *http.Request {
	var req *http.Request
	if body != nil {
		req = httptest.NewRequest(method, path, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}

	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	if jobID != "" {
		req = mux.SetURLVars(req, map[string]string{"job_id": jobID})
	}

	return req
}

// setupCHFacets adds the standard GetFacets mock expectation.
func setupCHFacets(mockCH *testutil.MockClickHouseStore, tenantID, jobID string) {
	mockCH.On("GetFacets", mock.Anything, tenantID, jobID, mock.AnythingOfType("storage.SearchQuery")).
		Return(map[string][]storage.FacetValue{}, nil).Maybe()
}

func TestSearchLogsHandler_MissingTenantContext(t *testing.T) {
	h, _, _ := setupSearchLogsHandler()
	jobID := uuid.New()
	req := makeJobSearchRequest(http.MethodGet, jobID.String(), "/api/v1/analysis/"+jobID.String()+"/search?q=test", nil, "")
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
}

func TestSearchLogsHandler_MissingJobID(t *testing.T) {
	h, _, _ := setupSearchLogsHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis//search?q=test", nil)
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSearchLogsHandler_GET_InvalidKQL(t *testing.T) {
	h, _, _ := setupSearchLogsHandler()
	jobID := uuid.New()
	req := makeJobSearchRequest(http.MethodGet, jobID.String(), "/api/v1/analysis/"+jobID.String()+"/search?q=field:", nil, "test-tenant")

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "invalid query syntax")
}

func TestSearchLogsHandler_POST_InvalidJSON(t *testing.T) {
	h, _, _ := setupSearchLogsHandler()
	jobID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/search", bytes.NewBufferString("{broken"))
	req.Header.Set("Content-Type", "application/json")
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSearchLogsHandler_GET_FacetError_NonFatal(t *testing.T) {
	// Facet errors are non-fatal — search returns results without facets.
	h, mockCH, _ := setupSearchLogsHandler()
	jobID := uuid.New()
	tenantID := "test-tenant"

	mockCH.On("SearchEntries", mock.Anything, tenantID, jobID.String(), mock.AnythingOfType("storage.SearchQuery")).
		Return(&storage.SearchResult{Entries: []domain.LogEntry{}, TotalCount: 0}, nil)

	mockCH.On("GetFacets", mock.Anything, tenantID, jobID.String(), mock.AnythingOfType("storage.SearchQuery")).
		Return(map[string][]storage.FacetValue(nil), assert.AnError)

	req := makeJobSearchRequest(http.MethodGet, jobID.String(), "/api/v1/analysis/"+jobID.String()+"/search?q=error", nil, tenantID)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockCH.AssertExpectations(t)
}

func TestSearchLogsHandler_GET_Success(t *testing.T) {
	h, mockCH, _ := setupSearchLogsHandler()
	jobID := uuid.New()
	tenantID := "test-tenant"

	mockCH.On("SearchEntries", mock.Anything, tenantID, jobID.String(), mock.AnythingOfType("storage.SearchQuery")).
		Return(&storage.SearchResult{
			Entries:    []domain.LogEntry{{EntryID: "entry-1"}},
			TotalCount: 1,
			TookMS:     5,
		}, nil)

	setupCHFacets(mockCH, tenantID, jobID.String())

	req := makeJobSearchRequest(http.MethodGet, jobID.String(), "/api/v1/analysis/"+jobID.String()+"/search?q=error", nil, tenantID)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 1, resp.Total)
	assert.Equal(t, 1, resp.Page)
	assert.Equal(t, 50, resp.PageSize)

	mockCH.AssertExpectations(t)
}

func TestSearchLogsHandler_GET_WithPagination(t *testing.T) {
	h, mockCH, _ := setupSearchLogsHandler()
	jobID := uuid.New()
	tenantID := "test-tenant"

	mockCH.On("SearchEntries", mock.Anything, tenantID, jobID.String(), mock.AnythingOfType("storage.SearchQuery")).
		Return(&storage.SearchResult{
			Entries:    []domain.LogEntry{{EntryID: "entry-3"}},
			TotalCount: 10,
			TookMS:     5,
		}, nil)

	setupCHFacets(mockCH, tenantID, jobID.String())

	req := makeJobSearchRequest(http.MethodGet, jobID.String(), "/api/v1/analysis/"+jobID.String()+"/search?q=error&page=2&page_size=3", nil, tenantID)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 10, resp.Total)
	assert.Equal(t, 2, resp.Page)
	assert.Equal(t, 3, resp.PageSize)
	assert.Equal(t, 4, resp.TotalPages)

	mockCH.AssertExpectations(t)
}

func TestSearchLogsHandler_GET_WithSort(t *testing.T) {
	h, mockCH, _ := setupSearchLogsHandler()
	jobID := uuid.New()
	tenantID := "test-tenant"

	mockCH.On("SearchEntries", mock.Anything, tenantID, jobID.String(), mock.MatchedBy(func(q storage.SearchQuery) bool {
		return q.SortBy == "duration_ms" && q.SortOrder == "asc"
	})).Return(&storage.SearchResult{Entries: []domain.LogEntry{}, TotalCount: 0}, nil)

	setupCHFacets(mockCH, tenantID, jobID.String())

	req := makeJobSearchRequest(http.MethodGet, jobID.String(), "/api/v1/analysis/"+jobID.String()+"/search?q=test&sort_by=duration_ms&sort_order=asc", nil, tenantID)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockCH.AssertExpectations(t)
}

func TestSearchLogsHandler_GET_WithTimeRange(t *testing.T) {
	h, mockCH, _ := setupSearchLogsHandler()
	jobID := uuid.New()
	tenantID := "test-tenant"

	mockCH.On("SearchEntries", mock.Anything, tenantID, jobID.String(), mock.MatchedBy(func(q storage.SearchQuery) bool {
		return q.TimeFrom != nil && q.TimeTo != nil
	})).Return(&storage.SearchResult{Entries: []domain.LogEntry{}, TotalCount: 0}, nil)

	setupCHFacets(mockCH, tenantID, jobID.String())

	timeFrom := url.QueryEscape("2024-01-01T00:00:00Z")
	timeTo := url.QueryEscape("2024-01-02T00:00:00Z")
	req := makeJobSearchRequest(http.MethodGet, jobID.String(), "/api/v1/analysis/"+jobID.String()+"/search?q=test&time_from="+timeFrom+"&time_to="+timeTo, nil, tenantID)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockCH.AssertExpectations(t)
}

func TestSearchLogsHandler_POST_Success(t *testing.T) {
	h, mockCH, _ := setupSearchLogsHandler()
	jobID := uuid.New()
	tenantID := "test-tenant"

	mockCH.On("SearchEntries", mock.Anything, tenantID, jobID.String(), mock.AnythingOfType("storage.SearchQuery")).
		Return(&storage.SearchResult{
			Entries:    []domain.LogEntry{{EntryID: "entry-1"}},
			TotalCount: 1,
			TookMS:     5,
		}, nil)

	setupCHFacets(mockCH, tenantID, jobID.String())

	body := `{"query":"log_type:API","page":1,"page_size":10}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/search", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 1, resp.Total)
	assert.Equal(t, 1, resp.Page)
	assert.Equal(t, 10, resp.PageSize)

	mockCH.AssertExpectations(t)
}

func TestSearchLogsHandler_WildcardQuery(t *testing.T) {
	h, mockCH, _ := setupSearchLogsHandler()
	jobID := uuid.New()
	tenantID := "test-tenant"

	mockCH.On("SearchEntries", mock.Anything, tenantID, jobID.String(), mock.AnythingOfType("storage.SearchQuery")).
		Return(&storage.SearchResult{Entries: []domain.LogEntry{}, TotalCount: 0}, nil)

	setupCHFacets(mockCH, tenantID, jobID.String())

	req := makeJobSearchRequest(http.MethodGet, jobID.String(), "/api/v1/analysis/"+jobID.String()+"/search", nil, tenantID)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockCH.AssertExpectations(t)
}
