package middleware

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBodyLimitMiddleware_RejectsOversizedJSON(t *testing.T) {
	handler := BodyLimitMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	// Create a body that exceeds 1 MB.
	largeBody := strings.Repeat("x", int(MaxJSONBodySize)+1)
	req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(largeBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code == http.StatusOK {
		t.Fatal("expected request to be rejected due to body size, but got 200")
	}
}

func TestBodyLimitMiddleware_AllowsNormalJSON(t *testing.T) {
	handler := BodyLimitMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	body := `{"query": "What are the slowest API calls?"}`
	req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for normal-sized body, got %d", w.Code)
	}
}

func TestBodyLimitMiddleware_SkipsMultipartUploads(t *testing.T) {
	handler := BodyLimitMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Read a bit to verify the body was not limited.
		buf := make([]byte, int(MaxJSONBodySize)+1)
		n, _ := r.Body.Read(buf)
		if n < int(MaxJSONBodySize) {
			t.Fatalf("expected to read >1MB from multipart body, only got %d bytes", n)
		}
		w.WriteHeader(http.StatusOK)
	}))

	// Simulate a large multipart upload.
	largeBody := strings.Repeat("x", int(MaxJSONBodySize)+100)
	req := httptest.NewRequest(http.MethodPost, "/upload", strings.NewReader(largeBody))
	req.Header.Set("Content-Type", "multipart/form-data; boundary=---abc123")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for multipart upload, got %d", w.Code)
	}
}

func TestBodyLimitMiddleware_AllowsGETRequests(t *testing.T) {
	handler := BodyLimitMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for GET request, got %d", w.Code)
	}
}
