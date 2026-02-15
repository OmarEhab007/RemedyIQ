package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

type SavedSearchHandler struct {
	pg storage.PostgresStore
}

func NewSavedSearchHandler(pg storage.PostgresStore) *SavedSearchHandler {
	return &SavedSearchHandler{pg: pg}
}

type createSavedSearchRequest struct {
	Name     string          `json:"name"`
	KQLQuery string          `json:"kql_query"`
	Filters  json.RawMessage `json:"filters,omitempty"`
}

func (h *SavedSearchHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing user context")
		return
	}

	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid tenant ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.list(w, r, tenantUUID, userID)
	case http.MethodPost:
		h.create(w, r, tenantUUID, userID)
	default:
		api.Error(w, http.StatusMethodNotAllowed, api.ErrCodeInvalidRequest, "method not allowed")
	}
}

func (h *SavedSearchHandler) list(w http.ResponseWriter, r *http.Request, tenantID uuid.UUID, userID string) {
	searches, err := h.pg.ListSavedSearches(r.Context(), tenantID, userID)
	if err != nil {
		slog.Error("list saved searches failed", "error", err)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to retrieve saved searches")
		return
	}

	api.JSON(w, http.StatusOK, searches)
}

const maxSavedSearchesPerUser = 50

func (h *SavedSearchHandler) create(w http.ResponseWriter, r *http.Request, tenantID uuid.UUID, userID string) {
	var req createSavedSearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid JSON body")
		return
	}

	if req.Name == "" || req.KQLQuery == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "name and kql_query are required")
		return
	}

	existing, err := h.pg.ListSavedSearches(r.Context(), tenantID, userID)
	if err == nil && len(existing) >= maxSavedSearchesPerUser {
		api.Error(w, http.StatusConflict, api.ErrCodeInvalidRequest, "maximum saved searches limit reached (50)")
		return
	}

	search := &domain.SavedSearch{
		TenantID: tenantID,
		UserID:   userID,
		Name:     req.Name,
		KQLQuery: req.KQLQuery,
		Filters:  req.Filters,
	}

	if err := h.pg.CreateSavedSearch(r.Context(), search); err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to create saved search")
		return
	}

	api.JSON(w, http.StatusCreated, search)
}

type DeleteSavedSearchHandler struct {
	pg storage.PostgresStore
}

func NewDeleteSavedSearchHandler(pg storage.PostgresStore) *DeleteSavedSearchHandler {
	return &DeleteSavedSearchHandler{pg: pg}
}

func (h *DeleteSavedSearchHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		api.Error(w, http.StatusMethodNotAllowed, api.ErrCodeInvalidRequest, "method not allowed")
		return
	}

	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing user context")
		return
	}

	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid tenant ID")
		return
	}

	vars := mux.Vars(r)
	searchIDStr := vars["search_id"]
	if searchIDStr == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "search_id is required")
		return
	}

	searchID, err := uuid.Parse(searchIDStr)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid search_id")
		return
	}

	if err := h.pg.DeleteSavedSearch(r.Context(), tenantUUID, userID, searchID); err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to delete saved search")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type SearchHistoryHandler struct {
	pg storage.PostgresStore
}

func NewSearchHistoryHandler(pg storage.PostgresStore) *SearchHistoryHandler {
	return &SearchHistoryHandler{pg: pg}
}

func (h *SearchHistoryHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		api.Error(w, http.StatusMethodNotAllowed, api.ErrCodeInvalidRequest, "method not allowed")
		return
	}

	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing user context")
		return
	}

	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid tenant ID")
		return
	}

	limit := 20
	history, err := h.pg.GetSearchHistory(r.Context(), tenantUUID, userID, limit)
	if err != nil {
		// Graceful degradation: return empty array if search_history table
		// doesn't exist yet (migration 002 not applied) or any DB error.
		slog.Warn("search history query failed, returning empty", "error", err)
		api.JSON(w, http.StatusOK, []domain.SearchHistoryEntry{})
		return
	}

	api.JSON(w, http.StatusOK, history)
}
