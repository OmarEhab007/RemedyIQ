package storage

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

// IsNotFound returns true if the error indicates a record was not found.
// This checks for both pgx.ErrNoRows and the "not found" error strings
// produced by this package's query methods.
func IsNotFound(err error) bool {
	if err == nil {
		return false
	}
	if err == pgx.ErrNoRows {
		return true
	}
	return strings.Contains(err.Error(), "not found")
}

// PostgresClient wraps a pgx connection pool and provides CRUD operations
// for all relational data managed in PostgreSQL.
type PostgresClient struct {
	pool *pgxpool.Pool
}

// NewPostgresClient creates a new PostgreSQL client from the given DSN.
func NewPostgresClient(ctx context.Context, dsn string) (*PostgresClient, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("postgres: parse config: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("postgres: connect: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres: ping: %w", err)
	}

	return &PostgresClient{pool: pool}, nil
}

// Close releases all connections in the pool.
func (p *PostgresClient) Close() {
	p.pool.Close()
}

// Ping verifies connectivity to PostgreSQL.
func (p *PostgresClient) Ping(ctx context.Context) error {
	return p.pool.Ping(ctx)
}

// SetTenantContext sets the app.tenant_id session variable used by
// Row-Level Security policies. The third parameter to set_config is true,
// meaning the setting is transaction-local and will be reset when the
// transaction ends. Callers should use this within a transaction to
// prevent the tenant context from leaking to other users of the pooled
// connection.
//
// The tenantID is validated as a UUID to prevent injection and then set
// via a parameterized call to set_config().
func (p *PostgresClient) SetTenantContext(ctx context.Context, tenantID string) error {
	if _, err := uuid.Parse(tenantID); err != nil {
		return fmt.Errorf("postgres: invalid tenant ID format: %w", err)
	}
	_, err := p.pool.Exec(ctx, "SELECT set_config('app.tenant_id', $1, true)", tenantID)
	if err != nil {
		return fmt.Errorf("postgres: set tenant context: %w", err)
	}
	return nil
}

// --------------------------------------------------------------------------
// Tenants
// --------------------------------------------------------------------------

// CreateTenant inserts a new tenant row.
func (p *PostgresClient) CreateTenant(ctx context.Context, t *domain.Tenant) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	now := time.Now().UTC()
	t.CreatedAt = now
	t.UpdatedAt = now

	_, err := p.pool.Exec(ctx, `
		INSERT INTO tenants (id, clerk_org_id, name, plan, storage_limit_gb, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, t.ID, t.ClerkOrgID, t.Name, t.Plan, t.StorageLimitGB, t.CreatedAt, t.UpdatedAt)
	if err != nil {
		return fmt.Errorf("postgres: create tenant: %w", err)
	}
	return nil
}

// GetTenant fetches a tenant by its primary key.
func (p *PostgresClient) GetTenant(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	var t domain.Tenant
	err := p.pool.QueryRow(ctx, `
		SELECT id, clerk_org_id, name, plan, storage_limit_gb, created_at, updated_at
		FROM tenants WHERE id = $1
	`, id).Scan(&t.ID, &t.ClerkOrgID, &t.Name, &t.Plan, &t.StorageLimitGB, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("postgres: tenant not found: %s", id)
		}
		return nil, fmt.Errorf("postgres: get tenant: %w", err)
	}
	return &t, nil
}

// GetTenantByClerkOrg looks up a tenant by its Clerk organization ID.
func (p *PostgresClient) GetTenantByClerkOrg(ctx context.Context, clerkOrgID string) (*domain.Tenant, error) {
	var t domain.Tenant
	err := p.pool.QueryRow(ctx, `
		SELECT id, clerk_org_id, name, plan, storage_limit_gb, created_at, updated_at
		FROM tenants WHERE clerk_org_id = $1
	`, clerkOrgID).Scan(&t.ID, &t.ClerkOrgID, &t.Name, &t.Plan, &t.StorageLimitGB, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("postgres: tenant not found for clerk org: %s", clerkOrgID)
		}
		return nil, fmt.Errorf("postgres: get tenant by clerk org: %w", err)
	}
	return &t, nil
}

// --------------------------------------------------------------------------
// Log Files
// --------------------------------------------------------------------------

// CreateLogFile inserts a new log file record.
func (p *PostgresClient) CreateLogFile(ctx context.Context, f *domain.LogFile) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	f.UploadedAt = time.Now().UTC()

	_, err := p.pool.Exec(ctx, `
		INSERT INTO log_files (
			id, tenant_id, filename, size_bytes, s3_key, s3_bucket,
			content_type, detected_types, checksum_sha256, uploaded_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, f.ID, f.TenantID, f.Filename, f.SizeBytes, f.S3Key, f.S3Bucket,
		f.ContentType, f.DetectedTypes, f.ChecksumSHA256, f.UploadedAt)
	if err != nil {
		return fmt.Errorf("postgres: create log file: %w", err)
	}
	return nil
}

