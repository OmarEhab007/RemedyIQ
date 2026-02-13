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

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
)

// ---------------------------------------------------------------------------
// Mock skills for testing
// ---------------------------------------------------------------------------

// mockSkill implements ai.Skill and lets us control Execute outcomes.
type mockSkill struct {
	name        string
	description string
	examples    []string
	execFn      func(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error)
}

func (s *mockSkill) Name() string        { return s.name }
func (s *mockSkill) Description() string { return s.description }
func (s *mockSkill) Examples() []string  { return s.examples }
func (s *mockSkill) Execute(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
	if s.execFn != nil {
		return s.execFn(ctx, input)
	}
	return &ai.SkillOutput{
		Answer:    "mock answer: " + input.Query,
		SkillName: s.name,
	}, nil
}

// newMockSkill creates a simple mock skill with the given name.
func newMockSkill(name string) *mockSkill {
	return &mockSkill{
		name:        name,
		description: fmt.Sprintf("Mock %s skill", name),
		examples:    []string{fmt.Sprintf("example for %s", name)},
	}
}

// ---------------------------------------------------------------------------
// AIHandler tests
// ---------------------------------------------------------------------------

func TestAIHandler_MissingTenantContext(t *testing.T) {
	registry := ai.NewRegistry()
	h := NewAIHandler(registry)

	body := `{"query":"test","skill_name":"test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeUnauthorized, errResp.Code)
	assert.Contains(t, errResp.Message, "missing tenant context")
}

func TestAIHandler_MissingJobID(t *testing.T) {
	registry := ai.NewRegistry()
	h := NewAIHandler(registry)

	body := `{"query":"test","skill_name":"test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis//ai", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	// Intentionally do NOT set mux vars so job_id is empty.
	req = mux.SetURLVars(req, map[string]string{"job_id": ""})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "job_id")
}

func TestAIHandler_InvalidJSON(t *testing.T) {
	registry := ai.NewRegistry()
	h := NewAIHandler(registry)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString("{invalid"))
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "invalid JSON")
}

