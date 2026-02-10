//go:build integration

package streaming

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func natsURL(t *testing.T) string {
	t.Helper()
	url := os.Getenv("NATS_URL")
	if url == "" {
		url = "nats://localhost:4222"
	}
	return url
}

func setupClient(t *testing.T) *NATSClient {
	t.Helper()
	client, err := NewNATSClient(natsURL(t))
	require.NoError(t, err, "failed to connect to NATS")
	t.Cleanup(func() { client.Close() })
	return client
}

func TestNewNATSClient(t *testing.T) {
	client := setupClient(t)
	assert.NotNil(t, client.conn)
	assert.NotNil(t, client.js)
}

func TestPing(t *testing.T) {
	client := setupClient(t)
	err := client.Ping()
	assert.NoError(t, err)
}

func TestEnsureStreams(t *testing.T) {
	client := setupClient(t)
	ctx := context.Background()

	err := client.EnsureStreams(ctx)
	require.NoError(t, err)

	// Calling again should be idempotent.
	err = client.EnsureStreams(ctx)
	require.NoError(t, err)
}

func TestPublishSubscribeJobSubmit(t *testing.T) {
	client := setupClient(t)
	ctx := context.Background()
	require.NoError(t, client.EnsureStreams(ctx))

	tenantID := uuid.New().String()
	jobID := uuid.New()

	job := domain.AnalysisJob{
		ID:       jobID,
		TenantID: uuid.MustParse(tenantID),
		Status:   domain.JobStatusQueued,
		FileID:   uuid.New(),
	}

	var received domain.AnalysisJob
	var wg sync.WaitGroup
	wg.Add(1)

	err := client.SubscribeJobSubmit(ctx, tenantID, func(j domain.AnalysisJob) {
		received = j
		wg.Done()
	})
	require.NoError(t, err)

	// Allow the consumer to be fully set up.
	time.Sleep(500 * time.Millisecond)

	err = client.PublishJobSubmit(ctx, tenantID, job)
	require.NoError(t, err)

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		assert.Equal(t, jobID, received.ID)
		assert.Equal(t, domain.JobStatusQueued, received.Status)
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for job submit message")
	}
}

func TestPublishSubscribeJobProgress(t *testing.T) {
	client := setupClient(t)
	ctx := context.Background()
	require.NoError(t, client.EnsureStreams(ctx))

	tenantID := uuid.New().String()
	jobID := uuid.New().String()

	var received JobProgress
	var wg sync.WaitGroup
	wg.Add(1)

	err := client.SubscribeJobProgress(ctx, tenantID, func(p JobProgress) {
		received = p
		wg.Done()
	})
	require.NoError(t, err)

	time.Sleep(500 * time.Millisecond)

	err = client.PublishJobProgress(ctx, tenantID, jobID, 42, "parsing", "Processing line 4200 of 10000")
	require.NoError(t, err)

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		assert.Equal(t, jobID, received.JobID)
		assert.Equal(t, 42, received.ProgressPct)
		assert.Equal(t, "parsing", received.Status)
		assert.Equal(t, "Processing line 4200 of 10000", received.Message)
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for job progress message")
	}
}

func TestTenantScopedIsolation(t *testing.T) {
	client := setupClient(t)
	ctx := context.Background()
	require.NoError(t, client.EnsureStreams(ctx))

	tenantA := uuid.New().String()
	tenantB := uuid.New().String()

	var receivedA []string
	var receivedB []string
	var mu sync.Mutex
	var wgA, wgB sync.WaitGroup
	wgA.Add(1)
	wgB.Add(1)

	// Subscribe tenant A.
	err := client.SubscribeJobProgress(ctx, tenantA, func(p JobProgress) {
		mu.Lock()
		receivedA = append(receivedA, p.JobID)
		mu.Unlock()
		wgA.Done()
	})
	require.NoError(t, err)

	// Subscribe tenant B.
	err = client.SubscribeJobProgress(ctx, tenantB, func(p JobProgress) {
		mu.Lock()
		receivedB = append(receivedB, p.JobID)
		mu.Unlock()
		wgB.Done()
	})
	require.NoError(t, err)

	time.Sleep(500 * time.Millisecond)

	jobA := uuid.New().String()
	jobB := uuid.New().String()

	// Publish to tenant A and tenant B.
	require.NoError(t, client.PublishJobProgress(ctx, tenantA, jobA, 50, "parsing", "Tenant A progress"))
	require.NoError(t, client.PublishJobProgress(ctx, tenantB, jobB, 75, "analyzing", "Tenant B progress"))

	doneA := make(chan struct{})
	go func() { wgA.Wait(); close(doneA) }()
	doneB := make(chan struct{})
	go func() { wgB.Wait(); close(doneB) }()

	select {
	case <-doneA:
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for tenant A message")
	}
	select {
	case <-doneB:
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for tenant B message")
	}

	mu.Lock()
	defer mu.Unlock()

	// Tenant A should only receive job A.
	assert.Equal(t, []string{jobA}, receivedA, "tenant A received wrong messages")
	// Tenant B should only receive job B.
	assert.Equal(t, []string{jobB}, receivedB, "tenant B received wrong messages")
}

func TestPublishSubscribeLiveTail(t *testing.T) {
	client := setupClient(t)
	ctx := context.Background()
	require.NoError(t, client.EnsureStreams(ctx))

	tenantID := uuid.New().String()

	entry := domain.LogEntry{
		TenantID:   tenantID,
		JobID:      uuid.New().String(),
		EntryID:    uuid.New().String(),
		LineNumber: 42,
		LogType:    domain.LogTypeSQL,
		SQLTable:   "T000001",
		DurationMS: 150,
	}

	var received domain.LogEntry
	var wg sync.WaitGroup
	wg.Add(1)

	err := client.SubscribeLiveTail(ctx, tenantID, string(domain.LogTypeSQL), func(e domain.LogEntry) {
		received = e
		wg.Done()
	})
	require.NoError(t, err)

	time.Sleep(500 * time.Millisecond)

	err = client.PublishLiveTailEntry(ctx, tenantID, string(domain.LogTypeSQL), entry)
	require.NoError(t, err)

	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()

	select {
	case <-done:
		assert.Equal(t, entry.EntryID, received.EntryID)
		assert.Equal(t, domain.LogTypeSQL, received.LogType)
		assert.Equal(t, uint32(150), received.DurationMS)
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for live tail entry")
	}
}

func TestJobComplete(t *testing.T) {
	client := setupClient(t)
	ctx := context.Background()
	require.NoError(t, client.EnsureStreams(ctx))

	tenantID := uuid.New().String()
	jobID := uuid.New()
	now := time.Now()

	job := domain.AnalysisJob{
		ID:          jobID,
		TenantID:    uuid.MustParse(tenantID),
		Status:      domain.JobStatusComplete,
		ProgressPct: 100,
		CompletedAt: &now,
	}

	err := client.PublishJobComplete(ctx, tenantID, jobID.String(), job)
	require.NoError(t, err, "publish job complete should not error")
}

func TestConnectionFailure(t *testing.T) {
	_, err := NewNATSClient("nats://invalid-host:4222")
	assert.Error(t, err, "connecting to invalid host should fail")
}
