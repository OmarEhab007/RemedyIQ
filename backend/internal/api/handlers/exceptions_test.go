package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
)

// ---------------------------------------------------------------------------
// ExceptionsHandler contract tests
// ---------------------------------------------------------------------------

func TestExceptionsHandler_MissingTenantContext(t *testing.T) {
	h := NewExceptionsHandler(nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dashboard/exceptions", nil)
	req = mux.SetURLVars(req, map[string]string{"job_id": "550e8400-e29b-41d4-a716-446655440000"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
	assert.Contains(t, errResp.Message, "missing tenant context")
}

func TestExceptionsHandler_InvalidJobID(t *testing.T) {
	h := NewExceptionsHandler(nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/not-a-uuid/dashboard/exceptions", nil)
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "550e8400-e29b-41d4-a716-446655440000")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "not-a-uuid"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "invalid job_id format")
}

func TestExceptionsHandler_InvalidTenantIDFormat(t *testing.T) {
	h := NewExceptionsHandler(nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dashboard/exceptions", nil)
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "bad-tenant-id")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "550e8400-e29b-41d4-a716-446655440000"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "invalid tenant_id format")
}

func TestExceptionsHandler_EmptyJobID(t *testing.T) {
	h := NewExceptionsHandler(nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis//dashboard/exceptions", nil)
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "550e8400-e29b-41d4-a716-446655440000")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": ""})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "invalid job_id format")
}

func TestExceptionsHandler_NilStorageClients_PanicsOnGetJob(t *testing.T) {
	h := NewExceptionsHandler(nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dashboard/exceptions", nil)
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "550e8400-e29b-41d4-a716-446655440000")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "550e8400-e29b-41d4-a716-446655440000"})

	w := httptest.NewRecorder()

	assert.Panics(t, func() {
		h.ServeHTTP(w, req)
	}, "handler should panic when PostgresClient is nil, proving validation passed")
}
