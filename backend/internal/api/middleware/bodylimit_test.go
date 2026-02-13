package middleware

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBodyLimitMiddleware_WithinLimit_Passes(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.Equal(t, `{"query":"test"}`, string(body))
		w.WriteHeader(http.StatusOK)
	})

	handler := BodyLimitMiddleware(inner)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/query", strings.NewReader(`{"query":"test"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestBodyLimitMiddleware_ExactlyAtLimit_Passes(t *testing.T) {
	// Body exactly at the 1 MB limit.
	body := strings.Repeat("x", int(MaxJSONBodySize))

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		data, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.Len(t, data, int(MaxJSONBodySize))
		w.WriteHeader(http.StatusOK)
	})

	handler := BodyLimitMiddleware(inner)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/data", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestBodyLimitMiddleware_ExceedsLimit_Returns413(t *testing.T) {
	// Body is 1 byte over the limit.
	body := strings.Repeat("x", int(MaxJSONBodySize)+1)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := BodyLimitMiddleware(inner)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/data", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// MaxBytesReader triggers a 413 when the handler tries to read.
	assert.NotEqual(t, http.StatusOK, w.Code, "oversized body should not return 200")
}

func TestBodyLimitMiddleware_SignificantlyOverLimit(t *testing.T) {
	// Body is 2x the limit.
	body := strings.Repeat("x", int(MaxJSONBodySize)*2)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := BodyLimitMiddleware(inner)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/data", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestBodyLimitMiddleware_GET_NoLimitCheck(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := BodyLimitMiddleware(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/data", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestBodyLimitMiddleware_DELETE_NilBody(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	handler := BodyLimitMiddleware(inner)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/resource/123", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusNoContent, w.Code)
}

func TestBodyLimitMiddleware_SkipsMultipartFormData(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Read well beyond the JSON limit to prove it was not restricted.
		buf := make([]byte, int(MaxJSONBodySize)+1)
		n, _ := r.Body.Read(buf)
		assert.Greater(t, n, int(MaxJSONBodySize),
			"multipart body should not be limited by BodyLimitMiddleware")
		w.WriteHeader(http.StatusOK)
	})

	handler := BodyLimitMiddleware(inner)

	largeBody := strings.Repeat("x", int(MaxJSONBodySize)+100)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/upload", strings.NewReader(largeBody))
	req.Header.Set("Content-Type", "multipart/form-data; boundary=---abc123")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestBodyLimitMiddleware_NonMultipart_ContentType(t *testing.T) {
	// text/plain is not multipart, so the body limit should apply.
	body := strings.Repeat("x", int(MaxJSONBodySize)+1)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := BodyLimitMiddleware(inner)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/data", strings.NewReader(body))
	req.Header.Set("Content-Type", "text/plain")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestBodyLimitMiddleware_EmptyBody_Passes(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		data, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.Empty(t, data)
		w.WriteHeader(http.StatusOK)
	})

	handler := BodyLimitMiddleware(inner)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/data", strings.NewReader(""))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestBodyLimitMiddleware_MaxJSONBodySize_Is1MB(t *testing.T) {
	// Verify the constant is exactly 1 MB.
	assert.Equal(t, int64(1<<20), MaxJSONBodySize)
	assert.Equal(t, int64(1048576), MaxJSONBodySize)
}

func TestBodyLimitMiddleware_PUT_WithinLimit(t *testing.T) {
	body := `{"name":"updated resource","value":42}`

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		data, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.Equal(t, body, string(data))
		w.WriteHeader(http.StatusOK)
	})

	handler := BodyLimitMiddleware(inner)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/resource/1", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestBodyLimitMiddleware_PATCH_ExceedsLimit(t *testing.T) {
	body := strings.Repeat("a", int(MaxJSONBodySize)+500)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := BodyLimitMiddleware(inner)
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/resource/1", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestBodyLimitMiddleware_NoContentType_StillLimits(t *testing.T) {
	// Without Content-Type, the body limit should still apply (it is not multipart).
	body := strings.Repeat("x", int(MaxJSONBodySize)+1)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := BodyLimitMiddleware(inner)
	req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(body))
	// No Content-Type header set.
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusOK, w.Code)
}
