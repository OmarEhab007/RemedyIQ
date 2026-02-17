package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

type ConversationsHandler struct {
	db *storage.PostgresClient
}

func NewConversationsHandler(db *storage.PostgresClient) *ConversationsHandler {
	return &ConversationsHandler{db: db}
}

func (h *ConversationsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid tenant ID")
		return
	}

	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing user context")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.list(w, r, tenantUUID, userID)
	case http.MethodPost:
		h.create(w, r, tenantUUID, userID)
	default:
		api.Error(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
	}
}

func (h *ConversationsHandler) list(w http.ResponseWriter, r *http.Request, tenantID uuid.UUID, userID string) {
	jobIDStr := r.URL.Query().Get("job_id")
	if jobIDStr == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "job_id is required")
		return
	}

	jobID, err := uuid.Parse(jobIDStr)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid job_id")
		return
	}

	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
			limit = parsed
		}
	}

	conversations, err := h.db.ListConversations(r.Context(), tenantID, userID, jobID, limit)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to list conversations")
		return
	}

	for i := range conversations {
		conversations[i].Messages = nil
	}

	api.JSON(w, http.StatusOK, map[string]interface{}{
		"conversations": conversations,
		"total":         len(conversations),
	})
}

func (h *ConversationsHandler) create(w http.ResponseWriter, r *http.Request, tenantID uuid.UUID, userID string) {
	var req struct {
		JobID string `json:"job_id"`
		Title string `json:"title"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid JSON body")
		return
	}

	if req.JobID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "job_id is required")
		return
	}

	jobID, err := uuid.Parse(req.JobID)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid job_id")
		return
	}

	conv := &domain.Conversation{
		TenantID: tenantID,
		UserID:   userID,
		JobID:    jobID,
		Title:    req.Title,
	}

	if err := h.db.CreateConversation(r.Context(), conv); err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to create conversation")
		return
	}

	api.JSON(w, http.StatusCreated, conv)
}

type ConversationDetailHandler struct {
	db *storage.PostgresClient
}

func NewConversationDetailHandler(db *storage.PostgresClient) *ConversationDetailHandler {
	return &ConversationDetailHandler{db: db}
}

func (h *ConversationDetailHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid tenant ID")
		return
	}

	conversationIDStr := mux.Vars(r)["id"]
	conversationID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid conversation ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.get(w, r, tenantUUID, conversationID)
	case http.MethodDelete:
		h.delete(w, r, tenantUUID, conversationID)
	default:
		api.Error(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
	}
}

func (h *ConversationDetailHandler) get(w http.ResponseWriter, r *http.Request, tenantID, conversationID uuid.UUID) {
	limit := 50
	if l := r.URL.Query().Get("message_limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	conv, err := h.db.GetConversationWithMessages(r.Context(), tenantID, conversationID, limit)
	if err != nil {
		api.Error(w, http.StatusNotFound, api.ErrCodeNotFound, "conversation not found")
		return
	}

	api.JSON(w, http.StatusOK, conv)
}

func (h *ConversationDetailHandler) delete(w http.ResponseWriter, r *http.Request, tenantID, conversationID uuid.UUID) {
	if err := h.db.DeleteConversation(r.Context(), tenantID, conversationID); err != nil {
		api.Error(w, http.StatusNotFound, api.ErrCodeNotFound, "conversation not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
