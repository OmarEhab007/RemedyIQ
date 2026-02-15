package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

type ExportHandler struct {
	ch storage.ClickHouseStore
}

func NewExportHandler(ch storage.ClickHouseStore) *ExportHandler {
	return &ExportHandler{ch: ch}
}

func (h *ExportHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	vars := mux.Vars(r)
	jobID := vars["job_id"]
	if jobID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "job_id is required")
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		query = "*"
	}

	format := r.URL.Query().Get("format")
	if format != "csv" && format != "json" {
		format = "json"
	}

	limit := 10000
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 10000 {
			limit = l
		}
	}

	var timeFrom, timeTo *time.Time
	if fromStr := r.URL.Query().Get("time_from"); fromStr != "" {
		if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
			timeFrom = &t
		}
	}
	if toStr := r.URL.Query().Get("time_to"); toStr != "" {
		if t, err := time.Parse(time.RFC3339, toStr); err == nil {
			timeTo = &t
		}
	}

	searchQuery := storage.SearchQuery{
		Query:      query,
		Page:       1,
		PageSize:   limit,
		SortBy:     "timestamp",
		SortOrder:  "asc",
		TimeFrom:   timeFrom,
		TimeTo:     timeTo,
		ExportMode: true,
	}

	result, err := h.ch.SearchEntries(r.Context(), tenantID, jobID, searchQuery)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "export query failed")
		return
	}

	filename := fmt.Sprintf("log-export-%s-%s", jobID, time.Now().Format("20060102-150405"))

	w.Header().Set("X-Total-Count", strconv.FormatInt(result.TotalCount, 10))
	w.Header().Set("X-Exported-Count", strconv.Itoa(len(result.Entries)))

	if format == "csv" {
		h.exportCSV(w, result.Entries, filename)
	} else {
		h.exportJSON(w, result.Entries, filename)
	}
}

func (h *ExportHandler) exportCSV(w http.ResponseWriter, entries []domain.LogEntry, filename string) {
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.csv\"", filename))

	writer := csv.NewWriter(w)
	defer writer.Flush()

	header := []string{"line_number", "timestamp", "log_type", "user", "duration_ms", "success", "form", "raw_text"}
	if err := writer.Write(header); err != nil {
		return
	}

	for _, e := range entries {
		row := []string{
			fmt.Sprintf("%d", e.LineNumber),
			e.Timestamp.Format(time.RFC3339),
			string(e.LogType),
			e.User,
			fmt.Sprintf("%d", e.DurationMS),
			fmt.Sprintf("%t", e.Success),
			e.Form,
			e.RawText,
		}
		if err := writer.Write(row); err != nil {
			return
		}
	}
}

func (h *ExportHandler) exportJSON(w http.ResponseWriter, entries []domain.LogEntry, filename string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.json\"", filename))

	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	encoder.Encode(map[string]interface{}{
		"count":   len(entries),
		"entries": entries,
	})
}
