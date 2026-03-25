# Implementation Plan: EKS Containerization & CI/CD

**Branch**: `013-eks-containerization` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/013-eks-containerization/spec.md`

## Summary

Containerize the RemedyIQ platform for production deployment on AWS EKS. The existing Dockerfiles (backend multi-stage with JRE + JAR, frontend Next.js standalone) are already production-ready — no changes needed. This plan adds:

1. **docker-compose app services** — API, Worker, Frontend added to existing infra-only docker-compose
2. **Helm chart** — `helm/remedyiq/` monorepo chart with NATS subchart, staging/prod values
3. **ClickHouse** — Altinity operator + ClickHouseInstallation CRD
4. **External Secrets** — ClusterSecretStore (IRSA) + ExternalSecret pulling from AWS Secrets Manager
5. **GitHub Actions** — CI (lint/test/scan on PR) + CD (ECR push → staging auto → prod manual gate)

## Technical Context

**Backend Language**: Go 1.24.1 (existing)
**Frontend**: Next.js 16.1.6 / TypeScript 5.x (existing)
**K8s Packaging**: Helm 3.x
**Primary K8s Dependencies**:
- NATS Helm chart 2.12.5 (subchart, JetStream + 3-node cluster)
- Altinity clickhouse-operator 0.26.1 (cluster-wide CRD operator)
- External Secrets Operator (cluster-wide, IRSA auth)
- AWS Load Balancer Controller (cluster-wide, ALB Ingress)
**Storage (production)**:
- AWS RDS PostgreSQL 16 (managed)
- AWS ElastiCache Redis 7 (managed)
- AWS S3 (managed, replaces MinIO)
- NATS StatefulSet (in-cluster, K8s)
- ClickHouse StatefulSet (in-cluster, via Altinity operator)
**Target Platform**: AWS EKS (K8s 1.28+), Linux Alpine containers
**Performance Goals**:
- Staging deployment completes in < 10 min from merge to healthy pods
- Worker: 1 replica (Bleve single-writer constraint; revisit if search index replaced)
- API: 2-10 replicas (HPA, 60% CPU threshold)
**Constraints**:
- Backend Dockerfile build context is **repo root** (copies JAR from `ARLogAnalyzer/ARLogAnalyzer-3/`)
- Frontend `NEXT_PUBLIC_*` vars must be provided at build time (Next.js constraint)
- Bleve search index requires single-writer (no multi-replica worker until distributed search adopted)
- ALB idle timeout must be ≥ 3600s for SSE/WebSocket streaming
**Scale/Scope**: 3 app namespaces (local/staging/prod), 2 environments deployed via Helm

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| I. Wrapper-First | JAR must run as subprocess in Worker container | ✅ PASS | Worker image already bundles JRE + JAR.jar at `/app/ARLogAnalyzer.jar` |
| II. API-First | No new API capabilities without OpenAPI contract | ✅ PASS | No new API endpoints; existing contracts unchanged |
| III. Test-First | CI runs tests before deploy | ✅ PASS | CI pipeline runs `go test ./...` and helm lint before any deploy |
| IV. AI as Skill | N/A — no AI features added | ✅ N/A | |
| V. Multi-Tenant | Tenant isolation preserved | ✅ PASS | Containerization doesn't change application code; RLS/scoping unchanged |
| VI. Simplicity Gate | Max 3 deployable app services | ✅ PASS | Exactly 3 services: api, worker, frontend. NATS/ClickHouse/ESO are infrastructure, not app services |
| VII. Log Format Fidelity | N/A — no parser changes | ✅ N/A | |
| VIII. Streaming-Ready | WebSocket/SSE must work through ALB | ✅ PASS | ALB native WebSocket support; idle_timeout=3600s + stickiness configured |
| IX. Incremental Delivery | Feature independently deployable | ✅ PASS | docker-compose works independently; K8s manifests deployable independently |

**Technology Constraints compliance**:
- "Containerization: Docker with Docker Compose for local dev, Kubernetes for production" — this plan explicitly implements what the constitution mandates. ✅

**No violations. No complexity tracking required.**

## Project Structure

### Documentation (this feature)

```text
specs/013-eks-containerization/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research (resolved)
├── data-model.md        # Helm values schema + secret structure
├── quickstart.md        # Local dev + production deployment guide
├── contracts/
│   └── README.md        # No new API contracts (infra-only feature)
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
docker-compose.yml           # MODIFIED — add api, worker, frontend services

