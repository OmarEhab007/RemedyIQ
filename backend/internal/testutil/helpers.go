package testutil

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
)

const (
	TestTenantID = "00000000-0000-0000-0000-000000000001"
	TestUserID   = "test-user-123"
	TestOrgID    = "test-org-456"
)

// NewTestRequest creates an HTTP request with JSON content type.
func NewTestRequest(method, path, body string) *http.Request {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

// NewAuthenticatedRequest creates an HTTP request with tenant/user context
// injected via the middleware's exported context keys so that
// middleware.GetTenantID / GetUserID / GetOrgID work correctly.
func NewAuthenticatedRequest(method, path, body, tenantID, userID string) *http.Request {
	req := NewTestRequest(method, path, body)
	return InjectAuth(req, tenantID, userID, TestOrgID)
}

// InjectAuth injects authentication context values into the request using
// the middleware's exported context keys.
func InjectAuth(req *http.Request, tenantID, userID, orgID string) *http.Request {
	ctx := req.Context()
	ctx = middleware.WithTenantID(ctx, tenantID)
	ctx = middleware.WithUserID(ctx, userID)
	ctx = middleware.WithOrgID(ctx, orgID)
	return req.WithContext(ctx)
}

// NewRequestWithVars creates an authenticated request with mux route variables.
func NewRequestWithVars(method, path, body, tenantID, userID string, vars map[string]string) *http.Request {
	req := NewAuthenticatedRequest(method, path, body, tenantID, userID)
	if len(vars) > 0 {
		req = mux.SetURLVars(req, vars)
	}
	return req
}

// AssertJSONResponse validates status code, content type, and optionally
// decodes the response body into target.
func AssertJSONResponse(t testing.TB, recorder *httptest.ResponseRecorder, expectedStatus int, target interface{}) {
	t.Helper()
	if recorder.Code != expectedStatus {
		t.Errorf("expected status %d, got %d; body: %s", expectedStatus, recorder.Code, recorder.Body.String())
	}

	contentType := recorder.Header().Get("Content-Type")
	if contentType != "" && !strings.Contains(contentType, "application/json") {
		t.Errorf("expected JSON content-type, got %s", contentType)
	}

	if target != nil && recorder.Body.Len() > 0 {
		if err := json.NewDecoder(recorder.Body).Decode(target); err != nil {
			t.Fatalf("failed to decode response body: %v", err)
		}
	}
}
