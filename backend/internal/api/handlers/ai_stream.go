package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

type AIStreamHandler struct {
	gemini   *ai.GeminiClient
	registry *ai.Registry
	router   *ai.Router
	db       *storage.PostgresClient
	ch       storage.ClickHouseStore
	redis    storage.RedisCache
	logger   *slog.Logger
}

func NewAIStreamHandler(gemini *ai.GeminiClient, registry *ai.Registry, router *ai.Router, db *storage.PostgresClient, ch storage.ClickHouseStore, redis storage.RedisCache) *AIStreamHandler {
	return &AIStreamHandler{
		gemini:   gemini,
		registry: registry,
		router:   router,
		db:       db,
		ch:       ch,
		redis:    redis,
		logger:   slog.Default().With("handler", "ai_stream"),
	}
}

func (h *AIStreamHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid tenant ID")
		return
	}

	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing user context")
		return
	}

	var req ai.StreamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid JSON body")
		return
	}

	if req.Query == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "query is required")
		return
	}

	if len(req.Query) > 2000 {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "query exceeds 2000 character limit")
		return
	}

	jobID := mux.Vars(r)["job_id"]
	if jobID == "" {
		jobID = req.JobID
	}
	if jobID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "job_id is required")
		return
	}
	req.JobID = jobID
	jobUUID, err := uuid.Parse(req.JobID)
	if err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid job_id")
		return
	}

	skillName := req.SkillName
	if skillName == "" && req.AutoRoute {
		skillName = h.router.Route(req.Query)
	} else if skillName == "" {
		skillName = "nl_query"
	}

	h.streamSSE(r.Context(), w, tenantID, tenantUUID, userID, jobUUID, &req, skillName)
}

func (h *AIStreamHandler) streamSSE(ctx context.Context, w http.ResponseWriter, tenantID string, tenantUUID uuid.UUID, userID string, jobUUID uuid.UUID, req *ai.StreamRequest, skillName string) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "streaming not supported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	var conversation *domain.Conversation
	var err error

	if req.ConversationID != nil {
		conversation, err = h.db.GetConversation(ctx, tenantUUID, *req.ConversationID)
		if err != nil {
			h.writeSSEError(w, flusher, "conversation not found", "not_found")
			return
		}
	} else {
		conversation = &domain.Conversation{
			TenantID: tenantUUID,
			UserID:   userID,
			JobID:    jobUUID,
			Title:    truncateTitle(req.Query, 50),
		}
		if err := h.db.CreateConversation(ctx, conversation); err != nil {
			h.writeSSEError(w, flusher, "failed to create conversation", "internal_error")
			return
		}
	}

	userMsg := &domain.Message{
		ConversationID: conversation.ID,
		TenantID:       tenantUUID,
		Role:           domain.MessageRoleUser,
		Content:        req.Query,
		Status:         domain.MessageStatusComplete,
	}
	if err := h.db.AddMessage(ctx, userMsg); err != nil {
		h.writeSSEError(w, flusher, "failed to save message", "internal_error")
		return
	}

	assistantMsg := &domain.Message{
		ConversationID: conversation.ID,
		TenantID:       tenantUUID,
		Role:           domain.MessageRoleAssistant,
		Content:        "",
		SkillName:      skillName,
		Status:         domain.MessageStatusStreaming,
	}
	if err := h.db.AddMessage(ctx, assistantMsg); err != nil {
		h.writeSSEError(w, flusher, "failed to create assistant message", "internal_error")
		return
	}

	h.writeSSE(w, flusher, "start", ai.SSEStartData{
		ConversationID: conversation.ID.String(),
		MessageID:      assistantMsg.ID.String(),
	})

	h.writeSSE(w, flusher, "skill", ai.SSESkillData{
		SkillName: skillName,
	})

	logContext := h.buildLogContext(ctx, tenantID, req.JobID)
	systemPrompt := h.buildSystemPrompt(skillName, logContext)
	messages := h.buildConversationMessages(ctx, conversation)

	stream := h.gemini.StreamQuery(ctx, systemPrompt, messages, 4096)

	var fullContent strings.Builder
	var tokensIn, tokensOut int
	start := time.Now()

	for chunk := range stream {
		if chunk.Error != nil {
			h.db.UpdateMessageStatus(ctx, tenantUUID, assistantMsg.ID, domain.MessageStatusError, chunk.Error.Error())
			h.writeSSEError(w, flusher, chunk.Error.Error(), "stream_error")
			return
		}

		if chunk.Text != "" {
			fullContent.WriteString(chunk.Text)
			h.writeSSE(w, flusher, "token", ai.SSETokenData{Text: chunk.Text})
		}

		if chunk.IsFinal {
			tokensIn = chunk.TokensIn
			tokensOut = chunk.TokensOut
		}
	}

	latency := int(time.Since(start).Milliseconds())
	totalTokens := tokensIn + tokensOut

	assistantMsg.Content = fullContent.String()
	assistantMsg.TokensUsed = totalTokens
	assistantMsg.LatencyMS = latency
	assistantMsg.Status = domain.MessageStatusComplete
	assistantMsg.FollowUps = []string{
		"Show me more details",
		"What caused this issue?",
		"How can I optimize this?",
	}

	if err := h.db.UpdateMessageContent(ctx, tenantUUID, assistantMsg.ID, assistantMsg.Content, assistantMsg.TokensUsed, assistantMsg.LatencyMS, assistantMsg.Status, assistantMsg.FollowUps); err != nil {
		h.logger.Error("failed to update message", "error", err)
	}

	h.writeSSE(w, flusher, "metadata", ai.SSEMetadataData{
		TokensUsed: totalTokens,
		LatencyMS:  latency,
		SkillName:  skillName,
	})

	h.writeSSE(w, flusher, "done", ai.SSEDoneData{
		FollowUps: assistantMsg.FollowUps,
	})
}

