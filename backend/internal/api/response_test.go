package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJSON(t *testing.T) {
	t.Run("writes status and body", func(t *testing.T) {
		w := httptest.NewRecorder()
		payload := map[string]string{"hello": "world"}
		JSON(w, http.StatusOK, payload)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}
		if ct := w.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
			t.Fatalf("unexpected Content-Type: %s", ct)
		}

		var body map[string]string
		if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
			t.Fatalf("failed to decode body: %v", err)
		}
		if body["hello"] != "world" {
			t.Fatalf("unexpected body: %v", body)
		}
	})

	t.Run("nil data produces empty body", func(t *testing.T) {
		w := httptest.NewRecorder()
		JSON(w, http.StatusNoContent, nil)

		if w.Code != http.StatusNoContent {
			t.Fatalf("expected status 204, got %d", w.Code)
		}
		if w.Body.Len() != 0 {
			t.Fatalf("expected empty body, got %d bytes", w.Body.Len())
		}
	})
}

func TestError(t *testing.T) {
	w := httptest.NewRecorder()
	Error(w, http.StatusBadRequest, ErrCodeInvalidRequest, "bad input")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", w.Code)
	}

	var body ErrorResponse
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode body: %v", err)
	}
	if body.Code != ErrCodeInvalidRequest {
		t.Fatalf("expected code %q, got %q", ErrCodeInvalidRequest, body.Code)
	}
	if body.Message != "bad input" {
		t.Fatalf("expected message %q, got %q", "bad input", body.Message)
	}
	if body.Details != nil {
		t.Fatalf("expected nil details, got %v", body.Details)
	}
}

func TestErrorWithDetails(t *testing.T) {
	w := httptest.NewRecorder()
	details := map[string]string{"field": "email", "reason": "invalid format"}
	ErrorWithDetails(w, http.StatusUnprocessableEntity, ErrCodeInvalidRequest, "validation failed", details)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422, got %d", w.Code)
	}

	var body struct {
		Code    string            `json:"code"`
		Message string            `json:"message"`
		Details map[string]string `json:"details"`
	}
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode body: %v", err)
	}
	if body.Details["field"] != "email" {
		t.Fatalf("unexpected details: %v", body.Details)
	}
}
