package ai

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestStreamOpenAICompatible_MockServer(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/chat/completions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method", http.StatusMethodNotAllowed)
			return
		}
		fl, ok := w.(http.Flusher)
		require.True(t, ok)
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":\"Hi\"}}]}\n\n")
		fl.Flush()
		_, _ = fmt.Fprintf(w, "data: [DONE]\n\n")
		fl.Flush()
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	base := srv.URL
	ch := StreamOpenAICompatible(ctx, base, "", "test-model", "sys", []Message{{Role: "user", Content: "yo"}})

	var got string
	for chunk := range ch {
		if chunk.Error != nil {
			t.Fatalf("unexpected error: %v", chunk.Error)
		}
		got += chunk.Text
	}

	require.Equal(t, "Hi", got)
}
