package middleware

import (
	"log/slog"
	"net/http"
)

// TenantMiddleware ensures that every authenticated request has a valid tenant
// context. It must be placed after AuthMiddleware in the middleware chain.
type TenantMiddleware struct{}

// NewTenantMiddleware creates a new TenantMiddleware.
func NewTenantMiddleware() *TenantMiddleware {
	return &TenantMiddleware{}
}

// InjectTenant returns an http.Handler middleware that reads the tenant ID
// previously set by the auth middleware, validates that it is present, and
// allows the request to proceed. If the tenant ID is missing the request is
// rejected with 401 Unauthorized.
func (tm *TenantMiddleware) InjectTenant(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := GetTenantID(r.Context())
		if tenantID == "" {
			slog.Warn("request missing tenant context",
				"path", r.URL.Path,
				"remote_addr", r.RemoteAddr,
			)
			writeError(w, http.StatusUnauthorized, errCodeUnauthorized, "tenant context is required")
			return
		}

		// Tenant ID is valid and present -- allow the request through.
		// Downstream handlers can retrieve it with middleware.GetTenantID(ctx).
		next.ServeHTTP(w, r)
	})
}
