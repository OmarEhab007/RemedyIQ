package handlers

import (
	"net/http"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

const rateLimitWindow = time.Minute

const (
	aiStreamPerMinuteLimit  = 30
	uploadPerMinuteLimit    = 20
	searchPerMinuteLimit    = 120
)

// enforceTenantRateLimit returns false if the limit was exceeded (response already written).
func enforceTenantRateLimit(w http.ResponseWriter, r *http.Request, redis storage.RedisCache, tenantID, routeKey string, limit int) bool {
	if redis == nil || limit <= 0 {
		return true
	}
	key := redis.TenantKey(tenantID, "ratelimit", routeKey)
	ok, err := redis.CheckRateLimit(r.Context(), key, limit, rateLimitWindow)
	if err != nil {
		return true
	}
	if !ok {
		api.Error(w, http.StatusTooManyRequests, api.ErrCodeRateLimited, "rate limit exceeded")
		return false
	}
	return true
}
