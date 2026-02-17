package domain

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestConversation_Fields(t *testing.T) {
	conv := Conversation{
		ID:           uuid.New(),
		TenantID:     uuid.New(),
		UserID:       "user_123",
		JobID:        uuid.New(),
		Title:        "Test Conversation",
		MessageCount: 5,
	}

	assert.NotEqual(t, uuid.Nil, conv.ID)
	assert.Equal(t, "user_123", conv.UserID)
	assert.Equal(t, "Test Conversation", conv.Title)
	assert.Equal(t, 5, conv.MessageCount)
}

func TestMessage_Fields(t *testing.T) {
	msg := Message{
		ID:             uuid.New(),
		ConversationID: uuid.New(),
		TenantID:       uuid.New(),
		Role:           MessageRoleUser,
		Content:        "What is the slowest API?",
		Status:         MessageStatusComplete,
		SkillName:      "performance",
		TokensUsed:     150,
		LatencyMS:      1200,
		FollowUps:      []string{"Show more details", "Why is it slow?"},
	}

	assert.NotEqual(t, uuid.Nil, msg.ID)
	assert.Equal(t, MessageRoleUser, msg.Role)
	assert.Equal(t, "What is the slowest API?", msg.Content)
	assert.Equal(t, MessageStatusComplete, msg.Status)
	assert.Equal(t, "performance", msg.SkillName)
	assert.Equal(t, 150, msg.TokensUsed)
	assert.Equal(t, 1200, msg.LatencyMS)
	assert.Len(t, msg.FollowUps, 2)
}

func TestMessageRole_Values(t *testing.T) {
	assert.Equal(t, MessageRole("user"), MessageRoleUser)
	assert.Equal(t, MessageRole("assistant"), MessageRoleAssistant)
}

func TestMessageStatus_Values(t *testing.T) {
	assert.Equal(t, MessageStatus("pending"), MessageStatusPending)
	assert.Equal(t, MessageStatus("streaming"), MessageStatusStreaming)
	assert.Equal(t, MessageStatus("complete"), MessageStatusComplete)
	assert.Equal(t, MessageStatus("error"), MessageStatusError)
}

func TestConversation_WithMessages(t *testing.T) {
	conv := Conversation{
		ID:       uuid.New(),
		TenantID: uuid.New(),
		UserID:   "user_456",
		JobID:    uuid.New(),
		Messages: []Message{
			{Role: MessageRoleUser, Content: "Hello"},
			{Role: MessageRoleAssistant, Content: "Hi there!"},
		},
	}

	assert.Len(t, conv.Messages, 2)
	assert.Equal(t, MessageRoleUser, conv.Messages[0].Role)
	assert.Equal(t, MessageRoleAssistant, conv.Messages[1].Role)
}

func TestConversation_Metadata(t *testing.T) {
	conv := Conversation{
		ID:       uuid.New(),
		TenantID: uuid.New(),
		UserID:   "user_789",
		JobID:    uuid.New(),
		Metadata: map[string]interface{}{
			"preferred_skill": "performance",
			"auto_route":      true,
		},
	}

	assert.Equal(t, "performance", conv.Metadata["preferred_skill"])
	assert.Equal(t, true, conv.Metadata["auto_route"])
}

func TestMessage_ErrorMessage(t *testing.T) {
	msg := Message{
		Role:         MessageRoleAssistant,
		Content:      "",
		Status:       MessageStatusError,
		ErrorMessage: "AI service unavailable",
	}

	assert.Equal(t, MessageStatusError, msg.Status)
	assert.Equal(t, "AI service unavailable", msg.ErrorMessage)
}
