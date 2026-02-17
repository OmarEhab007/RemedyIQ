package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
)

type mockGeminiClient struct {
	chunks []ai.StreamChunk
}

func (m *mockGeminiClient) StreamQuery(ctx context.Context, systemPrompt string, messages []ai.Message, maxTokens int) <-chan ai.StreamChunk {
	ch := make(chan ai.StreamChunk, len(m.chunks)+1)
	go func() {
		defer close(ch)
		for _, chunk := range m.chunks {
			ch <- chunk
		}
		ch <- ai.StreamChunk{IsFinal: true, TokensIn: 100, TokensOut: 50}
	}()
	return ch
}

func (m *mockGeminiClient) IsAvailable() bool {
	return true
}

func TestAIStreamHandler_MissingTenantContext(t *testing.T) {
	registry := ai.NewRegistry()
	router := ai.NewRouter()
	h := NewAIStreamHandler(nil, registry, router, nil, nil, nil)

	body := `{"query":"test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/ai/stream", bytes.NewBufferString(body))
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAIStreamHandler_MissingJobID(t *testing.T) {
	registry := ai.NewRegistry()
	router := ai.NewRouter()
	h := NewAIStreamHandler(nil, registry, router, nil, nil, nil)

	body := `{"query":"test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/ai/stream", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), uuid.New().String())
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": ""})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAIStreamHandler_MissingQuery(t *testing.T) {
	registry := ai.NewRegistry()
	router := ai.NewRouter()
	h := NewAIStreamHandler(nil, registry, router, nil, nil, nil)

	body := `{}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/ai/stream", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), uuid.New().String())
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": uuid.New().String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAIStreamHandler_QueryTooLong(t *testing.T) {
	registry := ai.NewRegistry()
	router := ai.NewRouter()
	h := NewAIStreamHandler(nil, registry, router, nil, nil, nil)

	longQuery := strings.Repeat("a", 2001)
	body := `{"query":"` + longQuery + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/ai/stream", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), uuid.New().String())
	req = req.WithContext(ctx)
	req = mux.SetURLVars(req, map[string]string{"job_id": uuid.New().String()})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAIStreamHandler_SSEEventFormat(t *testing.T) {
	assert := assert.New(t)

	event := ai.SSEStartData{
		ConversationID: "conv-123",
		MessageID:      "msg-456",
	}

	dataJSON, err := json.Marshal(event)
	require.NoError(t, err)

	sseLine := "event: start\ndata: " + string(dataJSON) + "\n\n"

	assert.Contains(sseLine, "event: start")
	assert.Contains(sseLine, `"conversation_id":"conv-123"`)
	assert.Contains(sseLine, `"message_id":"msg-456"`)
}

func TestAIStreamHandler_SSETokenEventFormat(t *testing.T) {
	assert := assert.New(t)

	event := ai.SSETokenData{Text: "Hello"}

	dataJSON, err := json.Marshal(event)
	require.NoError(t, err)

	sseLine := "event: token\ndata: " + string(dataJSON) + "\n\n"

	assert.Contains(sseLine, "event: token")
	assert.Contains(sseLine, `"text":"Hello"`)
}

func TestAIStreamHandler_BuildSystemPrompt_UsesSummaryContext(t *testing.T) {
	registry := ai.NewRegistry()
	router := ai.NewRouter()
	h := NewAIStreamHandler(nil, registry, router, nil, nil, nil)

	prompt := h.buildSystemPrompt("nl_query", "## Log Analysis Summary")

	assert.Contains(t, prompt, "Use the provided log summary as your primary data source.")
	assert.Contains(t, prompt, "Do not ask the user to upload raw logs")
	assert.Contains(t, prompt, "## Log Analysis Summary")
}

func TestRouter_Integration(t *testing.T) {
	router := ai.NewRouter()

	tests := []struct {
		query     string
		wantSkill string
	}{
		{"Why is the system slow?", "performance"},
		{"What is the root cause?", "root_cause"},
		{"Explain this error", "error_explainer"},
		{"Summarize the logs", "summarizer"},
		{"Any anomalies?", "anomaly_narrator"},
		{"what is the longest running esc", "performance"},
		{"What happened?", "nl_query"},
	}

	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			got := router.Route(tt.query)
			assert.Equal(t, tt.wantSkill, got)
		})
	}
}
