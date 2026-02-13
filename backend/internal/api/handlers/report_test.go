package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
)

// ---------------------------------------------------------------------------
// Helper factories for ReportHandler tests
// ---------------------------------------------------------------------------

func newReportRegistry(t *testing.T) *ai.Registry {
	t.Helper()
	registry := ai.NewRegistry()
	summarizer := &mockSkill{
		name:        "summarizer",
		description: "Generates executive summaries",
		examples:    []string{"Generate a report"},
		execFn: func(_ context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
			return &ai.SkillOutput{
				Answer:    "<h1>Executive Summary</h1><p>Report for job " + input.JobID + "</p>",
				SkillName: "summarizer",
			}, nil
		},
	}
	require.NoError(t, registry.Register(summarizer))
	return registry
}

func newFailingReportRegistry(t *testing.T) *ai.Registry {
	t.Helper()
	registry := ai.NewRegistry()
	summarizer := &mockSkill{
		name:        "summarizer",
		description: "Generates executive summaries",
		examples:    []string{"Generate a report"},
		execFn: func(_ context.Context, _ ai.SkillInput) (*ai.SkillOutput, error) {
			return nil, errors.New("AI provider unavailable")
		},
	}
	require.NoError(t, registry.Register(summarizer))
	return registry
}

// ---------------------------------------------------------------------------
// ReportHandler tests
// ---------------------------------------------------------------------------

func TestReportHandler_MissingTenantContext(t *testing.T) {
	registry := ai.NewRegistry()
	h := NewReportHandler(nil, registry)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/report", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
	assert.Contains(t, errResp.Message, "missing tenant context")
}

func TestReportHandler_InvalidJobID(t *testing.T) {
	registry := ai.NewRegistry()
	h := NewReportHandler(nil, registry)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/not-a-uuid/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "550e8400-e29b-41d4-a716-446655440000")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "not-a-uuid"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "job_id")
}

func TestReportHandler_InvalidFormat(t *testing.T) {
	registry := ai.NewRegistry()
	pg := new(testutil.MockPostgresStore)
	h := NewReportHandler(pg, registry)

	body := `{"format":"pdf"}`
	jobID := uuid.New()
	tenantID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "format")
}

func TestReportHandler_InvalidFormat_XML(t *testing.T) {
	registry := ai.NewRegistry()
	pg := new(testutil.MockPostgresStore)
	h := NewReportHandler(pg, registry)

	body := `{"format":"xml"}`
	jobID := uuid.New()
	tenantID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestReportHandler_DefaultFormatHTML(t *testing.T) {
	// When no format is specified, it should default to "html".
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)

	registry := newReportRegistry(t)
	h := NewReportHandler(pg, registry)

	// Send empty body -- no format field.
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString("{}"))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp reportResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "html", resp.Format)
	assert.Equal(t, jobID.String(), resp.JobID)
	assert.Equal(t, "summarizer", resp.Skill)
	assert.NotEmpty(t, resp.Content)
	assert.NotEmpty(t, resp.Generated)

	pg.AssertExpectations(t)
}

func TestReportHandler_InvalidTenantIDFormat(t *testing.T) {
	// The tenant ID is not a valid UUID, causing uuid.Parse to fail.
	pg := new(testutil.MockPostgresStore)
	registry := ai.NewRegistry()
	h := NewReportHandler(pg, registry)

	jobID := uuid.New()
	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "not-a-valid-uuid")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "tenant_id")
}

func TestReportHandler_InvalidJSONBody(t *testing.T) {
	pg := new(testutil.MockPostgresStore)
	registry := ai.NewRegistry()
	h := NewReportHandler(pg, registry)

	jobID := uuid.New()
	tenantID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString("{invalid"))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Contains(t, errResp.Message, "invalid JSON")
}

func TestReportHandler_JobNotFound(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()

	pg := new(testutil.MockPostgresStore)
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(nil, fmt.Errorf("not found"))

	registry := newReportRegistry(t)
	h := NewReportHandler(pg, registry)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeNotFound, errResp.Code)
	assert.Contains(t, errResp.Message, "not found")

	pg.AssertExpectations(t)
}

func TestReportHandler_JobGetInternalError(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()

	pg := new(testutil.MockPostgresStore)
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(nil, errors.New("database connection timeout"))

	registry := newReportRegistry(t)
	h := NewReportHandler(pg, registry)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInternalError, errResp.Code)
	assert.Contains(t, errResp.Message, "failed to retrieve analysis job")

	pg.AssertExpectations(t)
}

func TestReportHandler_JobNotComplete(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	parsingJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusParsing,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(parsingJob, nil)

	registry := newReportRegistry(t)
	h := NewReportHandler(pg, registry)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "not yet complete")

	pg.AssertExpectations(t)
}

