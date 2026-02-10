package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTenantMiddleware_ValidTenant(t *testing.T) {
	tm := NewTenantMiddleware()
	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	handler := tm.InjectTenant(inner)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	ctx := context.WithValue(req.Context(), TenantIDKey, "tenant-123")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if !called {
		t.Fatal("inner handler was not called")
	}
}

func TestTenantMiddleware_MissingTenant(t *testing.T) {
	tm := NewTenantMiddleware()
	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})

	handler := tm.InjectTenant(inner)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
	if called {
		t.Fatal("inner handler should not have been called")
	}
}