// GetLogFile retrieves a log file by its ID within a tenant.
func (p *PostgresClient) GetLogFile(ctx context.Context, tenantID, fileID uuid.UUID) (*domain.LogFile, error) {
	var f domain.LogFile
	err := p.pool.QueryRow(ctx, `
		SELECT id, tenant_id, filename, size_bytes, s3_key, s3_bucket,
		       content_type, detected_types, checksum_sha256, uploaded_at
		FROM log_files
		WHERE id = $1 AND tenant_id = $2
	`, fileID, tenantID).Scan(
		&f.ID, &f.TenantID, &f.Filename, &f.SizeBytes, &f.S3Key, &f.S3Bucket,
		&f.ContentType, &f.DetectedTypes, &f.ChecksumSHA256, &f.UploadedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("postgres: log file not found: %s", fileID)
		}
		return nil, fmt.Errorf("postgres: get log file: %w", err)
	}
	return &f, nil
}

// ListLogFiles returns all log files for a tenant, ordered by upload date descending.
func (p *PostgresClient) ListLogFiles(ctx context.Context, tenantID uuid.UUID) ([]domain.LogFile, error) {
	rows, err := p.pool.Query(ctx, `
		SELECT id, tenant_id, filename, size_bytes, s3_key, s3_bucket,
		       content_type, detected_types, checksum_sha256, uploaded_at
		FROM log_files
		WHERE tenant_id = $1
		ORDER BY uploaded_at DESC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("postgres: list log files: %w", err)
	}
	defer rows.Close()

	var files []domain.LogFile
	for rows.Next() {
		var f domain.LogFile
		if err := rows.Scan(
			&f.ID, &f.TenantID, &f.Filename, &f.SizeBytes, &f.S3Key, &f.S3Bucket,
			&f.ContentType, &f.DetectedTypes, &f.ChecksumSHA256, &f.UploadedAt,
		); err != nil {
			return nil, fmt.Errorf("postgres: scan log file: %w", err)
		}
		files = append(files, f)
	}
	return files, rows.Err()
}

// --------------------------------------------------------------------------
// Analysis Jobs
// --------------------------------------------------------------------------

// CreateJob inserts a new analysis job.
func (p *PostgresClient) CreateJob(ctx context.Context, j *domain.AnalysisJob) error {
	if j.ID == uuid.Nil {
		j.ID = uuid.New()
	}
	now := time.Now().UTC()
	j.CreatedAt = now
	j.UpdatedAt = now

	_, err := p.pool.Exec(ctx, `
		INSERT INTO analysis_jobs (
			id, tenant_id, status, file_id, jar_flags, jvm_heap_mb,
			timeout_seconds, progress_pct, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, j.ID, j.TenantID, j.Status, j.FileID, j.JARFlags, j.JVMHeapMB,
		j.TimeoutSeconds, j.ProgressPct, j.CreatedAt, j.UpdatedAt)
	if err != nil {
		return fmt.Errorf("postgres: create job: %w", err)
	}
	return nil
}

// GetJob retrieves an analysis job by its ID within a tenant.
func (p *PostgresClient) GetJob(ctx context.Context, tenantID, jobID uuid.UUID) (*domain.AnalysisJob, error) {
	var j domain.AnalysisJob
	err := p.pool.QueryRow(ctx, `
		SELECT
			id, tenant_id, status, file_id, jar_flags, jvm_heap_mb,
			timeout_seconds, progress_pct,
			total_lines, processed_lines,
			api_count, sql_count, filter_count, esc_count,
			start_time, end_time, log_start, log_end, log_duration,
			error_message, jar_stderr,
			created_at, updated_at, completed_at
		FROM analysis_jobs
		WHERE id = $1 AND tenant_id = $2
	`, jobID, tenantID).Scan(
		&j.ID, &j.TenantID, &j.Status, &j.FileID, &j.JARFlags, &j.JVMHeapMB,
		&j.TimeoutSeconds, &j.ProgressPct,
		&j.TotalLines, &j.ProcessedLines,
		&j.APICount, &j.SQLCount, &j.FilterCount, &j.EscCount,
		&j.StartTime, &j.EndTime, &j.LogStart, &j.LogEnd, &j.LogDuration,
		&j.ErrorMessage, &j.JARStderr,
		&j.CreatedAt, &j.UpdatedAt, &j.CompletedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("postgres: job not found: %s", jobID)
		}
		return nil, fmt.Errorf("postgres: get job: %w", err)
	}
	return &j, nil
}

