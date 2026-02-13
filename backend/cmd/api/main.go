package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/handlers"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/config"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/streaming"
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
	slog.Info("starting RemedyIQ API server", "port", cfg.APIPort, "env", cfg.Environment)

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

	// S3 is non-critical at startup — log and continue if unavailable.
	s3Client, err := storage.NewS3Client(ctx, cfg.S3Endpoint, cfg.S3AccessKey, cfg.S3SecretKey, cfg.S3Bucket, cfg.S3UseSSL, cfg.S3SkipBucketVerification)
	if err != nil {
		slog.Warn("S3 client initialization failed; file uploads will not work", "error", err)
	}
	// --- WebSocket hub ---
	wsHub := streaming.NewHub()
	go wsHub.Run()

	// --- Build handlers ---
	healthHandler := handlers.NewHealthHandler(
		pg.Ping,
		ch.Ping,
		func(ctx context.Context) error { return natsClient.Ping() },
		redis.Ping,
	)

	uploadHandler := handlers.NewUploadHandler(pg, s3Client)
	fileHandlers := handlers.NewFileHandlers(pg)
	analysisHandlers := handlers.NewAnalysisHandlers(pg, natsClient)
	dashboardHandler := handlers.NewDashboardHandler(pg, ch, redis)
	streamHandler := handlers.NewStreamHandler(wsHub, []string{"*"})

	// --- Build router ---
	router := api.NewRouter(api.RouterConfig{
		AllowedOrigins:        []string{"*"},
		DevMode:               cfg.IsDevelopment(),
		ClerkSecretKey:        cfg.ClerkSecretKey,
		HealthHandler:         healthHandler,
		UploadFileHandler:     uploadHandler,
		ListFilesHandler:      fileHandlers.ListFiles(),
		CreateAnalysisHandler: analysisHandlers.CreateAnalysis(),
		ListAnalysesHandler:   analysisHandlers.ListAnalyses(),
		GetAnalysisHandler:    analysisHandlers.GetAnalysis(),
		GetDashboardHandler:   dashboardHandler,
		AggregatesHandler:     handlers.NewAggregatesHandler(pg, ch, redis),
		ExceptionsHandler:     handlers.NewExceptionsHandler(pg, ch, redis),
		GapsHandler:           handlers.NewGapsHandler(pg, ch, redis),
		ThreadsHandler:        handlers.NewThreadsHandler(pg, ch, redis),
		FiltersHandler:        handlers.NewFiltersHandler(pg, ch, redis),
		WSHandler:             streamHandler,
		// SearchLogsHandler, GetLogEntryHandler, GetTraceHandler, QueryAIHandler,
		// GenerateReportHandler require BleveManager/AI Registry — added later.
	})

	// --- Start HTTP server ---
	srv := &http.Server{
		Addr:         ":" + cfg.APIPort,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("HTTP server listening", "addr", srv.Addr)
		errCh <- srv.ListenAndServe()
	}()

	// --- Graceful shutdown ---
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		slog.Info("received shutdown signal", "signal", sig)
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
		}
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server shutdown error", "error", err)
	}

	slog.Info("RemedyIQ API server stopped")
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
