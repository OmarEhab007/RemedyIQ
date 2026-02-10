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
	types := detectLogTypes("aresc_debug.log")
	assert.Contains(t, types, "ESCL")
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

// --- countingReader tests ---

func TestCountingReader(t *testing.T) {
	data := []byte("hello world")
	cr := &countingReader{r: bytes.NewReader(data)}

	buf := make([]byte, 5)
	n, err := cr.Read(buf)
	require.NoError(t, err)
	assert.Equal(t, 5, n)
	assert.Equal(t, int64(5), cr.n)

	n, err = cr.Read(buf)
	require.NoError(t, err)
	assert.Equal(t, 5, n)
	assert.Equal(t, int64(10), cr.n)
}
