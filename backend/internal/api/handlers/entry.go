package handlers

import (
	"net/http"
	"strconv"

	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

type EntryHandler struct {
	ch storage.ClickHouseStore
}

func NewEntryHandler(ch storage.ClickHouseStore) *EntryHandler {
	return &EntryHandler{ch: ch}
}

func (h *EntryHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	vars := mux.Vars(r)
	jobID := vars["job_id"]
	entryID := vars["entry_id"]

	if jobID == "" || entryID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "job_id and entry_id are required")
		return
	}

	entry, err := h.ch.GetLogEntry(r.Context(), tenantID, jobID, entryID)
	if err != nil {
		api.Error(w, http.StatusNotFound, api.ErrCodeNotFound, "entry not found")
		return
	}

	api.JSON(w, http.StatusOK, entry)
}

type ContextHandler struct {
	ch storage.ClickHouseStore
}

func NewContextHandler(ch storage.ClickHouseStore) *ContextHandler {
	return &ContextHandler{ch: ch}
}

func (h *ContextHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	vars := mux.Vars(r)
	jobID := vars["job_id"]
	entryID := vars["entry_id"]

	if jobID == "" || entryID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "job_id and entry_id are required")
		return
	}

	window := 10
	if windowStr := r.URL.Query().Get("window"); windowStr != "" {
		if parsed, err := strconv.Atoi(windowStr); err == nil && parsed > 0 {
			window = parsed
		}
	}

	ctx, err := h.ch.GetEntryContext(r.Context(), tenantID, jobID, entryID, window)
	if err != nil {
		api.Error(w, http.StatusNotFound, api.ErrCodeNotFound, "entry not found")
		return
	}

	api.JSON(w, http.StatusOK, ctx)
}
