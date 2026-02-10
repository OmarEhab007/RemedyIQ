package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLoggingMiddleware_PassesThrough(t *testing.T) {
	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"ok":true}`))
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/test?foo=bar", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if !called {
		t.Fatal("inner handler was not called")
	}
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestStatusRecorder_DefaultStatus(t *testing.T) {
	w := httptest.NewRecorder()
	rec := newStatusRecorder(w)

	// Without calling WriteHeader, default should be 200.
	rec.Write([]byte("hello"))
	if rec.statusCode != http.StatusOK {
		t.Fatalf("expected default 200, got %d", rec.statusCode)
	}
	if rec.written != 5 {
		t.Fatalf("expected 5 bytes written, got %d", rec.written)
	}
}
