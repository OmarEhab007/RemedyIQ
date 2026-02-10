package worker

import (
	"context"
	"log/slog"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
)

// Processor subscribes to the NATS job queue and processes incoming jobs
// using the ingestion Pipeline.
type Processor struct {
	pipeline *Pipeline
	nats     *streaming.NATSClient
	tenantID string
}

func NewProcessor(pipeline *Pipeline, nats *streaming.NATSClient, tenantID string) *Processor {
	return &Processor{pipeline: pipeline, nats: nats, tenantID: tenantID}
}

// Start subscribes to job submissions and processes each one. It blocks until
// the context is cancelled.
func (p *Processor) Start(ctx context.Context) error {
	slog.Info("processor starting", "tenant_id", p.tenantID)

	err := p.nats.SubscribeJobSubmit(ctx, p.tenantID, func(job domain.AnalysisJob) {
		logger := slog.With("job_id", job.ID.String(), "tenant_id", p.tenantID)
		logger.Info("received job submission", "file_id", job.FileID.String())

		if err := p.pipeline.ProcessJob(ctx, job); err != nil {
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
