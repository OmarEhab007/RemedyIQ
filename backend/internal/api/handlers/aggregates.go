package handlers

import (
	"net/http"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
)

// AggregatesHandler serves GET /api/v1/analysis/{job_id}/dashboard/aggregates.
type AggregatesHandler struct{}

func NewAggregatesHandler() *AggregatesHandler {
	return &AggregatesHandler{}
}

func (h *AggregatesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	api.Error(w, http.StatusNotImplemented, "not_implemented", "aggregates endpoint not yet implemented")
}
