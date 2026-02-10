package handlers

import (
	"log/slog"
	"net/http"

	"github.com/gorilla/websocket"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true // CORS is handled by middleware
	},
}

// StreamHandler handles GET /api/v1/ws — upgrades to WebSocket.
type StreamHandler struct {
	hub *streaming.Hub
}

func NewStreamHandler(hub *streaming.Hub) *StreamHandler {
	return &StreamHandler{hub: hub}
}

func (h *StreamHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("websocket upgrade failed", "error", err)
		return
	}

	// NewClient auto-registers with the hub.
	client := streaming.NewClient(h.hub, conn, tenantID)

	go client.WritePump()
	go client.ReadPump()
}
