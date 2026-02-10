package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/jar"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
)

// Pipeline orchestrates the ingestion flow: download -> JAR -> parse -> store.
type Pipeline struct {
	pg       *storage.PostgresClient
	ch       *storage.ClickHouseClient
	s3       *storage.S3Client
	nats     *streaming.NATSClient
	jar      *jar.Runner
	anomaly  *AnomalyDetector
}

func NewPipeline(
	pg *storage.PostgresClient,
	ch *storage.ClickHouseClient,
	s3 *storage.S3Client,
	nats *streaming.NATSClient,
	jarRunner *jar.Runner,
	anomalyDetector *AnomalyDetector,
) *Pipeline {
	return &Pipeline{pg: pg, ch: ch, s3: s3, nats: nats, jar: jarRunner, anomaly: anomalyDetector}
}

// ProcessJob runs the full ingestion pipeline for an analysis job.
func (p *Pipeline) ProcessJob(ctx context.Context, job domain.AnalysisJob) error {
	tenantID := job.TenantID.String()
	jobID := job.ID.String()
	logger := slog.With("job_id", jobID, "tenant_id", tenantID)

	// 1. Update status to parsing.
	if err := p.pg.UpdateJobStatus(ctx, job.TenantID, job.ID, domain.JobStatusParsing, nil); err != nil {
		return fmt.Errorf("update status to parsing: %w", err)
	}
	_ = p.nats.PublishJobProgress(ctx, tenantID, jobID, 5, string(domain.JobStatusParsing), "downloading file")

	// 2. Get file metadata.
	file, err := p.pg.GetLogFile(ctx, job.TenantID, job.FileID)
	if err != nil {
		return p.failJob(ctx, job, "file not found: "+err.Error())
	}

	// 3. Download file from S3 to temp file.
	reader, err := p.s3.Download(ctx, file.S3Key)
	if err != nil {
		return p.failJob(ctx, job, "download failed: "+err.Error())
	}
	defer reader.Close()

	tmpFile, err := os.CreateTemp("", "remedyiq-*.log")
	if err != nil {
		return p.failJob(ctx, job, "create temp file: "+err.Error())
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	if _, err := io.Copy(tmpFile, reader); err != nil {
		return p.failJob(ctx, job, "download to temp: "+err.Error())
	}
	tmpFile.Close()

	_ = p.nats.PublishJobProgress(ctx, tenantID, jobID, 15, string(domain.JobStatusParsing), "running JAR analysis")
	logger.Info("file downloaded, starting JAR", "path", tmpFile.Name(), "size", file.SizeBytes)

	// 4. Run JAR.
	lineCount := int64(0)
	callback := func(line string) {
		lineCount++
		if lineCount%1000 == 0 {
			pct := 15 + int(float64(lineCount)/float64(max(file.SizeBytes/100, 1)))
			if pct > 70 {
				pct = 70
			}
			_ = p.nats.PublishJobProgress(ctx, tenantID, jobID, pct, string(domain.JobStatusParsing), fmt.Sprintf("processed %d lines", lineCount))
		}
	}

	result, err := p.jar.Run(ctx, tmpFile.Name(), job.JARFlags, job.JVMHeapMB, callback)
	if err != nil {
		stderr := ""
		if result != nil {
			stderr = result.Stderr
		}
		return p.failJob(ctx, job, fmt.Sprintf("JAR execution failed: %s (stderr: %s)", err.Error(), stderr))
	}

	_ = p.nats.PublishJobProgress(ctx, tenantID, jobID, 75, string(domain.JobStatusAnalyzing), "parsing JAR output")

	// 5. Parse JAR output.
	dashboard, err := jar.ParseOutput(result.Stdout)
	if err != nil {
		return p.failJob(ctx, job, "parse output: "+err.Error())
	}

	// 5b. Run anomaly detection on parsed dashboard data.
	var anomalies []Anomaly
	if p.anomaly != nil {
		anomalies = p.detectAnomalies(ctx, jobID, tenantID, dashboard)
		if len(anomalies) > 0 {
			logger.Info("anomaly detection complete",
				"total_anomalies", len(anomalies),
			)
		}
	}

	// 6. Update status to storing.
	if err := p.pg.UpdateJobStatus(ctx, job.TenantID, job.ID, domain.JobStatusStoring, nil); err != nil {
		logger.Error("failed to update status to storing", "error", err)
	}
	_ = p.nats.PublishJobProgress(ctx, tenantID, jobID, 85, string(domain.JobStatusStoring), "storing results")

	// 7. Store entries in ClickHouse (if parser produces entries in the future).
	// For now, the JAR parser produces DashboardData but not individual LogEntry rows.
	// Individual entry parsing will be added when native Go parsers are implemented.

	// 8. Update job with completion stats.
	now := time.Now().UTC()
	if err := p.pg.UpdateJobStatus(ctx, job.TenantID, job.ID, domain.JobStatusComplete, nil); err != nil {
		return fmt.Errorf("update status to complete: %w", err)
	}
	_ = p.pg.UpdateJobProgress(ctx, job.TenantID, job.ID, 100, &dashboard.GeneralStats.TotalLines)

	// 8b. Publish anomaly results via NATS if any were detected.
	if len(anomalies) > 0 {
		anomalyMsg := map[string]interface{}{
			"job_id":    jobID,
			"tenant_id": tenantID,
			"anomalies": anomalies,
			"count":     len(anomalies),
		}
		anomalyJSON, err := json.Marshal(anomalyMsg)
		if err == nil {
			_ = p.nats.PublishJobProgress(ctx, tenantID, jobID, 95, string(domain.JobStatusStoring),
				fmt.Sprintf("detected %d anomalies", len(anomalies)))
			logger.Info("published anomaly results", "count", len(anomalies), "bytes", len(anomalyJSON))
		}
	}

	// 9. Publish completion event.
	job.Status = domain.JobStatusComplete
	job.ProgressPct = 100
	job.CompletedAt = &now
	job.APICount = &dashboard.GeneralStats.APICount
	job.SQLCount = &dashboard.GeneralStats.SQLCount
	job.FilterCount = &dashboard.GeneralStats.FilterCount
	job.EscCount = &dashboard.GeneralStats.EscCount
	job.LogDuration = &dashboard.GeneralStats.LogDuration

	_ = p.nats.PublishJobComplete(ctx, tenantID, jobID, job)
	_ = p.nats.PublishJobProgress(ctx, tenantID, jobID, 100, string(domain.JobStatusComplete), "analysis complete")

	logger.Info("job completed",
		"total_lines", dashboard.GeneralStats.TotalLines,
		"api_count", dashboard.GeneralStats.APICount,
		"sql_count", dashboard.GeneralStats.SQLCount,
		"duration", result.Duration,
	)

	// 10. Cache the dashboard data in Redis via ClickHouse query path.
	// The dashboard handler will query ClickHouse and cache on first request.

	return nil
}

// detectAnomalies runs the anomaly detector on dashboard top-N data and returns
// all detected anomalies. The results are collected into a single slice for
// downstream persistence and notification.
func (p *Pipeline) detectAnomalies(ctx context.Context, jobID, tenantID string, dashboard *domain.DashboardData) []Anomaly {
	var allAnomalies []Anomaly

	// Detect slow API calls.
	if len(dashboard.TopAPICalls) > 0 {
		apiPoints := make([]DataPoint, len(dashboard.TopAPICalls))
		for i, entry := range dashboard.TopAPICalls {
			apiPoints[i] = DataPoint{
				Key:   entry.Identifier,
				Value: float64(entry.DurationMS),
				Metadata: map[string]string{
					"form": entry.Form,
					"rank": fmt.Sprintf("%d", entry.Rank),
				},
			}
		}
		found := p.anomaly.Detect(ctx, jobID, tenantID, AnomalySlowAPI, "api_duration_ms", apiPoints)
		allAnomalies = append(allAnomalies, found...)
	}

	// Detect slow SQL statements.
	if len(dashboard.TopSQL) > 0 {
		sqlPoints := make([]DataPoint, len(dashboard.TopSQL))
		for i, entry := range dashboard.TopSQL {
			sqlPoints[i] = DataPoint{
				Key:   entry.Identifier,
				Value: float64(entry.DurationMS),
				Metadata: map[string]string{
					"rank": fmt.Sprintf("%d", entry.Rank),
				},
			}
		}
		found := p.anomaly.Detect(ctx, jobID, tenantID, AnomalySlowSQL, "sql_duration_ms", sqlPoints)
		allAnomalies = append(allAnomalies, found...)
	}

	return allAnomalies
}

func (p *Pipeline) failJob(ctx context.Context, job domain.AnalysisJob, errMsg string) error {
	slog.Error("job failed", "job_id", job.ID.String(), "error", errMsg)
	_ = p.pg.UpdateJobStatus(ctx, job.TenantID, job.ID, domain.JobStatusFailed, &errMsg)
	_ = p.nats.PublishJobProgress(ctx, job.TenantID.String(), job.ID.String(), 0, string(domain.JobStatusFailed), errMsg)

	completedJob := job
	completedJob.Status = domain.JobStatusFailed
	completedJob.ErrorMessage = &errMsg
	_ = p.nats.PublishJobComplete(ctx, job.TenantID.String(), job.ID.String(), completedJob)

	return fmt.Errorf("%s", errMsg)
}
