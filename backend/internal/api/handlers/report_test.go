package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	aiPkg "github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
)

// ---------------------------------------------------------------------------
// ReportHandler contract tests
// ---------------------------------------------------------------------------

func TestReportHandler_MissingTenantContext(t *testing.T) {
	registry := aiPkg.NewRegistry()
	h := NewReportHandler(nil, registry)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/report", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
}

func TestReportHandler_InvalidJobID(t *testing.T) {
	registry := aiPkg.NewRegistry()
	h := NewReportHandler(nil, registry)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/not-a-uuid/report", bytes.NewBufferString(body))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "550e8400-e29b-41d4-a716-446655440000")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "not-a-uuid"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "job_id")
}

func TestReportHandler_MissingFormat(t *testing.T) {
	// When no format is provided, it should default to "html" rather than
	// returning an error. With nil pg, the handler will fail at the GetJob
	// call, but the fact that it gets past format validation confirms the
	// default was applied correctly.
	registry := aiPkg.NewRegistry()
	h := NewReportHandler(nil, registry)

	// Send an empty body (no format field).
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/report", bytes.NewBufferString("{}"))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "550e8400-e29b-41d4-a716-446655440000")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "550e8400-e29b-41d4-a716-446655440000"})

	w := httptest.NewRecorder()

	// With nil pg, this will panic at GetJob. We catch it to verify the
	// handler got past format validation (defaulting to "html").
	assert.Panics(t, func() {
		h.ServeHTTP(w, req)
	}, "expected panic on nil pg after passing format validation")
}

func TestReportHandler_ValidRequest(t *testing.T) {
	// With nil pg, the handler will panic when calling GetJob, but the
	// request passes all validation checks (tenant, job_id, format).
	// This confirms the routing and validation logic is correct.
	registry := aiPkg.NewRegistry()
	h := NewReportHandler(nil, registry)

	body := `{"format":"json"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/report", bytes.NewBufferString(body))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "550e8400-e29b-41d4-a716-446655440000")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "550e8400-e29b-41d4-a716-446655440000"})

	w := httptest.NewRecorder()

	// With nil pg, this will panic when trying to verify the job exists.
	assert.Panics(t, func() {
		h.ServeHTTP(w, req)
	}, "expected panic on nil pg after passing all validation")
}

func TestReportHandler_InvalidFormat(t *testing.T) {
	registry := aiPkg.NewRegistry()
	h := NewReportHandler(nil, registry)

	body := `{"format":"pdf"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/report", bytes.NewBufferString(body))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "550e8400-e29b-41d4-a716-446655440000")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "550e8400-e29b-41d4-a716-446655440000"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "format")
}
