# Data Model: EKS Containerization & CI/CD

**Feature**: 013-eks-containerization
**Phase**: 1 — Design
**Date**: 2026-03-25

This feature introduces no database schema changes. The "data model" for this feature is the **configuration schema**: Helm values hierarchy, environment configuration, secret structure, and image tagging.

---

## 1. Helm Values Hierarchy

The single `helm/remedyiq/` chart uses a three-layer values merge:

```
values.yaml             (base defaults, committed)
    ↓ merged with
values-staging.yaml     (staging overrides, committed)
    ↓ or merged with
values-prod.yaml        (production overrides, committed)
    ↓ merged with
--set image.tag=<sha>   (per-deployment, supplied by CI/CD pipeline)
```

### Base Values Schema

```yaml
# helm/remedyiq/values.yaml

image:
  registry: string          # ECR registry URL (e.g., 123456789.dkr.ecr.us-east-1.amazonaws.com)
  pullPolicy: string        # IfNotPresent | Always | Never
  tag: string               # default "latest"; overridden per deploy with git SHA

api:
  replicas: int             # desired replica count (base: 3)
  resources:
    requests:
      cpu: string           # e.g., "250m"
      memory: string        # e.g., "256Mi"
    limits:
      cpu: string
      memory: string
  hpa:
    enabled: bool
    minReplicas: int        # base: 2
    maxReplicas: int        # base: 10
    targetCPUUtilization: int   # percentage, base: 60
  podAntiAffinity: string   # "preferred" | "required" | "" (disabled)

worker:
  replicas: int             # base: 1 (Bleve single-writer constraint)
  resources:
    requests:
      cpu: string           # e.g., "500m" (JRE needs more)
      memory: string        # e.g., "1Gi"
    limits:
      cpu: string           # e.g., "2000m"
      memory: string        # e.g., "4Gi"
  bleveStorage:
    size: string            # PVC size, e.g., "20Gi"
    storageClass: string    # e.g., "gp3"

frontend:
  replicas: int             # base: 2
  resources:
    requests:
      cpu: string
      memory: string
    limits:
      cpu: string
      memory: string
  hpa:
    enabled: bool
    minReplicas: int
    maxReplicas: int
    targetCPUUtilization: int
  ingress:
    host: string            # e.g., "app.remedyiq.com"
    certificateArn: string  # ACM cert ARN for HTTPS
    annotations: map        # additional ALB annotations

secrets:
  storeName: string         # ClusterSecretStore name, e.g., "aws-secretsmanager"
  managerPath: string       # AWS Secrets Manager path, e.g., "/remedyiq/prod"

nats:                       # NATS subchart values (passed through)
  enabled: bool
  config:
    jetstream:
      enabled: bool
    cluster:
      enabled: bool
      replicas: int

clickhouse:
  enabled: bool             # toggle ClickHouseInstallation creation
  shardsCount: int          # base: 1
  replicasCount: int        # base: 1 (staging), 2 (prod)
  storage:
    size: string            # e.g., "100Gi"
    storageClass: string    # e.g., "gp3"
```

### Staging Overrides (`values-staging.yaml`)

```yaml
image:
  tag: staging-latest

api:
  replicas: 1
  hpa:
    minReplicas: 1
    maxReplicas: 3

worker:
  replicas: 1
  bleveStorage:
    size: 10Gi

frontend:
  replicas: 1
  hpa:
    minReplicas: 1
    maxReplicas: 2
  ingress:
    host: staging.remedyiq.com

secrets:
  managerPath: /remedyiq/staging

nats:
  config:
    cluster:
      enabled: false   # single-node for staging cost savings
      replicas: 1

clickhouse:
  replicasCount: 1
  storage:
    size: 20Gi
```

### Production Overrides (`values-prod.yaml`)

```yaml
image:
  tag: prod-latest

api:
  podAntiAffinity: preferred

frontend:
  ingress:
    host: app.remedyiq.com

secrets:
  managerPath: /remedyiq/prod

nats:
  config:
    cluster:
      enabled: true
      replicas: 3

clickhouse:
  replicasCount: 2         # 2 replicas for HA
  storage:
    size: 500Gi
```

---

## 2. Secret Structure (AWS Secrets Manager)

Secrets are stored as a single JSON object per environment path. ESO extracts individual properties.

### Path: `/remedyiq/staging` and `/remedyiq/prod`

