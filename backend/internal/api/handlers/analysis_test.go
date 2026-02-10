package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// CreateAnalysis contract tests
// ---------------------------------------------------------------------------

func TestCreateAnalysis_MissingTenantContext(t *testing.T) {
	h := NewAnalysisHandlers(nil, nil)

	body := `{"file_id":"550e8400-e29b-41d4-a716-446655440000"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	h.CreateAnalysis().ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
}

func TestCreateAnalysis_InvalidJSON(t *testing.T) {
	h := NewAnalysisHandlers(nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis", bytes.NewBufferString("{invalid"))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "550e8400-e29b-41d4-a716-446655440000")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.CreateAnalysis().ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "JSON")
}

func TestCreateAnalysis_InvalidFileID(t *testing.T) {
	h := NewAnalysisHandlers(nil, nil)

	body := `{"file_id":"not-a-uuid"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis", bytes.NewBufferString(body))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "550e8400-e29b-41d4-a716-446655440000")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.CreateAnalysis().ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "file_id")
}

func TestCreateAnalysis_EmptyBody(t *testing.T) {
	h := NewAnalysisHandlers(nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis", bytes.NewBufferString(""))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "550e8400-e29b-41d4-a716-446655440000")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.CreateAnalysis().ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ---------------------------------------------------------------------------
// ListAnalyses contract tests
// ---------------------------------------------------------------------------

func TestListAnalyses_MissingTenantContext(t *testing.T) {
	h := NewAnalysisHandlers(nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis", nil)
	w := httptest.NewRecorder()
	h.ListAnalyses().ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
}

// ---------------------------------------------------------------------------
// GetAnalysis contract tests
// ---------------------------------------------------------------------------

func TestGetAnalysis_MissingTenantContext(t *testing.T) {
	h := NewAnalysisHandlers(nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000", nil)
	w := httptest.NewRecorder()
	h.GetAnalysis().ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
}

func TestGetAnalysis_InvalidJobID(t *testing.T) {
	h := NewAnalysisHandlers(nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/invalid-id", nil)
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "550e8400-e29b-41d4-a716-446655440000")
	req = req.WithContext(ctx)

	// gorilla/mux Vars needs to be set for the handler to read job_id.
	req = mux.SetURLVars(req, map[string]string{"job_id": "invalid-id"})

	w := httptest.NewRecorder()
	h.GetAnalysis().ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "job_id")
}
