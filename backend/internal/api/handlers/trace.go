package handlers

import (
	"net/http"

	"github.com/blevesearch/bleve/v2"
	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/search"
)

// TraceHandler serves GET /api/v1/analysis/{job_id}/trace/{trace_id}.
type TraceHandler struct {
	bleveManager *search.BleveManager
}

func NewTraceHandler(bm *search.BleveManager) *TraceHandler {
	return &TraceHandler{bleveManager: bm}
}

func (h *TraceHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	// Validate job_id as a proper UUID.
	jobIDStr := mux.Vars(r)["job_id"]
	if _, err := uuid.Parse(jobIDStr); err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid job_id format")
		return
	}
	_ = jobIDStr // Validated but not directly used; trace_id determines the search scope

	traceID := mux.Vars(r)["trace_id"]
	if traceID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "trace_id is required")
		return
	}

	// Search for all entries with this trace_id
	query := bleve.NewTermQuery(traceID)
	query.SetField("trace_id")
	searchReq := bleve.NewSearchRequest(query)
	searchReq.Size = 1000
	searchReq.Fields = []string{"*"}
	searchReq.SortBy([]string{"timestamp"})

	result, err := h.bleveManager.Search(r.Context(), tenantID, searchReq)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "trace search failed")
		return
	}

	entries := make([]map[string]interface{}, 0, len(result.Hits))
	var totalDuration int
	for _, hit := range result.Hits {
		entry := map[string]interface{}{
			"id":     hit.ID,
			"score":  hit.Score,
			"fields": hit.Fields,
		}
		entries = append(entries, entry)
		if d, ok := hit.Fields["duration_ms"].(float64); ok {
			totalDuration += int(d)
		}
	}

	api.JSON(w, http.StatusOK, map[string]interface{}{
		"trace_id":       traceID,
		"entries":        entries,
		"entry_count":    len(entries),
		"total_duration": totalDuration,
	})
}