```json
{
  "postgres_url": "postgres://user:pass@host:5432/remedyiq?sslmode=require",
  "clickhouse_url": "clickhouse://user:pass@host:9000/remedyiq",
  "redis_url": "redis://:pass@host:6379",
  "nats_url": "nats://host:4222",
  "s3_access_key": "AKIA...",
  "s3_secret_key": "...",
  "s3_bucket": "remedyiq-logs-prod",
  "clerk_secret_key": "sk_live_...",
  "google_api_key": "AIza...",
  "anthropic_api_key": ""
}
```

### Injected K8s Secret (`remedyiq-secrets`)

ESO creates a K8s Secret with these keys, consumed via `envFrom.secretRef` in all Deployments:

| Secret Key | Used By | Description |
|-----------|---------|-------------|
| `POSTGRES_URL` | api, worker | PostgreSQL connection string |
| `CLICKHOUSE_URL` | api, worker | ClickHouse connection string |
| `REDIS_URL` | api, worker | Redis connection string |
| `NATS_URL` | api, worker | NATS connection string |
| `S3_ACCESS_KEY` | api, worker | Object storage access key |
| `S3_SECRET_KEY` | api, worker | Object storage secret key |
| `S3_BUCKET` | api, worker | S3 bucket name |
| `CLERK_SECRET_KEY` | api | Auth provider secret |
| `GOOGLE_API_KEY` | api | Gemini AI API key |
| `ANTHROPIC_API_KEY` | api | Claude API key (optional) |

---

## 3. Container Image Tags

| Image | ECR Path | Tags |
|-------|----------|------|
| API | `<registry>/remedyiq/api` | `<7-char-sha>`, `staging-latest` or `prod-latest` |
| Worker | `<registry>/remedyiq/worker` | `<7-char-sha>`, `staging-latest` or `prod-latest` |
| Frontend | `<registry>/remedyiq/frontend` | `<7-char-sha>`, `staging-latest` or `prod-latest` |

**Immutability**: SHA-tagged images are never overwritten. Environment alias tags are mutable (updated by pipeline).

---

## 4. K8s Resource Inventory

Per environment namespace (`remedyiq-staging`, `remedyiq-prod`):

| Resource | Name | Kind | Notes |
|---------|------|------|-------|
| `remedyiq-api` | Deployment | api server | 3 replicas (prod), 1 (staging) |
| `remedyiq-api` | Service | ClusterIP | port 8080 |
| `remedyiq-api-hpa` | HPA | scales api | CPU-based |
| `remedyiq-worker` | Deployment | background worker | 1 replica |
| `worker-bleve-index` | PVC | ReadWriteOnce | Bleve search index |
| `remedyiq-frontend` | Deployment | Next.js | 2 replicas (prod) |
| `remedyiq-frontend` | Service | ClusterIP | port 3000 |
| `remedyiq-frontend` | Ingress | ALB | internet-facing |
| `remedyiq-frontend-hpa` | HPA | scales frontend | CPU-based |
| `remedyiq-config` | ConfigMap | non-secret env vars | |
| `remedyiq-secrets` | Secret | managed by ESO | |
| `remedyiq-secrets-ext` | ExternalSecret | pulls from Secrets Manager | |

Cluster-scoped (one per cluster, not per namespace):
| Resource | Kind | Notes |
|---------|------|-------|
| `aws-secretsmanager` | ClusterSecretStore | ESO provider |
| `remedyiq` | ClickHouseInstallation | Altinity CRD |
| NATS StatefulSet | via NATS Helm subchart | 3 replicas (prod), 1 (staging) |

---

## 5. Environment Variable Model

### Non-Secret (ConfigMap `remedyiq-config`)

```yaml
ENVIRONMENT: staging          # or production
API_PORT: "8080"
LOG_LEVEL: info               # debug in staging
JAR_PATH: /app/ARLogAnalyzer.jar
JAR_DEFAULT_HEAP_MB: "4096"
JAR_TIMEOUT_SEC: "1800"
S3_ENDPOINT: ""               # empty = use native AWS S3 (not MinIO)
S3_USE_SSL: "true"
S3_SKIP_BUCKET_VERIFICATION: "false"
```

### Secret (from `remedyiq-secrets` via ESO)

See section 2 above.

### Frontend-specific (injected at build time via ARG, or at runtime via env)

Next.js public env vars (prefixed `NEXT_PUBLIC_`) must be known at build time:
- `NEXT_PUBLIC_API_URL` — API base URL (e.g., `https://api.remedyiq.com`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk public key (non-secret)

These are passed as build args during `docker build` in the CI pipeline.
