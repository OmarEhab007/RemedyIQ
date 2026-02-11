package handlers

import (
	"net/http"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
)

// FiltersHandler serves GET /api/v1/analysis/{job_id}/dashboard/filters.
type FiltersHandler struct{}

func NewFiltersHandler() *FiltersHandler {
	return &FiltersHandler{}
}

func (h *FiltersHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	api.Error(w, http.StatusNotImplemented, "not_implemented", "filters endpoint not yet implemented")
}
