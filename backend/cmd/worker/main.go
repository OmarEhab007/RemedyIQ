package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/config"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/jar"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/worker"
)

func main() {
	// Load .env file if present (development convenience).
	_ = godotenv.Load()             // backend/.env
	_ = godotenv.Load("../.env")    // running from backend/ -> project root .env
	_ = godotenv.Load("../../.env") // running from backend/cmd/*/ -> project root .env

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	setupLogger(cfg.LogLevel)
	slog.Info("starting RemedyIQ Worker", "env", cfg.Environment)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// --- Initialize storage clients ---
	pg, err := storage.NewPostgresClient(ctx, cfg.PostgresURL)
	if err != nil {
		slog.Error("failed to connect to PostgreSQL", "error", err)
		os.Exit(1)
	}
	defer pg.Close()

	ch, err := storage.NewClickHouseClient(ctx, cfg.ClickHouseURL)
	if err != nil {
		slog.Error("failed to connect to ClickHouse", "error", err)
		os.Exit(1)
	}
	defer ch.Close()

	natsClient, err := streaming.NewNATSClient(cfg.NATSURL)
	if err != nil {
		slog.Error("failed to connect to NATS", "error", err)
		os.Exit(1)
	}
	defer natsClient.Close()

	if err := natsClient.EnsureStreams(ctx); err != nil {
		slog.Error("failed to ensure NATS streams", "error", err)
		os.Exit(1)
	}

	redis, err := storage.NewRedisClient(ctx, cfg.RedisURL)
	if err != nil {
		slog.Error("failed to connect to Redis", "error", err)
		os.Exit(1)
	}
	defer redis.Close()

	s3Client, err := storage.NewS3Client(ctx, cfg.S3Endpoint, cfg.S3AccessKey, cfg.S3SecretKey, cfg.S3Bucket, cfg.S3UseSSL, cfg.S3SkipBucketVerification)
	if err != nil {
		slog.Error("failed to connect to S3/MinIO", "error", err)
		os.Exit(1)
	}

	// --- Initialize JAR runner ---
	jarRunner := jar.NewRunner(cfg.JARPath, cfg.JARDefaultHeapMB, cfg.JARTimeoutSec)

	slog.Info("worker initialized",
		"jar_path", cfg.JARPath,
		"heap_mb", cfg.JARDefaultHeapMB,
		"timeout_sec", cfg.JARTimeoutSec,
	)

	// --- Build ingestion pipeline ---
	anomalyDetector := worker.NewAnomalyDetector(3.0)
	pipeline := worker.NewPipeline(pg, ch, s3Client, redis, natsClient, jarRunner, anomalyDetector)

	// --- Subscribe to NATS job queue (all tenants) ---
	err = natsClient.SubscribeAllJobSubmits(ctx, func(job domain.AnalysisJob) {
		logger := slog.With("job_id", job.ID.String(), "tenant_id", job.TenantID.String())
		logger.Info("received job submission", "file_id", job.FileID.String())

		jobCtx, jobCancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer jobCancel()

		if err := pipeline.ProcessJob(jobCtx, job); err != nil {
			logger.Error("job processing failed", "error", err)
			return
		}
		logger.Info("job processing completed")
	})
	if err != nil {
		slog.Error("failed to subscribe to job queue", "error", err)
		os.Exit(1)
	}

	slog.Info("worker ready, listening for jobs on NATS")

	// --- Wait for shutdown signal ---
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh

	slog.Info("received shutdown signal, draining...", "signal", sig)
	cancel()
	slog.Info("RemedyIQ Worker stopped")
}

func setupLogger(level string) {
	var logLevel slog.Level
	switch level {
	case "debug":
		logLevel = slog.LevelDebug
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	default:
		logLevel = slog.LevelInfo
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	})))
}