helm/
├── remedyiq/                # NEW — main application Helm chart
│   ├── Chart.yaml           # chart metadata + NATS dependency
│   ├── Chart.lock           # pinned dependency versions
│   ├── values.yaml          # base defaults (all environments)
│   ├── values-staging.yaml  # staging overrides
│   ├── values-prod.yaml     # production overrides
│   └── templates/
│       ├── _helpers.tpl     # shared template helpers
│       ├── configmap.yaml   # non-secret env vars
│       ├── externalsecrets.yaml  # ExternalSecret + ClusterSecretStore ref
│       ├── api/
│       │   ├── deployment.yaml
│       │   ├── service.yaml
│       │   ├── serviceaccount.yaml
│       │   └── hpa.yaml
│       ├── worker/
│       │   ├── deployment.yaml
│       │   ├── pvc.yaml     # Bleve index PersistentVolumeClaim
│       │   └── serviceaccount.yaml
│       └── frontend/
│           ├── deployment.yaml
│           ├── service.yaml
│           └── ingress.yaml
├── clickhouse-operator/     # NEW — Altinity operator install values
│   └── values.yaml
└── clickhouse/              # NEW — ClickHouseInstallation CRD resources
    ├── ClickHouseInstallation-staging.yaml
    ├── ClickHouseInstallation-prod.yaml
    └── ClusterSecretStore.yaml

.github/
└── workflows/
    ├── ci.yml               # NEW — PR validation pipeline
    └── deploy.yml           # NEW — staging + production CD pipeline

docs/
└── plans/
    └── 2026-03-25-containerization-design.md  # NEW — design doc from brainstorm
```

**Structure Decision**: Single Helm monorepo chart (`helm/remedyiq/`) with environment-specific values files. ClickHouse managed separately via CRD (not a Helm subchart) because the Altinity operator is cluster-scoped.

## Implementation Phases

### Phase A: docker-compose Complete Stack

**Goal**: `docker compose up` starts all 8 services, end-to-end flow works locally.

**Files to modify**:
- `docker-compose.yml` — add `api`, `worker`, `frontend` services

**Key decisions**:
- App services use `env_file: .env` for base config, with `environment:` block overriding service hostnames
- Backend build context: `.` (repo root), dockerfile: `backend/Dockerfile`
- Frontend build context: `./frontend`, dockerfile: `Dockerfile`
- Worker and API both get `bleve_data:/app/data` volume mount (worker writes, api reads)
- ClickHouse URL in containers uses port `9000` (internal), not `9004` (macOS host remap)
- `JAR_PATH` overridden to `/app/ARLogAnalyzer.jar` (container path, not local relative path)

**Environment variable overrides per service**:
```yaml
# api and worker services:
environment:
  POSTGRES_URL: postgres://remedyiq:remedyiq@postgres:5432/remedyiq?sslmode=disable
  CLICKHOUSE_URL: clickhouse://clickhouse:9000/remedyiq
  NATS_URL: nats://nats:4222
  REDIS_URL: redis://redis:6379
  S3_ENDPOINT: http://minio:9000
  JAR_PATH: /app/ARLogAnalyzer.jar

# frontend service:
environment:
  NEXT_PUBLIC_API_URL: http://api:8080
```

**Verification**: `docker compose up --build` → `curl http://localhost:8080/api/v1/health` → 200 OK, `curl http://localhost:3000` → HTML.

---

### Phase B: Helm Chart — Base + Templates

**Goal**: `helm lint` passes; `helm template` renders valid K8s YAML for all resources.

