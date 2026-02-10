package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// Standard error codes aligned with the OpenAPI spec.
const (
	ErrCodeInvalidRequest   = "invalid_request"
	ErrCodeNotFound         = "not_found"
	ErrCodeUnauthorized     = "unauthorized"
	ErrCodeForbidden        = "forbidden"
	ErrCodeRateLimited      = "rate_limited"
	ErrCodeInternalError    = "internal_error"
	ErrCodeServiceUnavail   = "service_unavailable"
	ErrCodeFileTooLarge     = "file_too_large"
	ErrCodeUnsupportedMedia = "unsupported_media_type"
	ErrCodeConflict         = "conflict"
)

// ErrorResponse is the standard error envelope returned to clients.
type ErrorResponse struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// JSON writes a JSON response with the given HTTP status code.
// If encoding fails the error is logged, but the status code has already been
// sent on the wire so the client will receive the original status with a
// potentially truncated body.
func JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	if data == nil {
		return
	}

	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("failed to encode JSON response",
			"error", err,
		)
	}
}

// Error writes a standardised error response.
func Error(w http.ResponseWriter, status int, code string, message string) {
	JSON(w, status, ErrorResponse{
		Code:    code,
		Message: message,
	})
}

// ErrorWithDetails writes a standardised error response that includes
// additional structured details (e.g. validation errors).
func ErrorWithDetails(w http.ResponseWriter, status int, code string, message string, details interface{}) {
	JSON(w, status, ErrorResponse{
		Code:    code,
		Message: message,
		Details: details,
	})
}
