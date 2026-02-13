package handlers

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

// FileHandlers provides HTTP handlers for file-related endpoints.
type FileHandlers struct {
	pg storage.PostgresStore
}

func NewFileHandlers(pg storage.PostgresStore) *FileHandlers {
	return &FileHandlers{pg: pg}
}

// ListFiles handles GET /api/v1/files.
func (h *FileHandlers) ListFiles() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := middleware.GetTenantID(r.Context())
		if tenantID == "" {
			api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
			return
		}

		tid, err := uuid.Parse(tenantID)
		if err != nil {
			api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid tenant_id format")
			return
		}

		files, err := h.pg.ListLogFiles(r.Context(), tid)
		if err != nil {
			api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to list files")
			return
		}

		api.JSON(w, http.StatusOK, map[string]interface{}{
			"files": files,
			"pagination": map[string]interface{}{
				"page":        1,
				"page_size":   len(files),
				"total_count": len(files),
				"total_pages": 1,
			},
		})
	})
}
