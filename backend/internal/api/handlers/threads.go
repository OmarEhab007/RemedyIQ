package handlers

import (
	"net/http"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
)

// ThreadsHandler serves GET /api/v1/analysis/{job_id}/dashboard/threads.
type ThreadsHandler struct{}

func NewThreadsHandler() *ThreadsHandler {
	return &ThreadsHandler{}
}

func (h *ThreadsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	api.Error(w, http.StatusNotImplemented, "not_implemented", "threads endpoint not yet implemented")
}
