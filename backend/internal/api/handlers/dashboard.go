package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

// DashboardHandler serves GET /api/v1/analysis/{job_id}/dashboard.
type DashboardHandler struct {
	pg    storage.PostgresStore
	ch    storage.ClickHouseStore
	redis storage.RedisCache
}

func NewDashboardHandler(pg storage.PostgresStore, ch storage.ClickHouseStore, redis storage.RedisCache) *DashboardHandler {
	return &DashboardHandler{pg: pg, ch: ch, redis: redis}
}

func (h *DashboardHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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

	// Verify the job exists and belongs to this tenant.
	job, err := h.pg.GetJob(r.Context(), tid, jobID)
	if err != nil {
		if storage.IsNotFound(err) {
			api.Error(w, http.StatusNotFound, api.ErrCodeNotFound, "analysis job not found")
		} else {
			slog.Error("failed to retrieve job", "job_id", jobID, "error", err)
			api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to retrieve analysis job")
		}
		return
	}

	if job.Status != domain.JobStatusComplete {
		api.Error(w, http.StatusConflict, api.ErrCodeInvalidRequest, "analysis is not yet complete")
		return
	}

	cacheKey := h.redis.TenantKey(tenantID, "dashboard", jobID.String())
	cached, err := h.redis.Get(r.Context(), cacheKey)
	if err != nil || cached == "" {
		slog.Error("dashboard data not found in cache", "job_id", jobID, "error", err)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "dashboard data not available - analysis may need to be re-run")
		return
	}

	var data domain.DashboardData
	if err := json.Unmarshal([]byte(cached), &data); err != nil {
		slog.Error("failed to unmarshal cached dashboard data", "job_id", jobID, "error", err)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to parse dashboard data")
		return
	}

	api.JSON(w, http.StatusOK, data)
}
