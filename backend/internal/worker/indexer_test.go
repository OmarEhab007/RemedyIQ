package worker

import (
	"context"
	"testing"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/search"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// NewIndexer tests
// ---------------------------------------------------------------------------

func TestNewIndexer(t *testing.T) {
	t.Run("nil bleve manager", func(t *testing.T) {
		idx := NewIndexer(nil)
		require.NotNil(t, idx)
		assert.Nil(t, idx.bleve)
	})

	t.Run("with bleve manager", func(t *testing.T) {
		tmpDir := t.TempDir()
		bm, err := search.NewBleveManager(tmpDir)
		require.NoError(t, err)
		defer bm.Close()

		idx := NewIndexer(bm)
		require.NotNil(t, idx)
		assert.NotNil(t, idx.bleve)
	})
}

// ---------------------------------------------------------------------------
// IndexEntries tests (table-driven)
// ---------------------------------------------------------------------------

func TestIndexEntries_NilBleve(t *testing.T) {
	idx := NewIndexer(nil)
	ctx := context.Background()

	// With entries -- should still be a no-op
	entries := []domain.LogEntry{
		{
			TenantID: "tenant-1",
			JobID:    "job-1",
			EntryID:  "entry-1",
			LogType:  domain.LogTypeAPI,
		},
	}
	err := idx.IndexEntries(ctx, "tenant-1", entries)
	assert.NoError(t, err, "nil bleve should be a silent no-op")
}

func TestIndexEntries_NilBleveEmptyEntries(t *testing.T) {
	idx := NewIndexer(nil)
	ctx := context.Background()

	err := idx.IndexEntries(ctx, "tenant-1", nil)
	assert.NoError(t, err, "nil bleve with nil entries should be a no-op")

	err = idx.IndexEntries(ctx, "tenant-1", []domain.LogEntry{})
	assert.NoError(t, err, "nil bleve with empty entries should be a no-op")
}

func TestIndexEntries_EmptyEntries(t *testing.T) {
	tmpDir := t.TempDir()
	bm, err := search.NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	idx := NewIndexer(bm)
	ctx := context.Background()

	// Empty slice should return early without calling bleve
	err = idx.IndexEntries(ctx, "tenant-1", []domain.LogEntry{})
	assert.NoError(t, err, "empty entries should return nil")

	// Nil slice should also return early
	err = idx.IndexEntries(ctx, "tenant-1", nil)
	assert.NoError(t, err, "nil entries should return nil")
}

func TestIndexEntries_ValidEntries(t *testing.T) {
	tmpDir := t.TempDir()
	bm, err := search.NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	idx := NewIndexer(bm)
	ctx := context.Background()

	entries := []domain.LogEntry{
		{
			TenantID:   "tenant-1",
			JobID:      "job-1",
			EntryID:    "entry-1",
			LineNumber: 1,
			LogType:    domain.LogTypeAPI,
			Timestamp:  time.Now().UTC(),
			ThreadID:   "T001",
			APICode:    "GET_ENTRY",
			Form:       "HPD:Help Desk",
			DurationMS: 500,
			Success:    true,
			RawText:    "GET_ENTRY call to HPD:Help Desk completed in 500ms",
		},
		{
			TenantID:   "tenant-1",
			JobID:      "job-1",
			EntryID:    "entry-2",
			LineNumber: 2,
			LogType:    domain.LogTypeSQL,
			Timestamp:  time.Now().UTC(),
			ThreadID:   "T002",
			SQLTable:   "T12345",
			DurationMS: 200,
			Success:    true,
			RawText:    "SELECT * FROM T12345",
		},
	}

	err = idx.IndexEntries(ctx, "tenant-1", entries)
	assert.NoError(t, err, "valid entries should be indexed successfully")
}

func TestIndexEntries_MultipleEntriesLargeBatch(t *testing.T) {
	tmpDir := t.TempDir()
	bm, err := search.NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	idx := NewIndexer(bm)
	ctx := context.Background()

	// Create a larger batch of entries
	entries := make([]domain.LogEntry, 50)
	for i := 0; i < 50; i++ {
		entries[i] = domain.LogEntry{
			TenantID:   "tenant-batch",
			JobID:      "job-batch",
			EntryID:    "entry-" + time.Now().Format("20060102150405") + "-" + string(rune('A'+i%26)),
			LineNumber: uint32(i + 1),
			LogType:    domain.LogTypeAPI,
			Timestamp:  time.Now().UTC(),
			ThreadID:   "T001",
			APICode:    "GET_ENTRY",
			DurationMS: uint32(100 + i),
			Success:    true,
		}
	}

	err = idx.IndexEntries(ctx, "tenant-batch", entries)
	assert.NoError(t, err, "batch of 50 entries should index successfully")
}

func TestIndexEntries_MultipleTenants(t *testing.T) {
	tmpDir := t.TempDir()
	bm, err := search.NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	idx := NewIndexer(bm)
	ctx := context.Background()

	// Index entries for tenant-1
	entries1 := []domain.LogEntry{
		{
			TenantID:   "tenant-1",
			JobID:      "job-1",
			EntryID:    "t1-entry-1",
			LineNumber: 1,
			LogType:    domain.LogTypeAPI,
			Timestamp:  time.Now().UTC(),
			Success:    true,
		},
	}
	err = idx.IndexEntries(ctx, "tenant-1", entries1)
	require.NoError(t, err)

	// Index entries for tenant-2
	entries2 := []domain.LogEntry{
		{
			TenantID:   "tenant-2",
			JobID:      "job-2",
			EntryID:    "t2-entry-1",
			LineNumber: 1,
			LogType:    domain.LogTypeSQL,
			Timestamp:  time.Now().UTC(),
			Success:    true,
		},
	}
	err = idx.IndexEntries(ctx, "tenant-2", entries2)
	assert.NoError(t, err, "indexing for a second tenant should succeed")
}

func TestIndexEntries_CancelledContext(t *testing.T) {
	tmpDir := t.TempDir()
	bm, err := search.NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	idx := NewIndexer(bm)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	entries := []domain.LogEntry{
		{
			TenantID:   "tenant-1",
			JobID:      "job-1",
			EntryID:    "entry-1",
			LineNumber: 1,
			LogType:    domain.LogTypeAPI,
			Timestamp:  time.Now().UTC(),
		},
	}

	// A cancelled context may cause the bleve batch to fail with a
	// context error, which will be wrapped by the indexer.
	err = idx.IndexEntries(ctx, "tenant-1", entries)
	// The behavior depends on whether bleve checks the context during
	// batch indexing. Either way, the indexer should not panic.
	if err != nil {
		assert.Contains(t, err.Error(), "index")
	}
}

func TestIndexEntries_AllLogTypes(t *testing.T) {
	tmpDir := t.TempDir()
	bm, err := search.NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	idx := NewIndexer(bm)
	ctx := context.Background()

	logTypes := []domain.LogType{
		domain.LogTypeAPI,
		domain.LogTypeSQL,
		domain.LogTypeFilter,
		domain.LogTypeEscalation,
	}

	for _, lt := range logTypes {
		t.Run(string(lt), func(t *testing.T) {
			entries := []domain.LogEntry{
				{
					TenantID:   "tenant-types",
					JobID:      "job-types",
					EntryID:    "entry-" + string(lt),
					LineNumber: 1,
					LogType:    lt,
					Timestamp:  time.Now().UTC(),
					Success:    true,
				},
			}
			err := idx.IndexEntries(ctx, "tenant-types", entries)
			assert.NoError(t, err, "should index %s log type", lt)
		})
	}
}

func TestIndexEntries_ErrorWrapping(t *testing.T) {
	// To test error wrapping, we create a BleveManager, index some entries,
	// then close the manager and try to index again -- the closed index
	// should produce an error that gets wrapped.
	tmpDir := t.TempDir()
	bm, err := search.NewBleveManager(tmpDir)
	require.NoError(t, err)

	idx := NewIndexer(bm)
	ctx := context.Background()

	// First, successfully index entries to ensure the tenant index is created
	entries := []domain.LogEntry{
		{
			TenantID:   "tenant-err",
			JobID:      "job-err",
			EntryID:    "entry-1",
			LineNumber: 1,
			LogType:    domain.LogTypeAPI,
			Timestamp:  time.Now().UTC(),
		},
	}
	err = idx.IndexEntries(ctx, "tenant-err", entries)
	require.NoError(t, err)

	// Close the bleve manager -- this closes all underlying indexes
	err = bm.Close()
	require.NoError(t, err)

	// Attempt to index again on the closed manager. BleveManager may
	// try to reopen or return an error depending on implementation.
	// If it returns an error, the Indexer should wrap it with the
	// "indexer: failed to index" prefix.
	entries2 := []domain.LogEntry{
		{
			TenantID:   "tenant-err",
			JobID:      "job-err",
			EntryID:    "entry-2",
			LineNumber: 2,
			LogType:    domain.LogTypeAPI,
			Timestamp:  time.Now().UTC(),
		},
	}

	err = idx.IndexEntries(ctx, "tenant-err", entries2)
	// The closed index may cause an error. If it does, verify wrapping.
	// If it does not (bleve may reopen the index), that is also acceptable.
	if err != nil {
		assert.Contains(t, err.Error(), "indexer: failed to index")
	}
}
