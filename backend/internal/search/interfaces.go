package search

import (
	"context"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/blevesearch/bleve/v2"
)

type SearchIndexer interface {
	Index(ctx context.Context, tenantID string, entries []domain.LogEntry) error
	Search(ctx context.Context, tenantID string, req *bleve.SearchRequest) (*bleve.SearchResult, error)
	Delete(tenantID string) error
	Close() error
}
