package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
)

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

var (
	fixedTenantID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	fixedFileID   = uuid.MustParse("00000000-0000-0000-0000-000000000002")
	fixedJobID    = uuid.MustParse("00000000-0000-0000-0000-000000000003")
)

// injectAuth sets tenant and user context values on the request and returns it.
func injectAuth(req *http.Request, tenantID string) *http.Request {
	ctx := middleware.WithTenantID(req.Context(), tenantID)
	ctx = middleware.WithUserID(ctx, "test-user")
	return req.WithContext(ctx)
}

// decodeError is a small helper that decodes an api.ErrorResponse from the
// recorder body, failing the test on any decode error.
func decodeError(t *testing.T, w *httptest.ResponseRecorder) api.ErrorResponse {
	t.Helper()
	var resp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	return resp
}

// ---------------------------------------------------------------------------
// CreateAnalysis tests
// ---------------------------------------------------------------------------

func TestCreateAnalysis(t *testing.T) {
	now := time.Now().UTC()

	validFile := &domain.LogFile{
		ID:        fixedFileID,
		TenantID:  fixedTenantID,
		Filename:  "arapi_server.log",
		SizeBytes: 1024,
	}

	tests := []struct {
		name           string
		tenantID       string // empty means no tenant context
		body           string
		setupPG        func(pg *testutil.MockPostgresStore)
		setupNATS      func(ns *testutil.MockNATSStreamer)
		wantStatus     int
		wantErrCode    string
		wantErrContain string
		wantJobInBody  bool
	}{
		// --- Auth / validation errors ---
		{
			name:           "missing tenant context returns 401",
			tenantID:       "",
			body:           `{"file_id":"` + fixedFileID.String() + `"}`,
			wantStatus:     http.StatusUnauthorized,
			wantErrCode:    api.ErrCodeUnauthorized,
			wantErrContain: "tenant",
		},
		{
			name:           "invalid JSON body returns 400",
			tenantID:       fixedTenantID.String(),
			body:           `{invalid-json`,
			wantStatus:     http.StatusBadRequest,
			wantErrCode:    api.ErrCodeInvalidRequest,
			wantErrContain: "JSON",
		},
		{
			name:           "empty body returns 400",
			tenantID:       fixedTenantID.String(),
			body:           ``,
			wantStatus:     http.StatusBadRequest,
			wantErrCode:    api.ErrCodeInvalidRequest,
			wantErrContain: "JSON",
		},
		{
			name:           "invalid file_id returns 400",
			tenantID:       fixedTenantID.String(),
			body:           `{"file_id":"not-a-uuid"}`,
			wantStatus:     http.StatusBadRequest,
			wantErrCode:    api.ErrCodeInvalidRequest,
			wantErrContain: "file_id",
		},
		{
			name:           "empty file_id returns 400",
			tenantID:       fixedTenantID.String(),
			body:           `{"file_id":""}`,
			wantStatus:     http.StatusBadRequest,
			wantErrCode:    api.ErrCodeInvalidRequest,
			wantErrContain: "file_id",
		},
		{
			name:           "invalid tenant_id format returns 400",
			tenantID:       "not-a-uuid",
			body:           `{"file_id":"` + fixedFileID.String() + `"}`,
			wantStatus:     http.StatusBadRequest,
			wantErrCode:    api.ErrCodeInvalidRequest,
			wantErrContain: "tenant_id",
		},

		// --- Storage / file lookup errors ---
		{
			name:     "file not found returns 404",
			tenantID: fixedTenantID.String(),
			body:     `{"file_id":"` + fixedFileID.String() + `"}`,
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("GetLogFile", mock.Anything, fixedTenantID, fixedFileID).
					Return(nil, fmt.Errorf("not found"))
			},
			wantStatus:     http.StatusNotFound,
			wantErrCode:    api.ErrCodeNotFound,
			wantErrContain: "file not found",
		},
		{
			name:     "GetLogFile internal error returns 500",
			tenantID: fixedTenantID.String(),
			body:     `{"file_id":"` + fixedFileID.String() + `"}`,
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("GetLogFile", mock.Anything, fixedTenantID, fixedFileID).
					Return(nil, fmt.Errorf("connection refused"))
			},
			wantStatus:     http.StatusInternalServerError,
			wantErrCode:    api.ErrCodeInternalError,
			wantErrContain: "retrieve file",
		},

		// --- CreateJob error ---
		{
			name:     "CreateJob failure returns 500",
			tenantID: fixedTenantID.String(),
			body:     `{"file_id":"` + fixedFileID.String() + `"}`,
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("GetLogFile", mock.Anything, fixedTenantID, fixedFileID).
					Return(validFile, nil)
				pg.On("CreateJob", mock.Anything, mock.AnythingOfType("*domain.AnalysisJob")).
					Return(fmt.Errorf("db write error"))
			},
			wantStatus:     http.StatusInternalServerError,
			wantErrCode:    api.ErrCodeInternalError,
			wantErrContain: "create analysis job",
		},

		// --- NATS publish error (job created but not queued) ---
		{
			name:     "PublishJobSubmit failure returns 500 and updates job to failed",
			tenantID: fixedTenantID.String(),
			body:     `{"file_id":"` + fixedFileID.String() + `"}`,
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("GetLogFile", mock.Anything, fixedTenantID, fixedFileID).
					Return(validFile, nil)
				pg.On("CreateJob", mock.Anything, mock.AnythingOfType("*domain.AnalysisJob")).
					Return(nil)
				pg.On("UpdateJobStatus", mock.Anything, fixedTenantID, mock.AnythingOfType("uuid.UUID"),
					domain.JobStatusFailed, mock.AnythingOfType("*string")).
					Return(nil)
			},
			setupNATS: func(ns *testutil.MockNATSStreamer) {
				ns.On("PublishJobSubmit", mock.Anything, fixedTenantID.String(),
					mock.AnythingOfType("domain.AnalysisJob")).
					Return(fmt.Errorf("nats connection lost"))
			},
			wantStatus:     http.StatusInternalServerError,
			wantErrCode:    api.ErrCodeInternalError,
			wantErrContain: "queue analysis job",
		},
		{
			name:     "PublishJobSubmit failure with UpdateJobStatus also failing still returns 500",
			tenantID: fixedTenantID.String(),
			body:     `{"file_id":"` + fixedFileID.String() + `"}`,
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("GetLogFile", mock.Anything, fixedTenantID, fixedFileID).
					Return(validFile, nil)
				pg.On("CreateJob", mock.Anything, mock.AnythingOfType("*domain.AnalysisJob")).
					Return(nil)
				pg.On("UpdateJobStatus", mock.Anything, fixedTenantID, mock.AnythingOfType("uuid.UUID"),
					domain.JobStatusFailed, mock.AnythingOfType("*string")).
					Return(fmt.Errorf("db update error"))
			},
			setupNATS: func(ns *testutil.MockNATSStreamer) {
				ns.On("PublishJobSubmit", mock.Anything, fixedTenantID.String(),
					mock.AnythingOfType("domain.AnalysisJob")).
					Return(fmt.Errorf("nats connection lost"))
			},
			wantStatus:     http.StatusInternalServerError,
			wantErrCode:    api.ErrCodeInternalError,
			wantErrContain: "queue analysis job",
		},

		// --- Happy path ---
		{
			name:     "successful creation returns 201 with job",
			tenantID: fixedTenantID.String(),
			body:     `{"file_id":"` + fixedFileID.String() + `"}`,
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("GetLogFile", mock.Anything, fixedTenantID, fixedFileID).
					Return(validFile, nil)
				pg.On("CreateJob", mock.Anything, mock.AnythingOfType("*domain.AnalysisJob")).
					Return(nil)
			},
			setupNATS: func(ns *testutil.MockNATSStreamer) {
				ns.On("PublishJobSubmit", mock.Anything, fixedTenantID.String(),
					mock.AnythingOfType("domain.AnalysisJob")).
					Return(nil)
			},
			wantStatus:    http.StatusCreated,
			wantJobInBody: true,
		},
		{
			name:     "successful creation with jar_flags preserves flags",
			tenantID: fixedTenantID.String(),
			body:     `{"file_id":"` + fixedFileID.String() + `","jar_flags":{"top_n":100,"sort_by":"duration"}}`,
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("GetLogFile", mock.Anything, fixedTenantID, fixedFileID).
					Return(validFile, nil)
				pg.On("CreateJob", mock.Anything, mock.AnythingOfType("*domain.AnalysisJob")).
					Return(nil)
			},
			setupNATS: func(ns *testutil.MockNATSStreamer) {
				ns.On("PublishJobSubmit", mock.Anything, fixedTenantID.String(),
					mock.AnythingOfType("domain.AnalysisJob")).
					Return(nil)
			},
			wantStatus:    http.StatusCreated,
			wantJobInBody: true,
		},
		{
			name:     "default top_n is 50 when jar_flags omitted",
			tenantID: fixedTenantID.String(),
			body:     `{"file_id":"` + fixedFileID.String() + `"}`,
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("GetLogFile", mock.Anything, fixedTenantID, fixedFileID).
					Return(validFile, nil)
				pg.On("CreateJob", mock.Anything, mock.MatchedBy(func(job *domain.AnalysisJob) bool {
					return job.JARFlags.TopN == 50
				})).Return(nil)
			},
			setupNATS: func(ns *testutil.MockNATSStreamer) {
				ns.On("PublishJobSubmit", mock.Anything, fixedTenantID.String(),
					mock.AnythingOfType("domain.AnalysisJob")).
					Return(nil)
			},
			wantStatus:    http.StatusCreated,
			wantJobInBody: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pg := new(testutil.MockPostgresStore)
			ns := new(testutil.MockNATSStreamer)

			if tc.setupPG != nil {
				tc.setupPG(pg)
			}
			if tc.setupNATS != nil {
				tc.setupNATS(ns)
			}

			h := NewAnalysisHandlers(pg, ns)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis", bytes.NewBufferString(tc.body))
			req.Header.Set("Content-Type", "application/json")

			if tc.tenantID != "" {
				req = injectAuth(req, tc.tenantID)
			}

			w := httptest.NewRecorder()
			h.CreateAnalysis().ServeHTTP(w, req)

			assert.Equal(t, tc.wantStatus, w.Code, "unexpected HTTP status")

			if tc.wantErrCode != "" {
				errResp := decodeError(t, w)
				assert.Equal(t, tc.wantErrCode, errResp.Code, "unexpected error code")
				if tc.wantErrContain != "" {
					assert.Contains(t, errResp.Message, tc.wantErrContain, "error message mismatch")
				}
			}

			if tc.wantJobInBody {
				var job domain.AnalysisJob
				require.NoError(t, json.NewDecoder(w.Body).Decode(&job))
				assert.Equal(t, fixedTenantID, job.TenantID)
				assert.Equal(t, fixedFileID, job.FileID)
				assert.Equal(t, domain.JobStatusQueued, job.Status)
				assert.NotEqual(t, uuid.Nil, job.ID, "job ID should be generated")
				assert.False(t, job.CreatedAt.IsZero(), "created_at should be set")
				assert.False(t, job.UpdatedAt.IsZero(), "updated_at should be set")
				assert.True(t, job.CreatedAt.Before(now.Add(5*time.Second)), "created_at should be recent")
			}

			pg.AssertExpectations(t)
			ns.AssertExpectations(t)
		})
	}
}

