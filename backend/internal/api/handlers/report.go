package handlers

import (
	"encoding/json"
	"fmt"
	"io"
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

// ReportHandler serves POST /api/v1/analysis/{job_id}/report.
type ReportHandler struct {
	pg    storage.PostgresStore
	redis storage.RedisCache
}

// NewReportHandler creates a new report handler.
func NewReportHandler(pg storage.PostgresStore, redis storage.RedisCache) *ReportHandler {
	return &ReportHandler{pg: pg, redis: redis}
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

// reportData holds all data sections gathered for the report.
type reportData struct {
	JobID      string
	GeneratedAt time.Time
	Dashboard  *domain.DashboardData
	Aggregates any
	Exceptions any
	Gaps       any
	Threads    any
	Filters    any
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

	// Gather all cached data for the report.
	data, err := h.gatherReportData(r, tenantID, jobID.String())
	if err != nil {
		slog.Error("report generation failed", "job_id", jobID, "error", err)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "report generation failed: no cached data available")
		return
	}

	var content string
	if req.Format == "html" {
		content, err = generateHTMLReport(data)
		if err != nil {
			slog.Error("HTML report generation failed", "job_id", jobID, "error", err)
			api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "report generation failed")
			return
		}
	} else {
		content, err = generateJSONReport(data)
		if err != nil {
			slog.Error("JSON report generation failed", "job_id", jobID, "error", err)
			api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "report generation failed")
			return
		}
	}

	resp := reportResponse{
		JobID:     jobID.String(),
		Format:    req.Format,
		Content:   content,
		Generated: data.GeneratedAt.Format(time.RFC3339),
		Skill:     "report_generator",
	}

	api.JSON(w, http.StatusOK, resp)
}

// gatherReportData reads all cached analysis data from Redis.
func (h *ReportHandler) gatherReportData(r *http.Request, tenantID, jobID string) (*reportData, error) {
	ctx := r.Context()

	dashboard, err := getDashboardFromCache(ctx, h.redis, tenantID, jobID)
	if err != nil {
		return nil, fmt.Errorf("dashboard data not available: %w", err)
	}

	data := &reportData{
		JobID:       jobID,
		GeneratedAt: time.Now().UTC(),
		Dashboard:   dashboard,
	}

	// Read section caches (best-effort — sections may not exist for all log types).
	if agg, err := getOrComputeAggregates(ctx, h.redis, tenantID, jobID); err == nil {
		data.Aggregates = agg
	}
	if exc, err := getOrComputeExceptions(ctx, h.redis, tenantID, jobID); err == nil {
		data.Exceptions = exc
	}
	if gaps, err := getOrComputeGaps(ctx, h.redis, tenantID, jobID); err == nil {
		data.Gaps = gaps
	}
	if threads, err := getOrComputeThreads(ctx, h.redis, tenantID, jobID); err == nil {
		data.Threads = threads
	}
	if filters, err := getOrComputeFilters(ctx, h.redis, tenantID, jobID); err == nil {
		data.Filters = filters
	}

	return data, nil
}

// generateJSONReport produces a JSON string combining all report sections.
func generateJSONReport(data *reportData) (string, error) {
	report := map[string]any{
		"job_id":       data.JobID,
		"generated_at": data.GeneratedAt.Format(time.RFC3339),
		"dashboard":    data.Dashboard,
		"aggregates":   data.Aggregates,
		"exceptions":   data.Exceptions,
		"gaps":         data.Gaps,
		"threads":      data.Threads,
		"filters":      data.Filters,
	}

	b, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal report JSON: %w", err)
	}
	return string(b), nil
}
