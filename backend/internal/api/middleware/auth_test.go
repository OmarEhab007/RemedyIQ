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

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testSecret = "test-clerk-secret-key"

// createTestJWT builds a valid HS256 JWT signed with the given secret.
func createTestJWT(secret string, claims map[string]interface{}) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	claimsJSON, _ := json.Marshal(claims)
	payload := base64.RawURLEncoding.EncodeToString(claimsJSON)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(header + "." + payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return header + "." + payload + "." + sig
}

// echoHandler is a test handler that echoes context values back as response
// headers so tests can verify that the middleware populated context correctly.
func echoHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-User-ID", GetUserID(r.Context()))
		w.Header().Set("X-Tenant-ID", GetTenantID(r.Context()))
		w.Header().Set("X-Org-ID", GetOrgID(r.Context()))
		w.WriteHeader(http.StatusOK)
	})
}

// --- Context helper tests ---------------------------------------------------

func TestGetUserID_EmptyContext(t *testing.T) {
	ctx := context.Background()
	assert.Equal(t, "", GetUserID(ctx))
}

func TestGetTenantID_EmptyContext(t *testing.T) {
	ctx := context.Background()
	assert.Equal(t, "", GetTenantID(ctx))
}

func TestGetOrgID_EmptyContext(t *testing.T) {
	ctx := context.Background()
	assert.Equal(t, "", GetOrgID(ctx))
}

func TestWithUserID(t *testing.T) {
	ctx := WithUserID(context.Background(), "user-42")
	assert.Equal(t, "user-42", GetUserID(ctx))
}

func TestWithTenantID(t *testing.T) {
	ctx := WithTenantID(context.Background(), "tenant-99")
	assert.Equal(t, "tenant-99", GetTenantID(ctx))
}

func TestWithOrgID(t *testing.T) {
	ctx := WithOrgID(context.Background(), "org-55")
	assert.Equal(t, "org-55", GetOrgID(ctx))
}

func TestContextHelpers_RoundTrip(t *testing.T) {
	ctx := context.Background()
	ctx = WithUserID(ctx, "u1")
	ctx = WithTenantID(ctx, "t1")
	ctx = WithOrgID(ctx, "o1")

	assert.Equal(t, "u1", GetUserID(ctx))
	assert.Equal(t, "t1", GetTenantID(ctx))
	assert.Equal(t, "o1", GetOrgID(ctx))
}

func TestContextHelpers_WrongType(t *testing.T) {
	// If someone stores a non-string value under the key, the getter
	// should return "" without panicking.
	ctx := context.WithValue(context.Background(), UserIDKey, 12345)
	assert.Equal(t, "", GetUserID(ctx))
}

// --- Dev mode tests ---------------------------------------------------------

func TestAuthMiddleware_DevMode_ValidHeaders(t *testing.T) {
	am := NewAuthMiddleware(testSecret, true)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Dev-User-ID", "dev-user-1")
	req.Header.Set("X-Dev-Tenant-ID", "dev-tenant-1")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "dev-user-1", w.Header().Get("X-User-ID"))
	assert.Equal(t, "dev-tenant-1", w.Header().Get("X-Tenant-ID"))
	assert.Equal(t, "dev-tenant-1", w.Header().Get("X-Org-ID"))
}

func TestAuthMiddleware_DevMode_MissingHeaders_NoBearer(t *testing.T) {
	am := NewAuthMiddleware(testSecret, true)
	handler := am.Authenticate(echoHandler())

	// Dev mode is on but no dev headers and no bearer token provided.
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_DevMode_OnlyUserHeader(t *testing.T) {
	am := NewAuthMiddleware(testSecret, true)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Dev-User-ID", "dev-user-1")
	// Missing X-Dev-Tenant-ID -- both are required for the bypass.
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Falls through to JWT validation which fails.
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_DevMode_OnlyTenantHeader(t *testing.T) {
	am := NewAuthMiddleware(testSecret, true)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Dev-Tenant-ID", "dev-tenant-1")
	// Missing X-Dev-User-ID.
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_DevMode_BlockedInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")

	am := NewAuthMiddleware(testSecret, true)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Dev-User-ID", "dev-user-1")
	req.Header.Set("X-Dev-Tenant-ID", "dev-tenant-1")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Dev bypass is blocked in production -- falls through to JWT validation
	// which fails because there is no Authorization header.
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_DevMode_FallsThroughToValidJWT(t *testing.T) {
	// Dev mode is on but no dev headers. A valid JWT should still work.
	am := NewAuthMiddleware(testSecret, true)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub":    "user_jwt",
		"org_id": "org_jwt",
		"exp":    float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	token := createTestJWT(testSecret, claims)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "user_jwt", w.Header().Get("X-User-ID"))
}

func TestAuthMiddleware_DevMode_Disabled(t *testing.T) {
	// devMode is false -- dev headers are ignored.
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Dev-User-ID", "dev-user-1")
	req.Header.Set("X-Dev-Tenant-ID", "dev-tenant-1")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

// --- Valid JWT tests --------------------------------------------------------

func TestAuthMiddleware_ValidJWT_WithOrg(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub":    "user_abc123",
		"org_id": "org_xyz789",
		"exp":    float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	token := createTestJWT(testSecret, claims)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "user_abc123", w.Header().Get("X-User-ID"))
	assert.Equal(t, "org_xyz789", w.Header().Get("X-Tenant-ID"))
	assert.Equal(t, "org_xyz789", w.Header().Get("X-Org-ID"))
}

func TestAuthMiddleware_ValidJWT_NoOrg_FallsBackToUserID(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub": "user_personal",
		"exp": float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	token := createTestJWT(testSecret, claims)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "user_personal", w.Header().Get("X-User-ID"))
	// Without org_id, tenant falls back to user_id.
	assert.Equal(t, "user_personal", w.Header().Get("X-Tenant-ID"))
	assert.Equal(t, "", w.Header().Get("X-Org-ID"))
}

func TestAuthMiddleware_ValidJWT_CaseInsensitiveBearer(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub": "user_1",
		"exp": float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	token := createTestJWT(testSecret, claims)

	// Use "bearer" (lowercase) instead of "Bearer".
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "user_1", w.Header().Get("X-User-ID"))
}

