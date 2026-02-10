package middleware

import (
	"net/http"
)

// MaxJSONBodySize is the maximum allowed size for JSON request bodies (1 MB).
// File uploads use a separate, larger limit enforced in the upload handler.
const MaxJSONBodySize int64 = 1 << 20 // 1 MB

// BodyLimitMiddleware restricts the size of request bodies to prevent
// denial-of-service attacks via excessively large JSON payloads. File
// upload endpoints should apply their own limit and are excluded here
// by checking Content-Type.
func BodyLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip multipart/form-data requests — file uploads have their
		// own size enforcement (e.g. 2 GB limit in the upload handler).
		ct := r.Header.Get("Content-Type")
		if len(ct) >= 19 && ct[:19] == "multipart/form-data" {
			next.ServeHTTP(w, r)
			return
		}

		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, MaxJSONBodySize)
		}

		next.ServeHTTP(w, r)
	})
}
