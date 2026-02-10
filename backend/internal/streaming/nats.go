package streaming

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

// JobProgress represents a progress update for an analysis job.
type JobProgress struct {
	JobID          string `json:"job_id"`
	Status         string `json:"status"`
	ProgressPct    int    `json:"progress_pct"`
	ProcessedLines int64  `json:"processed_lines"`
	TotalLines     int64  `json:"total_lines"`
	Message        string `json:"message"`
}

// NATSClient wraps a NATS connection with JetStream support for
// tenant-scoped publish/subscribe on job lifecycle and live-tail subjects.
type NATSClient struct {
	conn   *nats.Conn
	js     jetstream.JetStream
	logger *slog.Logger
}

// NewNATSClient connects to a NATS server and enables JetStream.
func NewNATSClient(url string) (*NATSClient, error) {
	logger := slog.Default().With("component", "nats")

	opts := []nats.Option{
		nats.Name("remedyiq"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2 * time.Second),
		nats.DisconnectErrHandler(func(_ *nats.Conn, err error) {
			if err != nil {
				logger.Warn("NATS disconnected", "error", err)
			}
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			logger.Info("NATS reconnected", "url", nc.ConnectedUrl())
		}),
	}

	nc, err := nats.Connect(url, opts...)
	if err != nil {
		return nil, fmt.Errorf("nats connect: %w", err)
	}

	js, err := jetstream.New(nc)
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("jetstream init: %w", err)
	}

	return &NATSClient{
		conn:   nc,
		js:     js,
		logger: logger,
	}, nil
}

// Close drains the connection (flushes pending messages) and disconnects.
func (c *NATSClient) Close() {
	if c.conn != nil {
		_ = c.conn.Drain()
	}
}

// EnsureStreams creates the required JetStream streams if they do not already
// exist. Two streams are provisioned:
//
//	JOBS  -- captures job lifecycle events (submit, progress, complete)
//	EVENTS -- captures live tail log entries
func (c *NATSClient) EnsureStreams(ctx context.Context) error {
	jobsCfg := jetstream.StreamConfig{
		Name:        "JOBS",
		Description: "Job lifecycle events (submit, progress, complete)",
		Subjects:    []string{"jobs.>"},
		Retention:   jetstream.WorkQueuePolicy,
		MaxAge:      24 * time.Hour,
		Storage:     jetstream.FileStorage,
		Replicas:    1,
		Discard:     jetstream.DiscardOld,
		MaxBytes:    1 * 1024 * 1024 * 1024, // 1 GB
	}

	eventsCfg := jetstream.StreamConfig{
		Name:        "EVENTS",
		Description: "Live tail log entries and other real-time events",
		Subjects:    []string{"logs.>", "ai.>"},
		Retention:   jetstream.InterestPolicy,
		MaxAge:      1 * time.Hour,
		Storage:     jetstream.FileStorage,
		Replicas:    1,
		Discard:     jetstream.DiscardOld,
		MaxBytes:    512 * 1024 * 1024, // 512 MB
	}

	for _, cfg := range []jetstream.StreamConfig{jobsCfg, eventsCfg} {
		_, err := c.js.CreateOrUpdateStream(ctx, cfg)
		if err != nil {
			return fmt.Errorf("ensure stream %s: %w", cfg.Name, err)
		}
		c.logger.Info("JetStream stream ready", "stream", cfg.Name)
	}

	return nil
}

// ---------------------------------------------------------------------------
// Subject helpers
// ---------------------------------------------------------------------------

func subjectJobSubmit(tenantID string) string {
	return fmt.Sprintf("jobs.%s.submit", tenantID)
}

func subjectJobProgress(tenantID string) string {
	return fmt.Sprintf("jobs.%s.progress", tenantID)
}

func subjectJobComplete(tenantID string) string {
	return fmt.Sprintf("jobs.%s.complete", tenantID)
}

func subjectLiveTail(tenantID, logType string) string {
	return fmt.Sprintf("logs.%s.tail.%s", tenantID, logType)
}

// ---------------------------------------------------------------------------
// Publish helpers
// ---------------------------------------------------------------------------

func (c *NATSClient) publish(ctx context.Context, subject string, v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("marshal for %s: %w", subject, err)
	}

	_, err = c.js.Publish(ctx, subject, data)
	if err != nil {
		return fmt.Errorf("publish to %s: %w", subject, err)
	}

	c.logger.Debug("published message", "subject", subject, "bytes", len(data))
	return nil
}

// ---------------------------------------------------------------------------
// Job lifecycle publishers
// ---------------------------------------------------------------------------

// PublishJobSubmit publishes a new job submission event.
func (c *NATSClient) PublishJobSubmit(ctx context.Context, tenantID string, job domain.AnalysisJob) error {
	return c.publish(ctx, subjectJobSubmit(tenantID), job)
}

// PublishJobProgress publishes a job progress update.
func (c *NATSClient) PublishJobProgress(ctx context.Context, tenantID string, jobID string, progress int, status string, message string) error {
	p := JobProgress{
		JobID:       jobID,
		Status:      status,
		ProgressPct: progress,
		Message:     message,
	}
	return c.publish(ctx, subjectJobProgress(tenantID), p)
}

// PublishJobComplete publishes a job completion event.
func (c *NATSClient) PublishJobComplete(ctx context.Context, tenantID string, jobID string, result domain.AnalysisJob) error {
	return c.publish(ctx, subjectJobComplete(tenantID), result)
}

