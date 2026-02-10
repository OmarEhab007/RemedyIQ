package worker

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/search"
)

// Indexer handles indexing of log entries into Bleve for full-text search.
type Indexer struct {
	bleve *search.BleveManager
}

// NewIndexer creates a new Indexer with the given BleveManager.
func NewIndexer(bleve *search.BleveManager) *Indexer {
	return &Indexer{bleve: bleve}
}

// IndexEntries indexes a batch of log entries for a tenant. If the
// BleveManager is nil, the call is a no-op so that the rest of the
// pipeline can run without search being configured.
func (idx *Indexer) IndexEntries(ctx context.Context, tenantID string, entries []domain.LogEntry) error {
	if idx.bleve == nil {
		slog.Warn("bleve indexer not configured, skipping indexing")
		return nil
	}

	if len(entries) == 0 {
		return nil
	}

	if err := idx.bleve.IndexEntries(ctx, tenantID, entries); err != nil {
		return fmt.Errorf("indexer: failed to index %d entries: %w", len(entries), err)
	}

	slog.Info("indexed entries",
		"tenant_id", tenantID,
		"count", len(entries),
	)
	return nil
}
