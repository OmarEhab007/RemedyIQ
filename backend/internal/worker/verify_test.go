package worker

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
)

func TestVerifyJobFromDatabase_NotFound(t *testing.T) {
	ctx := context.Background()
	m := new(testutil.MockPostgresStore)
	tenant := uuid.New()
	jobID := uuid.New()
	fileID := uuid.New()
	m.On("GetJob", mock.Anything, tenant, jobID).Return(nil, fmt.Errorf("postgres: job not found: %s", jobID))

	msg := domain.AnalysisJob{ID: jobID, TenantID: tenant, FileID: fileID}
	_, err := VerifyJobFromDatabase(ctx, m, msg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
	m.AssertExpectations(t)
}

func TestVerifyJobFromDatabase_FileMismatch(t *testing.T) {
	ctx := context.Background()
	m := new(testutil.MockPostgresStore)
	tenant := uuid.New()
	fileA := uuid.New()
	fileB := uuid.New()
	jobID := uuid.New()

	dbJob := &domain.AnalysisJob{
		ID:       jobID,
		TenantID: tenant,
		FileID:   fileA,
		Status:   domain.JobStatusQueued,
	}
	m.On("GetJob", mock.Anything, tenant, jobID).Return(dbJob, nil)

	msg := domain.AnalysisJob{ID: jobID, TenantID: tenant, FileID: fileB}
	_, err := VerifyJobFromDatabase(ctx, m, msg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "file_id mismatch")
	m.AssertExpectations(t)
}

func TestVerifyJobFromDatabase_NotQueued(t *testing.T) {
	ctx := context.Background()
	m := new(testutil.MockPostgresStore)
	tenant := uuid.New()
	fileID := uuid.New()
	jobID := uuid.New()

	dbJob := &domain.AnalysisJob{
		ID:       jobID,
		TenantID: tenant,
		FileID:   fileID,
		Status:   domain.JobStatusParsing,
	}
	m.On("GetJob", mock.Anything, tenant, jobID).Return(dbJob, nil)

	msg := domain.AnalysisJob{ID: jobID, TenantID: tenant, FileID: fileID}
	_, err := VerifyJobFromDatabase(ctx, m, msg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "queued")
	m.AssertExpectations(t)
}

func TestVerifyJobFromDatabase_Success(t *testing.T) {
	ctx := context.Background()
	m := new(testutil.MockPostgresStore)
	tenant := uuid.New()
	fileID := uuid.New()
	jobID := uuid.New()

	dbJob := &domain.AnalysisJob{
		ID:       jobID,
		TenantID: tenant,
		FileID:   fileID,
		Status:   domain.JobStatusQueued,
	}
	m.On("GetJob", mock.Anything, tenant, jobID).Return(dbJob, nil)

	msg := domain.AnalysisJob{ID: jobID, TenantID: tenant, FileID: fileID}
	out, err := VerifyJobFromDatabase(ctx, m, msg)
	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, jobID, out.ID)
	m.AssertExpectations(t)
}
