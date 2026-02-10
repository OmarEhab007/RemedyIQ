package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	aiPkg "github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
)

type testSkill struct{}

func (s *testSkill) Name() string        { return "test" }
func (s *testSkill) Description() string { return "Test skill" }
func (s *testSkill) Examples() []string  { return []string{"test prompt"} }
func (s *testSkill) Execute(ctx context.Context, input aiPkg.SkillInput) (*aiPkg.SkillOutput, error) {
	return &aiPkg.SkillOutput{
		Answer:    "test response to: " + input.Query,
		SkillName: "test",
	}, nil
}

func TestAIHandler_MissingTenantContext(t *testing.T) {
	registry := aiPkg.NewRegistry()
	h := NewAIHandler(registry)

	body := `{"query":"test","skill_name":"test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAIHandler_EmptyQuery(t *testing.T) {
	registry := aiPkg.NewRegistry()
	h := NewAIHandler(registry)

	body := `{"query":"","skill_name":"test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "test-tenant")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAIHandler_InvalidJSON(t *testing.T) {
	registry := aiPkg.NewRegistry()
	h := NewAIHandler(registry)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString("{invalid"))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "test-tenant")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAIHandler_SkillNotFound(t *testing.T) {
	registry := aiPkg.NewRegistry()
	h := NewAIHandler(registry)

	body := `{"query":"test","skill_name":"nonexistent"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "test-tenant")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAIHandler_SuccessfulQuery(t *testing.T) {
	registry := aiPkg.NewRegistry()
	_ = registry.Register(&testSkill{})
	h := NewAIHandler(registry)

	body := `{"query":"test question","skill_name":"test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "test-tenant")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var output aiPkg.SkillOutput
	require.NoError(t, json.NewDecoder(w.Body).Decode(&output))
	assert.Equal(t, "test response to: test question", output.Answer)
	assert.Equal(t, "test", output.SkillName)
}

func TestAIHandler_DefaultSkill(t *testing.T) {
	registry := aiPkg.NewRegistry()
	_ = registry.Register(&testSkill{})
	h := NewAIHandler(registry)

	// Not providing skill_name, but since default is nl_query and we registered "test",
	// this should fail with skill not found for "nl_query"
	body := `{"query":"test question"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/job-1/ai", bytes.NewBufferString(body))
	ctx := context.WithValue(req.Context(), middleware.TenantIDKey, "test-tenant")
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": "job-1"})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	// Should fail because nl_query isn't registered
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestListSkillsHandler(t *testing.T) {
	registry := aiPkg.NewRegistry()
	_ = registry.Register(&testSkill{})
	h := NewListSkillsHandler(registry)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai/skills", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string][]aiPkg.SkillInfo
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Len(t, resp["skills"], 1)
	assert.Equal(t, "test", resp["skills"][0].Name)
}