// UpdateJobStatus transitions a job to a new status, updating the timestamp.
// If the new status is "complete" or "failed", CompletedAt is also set.
func (p *PostgresClient) UpdateJobStatus(ctx context.Context, tenantID, jobID uuid.UUID, status domain.JobStatus, errMsg *string) error {
	now := time.Now().UTC()
	var completedAt *time.Time
	if status == domain.JobStatusComplete || status == domain.JobStatusFailed {
		completedAt = &now
	}

	tag, err := p.pool.Exec(ctx, `
		UPDATE analysis_jobs
		SET status = $1, error_message = $2, updated_at = $3, completed_at = $4
		WHERE id = $5 AND tenant_id = $6
	`, status, errMsg, now, completedAt, jobID, tenantID)
	if err != nil {
		return fmt.Errorf("postgres: update job status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("postgres: job not found: %s", jobID)
	}
	return nil
}

// UpdateJobProgress updates the progress percentage and line counters for a job.
func (p *PostgresClient) UpdateJobProgress(ctx context.Context, tenantID, jobID uuid.UUID, progressPct int, processedLines *int64) error {
	now := time.Now().UTC()
	tag, err := p.pool.Exec(ctx, `
		UPDATE analysis_jobs
		SET progress_pct = $1, processed_lines = $2, updated_at = $3
		WHERE id = $4 AND tenant_id = $5
	`, progressPct, processedLines, now, jobID, tenantID)
	if err != nil {
		return fmt.Errorf("postgres: update job progress: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("postgres: job not found: %s", jobID)
	}
	return nil
}

// ListJobs returns all analysis jobs for a tenant, ordered by creation date descending.
func (p *PostgresClient) ListJobs(ctx context.Context, tenantID uuid.UUID) ([]domain.AnalysisJob, error) {
	rows, err := p.pool.Query(ctx, `
		SELECT
			id, tenant_id, status, file_id, jar_flags, jvm_heap_mb,
			timeout_seconds, progress_pct,
			total_lines, processed_lines,
			api_count, sql_count, filter_count, esc_count,
			start_time, end_time, log_start, log_end, log_duration,
			error_message, jar_stderr,
			created_at, updated_at, completed_at
		FROM analysis_jobs
		WHERE tenant_id = $1
		ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("postgres: list jobs: %w", err)
	}
	defer rows.Close()

	var jobs []domain.AnalysisJob
	for rows.Next() {
		var j domain.AnalysisJob
		if err := rows.Scan(
			&j.ID, &j.TenantID, &j.Status, &j.FileID, &j.JARFlags, &j.JVMHeapMB,
			&j.TimeoutSeconds, &j.ProgressPct,
			&j.TotalLines, &j.ProcessedLines,
			&j.APICount, &j.SQLCount, &j.FilterCount, &j.EscCount,
			&j.StartTime, &j.EndTime, &j.LogStart, &j.LogEnd, &j.LogDuration,
			&j.ErrorMessage, &j.JARStderr,
			&j.CreatedAt, &j.UpdatedAt, &j.CompletedAt,
		); err != nil {
			return nil, fmt.Errorf("postgres: scan job: %w", err)
		}
		jobs = append(jobs, j)
	}
	return jobs, rows.Err()
}

// --------------------------------------------------------------------------
// AI Interactions
// --------------------------------------------------------------------------

// CreateAIInteraction inserts a new AI interaction record.
func (p *PostgresClient) CreateAIInteraction(ctx context.Context, ai *domain.AIInteraction) error {
	if ai.ID == uuid.Nil {
		ai.ID = uuid.New()
	}
	ai.CreatedAt = time.Now().UTC()

	_, err := p.pool.Exec(ctx, `
		INSERT INTO ai_interactions (
			id, tenant_id, job_id, user_id, skill_name,
			input_text, output_text, referenced_lines,
			tokens_used, latency_ms, status, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, ai.ID, ai.TenantID, ai.JobID, ai.UserID, ai.SkillName,
		ai.InputText, ai.OutputText, ai.ReferencedLines,
		ai.TokensUsed, ai.LatencyMS, ai.Status, ai.CreatedAt)
	if err != nil {
		return fmt.Errorf("postgres: create ai interaction: %w", err)
	}
	return nil
}

// UpdateAIInteraction updates the output fields of an AI interaction after
// the AI skill completes.
func (p *PostgresClient) UpdateAIInteraction(ctx context.Context, tenantID, interactionID uuid.UUID, outputText *string, tokensUsed *int, latencyMS *int, status string) error {
	tag, err := p.pool.Exec(ctx, `
		UPDATE ai_interactions
		SET output_text = $1, tokens_used = $2, latency_ms = $3, status = $4
		WHERE id = $5 AND tenant_id = $6
	`, outputText, tokensUsed, latencyMS, status, interactionID, tenantID)
	if err != nil {
		return fmt.Errorf("postgres: update ai interaction: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("postgres: ai interaction not found: %s", interactionID)
	}
	return nil
}

// --------------------------------------------------------------------------
// Saved Searches
// --------------------------------------------------------------------------

// CreateSavedSearch inserts a new saved search.
func (p *PostgresClient) CreateSavedSearch(ctx context.Context, s *domain.SavedSearch) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	s.CreatedAt = time.Now().UTC()

	_, err := p.pool.Exec(ctx, `
		INSERT INTO saved_searches (id, tenant_id, user_id, name, kql_query, filters, is_pinned, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, s.ID, s.TenantID, s.UserID, s.Name, s.KQLQuery, s.Filters, s.IsPinned, s.CreatedAt)
	if err != nil {
		return fmt.Errorf("postgres: create saved search: %w", err)
	}
	return nil
}

// ListSavedSearches returns all saved searches for a tenant and user.
func (p *PostgresClient) ListSavedSearches(ctx context.Context, tenantID uuid.UUID, userID string) ([]domain.SavedSearch, error) {
	rows, err := p.pool.Query(ctx, `
		SELECT id, tenant_id, user_id, name, kql_query, filters, is_pinned, created_at
		FROM saved_searches
		WHERE tenant_id = $1 AND user_id = $2
		ORDER BY is_pinned DESC, created_at DESC
	`, tenantID, userID)
	if err != nil {
		return nil, fmt.Errorf("postgres: list saved searches: %w", err)
	}
	defer rows.Close()

	var searches []domain.SavedSearch
	for rows.Next() {
		var s domain.SavedSearch
		if err := rows.Scan(
			&s.ID, &s.TenantID, &s.UserID, &s.Name, &s.KQLQuery,
			&s.Filters, &s.IsPinned, &s.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("postgres: scan saved search: %w", err)
		}
		searches = append(searches, s)
	}
	return searches, rows.Err()
}

// DeleteSavedSearch removes a saved search by ID, scoped to the tenant and user.
func (p *PostgresClient) DeleteSavedSearch(ctx context.Context, tenantID uuid.UUID, userID string, searchID uuid.UUID) error {
	tag, err := p.pool.Exec(ctx, `
		DELETE FROM saved_searches
		WHERE id = $1 AND tenant_id = $2 AND user_id = $3
	`, searchID, tenantID, userID)
	if err != nil {
		return fmt.Errorf("postgres: delete saved search: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("postgres: saved search not found: %s", searchID)
	}
	return nil
}

// --------------------------------------------------------------------------
// Search History
// --------------------------------------------------------------------------

const searchHistoryLimit = 20

func (p *PostgresClient) RecordSearchHistory(ctx context.Context, tenantID uuid.UUID, userID string, jobID *uuid.UUID, kqlQuery string, resultCount int) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("postgres: record search history begin: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO search_history (tenant_id, user_id, job_id, kql_query, result_count, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, tenantID, userID, jobID, kqlQuery, resultCount, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("postgres: record search history insert: %w", err)
	}

	_, err = tx.Exec(ctx, `
		DELETE FROM search_history
		WHERE tenant_id = $1 AND user_id = $2
		  AND id NOT IN (
		    SELECT id FROM search_history
		    WHERE tenant_id = $1 AND user_id = $2
		    ORDER BY created_at DESC
		    LIMIT $3
		  )
	`, tenantID, userID, searchHistoryLimit)
	if err != nil {
		return fmt.Errorf("postgres: record search history cleanup: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("postgres: record search history commit: %w", err)
	}
	return nil
}

func (p *PostgresClient) GetSearchHistory(ctx context.Context, tenantID uuid.UUID, userID string, limit int) ([]domain.SearchHistoryEntry, error) {
	if limit <= 0 || limit > searchHistoryLimit {
		limit = searchHistoryLimit
	}

	rows, err := p.pool.Query(ctx, `
		SELECT id, tenant_id, user_id, job_id, kql_query, result_count, created_at
		FROM search_history
		WHERE tenant_id = $1 AND user_id = $2
		ORDER BY created_at DESC
		LIMIT $3
	`, tenantID, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("postgres: get search history: %w", err)
	}
	defer rows.Close()

	var entries []domain.SearchHistoryEntry
	for rows.Next() {
		var e domain.SearchHistoryEntry
		if err := rows.Scan(
			&e.ID, &e.TenantID, &e.UserID, &e.JobID, &e.KQLQuery, &e.ResultCount, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("postgres: scan search history: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

func (p *PostgresClient) CreateConversation(ctx context.Context, c *domain.Conversation) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	now := time.Now().UTC()
	c.CreatedAt = now
	c.UpdatedAt = now

	_, err := p.pool.Exec(ctx, `
		INSERT INTO conversations (id, tenant_id, user_id, job_id, title, created_at, updated_at, message_count, last_message_at, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, c.ID, c.TenantID, c.UserID, c.JobID, c.Title, c.CreatedAt, c.UpdatedAt, c.MessageCount, c.LastMessageAt, c.Metadata)
	if err != nil {
		return fmt.Errorf("postgres: create conversation: %w", err)
	}
	return nil
}

func (p *PostgresClient) GetConversation(ctx context.Context, tenantID, conversationID uuid.UUID) (*domain.Conversation, error) {
	var c domain.Conversation
	err := p.pool.QueryRow(ctx, `
		SELECT id, tenant_id, user_id, job_id, title, created_at, updated_at, message_count, last_message_at, metadata
		FROM conversations
		WHERE id = $1 AND tenant_id = $2
	`, conversationID, tenantID).Scan(
		&c.ID, &c.TenantID, &c.UserID, &c.JobID, &c.Title,
		&c.CreatedAt, &c.UpdatedAt, &c.MessageCount, &c.LastMessageAt, &c.Metadata,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("postgres: conversation not found: %s", conversationID)
		}
		return nil, fmt.Errorf("postgres: get conversation: %w", err)
	}
	return &c, nil
}

func (p *PostgresClient) GetConversationWithMessages(ctx context.Context, tenantID, conversationID uuid.UUID, limit int) (*domain.Conversation, error) {
	c, err := p.GetConversation(ctx, tenantID, conversationID)
	if err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 50
	}

	rows, err := p.pool.Query(ctx, `
		SELECT id, conversation_id, tenant_id, role, content, skill_name, follow_ups, tokens_used, latency_ms, status, error_message, created_at
		FROM messages
		WHERE conversation_id = $1 AND tenant_id = $2
		ORDER BY created_at ASC
		LIMIT $3
	`, conversationID, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("postgres: get conversation messages: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var m domain.Message
		if err := rows.Scan(
			&m.ID, &m.ConversationID, &m.TenantID, &m.Role, &m.Content,
			&m.SkillName, &m.FollowUps, &m.TokensUsed, &m.LatencyMS,
			&m.Status, &m.ErrorMessage, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("postgres: scan message: %w", err)
		}
		c.Messages = append(c.Messages, m)
	}
	return c, rows.Err()
}

func (p *PostgresClient) ListConversations(ctx context.Context, tenantID uuid.UUID, userID string, jobID uuid.UUID, limit int) ([]domain.Conversation, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := p.pool.Query(ctx, `
		SELECT id, tenant_id, user_id, job_id, title, created_at, updated_at, message_count, last_message_at, metadata
		FROM conversations
		WHERE tenant_id = $1 AND user_id = $2 AND job_id = $3
		ORDER BY updated_at DESC
		LIMIT $4
	`, tenantID, userID, jobID, limit)
	if err != nil {
		return nil, fmt.Errorf("postgres: list conversations: %w", err)
	}
	defer rows.Close()

	var conversations []domain.Conversation
	for rows.Next() {
		var c domain.Conversation
		if err := rows.Scan(
			&c.ID, &c.TenantID, &c.UserID, &c.JobID, &c.Title,
			&c.CreatedAt, &c.UpdatedAt, &c.MessageCount, &c.LastMessageAt, &c.Metadata,
		); err != nil {
			return nil, fmt.Errorf("postgres: scan conversation: %w", err)
		}
		conversations = append(conversations, c)
	}
	return conversations, rows.Err()
}

func (p *PostgresClient) DeleteConversation(ctx context.Context, tenantID, conversationID uuid.UUID) error {
	tag, err := p.pool.Exec(ctx, `
		DELETE FROM conversations
		WHERE id = $1 AND tenant_id = $2
	`, conversationID, tenantID)
	if err != nil {
		return fmt.Errorf("postgres: delete conversation: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("postgres: conversation not found: %s", conversationID)
	}
	return nil
}

func (p *PostgresClient) AddMessage(ctx context.Context, m *domain.Message) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	m.CreatedAt = time.Now().UTC()
	if m.Status == "" {
		m.Status = domain.MessageStatusPending
	}

	_, err := p.pool.Exec(ctx, `
		INSERT INTO messages (id, conversation_id, tenant_id, role, content, skill_name, follow_ups, tokens_used, latency_ms, status, error_message, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, m.ID, m.ConversationID, m.TenantID, m.Role, m.Content,
		m.SkillName, m.FollowUps, m.TokensUsed, m.LatencyMS,
		m.Status, m.ErrorMessage, m.CreatedAt)
	if err != nil {
		return fmt.Errorf("postgres: add message: %w", err)
	}
	return nil
}

func (p *PostgresClient) GetMessages(ctx context.Context, tenantID, conversationID uuid.UUID, limit int) ([]domain.Message, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := p.pool.Query(ctx, `
		SELECT id, conversation_id, tenant_id, role, content, skill_name, follow_ups, tokens_used, latency_ms, status, error_message, created_at
		FROM messages
		WHERE conversation_id = $1 AND tenant_id = $2
		ORDER BY created_at ASC
		LIMIT $3
	`, conversationID, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("postgres: get messages: %w", err)
	}
	defer rows.Close()

	var messages []domain.Message
	for rows.Next() {
		var m domain.Message
		if err := rows.Scan(
			&m.ID, &m.ConversationID, &m.TenantID, &m.Role, &m.Content,
			&m.SkillName, &m.FollowUps, &m.TokensUsed, &m.LatencyMS,
			&m.Status, &m.ErrorMessage, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("postgres: scan message: %w", err)
		}
		messages = append(messages, m)
	}
	return messages, rows.Err()
}

func (p *PostgresClient) UpdateMessageStatus(ctx context.Context, tenantID, messageID uuid.UUID, status domain.MessageStatus, errorMessage string) error {
	tag, err := p.pool.Exec(ctx, `
		UPDATE messages
		SET status = $1, error_message = $2
		WHERE id = $3 AND tenant_id = $4
	`, status, errorMessage, messageID, tenantID)
	if err != nil {
		return fmt.Errorf("postgres: update message status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("postgres: message not found: %s", messageID)
	}
	return nil
}

func (p *PostgresClient) UpdateMessageContent(ctx context.Context, tenantID, messageID uuid.UUID, content string, tokensUsed, latencyMS int, status domain.MessageStatus, followUps []string) error {
	tag, err := p.pool.Exec(ctx, `
		UPDATE messages
		SET content = $1, tokens_used = $2, latency_ms = $3, status = $4, follow_ups = $5
		WHERE id = $6 AND tenant_id = $7
	`, content, tokensUsed, latencyMS, status, followUps, messageID, tenantID)
	if err != nil {
		return fmt.Errorf("postgres: update message content: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("postgres: message not found: %s", messageID)
	}
	return nil
}
