package handlers

import (
	"net/http"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
)

// ExceptionsHandler serves GET /api/v1/analysis/{job_id}/dashboard/exceptions.
type ExceptionsHandler struct{}

func NewExceptionsHandler() *ExceptionsHandler {
	return &ExceptionsHandler{}
}

func (h *ExceptionsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	api.Error(w, http.StatusNotImplemented, "not_implemented", "exceptions endpoint not yet implemented")
}
