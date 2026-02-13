package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
)

// ---------------------------------------------------------------------------
// newUpgrader unit tests (origin validation)
// ---------------------------------------------------------------------------

func TestNewUpgrader_WildcardAllowsAnyOrigin(t *testing.T) {
	u := newUpgrader([]string{"*"})

	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	req.Header.Set("Origin", "https://unknown-origin.example.com")
	assert.True(t, u.CheckOrigin(req))
}

func TestNewUpgrader_AllowedOriginsExactMatch(t *testing.T) {
	u := newUpgrader([]string{"https://app.example.com", "https://admin.example.com"})

	tests := []struct {
		name    string
		origin  string
		allowed bool
	}{
		{"allowed_origin_1", "https://app.example.com", true},
		{"allowed_origin_2", "https://admin.example.com", true},
		{"disallowed_origin", "https://evil.example.com", false},
		{"empty_origin", "", false},
		{"subdomain_mismatch", "https://sub.app.example.com", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/ws", nil)
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			assert.Equal(t, tc.allowed, u.CheckOrigin(req))
		})
	}
}

func TestNewUpgrader_EmptyAllowedOrigins(t *testing.T) {
	u := newUpgrader([]string{})

	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	req.Header.Set("Origin", "https://any.example.com")
	assert.False(t, u.CheckOrigin(req))
}

// ---------------------------------------------------------------------------
// StreamHandler.ServeHTTP tests
// ---------------------------------------------------------------------------

func TestStreamHandler_MissingTenantContext(t *testing.T) {
	hub := streaming.NewHub()
	go hub.Run()

	handler := NewStreamHandler(hub, []string{"*"})

	// No tenant context injected.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/ws", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "unauthorized")
}

func TestStreamHandler_SuccessfulWebSocketUpgrade(t *testing.T) {
	hub := streaming.NewHub()
	go hub.Run()

	handler := NewStreamHandler(hub, []string{"*"})

	// Wrap handler to inject tenant context.
	wrappedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := middleware.WithTenantID(r.Context(), "test-tenant")
		ctx = middleware.WithUserID(ctx, "test-user")
		handler.ServeHTTP(w, r.WithContext(ctx))
	})

	srv := httptest.NewServer(wrappedHandler)
	defer srv.Close()

	// Convert http:// to ws://.
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/v1/ws"

	dialer := websocket.Dialer{}
	conn, resp, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)

	// Send a ping message and expect a pong back.
	err = conn.WriteJSON(streaming.ClientMessage{Type: "ping"})
	require.NoError(t, err)

	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var serverMsg streaming.ServerMessage
	err = conn.ReadJSON(&serverMsg)
	require.NoError(t, err)
	assert.Equal(t, "pong", serverMsg.Type)
}

func TestStreamHandler_WebSocketMessageHandling(t *testing.T) {
	hub := streaming.NewHub()
	go hub.Run()

	handler := NewStreamHandler(hub, []string{"*"})

	wrappedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := middleware.WithTenantID(r.Context(), "test-tenant")
		ctx = middleware.WithUserID(ctx, "test-user")
		handler.ServeHTTP(w, r.WithContext(ctx))
	})

	srv := httptest.NewServer(wrappedHandler)
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/v1/ws"

	dialer := websocket.Dialer{}
	conn, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	// Test unknown message type.
	err = conn.WriteJSON(streaming.ClientMessage{Type: "unknown_type"})
	require.NoError(t, err)

	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var serverMsg streaming.ServerMessage
	err = conn.ReadJSON(&serverMsg)
	require.NoError(t, err)
	assert.Equal(t, "error", serverMsg.Type)
}

func TestStreamHandler_SubscribeJobProgress(t *testing.T) {
	hub := streaming.NewHub()
	go hub.Run()

	handler := NewStreamHandler(hub, []string{"*"})

	wrappedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := middleware.WithTenantID(r.Context(), "test-tenant")
		ctx = middleware.WithUserID(ctx, "test-user")
		handler.ServeHTTP(w, r.WithContext(ctx))
	})

	srv := httptest.NewServer(wrappedHandler)
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/v1/ws"

	dialer := websocket.Dialer{}
	conn, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	// Subscribe with empty job_id — should get error.
	err = conn.WriteJSON(map[string]interface{}{
		"type":    "subscribe_job_progress",
		"payload": map[string]string{"job_id": ""},
	})
	require.NoError(t, err)

	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var serverMsg streaming.ServerMessage
	err = conn.ReadJSON(&serverMsg)
	require.NoError(t, err)
	assert.Equal(t, "error", serverMsg.Type)
}

func TestStreamHandler_InvalidJSON(t *testing.T) {
	hub := streaming.NewHub()
	go hub.Run()

	handler := NewStreamHandler(hub, []string{"*"})

	wrappedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := middleware.WithTenantID(r.Context(), "test-tenant")
		ctx = middleware.WithUserID(ctx, "test-user")
		handler.ServeHTTP(w, r.WithContext(ctx))
	})

	srv := httptest.NewServer(wrappedHandler)
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/v1/ws"

	dialer := websocket.Dialer{}
	conn, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	// Send invalid JSON.
	err = conn.WriteMessage(websocket.TextMessage, []byte("{broken"))
	require.NoError(t, err)

	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var serverMsg streaming.ServerMessage
	err = conn.ReadJSON(&serverMsg)
	require.NoError(t, err)
	assert.Equal(t, "error", serverMsg.Type)
}

func TestStreamHandler_OriginRejection(t *testing.T) {
	hub := streaming.NewHub()
	go hub.Run()

	handler := NewStreamHandler(hub, []string{"https://allowed.example.com"})

	wrappedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := middleware.WithTenantID(r.Context(), "test-tenant")
		ctx = middleware.WithUserID(ctx, "test-user")
		handler.ServeHTTP(w, r.WithContext(ctx))
	})

	srv := httptest.NewServer(wrappedHandler)
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/v1/ws"

	// Set a disallowed origin.
	dialer := websocket.Dialer{}
	header := http.Header{}
	header.Set("Origin", "https://evil.example.com")

	_, resp, err := dialer.Dial(wsURL, header)
	assert.Error(t, err)
	if resp != nil {
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	}
}

func TestNewStreamHandler_Constructor(t *testing.T) {
	hub := streaming.NewHub()
	handler := NewStreamHandler(hub, []string{"https://example.com"})

	assert.NotNil(t, handler)
	assert.NotNil(t, handler.hub)
}
