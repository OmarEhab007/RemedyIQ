package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- detectLogTypes tests ---

func TestDetectLogTypes_APIFile(t *testing.T) {
	types := detectLogTypes("arapi_server.log")
	assert.Contains(t, types, "API")
}

func TestDetectLogTypes_SQLFile(t *testing.T) {
	types := detectLogTypes("arsql_debug.log")
	assert.Contains(t, types, "SQL")
}

func TestDetectLogTypes_FilterFile(t *testing.T) {
	types := detectLogTypes("arfilter_trace.log")
	assert.Contains(t, types, "FLTR")

	types2 := detectLogTypes("arfltr_trace.log")
	assert.Contains(t, types2, "FLTR")
}

func TestDetectLogTypes_EscalationFile(t *testing.T) {
	// Full word "escalation" in filename
	types := detectLogTypes("arescalation_debug.log")
	assert.Contains(t, types, "ESCL")

	// Abbreviated with delimiters: _esc_ pattern
	types2 := detectLogTypes("ar_esc_debug.log")
	assert.Contains(t, types2, "ESCL")

	// Abbreviated with extension delimiter: _esc.
	types3 := detectLogTypes("ar_esc.log")
	assert.Contains(t, types3, "ESCL")

	// Prefix pattern: esc_
	types4 := detectLogTypes("esc_trace.log")
	assert.Contains(t, types4, "ESCL")

	// Suffix pattern: _esc
	types5 := detectLogTypes("ar_esc")
	assert.Contains(t, types5, "ESCL")
}

func TestDetectLogTypes_EscalationNotFalsePositive(t *testing.T) {
	// "describe" in an API log should NOT also match escalation.
	// We include "api" so the filename matches at least one type and
	// does not fall through to the default (all types).
	types := detectLogTypes("api_describe_tables.log")
	assert.Contains(t, types, "API")
	assert.NotContains(t, types, "ESCL")

	// "descending" in a SQL log should NOT match escalation.
	types2 := detectLogTypes("sql_descending_sort.log")
	assert.Contains(t, types2, "SQL")
	assert.NotContains(t, types2, "ESCL")
}

func TestDetectLogTypes_CombinedFile(t *testing.T) {
	// Filename containing both api and sql
	types := detectLogTypes("apisql_combined.log")
	assert.Contains(t, types, "API")
	assert.Contains(t, types, "SQL")
}

func TestDetectLogTypes_UnknownFile(t *testing.T) {
	// Unrecognized filename should default to all 4 types
	types := detectLogTypes("server.log")
	assert.Len(t, types, 4)
	assert.Contains(t, types, "API")
	assert.Contains(t, types, "SQL")
	assert.Contains(t, types, "FLTR")
	assert.Contains(t, types, "ESCL")
}

func TestDetectLogTypes_CaseInsensitive(t *testing.T) {
	types := detectLogTypes("ARAPI_SERVER.LOG")
	assert.Contains(t, types, "API")
}

// --- Upload handler HTTP contract tests ---

func TestUploadHandler_MissingTenantContext(t *testing.T) {
	// nil storage clients is fine -- we will not reach storage operations
	h := NewUploadHandler(nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/files/upload", nil)
	// No tenant context set
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
}

func TestUploadHandler_InvalidMultipartForm(t *testing.T) {
	h := NewUploadHandler(nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/files/upload", bytes.NewBufferString("not a multipart form"))
	req.Header.Set("Content-Type", "text/plain")
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "test-tenant-id")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
}

func TestUploadHandler_MissingFileField(t *testing.T) {
	h := NewUploadHandler(nil, nil)

	// Create a valid multipart form without the "file" field
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("name", "test")
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/files/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "test-tenant-id")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "file")
}