func TestAIHandler_EmptyQuery(t *testing.T) {
	registry := ai.NewRegistry()
	h := NewAIHandler(registry)

	body := `{"query":"","skill_name":"test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "query is required")
}

func TestAIHandler_DefaultSkillName(t *testing.T) {
	// When skill_name is omitted, the handler defaults to "nl_query".
	// Since "nl_query" is not registered, we expect a 400 "not found" error.
	registry := ai.NewRegistry()
	_ = registry.Register(newMockSkill("test"))
	h := NewAIHandler(registry)

	body := `{"query":"test question"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Contains(t, errResp.Message, "not found")
}

func TestAIHandler_DefaultSkillName_Registered(t *testing.T) {
	// When skill_name is omitted and "nl_query" IS registered, the handler
	// should succeed using that default.
	registry := ai.NewRegistry()
	_ = registry.Register(newMockSkill("nl_query"))
	h := NewAIHandler(registry)

	body := `{"query":"test question"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var output ai.SkillOutput
	require.NoError(t, json.NewDecoder(w.Body).Decode(&output))
	assert.Equal(t, "mock answer: test question", output.Answer)
	assert.Equal(t, "nl_query", output.SkillName)
}

func TestAIHandler_SkillNotFound(t *testing.T) {
	registry := ai.NewRegistry()
	h := NewAIHandler(registry)

	body := `{"query":"test","skill_name":"nonexistent"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "not found")
}

func TestAIHandler_SkillReturnsValidationError(t *testing.T) {
	// When the skill returns an error containing "is required", the handler
	// should map it to 400.
	skill := &mockSkill{
		name:        "validator",
		description: "Validates inputs",
		examples:    []string{"validate"},
		execFn: func(_ context.Context, _ ai.SkillInput) (*ai.SkillOutput, error) {
			return nil, fmt.Errorf("tenant_id is required")
		},
	}
	registry := ai.NewRegistry()
	_ = registry.Register(skill)
	h := NewAIHandler(registry)

	body := `{"query":"test","skill_name":"validator"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInvalidRequest, errResp.Code)
	assert.Contains(t, errResp.Message, "is required")
}

func TestAIHandler_SkillReturnsInternalError(t *testing.T) {
	// When the skill returns a generic error (not "not found" or "is required"),
	// the handler should map it to 500.
	skill := &mockSkill{
		name:        "failing",
		description: "Always fails",
		examples:    []string{"fail"},
		execFn: func(_ context.Context, _ ai.SkillInput) (*ai.SkillOutput, error) {
			return nil, errors.New("connection timeout to AI provider")
		},
	}
	registry := ai.NewRegistry()
	_ = registry.Register(skill)
	h := NewAIHandler(registry)

	body := `{"query":"test","skill_name":"failing"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Equal(t, api.ErrCodeInternalError, errResp.Code)
	assert.Contains(t, errResp.Message, "AI service is temporarily unavailable")
}

func TestAIHandler_SuccessfulQuery(t *testing.T) {
	skill := newMockSkill("test")
	registry := ai.NewRegistry()
	_ = registry.Register(skill)
	h := NewAIHandler(registry)

	body := `{"query":"what is the error rate?","skill_name":"test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var output ai.SkillOutput
	require.NoError(t, json.NewDecoder(w.Body).Decode(&output))
	assert.Equal(t, "mock answer: what is the error rate?", output.Answer)
	assert.Equal(t, "test", output.SkillName)
}

func TestAIHandler_SuccessWithReferences(t *testing.T) {
	// Verify the handler correctly passes through structured output.
	skill := &mockSkill{
		name:        "detailed",
		description: "Returns detailed output",
		examples:    []string{"detail"},
		execFn: func(_ context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
			return &ai.SkillOutput{
				Answer:    "Found 3 errors in the log",
				SkillName: "detailed",
				References: []ai.LogReference{
					{EntryID: "entry-1", LineNumber: 100, LogType: "API", Summary: "Timeout error"},
					{EntryID: "entry-2", LineNumber: 200, LogType: "SQL", Summary: "Connection reset"},
				},
				FollowUps:  []string{"Show me more details about the timeout errors"},
				Confidence: 0.95,
				TokensUsed: 150,
				LatencyMS:  200,
			}, nil
		},
	}
	registry := ai.NewRegistry()
	_ = registry.Register(skill)
	h := NewAIHandler(registry)

	body := `{"query":"analyze errors","skill_name":"detailed"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "test-tenant")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var output ai.SkillOutput
	require.NoError(t, json.NewDecoder(w.Body).Decode(&output))
	assert.Equal(t, "Found 3 errors in the log", output.Answer)
	assert.Len(t, output.References, 2)
	assert.Equal(t, "entry-1", output.References[0].EntryID)
	assert.Len(t, output.FollowUps, 1)
	assert.InDelta(t, 0.95, output.Confidence, 0.001)
	assert.Equal(t, 150, output.TokensUsed)
	assert.Equal(t, 200, output.LatencyMS)
}

func TestAIHandler_PassesCorrectInputToSkill(t *testing.T) {
	// Verify the handler constructs SkillInput with the right job_id and tenant_id.
	var capturedInput ai.SkillInput
	skill := &mockSkill{
		name:        "capture",
		description: "Captures input",
		examples:    []string{"capture"},
		execFn: func(_ context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
			capturedInput = input
			return &ai.SkillOutput{Answer: "ok", SkillName: "capture"}, nil
		},
	}
	registry := ai.NewRegistry()
	_ = registry.Register(skill)
	h := NewAIHandler(registry)

	body := `{"query":"show me slow queries","skill_name":"capture"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/my-job-42/ai", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), "tenant-abc")
	ctx = middleware.WithUserID(ctx, "test-user")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "my-job-42"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "show me slow queries", capturedInput.Query)
	assert.Equal(t, "my-job-42", capturedInput.JobID)
	assert.Equal(t, "tenant-abc", capturedInput.TenantID)
}

// ---------------------------------------------------------------------------
// ListSkillsHandler tests
// ---------------------------------------------------------------------------

func TestListSkillsHandler_EmptyRegistry(t *testing.T) {
	registry := ai.NewRegistry()
	h := NewListSkillsHandler(registry)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai/skills", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string][]ai.SkillInfo
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Len(t, resp["skills"], 0)
}

func TestListSkillsHandler_SingleSkill(t *testing.T) {
	registry := ai.NewRegistry()
	_ = registry.Register(newMockSkill("test"))
	h := NewListSkillsHandler(registry)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai/skills", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string][]ai.SkillInfo
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	require.Len(t, resp["skills"], 1)
	assert.Equal(t, "test", resp["skills"][0].Name)
	assert.Equal(t, "Mock test skill", resp["skills"][0].Description)
	assert.Equal(t, []string{"example for test"}, resp["skills"][0].Examples)
}

func TestListSkillsHandler_MultipleSkills(t *testing.T) {
	registry := ai.NewRegistry()
	_ = registry.Register(newMockSkill("nl_query"))
	_ = registry.Register(newMockSkill("summarizer"))
	_ = registry.Register(newMockSkill("anomaly"))
	h := NewListSkillsHandler(registry)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai/skills", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string][]ai.SkillInfo
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Len(t, resp["skills"], 3)

	// Collect registered skill names.
	names := make(map[string]bool)
	for _, s := range resp["skills"] {
		names[s.Name] = true
	}
	assert.True(t, names["nl_query"])
	assert.True(t, names["summarizer"])
	assert.True(t, names["anomaly"])
}

func TestListSkillsHandler_ReturnsJSONContentType(t *testing.T) {
	registry := ai.NewRegistry()
	h := NewListSkillsHandler(registry)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai/skills", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
}
