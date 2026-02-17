package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
)

// AIHandler serves POST /api/v1/analysis/{job_id}/ai.
type AIHandler struct {
	registry *ai.Registry
}

// NewAIHandler creates a new AI handler.
func NewAIHandler(registry *ai.Registry) *AIHandler {
	return &AIHandler{registry: registry}
}

// aiRequest represents the request body for AI queries.
type aiRequest struct {
	Query     string `json:"query"`
	SkillName string `json:"skill_name"`
}

func (h *AIHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	jobID := mux.Vars(r)["job_id"]
	if jobID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "job_id is required")
		return
	}

	var req aiRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid JSON body")
		return
	}

	if req.Query == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "query is required")
		return
	}

	if req.SkillName == "" {
		req.SkillName = "nl_query"
	}

	input := ai.SkillInput{
		Query:    req.Query,
		JobID:    jobID,
		TenantID: tenantID,
	}

	output, err := h.registry.Execute(r.Context(), req.SkillName, input)
	if err != nil {
		// Distinguish between "skill not found" (client error) and
		// internal execution errors (server error).
		errMsg := err.Error()
		if strings.Contains(errMsg, "not found") {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, errMsg)
			return
		}

		// For validation errors from the skill (missing tenant_id, job_id, query),
		// return 400.
		if strings.Contains(errMsg, "is required") {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, errMsg)
			return
		}

		// Any other error is an internal server error -- log the details
		// but return a user-friendly message.
		slog.Error("AI skill execution failed",
			"skill", req.SkillName,
			"job_id", jobID,
			"tenant_id", tenantID,
			"error", err,
		)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError,
			"AI service is temporarily unavailable. Please try again later.")
		return
	}

	api.JSON(w, http.StatusOK, output)
}

// ListSkillsHandler serves GET /api/v1/ai/skills.
type ListSkillsHandler struct {
	registry *ai.Registry
	router   *ai.Router
}

// NewListSkillsHandler creates a new list skills handler.
func NewListSkillsHandler(registry *ai.Registry, router *ai.Router) *ListSkillsHandler {
	return &ListSkillsHandler{registry: registry, router: router}
}

func (h *ListSkillsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var skills []ai.SkillInfo
	if h.router != nil {
		skills = h.registry.ListWithKeywords(h.router)
	} else {
		skills = h.registry.List()
	}
	api.JSON(w, http.StatusOK, map[string]interface{}{
		"skills": skills,
	})
}

type TraceAnalyzeHandler struct {
	registry *ai.Registry
}

func NewTraceAnalyzeHandler(registry *ai.Registry) *TraceAnalyzeHandler {
	return &TraceAnalyzeHandler{registry: registry}
}

type traceAnalyzeRequest struct {
	TraceID string `json:"trace_id"`
	Focus   string `json:"focus"`
}

func (h *TraceAnalyzeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	jobID := mux.Vars(r)["job_id"]
	if jobID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "job_id is required")
		return
	}

	var req traceAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid JSON body")
		return
	}

	if req.TraceID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "trace_id is required")
		return
	}

	if req.Focus == "" {
		req.Focus = "bottleneck"
	}

	input := ai.SkillInput{
		Query:    req.Focus,
		JobID:    jobID,
		TenantID: tenantID,
		Context: map[string]interface{}{
			"trace_id": req.TraceID,
		},
	}

	output, err := h.registry.Execute(r.Context(), "trace_analyzer", input)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "not found") {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, errMsg)
			return
		}

		if strings.Contains(errMsg, "is required") {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, errMsg)
			return
		}

		slog.Error("Trace analyzer skill execution failed",
			"skill", "trace_analyzer",
			"job_id", jobID,
			"trace_id", req.TraceID,
			"tenant_id", tenantID,
			"error", err,
		)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError,
			"AI analysis is temporarily unavailable. Please try again later.")
		return
	}

	api.JSON(w, http.StatusOK, output)
}
