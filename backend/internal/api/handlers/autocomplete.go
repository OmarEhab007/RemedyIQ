package handlers

import (
	"net/http"
	"strings"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

type AutocompleteHandler struct {
	ch storage.ClickHouseStore
}

func NewAutocompleteHandler(ch storage.ClickHouseStore) *AutocompleteHandler {
	return &AutocompleteHandler{ch: ch}
}

type AutocompleteResponse struct {
	Fields  []AutocompleteField `json:"fields,omitempty"`
	Values  []AutocompleteValue `json:"values,omitempty"`
	IsField bool                `json:"is_field"`
}

type AutocompleteField struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type AutocompleteValue struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

var KnownFields = []AutocompleteField{
	{Name: "log_type", Description: "Type of log entry (API, SQL, FLTR, ESCL)"},
	{Name: "user", Description: "User who initiated the operation"},
	{Name: "queue", Description: "AR System queue name"},
	{Name: "thread_id", Description: "Thread identifier"},
	{Name: "trace_id", Description: "Distributed tracing ID"},
	{Name: "rpc_id", Description: "RPC call identifier"},
	{Name: "api_code", Description: "AR API code"},
	{Name: "form", Description: "AR form name"},
	{Name: "operation", Description: "Operation type (GET, SET, CREATE, DELETE)"},
	{Name: "request_id", Description: "Request identifier"},
	{Name: "sql_table", Description: "SQL table name"},
	{Name: "filter_name", Description: "Filter name"},
	{Name: "esc_name", Description: "Escalation name"},
	{Name: "esc_pool", Description: "Escalation pool"},
	{Name: "duration_ms", Description: "Duration in milliseconds (numeric)"},
	{Name: "success", Description: "Operation success (true/false)"},
	{Name: "error_encountered", Description: "Error encountered (true/false)"},
}

func (h *AutocompleteHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == "" {
		api.Error(w, http.StatusUnauthorized, api.ErrCodeUnauthorized, "missing tenant context")
		return
	}

	prefix := r.URL.Query().Get("prefix")
	jobID := r.URL.Query().Get("job_id")

	if prefix == "" {
		api.JSON(w, http.StatusOK, AutocompleteResponse{
			Fields:  KnownFields,
			IsField: true,
		})
		return
	}

	if strings.Contains(prefix, ":") {
		h.suggestValues(w, r, tenantID, jobID, prefix)
		return
	}

	h.suggestFields(w, prefix)
}

func (h *AutocompleteHandler) suggestFields(w http.ResponseWriter, prefix string) {
	prefixLower := strings.ToLower(prefix)
	var matches []AutocompleteField
	for _, field := range KnownFields {
		if strings.HasPrefix(strings.ToLower(field.Name), prefixLower) {
			matches = append(matches, field)
		}
	}

	api.JSON(w, http.StatusOK, AutocompleteResponse{
		Fields:  matches,
		IsField: true,
	})
}

func (h *AutocompleteHandler) suggestValues(w http.ResponseWriter, r *http.Request, tenantID, jobID, prefix string) {
	if jobID == "" {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "job_id is required for value suggestions")
		return
	}

	parts := strings.SplitN(prefix, ":", 2)
	fieldName := parts[0]
	valuePrefix := ""
	if len(parts) > 1 {
		valuePrefix = parts[1]
	}

	if !storage.IsKnownField(fieldName) {
		api.Error(w, http.StatusBadRequest, api.ErrCodeInvalidRequest, "unknown field: "+fieldName)
		return
	}

	values, err := h.ch.GetAutocompleteValues(r.Context(), tenantID, jobID, fieldName, valuePrefix, 10)
	if err != nil {
		api.Error(w, http.StatusInternalServerError, api.ErrCodeInternalError, "failed to get autocomplete values")
		return
	}

	resp := make([]AutocompleteValue, len(values))
	for i, v := range values {
		resp[i] = AutocompleteValue{
			Value: v.Value,
			Count: v.Count,
		}
	}

	api.JSON(w, http.StatusOK, AutocompleteResponse{
		Values:  resp,
		IsField: false,
	})
}
