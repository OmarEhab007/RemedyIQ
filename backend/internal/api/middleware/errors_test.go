package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWriteError_StatusAndContentType(t *testing.T) {
	w := httptest.NewRecorder()

	writeError(w, http.StatusBadRequest, "bad_request", "invalid input")

	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "application/json; charset=utf-8", w.Header().Get("Content-Type"))
}

func TestWriteError_ResponseBody(t *testing.T) {
	w := httptest.NewRecorder()

	writeError(w, http.StatusNotFound, "not_found", "resource does not exist")

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, "not_found", body.Code)
	assert.Equal(t, "resource does not exist", body.Message)
}

func TestWriteError_Unauthorized(t *testing.T) {
	w := httptest.NewRecorder()

	writeError(w, http.StatusUnauthorized, errCodeUnauthorized, "missing token")

	require.Equal(t, http.StatusUnauthorized, w.Code)

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, "unauthorized", body.Code)
	assert.Equal(t, "missing token", body.Message)
}

func TestWriteError_InternalServerError(t *testing.T) {
	w := httptest.NewRecorder()

	writeError(w, http.StatusInternalServerError, "internal_error", "internal server error")

	require.Equal(t, http.StatusInternalServerError, w.Code)

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, "internal_error", body.Code)
	assert.Equal(t, "internal server error", body.Message)
}

func TestWriteError_Forbidden(t *testing.T) {
	w := httptest.NewRecorder()

	writeError(w, http.StatusForbidden, "forbidden", "access denied")

	require.Equal(t, http.StatusForbidden, w.Code)

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, "forbidden", body.Code)
	assert.Equal(t, "access denied", body.Message)
}

func TestWriteError_Conflict(t *testing.T) {
	w := httptest.NewRecorder()

	writeError(w, http.StatusConflict, "conflict", "resource already exists")

	require.Equal(t, http.StatusConflict, w.Code)

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, "conflict", body.Code)
	assert.Equal(t, "resource already exists", body.Message)
}

func TestWriteError_UnprocessableEntity(t *testing.T) {
	w := httptest.NewRecorder()

	writeError(w, http.StatusUnprocessableEntity, "validation_error", "field X is required")

	require.Equal(t, http.StatusUnprocessableEntity, w.Code)

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, "validation_error", body.Code)
	assert.Equal(t, "field X is required", body.Message)
}

func TestWriteError_EmptyCodeAndMessage(t *testing.T) {
	w := httptest.NewRecorder()

	writeError(w, http.StatusTeapot, "", "")

	require.Equal(t, http.StatusTeapot, w.Code)

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, "", body.Code)
	assert.Equal(t, "", body.Message)
}

func TestWriteError_SpecialCharactersInMessage(t *testing.T) {
	w := httptest.NewRecorder()

	writeError(w, http.StatusBadRequest, "bad_request", `invalid character '<' in "field"`)

	require.Equal(t, http.StatusBadRequest, w.Code)

	var body errorResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, "bad_request", body.Code)
	assert.Equal(t, `invalid character '<' in "field"`, body.Message)
}

func TestWriteError_ValidJSON(t *testing.T) {
	w := httptest.NewRecorder()

	writeError(w, http.StatusBadRequest, "test_code", "test message")

	// Verify the entire response is valid JSON.
	var raw map[string]interface{}
	err := json.NewDecoder(w.Body).Decode(&raw)
	require.NoError(t, err)

	// Should have exactly two keys: "code" and "message".
	assert.Len(t, raw, 2)
	assert.Equal(t, "test_code", raw["code"])
	assert.Equal(t, "test message", raw["message"])
}

func TestErrorResponse_JSONSerialization(t *testing.T) {
	resp := errorResponse{
		Code:    "not_found",
		Message: "item not found",
	}

	data, err := json.Marshal(resp)
	require.NoError(t, err)

	var decoded errorResponse
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, resp, decoded)
}

func TestErrorResponse_JSONTags(t *testing.T) {
	resp := errorResponse{
		Code:    "test",
		Message: "test message",
	}

	data, err := json.Marshal(resp)
	require.NoError(t, err)

	// Verify the JSON keys match the expected struct tags.
	var raw map[string]interface{}
	err = json.Unmarshal(data, &raw)
	require.NoError(t, err)

	_, hasCode := raw["code"]
	_, hasMessage := raw["message"]
	assert.True(t, hasCode, "JSON should have 'code' key")
	assert.True(t, hasMessage, "JSON should have 'message' key")
}