// ---------------------------------------------------------------------------
// Live tail publishers
// ---------------------------------------------------------------------------

// PublishLiveTailEntry publishes a single log entry for real-time tailing.
func (c *NATSClient) PublishLiveTailEntry(ctx context.Context, tenantID string, logType string, entry domain.LogEntry) error {
	return c.publish(ctx, subjectLiveTail(tenantID, logType), entry)
}

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

// SubscribeJobSubmit creates a durable consumer for job submission events
// scoped to the given tenant. The handler is invoked for each message; the
// message is acknowledged automatically after the handler returns without
// panic.
func (c *NATSClient) SubscribeJobSubmit(ctx context.Context, tenantID string, handler func(domain.AnalysisJob)) error {
	subject := subjectJobSubmit(tenantID)
	durableName := fmt.Sprintf("job-submit-%s", tenantID)

	cons, err := c.js.CreateOrUpdateConsumer(ctx, "JOBS", jetstream.ConsumerConfig{
		Durable:       durableName,
		FilterSubject: subject,
		AckPolicy:     jetstream.AckExplicitPolicy,
		DeliverPolicy: jetstream.DeliverNewPolicy,
		MaxDeliver:    5,
		AckWait:       30 * time.Second,
	})
	if err != nil {
		return fmt.Errorf("create consumer %s: %w", durableName, err)
	}

	_, err = cons.Consume(func(msg jetstream.Msg) {
		var job domain.AnalysisJob
		if err := json.Unmarshal(msg.Data(), &job); err != nil {
			c.logger.Error("unmarshal job submit", "error", err, "subject", subject)
			// Terminal ack to avoid redelivery of malformed messages.
			_ = msg.TermWithReason("unmarshal error")
			return
		}
		handler(job)
		if err := msg.Ack(); err != nil {
			c.logger.Error("ack job submit", "error", err, "subject", subject)
		}
	})
	if err != nil {
		return fmt.Errorf("consume %s: %w", durableName, err)
	}

	c.logger.Info("subscribed to job submit", "tenant", tenantID, "durable", durableName)
	return nil
}

// SubscribeJobProgress creates a durable consumer for job progress events
// scoped to the given tenant.
func (c *NATSClient) SubscribeJobProgress(ctx context.Context, tenantID string, handler func(JobProgress)) error {
	subject := subjectJobProgress(tenantID)
	durableName := fmt.Sprintf("job-progress-%s", tenantID)

	cons, err := c.js.CreateOrUpdateConsumer(ctx, "JOBS", jetstream.ConsumerConfig{
		Durable:       durableName,
		FilterSubject: subject,
		AckPolicy:     jetstream.AckExplicitPolicy,
		DeliverPolicy: jetstream.DeliverNewPolicy,
		MaxDeliver:    3,
		AckWait:       10 * time.Second,
	})
	if err != nil {
		return fmt.Errorf("create consumer %s: %w", durableName, err)
	}

	_, err = cons.Consume(func(msg jetstream.Msg) {
		var p JobProgress
		if err := json.Unmarshal(msg.Data(), &p); err != nil {
			c.logger.Error("unmarshal job progress", "error", err, "subject", subject)
			_ = msg.TermWithReason("unmarshal error")
			return
		}
		handler(p)
		if err := msg.Ack(); err != nil {
			c.logger.Error("ack job progress", "error", err, "subject", subject)
		}
	})
	if err != nil {
		return fmt.Errorf("consume %s: %w", durableName, err)
	}

	c.logger.Info("subscribed to job progress", "tenant", tenantID, "durable", durableName)
	return nil
}

// SubscribeLiveTail subscribes to real-time log entries for the given tenant
// and log type. This uses an ephemeral (non-durable) consumer since live tail
// data is transient.
func (c *NATSClient) SubscribeLiveTail(ctx context.Context, tenantID string, logType string, handler func(domain.LogEntry)) error {
	subject := subjectLiveTail(tenantID, logType)

	cons, err := c.js.CreateOrUpdateConsumer(ctx, "EVENTS", jetstream.ConsumerConfig{
		FilterSubject: subject,
		AckPolicy:     jetstream.AckNonePolicy,
		DeliverPolicy: jetstream.DeliverNewPolicy,
		InactiveThreshold: 5 * time.Minute,
	})
	if err != nil {
		return fmt.Errorf("create ephemeral consumer for %s: %w", subject, err)
	}

	_, err = cons.Consume(func(msg jetstream.Msg) {
		var entry domain.LogEntry
		if err := json.Unmarshal(msg.Data(), &entry); err != nil {
			c.logger.Error("unmarshal live tail entry", "error", err, "subject", subject)
			return
		}
		handler(entry)
	})
	if err != nil {
		return fmt.Errorf("consume live tail %s: %w", subject, err)
	}

	c.logger.Info("subscribed to live tail", "tenant", tenantID, "log_type", logType)
	return nil
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

// Ping verifies the NATS connection is alive and JetStream is available.
func (c *NATSClient) Ping() error {
	if !c.conn.IsConnected() {
		return fmt.Errorf("nats: not connected")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := c.js.AccountInfo(ctx)
	if err != nil {
		return fmt.Errorf("nats jetstream ping: %w", err)
	}

	return nil
}
