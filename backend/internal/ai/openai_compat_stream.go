package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// StreamOpenAICompatible streams chat completions from any OpenAI-compatible HTTP API
// (OpenAI, Ollama /v1, vLLM, LiteLLM, etc.) using the documented SSE chunk format.
func StreamOpenAICompatible(ctx context.Context, baseURL, apiKey, model, systemPrompt string, messages []Message) <-chan StreamChunk {
	ch := make(chan StreamChunk, 64)
	logger := slog.Default().With("component", "openai_compat")

	go func() {
		defer close(ch)

		base, err := NormalizeOpenAICompatibleBaseURL(baseURL)
		if err != nil {
			ch <- StreamChunk{Error: err}
			return
		}
		if model == "" {
			ch <- StreamChunk{Error: fmt.Errorf("model is required for OpenAI-compatible providers")}
			return
		}

		payload := map[string]any{
			"model":    model,
			"stream":   true,
			"messages": buildOpenAIChatMessages(systemPrompt, messages),
		}

		body, err := json.Marshal(payload)
		if err != nil {
			ch <- StreamChunk{Error: fmt.Errorf("marshal request: %w", err)}
			return
		}

		endpoint := base + "/chat/completions"
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
		if err != nil {
			ch <- StreamChunk{Error: fmt.Errorf("build request: %w", err)}
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "text/event-stream")
		if strings.TrimSpace(apiKey) != "" {
			req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(apiKey))
		}

		client := &http.Client{Timeout: 0}
		start := time.Now()
		resp, err := client.Do(req)
		if err != nil {
			ch <- StreamChunk{Error: fmt.Errorf("request failed: %w", err)}
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			b, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
			ch <- StreamChunk{Error: fmt.Errorf("upstream returned %s: %s", resp.Status, strings.TrimSpace(string(b)))}
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		// OpenAI streams can emit large JSON lines.
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

		var promptTokens, completionTokens int

		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" {
				continue
			}
			if !strings.HasPrefix(line, "data:") {
				continue
			}
			data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if data == "" || data == "[DONE]" {
				if data == "[DONE]" {
					break
				}
				continue
			}

			var chunk openAIChatCompletionChunk
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				logger.Debug("skip malformed sse chunk", "error", err)
				continue
			}
			if chunk.Usage != nil {
				promptTokens = chunk.Usage.PromptTokens
				completionTokens = chunk.Usage.CompletionTokens
			}
			if len(chunk.Choices) == 0 {
				continue
			}
			delta := chunk.Choices[0].Delta.Content
			if delta != "" {
				ch <- StreamChunk{Text: delta}
			}
		}
		if err := scanner.Err(); err != nil {
			ch <- StreamChunk{Error: fmt.Errorf("read stream: %w", err)}
			return
		}

		logger.Info("openai-compatible stream completed",
			"latency_ms", time.Since(start).Milliseconds(),
			"prompt_tokens", promptTokens,
			"completion_tokens", completionTokens,
		)

		ch <- StreamChunk{
			IsFinal:   true,
			TokensIn:  promptTokens,
			TokensOut: completionTokens,
		}
	}()

	return ch
}

type openAIChatCompletionChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
}

func buildOpenAIChatMessages(systemPrompt string, messages []Message) []map[string]string {
	out := make([]map[string]string, 0, len(messages)+1)
	if strings.TrimSpace(systemPrompt) != "" {
		out = append(out, map[string]string{
			"role":    "system",
			"content": systemPrompt,
		})
	}
	for _, m := range messages {
		content := strings.TrimSpace(m.Content)
		if content == "" {
			continue
		}
		role := strings.ToLower(strings.TrimSpace(m.Role))
		if role == "model" {
			role = "assistant"
		}
		if role != "user" && role != "assistant" && role != "system" {
			role = "user"
		}
		out = append(out, map[string]string{
			"role":    role,
			"content": content,
		})
	}
	return out
}
