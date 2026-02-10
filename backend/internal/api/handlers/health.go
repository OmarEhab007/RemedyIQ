package handlers

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
)

// Version is set at build time via -ldflags. Defaults to "0.1.0-dev".
var Version = "0.1.0"

// ServiceStatus represents the health of a single backing service.
type ServiceStatus struct {
	Status    string `json:"status"`
	LatencyMS int64  `json:"latency_ms,omitempty"`
	Error     string `json:"error,omitempty"`
}

// HealthResponse is the JSON body returned by the health endpoint.
type HealthResponse struct {
	Status   string                   `json:"status"`
	Version  string                   `json:"version"`
	Services map[string]ServiceStatus `json:"services"`
}

// PingFunc is the signature for a function that checks connectivity to a
// backing service. It should return nil when the service is reachable.
type PingFunc func(ctx context.Context) error

// HealthHandler implements the GET /api/v1/health endpoint. It checks
// connectivity to PostgreSQL, ClickHouse, NATS, and Redis and reports
// individual and aggregate health status.
type HealthHandler struct {
	pings map[string]PingFunc
}

// NewHealthHandler creates a HealthHandler with ping functions for each
// backing service. Any ping function may be nil, in which case that service
// is reported as "not_configured".
func NewHealthHandler(pgPing, chPing, natsPing, redisPing PingFunc) *HealthHandler {
	pings := make(map[string]PingFunc)
	if pgPing != nil {
		pings["postgresql"] = pgPing
	}
	if chPing != nil {
		pings["clickhouse"] = chPing
	}
	if natsPing != nil {
		pings["nats"] = natsPing
	}
	if redisPing != nil {
		pings["redis"] = redisPing
	}
	return &HealthHandler{pings: pings}
}

// ServeHTTP handles the health check request. It pings all configured
// services concurrently and returns 200 when all are healthy or 503 when
// any critical service (PostgreSQL, ClickHouse) is down.
func (h *HealthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	services := make(map[string]ServiceStatus)
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Check every configured service concurrently.
	for name, ping := range h.pings {
		wg.Add(1)
		go func(name string, ping PingFunc) {
			defer wg.Done()

			start := time.Now()
			err := ping(ctx)
			latency := time.Since(start).Milliseconds()

			mu.Lock()
			defer mu.Unlock()

			if err != nil {
				services[name] = ServiceStatus{
					Status:    "unhealthy",
					LatencyMS: latency,
					Error:     err.Error(),
				}
			} else {
				services[name] = ServiceStatus{
					Status:    "healthy",
					LatencyMS: latency,
				}
			}
		}(name, ping)
	}

	wg.Wait()

	// Report services that were not configured.
	for _, expected := range []string{"postgresql", "clickhouse", "nats", "redis"} {
		if _, ok := services[expected]; !ok {
			services[expected] = ServiceStatus{Status: "not_configured"}
		}
	}

	// Determine aggregate status. PostgreSQL and ClickHouse are critical.
	criticalServices := []string{"postgresql", "clickhouse"}
	overallHealthy := true
	for _, svc := range criticalServices {
		if s, ok := services[svc]; ok && s.Status == "unhealthy" {
			overallHealthy = false
			break
		}
	}

	resp := HealthResponse{
		Version:  Version,
		Services: services,
	}

	if overallHealthy {
		resp.Status = "healthy"
		api.JSON(w, http.StatusOK, resp)
	} else {
		resp.Status = "degraded"
		api.JSON(w, http.StatusServiceUnavailable, resp)
	}
}
