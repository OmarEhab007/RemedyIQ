package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

// TraceHandler serves GET /api/v1/analysis/{job_id}/trace/{trace_id}.
type TraceHandler struct {
	ch storage.ClickHouseStore
}

func NewTraceHandler(ch storage.ClickHouseStore) *TraceHandler {
	return &TraceHandler{ch: ch}
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

	traceID := mux.Vars(r)["trace_id"]
	if traceID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "trace_id is required")
		return
	}

	entries, err := h.ch.GetTraceEntries(r.Context(), tenantID, jobIDStr, traceID)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "trace search failed")
		return
	}

	results := make([]map[string]interface{}, 0, len(entries))
	var totalDuration int
	for _, e := range entries {
		results = append(results, map[string]interface{}{
			"id":     e.EntryID,
			"fields": entryToFieldMap(e),
		})
		totalDuration += int(e.DurationMS)
	}

	api.JSON(w, http.StatusOK, map[string]interface{}{
		"trace_id":       traceID,
		"entries":        results,
		"entry_count":    len(results),
		"total_duration": totalDuration,
	})
}
