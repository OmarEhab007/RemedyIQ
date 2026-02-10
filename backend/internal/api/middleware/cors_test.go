package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSMiddleware_AllowAll(t *testing.T) {
	cors := CORSMiddleware([]string{"*"})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := cors(inner)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != "https://example.com" {
		t.Fatalf("expected origin https://example.com, got %q", acao)
	}
	if creds := w.Header().Get("Access-Control-Allow-Credentials"); creds != "true" {
		t.Fatalf("expected credentials true, got %q", creds)
	}
}

func TestCORSMiddleware_SpecificOrigin(t *testing.T) {
	cors := CORSMiddleware([]string{"https://app.remedyiq.com"})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := cors(inner)

	t.Run("allowed origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Origin", "https://app.remedyiq.com")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != "https://app.remedyiq.com" {
			t.Fatalf("expected allowed origin, got %q", acao)
		}
	})

	t.Run("disallowed origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Origin", "https://evil.com")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != "" {
			t.Fatalf("expected no ACAO header, got %q", acao)
		}
	})
}

func TestCORSMiddleware_Preflight(t *testing.T) {
	cors := CORSMiddleware([]string{"*"})
	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})
	handler := cors(inner)

	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "https://example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for preflight, got %d", w.Code)
	}
	if called {
		t.Fatal("inner handler should not be called for preflight")
	}
}

func TestCORSMiddleware_NoOrigin(t *testing.T) {
	cors := CORSMiddleware([]string{"https://app.remedyiq.com"})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := cors(inner)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	// No Origin header (same-origin request).
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != "" {
		t.Fatalf("expected no ACAO header for same-origin, got %q", acao)
	}
}
