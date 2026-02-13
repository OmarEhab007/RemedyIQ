// Package contracts defines the interface contracts extracted from concrete
// storage and infrastructure types for testability.
//
// These interfaces will be placed in backend/internal/storage/interfaces.go
// and backend/internal/ai/interfaces.go respectively.
// Handlers will be refactored to accept interfaces instead of concrete types.
//
// This file serves as the contract specification; actual implementation
// will split across appropriate packages.

package contracts

// --- Storage Interfaces (backend/internal/storage/interfaces.go) ---

// PostgresStore defines the contract for PostgreSQL operations.
// Implemented by: *storage.PostgresClient (production), *testutil.MockPostgresStore (test)
//
// Methods grouped by domain:
//   Tenant: CreateTenant, GetTenant, GetTenantByClerkOrg
//   LogFile: CreateLogFile, GetLogFile, ListLogFiles
//   Job: CreateJob, GetJob, UpdateJobStatus, UpdateJobProgress, ListJobs
//   AI: CreateAIInteraction, UpdateAIInteraction
//   Search: CreateSavedSearch, ListSavedSearches, DeleteSavedSearch
//   Infra: Ping, SetTenantContext, Close

// ClickHouseStore defines the contract for ClickHouse analytics operations.
// Implemented by: *storage.ClickHouseClient (production), *testutil.MockClickHouseStore (test)
//
// Methods:
//   BatchInsertEntries: Bulk insert log entries
//   GetDashboardData: Aggregate dashboard metrics
//   ComputeHealthScore: Calculate system health score
//   Search: Full-text search with pagination
//   Infra: Ping, Close

// RedisCache defines the contract for Redis caching operations.
// Implemented by: *storage.RedisClient (production), *testutil.MockRedisCache (test)
//
// Methods:
//   Get/Set/Delete: Basic cache operations
//   TenantKey: Key generation with tenant scoping
//   CheckRateLimit: Sliding window rate limiting
//   Infra: Ping, Close

// S3Storage defines the contract for S3-compatible object storage.
// Implemented by: *storage.S3Client (production), *testutil.MockS3Storage (test)
//
// Methods:
//   Upload: Store file with key
//   Download: Retrieve file by key

// --- AI Interfaces (backend/internal/ai/interfaces.go) ---

// AIQuerier defines the contract for AI model interaction.
// Implemented by: *ai.Client (production), *testutil.MockAIClient (test)
//
// Methods:
//   Query: Send prompt and receive response
//   IsAvailable: Check if AI service is reachable

// --- Streaming Interfaces (backend/internal/streaming/interfaces.go) ---

// NATSStreamer defines the contract for NATS JetStream operations.
// Implemented by: *streaming.NATSClient (production), *testutil.MockNATSStreamer (test)
//
// Methods:
//   EnsureStreams: Create/verify JetStream streams
//   SubscribeJobSubmit: Listen for job submission events
//   PublishJobProgress: Emit job progress updates
//   Close: Graceful shutdown

// --- Search Interfaces (backend/internal/search/interfaces.go) ---

// SearchIndexer defines the contract for full-text search operations.
// Implemented by: *search.BleveManager (production), *testutil.MockSearchIndexer (test)
//
// Methods:
//   Index: Add document to search index
//   Search: Query the index
//   Delete: Remove document from index
//   Close: Close the index
