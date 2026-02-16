package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/trace"
)

type TraceHandler struct {
	ch    storage.ClickHouseStore
	cache storage.RedisCache
}

func NewTraceHandler(ch storage.ClickHouseStore, cache storage.RedisCache) *TraceHandler {
	return &TraceHandler{ch: ch, cache: cache}
}

func (h *TraceHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	jobIDStr := mux.Vars(r)["job_id"]
	if _, err := uuid.Parse(jobIDStr); err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid job_id format")
		return
	}

	traceID := mux.Vars(r)["trace_id"]
	if traceID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "trace_id is required")
		return
	}

	entries, err := h.ch.GetTraceEntries(r.Context(), tenantID, jobIDStr, traceID)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "trace search failed")
		return
	}

	results := make([]map[string]interface{}, 0, len(entries))
	var totalDuration int
	for _, e := range entries {
		results = append(results, map[string]interface{}{
			"id":     e.EntryID,
			"fields": entryToFieldMap(e),
		})
		totalDuration += int(e.DurationMS)
	}

	api.JSON(w, http.StatusOK, map[string]interface{}{
		"trace_id":       traceID,
		"entries":        results,
		"entry_count":    len(results),
		"total_duration": totalDuration,
	})
}

type WaterfallHandler struct {
	ch    storage.ClickHouseStore
	cache storage.RedisCache
}

func NewWaterfallHandler(ch storage.ClickHouseStore, cache storage.RedisCache) *WaterfallHandler {
	return &WaterfallHandler{ch: ch, cache: cache}
}

func (h *WaterfallHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	jobIDStr := mux.Vars(r)["job_id"]
	if _, err := uuid.Parse(jobIDStr); err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid job_id format")
		return
	}

	traceID := mux.Vars(r)["trace_id"]
	if traceID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "trace_id is required")
		return
	}

	includeCriticalPath := true
	if cp := r.URL.Query().Get("include_critical_path"); cp == "false" {
		includeCriticalPath = false
	}

	cacheKey := h.cache.TenantKey(tenantID, "trace:waterfall", fmt.Sprintf("%s:%s", jobIDStr, traceID))
	if cached, err := h.cache.Get(r.Context(), cacheKey); err == nil && cached != "" {
		var resp domain.WaterfallResponse
		if err := json.Unmarshal([]byte(cached), &resp); err == nil {
			resp.TookMS = int(time.Since(start).Milliseconds())
			api.JSON(w, http.StatusOK, resp)
			return
		}
	}

	entries, err := h.ch.GetTraceEntries(r.Context(), tenantID, jobIDStr, traceID)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "trace search failed")
		return
	}

	if len(entries) == 0 {
		api.JSON(w, http.StatusOK, domain.WaterfallResponse{
			TraceID:       traceID,
			SpanCount:     0,
			TypeBreakdown: map[string]int{},
			Spans:         []domain.SpanNode{},
			FlatSpans:     []domain.SpanNode{},
			CriticalPath:  []string{},
			TookMS:        int(time.Since(start).Milliseconds()),
		})
		return
	}

	spans := trace.BuildHierarchy(entries)
	flatSpans := trace.FlattenSpans(spans)
	typeBreakdown := trace.ComputeTypeBreakdown(spans)
	errorCount := trace.CountErrors(spans)
	primaryUser := trace.FindPrimaryUser(spans)
	primaryQueue := trace.FindPrimaryQueue(spans)
	correlationType := trace.DetermineCorrelationType(entries)

	var criticalPath []string
	if includeCriticalPath {
		criticalPath = trace.ComputeCriticalPath(spans)
		trace.MarkCriticalPath(spans, criticalPath)
		flatSpans = trace.FlattenSpans(spans)
	}

	var traceStart, traceEnd time.Time
	var totalDurationMS int64
	if len(entries) > 0 {
		traceStart = entries[0].Timestamp
		traceEnd = entries[0].Timestamp
		for _, e := range entries {
			if e.Timestamp.Before(traceStart) {
				traceStart = e.Timestamp
			}
			if e.Timestamp.After(traceEnd) {
				traceEnd = e.Timestamp
			}
		}
		totalDurationMS = traceEnd.Sub(traceStart).Milliseconds()
	}

	resp := domain.WaterfallResponse{
		TraceID:         traceID,
		CorrelationType: correlationType,
		TotalDurationMS: totalDurationMS,
		SpanCount:       len(flatSpans),
		ErrorCount:      errorCount,
		PrimaryUser:     primaryUser,
		PrimaryQueue:    primaryQueue,
		TypeBreakdown:   typeBreakdown,
		TraceStart:      traceStart.Format(time.RFC3339),
		TraceEnd:        traceEnd.Format(time.RFC3339),
		Spans:           spans,
		FlatSpans:       flatSpans,
		CriticalPath:    criticalPath,
		TookMS:          int(time.Since(start).Milliseconds()),
	}

	if respJSON, err := json.Marshal(resp); err == nil {
		_ = h.cache.Set(r.Context(), cacheKey, string(respJSON), 5*time.Minute)
	}

	api.JSON(w, http.StatusOK, resp)
}

type TransactionSearchHandler struct {
	ch storage.ClickHouseStore
}

