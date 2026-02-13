package search

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

// BleveManager manages tenant-scoped Bleve indexes.
type BleveManager struct {
	basePath string
	indexes  map[string]bleve.Index
	mu       sync.RWMutex
}

// NewBleveManager creates a new BleveManager with the given base directory for indexes.
func NewBleveManager(basePath string) (*BleveManager, error) {
	if err := os.MkdirAll(basePath, 0o755); err != nil {
		return nil, fmt.Errorf("bleve: create base path: %w", err)
	}
	return &BleveManager{
		basePath: basePath,
		indexes:  make(map[string]bleve.Index),
	}, nil
}

// GetOrCreateIndex returns the index for the given tenant, creating it if needed.
func (bm *BleveManager) GetOrCreateIndex(tenantID string) (bleve.Index, error) {
	// Check read lock first
	bm.mu.RLock()
	if idx, ok := bm.indexes[tenantID]; ok {
		bm.mu.RUnlock()
		return idx, nil
	}
	bm.mu.RUnlock()

	// Upgrade to write lock
	bm.mu.Lock()
	defer bm.mu.Unlock()

	// Double check after acquiring write lock
	if idx, ok := bm.indexes[tenantID]; ok {
		return idx, nil
	}

	// Try to open existing index, or create a new one
	indexPath := filepath.Join(bm.basePath, tenantID)
	idx, err := bleve.Open(indexPath)
	if err != nil {
		// Index does not exist -- create with mapping
		m := buildIndexMapping()
		idx, err = bleve.New(indexPath, m)
		if err != nil {
			return nil, fmt.Errorf("bleve: create index for tenant %s: %w", tenantID, err)
		}
	}

	bm.indexes[tenantID] = idx
	return idx, nil
}

// buildIndexMapping creates the document mapping for log entries.
func buildIndexMapping() mapping.IndexMapping {
	// Create field mappings
	textField := bleve.NewTextFieldMapping()
	textField.Analyzer = "standard"

	keywordField := bleve.NewKeywordFieldMapping()

	numericField := bleve.NewNumericFieldMapping()

	dateField := bleve.NewDateTimeFieldMapping()

	boolField := bleve.NewBooleanFieldMapping()

	// Build document mapping
	logMapping := bleve.NewDocumentMapping()
	logMapping.AddFieldMappingsAt("job_id", keywordField)
	logMapping.AddFieldMappingsAt("log_type", keywordField)
	logMapping.AddFieldMappingsAt("trace_id", keywordField)
	logMapping.AddFieldMappingsAt("rpc_id", keywordField)
	logMapping.AddFieldMappingsAt("thread_id", keywordField)
	logMapping.AddFieldMappingsAt("queue", keywordField)
	logMapping.AddFieldMappingsAt("user", keywordField)
	logMapping.AddFieldMappingsAt("form", textField)
	logMapping.AddFieldMappingsAt("api_code", keywordField)
	logMapping.AddFieldMappingsAt("sql_table", keywordField)
	logMapping.AddFieldMappingsAt("filter_name", textField)
	logMapping.AddFieldMappingsAt("esc_name", textField)
	logMapping.AddFieldMappingsAt("operation", keywordField)
	logMapping.AddFieldMappingsAt("error_message", textField)
	logMapping.AddFieldMappingsAt("raw_text", textField)
	logMapping.AddFieldMappingsAt("duration_ms", numericField)
	logMapping.AddFieldMappingsAt("queue_time_ms", numericField)
	logMapping.AddFieldMappingsAt("timestamp", dateField)
	logMapping.AddFieldMappingsAt("success", boolField)
	logMapping.AddFieldMappingsAt("line_number", numericField)

	indexMapping := bleve.NewIndexMapping()
	indexMapping.DefaultMapping = logMapping
	return indexMapping
}

// IndexEntries batch-indexes a slice of log entries.
func (bm *BleveManager) IndexEntries(ctx context.Context, tenantID string, entries []domain.LogEntry) error {
	idx, err := bm.GetOrCreateIndex(tenantID)
	if err != nil {
		return err
	}

	batch := idx.NewBatch()
	for _, entry := range entries {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		doc := entryToDoc(entry)
		batch.Index(entry.EntryID, doc)
	}

	return idx.Batch(batch)
}

// Index is an alias for IndexEntries to satisfy the SearchIndexer interface.
func (bm *BleveManager) Index(ctx context.Context, tenantID string, entries []domain.LogEntry) error {
	return bm.IndexEntries(ctx, tenantID, entries)
}

// entryToDoc converts a LogEntry to a map suitable for Bleve indexing.
func entryToDoc(e domain.LogEntry) map[string]interface{} {
	return map[string]interface{}{
		"job_id":        e.JobID,
		"log_type":      string(e.LogType),
		"trace_id":      e.TraceID,
		"rpc_id":        e.RPCID,
		"thread_id":     e.ThreadID,
		"queue":         e.Queue,
		"user":          e.User,
		"form":          e.Form,
		"api_code":      e.APICode,
		"sql_table":     e.SQLTable,
		"sql_statement": e.SQLStatement,
		"filter_name":   e.FilterName,
		"esc_name":      e.EscName,
		"operation":     e.Operation,
		"error_message": e.ErrorMessage,
		"raw_text":      e.RawText,
		"duration_ms":   float64(e.DurationMS),
		"queue_time_ms": float64(e.QueueTimeMS),
		"timestamp":     e.Timestamp,
		"success":       e.Success,
		"line_number":   float64(e.LineNumber),
	}
}

// Search executes a search query against the tenant's index.
func (bm *BleveManager) Search(ctx context.Context, tenantID string, req *bleve.SearchRequest) (*bleve.SearchResult, error) {
	idx, err := bm.GetOrCreateIndex(tenantID)
	if err != nil {
		return nil, err
	}
	return idx.Search(req)
}

// DeleteIndex removes the tenant's index from memory and disk.
func (bm *BleveManager) DeleteIndex(tenantID string) error {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	if idx, ok := bm.indexes[tenantID]; ok {
		if err := idx.Close(); err != nil {
			return fmt.Errorf("bleve: close index for tenant %s: %w", tenantID, err)
		}
		delete(bm.indexes, tenantID)
	}

	indexPath := filepath.Join(bm.basePath, tenantID)
	return os.RemoveAll(indexPath)
}

// Delete is an alias for DeleteIndex to satisfy the SearchIndexer interface.
func (bm *BleveManager) Delete(tenantID string) error {
	return bm.DeleteIndex(tenantID)
}

// Close closes all open indexes.
func (bm *BleveManager) Close() error {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	var firstErr error
	for tenantID, idx := range bm.indexes {
		if err := idx.Close(); err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("bleve: close index for tenant %s: %w", tenantID, err)
			}
		}
		delete(bm.indexes, tenantID)
	}
	return firstErr
}
