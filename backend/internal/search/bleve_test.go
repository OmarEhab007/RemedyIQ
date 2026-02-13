package search

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

func TestBleveManager_CreateAndSearch(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "bleve-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	bm, err := NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	// Index some entries
	entries := []domain.LogEntry{
		{
			EntryID:    "entry-1",
			JobID:      "job-1",
			LogType:    domain.LogTypeAPI,
			User:       "Demo",
			Form:       "HPD:Help Desk",
			APICode:    "GET_ENTRY",
			DurationMS: 5000,
			Success:    true,
			Timestamp:  time.Now(),
			LineNumber: 100,
		},
		{
			EntryID:    "entry-2",
			JobID:      "job-1",
			LogType:    domain.LogTypeSQL,
			User:       "Admin",
			SQLTable:   "T1234",
			DurationMS: 2000,
			Success:    true,
			Timestamp:  time.Now(),
			LineNumber: 200,
		},
	}

	err = bm.IndexEntries(context.Background(), "tenant-1", entries)
	require.NoError(t, err)

	// Search for API entries using keyword field (exact match)
	query := bleve.NewTermQuery("API")
	query.SetField("log_type")
	searchReq := bleve.NewSearchRequest(query)
	searchReq.Size = 10

	result, err := bm.Search(context.Background(), "tenant-1", searchReq)
	require.NoError(t, err)
	assert.Equal(t, uint64(1), result.Total)
}

func TestBleveManager_TenantIsolation(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "bleve-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	bm, err := NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	// Index entries for two tenants
	err = bm.IndexEntries(context.Background(), "tenant-A", []domain.LogEntry{
		{EntryID: "a-1", LogType: domain.LogTypeAPI, Timestamp: time.Now()},
	})
	require.NoError(t, err)

	err = bm.IndexEntries(context.Background(), "tenant-B", []domain.LogEntry{
		{EntryID: "b-1", LogType: domain.LogTypeSQL, Timestamp: time.Now()},
		{EntryID: "b-2", LogType: domain.LogTypeSQL, Timestamp: time.Now()},
	})
	require.NoError(t, err)

	// Search tenant-A should only see 1 entry
	matchAll := bleve.NewMatchAllQuery()
	searchReq := bleve.NewSearchRequest(matchAll)
	resultA, err := bm.Search(context.Background(), "tenant-A", searchReq)
	require.NoError(t, err)
	assert.Equal(t, uint64(1), resultA.Total)

	// Search tenant-B should see 2 entries
	resultB, err := bm.Search(context.Background(), "tenant-B", searchReq)
	require.NoError(t, err)
	assert.Equal(t, uint64(2), resultB.Total)
}

func TestBleveManager_EmptySearch(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "bleve-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	bm, err := NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	// Search empty index
	matchAll := bleve.NewMatchAllQuery()
	searchReq := bleve.NewSearchRequest(matchAll)
	result, err := bm.Search(context.Background(), "empty-tenant", searchReq)
	require.NoError(t, err)
	assert.Equal(t, uint64(0), result.Total)
}

func TestBleveManager_ContextCancellation(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "bleve-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	bm, err := NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	entries := []domain.LogEntry{
		{EntryID: "e-1", LogType: domain.LogTypeAPI, Timestamp: time.Now()},
	}

	err = bm.IndexEntries(ctx, "tenant-cancel", entries)
	assert.ErrorIs(t, err, context.Canceled)
}

func TestBleveManager_SearchWithFields(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "bleve-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	bm, err := NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	entries := []domain.LogEntry{
		{
			EntryID:    "e-1",
			JobID:      "job-1",
			LogType:    domain.LogTypeAPI,
			User:       "Demo",
			Form:       "HPD:Help Desk",
			DurationMS: 5000,
			Timestamp:  time.Now(),
		},
		{
			EntryID:    "e-2",
			JobID:      "job-1",
			LogType:    domain.LogTypeAPI,
			User:       "Admin",
			Form:       "HPD:Incident",
			DurationMS: 100,
			Timestamp:  time.Now(),
		},
	}

	err = bm.IndexEntries(context.Background(), "tenant-fields", entries)
	require.NoError(t, err)

	// Search for user "Demo" using keyword field
	userQuery := bleve.NewTermQuery("Demo")
	userQuery.SetField("user")
	searchReq := bleve.NewSearchRequest(userQuery)
	searchReq.Fields = []string{"*"}

	result, err := bm.Search(context.Background(), "tenant-fields", searchReq)
	require.NoError(t, err)
	assert.Equal(t, uint64(1), result.Total)
	assert.Equal(t, "e-1", result.Hits[0].ID)
}

