package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"
)

// RecoveryMiddleware recovers from panics in downstream handlers, logs the
// stack trace, and returns a 500 Internal Server Error to the client. It
// should be the outermost middleware in the chain.
func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				stack := debug.Stack()

				slog.Error("panic recovered in HTTP handler",
					"panic", rec,
					"method", r.Method,
					"path", r.URL.Path,
					"remote_addr", r.RemoteAddr,
					"stack", string(stack),
				)

				writeError(w, http.StatusInternalServerError, "internal_error", "internal server error")
			}
		}()

		next.ServeHTTP(w, r)
	})
}
