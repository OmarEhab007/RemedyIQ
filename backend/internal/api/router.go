package api

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/api/middleware"
)

// RouterConfig holds all dependencies required to build the API router.
// Handler fields that are nil will receive a default "not implemented"
// handler, allowing the router to be constructed incrementally as features
// are built out.
type RouterConfig struct {
	// AllowedOrigins for CORS. Use ["*"] during development.
	AllowedOrigins []string

	// DevMode enables development conveniences such as auth bypass headers.
	DevMode bool

	// ClerkSecretKey is the Clerk JWT signing secret.
	ClerkSecretKey string

	// Handlers -----------------------------------------------------------------

	// HealthHandler serves GET /api/v1/health.
	HealthHandler http.Handler

	// File handlers
	UploadFileHandler http.Handler // POST /api/v1/files/upload
	ListFilesHandler  http.Handler // GET  /api/v1/files

	// Analysis handlers
	CreateAnalysisHandler     http.Handler // POST /api/v1/analysis
	ListAnalysesHandler       http.Handler // GET  /api/v1/analysis
	GetAnalysisHandler        http.Handler // GET  /api/v1/analysis/{job_id}
	GetDashboardHandler       http.Handler // GET  /api/v1/analysis/{job_id}/dashboard
	AggregatesHandler         http.Handler // GET  /api/v1/analysis/{job_id}/dashboard/aggregates
	ExceptionsHandler         http.Handler // GET  /api/v1/analysis/{job_id}/dashboard/exceptions
	GapsHandler               http.Handler // GET  /api/v1/analysis/{job_id}/dashboard/gaps
	ThreadsHandler            http.Handler // GET  /api/v1/analysis/{job_id}/dashboard/threads
	FiltersHandler            http.Handler // GET  /api/v1/analysis/{job_id}/dashboard/filters
	QueuedCallsHandler        http.Handler // GET  /api/v1/analysis/{job_id}/dashboard/queued-calls
	LoggingActivityHandler    http.Handler // GET  /api/v1/analysis/{job_id}/dashboard/logging-activity
	FileMetadataHandler       http.Handler // GET  /api/v1/analysis/{job_id}/dashboard/file-metadata
	DelayedEscalationsHandler http.Handler // GET  /api/v1/analysis/{job_id}/dashboard/delayed-escalations
	SearchLogsHandler         http.Handler // GET  /api/v1/analysis/{job_id}/search
	GetLogEntryHandler        http.Handler // GET  /api/v1/analysis/{job_id}/entries/{entry_id}
	GetEntryContextHandler    http.Handler // GET  /api/v1/analysis/{job_id}/entries/{entry_id}/context
	GetTraceHandler           http.Handler // GET  /api/v1/analysis/{job_id}/trace/{trace_id}
	GetWaterfallHandler       http.Handler // GET  /api/v1/analysis/{job_id}/trace/{trace_id}/waterfall
	SearchTransactionsHandler http.Handler // GET  /api/v1/analysis/{job_id}/transactions
	ExportTraceHandler        http.Handler // GET  /api/v1/analysis/{job_id}/trace/{trace_id}/export
	TraceAIHandler            http.Handler // POST /api/v1/analysis/{job_id}/trace/ai-analyze
	GetRecentTracesHandler    http.Handler // GET  /api/v1/trace/recent
	ExportHandler             http.Handler // GET  /api/v1/analysis/{job_id}/search/export
	QueryAIHandler            http.Handler // POST /api/v1/analysis/{job_id}/ai
	GenerateReportHandler     http.Handler // POST /api/v1/analysis/{job_id}/report

	// Search handlers
	AutocompleteHandler      http.Handler // GET  /api/v1/search/autocomplete
	SavedSearchHandler       http.Handler // GET/POST /api/v1/search/saved
	DeleteSavedSearchHandler http.Handler // DELETE /api/v1/search/saved/{search_id}
	SearchHistoryHandler     http.Handler // GET  /api/v1/search/history

	// WebSocket handler
	WSHandler http.Handler // GET /api/v1/ws

	// AI handlers
	AIStreamHandler           http.Handler // POST /api/v1/ai/stream
	ListSkillsHandler         http.Handler // GET /api/v1/ai/skills
	ConversationsHandler      http.Handler // GET/POST /api/v1/ai/conversations
	ConversationDetailHandler http.Handler // GET/DELETE /api/v1/ai/conversations/{id}
}

