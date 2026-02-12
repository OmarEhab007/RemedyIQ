package ai

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewClient_EmptyAPIKey(t *testing.T) {
	_, err := NewClient("", "")
	assert.Error(t, err)
}

func TestNewClient_DefaultModel(t *testing.T) {
	c, err := NewClient("test-key", "")
	assert.NoError(t, err)
	assert.Equal(t, "claude-sonnet-4-20250514", c.model)
}

func TestNewClient_CustomModel(t *testing.T) {
	c, err := NewClient("test-key", "claude-opus-4-6")
	assert.NoError(t, err)
	assert.Equal(t, "claude-opus-4-6", c.model)
}

func TestClient_IsAvailable(t *testing.T) {
	c, _ := NewClient("test-key", "")
	assert.True(t, c.IsAvailable())

	var nilClient *Client
	assert.False(t, nilClient.IsAvailable())
}
