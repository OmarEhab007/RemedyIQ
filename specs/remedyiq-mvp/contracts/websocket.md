# WebSocket Protocol Specification

**Endpoint**: `ws://localhost:8080/api/v1/ws`
**Authentication**: JWT token passed as `token` query parameter

## Connection

```
ws://localhost:8080/api/v1/ws?token=<clerk_jwt>
```

On connection, server validates JWT and extracts tenant_id. All subsequent messages are scoped to that tenant.

## Message Format

All messages are JSON with an `type` field:

```json
{
  "type": "message_type",
  "payload": { ... }
}
```

## Client → Server Messages

### subscribe_job_progress

Subscribe to real-time progress updates for an analysis job.

```json
{
  "type": "subscribe_job_progress",
  "payload": {
    "job_id": "uuid"
  }
}
```

### unsubscribe_job_progress

```json
{
  "type": "unsubscribe_job_progress",
  "payload": {
    "job_id": "uuid"
  }
}
```

### subscribe_live_tail

Subscribe to live log entry stream for a job.

```json
{
  "type": "subscribe_live_tail",
  "payload": {
    "job_id": "uuid",
    "filters": {
      "log_types": ["API", "SQL"],
      "min_duration_ms": 1000,
      "users": ["Demo"],
      "queues": ["Fast"]
    }
  }
}
```

### unsubscribe_live_tail

```json
{
  "type": "unsubscribe_live_tail",
  "payload": {
    "job_id": "uuid"
  }
}
```

### ping

```json
{
  "type": "ping"
}
```

## Server → Client Messages

### job_progress

Sent when analysis job status changes.

```json
{
  "type": "job_progress",
  "payload": {
    "job_id": "uuid",
    "status": "parsing",
    "progress_pct": 45,
    "processed_lines": 1234567,
    "total_lines": 2743210,
    "message": "Parsing log entries..."
  }
}
```

### job_complete

Sent when analysis finishes (success or failure).

```json
{
  "type": "job_complete",
  "payload": {
    "job_id": "uuid",
    "status": "complete",
    "api_count": 50000,
    "sql_count": 120000,
    "filter_count": 30000,
    "esc_count": 500,
    "log_start": "2026-02-01T00:00:00Z",
    "log_end": "2026-02-08T23:59:59Z",
    "log_duration": "7d 23h 59m 59s"
  }
}
```

### live_tail_entry

Sent for each matching log entry during live tail.

```json
{
  "type": "live_tail_entry",
  "payload": {
    "job_id": "uuid",
    "entry": {
      "line_number": 12345,
      "timestamp": "2026-02-09T12:00:00.123Z",
      "log_type": "API",
      "trace_id": "abc123",
      "rpc_id": "def456",
      "queue": "Fast",
      "user": "Demo",
      "api_code": "GE",
      "form": "HPD:Help Desk",
      "duration_ms": 1500,
      "success": true,
      "raw_text": "..."
    }
  }
}
```

### error

Sent when server encounters an error.

```json
{
  "type": "error",
  "payload": {
    "code": "subscription_failed",
    "message": "Job not found",
    "details": {}
  }
}
```

### pong

Response to ping.

```json
{
  "type": "pong"
}
```

## Connection Management

- **Heartbeat**: Client sends `ping` every 30 seconds. Server responds with `pong`. If no ping received in 60 seconds, server closes connection.
- **Reconnection**: Client auto-reconnects with exponential backoff (1s, 2s, 4s, 8s, max 30s).
- **Backpressure**: If client falls behind, server buffers up to 1000 messages per subscription, then drops oldest entries with a `backpressure_warning` message.
- **Max Subscriptions**: 10 concurrent subscriptions per connection.