**Files to create**:
- `helm/remedyiq/Chart.yaml` (includes NATS dependency at v2.12.5)
- `helm/remedyiq/values.yaml` (base schema — see data-model.md)
- `helm/remedyiq/values-staging.yaml`
- `helm/remedyiq/values-prod.yaml`
- `helm/remedyiq/templates/_helpers.tpl` (name, labels, selector helpers)
- `helm/remedyiq/templates/configmap.yaml` (non-secret env vars)
- `helm/remedyiq/templates/externalsecrets.yaml` (ExternalSecret CRD pulling from AWS Secrets Manager)

**Key template decisions**:
- All resource names use `{{ include "remedyiq.fullname" . }}-<component>` pattern
- Labels: `app.kubernetes.io/name`, `app.kubernetes.io/component`, `app.kubernetes.io/version`
- `envFrom` on all pods: `configMapRef: remedyiq-config` + `secretRef: remedyiq-secrets`

---

### Phase C: API + Frontend Kubernetes Resources

**Goal**: API and frontend Deployments, Services, HPAs, Ingress fully templated.

**Files to create**:
- `helm/remedyiq/templates/api/deployment.yaml` — liveness/readiness at `/api/v1/health:8080`
- `helm/remedyiq/templates/api/service.yaml` — ClusterIP, port 8080
- `helm/remedyiq/templates/api/serviceaccount.yaml`
- `helm/remedyiq/templates/api/hpa.yaml` — CPU-based scaling
- `helm/remedyiq/templates/frontend/deployment.yaml` — liveness/readiness at `/:3000`
- `helm/remedyiq/templates/frontend/service.yaml` — ClusterIP, port 3000
- `helm/remedyiq/templates/frontend/ingress.yaml` — ALB annotations, host from values, idle_timeout=3600, stickiness
- `helm/remedyiq/templates/frontend/hpa.yaml`

**ALB Ingress annotations** (critical):
```yaml
alb.ingress.kubernetes.io/scheme: internet-facing
alb.ingress.kubernetes.io/target-type: ip
alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
alb.ingress.kubernetes.io/certificate-arn: "{{ .Values.frontend.ingress.certificateArn }}"
alb.ingress.kubernetes.io/ssl-redirect: '443'
alb.ingress.kubernetes.io/load-balancer-attributes: idle_timeout.timeout_seconds=3600
alb.ingress.kubernetes.io/target-group-attributes: >-
  stickiness.enabled=true,stickiness.lb_cookie.duration_seconds=60
```

---

### Phase D: Worker + Bleve Persistence

**Goal**: Worker Deployment with JRE available, Bleve index on persistent disk.

**Files to create**:
- `helm/remedyiq/templates/worker/deployment.yaml` — no external port, PVC mount at `/app/data`
- `helm/remedyiq/templates/worker/pvc.yaml` — `ReadWriteOnce`, size from values
- `helm/remedyiq/templates/worker/serviceaccount.yaml`

**Worker deployment constraints**:
- `replicas: 1` (Bleve single-writer)
- No HPA (adding replicas would corrupt the Bleve index)
- PVC mounted at `/app/data`
- `strategy.type: Recreate` (not RollingUpdate — new pod must not start until old pod releases PVC)

---

### Phase E: ClickHouse Manifests

**Goal**: ClickHouseInstallation CRD files for staging and production.

**Files to create**:
- `helm/clickhouse-operator/values.yaml` — Altinity operator install values
- `helm/clickhouse/ClickHouseInstallation-staging.yaml` — 1 shard, 1 replica, 20Gi storage
- `helm/clickhouse/ClickHouseInstallation-prod.yaml` — 1 shard, 2 replicas, 500Gi storage
- `helm/clickhouse/ClusterSecretStore.yaml` — ESO ClusterSecretStore for AWS Secrets Manager

---

### Phase F: GitHub Actions CI/CD

**Goal**: PR checks gate merge; merging to main auto-deploys staging and gates production.

**Files to create**:

