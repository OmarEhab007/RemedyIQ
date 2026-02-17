package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

func setupConversationTest(t *testing.T) (*storage.PostgresClient, *domain.Tenant, *domain.AnalysisJob) {
	t.Helper()
	ctx := t.Context()

	dsn := "postgres://remedyiq:remedyiq@localhost:5432/remedyiq?sslmode=disable"
	client, err := storage.NewPostgresClient(ctx, dsn)
	require.NoError(t, err)
	t.Cleanup(func() { client.Close() })

	tenant := &domain.Tenant{
		ClerkOrgID:     "clerk_conv_" + uuid.New().String()[:8],
		Name:           "Conv Test Org",
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

	return client, tenant, job
}

func TestConversationsHandler_List(t *testing.T) {
	db, tenant, job := setupConversationTest(t)
	h := NewConversationsHandler(db)

	userID := "user_list_test"

	conv1 := &domain.Conversation{TenantID: tenant.ID, UserID: userID, JobID: job.ID, Title: "First"}
	conv2 := &domain.Conversation{TenantID: tenant.ID, UserID: userID, JobID: job.ID, Title: "Second"}
	require.NoError(t, db.CreateConversation(t.Context(), conv1))
	require.NoError(t, db.CreateConversation(t.Context(), conv2))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai/conversations?job_id="+job.ID.String(), nil)
	ctx := middleware.WithTenantID(req.Context(), tenant.ID.String())
	ctx = middleware.WithUserID(ctx, userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Conversations []domain.Conversation `json:"conversations"`
		Total         int                   `json:"total"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Len(t, resp.Conversations, 2)
	assert.Equal(t, 2, resp.Total)
}

func TestConversationsHandler_Create(t *testing.T) {
	db, tenant, job := setupConversationTest(t)
	h := NewConversationsHandler(db)

	body := `{"job_id":"` + job.ID.String() + `","title":"New Chat"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/ai/conversations", bytes.NewBufferString(body))
	ctx := middleware.WithTenantID(req.Context(), tenant.ID.String())
	ctx = middleware.WithUserID(ctx, "user_create")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp domain.Conversation
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEqual(t, uuid.Nil, resp.ID)
	assert.Equal(t, "New Chat", resp.Title)
}

func TestConversationsHandler_Get(t *testing.T) {
	db, tenant, job := setupConversationTest(t)
	h := NewConversationDetailHandler(db)

	conv := &domain.Conversation{TenantID: tenant.ID, UserID: "user_get", JobID: job.ID, Title: "Test"}
	require.NoError(t, db.CreateConversation(t.Context(), conv))

	msg := &domain.Message{
		ConversationID: conv.ID,
		TenantID:       tenant.ID,
		Role:           domain.MessageRoleUser,
		Content:        "Hello",
		Status:         domain.MessageStatusComplete,
	}
	require.NoError(t, db.AddMessage(t.Context(), msg))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai/conversations/"+conv.ID.String(), nil)
	req = mux.SetURLVars(req, map[string]string{"id": conv.ID.String()})
	ctx := middleware.WithTenantID(req.Context(), tenant.ID.String())
	ctx = middleware.WithUserID(ctx, "user_get")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp domain.Conversation
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, conv.ID, resp.ID)
	assert.Len(t, resp.Messages, 1)
	assert.Equal(t, "Hello", resp.Messages[0].Content)
}

func TestConversationsHandler_Delete(t *testing.T) {
	db, tenant, job := setupConversationTest(t)
	h := NewConversationDetailHandler(db)

	conv := &domain.Conversation{TenantID: tenant.ID, UserID: "user_delete", JobID: job.ID, Title: "To Delete"}
	require.NoError(t, db.CreateConversation(t.Context(), conv))

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/ai/conversations/"+conv.ID.String(), nil)
	req = mux.SetURLVars(req, map[string]string{"id": conv.ID.String()})
	ctx := middleware.WithTenantID(req.Context(), tenant.ID.String())
	ctx = middleware.WithUserID(ctx, "user_delete")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)

	_, err := db.GetConversation(t.Context(), tenant.ID, conv.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestConversationsHandler_Unauthorized(t *testing.T) {
	db, _, _ := setupConversationTest(t)
	h := NewConversationsHandler(db)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai/conversations", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestConversationsHandler_MissingJobID(t *testing.T) {
	db, tenant, _ := setupConversationTest(t)
	h := NewConversationsHandler(db)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai/conversations", nil)
	ctx := middleware.WithTenantID(req.Context(), tenant.ID.String())
	ctx = middleware.WithUserID(ctx, "test_user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp api.ErrorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	assert.Contains(t, errResp.Message, "job_id")
}
