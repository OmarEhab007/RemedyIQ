package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
)

func TestDelayedEscalationsHandler_ServeHTTP(t *testing.T) {
	tenantID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	jobID := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	now := time.Now()

	completeJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusComplete,
		CreatedAt: now,
		UpdatedAt: now,
	}

	parsingJob := &domain.AnalysisJob{
		ID:        jobID,
		TenantID:  tenantID,
		Status:    domain.JobStatusParsing,
		CreatedAt: now,
		UpdatedAt: now,
	}

	scheduledTime := now.Add(-5 * time.Second)
	sampleEntries := []domain.DelayedEscalationEntry{
		{
			EscName:       "ESC:OverdueIncident",
			EscPool:       "Admin",
			ScheduledTime: &scheduledTime,
			ActualTime:    now,
			DelayMS:       5000,
			ThreadID:      "T001",
			TraceID:       "trace-esc-001",
			LineNumber:    100,
		},
		{
			EscName:       "ESC:SLABreach",
			EscPool:       "Support",
			ScheduledTime: &scheduledTime,
			ActualTime:    now,
			DelayMS:       3000,
			ThreadID:      "T002",
			TraceID:       "trace-esc-002",
			LineNumber:    200,
		},
	}

	tests := []struct {
		name           string
		tenantID       string
		jobIDStr       string
		setupMocks     func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore)
		expectedStatus int
		checkBody      func(t *testing.T, body []byte)
	}{
		{
			name:     "happy_path_returns_200_with_entries",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)
				ch.On("QueryDelayedEscalations", mock.Anything, tenantID.String(), jobID.String(), 0, 50).Return(sampleEntries, nil)
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp domain.DelayedEscalationsResponse
				require.NoError(t, json.Unmarshal(body, &resp))
				assert.Equal(t, jobID.String(), resp.JobID)
				assert.Len(t, resp.Entries, 2)
				assert.Equal(t, 2, resp.Total)
				assert.Equal(t, "ESC:OverdueIncident", resp.Entries[0].EscName)
				assert.Equal(t, "ESC:SLABreach", resp.Entries[1].EscName)
				assert.Equal(t, uint32(5000), resp.MaxDelayMS)
				assert.Equal(t, float64(4000), resp.AvgDelayMS)
			},
		},
		{
			name:     "no_delayed_escalations_returns_200_with_empty",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(completeJob, nil)
				ch.On("QueryDelayedEscalations", mock.Anything, tenantID.String(), jobID.String(), 0, 50).Return([]domain.DelayedEscalationEntry{}, nil)
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body []byte) {
				var resp domain.DelayedEscalationsResponse
				require.NoError(t, json.Unmarshal(body, &resp))
				assert.Equal(t, jobID.String(), resp.JobID)
				assert.Empty(t, resp.Entries)
				assert.Equal(t, 0, resp.Total)
				assert.Equal(t, float64(0), resp.AvgDelayMS)
				assert.Equal(t, uint32(0), resp.MaxDelayMS)
			},
		},
		{
			name:     "missing_tenant_returns_401",
			tenantID: "",
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore) {
			},
			expectedStatus: http.StatusUnauthorized,
			checkBody: func(t *testing.T, body []byte) {
				assert.Contains(t, string(body), "missing tenant context")
			},
		},
		{
			name:     "invalid_job_id_returns_400",
			tenantID: tenantID.String(),
			jobIDStr: "not-a-uuid",
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore) {
			},
			expectedStatus: http.StatusBadRequest,
			checkBody: func(t *testing.T, body []byte) {
				assert.Contains(t, string(body), "invalid job_id format")
			},
		},
		{
			name:     "job_not_found_returns_404",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(nil, fmt.Errorf("not found"))
			},
			expectedStatus: http.StatusNotFound,
			checkBody: func(t *testing.T, body []byte) {
				assert.Contains(t, string(body), "analysis job not found")
			},
		},
		{
			name:     "job_not_complete_returns_409",
			tenantID: tenantID.String(),
			jobIDStr: jobID.String(),
			setupMocks: func(pg *testutil.MockPostgresStore, ch *testutil.MockClickHouseStore) {
				pg.On("GetJob", mock.Anything, tenantID, jobID).Return(parsingJob, nil)
			},
			expectedStatus: http.StatusConflict,
			checkBody: func(t *testing.T, body []byte) {
				assert.Contains(t, string(body), "analysis is not yet complete")
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pg := new(testutil.MockPostgresStore)
			ch := new(testutil.MockClickHouseStore)
			tc.setupMocks(pg, ch)

			handler := NewDelayedEscalationsHandler(pg, ch)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/"+tc.jobIDStr+"/dashboard/delayed-escalations", nil)
			if tc.tenantID != "" {
				ctx := middleware.WithTenantID(req.Context(), tc.tenantID)
				ctx = middleware.WithUserID(ctx, "test-user")
				req = req.WithContext(ctx)
			}
			req = mux.SetURLVars(req, map[string]string{"job_id": tc.jobIDStr})

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)
			if tc.checkBody != nil {
				tc.checkBody(t, w.Body.Bytes())
			}

			pg.AssertExpectations(t)
			ch.AssertExpectations(t)
		})
	}
}
