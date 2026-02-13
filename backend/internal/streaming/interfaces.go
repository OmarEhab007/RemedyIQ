package streaming

import (
	"context"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

type NATSStreamer interface {
	EnsureStreams(ctx context.Context) error
	SubscribeJobSubmit(ctx context.Context, tenantID string, callback func(job domain.AnalysisJob)) error
	SubscribeAllJobSubmits(ctx context.Context, handler func(domain.AnalysisJob)) error
	SubscribeJobProgress(ctx context.Context, tenantID string, handler func(JobProgress)) error
	SubscribeLiveTail(ctx context.Context, tenantID string, logType string, handler func(domain.LogEntry)) error
	PublishJobSubmit(ctx context.Context, tenantID string, job domain.AnalysisJob) error
	PublishJobProgress(ctx context.Context, tenantID string, jobID string, progress int, status string, message string) error
	PublishJobComplete(ctx context.Context, tenantID string, jobID string, result domain.AnalysisJob) error
	PublishLiveTailEntry(ctx context.Context, tenantID string, logType string, entry domain.LogEntry) error
	Ping() error
	Close()
}
