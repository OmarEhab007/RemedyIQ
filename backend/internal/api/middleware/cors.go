package middleware

import (
	"net/http"
	"strings"
)

// CORSMiddleware returns an http.Handler middleware that applies CORS headers
// based on the provided list of allowed origins. If allowedOrigins contains
// "*", all origins are permitted (useful during development).
func CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	// Pre-compute the allowed origins set for fast lookup.
	allowAll := false
	originSet := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		if o == "*" {
			allowAll = true
		}
		originSet[o] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Determine whether this origin is allowed.
			allowed := false
			if allowAll {
				allowed = true
			} else if origin != "" {
				_, allowed = originSet[origin]
			}

			if allowed && origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", strings.Join([]string{
					"Authorization",
					"Content-Type",
					"Accept",
					"Origin",
					"X-Requested-With",
					"X-Dev-User-ID",
					"X-Dev-Tenant-ID",
				}, ", "))
				w.Header().Set("Access-Control-Max-Age", "86400")
				w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")
			}

			// Handle preflight requests.
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
