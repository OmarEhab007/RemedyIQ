package ai

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateOpenAICompatibleBaseURL(t *testing.T) {
	t.Parallel()

	require.NoError(t, ValidateOpenAICompatibleBaseURL("http://127.0.0.1:11434/v1"))
	require.NoError(t, ValidateOpenAICompatibleBaseURL("https://api.openai.com/v1"))

	require.Error(t, ValidateOpenAICompatibleBaseURL(""))
	require.Error(t, ValidateOpenAICompatibleBaseURL("http://169.254.169.254/latest/meta-data"))
	require.Error(t, ValidateOpenAICompatibleBaseURL("https://metadata.google.internal/"))
	require.Error(t, ValidateOpenAICompatibleBaseURL("ftp://example.com/v1"))
}
