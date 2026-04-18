package worker

import (
	"context"
	"fmt"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

// VerifyJobFromDatabase loads the job row and ensures the NATS payload matches
// a queued job before any expensive work runs.
func VerifyJobFromDatabase(ctx context.Context, pg storage.PostgresStore, msg domain.AnalysisJob) (*domain.AnalysisJob, error) {
	dbJob, err := pg.GetJob(ctx, msg.TenantID, msg.ID)
	if err != nil {
		if storage.IsNotFound(err) {
			return nil, fmt.Errorf("worker: job not found in database")
		}
		return nil, fmt.Errorf("worker: get job: %w", err)
	}
	if dbJob.FileID != msg.FileID {
		return nil, fmt.Errorf("worker: file_id mismatch between NATS message and database")
	}
	if dbJob.Status != domain.JobStatusQueued {
		return nil, fmt.Errorf("worker: job status is %q, expected queued", dbJob.Status)
	}
	return dbJob, nil
}