// NewRouter builds a fully-configured *mux.Router with all routes from the
// OpenAPI specification and the middleware chain applied.
func NewRouter(cfg RouterConfig) *mux.Router {
	r := mux.NewRouter()

	// ---- Global middleware (applied to every route) -----------------------
	// Order matters: outermost runs first.
	r.Use(middleware.RecoveryMiddleware)
	r.Use(middleware.LoggingMiddleware)
	r.Use(middleware.CORSMiddleware(cfg.AllowedOrigins))
	r.Use(middleware.BodyLimitMiddleware)

	// ---- API v1 subrouter ------------------------------------------------
	v1 := r.PathPrefix("/api/v1").Subrouter()

	// ---- Public routes (no auth) -----------------------------------------
	v1.Handle("/health", handlerOrStub(cfg.HealthHandler)).Methods(http.MethodGet, http.MethodOptions)

	// ---- Authenticated routes --------------------------------------------
	auth := v1.NewRoute().Subrouter()
	authMW := middleware.NewAuthMiddleware(cfg.ClerkSecretKey, cfg.DevMode)
	tenantMW := middleware.NewTenantMiddleware()
	auth.Use(authMW.Authenticate)
	auth.Use(tenantMW.InjectTenant)

	// Files
	auth.Handle("/files/upload", handlerOrStub(cfg.UploadFileHandler)).Methods(http.MethodPost, http.MethodOptions)
	auth.Handle("/files", handlerOrStub(cfg.ListFilesHandler)).Methods(http.MethodGet, http.MethodOptions)

	// Analysis
	auth.Handle("/analysis", handlerOrStub(cfg.CreateAnalysisHandler)).Methods(http.MethodPost, http.MethodOptions)
	auth.Handle("/analysis", handlerOrStub(cfg.ListAnalysesHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}", handlerOrStub(cfg.GetAnalysisHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/dashboard", handlerOrStub(cfg.GetDashboardHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/dashboard/aggregates", handlerOrStub(cfg.AggregatesHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/dashboard/exceptions", handlerOrStub(cfg.ExceptionsHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/dashboard/gaps", handlerOrStub(cfg.GapsHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/dashboard/threads", handlerOrStub(cfg.ThreadsHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/dashboard/filters", handlerOrStub(cfg.FiltersHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/dashboard/queued-calls", handlerOrStub(cfg.QueuedCallsHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/dashboard/logging-activity", handlerOrStub(cfg.LoggingActivityHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/dashboard/file-metadata", handlerOrStub(cfg.FileMetadataHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/dashboard/delayed-escalations", handlerOrStub(cfg.DelayedEscalationsHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/search", handlerOrStub(cfg.SearchLogsHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/search/export", handlerOrStub(cfg.ExportHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/entries/{entry_id}", handlerOrStub(cfg.GetLogEntryHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/entries/{entry_id}/context", handlerOrStub(cfg.GetEntryContextHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/trace/{trace_id}", handlerOrStub(cfg.GetTraceHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/trace/{trace_id}/waterfall", handlerOrStub(cfg.GetWaterfallHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/transactions", handlerOrStub(cfg.SearchTransactionsHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/trace/{trace_id}/export", handlerOrStub(cfg.ExportTraceHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/trace/ai-analyze", handlerOrStub(cfg.TraceAIHandler)).Methods(http.MethodPost, http.MethodOptions)
	auth.Handle("/trace/recent", handlerOrStub(cfg.GetRecentTracesHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/ai", handlerOrStub(cfg.QueryAIHandler)).Methods(http.MethodPost, http.MethodOptions)
	auth.Handle("/analysis/{job_id}/report", handlerOrStub(cfg.GenerateReportHandler)).Methods(http.MethodPost, http.MethodOptions)

	// AI streaming
	auth.Handle("/ai/stream", handlerOrStub(cfg.AIStreamHandler)).Methods(http.MethodPost, http.MethodOptions)
	auth.Handle("/ai/skills", handlerOrStub(cfg.ListSkillsHandler)).Methods(http.MethodGet, http.MethodOptions)

	// Conversations
	auth.Handle("/ai/conversations", handlerOrStub(cfg.ConversationsHandler)).Methods(http.MethodGet, http.MethodPost, http.MethodOptions)
	auth.Handle("/ai/conversations/{id}", handlerOrStub(cfg.ConversationDetailHandler)).Methods(http.MethodGet, http.MethodDelete, http.MethodOptions)

	// Search
	auth.Handle("/search/autocomplete", handlerOrStub(cfg.AutocompleteHandler)).Methods(http.MethodGet, http.MethodOptions)
	auth.Handle("/search/saved", handlerOrStub(cfg.SavedSearchHandler)).Methods(http.MethodGet, http.MethodPost, http.MethodOptions)
	auth.Handle("/search/saved/{search_id}", handlerOrStub(cfg.DeleteSavedSearchHandler)).Methods(http.MethodDelete, http.MethodOptions)
	auth.Handle("/search/history", handlerOrStub(cfg.SearchHistoryHandler)).Methods(http.MethodGet, http.MethodOptions)

	// WebSocket
	auth.Handle("/ws", handlerOrStub(cfg.WSHandler)).Methods(http.MethodGet)

	return r
}

// handlerOrStub returns the provided handler if non-nil, otherwise a stub
// that responds with 501 Not Implemented.
func handlerOrStub(h http.Handler) http.Handler {
	if h != nil {
		return h
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		Error(w, http.StatusNotImplemented, "not_implemented", "this endpoint is not yet implemented")
	})
}
