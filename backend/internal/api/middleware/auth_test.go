package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const testSecret = "test-clerk-secret-key"

// buildTestJWT creates a valid HS256 JWT with the given claims and secret.
func buildTestJWT(claims map[string]interface{}, secret string) string {
	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	headerJSON, _ := json.Marshal(header)
	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)

	claimsJSON, _ := json.Marshal(claims)
	claimsB64 := base64.RawURLEncoding.EncodeToString(claimsJSON)

	signingInput := headerB64 + "." + claimsB64
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	sig := mac.Sum(nil)
	sigB64 := base64.RawURLEncoding.EncodeToString(sig)

	return headerB64 + "." + claimsB64 + "." + sigB64
}

func echoHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := GetUserID(r.Context())
		tenantID := GetTenantID(r.Context())
		orgID := GetOrgID(r.Context())
		w.Header().Set("X-User-ID", userID)
		w.Header().Set("X-Tenant-ID", tenantID)
		w.Header().Set("X-Org-ID", orgID)
		w.WriteHeader(http.StatusOK)
	})
}

func TestAuthMiddleware_DevBypass(t *testing.T) {
	am := NewAuthMiddleware(testSecret, true)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Dev-User-ID", "dev-user-1")
	req.Header.Set("X-Dev-Tenant-ID", "dev-tenant-1")

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if w.Header().Get("X-User-ID") != "dev-user-1" {
		t.Fatalf("expected user dev-user-1, got %s", w.Header().Get("X-User-ID"))
	}
	if w.Header().Get("X-Tenant-ID") != "dev-tenant-1" {
		t.Fatalf("expected tenant dev-tenant-1, got %s", w.Header().Get("X-Tenant-ID"))
	}
}

func TestAuthMiddleware_DevBypass_BlockedInProduction(t *testing.T) {
	// Simulate production environment.
	t.Setenv("APP_ENV", "production")

	am := NewAuthMiddleware(testSecret, true)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Dev-User-ID", "dev-user-1")
	req.Header.Set("X-Dev-Tenant-ID", "dev-tenant-1")

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	// Dev bypass should be blocked — falls through to JWT validation
	// which fails because there is no Authorization header.
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when APP_ENV=production, got %d", w.Code)
	}
}

func TestAuthMiddleware_DevBypass_Disabled(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Dev-User-ID", "dev-user-1")
	req.Header.Set("X-Dev-Tenant-ID", "dev-tenant-1")
	// No Authorization header, so should fail.

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_MissingHeader(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_InvalidFormat(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_ValidJWT(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub":    "user_abc123",
		"org_id": "org_xyz789",
		"exp":    float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	token := buildTestJWT(claims, testSecret)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", w.Code, w.Body.String())
	}
	if w.Header().Get("X-User-ID") != "user_abc123" {
		t.Fatalf("expected user_abc123, got %s", w.Header().Get("X-User-ID"))
	}
	if w.Header().Get("X-Tenant-ID") != "org_xyz789" {
		t.Fatalf("expected org_xyz789, got %s", w.Header().Get("X-Tenant-ID"))
	}
	if w.Header().Get("X-Org-ID") != "org_xyz789" {
		t.Fatalf("expected org_xyz789, got %s", w.Header().Get("X-Org-ID"))
	}
}

func TestAuthMiddleware_ValidJWT_NoOrg(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub": "user_personal",
		"exp": float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	token := buildTestJWT(claims, testSecret)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	// Without org_id, tenant falls back to user_id.
	if w.Header().Get("X-Tenant-ID") != "user_personal" {
		t.Fatalf("expected tenant user_personal, got %s", w.Header().Get("X-Tenant-ID"))
	}
}

func TestAuthMiddleware_ExpiredJWT(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub": "user_abc123",
		"exp": float64(time.Now().Add(-1 * time.Hour).Unix()),
	}
	token := buildTestJWT(claims, testSecret)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_WrongSecret(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub": "user_abc123",
		"exp": float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	token := buildTestJWT(claims, "wrong-secret")

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_MalformedToken(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer not.a.valid.jwt.at.all")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestContextHelpers(t *testing.T) {
	ctx := context.Background()

	// Empty context should return empty strings.
	if v := GetUserID(ctx); v != "" {
		t.Fatalf("expected empty user ID, got %q", v)
	}
	if v := GetTenantID(ctx); v != "" {
		t.Fatalf("expected empty tenant ID, got %q", v)
	}
	if v := GetOrgID(ctx); v != "" {
		t.Fatalf("expected empty org ID, got %q", v)
	}

	// Set values and verify.
	ctx = context.WithValue(ctx, UserIDKey, "u1")
	ctx = context.WithValue(ctx, TenantIDKey, "t1")
	ctx = context.WithValue(ctx, OrgIDKey, "o1")

	if v := GetUserID(ctx); v != "u1" {
		t.Fatalf("expected u1, got %q", v)
	}
	if v := GetTenantID(ctx); v != "t1" {
		t.Fatalf("expected t1, got %q", v)
	}
	if v := GetOrgID(ctx); v != "o1" {
		t.Fatalf("expected o1, got %q", v)
	}
}

func TestAuthMiddleware_MissingSubClaim(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	// Token with no "sub" claim.
	claims := map[string]interface{}{
		"exp": float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	token := buildTestJWT(claims, testSecret)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d; body: %s", w.Code, w.Body.String())
	}
}

func TestAuthMiddleware_UnsupportedAlgorithm(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	// Manually build a token with RS256 header.
	header := map[string]string{"alg": "RS256", "typ": "JWT"}
	headerJSON, _ := json.Marshal(header)
	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)

	claims := map[string]interface{}{
		"sub": "user_abc123",
		"exp": float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	claimsJSON, _ := json.Marshal(claims)
	claimsB64 := base64.RawURLEncoding.EncodeToString(claimsJSON)

	token := fmt.Sprintf("%s.%s.fakesignature", headerB64, claimsB64)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}
