//go:build integration

package storage

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

func postgresDSN() string {
	dsn := os.Getenv("POSTGRES_URL")
	if dsn == "" {
		dsn = "postgres://remedyiq:remedyiq@localhost:5432/remedyiq?sslmode=disable"
	}
	return dsn
}

func setupPostgres(t *testing.T) *PostgresClient {
	t.Helper()
	ctx := context.Background()
	client, err := NewPostgresClient(ctx, postgresDSN())
	require.NoError(t, err, "failed to connect to PostgreSQL")
	t.Cleanup(func() { client.Close() })
	return client
}

func TestPostgres_Ping(t *testing.T) {
	client := setupPostgres(t)
	err := client.Ping(context.Background())
	assert.NoError(t, err)
}

func TestPostgres_SetTenantContext(t *testing.T) {
	client := setupPostgres(t)
	ctx := context.Background()
	err := client.SetTenantContext(ctx, uuid.New().String())
	assert.NoError(t, err)
}

// --------------------------------------------------------------------------
// Tenants CRUD
// --------------------------------------------------------------------------

func TestPostgres_TenantCRUD(t *testing.T) {
	client := setupPostgres(t)
	ctx := context.Background()

	tenant := &domain.Tenant{
		ClerkOrgID:     "clerk_org_test_" + uuid.New().String()[:8],
		Name:           "Test Organization",
		Plan:           "pro",
		StorageLimitGB: 50,
	}

	// Create
	err := client.CreateTenant(ctx, tenant)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, tenant.ID)
	assert.False(t, tenant.CreatedAt.IsZero())

	// Get by ID
	fetched, err := client.GetTenant(ctx, tenant.ID)
	require.NoError(t, err)
	assert.Equal(t, tenant.ID, fetched.ID)
	assert.Equal(t, tenant.Name, fetched.Name)
	assert.Equal(t, tenant.Plan, fetched.Plan)
	assert.Equal(t, tenant.StorageLimitGB, fetched.StorageLimitGB)

	// Get by Clerk Org ID
	fetched, err = client.GetTenantByClerkOrg(ctx, tenant.ClerkOrgID)
	require.NoError(t, err)
	assert.Equal(t, tenant.ID, fetched.ID)

	// Not found
	_, err = client.GetTenant(ctx, uuid.New())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")

	_, err = client.GetTenantByClerkOrg(ctx, "nonexistent_clerk_org")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

// --------------------------------------------------------------------------
// Log Files CRUD
// --------------------------------------------------------------------------

func TestPostgres_LogFileCRUD(t *testing.T) {
	client := setupPostgres(t)
	ctx := context.Background()

	// Create a tenant first.
	tenant := &domain.Tenant{
		ClerkOrgID:     "clerk_org_files_" + uuid.New().String()[:8],
		Name:           "File Test Org",
		Plan:           "basic",
		StorageLimitGB: 10,
	}
	require.NoError(t, client.CreateTenant(ctx, tenant))

	logFile := &domain.LogFile{
		TenantID:       tenant.ID,
		Filename:       "arserver.log",
		SizeBytes:      1024 * 1024 * 50,
		S3Key:          "tenants/" + tenant.ID.String() + "/jobs/j1/arserver.log",
		S3Bucket:       "remedyiq-logs",
		ContentType:    "text/plain",
		DetectedTypes:  []string{"API", "SQL"},
		ChecksumSHA256: "abc123def456",
	}

	// Create
	err := client.CreateLogFile(ctx, logFile)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, logFile.ID)

	// Get by ID
	fetched, err := client.GetLogFile(ctx, tenant.ID, logFile.ID)
	require.NoError(t, err)
	assert.Equal(t, logFile.Filename, fetched.Filename)
	assert.Equal(t, logFile.SizeBytes, fetched.SizeBytes)
	assert.Equal(t, logFile.ChecksumSHA256, fetched.ChecksumSHA256)

	// Tenant isolation: different tenant should not find it.
	_, err = client.GetLogFile(ctx, uuid.New(), logFile.ID)
	assert.Error(t, err)

	// List
	files, err := client.ListLogFiles(ctx, tenant.ID)
	require.NoError(t, err)
	assert.Len(t, files, 1)
	assert.Equal(t, logFile.ID, files[0].ID)
}

// --------------------------------------------------------------------------
// Analysis Jobs CRUD
// --------------------------------------------------------------------------

