//go:build integration

package storage

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

func clickhouseDSN() string {
	dsn := os.Getenv("CLICKHOUSE_URL")
	if dsn == "" {
		dsn = "clickhouse://localhost:9000/remedyiq"
	}
	return dsn
}

func setupClickHouse(t *testing.T) *ClickHouseClient {
	t.Helper()
	ctx := context.Background()
	client, err := NewClickHouseClient(ctx, clickhouseDSN())
	require.NoError(t, err, "failed to connect to ClickHouse")
	t.Cleanup(func() { _ = client.Close() })
	return client
}

func TestClickHouse_Ping(t *testing.T) {
	client := setupClickHouse(t)
	err := client.Ping(context.Background())
	assert.NoError(t, err)
}

func TestClickHouse_BatchInsertAndGetEntry(t *testing.T) {
	client := setupClickHouse(t)
	ctx := context.Background()

	tenantID := "test-tenant-ch-001"
	jobID := "test-job-ch-001"

	entries := []domain.LogEntry{
		{
			TenantID:   tenantID,
			JobID:      jobID,
			EntryID:    "entry-001",
			LineNumber: 1,
			FileNumber: 1,
			Timestamp:  time.Date(2025, 1, 15, 10, 0, 0, 0, time.UTC),
			IngestedAt: time.Now().UTC(),
			LogType:    domain.LogTypeAPI,
			TraceID:    "trace-001",
			RPCID:      "rpc-001",
			ThreadID:   "thread-001",
			Queue:      "Admin",
			User:       "Demo",
			DurationMS: 150,
			Success:    true,
			APICode:    "GetEntry",
			Form:       "HPD:Help Desk",
			RawText:    "GetEntry 150ms success",
		},
		{
			TenantID:   tenantID,
			JobID:      jobID,
			EntryID:    "entry-002",
			LineNumber: 2,
			FileNumber: 1,
			Timestamp:  time.Date(2025, 1, 15, 10, 0, 1, 0, time.UTC),
			IngestedAt: time.Now().UTC(),
			LogType:    domain.LogTypeSQL,
			TraceID:    "trace-001",
			RPCID:      "rpc-002",
			ThreadID:   "thread-001",
			Queue:      "Admin",
			User:       "Demo",
			DurationMS: 50,
			Success:    true,
			SQLTable:   "T001",
			RawText:    "SELECT * FROM T001",
		},
		{
			TenantID:   tenantID,
			JobID:      jobID,
			EntryID:    "entry-003",
			LineNumber: 3,
			FileNumber: 1,
			Timestamp:  time.Date(2025, 1, 15, 10, 1, 0, 0, time.UTC),
			IngestedAt: time.Now().UTC(),
			LogType:    domain.LogTypeFilter,
			TraceID:    "trace-002",
			RPCID:      "rpc-003",
			ThreadID:   "thread-002",
			Queue:      "User",
			User:       "Admin1",
			DurationMS: 200,
			Success:    false,
			FilterName: "HPD:Filter001",
			Operation:  "SET",
			RawText:    "Filter execution 200ms",
		},
	}

	// Insert entries.
	err := client.BatchInsertEntries(ctx, entries)
	require.NoError(t, err, "BatchInsertEntries should succeed")

	// Allow ClickHouse to flush the batch.
	time.Sleep(2 * time.Second)

	// Retrieve a single entry.
	entry, err := client.GetLogEntry(ctx, tenantID, jobID, "entry-001")
	require.NoError(t, err, "GetLogEntry should succeed")
	assert.Equal(t, "entry-001", entry.EntryID)
	assert.Equal(t, domain.LogTypeAPI, entry.LogType)
	assert.Equal(t, uint32(150), entry.DurationMS)
	assert.Equal(t, "GetEntry", entry.APICode)
	assert.Equal(t, "HPD:Help Desk", entry.Form)

	// Retrieve non-existent entry.
	_, err = client.GetLogEntry(ctx, tenantID, jobID, "nonexistent")
	assert.Error(t, err)

	// Verify tenant isolation: different tenant should see nothing.
	_, err = client.GetLogEntry(ctx, "other-tenant", jobID, "entry-001")
	assert.Error(t, err)
}

