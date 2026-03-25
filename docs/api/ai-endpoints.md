# AI Endpoints

This document describes the AI-powered endpoints for natural language querying.

## Overview

The AI endpoints provide:
- Streaming responses via Server-Sent Events (SSE)
- Automatic skill routing based on query content
- Conversation persistence for context
- Reference to relevant log entries

## Endpoint Reference

### POST /ai/stream

Stream an AI response for a natural language query.

**Request:**
```
POST /api/v1/ai/stream
Content-Type: application/json
Accept: text/event-stream
Authorization: Bearer <jwt>
```

```json
{
  "query": "Why are API calls taking so long?",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "optional-uuid-for-context"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | Natural language question |
| job_id | string | Yes | Analysis job to query against |
| conversation_id | string | No | Existing conversation for context |

**Response:**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

```
data: {"delta": "Based on the log analysis, "}

data: {"delta": "I found several API calls with high latency. "}

data: {"delta": "The slowest operation was **GetEntry** on the HPD:Help Desk form, "}

data: {"delta": "taking 5.2 seconds to complete.\n\n"}

data: {"delta": "### Top 5 Slowest API Calls\n\n"}

data: {"delta": "| Form | Operation | Duration |\n|------|-----------|----------|\n"}

data: {"delta": "| HPD:Help Desk | GetEntry | 5200ms |\n"}

data: {"delta": "\n\n**Recommendation**: Consider optimizing the database queries associated with this form."}

data: [DONE]
```

**SSE Event Format:**

| Field | Type | Description |
|-------|------|-------------|
| delta | string | Text chunk to append |

The final event is always `data: [DONE]`.

### GET /ai/skills

List available AI skills and their routing keywords.

**Response:**
```json
{
  "skills": [
    {
      "name": "performance",
      "description": "Analyze slow operations and latency issues",
      "keywords": ["slow", "latency", "duration", "timeout", "bottleneck"],
      "examples": [
        "Show me the slowest API calls",
        "Why is there high latency?",
        "What operations are taking more than 5 seconds?"
      ]
    },
    {
      "name": "root_cause",
      "description": "Find correlations and cascading failures",
      "keywords": ["root cause", "correlat", "why", "cascading", "spike"],
      "examples": [
        "Why did the system slow down at 3pm?",
        "What caused the cascade of failures?"
      ]
    },
    {
      "name": "error_explainer",
      "description": "Explain error codes and exceptions",
      "keywords": ["error", "arerr", "exception", "failed", "stack trace"],
      "examples": [
        "What does ARERR 123 mean?",
        "Explain these SQL exceptions"
      ]
    },
    {
      "name": "anomaly_narrator",
      "description": "Detect and explain unusual patterns",
      "keywords": ["anomaly", "unusual", "unexpected", "outlier"],
      "examples": [
        "Are there any anomalies in the data?",
        "What's unusual about today's logs?"
      ]
    },
    {
      "name": "summarizer",
      "description": "Generate overview summaries",
      "keywords": ["summar", "overview", "executive", "brief", "report"],
      "examples": [
        "Give me an executive summary",
        "Summarize the log analysis"
      ]
    },
    {
      "name": "nl_query",
      "description": "General natural language queries (fallback)",
      "keywords": [],
      "examples": [
        "How many users were active?",
        "What forms were accessed most?"
      ]
    }
  ]
}
```

## Skill Routing

The router uses keyword matching to select the appropriate skill:

```mermaid
flowchart LR
    QUERY[Query] --> ROUTE{Route}
    
    ROUTE -->|"slow", "latency"| PERFORMANCE[performance]
    ROUTE -->|"root cause", "why"| ROOT[root_cause]
    ROUTE -->|"error", "ARERR"| ERROR[error_explainer]
    ROUTE -->|"anomaly", "unusual"| ANOMALY[anomaly_narrator]
    ROUTE -->|"summar", "overview"| SUMMARIZER[summarizer]
    ROUTE -->|no match| NL[nl_query]
```

### Routing Keywords

| Skill | Keywords |
|-------|----------|
| performance | slow, latency, duration, timeout, bottleneck, optimize, tuning, longest, slowest |
| root_cause | root cause, correlat, why, cascading, spike |
| error_explainer | error, arerr, err, exception, failed, stack trace |
| anomaly_narrator | anomal, unusual, unexpected, deviation, outlier |
| summarizer | summar, overview, executive, brief, report |
| nl_query | (fallback - no keywords) |

## Conversation Management

### GET /ai/conversations

List conversations for a job.

**Query Parameters:**
| Parameter | Type | Description |
|------------|------|-------------|
| job_id | string | Filter by job ID |
| limit | int | Max results (default: 20) |

**Response:**
```json
{
  "conversations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "job_id": "job-uuid",
      "title": "Performance Analysis",
      "message_count": 5,
      "last_message_at": "2024-01-15T10:35:00Z",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /ai/conversations

Create a new conversation.

**Request:**
```json
{
  "job_id": "job-uuid",
  "title": "Performance Analysis"
}
```

### GET /ai/conversations/{id}

Get a conversation with all messages.

**Response:**
```json
{
  "id": "uuid",
  "job_id": "job-uuid",
  "title": "Performance Analysis",
  "created_at": "2024-01-15T10:30:00Z",
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "Why are API calls slow?",
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "Based on the analysis...",
      "skill_name": "performance",
      "tokens_used": 450,
      "latency_ms": 2500,
      "created_at": "2024-01-15T10:30:03Z"
    }
  ]
}
```

### DELETE /ai/conversations/{id}

Delete a conversation and all messages.

**Response:** `204 No Content`

## Context Building

Each skill fetches relevant context from ClickHouse before generating a response:

### Performance Skill
```sql
SELECT * FROM log_entries 
WHERE job_id = ? AND duration_ms > 1000
ORDER BY duration_ms DESC LIMIT 20
```

### Error Explainer Skill
```sql
SELECT * FROM log_entries 
WHERE job_id = ? AND success = false
ORDER BY timestamp DESC LIMIT 50
```

### Summarizer Skill
```sql
SELECT 
    COUNT(*) as total,
    AVG(duration_ms) as avg_duration,
    uniqExact(user) as unique_users
FROM log_entries WHERE job_id = ?
```

## Response Format

AI responses are formatted as Markdown and may include:

- **Headers** - Section organization
- **Tables** - Structured data presentation
- **Code blocks** - SQL queries, error messages
- **Bold/Italic** - Emphasis
- **Lists** - Bullet points for recommendations

## Error Handling

| Error | Description |
|-------|-------------|
| `skill_not_found` | Requested skill doesn't exist |
| `job_not_found` | Job ID doesn't exist |
| `stream_error` | Error during streaming |
| `rate_limit` | Too many requests |

## Best Practices

1. **Use conversations** - Create a conversation for multi-turn queries
2. **Be specific** - Include relevant details in queries
3. **Follow up** - Ask clarifying questions based on suggestions
4. **Check references** - Click on log line references for details
