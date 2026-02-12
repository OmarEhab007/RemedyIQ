package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

// ThreadsHandler serves GET /api/v1/analysis/{job_id}/dashboard/threads.
type ThreadsHandler struct {
	pg    *storage.PostgresClient
	ch    *storage.ClickHouseClient
	redis *storage.RedisClient
}

func NewThreadsHandler(pg *storage.PostgresClient, ch *storage.ClickHouseClient, redis *storage.RedisClient) *ThreadsHandler {
	return &ThreadsHandler{pg: pg, ch: ch, redis: redis}
}

func (h *ThreadsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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

	cacheKey := h.redis.TenantKey(tenantID, "threads", jobID.String())
	if cached, err := h.redis.Get(r.Context(), cacheKey); err == nil && cached != "" {
		var data domain.ThreadStatsResponse
		if json.Unmarshal([]byte(cached), &data) == nil {
			api.JSON(w, http.StatusOK, data)
			return
		}
	}

	data, err := h.ch.GetThreadStats(r.Context(), tenantID, jobID.String())
	if err != nil {
		slog.Error("failed to retrieve thread stats", "job_id", jobID, "error", err)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to retrieve thread stats data")
		return
	}

	_ = h.redis.Set(r.Context(), cacheKey, data, 5*time.Minute)

	api.JSON(w, http.StatusOK, data)
}
