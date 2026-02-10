package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

// DashboardHandler serves GET /api/v1/analysis/{job_id}/dashboard.
type DashboardHandler struct {
	pg    *storage.PostgresClient
	ch    *storage.ClickHouseClient
	redis *storage.RedisClient
}

func NewDashboardHandler(pg *storage.PostgresClient, ch *storage.ClickHouseClient, redis *storage.RedisClient) *DashboardHandler {
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
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid job_id")
		return
	}

	tid, _ := uuid.Parse(tenantID)

	// Verify the job exists and belongs to this tenant.
	job, err := h.pg.GetJob(r.Context(), tid, jobID)
	if err != nil {
		api.Error(w, http.StatusNotFound, api.ErrCodeNotFound, "analysis job not found")
		return
	}

	if job.Status != domain.JobStatusComplete {
		api.Error(w, http.StatusConflict, api.ErrCodeInvalidRequest, "analysis is not yet complete")
		return
	}

	// Check Redis cache first.
	cacheKey := h.redis.TenantKey(tenantID, "dashboard", jobID.String())
	if cached, err := h.redis.Get(r.Context(), cacheKey); err == nil && cached != "" {
		var data domain.DashboardData
		if json.Unmarshal([]byte(cached), &data) == nil {
			api.JSON(w, http.StatusOK, data)
			return
		}
	}

	// Query ClickHouse for dashboard data.
	data, err := h.ch.GetDashboardData(r.Context(), tenantID, jobID.String(), 50)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to retrieve dashboard data")
		return
	}

	// Cache for 5 minutes.
	_ = h.redis.Set(r.Context(), cacheKey, data, 5*time.Minute)

	api.JSON(w, http.StatusOK, data)
}
