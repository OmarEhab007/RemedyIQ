package worker

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// NewProcessor tests
// ---------------------------------------------------------------------------

func TestNewProcessor(t *testing.T) {
	t.Run("all nil dependencies", func(t *testing.T) {
		p := NewProcessor(nil, nil, "tenant-1")
		require.NotNil(t, p)
		assert.Nil(t, p.pipeline)
		assert.Nil(t, p.nats)
		assert.Equal(t, "tenant-1", p.tenantID)
	})

	t.Run("with pipeline and tenant", func(t *testing.T) {
		pipeline := NewPipeline(nil, nil, nil, nil, nil, nil, nil)
		nats := &testutil.MockNATSStreamer{}
		p := NewProcessor(pipeline, nats, "tenant-abc")
		require.NotNil(t, p)
		assert.NotNil(t, p.pipeline)
		assert.NotNil(t, p.nats)
		assert.Equal(t, "tenant-abc", p.tenantID)
	})

	t.Run("empty tenant ID", func(t *testing.T) {
		p := NewProcessor(nil, nil, "")
		require.NotNil(t, p)
		assert.Equal(t, "", p.tenantID)
	})
}

func TestNewProcessor_StoresFieldsCorrectly(t *testing.T) {
	pipeline := NewPipeline(nil, nil, nil, nil, nil, nil, nil)
	nats := &testutil.MockNATSStreamer{}
	p := NewProcessor(pipeline, nats, "test-tenant")

	assert.Same(t, pipeline, p.pipeline, "pipeline should be the same reference")
	assert.NotNil(t, p.nats)
	assert.Equal(t, "test-tenant", p.tenantID)
}

// ---------------------------------------------------------------------------
// Processor.Start tests
// ---------------------------------------------------------------------------

// TestProcessor_Start_NilNATS verifies that Start panics when the NATS client
// is nil, since it calls SubscribeJobSubmit on the nil interface.
func TestProcessor_Start_NilNATS(t *testing.T) {
	pipeline := NewPipeline(nil, nil, nil, nil, nil, nil, nil)
	p := NewProcessor(pipeline, nil, "tenant-1")

	assert.Panics(t, func() {
		_ = p.Start(context.Background())
	}, "Start should panic when NATS client is nil")
}

// TestProcessor_Start_SubscribeFails verifies that Start returns the error
// when SubscribeJobSubmit fails.
func TestProcessor_Start_SubscribeFails(t *testing.T) {
	nats := &testutil.MockNATSStreamer{}
	pipeline := NewPipeline(nil, nil, nil, nil, nil, nil, nil)
	p := NewProcessor(pipeline, nats, "tenant-1")

	nats.On("SubscribeJobSubmit", mock.Anything, "tenant-1", mock.AnythingOfType("func(domain.AnalysisJob)")).
		Return(errors.New("nats connection refused"))

	err := p.Start(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "nats connection refused")
	nats.AssertExpectations(t)
}

// TestProcessor_Start_ContextCancellation verifies that Start blocks until
// the context is cancelled and returns nil (graceful shutdown).
func TestProcessor_Start_ContextCancellation(t *testing.T) {
	nats := &testutil.MockNATSStreamer{}
	pipeline := NewPipeline(nil, nil, nil, nil, nil, nil, nil)
	p := NewProcessor(pipeline, nats, "tenant-1")

	nats.On("SubscribeJobSubmit", mock.Anything, "tenant-1", mock.AnythingOfType("func(domain.AnalysisJob)")).
		Return(nil)

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() {
		done <- p.Start(ctx)
	}()

	// Give it a moment to start, then cancel
	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case err := <-done:
		assert.NoError(t, err, "Start should return nil on context cancellation")
	case <-time.After(5 * time.Second):
		t.Fatal("Start did not return after context cancellation")
	}
	nats.AssertExpectations(t)
}

// TestProcessor_Start_CallbackInvocation verifies that the callback passed
// to SubscribeJobSubmit is properly wired. We capture it and invoke it to
// test the shutdown guard.
func TestProcessor_Start_CallbackShutdownGuard(t *testing.T) {
	nats := &testutil.MockNATSStreamer{}
	pipeline := NewPipeline(nil, nil, nil, nil, nil, nil, nil)
	p := NewProcessor(pipeline, nats, "tenant-1")

	callbackCh := make(chan func(domain.AnalysisJob), 1)

	nats.On("SubscribeJobSubmit", mock.Anything, "tenant-1", mock.AnythingOfType("func(domain.AnalysisJob)")).
		Run(func(args mock.Arguments) {
			callbackCh <- args.Get(2).(func(domain.AnalysisJob))
		}).
		Return(nil)

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() {
		done <- p.Start(ctx)
	}()

	// Wait for the callback to be captured via the channel (no data race).
	var capturedCallback func(domain.AnalysisJob)
	select {
	case capturedCallback = <-callbackCh:
		require.NotNil(t, capturedCallback, "callback should have been captured")
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for SubscribeJobSubmit callback")
	}

	// Cancel context first, then invoke callback -- it should hit the
	// "shutdown in progress" guard and not panic.
	cancel()

	// Wait for Start to return
	select {
	case err := <-done:
		assert.NoError(t, err)
	case <-time.After(5 * time.Second):
		t.Fatal("Start did not return after cancellation")
	}

	// Now invoke the callback with a cancelled context. The shutdown guard
	// should prevent processing. Since the pipeline has nil pg, a
	// non-guarded path would panic.
	assert.NotPanics(t, func() {
		capturedCallback(newTestJob())
	}, "callback should skip processing when context is cancelled")

	nats.AssertExpectations(t)
}
