package middleware

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// captureLogs redirects slog output to a buffer for the duration of a test
// and returns the buffer. The original logger is restored via t.Cleanup.
func captureLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	original := slog.Default()
	handler := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	slog.SetDefault(slog.New(handler))
	t.Cleanup(func() {
		slog.SetDefault(original)
	})
	return &buf
}

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

	assert.True(t, called, "inner handler should have been called")
	require.Equal(t, http.StatusCreated, w.Code)
	assert.Equal(t, `{"ok":true}`, w.Body.String())
}

func TestLoggingMiddleware_LogsMethodAndPath(t *testing.T) {
	logBuf := captureLogs(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/logs?severity=error", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	output := logBuf.String()
	assert.Contains(t, output, "http request")
	assert.Contains(t, output, "GET")
	assert.Contains(t, output, "/api/v1/logs")
}

func TestLoggingMiddleware_LogsStatusCode(t *testing.T) {
	logBuf := captureLogs(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/missing", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	output := logBuf.String()
	assert.Contains(t, output, "404")
}

func TestLoggingMiddleware_LogsDuration(t *testing.T) {
	logBuf := captureLogs(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(5 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/slow", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	output := logBuf.String()
	assert.Contains(t, output, "duration_ms")
}

func TestLoggingMiddleware_LogsBytesWritten(t *testing.T) {
	logBuf := captureLogs(t)

	body := "hello world"
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(body))
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	output := logBuf.String()
	assert.Contains(t, output, "bytes")
}

func TestLoggingMiddleware_DefaultStatusCode200(t *testing.T) {
	logBuf := captureLogs(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// WriteHeader is never called -- default should be 200.
		w.Write([]byte("ok"))
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	output := logBuf.String()
	assert.Contains(t, output, "200")
}

func TestLoggingMiddleware_500LogsAtErrorLevel(t *testing.T) {
	logBuf := captureLogs(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/error", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	output := logBuf.String()
	assert.Contains(t, output, "ERROR")
}

func TestLoggingMiddleware_400LogsAtWarnLevel(t *testing.T) {
	logBuf := captureLogs(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/bad", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	output := logBuf.String()
	assert.Contains(t, output, "WARN")
}

func TestLoggingMiddleware_200LogsAtInfoLevel(t *testing.T) {
	logBuf := captureLogs(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	output := logBuf.String()
	assert.Contains(t, output, "INFO")
}

func TestLoggingMiddleware_LogsQueryString(t *testing.T) {
	logBuf := captureLogs(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/search?q=hello&limit=10", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	output := logBuf.String()
	assert.Contains(t, output, "q=hello&limit=10")
}

func TestLoggingMiddleware_LogsUserAndTenantFromContext(t *testing.T) {
	logBuf := captureLogs(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	ctx := WithUserID(req.Context(), "usr_abc")
	ctx = WithTenantID(ctx, "tnt_xyz")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	output := logBuf.String()
	assert.Contains(t, output, "usr_abc")
	assert.Contains(t, output, "tnt_xyz")
}

// --- statusRecorder tests ---------------------------------------------------

func TestStatusRecorder_DefaultStatus(t *testing.T) {
	w := httptest.NewRecorder()
	rec := newStatusRecorder(w)

	// Without calling WriteHeader, default should be 200.
	n, err := rec.Write([]byte("hello"))
	require.NoError(t, err)

	assert.Equal(t, http.StatusOK, rec.statusCode)
	assert.Equal(t, 5, n)
	assert.Equal(t, int64(5), rec.written)
}

func TestStatusRecorder_ExplicitStatus(t *testing.T) {
	w := httptest.NewRecorder()
	rec := newStatusRecorder(w)

	rec.WriteHeader(http.StatusNotFound)
	assert.Equal(t, http.StatusNotFound, rec.statusCode)
}

func TestStatusRecorder_MultipleWrites(t *testing.T) {
	w := httptest.NewRecorder()
	rec := newStatusRecorder(w)

	rec.Write([]byte("hello"))
	rec.Write([]byte(" world"))

	assert.Equal(t, int64(11), rec.written)
}

func TestStatusRecorder_Hijack_Unsupported(t *testing.T) {
	w := httptest.NewRecorder()
	rec := newStatusRecorder(w)

	// httptest.ResponseRecorder does not implement Hijacker.
	_, _, err := rec.Hijack()
	assert.Error(t, err)
}

func TestStatusRecorder_Flush(t *testing.T) {
	w := httptest.NewRecorder()
	rec := newStatusRecorder(w)

	// httptest.ResponseRecorder implements Flusher.
	// This should not panic.
	rec.Flush()
	assert.True(t, w.Flushed)
}

func TestStatusRecorder_Push_Unsupported(t *testing.T) {
	w := httptest.NewRecorder()
	rec := newStatusRecorder(w)

	// httptest.ResponseRecorder does not implement Pusher.
	err := rec.Push("/resource", nil)
	assert.Error(t, err)
}

func TestLoggingMiddleware_LargeResponseBody(t *testing.T) {
	logBuf := captureLogs(t)

	largeBody := strings.Repeat("x", 10000)
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(largeBody))
	})

	handler := LoggingMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/large", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	output := logBuf.String()
	assert.Contains(t, output, "http request")
	// The bytes logged should reflect the full body size.
	assert.Contains(t, output, "10000")
}
