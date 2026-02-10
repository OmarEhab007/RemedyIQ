package handlers

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

// ReportHandler serves POST /api/v1/analysis/{job_id}/report.
type ReportHandler struct {
	pg       *storage.PostgresClient
	registry *ai.Registry
}

// NewReportHandler creates a new report handler.
func NewReportHandler(pg *storage.PostgresClient, registry *ai.Registry) *ReportHandler {
	return &ReportHandler{pg: pg, registry: registry}
}

// reportRequest represents the request body for report generation.
type reportRequest struct {
	Format string `json:"format"` // "html" or "json"
}

// reportResponse represents the response envelope for a generated report.
type reportResponse struct {
	JobID     string `json:"job_id"`
	Format    string `json:"format"`
	Content   string `json:"content"`
	Generated string `json:"generated_at"`
	Skill     string `json:"skill_used"`
}

func (h *ReportHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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

	// Parse request body. Default to HTML format if no body or empty format.
	var req reportRequest
	if r.Body != nil {
		if decErr := json.NewDecoder(r.Body).Decode(&req); decErr != nil && decErr != io.EOF {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid JSON body")
			return
		}
	}
	if req.Format == "" {
		req.Format = "html"
	}
	if req.Format != "html" && req.Format != "json" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "format must be 'html' or 'json'")
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
			slog.Error("failed to retrieve job for report", "job_id", jobID, "error", err)
			api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to retrieve analysis job")
		}
		return
	}

	if job.Status != domain.JobStatusComplete {
		api.Error(w, http.StatusConflict, api.ErrCodeInvalidRequest, "analysis is not yet complete")
		return
	}

	// Execute the summarizer skill to generate the report content.
	input := ai.SkillInput{
		Query:    "Generate an executive summary report in " + req.Format + " format",
		JobID:    jobID.String(),
		TenantID: tenantID,
	}

	output, err := h.registry.Execute(r.Context(), "summarizer", input)
	if err != nil {
		slog.Error("report generation failed", "job_id", jobID, "error", err)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "report generation failed")
		return
	}

	resp := reportResponse{
		JobID:     jobID.String(),
		Format:    req.Format,
		Content:   output.Answer,
		Generated: time.Now().UTC().Format(time.RFC3339),
		Skill:     output.SkillName,
	}

	api.JSON(w, http.StatusOK, resp)
}
