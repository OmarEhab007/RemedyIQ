package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Ping function stubs
// ---------------------------------------------------------------------------

func okPing(_ context.Context) error   { return nil }
func failPing(_ context.Context) error { return fmt.Errorf("connection refused") }

func slowPing(ctx context.Context) error {
	select {
	case <-time.After(100 * time.Millisecond):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// ---------------------------------------------------------------------------
// Table-driven health handler tests
// ---------------------------------------------------------------------------

func TestHealthHandler_ServeHTTP(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name              string
		pgPing            PingFunc
		chPing            PingFunc
		natsPing          PingFunc
		redisPing         PingFunc
		wantHTTPStatus    int
		wantOverallStatus string
		wantServiceStatus map[string]string // service name -> expected status
		wantServiceErrors map[string]string // service name -> expected error substring
	}{
		{
			name:              "all_healthy",
			pgPing:            okPing,
			chPing:            okPing,
			natsPing:          okPing,
			redisPing:         okPing,
			wantHTTPStatus:    http.StatusOK,
			wantOverallStatus: "healthy",
			wantServiceStatus: map[string]string{
				"postgresql": "healthy",
				"clickhouse": "healthy",
				"nats":       "healthy",
				"redis":      "healthy",
			},
		},
		{
			name:              "postgresql_unhealthy_returns_503",
			pgPing:            failPing,
			chPing:            okPing,
			natsPing:          okPing,
			redisPing:         okPing,
			wantHTTPStatus:    http.StatusServiceUnavailable,
			wantOverallStatus: "degraded",
			wantServiceStatus: map[string]string{
				"postgresql": "unhealthy",
				"clickhouse": "healthy",
				"nats":       "healthy",
				"redis":      "healthy",
			},
			wantServiceErrors: map[string]string{
				"postgresql": "connection refused",
			},
		},
		{
			name:              "clickhouse_unhealthy_returns_503",
			pgPing:            okPing,
			chPing:            failPing,
			natsPing:          okPing,
			redisPing:         okPing,
			wantHTTPStatus:    http.StatusServiceUnavailable,
			wantOverallStatus: "degraded",
			wantServiceStatus: map[string]string{
				"postgresql": "healthy",
				"clickhouse": "unhealthy",
				"nats":       "healthy",
				"redis":      "healthy",
			},
			wantServiceErrors: map[string]string{
				"clickhouse": "connection refused",
			},
		},
		{
			name:              "nats_unhealthy_still_returns_200",
			pgPing:            okPing,
			chPing:            okPing,
			natsPing:          failPing,
			redisPing:         okPing,
			wantHTTPStatus:    http.StatusOK,
			wantOverallStatus: "healthy",
			wantServiceStatus: map[string]string{
				"postgresql": "healthy",
				"clickhouse": "healthy",
				"nats":       "unhealthy",
				"redis":      "healthy",
			},
			wantServiceErrors: map[string]string{
				"nats": "connection refused",
			},
		},
		{
			name:              "redis_unhealthy_still_returns_200",
			pgPing:            okPing,
			chPing:            okPing,
			natsPing:          okPing,
			redisPing:         failPing,
			wantHTTPStatus:    http.StatusOK,
			wantOverallStatus: "healthy",
			wantServiceStatus: map[string]string{
				"postgresql": "healthy",
				"clickhouse": "healthy",
				"nats":       "healthy",
				"redis":      "unhealthy",
			},
			wantServiceErrors: map[string]string{
				"redis": "connection refused",
			},
		},
		{
			name:              "all_unhealthy_returns_503",
			pgPing:            failPing,
			chPing:            failPing,
			natsPing:          failPing,
			redisPing:         failPing,
			wantHTTPStatus:    http.StatusServiceUnavailable,
			wantOverallStatus: "degraded",
			wantServiceStatus: map[string]string{
				"postgresql": "unhealthy",
				"clickhouse": "unhealthy",
				"nats":       "unhealthy",
				"redis":      "unhealthy",
			},
			wantServiceErrors: map[string]string{
				"postgresql": "connection refused",
				"clickhouse": "connection refused",
				"nats":       "connection refused",
				"redis":      "connection refused",
			},
		},
		{
			name:              "all_nil_not_configured_returns_200",
			pgPing:            nil,
			chPing:            nil,
			natsPing:          nil,
			redisPing:         nil,
			wantHTTPStatus:    http.StatusOK,
			wantOverallStatus: "healthy",
			wantServiceStatus: map[string]string{
				"postgresql": "not_configured",
				"clickhouse": "not_configured",
				"nats":       "not_configured",
				"redis":      "not_configured",
			},
		},
		{
			name:              "mixed_pg_healthy_ch_unhealthy_returns_503",
			pgPing:            okPing,
			chPing:            failPing,
			natsPing:          nil,
			redisPing:         nil,
			wantHTTPStatus:    http.StatusServiceUnavailable,
			wantOverallStatus: "degraded",
			wantServiceStatus: map[string]string{
				"postgresql": "healthy",
				"clickhouse": "unhealthy",
				"nats":       "not_configured",
				"redis":      "not_configured",
			},
			wantServiceErrors: map[string]string{
				"clickhouse": "connection refused",
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			h := NewHealthHandler(tc.pgPing, tc.chPing, tc.natsPing, tc.redisPing)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
			w := httptest.NewRecorder()
			h.ServeHTTP(w, req)

			// -- Assert HTTP status code --
			assert.Equal(t, tc.wantHTTPStatus, w.Code, "unexpected HTTP status code")

			// -- Assert Content-Type header --
			assert.Equal(t, "application/json; charset=utf-8", w.Header().Get("Content-Type"),
				"response Content-Type should be application/json")

			// -- Decode response body --
			var resp HealthResponse
			require.NoError(t, json.NewDecoder(w.Body).Decode(&resp),
				"response body must be valid JSON")

			// -- Assert overall status --
			assert.Equal(t, tc.wantOverallStatus, resp.Status, "unexpected overall status")

			// -- Assert version --
			assert.Equal(t, Version, resp.Version, "version must match the build variable")

			// -- Assert all four expected services are present --
			expectedServices := []string{"postgresql", "clickhouse", "nats", "redis"}
			for _, svcName := range expectedServices {
				_, exists := resp.Services[svcName]
				assert.True(t, exists, "service %q must be present in the response", svcName)
			}

			// -- Assert individual service statuses --
			for svcName, wantStatus := range tc.wantServiceStatus {
				actual, ok := resp.Services[svcName]
				require.True(t, ok, "service %q missing from response", svcName)
				assert.Equal(t, wantStatus, actual.Status,
					"service %q: unexpected status", svcName)

				// Healthy and not_configured services must NOT carry an error message.
				if wantStatus == "healthy" || wantStatus == "not_configured" {
					assert.Empty(t, actual.Error,
						"service %q: healthy/not_configured service must not have an error", svcName)
				}

				// Healthy services should report non-negative latency.
				if wantStatus == "healthy" {
					assert.GreaterOrEqual(t, actual.LatencyMS, int64(0),
						"service %q: latency must be non-negative", svcName)
				}

				// not_configured services should have zero latency (omitempty).
				if wantStatus == "not_configured" {
					assert.Equal(t, int64(0), actual.LatencyMS,
						"service %q: not_configured service must have zero latency", svcName)
				}
			}

			// -- Assert error messages on unhealthy services --
			for svcName, wantErr := range tc.wantServiceErrors {
				actual, ok := resp.Services[svcName]
				require.True(t, ok, "service %q missing from response", svcName)
				assert.Contains(t, actual.Error, wantErr,
					"service %q: error message mismatch", svcName)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Additional behavioural tests
// ---------------------------------------------------------------------------

// TestHealthHandler_SlowPing verifies that latency is recorded accurately when
// a ping function takes measurable time.
func TestHealthHandler_SlowPing(t *testing.T) {
	t.Parallel()

	h := NewHealthHandler(slowPing, okPing, okPing, okPing)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp HealthResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))

	pgSvc := resp.Services["postgresql"]
	assert.Equal(t, "healthy", pgSvc.Status)
	assert.GreaterOrEqual(t, pgSvc.LatencyMS, int64(50),
		"slow ping should report latency >= 50ms, got %d", pgSvc.LatencyMS)
}

// TestHealthHandler_ConcurrentPings confirms that all four pings execute
// concurrently rather than sequentially by checking that total wall-clock time
// is closer to the single-slowest ping than to the sum of all pings.
func TestHealthHandler_ConcurrentPings(t *testing.T) {
	t.Parallel()

	delayedPing := func(d time.Duration) PingFunc {
		return func(ctx context.Context) error {
			select {
			case <-time.After(d):
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}

	h := NewHealthHandler(
		delayedPing(80*time.Millisecond),
		delayedPing(80*time.Millisecond),
		delayedPing(80*time.Millisecond),
		delayedPing(80*time.Millisecond),
	)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()

	start := time.Now()
	h.ServeHTTP(w, req)
	elapsed := time.Since(start)

	require.Equal(t, http.StatusOK, w.Code)

	// If pings ran sequentially, total time would be >= 320ms.
	// Concurrent execution should complete in roughly 80-160ms.
	assert.Less(t, elapsed, 300*time.Millisecond,
		"pings should execute concurrently; total time %v suggests sequential execution", elapsed)
}

// TestHealthHandler_PingContextTimeout verifies that the 5-second timeout
// context is propagated to ping functions. A ping that blocks forever should
// be cancelled by the handler's context deadline.
func TestHealthHandler_PingContextTimeout(t *testing.T) {
	t.Parallel()

	// This ping blocks until the context is cancelled and returns the ctx error.
	blockingPing := func(ctx context.Context) error {
		<-ctx.Done()
		return ctx.Err()
	}

	h := NewHealthHandler(okPing, okPing, blockingPing, okPing)

	// Create a request with a short deadline to keep the test fast.
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil).WithContext(ctx)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	// Overall should still be 200 because only nats is affected (non-critical).
	assert.Equal(t, http.StatusOK, w.Code)

	var resp HealthResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))

	assert.Equal(t, "healthy", resp.Status, "nats is non-critical so overall remains healthy")
	assert.Equal(t, "unhealthy", resp.Services["nats"].Status,
		"blocking nats ping should be reported as unhealthy after context timeout")
	assert.NotEmpty(t, resp.Services["nats"].Error,
		"nats error message should describe the context cancellation")
}

// TestHealthHandler_ResponseContainsAllServices ensures the response always
// includes all four expected service keys regardless of which pings are
// configured.
func TestHealthHandler_ResponseContainsAllServices(t *testing.T) {
	t.Parallel()

	// Only configure PostgreSQL -- the rest should appear as not_configured.
	h := NewHealthHandler(okPing, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp HealthResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))

	expectedServices := []string{"postgresql", "clickhouse", "nats", "redis"}
	assert.Len(t, resp.Services, len(expectedServices),
		"response must contain exactly %d services", len(expectedServices))

	for _, svc := range expectedServices {
		_, ok := resp.Services[svc]
		assert.True(t, ok, "service %q must be present in the response", svc)
	}

	assert.Equal(t, "healthy", resp.Services["postgresql"].Status)
	assert.Equal(t, "not_configured", resp.Services["clickhouse"].Status)
	assert.Equal(t, "not_configured", resp.Services["nats"].Status)
	assert.Equal(t, "not_configured", resp.Services["redis"].Status)
}

// TestHealthHandler_UnhealthyServiceReportsLatency ensures that even unhealthy
// services report a non-negative latency value.
func TestHealthHandler_UnhealthyServiceReportsLatency(t *testing.T) {
	t.Parallel()

	h := NewHealthHandler(failPing, okPing, okPing, okPing)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusServiceUnavailable, w.Code)

	var resp HealthResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))

	pgSvc := resp.Services["postgresql"]
	assert.Equal(t, "unhealthy", pgSvc.Status)
	assert.GreaterOrEqual(t, pgSvc.LatencyMS, int64(0),
		"unhealthy services must still report non-negative latency")
}
