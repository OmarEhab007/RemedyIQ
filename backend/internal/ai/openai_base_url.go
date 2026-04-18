package ai

import (
	"fmt"
	"net/url"
	"strings"
)

const maxOpenAICompatibleBaseURLLen = 512

// ValidateOpenAICompatibleBaseURL rejects obviously unsafe hosts used in SSRF
// attacks while allowing typical LAN / localhost Ollama installs.
func ValidateOpenAICompatibleBaseURL(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fmt.Errorf("base url is required")
	}
	if len(raw) > maxOpenAICompatibleBaseURLLen {
		return fmt.Errorf("base url is too long")
	}
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("invalid base url: %w", err)
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https":
	default:
		return fmt.Errorf("base url scheme must be http or https")
	}
	host := strings.ToLower(strings.TrimSpace(u.Hostname()))
	if host == "" {
		return fmt.Errorf("base url must include a host")
	}
	if host == "169.254.169.254" || strings.HasPrefix(host, "169.254.") {
		return fmt.Errorf("link-local metadata hosts are not allowed")
	}
	if host == "metadata.google.internal" {
		return fmt.Errorf("host is not allowed")
	}
	return nil
}

// NormalizeOpenAICompatibleBaseURL trims trailing slashes so callers can append "/chat/completions".
func NormalizeOpenAICompatibleBaseURL(raw string) (string, error) {
	if err := ValidateOpenAICompatibleBaseURL(raw); err != nil {
		return "", err
	}
	return strings.TrimRight(strings.TrimSpace(raw), "/"), nil
}
