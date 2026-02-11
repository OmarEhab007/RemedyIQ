package handlers

import (
	"net/http"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
)

// GapsHandler serves GET /api/v1/analysis/{job_id}/dashboard/gaps.
type GapsHandler struct{}

func NewGapsHandler() *GapsHandler {
	return &GapsHandler{}
}

func (h *GapsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	api.Error(w, http.StatusNotImplemented, "not_implemented", "gaps endpoint not yet implemented")
}
