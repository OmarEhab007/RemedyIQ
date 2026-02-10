package handlers

import (
	"log/slog"
	"net/http"

	"github.com/gorilla/websocket"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
)

// newUpgrader creates a websocket.Upgrader that validates the Origin header
// against the provided allowlist. If allowedOrigins contains "*", all origins
// are permitted (development convenience). Otherwise the request's Origin
// header must match one of the listed values exactly.
func newUpgrader(allowedOrigins []string) websocket.Upgrader {
	allowAll := false
	originSet := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		if o == "*" {
			allowAll = true
			break
		}
		originSet[o] = struct{}{}
	}

	return websocket.Upgrader{
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
		CheckOrigin: func(r *http.Request) bool {
			if allowAll {
				return true
			}
			origin := r.Header.Get("Origin")
			if origin == "" {
				return false
			}
			_, ok := originSet[origin]
			return ok
		},
	}
}

// StreamHandler handles GET /api/v1/ws -- upgrades to WebSocket.
type StreamHandler struct {
	hub      *streaming.Hub
	upgrader websocket.Upgrader
}

func NewStreamHandler(hub *streaming.Hub, allowedOrigins []string) *StreamHandler {
	return &StreamHandler{
		hub:      hub,
		upgrader: newUpgrader(allowedOrigins),
	}
}

func (h *StreamHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("websocket upgrade failed", "error", err)
		return
	}

	// NewClient auto-registers with the hub.
	client := streaming.NewClient(h.hub, conn, tenantID)

	go client.WritePump()
	go client.ReadPump()
}
