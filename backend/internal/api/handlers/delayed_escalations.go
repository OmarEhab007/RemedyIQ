package handlers

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

// DelayedEscalationsHandler serves GET /api/v1/analysis/{job_id}/dashboard/delayed-escalations.
// It queries ClickHouse directly for escalation entries whose delay_ms exceeds
// a configurable threshold.
type DelayedEscalationsHandler struct {
	pg storage.PostgresStore
	ch storage.ClickHouseStore
}

// NewDelayedEscalationsHandler creates a new handler for the delayed escalations endpoint.
func NewDelayedEscalationsHandler(pg storage.PostgresStore, ch storage.ClickHouseStore) *DelayedEscalationsHandler {
	return &DelayedEscalationsHandler{pg: pg, ch: ch}
}

func (h *DelayedEscalationsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	jobIDStr := mux.Vars(r)["job_id"]
	jobID, err := uuid.Parse(jobIDStr)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid job_id format")
		return
	}

	tid, err := uuid.Parse(tenantID)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid tenant_id format")
		return
	}

	// Parse optional query params.
	minDelayMS := 0
	if v := r.URL.Query().Get("min_delay_ms"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			minDelayMS = parsed
		}
	}
	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	// Verify job exists and is complete.
	job, err := h.pg.GetJob(r.Context(), tid, jobID)
	if err != nil {
		if storage.IsNotFound(err) {
			api.Error(w, http.StatusNotFound, api.ErrCodeNotFound, "analysis job not found")
		} else {
			api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to retrieve analysis job")
		}
		return
	}

	if job.Status != domain.JobStatusComplete {
		api.Error(w, http.StatusConflict, api.ErrCodeInvalidRequest, "analysis is not yet complete")
		return
	}

	entries, err := h.ch.QueryDelayedEscalations(r.Context(), tenantID, jobID.String(), minDelayMS, limit)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to query delayed escalations")
		return
	}

	// Compute aggregate metrics.
	var totalDelay uint64
	var maxDelay uint32
	for _, e := range entries {
		totalDelay += uint64(e.DelayMS)
		if e.DelayMS > maxDelay {
			maxDelay = e.DelayMS
		}
	}
	avgDelay := float64(0)
	if len(entries) > 0 {
		avgDelay = float64(totalDelay) / float64(len(entries))
	}

	resp := domain.DelayedEscalationsResponse{
		JobID:      jobID.String(),
		Entries:    entries,
		Total:      len(entries),
		AvgDelayMS: avgDelay,
		MaxDelayMS: maxDelay,
	}
	if resp.Entries == nil {
		resp.Entries = []domain.DelayedEscalationEntry{}
	}

	api.JSON(w, http.StatusOK, resp)
}
