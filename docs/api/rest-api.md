# REST API Reference

This document provides a reference for all REST API endpoints.

## Authentication

All endpoints (except `/health`) require authentication via Clerk JWT:

```
Authorization: Bearer <jwt_token>
```

The JWT must contain a valid `org_id` claim for tenant isolation.

## Base URL

```
https://api.example.com/api/v1
```

## Endpoints

### Health

#### GET /health

Health check endpoint (public).

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

### Files

#### POST /files/upload

Upload a log file.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (required) - Log file

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "filename": "arserver.log",
  "size_bytes": 1048576,
  "s3_key": "org_123/uuid.log",
  "uploaded_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `400` - Invalid file or missing file
- `413` - File too large (max 10MB)

#### GET /files

List uploaded files.

**Query Parameters:**
| Parameter | Type | Default | Description |
|------------|------|---------|-------------|
| `limit` | int | 20 | Max results |
| `offset` | int | 0 | Pagination offset |

**Response:** `200 OK`
```json
{
  "files": [
    {
      "id": "uuid",
      "filename": "arserver.log",
      "size_bytes": 1048576,
      "uploaded_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 5
}
```

---

### Analysis

#### POST /analysis

Create a new analysis job.

**Request:**
```json
{
  "file_id": "uuid",
  "jar_flags": {
    "top_n": 50,
    "skip_esc": false,
    "user_filter": ""
  },
  "jvm_heap_mb": 4096
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "status": "queued",
  "file_id": "uuid",
  "progress_pct": 0,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### GET /analysis

List analysis jobs.

**Query Parameters:**
| Parameter | Type | Default | Description |
|------------|------|---------|-------------|
| `status` | string | - | Filter by status |
| `limit` | int | 20 | Max results |
| `offset` | int | 0 | Pagination offset |

**Response:** `200 OK`
```json
{
  "jobs": [
    {
      "id": "uuid",
      "status": "complete",
      "progress_pct": 100,
      "api_count": 1500,
      "sql_count": 3000,
      "created_at": "2024-01-15T10:30:00Z",
      "completed_at": "2024-01-15T10:35:00Z"
    }
  ],
  "total": 10
}
```

#### GET /analysis/{job_id}

Get job details.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "status": "complete",
  "progress_pct": 100,
  "file_id": "uuid",
  "total_lines": 100000,
  "api_count": 1500,
  "sql_count": 3000,
  "filter_count": 5000,
  "esc_count": 200,
  "log_start": "2024-01-15T09:00:00Z",
  "log_end": "2024-01-15T10:00:00Z",
  "log_duration": "1h0m0s",
  "created_at": "2024-01-15T10:30:00Z",
  "completed_at": "2024-01-15T10:35:00Z"
}
```

---

### Dashboard

#### GET /analysis/{job_id}/dashboard

Get complete dashboard data.

**Response:** `200 OK`
```json
{
  "general_stats": {
    "total_lines": 100000,
    "api_count": 1500,
    "sql_count": 3000,
    "filter_count": 5000,
    "esc_count": 200,
    "unique_users": 25,
    "unique_forms": 50,
    "log_duration": "1h0m0s"
  },
  "top_api_calls": [...],
  "top_sql_statements": [...],
  "top_filters": [...],
  "top_escalations": [...],
  "time_series": [...],
  "health_score": {
    "score": 85,
    "status": "healthy",
    "factors": [...]
  }
}
```

#### GET /analysis/{job_id}/dashboard/aggregates

Get aggregation data (by form, client, table).

**Response:** `200 OK`
```json
{
  "api": {
    "groups": [
      {
        "name": "HPD:Help Desk",
        "count": 500,
        "avg_ms": 150.5,
        "max_ms": 5000,
        "error_count": 5
      }
    ]
  },
  "sql": {...},
  "filter": {...}
}
```

#### GET /analysis/{job_id}/dashboard/exceptions

Get exception and error data.