func (h *AIStreamHandler) buildSystemPrompt(skillName, logContext string) string {
	base := `You are RemedyIQ, an AI assistant that helps BMC Remedy AR Server administrators analyze log files.
Format your response in markdown. Use **bold** for important values and ` + "`inline code`" + ` for technical identifiers.
Use the provided log summary as your primary data source.
Do not ask the user to upload raw logs unless the requested metric is truly missing from the summary.
If a "top slowest/longest" list is provided, treat the first entry as the longest-running item.

` + logContext + `

`

	skillPrompts := map[string]string{
		"performance": base + `

Focus on PERFORMANCE ANALYSIS:
- Identify the slowest API calls, SQL queries, and filter operations
- Highlight operations exceeding normal thresholds (API >1s, SQL >500ms, filters >200ms)
- Look for patterns: repeated slow calls, lock contention, resource exhaustion
- Suggest specific optimizations (indexing, caching, workflow redesign)`,

		"root_cause": base + `

Focus on ROOT CAUSE ANALYSIS:
- Trace failures back to their origin across API, SQL, filter, and escalation logs
- Identify cascading failures and dependency chains
- Look for correlation between errors occurring at similar timestamps
- Explain the chain of events that led to the issue`,

		"error_explainer": base + `

Focus on ERROR EXPLANATION:
- Explain AR Server error codes and their common causes
- Map ARERR codes to known issues and BMC knowledge articles
- Identify whether errors are configuration, data, or system issues
- Provide clear remediation steps for each error`,

		"anomaly_narrator": base + `

Focus on ANOMALY DETECTION:
- Identify unusual patterns: volume spikes, latency changes, error bursts
- Compare against expected baselines for AR Server operations
- Highlight time windows where behavior deviates significantly
- Describe what makes the pattern anomalous and potential causes`,

		"summarizer": base + `

Focus on SUMMARY GENERATION:
- Provide a high-level overview of the log analysis results
- Include key metrics: total operations, error rates, average latencies
- Highlight the top issues requiring attention
- Keep the summary concise and actionable`,
	}

	if prompt, ok := skillPrompts[skillName]; ok {
		return prompt
	}

	return base + `

When answering questions about logs, you should:
1. Identify what the user is looking for (API calls, SQL queries, filters, escalations)
2. Consider relevant fields: type, duration, user, form, queue, status, error
3. Provide specific, actionable answers with references to log entries
4. Suggest follow-up questions`
}

func (h *AIStreamHandler) buildConversationMessages(ctx context.Context, conv *domain.Conversation) []ai.Message {
	dbMessages, err := h.db.GetMessages(ctx, conv.TenantID, conv.ID, 50)
	if err != nil {
		h.logger.Error("failed to fetch conversation messages", "error", err, "conversation_id", conv.ID)
		return []ai.Message{}
	}

	messages := make([]ai.Message, 0, len(dbMessages))
	for _, m := range dbMessages {
		if m.Content == "" {
			continue
		}
		role := "user"
		if m.Role == domain.MessageRoleAssistant {
			role = "assistant"
		}
		messages = append(messages, ai.Message{Role: role, Content: m.Content})
	}
	return messages
}

