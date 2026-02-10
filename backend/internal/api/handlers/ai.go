package handlers

import (
	"encoding/json"
	"net/http"

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
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, err.Error())
		return
	}

	api.JSON(w, http.StatusOK, output)
}

// ListSkillsHandler serves GET /api/v1/ai/skills.
type ListSkillsHandler struct {
	registry *ai.Registry
}

// NewListSkillsHandler creates a new list skills handler.
func NewListSkillsHandler(registry *ai.Registry) *ListSkillsHandler {
	return &ListSkillsHandler{registry: registry}
}

func (h *ListSkillsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	skills := h.registry.List()
	api.JSON(w, http.StatusOK, map[string]interface{}{
		"skills": skills,
	})
}
