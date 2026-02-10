package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/blevesearch/bleve/v2"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/search"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

// SearchHandler serves GET /api/v1/analysis/{job_id}/search
type SearchHandler struct {
	ch    *storage.ClickHouseClient
	bleve *search.BleveManager
}

// NewSearchHandler creates a new SearchHandler backed by ClickHouse and Bleve.
func NewSearchHandler(ch *storage.ClickHouseClient, bleve *search.BleveManager) *SearchHandler {
	return &SearchHandler{ch: ch, bleve: bleve}
}

// SearchRequest represents a search query from a POST body.
type SearchRequest struct {
	Query    string `json:"query"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	SortBy   string `json:"sort_by"`
	SortDir  string `json:"sort_dir"`
}

// SearchResponse contains the paginated search results.
type SearchResponse struct {
	Results    []SearchHit             `json:"results"`
	Total      int                     `json:"total"`
	Page       int                     `json:"page"`
	PageSize   int                     `json:"page_size"`
	TotalPages int                     `json:"total_pages"`
	Facets     map[string][]FacetEntry `json:"facets,omitempty"`
}

// SearchHit represents a single search result.
type SearchHit struct {
	ID     string                 `json:"id"`
	Score  float64                `json:"score"`
	Fields map[string]interface{} `json:"fields"`
}

// FacetEntry represents a single facet value with its count.
type FacetEntry struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

// ServeHTTP handles both GET and POST requests for search.
func (h *SearchHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	// Parse query from URL params or JSON body.
	var query string
	var page, pageSize int

	if r.Method == http.MethodGet {
		query = r.URL.Query().Get("q")
		page, _ = strconv.Atoi(r.URL.Query().Get("page"))
		pageSize, _ = strconv.Atoi(r.URL.Query().Get("page_size"))
	} else {
		var req SearchRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid JSON body")
			return
		}
		query = req.Query
		page = req.Page
		pageSize = req.PageSize
	}

	if query == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "search query is required (use 'q' for GET or 'query' for POST)")
		return
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 25
	}

	// Parse the KQL query.
	parsed, err := search.ParseKQL(query)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid query syntax: "+err.Error())
		return
	}

	// Convert KQL AST to a Bleve query.
	bleveQuery := search.ToBleveQuery(parsed)
	searchReq := bleve.NewSearchRequest(bleveQuery)
	searchReq.From = (page - 1) * pageSize
	searchReq.Size = pageSize
	searchReq.Fields = []string{"*"}

	// Add facets for common dimensions.
	searchReq.AddFacet("log_type", bleve.NewFacetRequest("log_type", 10))
	searchReq.AddFacet("user", bleve.NewFacetRequest("user", 10))
	searchReq.AddFacet("queue", bleve.NewFacetRequest("queue", 10))

	result, err := h.bleve.Search(r.Context(), tenantID, searchReq)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "search failed")
		return
	}

	// Build response hits.
	hits := make([]SearchHit, 0, len(result.Hits))
	for _, hit := range result.Hits {
		hits = append(hits, SearchHit{
			ID:     hit.ID,
			Score:  hit.Score,
			Fields: hit.Fields,
		})
	}

	totalPages := int(result.Total) / pageSize
	if int(result.Total)%pageSize != 0 {
		totalPages++
	}

	// Convert facets.
	facets := make(map[string][]FacetEntry)
	for name, facetResult := range result.Facets {
		entries := make([]FacetEntry, 0, len(facetResult.Terms.Terms()))
		for _, term := range facetResult.Terms.Terms() {
			entries = append(entries, FacetEntry{
				Value: term.Term,
				Count: term.Count,
			})
		}
		facets[name] = entries
	}

	resp := SearchResponse{
		Results:    hits,
		Total:      int(result.Total),
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
		Facets:     facets,
	}

	api.JSON(w, http.StatusOK, resp)
}
