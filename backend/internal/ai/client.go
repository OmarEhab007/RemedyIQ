package ai

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// Client wraps the Anthropic SDK for Claude API interactions.
type Client struct {
	client *anthropic.Client
	model  string
	logger *slog.Logger
}

// NewClient creates a new AI client.
func NewClient(apiKey string, model string) (*Client, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("ai: API key is required")
	}
	if model == "" {
		model = "claude-sonnet-4-5-20250929"
	}

	client := anthropic.NewClient(
		option.WithAPIKey(apiKey),
	)

	return &Client{
		client: &client,
		model:  model,
		logger: slog.Default().With("component", "ai"),
	}, nil
}

// Message represents a conversation message.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Response represents an AI response.
type Response struct {
	Content    string `json:"content"`
	TokensUsed int    `json:"tokens_used"`
	LatencyMS  int    `json:"latency_ms"`
	StopReason string `json:"stop_reason"`
}

// Query sends a query to the Claude API with the given system prompt and messages.
func (c *Client) Query(ctx context.Context, systemPrompt string, messages []Message, maxTokens int) (*Response, error) {
	if maxTokens <= 0 {
		maxTokens = 4096
	}

	start := time.Now()

	apiMessages := make([]anthropic.MessageParam, 0, len(messages))
	for _, msg := range messages {
		switch msg.Role {
		case "user":
			apiMessages = append(apiMessages, anthropic.NewUserMessage(
				anthropic.NewTextBlock(msg.Content),
			))
		case "assistant":
			apiMessages = append(apiMessages, anthropic.NewAssistantMessage(
				anthropic.NewTextBlock(msg.Content),
			))
		default:
			slog.Warn("unknown message role ignored", "role", msg.Role)
		}
	}

	resp, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.Model(c.model),
		MaxTokens: int64(maxTokens),
		System: []anthropic.TextBlockParam{
			{Text: systemPrompt},
		},
		Messages: apiMessages,
	})
	if err != nil {
		return nil, fmt.Errorf("ai: query failed: %w", err)
	}

	latency := time.Since(start)

	var content string
	for _, block := range resp.Content {
		if block.Type == "text" {
			content += block.Text
		}
	}

	inputTokens := int(resp.Usage.InputTokens)
	outputTokens := int(resp.Usage.OutputTokens)

	c.logger.Info("ai query completed",
		"latency_ms", latency.Milliseconds(),
		"input_tokens", inputTokens,
		"output_tokens", outputTokens,
	)

	return &Response{
		Content:    content,
		TokensUsed: inputTokens + outputTokens,
		LatencyMS:  int(latency.Milliseconds()),
		StopReason: string(resp.StopReason),
	}, nil
}

// IsAvailable checks if the AI client is configured and can be used.
func (c *Client) IsAvailable() bool {
	return c != nil && c.client != nil
}
