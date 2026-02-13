package worker

import (
	"context"
	"log/slog"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
)

// defaultJobTimeout is the maximum time a single job is allowed to run.
const defaultJobTimeout = 30 * time.Minute

// Processor subscribes to the NATS job queue and processes incoming jobs
// using the ingestion Pipeline.
type Processor struct {
	pipeline *Pipeline
	nats     streaming.NATSStreamer
	tenantID string
}

func NewProcessor(pipeline *Pipeline, nats streaming.NATSStreamer, tenantID string) *Processor {
	return &Processor{pipeline: pipeline, nats: nats, tenantID: tenantID}
}

// Start subscribes to job submissions and processes each one. It blocks until
// the context is cancelled.
func (p *Processor) Start(ctx context.Context) error {
	slog.Info("processor starting", "tenant_id", p.tenantID)

	err := p.nats.SubscribeJobSubmit(ctx, p.tenantID, func(job domain.AnalysisJob) {
		logger := slog.With("job_id", job.ID.String(), "tenant_id", p.tenantID)

		// Check if we are shutting down before starting a new job.
		if ctx.Err() != nil {
			logger.Warn("shutdown in progress, skipping job")
			return
		}

		logger.Info("received job submission", "file_id", job.FileID.String())

		// Use a per-job context derived from context.Background so that
		// in-progress jobs are not aborted when the shutdown context is
		// cancelled. Each job gets its own timeout.
		jobCtx, jobCancel := context.WithTimeout(context.Background(), defaultJobTimeout)
		defer jobCancel()

		if err := p.pipeline.ProcessJob(jobCtx, job); err != nil {
			logger.Error("job processing failed", "error", err)
			return
		}

		logger.Info("job processing completed")
	})

	if err != nil {
		return err
	}

	// Block until context is cancelled.
	<-ctx.Done()
	slog.Info("processor shutting down", "tenant_id", p.tenantID)
	return nil
}
