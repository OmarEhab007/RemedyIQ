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
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
)

// analysisJobCreateRequest matches the OpenAPI AnalysisJobCreate schema.
type analysisJobCreateRequest struct {
	FileID   string           `json:"file_id"`
	JARFlags *domain.JARFlags `json:"jar_flags,omitempty"`
}

// AnalysisHandlers provides HTTP handlers for analysis job endpoints.
type AnalysisHandlers struct {
	pg   *storage.PostgresClient
	nats *streaming.NATSClient
}

func NewAnalysisHandlers(pg *storage.PostgresClient, nats *streaming.NATSClient) *AnalysisHandlers {
	return &AnalysisHandlers{pg: pg, nats: nats}
}

// CreateAnalysis handles POST /api/v1/analysis.
func (h *AnalysisHandlers) CreateAnalysis() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := middleware.GetTenantID(r.Context())
		if tenantID == "" {
			api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
			return
		}

		var req analysisJobCreateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid JSON body")
			return
		}

		fileID, err := uuid.Parse(req.FileID)
		if err != nil {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid file_id")
			return
		}

		tid, err := uuid.Parse(tenantID)
		if err != nil {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid tenant_id format")
			return
		}

		// Verify the file exists and belongs to this tenant.
		if _, err := h.pg.GetLogFile(r.Context(), tid, fileID); err != nil {
			if storage.IsNotFound(err) {
				api.Error(w, http.StatusNotFound, api.ErrCodeNotFound, "file not found")
			} else {
				slog.Error("failed to retrieve file for analysis", "file_id", fileID, "error", err)
				api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to retrieve file")
			}
			return
		}

		flags := domain.JARFlags{}
		if req.JARFlags != nil {
			flags = *req.JARFlags
		}
		if flags.TopN == 0 {
			flags.TopN = 50
		}

		job := &domain.AnalysisJob{
			ID:        uuid.New(),
			TenantID:  tid,
			FileID:    fileID,
			Status:    domain.JobStatusQueued,
			JARFlags:  flags,
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		}

		if err := h.pg.CreateJob(r.Context(), job); err != nil {
			api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to create analysis job")
			return
		}

		// Publish to NATS for worker pickup.
		if err := h.nats.PublishJobSubmit(r.Context(), tenantID, *job); err != nil {
			// Job is created but failed to queue -- update status.
			errMsg := "failed to queue job: " + err.Error()
			if updateErr := h.pg.UpdateJobStatus(r.Context(), tid, job.ID, domain.JobStatusFailed, &errMsg); updateErr != nil {
				slog.Error("failed to update job status after NATS publish failure",
					"job_id", job.ID, "tenant_id", tenantID, "error", updateErr)
			}
			api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to queue analysis job")
			return
		}

		api.JSON(w, http.StatusCreated, job)
	})
}

// ListAnalyses handles GET /api/v1/analysis.
func (h *AnalysisHandlers) ListAnalyses() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := middleware.GetTenantID(r.Context())
		if tenantID == "" {
			api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
			return
		}

		tid, err := uuid.Parse(tenantID)
		if err != nil {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid tenant_id format")
			return
		}

		jobs, err := h.pg.ListJobs(r.Context(), tid)
		if err != nil {
			api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to list analysis jobs")
			return
		}

		api.JSON(w, http.StatusOK, map[string]interface{}{
			"jobs": jobs,
			"pagination": map[string]interface{}{
				"page":        1,
				"page_size":   len(jobs),
				"total_count": len(jobs),
				"total_pages": 1,
			},
		})
	})
}

// GetAnalysis handles GET /api/v1/analysis/{job_id}.
func (h *AnalysisHandlers) GetAnalysis() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

		api.JSON(w, http.StatusOK, job)
	})
}
