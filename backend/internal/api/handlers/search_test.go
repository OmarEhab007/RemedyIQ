package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/search"
)

func TestSearchHandler_MissingTenantContext(t *testing.T) {
	h := NewSearchHandler(nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q=test", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestSearchHandler_MissingQuery(t *testing.T) {
	h := NewSearchHandler(nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search", nil)
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "test-tenant")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Contains(t, errResp.Message, "query")
}

func TestSearchHandler_InvalidKQL(t *testing.T) {
	// The handler needs a BleveManager to get past KQL parsing for valid queries,
	// but for invalid KQL, parsing fails before Bleve is touched.
	h := NewSearchHandler(nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("field:"), nil)
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "test-tenant")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	// Should get 400 for invalid syntax
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSearchHandler_SuccessfulSearch(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "search-handler-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	bm, err := search.NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	// Index some test data
	entries := []domain.LogEntry{
		{
			EntryID:    "entry-1",
			JobID:      "job-1",
			LogType:    domain.LogTypeAPI,
			User:       "Demo",
			Form:       "HPD:Help Desk",
			APICode:    "GET_ENTRY",
			DurationMS: 5000,
			Success:    true,
			Timestamp:  time.Now(),
			LineNumber: 100,
		},
		{
			EntryID:    "entry-2",
			JobID:      "job-1",
			LogType:    domain.LogTypeSQL,
			User:       "Admin",
			SQLTable:   "T1234",
			DurationMS: 2000,
			Success:    true,
			Timestamp:  time.Now(),
			LineNumber: 200,
		},
	}
	err = bm.IndexEntries(context.Background(), "test-tenant", entries)
	require.NoError(t, err)

	h := NewSearchHandler(nil, bm)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("log_type:API"), nil)
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "test-tenant")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 1, resp.Total)
	assert.Equal(t, 1, resp.Page)
	assert.Equal(t, 25, resp.PageSize)
	assert.Len(t, resp.Results, 1)
	assert.Equal(t, "entry-1", resp.Results[0].ID)
}

func TestSearchHandler_Pagination(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "search-handler-page-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	bm, err := search.NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	// Index 5 entries
	entries := make([]domain.LogEntry, 5)
	for i := 0; i < 5; i++ {
		entries[i] = domain.LogEntry{
			EntryID:   "e-" + string(rune('a'+i)),
			LogType:   domain.LogTypeAPI,
			Timestamp: time.Now(),
		}
	}
	err = bm.IndexEntries(context.Background(), "page-tenant", entries)
	require.NoError(t, err)

	h := NewSearchHandler(nil, bm)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("log_type:API")+"&page=1&page_size=2", nil)
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "page-tenant")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 5, resp.Total)
	assert.Equal(t, 2, resp.PageSize)
	assert.Equal(t, 3, resp.TotalPages)
	assert.Len(t, resp.Results, 2)
}
