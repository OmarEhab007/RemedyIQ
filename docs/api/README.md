# API Documentation

This section documents all API endpoints for RemedyIQ.

## Overview

RemedyIQ provides a RESTful API for:
- File upload and management
- Analysis job management
- Dashboard data retrieval
- Log search and exploration
- Transaction tracing
- AI-powered analysis

## Documentation

- [REST API Reference](./rest-api.md) - Complete endpoint reference
- [OpenAPI Specification](./openapi.yaml) - Machine-readable API spec
- [AI Endpoints](./ai-endpoints.md) - AI streaming and skills
- [WebSocket Protocol](./websocket.md) - Real-time updates

## Authentication

All endpoints (except `/health`) require authentication via Clerk JWT:

```
Authorization: Bearer <jwt_token>
```

## Base URL

| Environment | URL |
|-------------|-----|
| Production | `https://api.remedyiq.io/api/v1` |
| Development | `http://localhost:8080/api/v1` |

## Quick Reference

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/files/upload` | Upload log file |
| GET | `/files` | List files |

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analysis` | Create analysis job |
| GET | `/analysis` | List jobs |
| GET | `/analysis/{job_id}` | Get job details |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analysis/{job_id}/dashboard` | Full dashboard |
| GET | `/dashboard/aggregates` | Aggregation data |
| GET | `/dashboard/exceptions` | Error data |
| GET | `/dashboard/gaps` | Idle periods |
| GET | `/dashboard/threads` | Thread stats |
| GET | `/dashboard/filters` | Filter complexity |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analysis/{job_id}/search` | KQL search |
| GET | `/entries/{entry_id}` | Get entry |
| GET | `/search/export` | Export results |

### Trace
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/trace/{trace_id}` | Trace data |
| GET | `/trace/{trace_id}/waterfall` | Waterfall data |
| GET | `/transactions` | Search transactions |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/stream` | Stream AI response |
| GET | `/ai/skills` | List skills |
| GET | `/ai/conversations` | List conversations |
| POST | `/ai/conversations` | Create conversation |

## Response Format

### Success Response

```json
{
  "data": { ... }
}
```

### Error Response

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid input",
    "details": { ... }
  }
}
```

## Rate Limits

| Tier | Requests/min | Burst |
|------|--------------|-------|
| Free | 60 | 10 |
| Pro | 300 | 50 |
| Enterprise | Unlimited | - |

## Pagination

List endpoints support pagination:

```
GET /analysis?limit=20&offset=40
```

Response includes total count:

```json
{
  "items": [...],
  "total": 150
}
```
