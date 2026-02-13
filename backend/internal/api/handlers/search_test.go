package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/blevesearch/bleve/v2"
	bleveSearch "github.com/blevesearch/bleve/v2/search"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
)

// ---------------------------------------------------------------------------
// SearchHandler tests
// ---------------------------------------------------------------------------

func TestSearchHandler_MissingTenantContext(t *testing.T) {
	h := NewSearchHandler(nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q=error", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
	assert.Contains(t, errResp.Message, "missing tenant context")
}

func TestSearchHandler_GET_MissingQuery(t *testing.T) {
	h := NewSearchHandler(nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search", nil)
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "query")
}

func TestSearchHandler_POST_MissingQuery(t *testing.T) {
	h := NewSearchHandler(nil, nil)

	body := `{"query":"","page":1,"page_size":10}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/search", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Contains(t, errResp.Message, "query")
}

func TestSearchHandler_POST_InvalidJSON(t *testing.T) {
	h := NewSearchHandler(nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/search", bytes.NewBufferString("{broken"))
	req.Header.Set("Content-Type", "application/json")
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Contains(t, errResp.Message, "invalid JSON")
}

func TestSearchHandler_GET_InvalidKQL(t *testing.T) {
	// "field:" with no value is invalid KQL.
	h := NewSearchHandler(nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("field:"), nil)
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "invalid query syntax")
}

func TestSearchHandler_POST_InvalidKQL(t *testing.T) {
	h := NewSearchHandler(nil, nil)

	body := `{"query":"field:","page":1,"page_size":10}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/search", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Contains(t, errResp.Message, "invalid query syntax")
}

func TestSearchHandler_GET_BleveSearchError(t *testing.T) {
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewSearchHandler(nil, mockSearcher)

	tenantID := "test-tenant"
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(nil, errors.New("bleve index error"))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("error"), nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInternalError, errResp.Code)
	assert.Contains(t, errResp.Message, "search failed")

	mockSearcher.AssertExpectations(t)
}

func TestSearchHandler_GET_SuccessSimpleTerm(t *testing.T) {
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewSearchHandler(nil, mockSearcher)

	tenantID := "test-tenant"
	result := &bleve.SearchResult{
		Hits: bleveSearch.DocumentMatchCollection{
			&bleveSearch.DocumentMatch{
				ID:    "entry-1",
				Score: 2.5,
				Fields: map[string]interface{}{
					"log_type":    "API",
					"user":        "Demo",
					"duration_ms": float64(100),
				},
			},
			&bleveSearch.DocumentMatch{
				ID:    "entry-2",
				Score: 1.8,
				Fields: map[string]interface{}{
					"log_type":    "SQL",
					"user":        "Admin",
					"duration_ms": float64(200),
				},
			},
		},
		Total:  2,
		Facets: bleveSearch.FacetResults{},
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(result, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("error"), nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 2, resp.Total)
	assert.Equal(t, 1, resp.Page)
	assert.Equal(t, 25, resp.PageSize) // default page_size
	assert.Equal(t, 1, resp.TotalPages)
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "entry-1", resp.Results[0].ID)
	assert.Equal(t, 2.5, resp.Results[0].Score)
	assert.Equal(t, "API", resp.Results[0].Fields["log_type"])
	assert.Equal(t, "entry-2", resp.Results[1].ID)

	mockSearcher.AssertExpectations(t)
}

