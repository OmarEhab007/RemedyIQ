package handlers

import (
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

func TestTraceHandler_MissingTenantContext(t *testing.T) {
	h := NewTraceHandler(nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/job-1/trace/T001", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestTraceHandler_MissingTraceID(t *testing.T) {
	h := NewTraceHandler(nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/job-1/trace/", nil)
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "test-tenant")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "550e8400-e29b-41d4-a716-446655440000", "trace_id": ""})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Contains(t, errResp.Message, "trace_id")
}
