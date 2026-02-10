package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func okPing(_ context.Context) error { return nil }

func failPing(_ context.Context) error { return fmt.Errorf("connection refused") }

func slowPing(ctx context.Context) error {
	select {
	case <-time.After(100 * time.Millisecond):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func TestHealthHandler_AllHealthy(t *testing.T) {
	h := NewHealthHandler(okPing, okPing, okPing, okPing)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp HealthResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if resp.Status != "healthy" {
		t.Fatalf("expected healthy, got %s", resp.Status)
	}
	if resp.Version != Version {
		t.Fatalf("expected version %s, got %s", Version, resp.Version)
	}

	for name, svc := range resp.Services {
		if svc.Status != "healthy" {
			t.Fatalf("service %s expected healthy, got %s", name, svc.Status)
		}
	}
}

func TestHealthHandler_CriticalDown(t *testing.T) {
	// PostgreSQL is down, which is critical.
	h := NewHealthHandler(failPing, okPing, okPing, okPing)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	var resp HealthResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if resp.Status != "degraded" {
		t.Fatalf("expected degraded, got %s", resp.Status)
	}
	if resp.Services["postgresql"].Status != "unhealthy" {
		t.Fatalf("expected postgresql unhealthy, got %s", resp.Services["postgresql"].Status)
	}
	if resp.Services["postgresql"].Error != "connection refused" {
		t.Fatalf("expected error message, got %q", resp.Services["postgresql"].Error)
	}
}

func TestHealthHandler_ClickHouseDown(t *testing.T) {
	// ClickHouse is also critical.
	h := NewHealthHandler(okPing, failPing, okPing, okPing)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}
}

func TestHealthHandler_NonCriticalDown(t *testing.T) {
	// Redis is down but not critical.
	h := NewHealthHandler(okPing, okPing, okPing, failPing)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	// Still 200 because only pg and clickhouse are critical.
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp HealthResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if resp.Status != "healthy" {
		t.Fatalf("expected healthy, got %s", resp.Status)
	}
	if resp.Services["redis"].Status != "unhealthy" {
		t.Fatalf("expected redis unhealthy, got %s", resp.Services["redis"].Status)
	}
}

func TestHealthHandler_NilPings(t *testing.T) {
	// All pings nil -- should report not_configured for all.
	h := NewHealthHandler(nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp HealthResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	for _, name := range []string{"postgresql", "clickhouse", "nats", "redis"} {
		if resp.Services[name].Status != "not_configured" {
			t.Fatalf("expected %s not_configured, got %s", name, resp.Services[name].Status)
		}
	}
}

func TestHealthHandler_SlowPing(t *testing.T) {
	h := NewHealthHandler(slowPing, okPing, okPing, okPing)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp HealthResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	pgSvc := resp.Services["postgresql"]
	if pgSvc.LatencyMS < 50 {
		t.Fatalf("expected latency >= 50ms for slow ping, got %d", pgSvc.LatencyMS)
	}
}