**Response:** `200 OK`
```json
{
  "exceptions": [
    {
      "error_code": "ARERR 45055",
      "message": "Permission denied",
      "count": 15,
      "first_seen": "2024-01-15T09:00:00Z",
      "last_seen": "2024-01-15T10:00:00Z",
      "log_type": "API"
    }
  ],
  "total_count": 45,
  "error_rates": {
    "API": 0.02,
    "SQL": 0.01
  }
}
```

#### GET /analysis/{job_id}/dashboard/gaps

Get idle period and queue health data.

**Response:** `200 OK`
```json
{
  "gaps": [
    {
      "start_time": "2024-01-15T09:30:00Z",
      "end_time": "2024-01-15T09:35:00Z",
      "duration_ms": 300000,
      "log_type": "API"
    }
  ],
  "queue_health": [
    {
      "queue": "Fast",
      "total_calls": 1000,
      "avg_ms": 50.5,
      "error_rate": 0.01,
      "p95_ms": 200
    }
  ]
}
```

#### GET /analysis/{job_id}/dashboard/threads

Get thread statistics.

**Response:** `200 OK`
```json
{
  "threads": [
    {
      "thread_id": "TID-001",
      "total_calls": 500,
      "total_ms": 50000,
      "avg_ms": 100,
      "max_ms": 5000,
      "error_count": 2,
      "busy_pct": 45.5
    }
  ],
  "total_threads": 10
}
```

#### GET /analysis/{job_id}/dashboard/filters

Get filter complexity data.

**Response:** `200 OK`
```json
{
  "most_executed": [
    {
      "name": "FLT:Check Status",
      "count": 5000,
      "total_ms": 25000
    }
  ],
  "per_transaction": [...],
  "total_filter_time_ms": 50000
}
```

---

### Search

#### GET /analysis/{job_id}/search

Search log entries with KQL.

**Query Parameters:**
| Parameter | Type | Default | Description |
|------------|------|---------|-------------|
| `q` | string | - | KQL query |
| `type` | string | - | Filter by log type |
| `user` | string | - | Filter by user |
| `start` | string | - | Start timestamp |
| `end` | string | - | End timestamp |
| `limit` | int | 50 | Max results |
| `offset` | int | 0 | Pagination offset |

**Response:** `200 OK`
```json
{
  "entries": [
    {
      "entry_id": "uuid",
      "line_number": 1000,
      "timestamp": "2024-01-15T09:30:00Z",
      "log_type": "API",
      "trace_id": "T-001",
      "user": "admin",
      "form": "HPD:Help Desk",
      "duration_ms": 150,
      "success": true,
      "raw_text": "<original log line>"
    }
  ],
  "total": 150
}
```

#### GET /analysis/{job_id}/entries/{entry_id}

Get single log entry.

**Response:** `200 OK`
```json
{
  "entry_id": "uuid",
  "line_number": 1000,
  "timestamp": "2024-01-15T09:30:00Z",
  "log_type": "API",
  "trace_id": "T-001",
  "user": "admin",
  "duration_ms": 150,
  "success": true,
  "raw_text": "<original log line>"
}
```

#### GET /analysis/{job_id}/entries/{entry_id}/context

Get surrounding entries for context.

**Query Parameters:**
| Parameter | Type | Default | Description |
|------------|------|---------|-------------|
| `before` | int | 5 | Lines before |
| `after` | int | 5 | Lines after |

#### GET /analysis/{job_id}/search/export

Export search results.

**Query Parameters:**
| Parameter | Type | Default | Description |
|------------|------|---------|-------------|
| `q` | string | - | KQL query |
| `format` | string | csv | Export format (csv/json) |

**Response:** `200 OK`
- Content-Type: `text/csv` or `application/json`

---

### Trace

#### GET /analysis/{job_id}/trace/{trace_id}

Get trace data for visualization.

**Response:** `200 OK`
```json
{
  "trace_id": "T-001",
  "correlation_type": "trace_id",
  "total_duration_ms": 1500,
  "span_count": 5,
  "error_count": 0,
  "primary_user": "admin",
  "primary_queue": "Fast",
  "spans": [
    {
      "id": "span-1",
      "parent_id": "",
      "depth": 0,
      "log_type": "API",
      "start_offset_ms": 0,
      "duration_ms": 1500,
      "fields": {
        "form": "HPD:Help Desk",
        "operation": "GetEntry"
      },
      "children": [...]
    }
  ],
  "critical_path": ["span-1", "span-2"]
}
```