// --- Expired JWT tests ------------------------------------------------------

func TestAuthMiddleware_ExpiredJWT(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub": "user_abc123",
		"exp": float64(time.Now().Add(-1 * time.Hour).Unix()),
	}
	token := createTestJWT(testSecret, claims)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, errCodeUnauthorized, body.Code)
}

func TestAuthMiddleware_ExpiredJWT_WithinClockSkew(t *testing.T) {
	// Token expired 10 seconds ago -- within the 30-second skew tolerance.
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub": "user_skew",
		"exp": float64(time.Now().Add(-10 * time.Second).Unix()),
	}
	token := createTestJWT(testSecret, claims)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "user_skew", w.Header().Get("X-User-ID"))
}

// --- Missing / malformed Authorization header tests -------------------------

func TestAuthMiddleware_MissingAuthorizationHeader(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, errCodeUnauthorized, body.Code)
	assert.Contains(t, body.Message, "missing authorization header")
}

func TestAuthMiddleware_MalformedBearer_NoSpace(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "BearerTOKEN")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_MalformedBearer_BasicAuth(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Contains(t, body.Message, "invalid authorization header format")
}

func TestAuthMiddleware_MalformedBearer_EmptyToken(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer ")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// "Bearer " splits into ["Bearer", ""] -- the token is empty / invalid.
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

// --- Invalid signature tests ------------------------------------------------

func TestAuthMiddleware_InvalidSignature(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub": "user_abc123",
		"exp": float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	token := createTestJWT("wrong-secret-key", claims)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

// --- Missing "sub" claim test -----------------------------------------------

func TestAuthMiddleware_MissingSubClaim(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"org_id": "org_123",
		"exp":    float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	token := createTestJWT(testSecret, claims)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Contains(t, body.Message, "token missing subject claim")
}

func TestAuthMiddleware_EmptySubClaim(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	claims := map[string]interface{}{
		"sub": "",
		"exp": float64(time.Now().Add(1 * time.Hour).Unix()),
	}
	token := createTestJWT(testSecret, claims)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

// --- Clock skew tolerance (nbf) tests ---------------------------------------

func TestAuthMiddleware_NBF_SlightlyInFuture_WithinSkew(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	// nbf is 10 seconds in the future -- within the 30-second tolerance.
	claims := map[string]interface{}{
		"sub": "user_nbf",
		"exp": float64(time.Now().Add(1 * time.Hour).Unix()),
		"nbf": float64(time.Now().Add(10 * time.Second).Unix()),
	}
	token := createTestJWT(testSecret, claims)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "user_nbf", w.Header().Get("X-User-ID"))
}

func TestAuthMiddleware_NBF_FarInFuture_BeyondSkew(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	// nbf is 5 minutes in the future -- well beyond 30-second skew.
	claims := map[string]interface{}{
		"sub": "user_nbf_far",
		"exp": float64(time.Now().Add(1 * time.Hour).Unix()),
		"nbf": float64(time.Now().Add(5 * time.Minute).Unix()),
	}
	token := createTestJWT(testSecret, claims)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

// --- Malformed token structure tests ----------------------------------------

func TestAuthMiddleware_MalformedToken_TooManyParts(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer not.a.valid.jwt.at.all")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_MalformedToken_OnePart(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer singletokenvalue")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

// --- Unsupported algorithm test ---------------------------------------------

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

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

// --- NewAuthMiddleware constructor test -------------------------------------

func TestNewAuthMiddleware(t *testing.T) {
	am := NewAuthMiddleware("my-secret", true)
	require.NotNil(t, am)
	assert.Equal(t, "my-secret", am.clerkSecretKey)
	assert.True(t, am.devMode)

	am2 := NewAuthMiddleware("", false)
	require.NotNil(t, am2)
	assert.Equal(t, "", am2.clerkSecretKey)
	assert.False(t, am2.devMode)
}

// --- Response content-type test ---------------------------------------------

func TestAuthMiddleware_ErrorResponse_IsJSON(t *testing.T) {
	am := NewAuthMiddleware(testSecret, false)
	handler := am.Authenticate(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Equal(t, "application/json; charset=utf-8", w.Header().Get("Content-Type"))
}
