# RemedyIQ - Agent Development Guide

## Commands

### Backend (Go)
```bash
make dev                    # Start API and Worker (requires docker-up first)
make test                    # Run all tests with race detector and coverage
cd backend && go test -v -run TestPostgres_Ping         # Single test by name
cd backend && go test -v ./internal/storage/             # Package tests
cd backend && go test -v -run TestPostgres_TenantCRUD ./internal/storage/  # Specific test in package
make test-coverage          # Generate HTML coverage report (backend/coverage.html)
make lint                   # Run go vet and go fmt on backend
cd backend && go mod tidy   # Clean up dependencies
make docker-up              # Start Postgres, ClickHouse, NATS, Redis, MinIO
make docker-down            # Stop all Docker services
make db-setup              # Complete database setup (docker-up + migrate-up + ch-init)
```

### Frontend (Next.js/TypeScript)
```bash
cd frontend && npm run dev    # Start Next.js dev server
cd frontend && npm run build  # Production build
cd frontend && npm run lint   # Run ESLint
```

---

## Go Code Style

### Imports
```go
// Standard library first, then external, then internal (alphabetical)
import (
	"context"
	"fmt"
	"log/slog"
	"github.com/jackc/pgx/v5"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)
```

### Naming Conventions
- **Packages**: lowercase, single word (e.g., `storage`, `api`, `search`)
- **Exported types/functions**: PascalCase (e.g., `NewClient`, `SearchQuery`)
- **Unexported fields/functions**: camelCase (e.g., `pool`, `ping()`)
- **Constants**: PascalCase or UPPER_SNAKE_CASE
- **Test functions**: PascalCase with `Test` prefix (e.g., `TestPostgres_Ping`)

### Error Handling
```go
// Wrap errors with context using fmt.Errorf and %w
if err != nil {
	return nil, fmt.Errorf("postgres: connect: %w", err)
}

// Context first parameter
func (c *Client) Query(ctx context.Context, q string) (*Result, error) {
```

### Logging
```go
import "log/slog"
slog.Info("job completed", "job_id", job.ID, "duration", result.Duration)
slog.Error("connection failed", "error", err, "host", host)
```

### Struct Tags
```go
// JSON tags for API responses (camelCase, omitempty)
type LogEntry struct {
	EntryID    string    `json:"entry_id"`
	LineNumber  uint32    `json:"line_number"`
}
// Database tags (snake_case)
type Tenant struct {
	ID        uuid.UUID `json:"id" db:"id"`
}
```

### Testing
```go
import (
	"testing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)
func TestPostgres_Ping(t *testing.T) {
	client := setupPostgres(t)
	err := client.Ping(context.Background())
	require.NoError(t, err)  // Halt test if ping fails
	assert.NotNil(t, client)   // Continue checking other values
}
```

### Concurrency
```go
import "sync"
var wg sync.WaitGroup
var mu sync.Mutex
wg.Add(1)
go func() {
	defer wg.Done()
	mu.Lock()
	services[name] = ping()
	mu.Unlock()
}()
wg.Wait()
```

---

## TypeScript/React Code Style

### File Structure
```
frontend/src/
├── app/                    # Next.js App Router pages
├── components/              # shadcn/ui + feature components
├── hooks/                 # Custom React hooks
└── lib/                   # API clients and utilities
```

### Imports
```typescript
import { useEffect, useState } from "react";
import Link from "next/link";
// Internal imports use @ alias
import { DashboardData } from "@/lib/api";
import { StatsCards } from "@/components/dashboard/stats-cards";
```

### Components
```typescript
"use client";  // Required for client-side components
import { useState } from "react";
interface Props {
  stats: GeneralStats;
}
export function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="border rounded-lg p-4 bg-card">
        <p className="text-2xl font-bold">{stats.api_count}</p>
      </div>
    </div>
  );
}
```

### Types
```typescript
// Match backend domain models (snake_case -> camelCase conversion)
export interface AnalysisJob {
  id: string;
  status: "queued" | "parsing" | "analyzing" | "storing" | "complete" | "failed";
  progress_pct: number;
  api_count?: number;
}
```

### Styling (Tailwind CSS)
```typescript
// Use semantic color tokens from shadcn/ui
className="text-primary text-muted-foreground bg-card border rounded-lg"
// Responsive: mobile first, then lg: breakpoints
className="grid-cols-2 lg:grid-cols-4 gap-4"
```

---

## Important Notes

1. **Context propagation**: Always pass `context.Context` as first parameter to database/external calls
2. **Tenant isolation**: Use PostgreSQL RLS, set tenant context via `SetTenantContext()` before queries
3. **No secrets in code**: Use environment variables (see `.env.example`)
4. **SQL injection prevention**: Use parameterized queries (pgx.Named, clickhouse.Named)
5. **JAR dependency**: Current architecture uses ARLogAnalyzer.jar for parsing; plan to replace with native Go parsers
6. **Multi-service coordination**: NATS JetStream for job queue, WebSocket for real-time updates
7. **Testing first**: Write tests alongside code, maintain >80% coverage
8. **Error wrapping**: Always wrap errors with context using `fmt.Errorf("prefix: %w", err)`
9. **Type safety**: Use TypeScript strict mode, enable all Go strict type checking
10. **Graceful degradation**: Handle service failures gracefully (S3, AI service unavailable)
11. **AI Assistant**: Google Gemini SDK for streaming responses (`google.golang.org/genai`)
12. **SSE streaming**: Use Server-Sent Events for real-time AI responses (not WebSocket)

---

## API Routes

### AI Assistant
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/stream` | Stream AI response via SSE |
| GET | `/api/v1/ai/skills` | List available AI skills |
| GET | `/api/v1/ai/conversations` | List conversations for a job |
| POST | `/api/v1/ai/conversations` | Create a new conversation |
| GET | `/api/v1/ai/conversations/{id}` | Get conversation with messages |
| DELETE | `/api/v1/ai/conversations/{id}` | Delete a conversation |

### AI Skills
- `performance`: Analyze slow operations and latency
- `root_cause`: Find correlations and cascading failures
- `error_explainer`: Explain error codes and exceptions
- `anomaly_narrator`: Detect unusual patterns
- `summarizer`: Generate overview summaries
- `nl_query`: General natural language queries (fallback)

---

## Dependencies

### Backend
- `google.golang.org/genai` - Google Gemini SDK for AI streaming
- `github.com/anthropics/anthropic-sdk-go` - Anthropic Claude SDK (legacy skills)

### Frontend
- `streamdown` - Streaming markdown renderer for AI responses
