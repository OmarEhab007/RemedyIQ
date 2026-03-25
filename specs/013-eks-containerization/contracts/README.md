# API Contracts: EKS Containerization

This feature introduces **no new REST API endpoints or WebSocket contracts**.

The feature is purely infrastructure/DevOps:
- docker-compose service additions
- Helm chart packaging
- GitHub Actions pipelines
- Kubernetes manifests

All existing API contracts from prior features remain unchanged. See `specs/001-remedyiq-mvp/contracts/openapi.yaml` for the existing REST API specification.

## Infrastructure Contracts (Non-API)

### Health Check Endpoints (existing, unchanged)

| Service | Endpoint | Method | Success |
|---------|----------|--------|---------|
| API | `/api/v1/health` | GET | 200 OK |
| Frontend | `/` | GET | 200 OK |
| Worker | `pgrep -f worker` | process check | exit 0 |

These endpoints are referenced by:
- Kubernetes liveness and readiness probes
- docker-compose `healthcheck` directives
- GitHub Actions deployment verification steps

### Container Image Interface

Each built image exposes:
- A single process as `CMD` (no supervisord or multi-process)
- Health check via HTTP (api, frontend) or process check (worker)
- Configuration exclusively via environment variables (12-factor)
- Graceful shutdown on `SIGTERM` (Go default handler, Next.js handles this)
