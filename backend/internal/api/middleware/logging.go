package middleware

import (
	"bufio"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"
)

// statusRecorder wraps http.ResponseWriter to capture the status code.
type statusRecorder struct {
	http.ResponseWriter
	statusCode int
	written    int64
}

func newStatusRecorder(w http.ResponseWriter) *statusRecorder {
	return &statusRecorder{
		ResponseWriter: w,
		statusCode:     http.StatusOK, // default if WriteHeader is never called
	}
}

func (sr *statusRecorder) WriteHeader(code int) {
	sr.statusCode = code
	sr.ResponseWriter.WriteHeader(code)
}

func (sr *statusRecorder) Write(b []byte) (int, error) {
	n, err := sr.ResponseWriter.Write(b)
	sr.written += int64(n)
	return n, err
}

// Hijack implements http.Hijacker for WebSocket connections.
// It delegates to the underlying ResponseWriter if it supports hijacking.
func (sr *statusRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if h, ok := sr.ResponseWriter.(http.Hijacker); ok {
		return h.Hijack()
	}
	return nil, nil, fmt.Errorf("response writer does not support hijacking")
}

// LoggingMiddleware logs every HTTP request using slog structured logging.
// It records the method, path, status code, response size, and duration.
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := newStatusRecorder(w)

		next.ServeHTTP(rec, r)

		duration := time.Since(start)

		// Choose log level based on status code.
		level := slog.LevelInfo
		if rec.statusCode >= 500 {
			level = slog.LevelError
		} else if rec.statusCode >= 400 {
			level = slog.LevelWarn
		}

		slog.Log(r.Context(), level, "http request",
			"method", r.Method,
			"path", r.URL.Path,
			"query", r.URL.RawQuery,
			"status", rec.statusCode,
			"bytes", rec.written,
			"duration_ms", duration.Milliseconds(),
			"remote_addr", r.RemoteAddr,
			"user_agent", r.UserAgent(),
			"tenant_id", GetTenantID(r.Context()),
			"user_id", GetUserID(r.Context()),
		)
	})
}
