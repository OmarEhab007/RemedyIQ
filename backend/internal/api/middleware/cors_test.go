package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCORSMiddleware_Preflight_WildcardOrigin(t *testing.T) {
	cors := CORSMiddleware([]string{"*"})

	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})

	handler := cors(inner)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
	req.Header.Set("Origin", "https://example.com")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusNoContent, w.Code)
	assert.False(t, called, "inner handler should not be called for preflight requests")
	assert.Equal(t, "https://example.com", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", w.Header().Get("Access-Control-Allow-Credentials"))
	assert.Equal(t, "86400", w.Header().Get("Access-Control-Max-Age"))
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "GET")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "POST")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "DELETE")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Authorization")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Content-Type")
	assert.Equal(t, "X-Request-ID", w.Header().Get("Access-Control-Expose-Headers"))
}

func TestCORSMiddleware_Preflight_SpecificOrigin(t *testing.T) {
	cors := CORSMiddleware([]string{"https://app.remedyiq.com"})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	handler := cors(inner)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
	req.Header.Set("Origin", "https://app.remedyiq.com")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, "https://app.remedyiq.com", w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_AllowedOrigin_GET(t *testing.T) {
	cors := CORSMiddleware([]string{"https://app.remedyiq.com"})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	handler := cors(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/data", nil)
	req.Header.Set("Origin", "https://app.remedyiq.com")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "https://app.remedyiq.com", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", w.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORSMiddleware_DisallowedOrigin(t *testing.T) {
	cors := CORSMiddleware([]string{"https://app.remedyiq.com"})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := cors(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/data", nil)
	req.Header.Set("Origin", "https://evil.com")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Request still passes through, but no CORS headers are set.
	require.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Credentials"))
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Methods"))
}

func TestCORSMiddleware_WildcardOrigin_AnyOrigin(t *testing.T) {
	cors := CORSMiddleware([]string{"*"})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := cors(inner)

	origins := []string{
		"https://example.com",
		"http://localhost:3000",
		"https://app.remedyiq.com",
		"https://random-domain.org",
	}

	for _, origin := range origins {
		t.Run(origin, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			req.Header.Set("Origin", origin)
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			require.Equal(t, http.StatusOK, w.Code)
			assert.Equal(t, origin, w.Header().Get("Access-Control-Allow-Origin"),
				"wildcard should reflect the request origin")
		})
	}
}

func TestCORSMiddleware_NoOriginHeader(t *testing.T) {
	cors := CORSMiddleware([]string{"https://app.remedyiq.com"})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := cors(inner)

	// Same-origin requests do not send an Origin header.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/data", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"),
		"no CORS headers for same-origin requests")
}

func TestCORSMiddleware_NoOriginHeader_Wildcard(t *testing.T) {
	cors := CORSMiddleware([]string{"*"})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := cors(inner)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Even with wildcard, no CORS headers when Origin is empty.
	require.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_MultipleAllowedOrigins(t *testing.T) {
	cors := CORSMiddleware([]string{
		"https://app.remedyiq.com",
		"http://localhost:3000",
		"https://staging.remedyiq.com",
	})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := cors(inner)

	t.Run("first allowed origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Origin", "https://app.remedyiq.com")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, "https://app.remedyiq.com", w.Header().Get("Access-Control-Allow-Origin"))
	})

	t.Run("second allowed origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, "http://localhost:3000", w.Header().Get("Access-Control-Allow-Origin"))
	})

	t.Run("third allowed origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Origin", "https://staging.remedyiq.com")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, "https://staging.remedyiq.com", w.Header().Get("Access-Control-Allow-Origin"))
	})

	t.Run("unlisted origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Origin", "https://not-in-the-list.com")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
	})
}

func TestCORSMiddleware_Preflight_DisallowedOrigin(t *testing.T) {
	cors := CORSMiddleware([]string{"https://app.remedyiq.com"})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	handler := cors(inner)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
	req.Header.Set("Origin", "https://evil.com")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Preflight still returns 204, but no CORS headers are set.
	require.Equal(t, http.StatusNoContent, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_AllowedHeaders_IncludesDevHeaders(t *testing.T) {
	cors := CORSMiddleware([]string{"*"})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := cors(inner)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://example.com")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	allowedHeaders := w.Header().Get("Access-Control-Allow-Headers")
	assert.Contains(t, allowedHeaders, "X-Dev-User-ID")
	assert.Contains(t, allowedHeaders, "X-Dev-Tenant-ID")
}

func TestCORSMiddleware_EmptyAllowedOrigins(t *testing.T) {
	cors := CORSMiddleware([]string{})
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := cors(inner)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://example.com")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"),
		"no origins allowed when list is empty")
}