// TestCreateAnalysis_JARFlagsTopNDefault verifies the TopN default separately
// with a MatchedBy assertion on the job passed to CreateJob.
func TestCreateAnalysis_JARFlagsTopNDefault(t *testing.T) {
	pg := new(testutil.MockPostgresStore)
	ns := new(testutil.MockNATSStreamer)

	validFile := &domain.LogFile{
		ID:       fixedFileID,
		TenantID: fixedTenantID,
		Filename: "server.log",
	}

	pg.On("GetLogFile", mock.Anything, fixedTenantID, fixedFileID).
		Return(validFile, nil)

	// Use MatchedBy to verify that TopN was defaulted to 50.
	pg.On("CreateJob", mock.Anything, mock.MatchedBy(func(job *domain.AnalysisJob) bool {
		return job.JARFlags.TopN == 50 &&
			job.Status == domain.JobStatusQueued &&
			job.TenantID == fixedTenantID &&
			job.FileID == fixedFileID
	})).Return(nil)

	ns.On("PublishJobSubmit", mock.Anything, fixedTenantID.String(),
		mock.AnythingOfType("domain.AnalysisJob")).
		Return(nil)

	h := NewAnalysisHandlers(pg, ns)
	body := `{"file_id":"` + fixedFileID.String() + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req = injectAuth(req, fixedTenantID.String())

	w := httptest.NewRecorder()
	h.CreateAnalysis().ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	pg.AssertExpectations(t)
	ns.AssertExpectations(t)
}