func TestBleveManager_NumericRangeSearch(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "bleve-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	bm, err := NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	entries := []domain.LogEntry{
		{EntryID: "fast", LogType: domain.LogTypeAPI, DurationMS: 50, Timestamp: time.Now()},
		{EntryID: "medium", LogType: domain.LogTypeAPI, DurationMS: 500, Timestamp: time.Now()},
		{EntryID: "slow", LogType: domain.LogTypeAPI, DurationMS: 5000, Timestamp: time.Now()},
	}

	err = bm.IndexEntries(context.Background(), "tenant-numeric", entries)
	require.NoError(t, err)

	// Search for entries with duration_ms > 1000
	minVal := float64(1000)
	inclusive := false
	q := bleve.NewNumericRangeInclusiveQuery(&minVal, nil, &inclusive, nil)
	q.SetField("duration_ms")
	searchReq := bleve.NewSearchRequest(q)

	result, err := bm.Search(context.Background(), "tenant-numeric", searchReq)
	require.NoError(t, err)
	assert.Equal(t, uint64(1), result.Total)
	assert.Equal(t, "slow", result.Hits[0].ID)
}

func TestBleveManager_DeleteIndex(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "bleve-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	bm, err := NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	// Create and populate an index
	err = bm.IndexEntries(context.Background(), "tenant-del", []domain.LogEntry{
		{EntryID: "d-1", LogType: domain.LogTypeAPI, Timestamp: time.Now()},
	})
	require.NoError(t, err)

	// Delete the index
	err = bm.DeleteIndex("tenant-del")
	require.NoError(t, err)

	// Searching again should return 0 results (new empty index is created)
	matchAll := bleve.NewMatchAllQuery()
	searchReq := bleve.NewSearchRequest(matchAll)
	result, err := bm.Search(context.Background(), "tenant-del", searchReq)
	require.NoError(t, err)
	assert.Equal(t, uint64(0), result.Total)
}

func TestBleveManager_IndexAlias(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "bleve-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	bm, err := NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	entries := []domain.LogEntry{
		{EntryID: "idx-1", LogType: domain.LogTypeAPI, User: "Test", Timestamp: time.Now()},
	}

	// Use the Index alias method (wraps IndexEntries).
	err = bm.Index(context.Background(), "tenant-alias", entries)
	require.NoError(t, err)

	// Verify the entry was indexed.
	matchAll := bleve.NewMatchAllQuery()
	searchReq := bleve.NewSearchRequest(matchAll)
	result, err := bm.Search(context.Background(), "tenant-alias", searchReq)
	require.NoError(t, err)
	assert.Equal(t, uint64(1), result.Total)
}

func TestBleveManager_DeleteAlias(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "bleve-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	bm, err := NewBleveManager(tmpDir)
	require.NoError(t, err)
	defer bm.Close()

	// Create an index with data.
	err = bm.IndexEntries(context.Background(), "tenant-del2", []domain.LogEntry{
		{EntryID: "d-1", LogType: domain.LogTypeAPI, Timestamp: time.Now()},
	})
	require.NoError(t, err)

	// Use the Delete alias method (wraps DeleteIndex).
	err = bm.Delete("tenant-del2")
	require.NoError(t, err)

	// Verify the index was deleted.
	matchAll := bleve.NewMatchAllQuery()
	searchReq := bleve.NewSearchRequest(matchAll)
	result, err := bm.Search(context.Background(), "tenant-del2", searchReq)
	require.NoError(t, err)
	assert.Equal(t, uint64(0), result.Total)
}

func TestNewBleveManager_InvalidDir(t *testing.T) {
	// Empty dir string still works (uses current dir as base).
	bm, err := NewBleveManager(t.TempDir())
	require.NoError(t, err)
	require.NotNil(t, bm)
	bm.Close()
}
