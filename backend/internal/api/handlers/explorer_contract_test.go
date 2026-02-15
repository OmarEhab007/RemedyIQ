package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
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
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
)

// Contract tests for the Log Explorer feature.
// These tests define the expected API contracts for:
// - Job-scoped search (GET /api/v1/analysis/{job_id}/search)
// - Entry fetch (GET /api/v1/analysis/{job_id}/entries/{entry_id})
// - Context endpoint (GET /api/v1/analysis/{job_id}/entries/{entry_id}/context)
// - Autocomplete (GET /api/v1/search/autocomplete)
// - Export (GET /api/v1/analysis/{job_id}/search/export)
// - Saved search CRUD (GET/POST/DELETE /api/v1/search/saved)
// - Search history (GET /api/v1/search/history)

// Helper functions for contract tests
var mockAnyContext = mock.Anything
var mockAnySearchQuery = mock.AnythingOfType("storage.SearchQuery")
var mockAnySavedSearch = mock.AnythingOfType("*domain.SavedSearch")

func decodeJSON(t *testing.T, data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

func stringReader(s string) io.Reader {
	return bytes.NewBufferString(s)
}

// ---------------------------------------------------------------------------
// Job-Scoped Search Contract Tests
// ---------------------------------------------------------------------------

func TestSearchLogsHandler_Contract_MissingTenantContext(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	mockBleve := new(testutil.MockSearchIndexer)
	h := NewSearchLogsHandler(mockCH, mockBleve, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+uuid.New().String()+"/search?q=test", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	var errResp api.ErrorResponse
	require.NoError(t, decodeJSON(t, w.Body.Bytes(), &errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
}

func TestSearchLogsHandler_Contract_InvalidKQL(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	mockBleve := new(testutil.MockSearchIndexer)
	h := NewSearchLogsHandler(mockCH, mockBleve, nil, nil)

	jobID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/search?q=field:", nil)
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var errResp api.ErrorResponse
	require.NoError(t, decodeJSON(t, w.Body.Bytes(), &errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "invalid query syntax")
}

func TestSearchLogsHandler_Contract_Success(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	mockBleve := new(testutil.MockSearchIndexer)
	h := NewSearchLogsHandler(mockCH, mockBleve, nil, nil)

	tenantID := "test-tenant"
	jobID := uuid.New()

	mockCH.On("SearchEntries", mockAnyContext, tenantID, jobID.String(), mockAnySearchQuery).
		Return(&storage.SearchResult{
			Entries:    []domain.LogEntry{},
			TotalCount: 0,
			TookMS:     5,
		}, nil)

	mockCH.On("GetFacets", mockAnyContext, tenantID, jobID.String(), mockAnySearchQuery).
		Return(map[string][]storage.FacetValue{
			"log_type": {{Value: "API", Count: 100}},
		}, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/search?q=test", nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockCH.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Entry Fetch Contract Tests
// ---------------------------------------------------------------------------

func TestEntryHandler_Contract_MissingTenantContext(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewEntryHandler(mockCH)

	jobID := uuid.New()
	entryID := uuid.New().String()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/entries/"+entryID, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestEntryHandler_Contract_EntryNotFound(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewEntryHandler(mockCH)

	tenantID := "test-tenant"
	jobID := uuid.New()
	entryID := uuid.New().String()

	mockCH.On("GetLogEntry", mockAnyContext, tenantID, jobID.String(), entryID).
		Return(nil, assert.AnError)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/entries/"+entryID, nil)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String(), "entry_id": entryID})
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
	mockCH.AssertExpectations(t)
}

func TestEntryHandler_Contract_Success(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewEntryHandler(mockCH)

	tenantID := "test-tenant"
	jobID := uuid.New()
	entryID := uuid.New().String()

	entry := &domain.LogEntry{
		TenantID:   tenantID,
		JobID:      jobID.String(),
		EntryID:    entryID,
		LineNumber: 100,
		LogType:    domain.LogTypeAPI,
	}
	mockCH.On("GetLogEntry", mockAnyContext, tenantID, jobID.String(), entryID).
		Return(entry, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/entries/"+entryID, nil)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String(), "entry_id": entryID})
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp domain.LogEntry
	require.NoError(t, decodeJSON(t, w.Body.Bytes(), &resp))
	assert.Equal(t, entryID, resp.EntryID)
	mockCH.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Context Endpoint Contract Tests
// ---------------------------------------------------------------------------

func TestContextHandler_Contract_MissingTenantContext(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewContextHandler(mockCH)

	jobID := uuid.New()
	entryID := uuid.New().String()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/entries/"+entryID+"/context", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestContextHandler_Contract_Success(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewContextHandler(mockCH)

	tenantID := "test-tenant"
	jobID := uuid.New()
	entryID := uuid.New().String()

	ctxResp := &domain.ContextResponse{
		Target:     domain.LogEntry{EntryID: entryID, LineNumber: 100},
		Before:     []domain.LogEntry{{LineNumber: 98}, {LineNumber: 99}},
		After:      []domain.LogEntry{{LineNumber: 101}, {LineNumber: 102}},
		WindowSize: 10,
	}
	mockCH.On("GetEntryContext", mockAnyContext, tenantID, jobID.String(), entryID, 10).
		Return(ctxResp, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/entries/"+entryID+"/context?window=10", nil)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String(), "entry_id": entryID})
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp domain.ContextResponse
	require.NoError(t, decodeJSON(t, w.Body.Bytes(), &resp))
	assert.Equal(t, entryID, resp.Target.EntryID)
	assert.Len(t, resp.Before, 2)
	assert.Len(t, resp.After, 2)
	mockCH.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Autocomplete Contract Tests
// ---------------------------------------------------------------------------

func TestAutocompleteHandler_Contract_FieldSuggestions(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewAutocompleteHandler(mockCH)

	tenantID := "test-tenant"
	jobID := uuid.New()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search/autocomplete?prefix=log_ty&job_id="+jobID.String(), nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp domain.AutocompleteResponse
	require.NoError(t, decodeJSON(t, w.Body.Bytes(), &resp))
	assert.True(t, resp.IsField)
	assert.NotEmpty(t, resp.Fields)
}

func TestAutocompleteHandler_Contract_ValueSuggestions(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewAutocompleteHandler(mockCH)

	tenantID := "test-tenant"
	jobID := uuid.New()

	mockCH.On("GetAutocompleteValues", mockAnyContext, tenantID, jobID.String(), "log_type", "A", 10).
		Return([]domain.AutocompleteValue{
			{Value: "API", Count: 1500},
			{Value: "APICode", Count: 200},
		}, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search/autocomplete?prefix=log_type:A&job_id="+jobID.String(), nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp domain.AutocompleteResponse
	require.NoError(t, decodeJSON(t, w.Body.Bytes(), &resp))
	assert.False(t, resp.IsField)
	assert.NotEmpty(t, resp.Values)
	mockCH.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Saved Search CRUD Contract Tests
// ---------------------------------------------------------------------------

func TestSavedSearchHandler_Contract_List(t *testing.T) {
	mockPG := new(testutil.MockPostgresStore)
	h := NewSavedSearchHandler(mockPG)

	tenantID := uuid.New()
	userID := "test-user"

	mockPG.On("ListSavedSearches", mockAnyContext, tenantID, userID).
		Return([]domain.SavedSearch{}, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search/saved", nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockPG.AssertExpectations(t)
}

func TestSavedSearchHandler_Contract_Create(t *testing.T) {
	mockPG := new(testutil.MockPostgresStore)
	h := NewSavedSearchHandler(mockPG)

	tenantID := uuid.New()
	userID := "test-user"

	mockPG.On("ListSavedSearches", mockAnyContext, tenantID, userID).
		Return([]domain.SavedSearch{}, nil)
	mockPG.On("CreateSavedSearch", mockAnyContext, mockAnySavedSearch).
		Return(nil)

	body := `{"name":"My Search","kql_query":"log_type:API"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/search/saved", stringReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	mockPG.AssertExpectations(t)
}

func TestSavedSearchHandler_Contract_Delete(t *testing.T) {
	mockPG := new(testutil.MockPostgresStore)
	h := NewDeleteSavedSearchHandler(mockPG)

	tenantID := uuid.New()
	userID := "test-user"
	searchID := uuid.New()

	mockPG.On("DeleteSavedSearch", mockAnyContext, tenantID, userID, searchID).
		Return(nil)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/search/saved/"+searchID.String(), nil)
	req = mux.SetURLVars(req, map[string]string{"search_id": searchID.String()})
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	mockPG.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Search History Contract Tests
// ---------------------------------------------------------------------------

func TestSearchHistoryHandler_Contract_List(t *testing.T) {
	mockPG := new(testutil.MockPostgresStore)
	h := NewSearchHistoryHandler(mockPG)

	tenantID := uuid.New()
	userID := "test-user"

	mockPG.On("GetSearchHistory", mockAnyContext, tenantID, userID, 20).
		Return([]domain.SearchHistoryEntry{}, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search/history", nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockPG.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Export Contract Tests
// ---------------------------------------------------------------------------

func TestExportHandler_Contract_CSV(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewExportHandler(mockCH)

	tenantID := "test-tenant"
	jobID := uuid.New()

	mockCH.On("SearchEntries", mockAnyContext, tenantID, jobID.String(), mock.AnythingOfType("storage.SearchQuery")).
		Return(&storage.SearchResult{
			Entries:    []domain.LogEntry{},
			TotalCount: 0,
		}, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/search/export?format=csv", nil)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "text/csv")
	assert.Contains(t, w.Header().Get("Content-Disposition"), "attachment")
	mockCH.AssertExpectations(t)
}

func TestExportHandler_Contract_JSON(t *testing.T) {
	mockCH := new(testutil.MockClickHouseStore)
	h := NewExportHandler(mockCH)

	tenantID := "test-tenant"
	jobID := uuid.New()

	mockCH.On("SearchEntries", mockAnyContext, tenantID, jobID.String(), mock.AnythingOfType("storage.SearchQuery")).
		Return(&storage.SearchResult{
			Entries:    []domain.LogEntry{},
			TotalCount: 0,
		}, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+jobID.String()+"/search/export?format=json", nil)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
	assert.Contains(t, w.Header().Get("Content-Disposition"), "attachment")
	mockCH.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// Handler stubs - These will be implemented in subsequent phases
// Note: SearchLogsHandler is now implemented in search.go
// Note: EntryHandler is now implemented in entry.go
// Note: ContextHandler is now implemented in entry.go
// Note: SavedSearchHandler is now implemented in saved_search.go
// Note: SearchHistoryHandler is now implemented in saved_search.go
// Note: ExportHandler is now implemented in export.go
// ---------------------------------------------------------------------------

var _ context.Context
