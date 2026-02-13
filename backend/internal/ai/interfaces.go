package ai

import (
	"context"
)

type AIQuerier interface {
	Query(ctx context.Context, systemPrompt string, messages []Message, maxTokens int) (*Response, error)
	IsAvailable() bool
}
