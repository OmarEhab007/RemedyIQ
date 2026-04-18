package ai

// ServerLLMDefaults holds optional server-side credentials for OpenAI-compatible APIs.
// User-supplied keys in StreamRequest still override these defaults when present.
type ServerLLMDefaults struct {
	OpenAIAPIKey  string
	OpenAIBaseURL string
	OllamaBaseURL string
}