func TestClickHouse_BatchInsertEmpty(t *testing.T) {
	client := setupClickHouse(t)
	err := client.BatchInsertEntries(context.Background(), nil)
	assert.NoError(t, err, "inserting empty batch should be a no-op")
}

func TestClickHouse_SearchEntries(t *testing.T) {
	client := setupClickHouse(t)
	ctx := context.Background()

	tenantID := "test-tenant-ch-search"
	jobID := "test-job-ch-search"

	// Seed data.
	var entries []domain.LogEntry
	base := time.Date(2025, 3, 1, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 30; i++ {
		lt := domain.LogTypeAPI
		if i%3 == 0 {
			lt = domain.LogTypeSQL
		}
		entries = append(entries, domain.LogEntry{
			TenantID:   tenantID,
			JobID:      jobID,
			EntryID:    fmt.Sprintf("search-entry-%03d", i),
			LineNumber: uint32(i + 1),
			FileNumber: 1,
			Timestamp:  base.Add(time.Duration(i) * time.Second),
			IngestedAt: time.Now().UTC(),
			LogType:    lt,
			User:       "SearchUser",
			Queue:      "TestQueue",
			DurationMS: uint32(100 + i*10),
			Success:    i%5 != 0,
			RawText:    fmt.Sprintf("raw log line %d", i),
		})
	}

	require.NoError(t, client.BatchInsertEntries(ctx, entries))
	time.Sleep(2 * time.Second)

	// Basic paginated search.
	result, err := client.SearchEntries(ctx, tenantID, jobID, SearchQuery{
		Page:     1,
		PageSize: 10,
		SortBy:   "timestamp",
		SortOrder: "asc",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(30), result.TotalCount)
	assert.Len(t, result.Entries, 10)
	assert.True(t, result.TookMS >= 0)

	// Search with text query.
	result, err = client.SearchEntries(ctx, tenantID, jobID, SearchQuery{
		Query:    "line 1",
		Page:     1,
		PageSize: 50,
	})
	require.NoError(t, err)
	assert.Greater(t, result.TotalCount, int64(0))

	// Filter by log type.
	result, err = client.SearchEntries(ctx, tenantID, jobID, SearchQuery{
		LogTypes: []string{"SQL"},
		Page:     1,
		PageSize: 50,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(10), result.TotalCount) // every 3rd entry

	// Filter by user.
	result, err = client.SearchEntries(ctx, tenantID, jobID, SearchQuery{
		UserFilter: "SearchUser",
		Page:       1,
		PageSize:   5,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(30), result.TotalCount)
	assert.Len(t, result.Entries, 5)

	// Tenant isolation.
	result, err = client.SearchEntries(ctx, "other-tenant-search", jobID, SearchQuery{
		Page:     1,
		PageSize: 10,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(0), result.TotalCount)
}

func TestClickHouse_GetTraceEntries(t *testing.T) {
	client := setupClickHouse(t)
	ctx := context.Background()

	tenantID := "test-tenant-ch-trace"
	jobID := "test-job-ch-trace"
	traceID := "trace-ABC"

	entries := []domain.LogEntry{
		{
			TenantID: tenantID, JobID: jobID, EntryID: "trace-e1",
			LineNumber: 1, FileNumber: 1,
			Timestamp: time.Date(2025, 2, 1, 8, 0, 0, 0, time.UTC), IngestedAt: time.Now().UTC(),
			LogType: domain.LogTypeAPI, TraceID: traceID, DurationMS: 100,
		},
		{
			TenantID: tenantID, JobID: jobID, EntryID: "trace-e2",
			LineNumber: 2, FileNumber: 1,
			Timestamp: time.Date(2025, 2, 1, 8, 0, 1, 0, time.UTC), IngestedAt: time.Now().UTC(),
			LogType: domain.LogTypeSQL, TraceID: traceID, DurationMS: 50,
		},
		{
			TenantID: tenantID, JobID: jobID, EntryID: "trace-e3",
			LineNumber: 3, FileNumber: 1,
			Timestamp: time.Date(2025, 2, 1, 8, 0, 2, 0, time.UTC), IngestedAt: time.Now().UTC(),
			LogType: domain.LogTypeAPI, TraceID: "other-trace", DurationMS: 75,
		},
	}

	require.NoError(t, client.BatchInsertEntries(ctx, entries))
	time.Sleep(2 * time.Second)

	// Should return only the two entries for trace-ABC, ordered by timestamp.
	traceEntries, err := client.GetTraceEntries(ctx, tenantID, jobID, traceID)
	require.NoError(t, err)
	assert.Len(t, traceEntries, 2)
	assert.Equal(t, "trace-e1", traceEntries[0].EntryID)
	assert.Equal(t, "trace-e2", traceEntries[1].EntryID)

	// Tenant isolation.
	traceEntries, err = client.GetTraceEntries(ctx, "wrong-tenant", jobID, traceID)
	require.NoError(t, err)
	assert.Len(t, traceEntries, 0)
}

func TestClickHouse_GetDashboardData(t *testing.T) {
	client := setupClickHouse(t)
	ctx := context.Background()

	tenantID := "test-tenant-ch-dash"
	jobID := "test-job-ch-dash"

	var entries []domain.LogEntry
	base := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 20; i++ {
		var lt domain.LogType
		switch i % 4 {
		case 0:
			lt = domain.LogTypeAPI
		case 1:
			lt = domain.LogTypeSQL
		case 2:
			lt = domain.LogTypeFilter
		case 3:
			lt = domain.LogTypeEscalation
		}
		entries = append(entries, domain.LogEntry{
			TenantID:   tenantID,
			JobID:      jobID,
			EntryID:    fmt.Sprintf("dash-entry-%03d", i),
			LineNumber: uint32(i + 1),
			FileNumber: 1,
			Timestamp:  base.Add(time.Duration(i) * time.Minute),
			IngestedAt: time.Now().UTC(),
			LogType:    lt,
			Queue:      "DashQueue",
			User:       fmt.Sprintf("user%d", i%3),
			DurationMS: uint32(50 + i*20),
			Success:    i%7 != 0,
			APICode:    "api_call",
			Form:       "TestForm",
			SQLTable:   "T999",
			FilterName: "FilterX",
			EscName:    "EscY",
		})
	}

	require.NoError(t, client.BatchInsertEntries(ctx, entries))
	time.Sleep(2 * time.Second)

	dash, err := client.GetDashboardData(ctx, tenantID, jobID, 5)
	require.NoError(t, err)
	require.NotNil(t, dash)

	// General stats.
	assert.Equal(t, int64(20), dash.GeneralStats.TotalLines)
	assert.Equal(t, int64(5), dash.GeneralStats.APICount)
	assert.Equal(t, int64(5), dash.GeneralStats.SQLCount)
	assert.Equal(t, int64(5), dash.GeneralStats.FilterCount)
	assert.Equal(t, int64(5), dash.GeneralStats.EscCount)
	assert.Equal(t, 3, dash.GeneralStats.UniqueUsers)
	assert.False(t, dash.GeneralStats.LogStart.IsZero())
	assert.False(t, dash.GeneralStats.LogEnd.IsZero())
	assert.NotEmpty(t, dash.GeneralStats.LogDuration)

	// Top-N entries.
	assert.LessOrEqual(t, len(dash.TopAPICalls), 5)
	assert.LessOrEqual(t, len(dash.TopSQL), 5)
	assert.LessOrEqual(t, len(dash.TopFilters), 5)
	assert.LessOrEqual(t, len(dash.TopEscalations), 5)

	// Top entries should be sorted by duration_ms descending.
	if len(dash.TopAPICalls) >= 2 {
		assert.GreaterOrEqual(t, dash.TopAPICalls[0].DurationMS, dash.TopAPICalls[1].DurationMS)
	}

	// Time series should have data.
	assert.Greater(t, len(dash.TimeSeries), 0)

	// Distribution should include by_type.
	byType, ok := dash.Distribution["by_type"]
	assert.True(t, ok, "distribution should contain by_type")
	assert.Greater(t, byType["API"], 0)

	// Distribution should include by_queue.
	byQueue, ok := dash.Distribution["by_queue"]
	assert.True(t, ok, "distribution should contain by_queue")
	assert.Greater(t, byQueue["DashQueue"], 0)
}