func (h *AIStreamHandler) buildLogContext(ctx context.Context, tenantID, jobID string) string {
	dash, err := h.loadDashboardForAI(ctx, tenantID, jobID)
	if err != nil {
		h.logger.Error("failed to load dashboard for AI context", "error", err, "job_id", jobID, "tenant_id", tenantID)
		return "Log data summary is not available."
	}

	if dash == nil {
		h.logger.Warn("dashboard is nil", "job_id", jobID)
		return "Log data summary is not available (nil dashboard)."
	}

	h.logger.Info("dashboard fetched successfully", "total_lines", dash.GeneralStats.TotalLines, "esc_count", dash.GeneralStats.EscCount)

	var sb strings.Builder
	sb.WriteString("## Log Analysis Summary\n\n")
	sb.WriteString(fmt.Sprintf("- **Total Lines:** %d\n", dash.GeneralStats.TotalLines))
	sb.WriteString(fmt.Sprintf("- **Log Duration:** %s\n", dash.GeneralStats.LogDuration))
	sb.WriteString(fmt.Sprintf("- **API Calls:** %d\n", dash.GeneralStats.APICount))
	sb.WriteString(fmt.Sprintf("- **SQL Queries:** %d\n", dash.GeneralStats.SQLCount))
	sb.WriteString(fmt.Sprintf("- **Filter Operations:** %d\n", dash.GeneralStats.FilterCount))
	sb.WriteString(fmt.Sprintf("- **Escalations:** %d\n", dash.GeneralStats.EscCount))
	sb.WriteString(fmt.Sprintf("- **Unique Users:** %d\n", dash.GeneralStats.UniqueUsers))
	sb.WriteString(fmt.Sprintf("- **Unique Forms:** %d\n", dash.GeneralStats.UniqueForms))

	if len(dash.TopAPICalls) > 0 {
		sb.WriteString("\n### Top 5 Slowest API Calls\n")
		for i, entry := range dash.TopAPICalls {
			if i >= 5 {
				break
			}
			sb.WriteString(fmt.Sprintf("- %s on %s by %s: %dms (line %d)\n",
				entry.Identifier, entry.Form, entry.User, entry.DurationMS, entry.LineNumber))
		}
	}

	if len(dash.TopSQL) > 0 {
		sb.WriteString("\n### Top 5 Slowest SQL Queries\n")
		for i, entry := range dash.TopSQL {
			if i >= 5 {
				break
			}
			sb.WriteString(fmt.Sprintf("- %s: %dms (line %d)\n",
				entry.Identifier, entry.DurationMS, entry.LineNumber))
		}
	}

	if len(dash.TopEscalations) > 0 {
		longest := dash.TopEscalations[0]
		longestName := longest.Identifier
		if longestName == "" {
			longestName = "unknown escalation"
		}
		sb.WriteString("\n### Longest Running Escalation\n")
		sb.WriteString(fmt.Sprintf("- %s: %dms (line %d)\n", longestName, longest.DurationMS, longest.LineNumber))

		sb.WriteString("\n### Top 5 Escalations\n")
		for i, entry := range dash.TopEscalations {
			if i >= 5 {
				break
			}
			name := entry.Identifier
			if name == "" {
				name = "unknown escalation"
			}
			sb.WriteString(fmt.Sprintf("- %s: %dms (line %d)\n",
				name, entry.DurationMS, entry.LineNumber))
		}
	} else if dash.GeneralStats.EscCount > 0 {
		longestEsc, err := h.findLongestEscalation(ctx, tenantID, jobID)
		if err != nil {
			h.logger.Warn("failed to query longest escalation fallback", "error", err, "job_id", jobID)
		} else if longestEsc != nil {
			name := longestEsc.EscName
			if name == "" {
				name = "unknown escalation"
			}
			sb.WriteString("\n### Longest Running Escalation\n")
			sb.WriteString(fmt.Sprintf("- %s: %dms (line %d)\n", name, longestEsc.DurationMS, longestEsc.LineNumber))
		}
	}

	if dash.HealthScore != nil {
		sb.WriteString(fmt.Sprintf("\n### Health Score: %d/100 (%s)\n", dash.HealthScore.Score, dash.HealthScore.Status))
	}

	return sb.String()
}

func (h *AIStreamHandler) loadDashboardForAI(ctx context.Context, tenantID, jobID string) (*domain.DashboardData, error) {
	if h.ch != nil {
		h.logger.Info("building log context", "tenant_id", tenantID, "job_id", jobID)
		dash, err := h.ch.GetDashboardData(ctx, tenantID, jobID, 10)
		if err == nil {
			return dash, nil
		}
		h.logger.Warn("live clickhouse dashboard lookup failed, trying cache", "error", err, "job_id", jobID)
	}

	if h.redis == nil {
		return nil, fmt.Errorf("dashboard unavailable: no cache client configured")
	}

	dash, err := getDashboardFromCache(ctx, h.redis, tenantID, jobID)
	if err != nil {
		return nil, fmt.Errorf("dashboard cache load: %w", err)
	}
	return dash, nil
}

func (h *AIStreamHandler) findLongestEscalation(ctx context.Context, tenantID, jobID string) (*domain.LogEntry, error) {
	if h.ch == nil {
		return nil, nil
	}

	res, err := h.ch.SearchEntries(ctx, tenantID, jobID, storage.SearchQuery{
		LogTypes:  []string{string(domain.LogTypeEscalation)},
		SortBy:    "duration_ms",
		SortOrder: "desc",
		Page:      1,
		PageSize:  1,
	})
	if err != nil {
		return nil, fmt.Errorf("search longest escalation: %w", err)
	}
	if res == nil || len(res.Entries) == 0 {
		return nil, nil
	}

	return &res.Entries[0], nil
}

func (h *AIStreamHandler) writeSSE(w io.Writer, flusher http.Flusher, eventType string, data interface{}) {
	dataJSON, err := json.Marshal(data)
	if err != nil {
		h.logger.Error("failed to marshal SSE data", "event_type", eventType, "error", err)
		return
	}
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, string(dataJSON))
	flusher.Flush()
}

func (h *AIStreamHandler) writeSSEError(w io.Writer, flusher http.Flusher, message, code string) {
	h.writeSSE(w, flusher, "error", ai.SSEErrorData{
		Message: message,
		Code:    code,
	})
}

func truncateTitle(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
