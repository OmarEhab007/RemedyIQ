package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewRouter_HealthEndpoint(t *testing.T) {
	healthHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "healthy",
			"version": "0.1.0",
		})
	})

	router := NewRouter(RouterConfig{
		AllowedOrigins: []string{"*"},
		DevMode:        true,
		ClerkSecretKey: "test-secret",
		HealthHandler:  healthHandler,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", w.Code, w.Body.String())
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if resp["status"] != "healthy" {
		t.Fatalf("expected healthy, got %s", resp["status"])
	}
}

func TestNewRouter_HealthNoAuth(t *testing.T) {
	healthHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	router := NewRouter(RouterConfig{
		AllowedOrigins: []string{"*"},
		DevMode:        false, // auth required for protected routes
		ClerkSecretKey: "test-secret",
		HealthHandler:  healthHandler,
	})

	// Health should work without any auth headers.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("health check should not require auth, got %d; body: %s", w.Code, w.Body.String())
	}
}

func TestNewRouter_StubEndpoints(t *testing.T) {
	router := NewRouter(RouterConfig{
		AllowedOrigins: []string{"*"},
		DevMode:        true,
		ClerkSecretKey: "test-secret",
	})

	tests := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/v1/health"},
		{http.MethodPost, "/api/v1/files/upload"},
		{http.MethodGet, "/api/v1/files"},
		{http.MethodPost, "/api/v1/analysis"},
		{http.MethodGet, "/api/v1/analysis"},
		{http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000"},
		{http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dashboard"},
		{http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dashboard/aggregates"},
		{http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dashboard/exceptions"},
		{http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dashboard/gaps"},
		{http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dashboard/threads"},
		{http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dashboard/filters"},
		{http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/search"},
		{http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/entries/abc123"},
		{http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/trace/trace-1"},
		{http.MethodPost, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/ai"},
		{http.MethodPost, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/report"},
		{http.MethodGet, "/api/v1/search/autocomplete"},
	}

	for _, tc := range tests {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			req.Header.Set("X-Dev-User-ID", "test-user")
			req.Header.Set("X-Dev-Tenant-ID", "test-tenant")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Stub returns 501, real handler returns 200.
			// We just verify we do not get a 404 (route not found) or 405 (method not allowed).
			if w.Code == http.StatusNotFound || w.Code == http.StatusMethodNotAllowed {
				t.Fatalf("route %s %s returned %d -- expected it to be registered", tc.method, tc.path, w.Code)
			}
		})
	}
}

func TestNewRouter_ProtectedRoute_Unauthorized(t *testing.T) {
	router := NewRouter(RouterConfig{
		AllowedOrigins: []string{"*"},
		DevMode:        false,
		ClerkSecretKey: "test-secret",
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/files", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestNewRouter_CORS_Preflight(t *testing.T) {
	router := NewRouter(RouterConfig{
		AllowedOrigins: []string{"https://app.remedyiq.com"},
		DevMode:        true,
		ClerkSecretKey: "test-secret",
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/health", nil)
	req.Header.Set("Origin", "https://app.remedyiq.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for preflight, got %d", w.Code)
	}
	if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != "https://app.remedyiq.com" {
		t.Fatalf("expected ACAO header, got %q", acao)
	}
}