func TestReportHandler_JobQueued_Returns409(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	queuedJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusQueued,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(queuedJob, nil)

	registry := newReportRegistry(t)
	h := NewReportHandler(pg, registry)

	body := `{"format":"json"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)

	pg.AssertExpectations(t)
}

func TestReportHandler_AIExecutionFailure(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)

	registry := newFailingReportRegistry(t)
	h := NewReportHandler(pg, registry)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInternalError, errResp.Code)
	assert.Contains(t, errResp.Message, "report generation failed")

	pg.AssertExpectations(t)
}

func TestReportHandler_SuccessHTML(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)

	registry := newReportRegistry(t)
	h := NewReportHandler(pg, registry)

	body := `{"format":"html"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp reportResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, jobID.String(), resp.JobID)
	assert.Equal(t, "html", resp.Format)
	assert.Contains(t, resp.Content, "Executive Summary")
	assert.Contains(t, resp.Content, jobID.String())
	assert.Equal(t, "summarizer", resp.Skill)
	assert.NotEmpty(t, resp.Generated)

	// Verify generated_at is a valid RFC3339 timestamp.
	_, err := time.Parse(time.RFC3339, resp.Generated)
	assert.NoError(t, err)

	pg.AssertExpectations(t)
}

func TestReportHandler_SuccessJSON(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)

	registry := newReportRegistry(t)
	h := NewReportHandler(pg, registry)

	body := `{"format":"json"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp reportResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "json", resp.Format)
	assert.Equal(t, jobID.String(), resp.JobID)
	assert.Equal(t, "summarizer", resp.Skill)
	assert.NotEmpty(t, resp.Content)

	pg.AssertExpectations(t)
}

func TestReportHandler_EmptyBody_DefaultsToHTML(t *testing.T) {
	// Sending a nil/empty body should default to HTML format.
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	pg := new(testutil.MockPostgresStore)
	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}
	pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)

	registry := newReportRegistry(t)
	h := NewReportHandler(pg, registry)

	// Empty string body triggers io.EOF on Decode, which should be handled.
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+jobID.String()+"/report", bytes.NewBufferString(""))
	ctx := middleware.WithTenantID(req.Context(), tenantID.String())
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": jobID.String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp reportResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "html", resp.Format)

	pg.AssertExpectations(t)
}

func TestReportHandler_TableDriven(t *testing.T) {
	tenantID := uuid.New()
	jobID := uuid.New()
	now := time.Now()

	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}

	failedJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusFailed,
		CreatedAt: now,
		UpdatedAt: now,
	}

	tests := []struct {
		name           string
		tenantID       string
		jobIDStr       string
		body           string
		setupMocks     func(pg *testutil.MockPostgresStore)
		registryFn     func(t *testing.T) *ai.Registry
		expectedStatus int
		checkBody      func(t *testing.T, body []byte)
	}{
		{
			name:           "missing_tenant_returns_401",
			tenantID:       "",
			jobIDStr:       jobID.String(),
			body:           `{"format":"html"}`,
			setupMocks:     func(_ *testutil.MockPostgresStore) {},
			registryFn:     func(_ *testing.T) *ai.Registry { return ai.NewRegistry() },
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "invalid_job_id_returns_400",
			tenantID:       tenantID.String(),
			jobIDStr:       "bad-uuid",
			body:           `{"format":"html"}`,
			setupMocks:     func(_ *testutil.MockPostgresStore) {},
			registryFn:     func(_ *testing.T) *ai.Registry { return ai.NewRegistry() },
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid_format_returns_400",
			tenantID:       tenantID.String(),
			jobIDStr:       jobID.String(),
			body:           `{"format":"csv"}`,
			setupMocks:     func(_ *testutil.MockPostgresStore) {},
			registryFn:     func(_ *testing.T) *ai.Registry { return ai.NewRegistry() },
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:     "job_not_found_returns_404",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			body:     `{"format":"html"}`,
			setupMocks: func(pg *testutil.MockPostgresStore) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(nil, fmt.Errorf("not found"))
			},
			registryFn:     newReportRegistry,
			expectedStatus: http.StatusNotFound,
		},
		{
			name:     "failed_job_returns_409",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			body:     `{"format":"html"}`,
			setupMocks: func(pg *testutil.MockPostgresStore) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(failedJob, nil)
			},
			registryFn:     newReportRegistry,
			expectedStatus: http.StatusConflict,
		},
		{
			name:     "ai_failure_returns_500",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			body:     `{"format":"html"}`,
			setupMocks: func(pg *testutil.MockPostgresStore) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)
			},
			registryFn:     newFailingReportRegistry,
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:     "success_returns_200",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			body:     `{"format":"json"}`,
			setupMocks: func(pg *testutil.MockPostgresStore) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)
			},
			registryFn:     newReportRegistry,
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp reportResponse
				require.NoError(t, json.Unmarshal(body, &resp))
				assert.Equal(t, jobID.String(), resp.JobID)
				assert.Equal(t, "json", resp.Format)
				assert.Equal(t, "summarizer", resp.Skill)
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pg := new(testutil.MockPostgresStore)
			tc.setupMocks(pg)

			registry := tc.registryFn(t)
			handler := NewReportHandler(pg, registry)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/"+tc.jobIDStr+"/report", bytes.NewBufferString(tc.body))
			if tc.tenantID != "" {
				ctx := middleware.WithTenantID(req.Context(), tc.tenantID)
				ctx = middleware.WithUserID(ctx, "test-user")
				req = req.WithContext(ctx)
			}
			req = mux.SetURLVars(req, map[string]string{"job_id": tc.jobIDStr})

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)
			if tc.checkBody != nil {
				tc.checkBody(t, w.Body.Bytes())
			}

			pg.AssertExpectations(t)
		})
	}
}
