package handlers

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

const maxUploadSize = 2 << 30 // 2 GB

// UploadHandler handles POST /api/v1/files/upload.
type UploadHandler struct {
	pg storage.PostgresStore
	s3 storage.S3Storage
}

func NewUploadHandler(pg storage.PostgresStore, s3 storage.S3Storage) *UploadHandler {
	return &UploadHandler{pg: pg, s3: s3}
}

func (h *UploadHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			api.Error(w, http.StatusRequestEntityTooLarge, api.ErrCodeFileTooLarge, "file exceeds 2GB limit")
			return
		}
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid multipart form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "missing 'file' field")
		return
	}
	defer file.Close()

	// Validate tenant ID format before uploading to S3 to avoid orphan objects.
	tid, err := uuid.Parse(tenantID)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid tenant_id format")
		return
	}

	// Detect log types from filename.
	detectedTypes := detectLogTypes(header.Filename)

	// Buffer to a temp file so the AWS SDK can seek for payload hash computation.
	tmpFile, err := os.CreateTemp("", "remedyiq-upload-*")
	if err != nil {
		slog.Error("failed to create temp file", "error", err)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to process upload")
		return
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	// Copy the upload into the temp file while computing the SHA-256 checksum.
	hasher := sha256.New()
	size, err := io.Copy(io.MultiWriter(tmpFile, hasher), file)
	if err != nil {
		slog.Error("failed to buffer upload", "error", err)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to process upload")
		return
	}

	// Seek back to the start for the S3 upload.
	if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
		slog.Error("failed to seek temp file", "error", err)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to process upload")
		return
	}

	// Generate S3 key and upload.
	fileID := uuid.New()
	s3Key := path.Join("tenants", tenantID, "jobs", fileID.String(), header.Filename)

	if err := h.s3.Upload(r.Context(), s3Key, tmpFile, size); err != nil {
		slog.Error("S3 upload failed", "key", s3Key, "error", err)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to upload file")
		return
	}

	logFile := &domain.LogFile{
		ID:             fileID,
		TenantID:       tid,
		Filename:       header.Filename,
		SizeBytes:      size,
		S3Key:          s3Key,
		S3Bucket:       "",
		ContentType:    header.Header.Get("Content-Type"),
		DetectedTypes:  detectedTypes,
		ChecksumSHA256: fmt.Sprintf("%x", hasher.Sum(nil)),
		UploadedAt:     time.Now().UTC(),
	}

	if err := h.pg.CreateLogFile(r.Context(), logFile); err != nil {
		// S3 upload succeeded but Postgres save failed -- file will be orphaned in S3 (cleanup is optional for MVP)
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to save file metadata")
		return
	}

	api.JSON(w, http.StatusCreated, logFile)
}

func detectLogTypes(filename string) []string {
	lower := strings.ToLower(filename)
	var types []string
	if strings.Contains(lower, "api") {
		types = append(types, string(domain.LogTypeAPI))
	}
	if strings.Contains(lower, "sql") {
		types = append(types, string(domain.LogTypeSQL))
	}
	if strings.Contains(lower, "filter") || strings.Contains(lower, "fltr") {
		types = append(types, string(domain.LogTypeFilter))
	}
	if strings.Contains(lower, "escalation") ||
		strings.Contains(lower, "_esc_") ||
		strings.Contains(lower, "_esc.") ||
		strings.HasPrefix(lower, "esc_") ||
		strings.HasSuffix(lower, "_esc") {
		types = append(types, string(domain.LogTypeEscalation))
	}
	if len(types) == 0 {
		types = []string{string(domain.LogTypeAPI), string(domain.LogTypeSQL), string(domain.LogTypeFilter), string(domain.LogTypeEscalation)}
	}
	return types
}