func TestSearchHandler_GET_WithPagination(t *testing.T) {
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewSearchHandler(nil, mockSearcher)

	tenantID := "test-tenant"
	result := &bleve.SearchResult{
		Hits: bleveSearch.DocumentMatchCollection{
			&bleveSearch.DocumentMatch{
				ID:     "entry-3",
				Score:  1.0,
				Fields: map[string]interface{}{"log_type": "API"},
			},
		},
		Total:  10,
		Facets: bleveSearch.FacetResults{},
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(result, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("error")+"&page=2&page_size=3", nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 10, resp.Total)
	assert.Equal(t, 2, resp.Page)
	assert.Equal(t, 3, resp.PageSize)
	// 10 / 3 = 3 pages, with 1 extra for remainder.
	assert.Equal(t, 4, resp.TotalPages)

	mockSearcher.AssertExpectations(t)
}

func TestSearchHandler_GET_DefaultPagination(t *testing.T) {
	// When page < 1 or page_size is invalid, defaults are applied.
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewSearchHandler(nil, mockSearcher)

	tenantID := "test-tenant"
	result := &bleve.SearchResult{
		Hits:   bleveSearch.DocumentMatchCollection{},
		Total:  0,
		Facets: bleveSearch.FacetResults{},
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(result, nil)

	// page=0, page_size=0 -> should default to page=1, page_size=25.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("test")+"&page=0&page_size=0", nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 1, resp.Page)
	assert.Equal(t, 25, resp.PageSize)

	mockSearcher.AssertExpectations(t)
}

func TestSearchHandler_GET_PageSizeMax100(t *testing.T) {
	// page_size > 100 should be clamped to default 25.
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewSearchHandler(nil, mockSearcher)

	tenantID := "test-tenant"
	result := &bleve.SearchResult{
		Hits:   bleveSearch.DocumentMatchCollection{},
		Total:  0,
		Facets: bleveSearch.FacetResults{},
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(result, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("test")+"&page_size=200", nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 25, resp.PageSize)

	mockSearcher.AssertExpectations(t)
}

func TestSearchHandler_POST_Success(t *testing.T) {
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewSearchHandler(nil, mockSearcher)

	tenantID := "test-tenant"
	result := &bleve.SearchResult{
		Hits: bleveSearch.DocumentMatchCollection{
			&bleveSearch.DocumentMatch{
				ID:    "entry-1",
				Score: 3.0,
				Fields: map[string]interface{}{
					"log_type": "API",
					"user":     "Demo",
				},
			},
		},
		Total:  1,
		Facets: bleveSearch.FacetResults{},
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(result, nil)

	body := `{"query":"log_type:API","page":1,"page_size":10}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/search", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 1, resp.Total)
	assert.Equal(t, 1, resp.Page)
	assert.Equal(t, 10, resp.PageSize)
	assert.Equal(t, 1, resp.TotalPages)
	require.Len(t, resp.Results, 1)
	assert.Equal(t, "entry-1", resp.Results[0].ID)

	mockSearcher.AssertExpectations(t)
}

func TestSearchHandler_POST_BleveSearchError(t *testing.T) {
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewSearchHandler(nil, mockSearcher)

	tenantID := "test-tenant"
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(nil, errors.New("internal bleve failure"))

	body := `{"query":"error","page":1,"page_size":10}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/search", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Contains(t, errResp.Message, "search failed")

	mockSearcher.AssertExpectations(t)
}

func TestSearchHandler_GET_FieldQuery(t *testing.T) {
	// Test a valid KQL field:value query.
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewSearchHandler(nil, mockSearcher)

	tenantID := "test-tenant"
	result := &bleve.SearchResult{
		Hits: bleveSearch.DocumentMatchCollection{
			&bleveSearch.DocumentMatch{
				ID:     "entry-1",
				Score:  1.0,
				Fields: map[string]interface{}{"user": "Demo", "log_type": "API"},
			},
		},
		Total:  1,
		Facets: bleveSearch.FacetResults{},
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(result, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("user:Demo"), nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 1, resp.Total)
	assert.Equal(t, "Demo", resp.Results[0].Fields["user"])

	mockSearcher.AssertExpectations(t)
}

func TestSearchHandler_GET_BooleanKQLQuery(t *testing.T) {
	// Test a KQL query with AND boolean.
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewSearchHandler(nil, mockSearcher)

	tenantID := "test-tenant"
	result := &bleve.SearchResult{
		Hits:   bleveSearch.DocumentMatchCollection{},
		Total:  0,
		Facets: bleveSearch.FacetResults{},
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(result, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("log_type:API AND user:Demo"), nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 0, resp.Total)

	mockSearcher.AssertExpectations(t)
}

func TestSearchHandler_TotalPagesCalculation(t *testing.T) {
	// Verify total_pages is calculated correctly with various total/page_size combos.
	tests := []struct {
		name          string
		total         uint64
		pageSize      int
		expectedPages int
	}{
		{"exact_division", 10, 5, 2},
		{"with_remainder", 11, 5, 3},
		{"single_page", 3, 10, 1},
		{"zero_results", 0, 25, 0},
		{"one_result", 1, 25, 1},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mockSearcher := new(testutil.MockSearchIndexer)
			h := NewSearchHandler(nil, mockSearcher)

			tenantID := "test-tenant"
			result := &bleve.SearchResult{
				Hits:   bleveSearch.DocumentMatchCollection{},
				Total:  tc.total,
				Facets: bleveSearch.FacetResults{},
			}
			mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
				Return(result, nil)

			q := url.QueryEscape("test")
			req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+q+"&page_size="+url.QueryEscape(string(rune('0'+tc.pageSize))), nil)
			// Use a proper numeric page_size via URL.
			reqURL := "/api/v1/search?q=test&page_size=" + func() string {
				switch tc.pageSize {
				case 5:
					return "5"
				case 10:
					return "10"
				case 25:
					return "25"
				default:
					return "25"
				}
			}()
			req = httptest.NewRequest(http.MethodGet, reqURL, nil)
			ctx := middleware.WithTenantID(req.Context(), tenantID)
			ctx = middleware.WithUserID(ctx, "test-user")
			req = req.WithContext(ctx)

			w := httptest.NewRecorder()
			h.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)

			var resp SearchResponse
			require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
			assert.Equal(t, tc.expectedPages, resp.TotalPages)

			mockSearcher.AssertExpectations(t)
		})
	}
}

func TestSearchHandler_EmptyResults(t *testing.T) {
	mockSearcher := new(testutil.MockSearchIndexer)
	h := NewSearchHandler(nil, mockSearcher)

	tenantID := "test-tenant"
	result := &bleve.SearchResult{
		Hits:   bleveSearch.DocumentMatchCollection{},
		Total:  0,
		Facets: bleveSearch.FacetResults{},
	}
	mockSearcher.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
		Return(result, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?q="+url.QueryEscape("nonexistent_query"), nil)
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SearchResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 0, resp.Total)
	assert.Len(t, resp.Results, 0)
	assert.Equal(t, 0, resp.TotalPages)

	mockSearcher.AssertExpectations(t)
}

func TestSearchHandler_TableDriven(t *testing.T) {
	tenantID := "test-tenant"

	tests := []struct {
		name           string
		tenantID       string
		method         string
		queryParam     string
		body           string
		setupMock      func(m *testutil.MockSearchIndexer)
		expectedStatus int
		checkBody      func(t *testing.T, body []byte)
	}{
		{
			name:           "get_missing_tenant_returns_401",
			tenantID:       "",
			method:         http.MethodGet,
			queryParam:     "error",
			setupMock:      func(_ *testutil.MockSearchIndexer) {},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "get_empty_query_returns_400",
			tenantID:       tenantID,
			method:         http.MethodGet,
			queryParam:     "",
			setupMock:      func(_ *testutil.MockSearchIndexer) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "get_invalid_kql_returns_400",
			tenantID:       tenantID,
			method:         http.MethodGet,
			queryParam:     "field:",
			setupMock:      func(_ *testutil.MockSearchIndexer) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:       "get_bleve_error_returns_500",
			tenantID:   tenantID,
			method:     http.MethodGet,
			queryParam: "error",
			setupMock: func(m *testutil.MockSearchIndexer) {
				m.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
					Return(nil, errors.New("bleve crashed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:       "get_success_returns_200",
			tenantID:   tenantID,
			method:     http.MethodGet,
			queryParam: "error",
			setupMock: func(m *testutil.MockSearchIndexer) {
				result := &bleve.SearchResult{
					Hits: bleveSearch.DocumentMatchCollection{
						&bleveSearch.DocumentMatch{ID: "e1", Score: 1.0, Fields: map[string]interface{}{}},
					},
					Total:  1,
					Facets: bleveSearch.FacetResults{},
				}
				m.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
					Return(result, nil)
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp SearchResponse
				require.NoError(t, json.Unmarshal(body, &resp))
				assert.Equal(t, 1, resp.Total)
				assert.Len(t, resp.Results, 1)
			},
		},
		{
			name:           "post_invalid_json_returns_400",
			tenantID:       tenantID,
			method:         http.MethodPost,
			body:           "{bad",
			setupMock:      func(_ *testutil.MockSearchIndexer) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "post_empty_query_returns_400",
			tenantID:       tenantID,
			method:         http.MethodPost,
			body:           `{"query":""}`,
			setupMock:      func(_ *testutil.MockSearchIndexer) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:     "post_success_returns_200",
			tenantID: tenantID,
			method:   http.MethodPost,
			body:     `{"query":"test","page":1,"page_size":5}`,
			setupMock: func(m *testutil.MockSearchIndexer) {
				result := &bleve.SearchResult{
					Hits: bleveSearch.DocumentMatchCollection{
						&bleveSearch.DocumentMatch{ID: "e1", Score: 1.0, Fields: map[string]interface{}{}},
					},
					Total:  1,
					Facets: bleveSearch.FacetResults{},
				}
				m.On("Search", mock.Anything, tenantID, mock.AnythingOfType("*bleve.SearchRequest")).
					Return(result, nil)
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp SearchResponse
				require.NoError(t, json.Unmarshal(body, &resp))
				assert.Equal(t, 1, resp.Total)
				assert.Equal(t, 5, resp.PageSize)
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mockSearcher := new(testutil.MockSearchIndexer)
			tc.setupMock(mockSearcher)

			handler := NewSearchHandler(nil, mockSearcher)

			var req *http.Request
			if tc.method == http.MethodGet {
				path := "/api/v1/search"
				if tc.queryParam != "" {
					path += "?q=" + url.QueryEscape(tc.queryParam)
				}
				req = httptest.NewRequest(tc.method, path, nil)
			} else {
				req = httptest.NewRequest(tc.method, "/api/v1/search", bytes.NewBufferString(tc.body))
				req.Header.Set("Content-Type", "application/json")
			}

			if tc.tenantID != "" {
				ctx := middleware.WithTenantID(req.Context(), tc.tenantID)
				ctx = middleware.WithUserID(ctx, "test-user")
				req = req.WithContext(ctx)
			}

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
