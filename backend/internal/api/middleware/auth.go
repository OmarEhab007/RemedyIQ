package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

// contextKey is an unexported type used for context keys to avoid collisions.
type contextKey string

const (
	// UserIDKey is the context key for the authenticated user ID.
	UserIDKey contextKey = "user_id"
	// TenantIDKey is the context key for the tenant (org) ID.
	TenantIDKey contextKey = "tenant_id"
	// OrgIDKey is the context key for the Clerk organization ID.
	OrgIDKey contextKey = "org_id"
)

// Error codes used within middleware responses.
const (
	errCodeUnauthorized = "unauthorized"
)

// clockSkewSeconds is the tolerance in seconds applied to both the `exp`
// and `nbf` JWT claims to account for clock drift between servers.
const clockSkewSeconds = 30

// GetUserID extracts the user ID from the request context.
func GetUserID(ctx context.Context) string {
	v, _ := ctx.Value(UserIDKey).(string)
	return v
}

// GetTenantID extracts the tenant ID from the request context.
func GetTenantID(ctx context.Context) string {
	v, _ := ctx.Value(TenantIDKey).(string)
	return v
}

// GetOrgID extracts the Clerk organization ID from the request context.
func GetOrgID(ctx context.Context) string {
	v, _ := ctx.Value(OrgIDKey).(string)
	return v
}

// AuthMiddleware validates JWT tokens from the Authorization header.
type AuthMiddleware struct {
	clerkSecretKey string
	devMode        bool
}

// NewAuthMiddleware creates a new AuthMiddleware.
// When clerkSecretKey is empty and devMode is true, the middleware will accept
// bypass headers instead of requiring a valid JWT.
func NewAuthMiddleware(clerkSecretKey string, devMode bool) *AuthMiddleware {
	return &AuthMiddleware{
		clerkSecretKey: clerkSecretKey,
		devMode:        devMode,
	}
}

// Authenticate returns an http.Handler middleware that validates JWT bearer
// tokens. In development mode, the middleware also accepts X-Dev-User-ID and
// X-Dev-Tenant-ID headers as a convenience bypass.
func (am *AuthMiddleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// --- Development bypass -------------------------------------------
		if am.devMode {
			// Block dev bypass in production even if devMode was misconfigured.
			if env := os.Getenv("APP_ENV"); env == "production" {
				slog.Error("dev mode bypass attempted in production environment",
					"remote_addr", r.RemoteAddr,
				)
			} else {
				devUser := r.Header.Get("X-Dev-User-ID")
				devTenant := r.Header.Get("X-Dev-Tenant-ID")
				if devUser != "" && devTenant != "" {
					ctx := context.WithValue(r.Context(), UserIDKey, devUser)
					ctx = context.WithValue(ctx, TenantIDKey, devTenant)
					ctx = context.WithValue(ctx, OrgIDKey, devTenant)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}
		}

		// --- Extract bearer token ----------------------------------------
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeError(w, http.StatusUnauthorized, errCodeUnauthorized, "missing authorization header")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			writeError(w, http.StatusUnauthorized, errCodeUnauthorized, "invalid authorization header format")
			return
		}
		token := parts[1]

		// --- Decode and validate JWT -------------------------------------
		claims, err := am.validateJWT(token)
		if err != nil {
			slog.Warn("JWT validation failed",
				"error", err,
				"remote_addr", r.RemoteAddr,
			)
			writeError(w, http.StatusUnauthorized, errCodeUnauthorized, "invalid or expired token")
			return
		}

		userID, _ := claims["sub"].(string)
		if userID == "" {
			writeError(w, http.StatusUnauthorized, errCodeUnauthorized, "token missing subject claim")
			return
		}

		// Clerk stores the org ID in the "org_id" claim.
		orgID, _ := claims["org_id"].(string)

		// Use org_id as the tenant identifier; fall back to user_id for
		// personal accounts that have no organization.
		tenantID := orgID
		if tenantID == "" {
			tenantID = userID
		}

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		ctx = context.WithValue(ctx, TenantIDKey, tenantID)
		ctx = context.WithValue(ctx, OrgIDKey, orgID)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// clerkJWTClaims is a minimal representation of the JWT payload.
type clerkJWTClaims map[string]interface{}

// validateJWT performs HS256 signature verification and basic claim checks
// against the Clerk secret key. For production use, consider migrating to a
// full JWKS-based verification flow with RS256, but HS256 with the Clerk
// secret is the documented simple path for server-side validation.
func (am *AuthMiddleware) validateJWT(tokenStr string) (clerkJWTClaims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("malformed JWT: expected 3 parts, got %d", len(parts))
	}

	headerB64, payloadB64, signatureB64 := parts[0], parts[1], parts[2]

	// --- Decode header to check algorithm --------------------------------
	headerBytes, err := base64.RawURLEncoding.DecodeString(headerB64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode JWT header: %w", err)
	}
	var header map[string]interface{}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("failed to parse JWT header: %w", err)
	}
	alg, _ := header["alg"].(string)
	if alg != "HS256" {
		return nil, fmt.Errorf("unsupported JWT algorithm: %s", alg)
	}

	// --- Verify HMAC-SHA256 signature ------------------------------------
	signingInput := headerB64 + "." + payloadB64
	mac := hmac.New(sha256.New, []byte(am.clerkSecretKey))
	mac.Write([]byte(signingInput))
	expectedSig := mac.Sum(nil)

	actualSig, err := base64.RawURLEncoding.DecodeString(signatureB64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode JWT signature: %w", err)
	}

	if !hmac.Equal(expectedSig, actualSig) {
		return nil, fmt.Errorf("JWT signature verification failed")
	}

	// --- Decode payload --------------------------------------------------
	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode JWT payload: %w", err)
	}
	var claims clerkJWTClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fmt.Errorf("failed to parse JWT payload: %w", err)
	}

	// --- Validate standard claims ----------------------------------------
	now := time.Now().Unix()

	// Allow clockSkewSeconds of tolerance on the exp claim so that minor
	// clock differences between the issuer and this server do not cause
	// premature rejection.
	if exp, ok := claims["exp"].(float64); ok {
		if int64(exp)+clockSkewSeconds < now {
			return nil, fmt.Errorf("token expired")
		}
	}

	// Allow clockSkewSeconds of tolerance on the nbf claim for the same
	// reason.
	if nbf, ok := claims["nbf"].(float64); ok {
		if int64(nbf) > now+clockSkewSeconds {
			return nil, fmt.Errorf("token not yet valid")
		}
	}

	return claims, nil
}