func TestPostgres_JobCRUD(t *testing.T) {
	client := setupPostgres(t)
	ctx := context.Background()

	// Create tenant and log file.
	tenant := &domain.Tenant{
		ClerkOrgID:     "clerk_org_jobs_" + uuid.New().String()[:8],
		Name:           "Job Test Org",
		Plan:           "enterprise",
		StorageLimitGB: 100,
	}
	require.NoError(t, client.CreateTenant(ctx, tenant))

	logFile := &domain.LogFile{
		TenantID:    tenant.ID,
		Filename:    "server.log",
		SizeBytes:   1024,
		S3Key:       "test/server.log",
		S3Bucket:    "remedyiq-logs",
		ContentType: "text/plain",
	}
	require.NoError(t, client.CreateLogFile(ctx, logFile))

	job := &domain.AnalysisJob{
		TenantID:       tenant.ID,
		Status:         domain.JobStatusQueued,
		FileID:         logFile.ID,
		JARFlags:       domain.JARFlags{TopN: 25},
		JVMHeapMB:      4096,
		TimeoutSeconds: 1800,
		ProgressPct:    0,
	}

	// Create
	err := client.CreateJob(ctx, job)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, job.ID)

	// Get
	fetched, err := client.GetJob(ctx, tenant.ID, job.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.JobStatusQueued, fetched.Status)
	assert.Equal(t, 4096, fetched.JVMHeapMB)

	// Update status to parsing.
	err = client.UpdateJobStatus(ctx, tenant.ID, job.ID, domain.JobStatusParsing, nil)
	require.NoError(t, err)

	fetched, err = client.GetJob(ctx, tenant.ID, job.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.JobStatusParsing, fetched.Status)
	assert.Nil(t, fetched.CompletedAt)

	// Update progress.
	lines := int64(5000)
	err = client.UpdateJobProgress(ctx, tenant.ID, job.ID, 50, &lines)
	require.NoError(t, err)

	fetched, err = client.GetJob(ctx, tenant.ID, job.ID)
	require.NoError(t, err)
	assert.Equal(t, 50, fetched.ProgressPct)
	require.NotNil(t, fetched.ProcessedLines)
	assert.Equal(t, int64(5000), *fetched.ProcessedLines)

	// Update status to complete (should set CompletedAt).
	err = client.UpdateJobStatus(ctx, tenant.ID, job.ID, domain.JobStatusComplete, nil)
	require.NoError(t, err)

	fetched, err = client.GetJob(ctx, tenant.ID, job.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.JobStatusComplete, fetched.Status)
	assert.NotNil(t, fetched.CompletedAt)

	// Update status with error message.
	errMsg := "out of memory"
	err = client.UpdateJobStatus(ctx, tenant.ID, job.ID, domain.JobStatusFailed, &errMsg)
	require.NoError(t, err)

	fetched, err = client.GetJob(ctx, tenant.ID, job.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.JobStatusFailed, fetched.Status)
	require.NotNil(t, fetched.ErrorMessage)
	assert.Equal(t, "out of memory", *fetched.ErrorMessage)

	// Tenant isolation.
	_, err = client.GetJob(ctx, uuid.New(), job.ID)
	assert.Error(t, err)

	// List
	jobs, err := client.ListJobs(ctx, tenant.ID)
	require.NoError(t, err)
	assert.Len(t, jobs, 1)
	assert.Equal(t, job.ID, jobs[0].ID)

	// Update non-existent job.
	err = client.UpdateJobStatus(ctx, tenant.ID, uuid.New(), domain.JobStatusParsing, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

// --------------------------------------------------------------------------
// AI Interactions CRUD
// --------------------------------------------------------------------------

func TestPostgres_AIInteractionCRUD(t *testing.T) {
	client := setupPostgres(t)
	ctx := context.Background()

	tenant := &domain.Tenant{
		ClerkOrgID:     "clerk_org_ai_" + uuid.New().String()[:8],
		Name:           "AI Test Org",
		Plan:           "pro",
		StorageLimitGB: 25,
	}
	require.NoError(t, client.CreateTenant(ctx, tenant))

	ai := &domain.AIInteraction{
		TenantID:  tenant.ID,
		UserID:    "user_clerk_123",
		SkillName: "explain_error",
		InputText: "Why is this API call slow?",
		Status:    "pending",
	}

	// Create
	err := client.CreateAIInteraction(ctx, ai)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, ai.ID)

	// Update
	output := "The API call is slow due to a full-table scan on T001."
	tokens := 150
	latency := 1200
	err = client.UpdateAIInteraction(ctx, tenant.ID, ai.ID, &output, &tokens, &latency, "complete")
	require.NoError(t, err)

	// Update non-existent.
	err = client.UpdateAIInteraction(ctx, tenant.ID, uuid.New(), &output, &tokens, &latency, "complete")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

// --------------------------------------------------------------------------
// Saved Searches CRUD
// --------------------------------------------------------------------------

func TestPostgres_SavedSearchCRUD(t *testing.T) {
	client := setupPostgres(t)
	ctx := context.Background()

	tenant := &domain.Tenant{
		ClerkOrgID:     "clerk_org_ss_" + uuid.New().String()[:8],
		Name:           "Search Test Org",
		Plan:           "basic",
		StorageLimitGB: 10,
	}
	require.NoError(t, client.CreateTenant(ctx, tenant))

	userID := "user_search_001"

	search1 := &domain.SavedSearch{
		TenantID: tenant.ID,
		UserID:   userID,
		Name:     "Slow APIs",
		KQLQuery: "log_type:API AND duration_ms:>1000",
		Filters:  []byte(`{"log_types":["API"]}`),
		IsPinned: true,
	}
	search2 := &domain.SavedSearch{
		TenantID: tenant.ID,
		UserID:   userID,
		Name:     "SQL Errors",
		KQLQuery: "log_type:SQL AND success:false",
		Filters:  []byte(`{"log_types":["SQL"]}`),
		IsPinned: false,
	}

	// Create
	require.NoError(t, client.CreateSavedSearch(ctx, search1))
	require.NoError(t, client.CreateSavedSearch(ctx, search2))

	// List
	searches, err := client.ListSavedSearches(ctx, tenant.ID, userID)
	require.NoError(t, err)
	assert.Len(t, searches, 2)
	// Pinned should be first.
	assert.Equal(t, "Slow APIs", searches[0].Name)

	// Different user should see nothing.
	searches, err = client.ListSavedSearches(ctx, tenant.ID, "other_user")
	require.NoError(t, err)
	assert.Len(t, searches, 0)

	// Delete
	err = client.DeleteSavedSearch(ctx, tenant.ID, userID, search2.ID)
	require.NoError(t, err)

	searches, err = client.ListSavedSearches(ctx, tenant.ID, userID)
	require.NoError(t, err)
	assert.Len(t, searches, 1)

	// Delete non-existent.
	err = client.DeleteSavedSearch(ctx, tenant.ID, userID, uuid.New())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestPostgres_ConversationCRUD(t *testing.T) {
	client := setupPostgres(t)
	ctx := context.Background()

	tenant := &domain.Tenant{
		ClerkOrgID:     "clerk_org_conv_" + uuid.New().String()[:8],
		Name:           "Conversation Test Org",
		Plan:           "pro",
		StorageLimitGB: 50,
	}
	require.NoError(t, client.CreateTenant(ctx, tenant))

	logFile := &domain.LogFile{
		TenantID:    tenant.ID,
		Filename:    "test.log",
		SizeBytes:   1024,
		S3Key:       "test/test.log",
		S3Bucket:    "test-bucket",
		ContentType: "text/plain",
	}
	require.NoError(t, client.CreateLogFile(ctx, logFile))

	job := &domain.AnalysisJob{
		TenantID:       tenant.ID,
		Status:         domain.JobStatusComplete,
		FileID:         logFile.ID,
		JARFlags:       domain.JARFlags{},
		JVMHeapMB:      4096,
		TimeoutSeconds: 1800,
	}
	require.NoError(t, client.CreateJob(ctx, job))

	userID := "user_conv_001"

	conv := &domain.Conversation{
		TenantID: tenant.ID,
		UserID:   userID,
		JobID:    job.ID,
		Title:    "Test Chat",
	}

	err := client.CreateConversation(ctx, conv)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, conv.ID)
	assert.False(t, conv.CreatedAt.IsZero())

	fetched, err := client.GetConversation(ctx, tenant.ID, conv.ID)
	require.NoError(t, err)
	assert.Equal(t, conv.ID, fetched.ID)
	assert.Equal(t, "Test Chat", fetched.Title)
	assert.Equal(t, userID, fetched.UserID)

	conv2 := &domain.Conversation{
		TenantID: tenant.ID,
		UserID:   userID,
		JobID:    job.ID,
		Title:    "Second Chat",
	}
	require.NoError(t, client.CreateConversation(ctx, conv2))

	list, err := client.ListConversations(ctx, tenant.ID, userID, job.ID, 10)
	require.NoError(t, err)
	assert.Len(t, list, 2)
	assert.Equal(t, conv2.ID, list[0].ID, "should be ordered by updated_at DESC")

	_, err = client.GetConversation(ctx, uuid.New(), conv.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestPostgres_MessageCRUD(t *testing.T) {
	client := setupPostgres(t)
	ctx := context.Background()

	tenant := &domain.Tenant{
		ClerkOrgID:     "clerk_org_msg_" + uuid.New().String()[:8],
		Name:           "Message Test Org",
		Plan:           "pro",
		StorageLimitGB: 50,
	}
	require.NoError(t, client.CreateTenant(ctx, tenant))

	logFile := &domain.LogFile{
		TenantID:    tenant.ID,
		Filename:    "test.log",
		SizeBytes:   1024,
		S3Key:       "test/test.log",
		S3Bucket:    "test-bucket",
		ContentType: "text/plain",
	}
	require.NoError(t, client.CreateLogFile(ctx, logFile))

	job := &domain.AnalysisJob{
		TenantID:       tenant.ID,
		Status:         domain.JobStatusComplete,
		FileID:         logFile.ID,
		JARFlags:       domain.JARFlags{},
		JVMHeapMB:      4096,
		TimeoutSeconds: 1800,
	}
	require.NoError(t, client.CreateJob(ctx, job))

	conv := &domain.Conversation{
		TenantID: tenant.ID,
		UserID:   "user_msg_001",
		JobID:    job.ID,
		Title:    "Message Test",
	}
	require.NoError(t, client.CreateConversation(ctx, conv))

	userMsg := &domain.Message{
		ConversationID: conv.ID,
		TenantID:       tenant.ID,
		Role:           domain.MessageRoleUser,
		Content:        "What is the slowest API?",
		Status:         domain.MessageStatusComplete,
	}
	err := client.AddMessage(ctx, userMsg)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, userMsg.ID)

	assistantMsg := &domain.Message{
		ConversationID: conv.ID,
		TenantID:       tenant.ID,
		Role:           domain.MessageRoleAssistant,
		Content:        "The slowest API is GetEntry with 2500ms.",
		SkillName:      "performance",
		FollowUps:      []string{"Show more details", "Why is it slow?"},
		TokensUsed:     150,
		LatencyMS:      1200,
		Status:         domain.MessageStatusComplete,
	}
	require.NoError(t, client.AddMessage(ctx, assistantMsg))

	fetched, err := client.GetConversationWithMessages(ctx, tenant.ID, conv.ID, 50)
	require.NoError(t, err)
	assert.Len(t, fetched.Messages, 2)
	assert.Equal(t, domain.MessageRoleUser, fetched.Messages[0].Role)
	assert.Equal(t, domain.MessageRoleAssistant, fetched.Messages[1].Role)
	assert.Equal(t, "performance", fetched.Messages[1].SkillName)
	assert.Equal(t, 2, fetched.MessageCount, "trigger should update message_count")

	messages, err := client.GetMessages(ctx, tenant.ID, conv.ID, 50)
	require.NoError(t, err)
	assert.Len(t, messages, 2)

	streamingMsg := &domain.Message{
		ConversationID: conv.ID,
		TenantID:       tenant.ID,
		Role:           domain.MessageRoleAssistant,
		Content:        "Starting...",
		Status:         domain.MessageStatusStreaming,
	}
	require.NoError(t, client.AddMessage(ctx, streamingMsg))

	err = client.UpdateMessageStatus(ctx, tenant.ID, streamingMsg.ID, domain.MessageStatusComplete, "")
	require.NoError(t, err)

	err = client.UpdateMessageStatus(ctx, tenant.ID, uuid.New(), domain.MessageStatusComplete, "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestPostgres_DeleteConversation(t *testing.T) {
	client := setupPostgres(t)
	ctx := context.Background()

	tenant := &domain.Tenant{
		ClerkOrgID:     "clerk_org_del_" + uuid.New().String()[:8],
		Name:           "Delete Test Org",
		Plan:           "pro",
		StorageLimitGB: 50,
	}
	require.NoError(t, client.CreateTenant(ctx, tenant))

	logFile := &domain.LogFile{
		TenantID:    tenant.ID,
		Filename:    "test.log",
		SizeBytes:   1024,
		S3Key:       "test/test.log",
		S3Bucket:    "test-bucket",
		ContentType: "text/plain",
	}
	require.NoError(t, client.CreateLogFile(ctx, logFile))

	job := &domain.AnalysisJob{
		TenantID:       tenant.ID,
		Status:         domain.JobStatusComplete,
		FileID:         logFile.ID,
		JARFlags:       domain.JARFlags{},
		JVMHeapMB:      4096,
		TimeoutSeconds: 1800,
	}
	require.NoError(t, client.CreateJob(ctx, job))

	conv := &domain.Conversation{
		TenantID: tenant.ID,
		UserID:   "user_del_001",
		JobID:    job.ID,
		Title:    "To Delete",
	}
	require.NoError(t, client.CreateConversation(ctx, conv))

	msg := &domain.Message{
		ConversationID: conv.ID,
		TenantID:       tenant.ID,
		Role:           domain.MessageRoleUser,
		Content:        "Test",
		Status:         domain.MessageStatusComplete,
	}
	require.NoError(t, client.AddMessage(ctx, msg))

	err := client.DeleteConversation(ctx, tenant.ID, conv.ID)
	require.NoError(t, err)

	_, err = client.GetConversation(ctx, tenant.ID, conv.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")

	messages, err := client.GetMessages(ctx, tenant.ID, conv.ID, 50)
	require.NoError(t, err)
	assert.Len(t, messages, 0, "messages should be cascade deleted")

	err = client.DeleteConversation(ctx, uuid.New(), uuid.New())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}