#### `.github/workflows/ci.yml`
```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  lint-go:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.24' }
      - uses: golangci/golangci-lint-action@v6
        with: { working-directory: backend }

  lint-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
        working-directory: frontend
      - run: npm run lint
        working-directory: frontend

  test-go:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.24' }
      - run: go test ./...
        working-directory: backend

  build-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build API image
        run: docker build -f backend/Dockerfile --target api -t remedyiq/api:ci .
      - name: Build Worker image
        run: docker build -f backend/Dockerfile --target worker -t remedyiq/worker:ci .
      - name: Build Frontend image
        run: docker build -t remedyiq/frontend:ci ./frontend
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: remedyiq/api:ci
          exit-code: '1'
          severity: HIGH,CRITICAL
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: remedyiq/worker:ci
          exit-code: '1'
          severity: HIGH,CRITICAL
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: remedyiq/frontend:ci
          exit-code: '1'
          severity: HIGH,CRITICAL

  helm-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/setup-helm@v4
      - run: helm dependency update helm/remedyiq
      - run: helm lint helm/remedyiq -f helm/remedyiq/values-staging.yaml
      - run: helm lint helm/remedyiq -f helm/remedyiq/values-prod.yaml
```

#### `.github/workflows/deploy.yml`
```yaml
name: Deploy
on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: ${{ vars.AWS_REGION }}
  ECR_REGISTRY: ${{ vars.AWS_ACCOUNT_ID }}.dkr.ecr.${{ vars.AWS_REGION }}.amazonaws.com
  SHA: ${{ github.sha }}
  SHORT_SHA: ${{ github.sha[:7] }}

jobs:
  build-push:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.tag.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ vars.AWS_ROLE_TO_ASSUME }}
          aws-region: ${{ vars.AWS_REGION }}
      - uses: aws-actions/amazon-ecr-login@v2
      - id: tag
        run: echo "tag=${SHA::7}" >> $GITHUB_OUTPUT
      - name: Build and push API
        run: |
          docker build -f backend/Dockerfile --target api \
            -t $ECR_REGISTRY/remedyiq/api:${{ steps.tag.outputs.tag }} \
            -t $ECR_REGISTRY/remedyiq/api:staging-latest .
          docker push $ECR_REGISTRY/remedyiq/api:${{ steps.tag.outputs.tag }}
          docker push $ECR_REGISTRY/remedyiq/api:staging-latest
      - name: Build and push Worker
        run: |
          docker build -f backend/Dockerfile --target worker \
            -t $ECR_REGISTRY/remedyiq/worker:${{ steps.tag.outputs.tag }} \
            -t $ECR_REGISTRY/remedyiq/worker:staging-latest .
          docker push $ECR_REGISTRY/remedyiq/worker:${{ steps.tag.outputs.tag }}
          docker push $ECR_REGISTRY/remedyiq/worker:staging-latest
      - name: Build and push Frontend
        run: |
          docker build ./frontend \
            -t $ECR_REGISTRY/remedyiq/frontend:${{ steps.tag.outputs.tag }} \
            -t $ECR_REGISTRY/remedyiq/frontend:staging-latest
          docker push $ECR_REGISTRY/remedyiq/frontend:${{ steps.tag.outputs.tag }}
          docker push $ECR_REGISTRY/remedyiq/frontend:staging-latest

  deploy-staging:
    needs: build-push
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ vars.AWS_ROLE_TO_ASSUME }}
          aws-region: ${{ vars.AWS_REGION }}
      - run: aws eks update-kubeconfig --name ${{ vars.EKS_CLUSTER_NAME }} --region ${{ vars.AWS_REGION }}
      - uses: azure/setup-helm@v4
      - run: helm dependency update helm/remedyiq
      - run: |
          helm upgrade --install remedyiq-staging helm/remedyiq \
            --namespace remedyiq-staging \
            -f helm/remedyiq/values-staging.yaml \
            --set image.tag=${{ needs.build-push.outputs.image-tag }} \
            --set image.registry=${{ vars.AWS_ACCOUNT_ID }}.dkr.ecr.${{ vars.AWS_REGION }}.amazonaws.com \
            --wait --timeout 10m

  deploy-prod:
    needs: [build-push, deploy-staging]
    runs-on: ubuntu-latest
    environment: production        # requires GitHub Environment approval
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ vars.AWS_ROLE_TO_ASSUME }}
          aws-region: ${{ vars.AWS_REGION }}
      - run: aws eks update-kubeconfig --name ${{ vars.EKS_CLUSTER_NAME }} --region ${{ vars.AWS_REGION }}
      - uses: azure/setup-helm@v4
      - uses: aws-actions/amazon-ecr-login@v2
      - name: Tag images as prod-latest
        run: |
          TAG=${{ needs.build-push.outputs.image-tag }}
          REG=${{ vars.AWS_ACCOUNT_ID }}.dkr.ecr.${{ vars.AWS_REGION }}.amazonaws.com
          for svc in api worker frontend; do
            docker pull $REG/remedyiq/$svc:$TAG
            docker tag $REG/remedyiq/$svc:$TAG $REG/remedyiq/$svc:prod-latest
            docker push $REG/remedyiq/$svc:prod-latest
          done
      - run: helm dependency update helm/remedyiq
      - run: |
          helm upgrade --install remedyiq-prod helm/remedyiq \
            --namespace remedyiq-prod \
            -f helm/remedyiq/values-prod.yaml \
            --set image.tag=${{ needs.build-push.outputs.image-tag }} \
            --set image.registry=${{ vars.AWS_ACCOUNT_ID }}.dkr.ecr.${{ vars.AWS_REGION }}.amazonaws.com \
            --wait --timeout 15m
```

