package handlers

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/search"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

const searchCacheTTL = 2 * time.Minute

type SearchLogsHandler struct {
	ch    storage.ClickHouseStore
	bleve search.SearchIndexer
	redis storage.RedisCache
	pg    storage.PostgresStore
}

func NewSearchLogsHandler(ch storage.ClickHouseStore, bleve search.SearchIndexer, rc storage.RedisCache, pg storage.PostgresStore) *SearchLogsHandler {
	return &SearchLogsHandler{ch: ch, bleve: bleve, redis: rc, pg: pg}
}

type SearchRequest struct {
	Query    string `json:"query"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	SortBy   string `json:"sort_by"`
	SortDir  string `json:"sort_dir"`
}

type SearchResponse struct {
	Results    []SearchHit              `json:"results"`
	Total      int                      `json:"total"`
	Page       int                      `json:"page"`
	PageSize   int                      `json:"page_size"`
	TotalPages int                      `json:"total_pages"`
	Facets     map[string][]FacetEntry  `json:"facets,omitempty"`
	Histogram  []domain.HistogramBucket `json:"histogram,omitempty"`
	TookMS     int                      `json:"took_ms"`
}

type SearchHit struct {
	ID     string                 `json:"id"`
	Score  float64                `json:"score"`
	Fields map[string]interface{} `json:"fields"`
}

type FacetEntry struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

func (h *SearchLogsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	vars := mux.Vars(r)
	jobID := vars["job_id"]
	if jobID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "job_id is required in path")
		return
	}

	var query string
	var page, pageSize int
	var sortBy, sortDir string
	var timeFrom, timeTo *time.Time
	var includeHistogram bool
	var logTypes, users, queues []string

	if r.Method == http.MethodGet {
		query = r.URL.Query().Get("q")
		page, _ = strconv.Atoi(r.URL.Query().Get("page"))
		pageSize, _ = strconv.Atoi(r.URL.Query().Get("page_size"))
		sortBy = r.URL.Query().Get("sort_by")
		sortDir = r.URL.Query().Get("sort_order")
		includeHistogram = r.URL.Query().Get("include_histogram") == "true"
		logTypes = r.URL.Query()["log_type"]
		users = r.URL.Query()["user"]
		queues = r.URL.Query()["queue"]
		if fromStr := r.URL.Query().Get("time_from"); fromStr != "" {
			if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
				timeFrom = &t
			}
		}
		if toStr := r.URL.Query().Get("time_to"); toStr != "" {
			if t, err := time.Parse(time.RFC3339, toStr); err == nil {
				timeTo = &t
			}
		}
	} else {
		var req SearchRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid JSON body")
			return
		}
		query = req.Query
		page = req.Page
		pageSize = req.PageSize
		sortBy = req.SortBy
		sortDir = req.SortDir
	}

	if query == "" {
		query = "*"
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 500 {
		pageSize = 50
	}

	validSortFields := map[string]bool{
		"timestamp":   true,
		"duration_ms": true,
		"line_number": true,
		"user":        true,
		"log_type":    true,
	}
	if !validSortFields[sortBy] {
		sortBy = "timestamp"
	}
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "desc"
	}

	_, err := search.ParseKQL(query)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid query syntax: "+err.Error())
		return
	}

	// Check Redis cache before executing search
	cacheKey := h.buildCacheKey(tenantID, jobID, query, page, pageSize, sortBy, sortDir, timeFrom, timeTo, includeHistogram, logTypes, users, queues)
	if h.redis != nil {
		if cached, err := h.redis.Get(r.Context(), cacheKey); err == nil {
			var resp SearchResponse
			if json.Unmarshal([]byte(cached), &resp) == nil {
				api.JSON(w, http.StatusOK, resp)
				return
			}
		} else if err != redis.Nil {
			slog.Warn("redis cache get failed", "key", cacheKey, "error", err)
		}
	}

	// Use ClickHouse as primary data source for entries and total count.
	chQuery := storage.SearchQuery{
		Query:     query,
		LogTypes:  logTypes,
		Users:     users,
		Queues:    queues,
		Page:      page,
		PageSize:  pageSize,
		SortBy:    sortBy,
		SortOrder: sortDir,
		TimeFrom:  timeFrom,
		TimeTo:    timeTo,
	}

	chResult, err := h.ch.SearchEntries(r.Context(), tenantID, jobID, chQuery)
	if err != nil {
		slog.Error("search entries failed", "error", err, "tenant_id", tenantID, "job_id", jobID, "query", query)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "search failed")
		return
	}

	// Convert ClickHouse entries to SearchHit format
	hits := make([]SearchHit, 0, len(chResult.Entries))
	for _, entry := range chResult.Entries {
		hits = append(hits, SearchHit{
			ID:     entry.EntryID,
			Score:  1.0,
			Fields: entryToFieldMap(entry),
		})
	}

	totalPages := int(chResult.TotalCount) / pageSize
	if int(chResult.TotalCount)%pageSize != 0 {
		totalPages++
	}

	// Use ClickHouse for facets (replaces Bleve which requires separate indexing)
	facets := make(map[string][]FacetEntry)
	if chFacets, err := h.ch.GetFacets(r.Context(), tenantID, jobID, chQuery); err == nil {
		for field, values := range chFacets {
			entries := make([]FacetEntry, 0, len(values))
			for _, v := range values {
				entries = append(entries, FacetEntry{
					Value: v.Value,
					Count: int(v.Count),
				})
			}
			facets[field] = entries
		}
	}

	var histogram []domain.HistogramBucket
	if includeHistogram {
		histFrom := timeFrom
		histTo := timeTo
		if histFrom == nil || histTo == nil {
			// Query ClickHouse for the job's actual time range instead of wall clock
			if tRange, err := h.ch.GetJobTimeRange(r.Context(), tenantID, jobID); err == nil {
				if histFrom == nil {
					histFrom = &tRange.Start
				}
				if histTo == nil {
					histTo = &tRange.End
				}
			} else {
				// Fallback: skip histogram if we can't determine time range
				slog.Warn("failed to get job time range for histogram", "job_id", jobID, "error", err)
			}
		}
		if histFrom != nil && histTo != nil {
			histResp, err := h.ch.GetHistogramData(r.Context(), tenantID, jobID, *histFrom, *histTo)
			if err != nil {
				slog.Warn("histogram query failed", "job_id", jobID, "error", err)
			} else if histResp != nil {
				histogram = histResp.Buckets
			}
		}
	}

	resp := SearchResponse{
		Results:    hits,
		Total:      int(chResult.TotalCount),
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
		Facets:     facets,
		Histogram:  histogram,
		TookMS:     chResult.TookMS,
	}

	// Record search history (non-blocking, best-effort)
	if h.pg != nil && query != "*" {
		userID := middleware.GetUserID(r.Context())
		if userID != "" {
			if tenantUUID, err := uuid.Parse(tenantID); err == nil {
				jobUUID, _ := uuid.Parse(jobID)
				go func() {
					if err := h.pg.RecordSearchHistory(r.Context(), tenantUUID, userID, &jobUUID, query, int(chResult.TotalCount)); err != nil {
						slog.Warn("failed to record search history", "error", err)
					}
				}()
			}
		}
	}

	// Cache the response in Redis
	if h.redis != nil {
		if data, err := json.Marshal(resp); err == nil {
			if err := h.redis.Set(r.Context(), cacheKey, string(data), searchCacheTTL); err != nil {
				slog.Warn("redis cache set failed", "key", cacheKey, "error", err)
			}
		}
	}

	api.JSON(w, http.StatusOK, resp)
}

// entryToFieldMap converts a LogEntry to a map for the SearchHit.Fields response.
func entryToFieldMap(e domain.LogEntry) map[string]interface{} {
	m := map[string]interface{}{
		"entry_id":    e.EntryID,
		"line_number": e.LineNumber,
		"timestamp":   e.Timestamp,
		"log_type":    string(e.LogType),
		"duration_ms": e.DurationMS,
		"success":     e.Success,
	}
	if e.TraceID != "" {
		m["trace_id"] = e.TraceID
	}
	if e.RPCID != "" {
		m["rpc_id"] = e.RPCID
	}
	if e.ThreadID != "" {
		m["thread_id"] = e.ThreadID
	}
	if e.Queue != "" {
		m["queue"] = e.Queue
	}
	if e.User != "" {
		m["user"] = e.User
	}
	if e.APICode != "" {
		m["api_code"] = e.APICode
	}
	if e.Form != "" {
		m["form"] = e.Form
	}
	if e.SQLTable != "" {
		m["sql_table"] = e.SQLTable
	}
	if e.SQLStatement != "" {
		m["sql_statement"] = e.SQLStatement
	}
	if e.FilterName != "" {
		m["filter_name"] = e.FilterName
	}
	if e.Operation != "" {
		m["operation"] = e.Operation
	}
	if e.RequestID != "" {
		m["request_id"] = e.RequestID
	}
	if e.EscName != "" {
		m["esc_name"] = e.EscName
	}
	if e.EscPool != "" {
		m["esc_pool"] = e.EscPool
	}
	if e.ErrorEncountered {
		m["error_encountered"] = true
	}
	if e.RawText != "" {
		m["raw_text"] = e.RawText
	}
	if e.ErrorMessage != "" {
		m["error_message"] = e.ErrorMessage
	}
	return m
}

func (h *SearchLogsHandler) buildCacheKey(tenantID, jobID, query string, page, pageSize int, sortBy, sortDir string, timeFrom, timeTo *time.Time, includeHistogram bool, logTypes, users, queues []string) string {
	raw := fmt.Sprintf("%s|%s|%s|%d|%d|%s|%s|%v|%v|%v|%v|%v|%v",
		tenantID, jobID, query, page, pageSize, sortBy, sortDir, timeFrom, timeTo, includeHistogram, logTypes, users, queues)
	hash := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("cache:%s:search:%x", tenantID, hash[:8])
}
