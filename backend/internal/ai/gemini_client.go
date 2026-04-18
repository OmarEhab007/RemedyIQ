package ai

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/genai"
)

type GeminiClient struct {
	client  *genai.Client
	model   string
	logger  *slog.Logger
	enabled bool
}

func NewGeminiClient(apiKey string, model string) (*GeminiClient, error) {
	if apiKey == "" {
		slog.Warn("Gemini API key not configured, streaming will use fallback")
		return &GeminiClient{enabled: false, logger: slog.Default().With("component", "gemini")}, nil
	}

	if model == "" {
		model = "gemini-2.5-flash"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, fmt.Errorf("gemini: failed to create client: %w", err)
	}

	return &GeminiClient{
		client:  client,
		model:   model,
		enabled: true,
		logger:  slog.Default().With("component", "gemini"),
	}, nil
}

type StreamChunk struct {
	Text      string
	IsFinal   bool
	Error     error
	TokensIn  int
	TokensOut int
}

func (c *GeminiClient) StreamQuery(ctx context.Context, systemPrompt string, messages []Message, maxTokens int) <-chan StreamChunk {
	return c.StreamQueryWithOverrides(ctx, "", "", systemPrompt, messages, maxTokens)
}

// StreamQueryWithOverrides streams from Gemini using the configured client by default.
// If apiKeyOverride is non-empty, a short-lived client is created for that key (BYOK).
// If modelOverride is non-empty, it is used as the model name for this request.
func (c *GeminiClient) StreamQueryWithOverrides(ctx context.Context, apiKeyOverride, modelOverride string, systemPrompt string, messages []Message, maxTokens int) <-chan StreamChunk {
	ch := make(chan StreamChunk, 64)

	go func() {
		defer close(ch)

		if maxTokens <= 0 {
			maxTokens = 4096
		}

		client := c.client
		model := c.model
		logger := c.logger
		enabled := c.enabled && c.client != nil

		if strings.TrimSpace(apiKeyOverride) != "" {
			modelName := strings.TrimSpace(modelOverride)
			if modelName == "" {
				modelName = "gemini-2.5-flash"
			}
			tmpCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			tmpClient, err := genai.NewClient(tmpCtx, &genai.ClientConfig{
				APIKey:  strings.TrimSpace(apiKeyOverride),
				Backend: genai.BackendGeminiAPI,
			})
			cancel()
			if err != nil {
				c.logger.Error("gemini byok client init failed", "error", err)
				ch <- StreamChunk{Error: fmt.Errorf("gemini client init: %w", err)}
				return
			}
			client = tmpClient
			model = modelName
			logger = c.logger.With("byok", true)
			enabled = client != nil
		} else {
			if strings.TrimSpace(modelOverride) != "" {
				model = strings.TrimSpace(modelOverride)
			}
		}

		if !enabled || client == nil {
			ch <- StreamChunk{
				Text:    "AI streaming is not configured. Please set GOOGLE_API_KEY or provide a Gemini API key in AI settings.",
				IsFinal: true,
			}
			return
		}

		contents := buildGeminiContents(messages)
		config := &genai.GenerateContentConfig{
			SystemInstruction: &genai.Content{
				Parts: []*genai.Part{{Text: systemPrompt}},
			},
			MaxOutputTokens: int32(maxTokens),
		}

		var fullText strings.Builder
		var finalResp *genai.GenerateContentResponse
		start := time.Now()

		for resp, err := range client.Models.GenerateContentStream(
			ctx,
			model,
			contents,
			config,
		) {
			if err != nil {
				logger.Error("stream error", "error", err)
				ch <- StreamChunk{Error: fmt.Errorf("stream error: %w", err)}
				return
			}

			if len(resp.Candidates) > 0 && resp.Candidates[0] != nil && resp.Candidates[0].Content != nil && len(resp.Candidates[0].Content.Parts) > 0 {
				text := resp.Candidates[0].Content.Parts[0].Text
				if text != "" {
					fullText.WriteString(text)
					ch <- StreamChunk{Text: text}
				}
			}

			finalResp = resp
		}

		tokensIn := 0
		tokensOut := 0
		if finalResp != nil && finalResp.UsageMetadata != nil {
			tokensIn = int(finalResp.UsageMetadata.PromptTokenCount)
			tokensOut = int(finalResp.UsageMetadata.CandidatesTokenCount)
		}

		logger.Info("stream completed",
			"latency_ms", time.Since(start).Milliseconds(),
			"tokens_in", tokensIn,
			"tokens_out", tokensOut,
			"total_chars", fullText.Len(),
		)

		ch <- StreamChunk{
			IsFinal:   true,
			TokensIn:  tokensIn,
			TokensOut: tokensOut,
		}
	}()

	return ch
}

func buildGeminiContents(messages []Message) []*genai.Content {
	contents := make([]*genai.Content, 0, len(messages))
	for _, msg := range messages {
		role := "user"
		if msg.Role == "assistant" {
			role = "model"
		}
		contents = append(contents, &genai.Content{
			Role:  role,
			Parts: []*genai.Part{{Text: msg.Content}},
		})
	}
	return contents
}

func (c *GeminiClient) IsAvailable() bool {
	return c != nil && c.enabled && c.client != nil
}

func (c *GeminiClient) Close() {
}

type StreamRequest struct {
	Query          string     `json:"query"`
	JobID          string     `json:"job_id"`
	ConversationID *uuid.UUID `json:"conversation_id,omitempty"`
	SkillName      string     `json:"skill_name,omitempty"`
	// Skill is a legacy/frontend alias for SkillName.
	Skill     string `json:"skill,omitempty"`
	AutoRoute bool   `json:"auto_route"`

	// Provider selects the LLM backend: gemini (default), openai, ollama.
	Provider string `json:"provider,omitempty"`
	// ApiKey optional BYOK value (never logged).
	ApiKey string `json:"api_key,omitempty"`
	// OpenAIBaseURL optional override for OpenAI-compatible servers (e.g. Ollama http://127.0.0.1:11434/v1).
	OpenAIBaseURL string `json:"openai_base_url,omitempty"`
	// Model optional per-request model id (e.g. gpt-4o-mini, llama3.2, gemini-2.5-flash).
	Model string `json:"model,omitempty"`
}

type SSEEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type SSEStartData struct {
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
}

type SSETokenData struct {
	Text string `json:"text"`
}

type SSESkillData struct {
	SkillName string `json:"skill_name"`
}

type SSEMetadataData struct {
	TokensUsed int    `json:"tokens_used"`
	LatencyMS  int    `json:"latency_ms"`
	SkillName  string `json:"skill_name"`
}

type SSEDoneData struct {
	FollowUps []string `json:"follow_ups"`
}

type SSEErrorData struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}