#### GET /analysis/{job_id}/trace/{trace_id}/waterfall

Get waterfall visualization data.

#### GET /analysis/{job_id}/transactions

Search for transactions.

**Query Parameters:**
| Parameter | Type | Default | Description |
|------------|------|---------|-------------|
| `user` | string | - | Filter by user |
| `thread_id` | string | - | Filter by thread |
| `min_duration` | int | - | Min duration (ms) |
| `has_errors` | bool | - | Only errors |
| `limit` | int | 20 | Max results |

**Response:** `200 OK`
```json
{
  "transactions": [
    {
      "trace_id": "T-001",
      "primary_user": "admin",
      "primary_form": "HPD:Help Desk",
      "total_duration_ms": 1500,
      "span_count": 5,
      "error_count": 0
    }
  ],
  "total": 50
}
```

---

### AI

#### POST /ai/stream

Stream AI response (SSE).

**Request:**
```json
{
  "query": "Why are API calls slow?",
  "job_id": "uuid",
  "conversation_id": "uuid"
}
```

**Response:** `200 OK` (text/event-stream)
```
data: {"delta": "Based on the analysis..."}

data: {"delta": " the slowest API calls are..."}

data: [DONE]
```

#### GET /ai/skills

List available AI skills.

**Response:** `200 OK`
```json
{
  "skills": [
    {
      "name": "performance",
      "description": "Analyze slow operations and latency",
      "keywords": ["slow", "latency", "duration"],
      "examples": ["Show me the slowest API calls"]
    }
  ]
}
```

---

### Conversations

#### GET /ai/conversations

List conversations for a job.

**Query Parameters:**
| Parameter | Type | Default | Description |
|------------|------|---------|-------------|
| `job_id` | string | - | Filter by job |
| `limit` | int | 20 | Max results |

**Response:** `200 OK`
```json
{
  "conversations": [
    {
      "id": "uuid",
      "job_id": "uuid",
      "title": "Performance Analysis",
      "message_count": 5,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### POST /ai/conversations

Create a new conversation.

**Request:**
```json
{
  "job_id": "uuid",
  "title": "Performance Analysis"
}
```

**Response:** `201 Created`

#### GET /ai/conversations/{id}

Get conversation with messages.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "job_id": "uuid",
  "title": "Performance Analysis",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Why are API calls slow?",
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "Based on the analysis...",
      "skill_name": "performance",
      "created_at": "2024-01-15T10:30:05Z"
    }
  ]
}
```

#### DELETE /ai/conversations/{id}

Delete a conversation.

**Response:** `204 No Content`

---

### Saved Searches

#### GET /search/saved

List saved searches.

**Response:** `200 OK`

#### POST /search/saved

Save a search.

**Request:**
```json
{
  "name": "Slow API Calls",
  "kql_query": "type:API AND duration_ms > 1000",
  "filters": {},
  "is_pinned": true
}
```

**Response:** `201 Created`

#### DELETE /search/saved/{search_id}

Delete a saved search.

**Response:** `204 No Content`

---

### WebSocket

#### GET /ws

WebSocket endpoint for real-time updates.

**Message Types:**

**Subscribe:**
```json
{"action": "subscribe", "topic": "job:{job_id}"}
```

**Progress Update:**
```json
{"type": "progress", "job_id": "uuid", "pct": 50, "status": "parsing", "message": "Processing..."}
```

**Complete:**
```json
{"type": "complete", "job_id": "uuid"}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid input",
    "details": {
      "field": "file_id",
      "reason": "required"
    }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `unauthorized` | 401 | Missing or invalid JWT |
| `forbidden` | 403 | Tenant isolation violation |
| `not_found` | 404 | Resource not found |
| `validation_error` | 400 | Invalid input |
| `internal_error` | 500 | Server error |
