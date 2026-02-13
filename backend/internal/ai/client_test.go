package ai

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewClient(t *testing.T) {
	tests := []struct {
		name      string
		apiKey    string
		model     string
		wantModel string
		wantErr   bool
		errMsg    string
	}{
		{
			name:    "empty API key returns error",
			apiKey:  "",
			model:   "",
			wantErr: true,
			errMsg:  "ai: API key is required",
		},
		{
			name:    "empty API key with model returns error",
			apiKey:  "",
			model:   "claude-opus-4-6",
			wantErr: true,
			errMsg:  "ai: API key is required",
		},
		{
			name:      "valid key with empty model defaults to sonnet",
			apiKey:    "sk-test-key-12345",
			model:     "",
			wantModel: "claude-sonnet-4-20250514",
			wantErr:   false,
		},
		{
			name:      "valid key with custom model uses custom model",
			apiKey:    "sk-test-key-12345",
			model:     "claude-opus-4-6",
			wantModel: "claude-opus-4-6",
			wantErr:   false,
		},
		{
			name:      "valid key with arbitrary model string",
			apiKey:    "sk-test-key-12345",
			model:     "some-custom-model-v1",
			wantModel: "some-custom-model-v1",
			wantErr:   false,
		},
		{
			name:      "whitespace-only API key is accepted",
			apiKey:    "   ",
			model:     "",
			wantModel: "claude-sonnet-4-20250514",
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewClient(tt.apiKey, tt.model)

			if tt.wantErr {
				require.Error(t, err)
				assert.Nil(t, client)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				return
			}

			require.NoError(t, err)
			require.NotNil(t, client)
			assert.Equal(t, tt.wantModel, client.model)
			assert.NotNil(t, client.client, "underlying Anthropic client should be set")
			assert.NotNil(t, client.logger, "logger should be set")
		})
	}
}

func TestClient_IsAvailable(t *testing.T) {
	tests := []struct {
		name     string
		client   *Client
		expected bool
	}{
		{
			name:     "nil client returns false",
			client:   nil,
			expected: false,
		},
		{
			name:     "client with nil underlying returns false",
			client:   &Client{client: nil},
			expected: false,
		},
		{
			name: "valid client returns true",
			client: func() *Client {
				c, _ := NewClient("test-key", "")
				return c
			}(),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.client.IsAvailable()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMessage_Fields(t *testing.T) {
	msg := Message{
		Role:    "user",
		Content: "hello world",
	}
	assert.Equal(t, "user", msg.Role)
	assert.Equal(t, "hello world", msg.Content)
}

func TestResponse_Fields(t *testing.T) {
	resp := Response{
		Content:    "test response content",
		TokensUsed: 150,
		LatencyMS:  42,
		StopReason: "end_turn",
	}
	assert.Equal(t, "test response content", resp.Content)
	assert.Equal(t, 150, resp.TokensUsed)
	assert.Equal(t, 42, resp.LatencyMS)
	assert.Equal(t, "end_turn", resp.StopReason)
}

func TestResponse_ZeroValues(t *testing.T) {
	resp := Response{}
	assert.Empty(t, resp.Content)
	assert.Zero(t, resp.TokensUsed)
	assert.Zero(t, resp.LatencyMS)
	assert.Empty(t, resp.StopReason)
}

func TestNewClient_ClientFieldsPopulated(t *testing.T) {
	c, err := NewClient("test-api-key", "test-model")
	require.NoError(t, err)

	// Verify all internal fields are initialized.
	assert.NotNil(t, c.client, "anthropic client should be initialized")
	assert.NotNil(t, c.logger, "logger should be initialized")
	assert.Equal(t, "test-model", c.model)
}

func TestClient_Query_DefaultMaxTokens(t *testing.T) {
	// Create a client with a fake key. The API call will fail because the key
	// is invalid, but we exercise the message-building and default-maxTokens
	// logic before the HTTP request is dispatched.
	c, err := NewClient("sk-ant-test-invalid-key-for-unit-test", "test-model")
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately so the HTTP call fails fast

	messages := []Message{
		{Role: "user", Content: "hello"},
	}

	resp, err := c.Query(ctx, "system prompt", messages, 0)
	assert.Error(t, err, "should fail because context is cancelled or key is invalid")
	assert.Nil(t, resp)
	assert.Contains(t, err.Error(), "ai: query failed")
}

func TestClient_Query_WithMessages(t *testing.T) {
	c, err := NewClient("sk-ant-test-invalid-key-for-unit-test", "test-model")
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	messages := []Message{
		{Role: "user", Content: "first message"},
		{Role: "assistant", Content: "response"},
		{Role: "user", Content: "follow up"},
		{Role: "unknown", Content: "should be ignored"},
	}

	resp, err := c.Query(ctx, "you are helpful", messages, 2048)
	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Contains(t, err.Error(), "ai: query failed")
}

func TestClient_Query_EmptyMessages(t *testing.T) {
	c, err := NewClient("sk-ant-test-invalid-key-for-unit-test", "test-model")
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	resp, err := c.Query(ctx, "system", []Message{}, 1024)
	assert.Error(t, err)
	assert.Nil(t, resp)
}

func TestClient_Query_NegativeMaxTokens(t *testing.T) {
	c, err := NewClient("sk-ant-test-invalid-key-for-unit-test", "test-model")
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	resp, err := c.Query(ctx, "system", []Message{{Role: "user", Content: "hi"}}, -1)
	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Contains(t, err.Error(), "ai: query failed")
}
