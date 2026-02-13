package testutil

import (
	"fmt"
	"os"
	"path/filepath"
)

func LoadFixture(name string) ([]byte, error) {
	candidates := []string{
		filepath.Join("..", "..", "error_logs", name),
		filepath.Join("testdata", name),
		filepath.Join("..", "testdata", name),
		filepath.Join("..", "..", "ARLogAnalyzer", "error_logs", name),
	}

	var lastErr error
	for _, path := range candidates {
		data, err := os.ReadFile(path)
		if err == nil {
			return data, nil
		}
		lastErr = err
	}

	return nil, fmt.Errorf("fixture not found: %s (tried %v): %w", name, candidates, lastErr)
}

func MustLoadFixture(t interface{ Fatal(...interface{}) }, name string) []byte {
	data, err := LoadFixture(name)
	if err != nil {
		t.Fatal(err)
	}
	return data
}