// TestCreateAnalysis_JARFlagsExplicitTopN verifies that a caller-provided TopN
// value is respected and not overwritten.
func TestCreateAnalysis_JARFlagsExplicitTopN(t *testing.T) {
	pg := new(testutil.MockPostgresStore)
	ns := new(testutil.MockNATSStreamer)

	validFile := &domain.LogFile{
		ID:       fixedFileID,
		TenantID: fixedTenantID,
		Filename: "server.log",
	}

	pg.On("GetLogFile", mock.Anything, fixedTenantID, fixedFileID).
		Return(validFile, nil)

	pg.On("CreateJob", mock.Anything, mock.MatchedBy(func(job *domain.AnalysisJob) bool {
		return job.JARFlags.TopN == 200
	})).Return(nil)

	ns.On("PublishJobSubmit", mock.Anything, fixedTenantID.String(),
		mock.AnythingOfType("domain.AnalysisJob")).
		Return(nil)

	h := NewAnalysisHandlers(pg, ns)
	body := `{"file_id":"` + fixedFileID.String() + `","jar_flags":{"top_n":200}}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req = injectAuth(req, fixedTenantID.String())

	w := httptest.NewRecorder()
	h.CreateAnalysis().ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	pg.AssertExpectations(t)
	ns.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// ListAnalyses tests
// ---------------------------------------------------------------------------

func TestListAnalyses(t *testing.T) {
	now := time.Now().UTC()
	sampleJobs := []domain.AnalysisJob{
		{
			ID:        fixedJobID,
			TenantID:  fixedTenantID,
			FileID:    fixedFileID,
			Status:    domain.JobStatusComplete,
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			ID:        uuid.MustParse("00000000-0000-0000-0000-000000000004"),
			TenantID:  fixedTenantID,
			FileID:    fixedFileID,
			Status:    domain.JobStatusQueued,
			CreatedAt: now,
			UpdatedAt: now,
		},
	}

	tests := []struct {
		name           string
		tenantID       string
		setupPG        func(pg *testutil.MockPostgresStore)
		wantStatus     int
		wantErrCode    string
		wantErrContain string
		wantJobCount   int // -1 means do not check
	}{
		{
			name:           "missing tenant context returns 401",
			tenantID:       "",
			wantStatus:     http.StatusUnauthorized,
			wantErrCode:    api.ErrCodeUnauthorized,
			wantErrContain: "tenant",
		},
		{
			name:           "invalid tenant_id format returns 400",
			tenantID:       "bad-tenant",
			wantStatus:     http.StatusBadRequest,
			wantErrCode:    api.ErrCodeInvalidRequest,
			wantErrContain: "tenant_id",
		},
		{
			name:     "ListJobs internal error returns 500",
			tenantID: fixedTenantID.String(),
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("ListJobs", mock.Anything, fixedTenantID).
					Return(nil, fmt.Errorf("connection timeout"))
			},
			wantStatus:     http.StatusInternalServerError,
			wantErrCode:    api.ErrCodeInternalError,
			wantErrContain: "list analysis jobs",
		},
		{
			name:     "successful list returns 200 with jobs and pagination",
			tenantID: fixedTenantID.String(),
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("ListJobs", mock.Anything, fixedTenantID).
					Return(sampleJobs, nil)
			},
			wantStatus:   http.StatusOK,
			wantJobCount: 2,
		},
		{
			name:     "empty result returns 200 with empty jobs array",
			tenantID: fixedTenantID.String(),
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("ListJobs", mock.Anything, fixedTenantID).
					Return([]domain.AnalysisJob{}, nil)
			},
			wantStatus:   http.StatusOK,
			wantJobCount: 0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pg := new(testutil.MockPostgresStore)
			ns := new(testutil.MockNATSStreamer)

			if tc.setupPG != nil {
				tc.setupPG(pg)
			}

			h := NewAnalysisHandlers(pg, ns)
			req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis", nil)

			if tc.tenantID != "" {
				req = injectAuth(req, tc.tenantID)
			}

			w := httptest.NewRecorder()
			h.ListAnalyses().ServeHTTP(w, req)

			assert.Equal(t, tc.wantStatus, w.Code, "unexpected HTTP status")

			if tc.wantErrCode != "" {
				errResp := decodeError(t, w)
				assert.Equal(t, tc.wantErrCode, errResp.Code)
				if tc.wantErrContain != "" {
					assert.Contains(t, errResp.Message, tc.wantErrContain)
				}
			}

			if tc.wantJobCount >= 0 && tc.wantErrCode == "" {
				var body struct {
					Jobs       []domain.AnalysisJob   `json:"jobs"`
					Pagination map[string]interface{} `json:"pagination"`
				}
				require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
				assert.Len(t, body.Jobs, tc.wantJobCount, "unexpected job count")

				// Verify pagination envelope is present and consistent.
				require.NotNil(t, body.Pagination, "pagination should be present")
				assert.EqualValues(t, 1, body.Pagination["page"])
				assert.EqualValues(t, tc.wantJobCount, int(body.Pagination["page_size"].(float64)))
				assert.EqualValues(t, tc.wantJobCount, int(body.Pagination["total_count"].(float64)))
				assert.EqualValues(t, 1, body.Pagination["total_pages"])
			}

			pg.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// GetAnalysis tests
// ---------------------------------------------------------------------------

func TestGetAnalysis(t *testing.T) {
	now := time.Now().UTC()
	completedJob := &domain.AnalysisJob{
		ID:        fixedJobID,
		TenantID:  fixedTenantID,
		FileID:    fixedFileID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}

	tests := []struct {
		name           string
		tenantID       string
		jobIDVar       string // value set in mux.Vars; empty means not set
		setupPG        func(pg *testutil.MockPostgresStore)
		wantStatus     int
		wantErrCode    string
		wantErrContain string
		wantJob        bool
	}{
		// --- Auth / validation errors ---
		{
			name:           "missing tenant context returns 401",
			tenantID:       "",
			jobIDVar:       fixedJobID.String(),
			wantStatus:     http.StatusUnauthorized,
			wantErrCode:    api.ErrCodeUnauthorized,
			wantErrContain: "tenant",
		},
		{
			name:           "invalid job_id returns 400",
			tenantID:       fixedTenantID.String(),
			jobIDVar:       "not-a-uuid",
			wantStatus:     http.StatusBadRequest,
			wantErrCode:    api.ErrCodeInvalidRequest,
			wantErrContain: "job_id",
		},
		{
			name:           "empty job_id returns 400",
			tenantID:       fixedTenantID.String(),
			jobIDVar:       "",
			wantStatus:     http.StatusBadRequest,
			wantErrCode:    api.ErrCodeInvalidRequest,
			wantErrContain: "job_id",
		},
		{
			name:           "invalid tenant_id format returns 400",
			tenantID:       "bad-tenant-id",
			jobIDVar:       fixedJobID.String(),
			wantStatus:     http.StatusBadRequest,
			wantErrCode:    api.ErrCodeInvalidRequest,
			wantErrContain: "tenant_id",
		},

		// --- Storage errors ---
		{
			name:     "job not found returns 404",
			tenantID: fixedTenantID.String(),
			jobIDVar: fixedJobID.String(),
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("GetJob", mock.Anything, fixedTenantID, fixedJobID).
					Return(nil, fmt.Errorf("not found"))
			},
			wantStatus:     http.StatusNotFound,
			wantErrCode:    api.ErrCodeNotFound,
			wantErrContain: "analysis job not found",
		},
		{
			name:     "GetJob internal error returns 500",
			tenantID: fixedTenantID.String(),
			jobIDVar: fixedJobID.String(),
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("GetJob", mock.Anything, fixedTenantID, fixedJobID).
					Return(nil, fmt.Errorf("database unreachable"))
			},
			wantStatus:     http.StatusInternalServerError,
			wantErrCode:    api.ErrCodeInternalError,
			wantErrContain: "retrieve analysis job",
		},

		// --- Happy path ---
		{
			name:     "successful get returns 200 with job",
			tenantID: fixedTenantID.String(),
			jobIDVar: fixedJobID.String(),
			setupPG: func(pg *testutil.MockPostgresStore) {
				pg.On("GetJob", mock.Anything, fixedTenantID, fixedJobID).
					Return(completedJob, nil)
			},
			wantStatus: http.StatusOK,
			wantJob:    true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pg := new(testutil.MockPostgresStore)
			ns := new(testutil.MockNATSStreamer)

			if tc.setupPG != nil {
				tc.setupPG(pg)
			}

			h := NewAnalysisHandlers(pg, ns)
			req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+tc.jobIDVar, nil)

			if tc.tenantID != "" {
				req = injectAuth(req, tc.tenantID)
			}

			// Set mux URL vars so the handler can extract job_id.
			req = mux.SetURLVars(req, map[string]string{"job_id": tc.jobIDVar})

			w := httptest.NewRecorder()
			h.GetAnalysis().ServeHTTP(w, req)

			assert.Equal(t, tc.wantStatus, w.Code, "unexpected HTTP status")

			if tc.wantErrCode != "" {
				errResp := decodeError(t, w)
				assert.Equal(t, tc.wantErrCode, errResp.Code)
				if tc.wantErrContain != "" {
					assert.Contains(t, errResp.Message, tc.wantErrContain)
				}
			}

			if tc.wantJob {
				var job domain.AnalysisJob
				require.NoError(t, json.NewDecoder(w.Body).Decode(&job))
				assert.Equal(t, fixedJobID, job.ID)
				assert.Equal(t, fixedTenantID, job.TenantID)
				assert.Equal(t, fixedFileID, job.FileID)
				assert.Equal(t, domain.JobStatusComplete, job.Status)
			}

			pg.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// GetAnalysis with different job statuses
// ---------------------------------------------------------------------------

func TestGetAnalysis_ReturnsAllJobStatuses(t *testing.T) {
	now := time.Now().UTC()

	statuses := []domain.JobStatus{
		domain.JobStatusQueued,
		domain.JobStatusParsing,
		domain.JobStatusAnalyzing,
		domain.JobStatusStoring,
		domain.JobStatusComplete,
		domain.JobStatusFailed,
	}

	for _, status := range statuses {
		t.Run(string(status), func(t *testing.T) {
			pg := new(testutil.MockPostgresStore)
			ns := new(testutil.MockNATSStreamer)

			job := &domain.AnalysisJob{
				ID:        fixedJobID,
				TenantID:  fixedTenantID,
				FileID:    fixedFileID,
				Status:    status,
				CreatedAt: now,
				UpdatedAt: now,
			}

			pg.On("GetJob", mock.Anything, fixedTenantID, fixedJobID).
				Return(job, nil)

			h := NewAnalysisHandlers(pg, ns)
			req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+fixedJobID.String(), nil)
			req = injectAuth(req, fixedTenantID.String())
			req = mux.SetURLVars(req, map[string]string{"job_id": fixedJobID.String()})

			w := httptest.NewRecorder()
			h.GetAnalysis().ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)

			var result domain.AnalysisJob
			require.NoError(t, json.NewDecoder(w.Body).Decode(&result))
			assert.Equal(t, status, result.Status)

			pg.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// Response content-type verification
// ---------------------------------------------------------------------------

func TestHandlers_ReturnJSONContentType(t *testing.T) {
	// Each subtest uses a request that short-circuits before any storage
	// call so that nil mocks are safe. The goal is to verify that error
	// responses carry a JSON content type.
	tests := []struct {
		name     string
		handler  func(h *AnalysisHandlers) http.Handler
		method   string
		path     string
		body     string
		tenantID string
		vars     map[string]string
	}{
		{
			name:     "CreateAnalysis 401 has JSON content type",
			handler:  func(h *AnalysisHandlers) http.Handler { return h.CreateAnalysis() },
			method:   http.MethodPost,
			path:     "/api/v1/analysis",
			body:     `{"file_id":"abc"}`,
			tenantID: "", // no tenant -- 401
		},
		{
			name:     "CreateAnalysis 400 has JSON content type",
			handler:  func(h *AnalysisHandlers) http.Handler { return h.CreateAnalysis() },
			method:   http.MethodPost,
			path:     "/api/v1/analysis",
			body:     `{invalid`,
			tenantID: fixedTenantID.String(),
		},
		{
			name:     "ListAnalyses 401 has JSON content type",
			handler:  func(h *AnalysisHandlers) http.Handler { return h.ListAnalyses() },
			method:   http.MethodGet,
			path:     "/api/v1/analysis",
			tenantID: "", // no tenant -- 401
		},
		{
			name:     "ListAnalyses 400 has JSON content type",
			handler:  func(h *AnalysisHandlers) http.Handler { return h.ListAnalyses() },
			method:   http.MethodGet,
			path:     "/api/v1/analysis",
			tenantID: "bad-tenant", // invalid UUID -- 400
		},
		{
			name:     "GetAnalysis 401 has JSON content type",
			handler:  func(h *AnalysisHandlers) http.Handler { return h.GetAnalysis() },
			method:   http.MethodGet,
			path:     "/api/v1/analysis/not-valid",
			tenantID: "", // no tenant -- 401
			vars:     map[string]string{"job_id": fixedJobID.String()},
		},
		{
			name:     "GetAnalysis 400 has JSON content type",
			handler:  func(h *AnalysisHandlers) http.Handler { return h.GetAnalysis() },
			method:   http.MethodGet,
			path:     "/api/v1/analysis/not-valid",
			tenantID: fixedTenantID.String(),
			vars:     map[string]string{"job_id": "not-valid"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			h := NewAnalysisHandlers(nil, nil)
			req := httptest.NewRequest(tc.method, tc.path, bytes.NewBufferString(tc.body))
			if tc.tenantID != "" {
				req = injectAuth(req, tc.tenantID)
			}
			if tc.vars != nil {
				req = mux.SetURLVars(req, tc.vars)
			}

			w := httptest.NewRecorder()
			tc.handler(h).ServeHTTP(w, req)

			ct := w.Header().Get("Content-Type")
			assert.Contains(t, ct, "application/json", "response should have JSON content type")
		})
	}
}

// ---------------------------------------------------------------------------
// NewAnalysisHandlers constructor
// ---------------------------------------------------------------------------

func TestNewAnalysisHandlers_ReturnsNonNil(t *testing.T) {
	pg := new(testutil.MockPostgresStore)
	ns := new(testutil.MockNATSStreamer)
	h := NewAnalysisHandlers(pg, ns)
	require.NotNil(t, h, "NewAnalysisHandlers should return a non-nil handler")
}
