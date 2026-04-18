package handlers

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSanitizeUploadBasename(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"report.log", "report.log"},
		{"/etc/passwd", "passwd"},
		{"..\\..\\windows\\file.txt", "file.txt"},
		{"", "upload.bin"},
		{"   ", "upload.bin"},
		{".", "upload.bin"},
		{"a" + strings.Repeat("b", 300), "a" + strings.Repeat("b", 199)},
	}
	for _, tc := range tests {
		t.Run(tc.in, func(t *testing.T) {
			got := sanitizeUploadBasename(tc.in)
			assert.Equal(t, tc.want, got)
			assert.False(t, strings.Contains(got, ".."))
		})
	}
}
