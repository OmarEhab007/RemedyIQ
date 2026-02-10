package middleware

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// errorResponse mirrors the api.ErrorResponse structure but is defined here
// to avoid an import cycle between the middleware and api packages.
type errorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// writeError writes a JSON error response. This is a self-contained helper
// so that middleware does not need to import the parent api package.
func writeError(w http.ResponseWriter, status int, code string, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(errorResponse{
		Code:    code,
		Message: message,
	}); err != nil {
		slog.Error("failed to encode middleware error response", "error", err)
	}
}
