package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/config"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/jar"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
)

func main() {
	// Load .env file if present (development convenience).
	_ = godotenv.Load()

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

	s3Client, err := storage.NewS3Client(ctx, cfg.S3Endpoint, cfg.S3AccessKey, cfg.S3SecretKey, cfg.S3Bucket, cfg.S3UseSSL)
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

	// Keep references alive for future phases — these will be wired into
	// the ingestion pipeline (T035) and job processor (T036).
	_ = pg
	_ = ch
	_ = natsClient
	_ = redis
	_ = s3Client
	_ = jarRunner

	// --- Wait for shutdown signal ---
	// In Phase 3 (T035-T036), this section will subscribe to the NATS job
	// queue and start the processing loop. For now, the worker starts up,
	// validates all connections, and waits for a signal.
	slog.Info("worker ready, waiting for jobs (job processing will be enabled in Phase 3)")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh

	slog.Info("received shutdown signal", "signal", sig)
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
