package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewTenantMiddleware(t *testing.T) {
	tm := NewTenantMiddleware()
	require.NotNil(t, tm)
}

func TestTenantMiddleware_ValidTenant_PassesThrough(t *testing.T) {
	tm := NewTenantMiddleware()

	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		// Verify tenant is accessible in downstream handler.
		tenantID := GetTenantID(r.Context())
		assert.Equal(t, "tenant-123", tenantID)
		w.WriteHeader(http.StatusOK)
	})

	handler := tm.InjectTenant(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/resource", nil)
	ctx := WithTenantID(req.Context(), "tenant-123")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.True(t, called, "inner handler should have been called")
}

func TestTenantMiddleware_MissingTenant_Returns401(t *testing.T) {
	tm := NewTenantMiddleware()

	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})

	handler := tm.InjectTenant(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/resource", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
	assert.False(t, called, "inner handler should not have been called")

	// Verify the error response body.
	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, errCodeUnauthorized, body.Code)
	assert.Contains(t, body.Message, "tenant context is required")
}

func TestTenantMiddleware_EmptyStringTenant_Returns401(t *testing.T) {
	tm := NewTenantMiddleware()

	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})

	handler := tm.InjectTenant(inner)

	// Explicitly set an empty-string tenant.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/resource", nil)
	ctx := WithTenantID(req.Context(), "")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
	assert.False(t, called, "inner handler should not have been called")
}

func TestTenantMiddleware_ErrorResponse_IsJSON(t *testing.T) {
	tm := NewTenantMiddleware()
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	handler := tm.InjectTenant(inner)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Equal(t, "application/json; charset=utf-8", w.Header().Get("Content-Type"))
}

func TestTenantMiddleware_PreservesOtherContextValues(t *testing.T) {
	tm := NewTenantMiddleware()

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Both user and tenant should be accessible.
		assert.Equal(t, "user-1", GetUserID(r.Context()))
		assert.Equal(t, "tenant-1", GetTenantID(r.Context()))
		w.WriteHeader(http.StatusOK)
	})

	handler := tm.InjectTenant(inner)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	ctx := WithUserID(req.Context(), "user-1")
	ctx = WithTenantID(ctx, "tenant-1")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestTenantMiddleware_DifferentHTTPMethods(t *testing.T) {
	tm := NewTenantMiddleware()

	methods := []string{
		http.MethodGet,
		http.MethodPost,
		http.MethodPut,
		http.MethodPatch,
		http.MethodDelete,
	}

	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})

			handler := tm.InjectTenant(inner)

			req := httptest.NewRequest(method, "/test", nil)
			ctx := WithTenantID(req.Context(), "tenant-multi")
			req = req.WithContext(ctx)

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			require.Equal(t, http.StatusOK, w.Code)
		})
	}
}