func NewTransactionSearchHandler(ch storage.ClickHouseStore) *TransactionSearchHandler {
	return &TransactionSearchHandler{ch: ch}
}

func (h *TransactionSearchHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	jobIDStr := mux.Vars(r)["job_id"]
	if _, err := uuid.Parse(jobIDStr); err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid job_id format")
		return
	}

	params := domain.TransactionSearchParams{
		User:     r.URL.Query().Get("user"),
		ThreadID: r.URL.Query().Get("thread_id"),
		TraceID:  r.URL.Query().Get("trace_id"),
		RPCID:    r.URL.Query().Get("rpc_id"),
	}

	if hasErrors := r.URL.Query().Get("has_errors"); hasErrors != "" {
		val := hasErrors == "true"
		params.HasErrors = &val
	}

	if minDuration := r.URL.Query().Get("min_duration_ms"); minDuration != "" {
		if val, err := strconv.Atoi(minDuration); err == nil && val > 0 {
			params.MinDuration = val
		}
	}

	if limit := r.URL.Query().Get("limit"); limit != "" {
		if val, err := strconv.Atoi(limit); err == nil && val > 0 {
			params.Limit = val
		}
	}

	if offset := r.URL.Query().Get("offset"); offset != "" {
		if val, err := strconv.Atoi(offset); err == nil && val >= 0 {
			params.Offset = val
		}
	}

	resp, err := h.ch.SearchTransactions(r.Context(), tenantID, jobIDStr, params)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "transaction search failed")
		return
	}

	api.JSON(w, http.StatusOK, resp)
}

type RecentTracesHandler struct {
	cache storage.RedisCache
}

func NewRecentTracesHandler(cache storage.RedisCache) *RecentTracesHandler {
	return &RecentTracesHandler{cache: cache}
}

func (h *RecentTracesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		api.JSON(w, http.StatusOK, []domain.TransactionSummary{})
		return
	}

	cacheKey := h.cache.TenantKey(tenantID, "trace:recent", userID)
	cached, err := h.cache.Get(r.Context(), cacheKey)
	if err != nil || cached == "" {
		api.JSON(w, http.StatusOK, []domain.TransactionSummary{})
		return
	}

	var summaries []domain.TransactionSummary
	if err := json.Unmarshal([]byte(cached), &summaries); err != nil {
		api.JSON(w, http.StatusOK, []domain.TransactionSummary{})
		return
	}

	api.JSON(w, http.StatusOK, summaries)
}

type ExportTraceHandler struct {
	ch storage.ClickHouseStore
}

func NewExportTraceHandler(ch storage.ClickHouseStore) *ExportTraceHandler {
	return &ExportTraceHandler{ch: ch}
}

func (h *ExportTraceHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	jobIDStr := mux.Vars(r)["job_id"]
	if _, err := uuid.Parse(jobIDStr); err != nil {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "invalid job_id format")
		return
	}

	traceID := mux.Vars(r)["trace_id"]
	if traceID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "trace_id is required")
		return
	}

	entries, err := h.ch.GetTraceEntries(r.Context(), tenantID, jobIDStr, traceID)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "trace export failed")
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	filename := fmt.Sprintf("trace-%s-%s-%s", traceID, jobIDStr[:8], time.Now().Format("20060102-150405"))

	switch format {
	case "csv":
		h.exportCSV(w, entries, filename)
	default:
		h.exportJSON(w, entries, filename)
	}
}

func (h *ExportTraceHandler) exportCSV(w http.ResponseWriter, entries []domain.LogEntry, filename string) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.csv", filename))

	writer := csv.NewWriter(w)

	headers := []string{"line_number", "timestamp", "log_type", "duration_ms", "rpc_id", "user", "thread_id", "api_code", "form", "filter_name", "raw_text"}
	if err := writer.Write(headers); err != nil {
		slog.Error("csv export header write error", "error", err)
		return
	}

	for _, e := range entries {
		row := []string{
			strconv.FormatUint(uint64(e.LineNumber), 10),
			e.Timestamp.Format(time.RFC3339),
			string(e.LogType),
			strconv.FormatUint(uint64(e.DurationMS), 10),
			e.RPCID,
			e.User,
			e.ThreadID,
			e.APICode,
			e.Form,
			e.FilterName,
			e.RawText,
		}
		if err := writer.Write(row); err != nil {
			slog.Error("csv export row write error", "error", err)
			return
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		slog.Error("csv export flush error", "error", err)
	}
}

func (h *ExportTraceHandler) exportJSON(w http.ResponseWriter, entries []domain.LogEntry, filename string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.json", filename))

	spans := trace.BuildHierarchy(entries)
	flatSpans := trace.FlattenSpans(spans)

	export := map[string]interface{}{
		"trace_id":    "",
		"span_count":  len(flatSpans),
		"entries":     entries,
		"spans":       spans,
		"flat_spans":  flatSpans,
		"exported_at": time.Now().Format(time.RFC3339),
	}

	if len(entries) > 0 {
		for _, e := range entries {
			if e.TraceID != "" {
				export["trace_id"] = e.TraceID
				break
			}
		}
	}

	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(export); err != nil {
		slog.Error("json export encode error", "error", err)
	}
}
