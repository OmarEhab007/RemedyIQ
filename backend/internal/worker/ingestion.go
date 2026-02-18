package worker

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/jar"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/logparser"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
)

// JARRunner abstracts the JAR execution so tests can substitute a mock.
type JARRunner interface {
	Run(ctx context.Context, filePath string, flags domain.JARFlags, heapMB int, lineCallback func(string)) (*jar.Result, error)
}

// Pipeline orchestrates the ingestion flow: download -> JAR -> parse -> store.
type Pipeline struct {
	pg      storage.PostgresStore
	ch      storage.ClickHouseStore
	s3      storage.S3Storage
	redis   storage.RedisCache
	nats    streaming.NATSStreamer
	jar     JARRunner
	anomaly *AnomalyDetector
}

func NewPipeline(
	pg storage.PostgresStore,
	ch storage.ClickHouseStore,
	s3 storage.S3Storage,
	redis storage.RedisCache,
	nats streaming.NATSStreamer,
	jarRunner JARRunner,
	anomalyDetector *AnomalyDetector,
) *Pipeline {
	return &Pipeline{pg: pg, ch: ch, s3: s3, redis: redis, nats: nats, jar: jarRunner, anomaly: anomalyDetector}
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

	if _, err := io.Copy(tmpFile, reader); err != nil {
		tmpFile.Close()
		return p.failJob(ctx, job, "download to temp: "+err.Error())
	}
	if err := tmpFile.Close(); err != nil {
		return p.failJob(ctx, job, "close temp file: "+err.Error())
	}

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
	parseResult, err := jar.ParseOutput(result.Stdout)
	if err != nil {
		return p.failJob(ctx, job, "parse output: "+err.Error())
	}
	dashboard := parseResult.Dashboard

	// 5b. Enhance parse result: fill in computed sections where JAR-native data is absent.
	EnhanceParseResult(parseResult)

	// 5b1. Backfill filter_count if JAR General Statistics didn't include it.
	if dashboard.GeneralStats.FilterCount == 0 && parseResult.JARFilters != nil {
		var total int64
		for _, f := range parseResult.JARFilters.MostExecuted {
			total += int64(f.PassCount + f.FailCount)
		}
		if total > 0 {
			dashboard.GeneralStats.FilterCount = total
		}
	}

	// 5b2. Generate time series from TopN entry timestamps if not already populated.
	if len(dashboard.TimeSeries) == 0 {
		if ts := generateTimeSeries(dashboard); ts != nil {
			dashboard.TimeSeries = ts
		}
	}

	// 5b3. Generate distribution maps from aggregates and TopN data.
	dashboard.Distribution = generateDistribution(dashboard, parseResult)

	// 5c. Run anomaly detection on parsed dashboard data.
	var anomalies []Anomaly
	if p.anomaly != nil {
		anomalies = p.detectAnomalies(ctx, jobID, tenantID, dashboard)
		if len(anomalies) > 0 {
			logger.Info("anomaly detection complete",
				"total_anomalies", len(anomalies),
			)
		}
	}

	// 5d. Cache dashboard and section data in Redis.
	if p.redis != nil {
		sectionTTL := 24 * time.Hour
		cachePrefix := p.redis.TenantKey(tenantID, "dashboard", jobID)

		// Cache the full dashboard data (used by GET /analysis/{job_id}/dashboard).
		if err := p.redis.Set(ctx, cachePrefix, dashboard, sectionTTL); err != nil {
			logger.Warn("redis cache set failed", "section", "dashboard", "error", err)
		}

		// Cache individual sections for lazy-loaded dashboard endpoints.
		// Prefer JAR-native data over computed data when available.

		// Aggregates: JAR-native (6 grouping dimensions) or computed fallback.
		if parseResult.JARAggregates != nil {
			if err := p.redis.Set(ctx, cachePrefix+":agg", parseResult.JARAggregates, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "agg", "error", err)
			}
		} else if parseResult.Aggregates != nil {
			if err := p.redis.Set(ctx, cachePrefix+":agg", parseResult.Aggregates, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "agg", "error", err)
			}
		}

		// Exceptions: JAR-native (API errors + exceptions) or computed fallback.
		if parseResult.JARExceptions != nil {
			if err := p.redis.Set(ctx, cachePrefix+":exc", parseResult.JARExceptions, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "exc", "error", err)
			}
		} else if parseResult.Exceptions != nil {
			if err := p.redis.Set(ctx, cachePrefix+":exc", parseResult.Exceptions, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "exc", "error", err)
			}
		}

		// Gaps: JAR-native (line + thread gaps) or computed fallback.
		if parseResult.JARGaps != nil {
			if err := p.redis.Set(ctx, cachePrefix+":gaps", parseResult.JARGaps, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "gaps", "error", err)
			}
		} else if parseResult.Gaps != nil {
			if err := p.redis.Set(ctx, cachePrefix+":gaps", parseResult.Gaps, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "gaps", "error", err)
			}
		}

		// Thread stats: JAR-native (per-queue, with busy%) or computed fallback.
		if parseResult.JARThreadStats != nil {
			if err := p.redis.Set(ctx, cachePrefix+":threads", parseResult.JARThreadStats, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "threads", "error", err)
			}
		} else if parseResult.ThreadStats != nil {
			if err := p.redis.Set(ctx, cachePrefix+":threads", parseResult.ThreadStats, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "threads", "error", err)
			}
		}

		// Filters: JAR-native (5 sub-sections) or computed fallback.
		if parseResult.JARFilters != nil {
			if err := p.redis.Set(ctx, cachePrefix+":filters", parseResult.JARFilters, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "filters", "error", err)
			}
		} else if parseResult.Filters != nil {
			if err := p.redis.Set(ctx, cachePrefix+":filters", parseResult.Filters, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "filters", "error", err)
			}
		}

		// Queued API calls: supplementary data from JAR output.
		if len(parseResult.QueuedAPICalls) > 0 {
			resp := domain.QueuedCallsResponse{
				JobID:          jobID,
				QueuedAPICalls: parseResult.QueuedAPICalls,
				Total:          len(parseResult.QueuedAPICalls),
			}
			if err := p.redis.Set(ctx, cachePrefix+":queued", resp, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "queued", "error", err)
			}
		}

		// Logging activities: parsed from JAR output.
		if len(parseResult.LoggingActivities) > 0 {
			resp := domain.LoggingActivityResponse{
				JobID:      jobID,
				Activities: parseResult.LoggingActivities,
			}
			if err := p.redis.Set(ctx, cachePrefix+":logging-activity", resp, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "logging-activity", "error", err)
			}
		}

		// File metadata: parsed from JAR output.
		if len(parseResult.FileMetadataList) > 0 {
			resp := domain.FileMetadataResponse{
				JobID: jobID,
				Files: parseResult.FileMetadataList,
				Total: len(parseResult.FileMetadataList),
			}
			if err := p.redis.Set(ctx, cachePrefix+":file-metadata", resp, sectionTTL); err != nil {
				logger.Warn("redis cache set failed", "section", "file-metadata", "error", err)
			}
		}
	}

	// 6. Update status to storing.
	if err := p.pg.UpdateJobStatus(ctx, job.TenantID, job.ID, domain.JobStatusStoring, nil); err != nil {
		logger.Error("failed to update status to storing", "error", err)
	}
	_ = p.nats.PublishJobProgress(ctx, tenantID, jobID, 85, string(domain.JobStatusStoring), "storing results")

	// 7. Parse raw log file and store individual entries in ClickHouse.
	count, parseErr := logparser.ParseFile(ctx, tmpFile.Name(), tenantID, jobID, 5000, func(batch []domain.LogEntry) error {
		return p.ch.BatchInsertEntries(ctx, batch)
	})
	if parseErr != nil {
		logger.Error("log entry ingestion failed (non-fatal)", "error", parseErr, "entries_parsed", count)
	} else {
		logger.Info("log entry ingestion complete", "entries_inserted", count)
	}
	_ = p.nats.PublishJobProgress(ctx, tenantID, jobID, 95, string(domain.JobStatusStoring), "log entries indexed")

	// 8. Update job with completion stats.
	now := time.Now().UTC()
	if err := p.pg.UpdateJobStatus(ctx, job.TenantID, job.ID, domain.JobStatusComplete, nil); err != nil {
		// Failed to mark as complete - mark as failed to prevent inconsistent state
		errMsg := fmt.Sprintf("failed to update job to complete status: %v", err)
		_ = p.pg.UpdateJobStatus(ctx, job.TenantID, job.ID, domain.JobStatusFailed, &errMsg)
		_ = p.nats.PublishJobProgress(ctx, tenantID, jobID, 0, string(domain.JobStatusFailed), errMsg)
		return fmt.Errorf("update status to complete: %w", err)
	}
	if err := p.pg.UpdateJobProgress(ctx, job.TenantID, job.ID, 100, &dashboard.GeneralStats.TotalLines); err != nil {
		logger.Error("failed to update job progress to 100%%", "error", err)
		// Non-fatal: job status is already Complete, only progress percentage failed
	}

	// 8b. Log anomaly detection results (no progress update since job is already complete).
	if len(anomalies) > 0 {
		logger.Info("anomaly detection results", "count", len(anomalies))
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