---

### Phase G: Design Documentation

**Goal**: Commit brainstorming design doc before any infrastructure code.

**File to create**: `docs/plans/2026-03-25-containerization-design.md`

Content: Architecture decisions, approach comparison (A vs B vs C), annotated diagrams of the service topology.

---

## Verification

### Local (docker-compose)
```bash
docker compose build                        # all 3 images build without error
docker compose up -d
sleep 30
curl http://localhost:8080/api/v1/health    # → 200 OK {"status":"ok"}
curl http://localhost:3000                  # → HTML (200 OK)
docker compose logs worker | grep -i "started\|listening"  # worker running
docker compose stop && docker compose up -d  # restart — data persists
curl http://localhost:8080/api/v1/health    # still 200
docker compose down -v                     # clean teardown
```

### Helm (dry-run)
```bash
helm dependency update helm/remedyiq
helm lint helm/remedyiq -f helm/remedyiq/values-staging.yaml
helm lint helm/remedyiq -f helm/remedyiq/values-prod.yaml
helm template remedyiq-staging helm/remedyiq -f helm/remedyiq/values-staging.yaml \
  --set image.tag=abc1234 | kubectl apply --dry-run=client -f -
```

### GitHub Actions CI
- Open a PR → CI workflow runs → all 5 jobs green ✅
- Introduce a known CVE → `build-scan` job fails ✅

### Staging deploy
- Merge PR to main → `deploy.yml` triggers → `build-push` completes → `deploy-staging` succeeds
- `kubectl get pods -n remedyiq-staging` → all pods in `Running` state
- `kubectl exec -n remedyiq-staging deploy/remedyiq-staging-api -- wget -qO- http://localhost:8080/api/v1/health`

### Production deploy
- Approve the `production` environment gate in GitHub Actions
- `kubectl get pods -n remedyiq-prod` → all pods `Running`
- `helm history remedyiq-prod -n remedyiq-prod` → release listed with status `deployed`
- Trigger rollback: `helm rollback remedyiq-prod -n remedyiq-prod` → completes in < 5 min

## Generated Artifacts

| File | Phase | Status |
|------|-------|--------|
| `specs/013-eks-containerization/research.md` | 0 | ✅ Done |
| `specs/013-eks-containerization/data-model.md` | 1 | ✅ Done |
| `specs/013-eks-containerization/contracts/README.md` | 1 | ✅ Done |
| `specs/013-eks-containerization/quickstart.md` | 1 | ✅ Done |
| `specs/013-eks-containerization/tasks.md` | 2 | Pending — run `/speckit.tasks` |
