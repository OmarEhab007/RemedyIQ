# EKS Containerization Design Document

**Date**: 2026-03-25  
**Feature**: 013-eks-containerization  
**Status**: Implemented

---

## Problem Statement

RemedyIQ was partially containerized. The backend had a `Dockerfile` with multi-stage builds for `api` and `worker` targets, and the frontend had a separate `Dockerfile`. However, there was no:

1. **Full-stack local development** - `docker-compose.yml` only included infrastructure services (PostgreSQL, ClickHouse, NATS, Redis, MinIO), not the application services
2. **Kubernetes deployment** - No Helm chart for EKS deployment
3. **CI/CD pipeline** - No automated build, test, and deployment workflows
4. **Secret management** - No secure secret injection for production

This created friction for:
- **Developers**: Manual steps required to run the full stack locally
- **Operations**: Manual deployment process, no rollback capability
- **Security**: Secrets potentially exposed in configuration files

---

## Decision Log

### Approach A Chosen: Helm Monorepo + AWS Managed Services

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Helm Monorepo** | Single Helm chart in repo with NATS subchart | Full control, version-controlled, gitops-ready | More YAML to maintain | **CHOSEN** |
| B: Managed NATS | Use NATS Cloud or similar SaaS | Less ops overhead | Vendor lock-in, cost | Rejected |
| C: Raw Kubernetes YAML | No Helm, just kubectl apply | Simpler | No templating, harder env management | Rejected |

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| NATS Helm Chart | `nats` v2.12.5 | Official chart, JetStream support, clustering |
| ALB Idle Timeout | 3600s | SSE streaming can run for minutes; default 60s too short |
| Secret Management | ESO + IRSA | No static AWS keys, short-lived credentials via OIDC |
| ClickHouse Operator | Altinity v0.26.1 | Production-grade, CRD-based cluster management |
| Worker Scaling | Single replica | Bleve single-writer constraint; future: distributed search |
| GitHub Actions Auth | OIDC | No static AWS keys in GitHub Secrets |
| Image Tagging | SHA + environment alias | Immutable SHA tags, mutable aliases for rollback |

---

## Architecture Diagram

```
                                    ┌─────────────────────────────────────────┐
                                    │           AWS EKS Cluster               │
                                    │                                         │
┌──────────┐                        │  ┌──────────────────────────────────┐  │
│  Users   │                        │  │      remedyiq-staging NS         │  │
│          │────────────────────────┼──►  ┌─────────┐  ┌─────────┐       │  │
│          │    HTTPS (ALB)         │  │  │ Frontend│  │   API   │       │  │
└──────────┘                        │  │  │ (2 pods)│  │ (3 pods)│       │  │
                                    │  │  └────┬────┘  └────┬────┘       │  │
                                    │  │       │            │            │  │
                                    │  │       │   ┌────────┴───────┐    │  │
                                    │  │       │   │                │    │  │
                                    │  │       │   ▼                ▼    │  │
                                    │  │       │ ┌──────┐  ┌──────────┐  │  │
                                    │  │       │ │ NATS │  │ ClickHouse│  │  │
                                    │  │       │ │ (3)  │  │   (2)     │  │  │
                                    │  │       │ └──────┘  └──────────┘  │  │
                                    │  │       │                         │  │
                                    │  │       ▼                         │  │
                                    │  │  ┌─────────┐                    │  │
                                    │  │  │ Worker  │ ◄── Bleve PVC     │  │
                                    │  │  │  (1)    │    (single-writer)│  │
                                    │  │  └─────────┘                    │  │
                                    │  └──────────────────────────────────┘  │
                                    │                                         │
                                    │  ┌──────────────────────────────────┐  │
                                    │  │       remedyiq-prod NS           │  │
                                    │  │       (same structure,           │  │
                                    │  │        more replicas)            │  │
                                    │  └──────────────────────────────────┘  │
                                    └─────────────────────────────────────────┘
                                                    │
                                                    ▼
                            ┌───────────────────────────────────────────┐
                            │           AWS Managed Services            │
                            │                                           │
                            │  ┌─────────────┐  ┌─────────────────────┐ │
                            │  │  RDS        │  │   Secrets Manager   │ │
                            │  │ PostgreSQL  │  │  /remedyiq/staging  │ │
                            │  └─────────────┘  │  /remedyiq/prod     │ │
                            │                   └─────────────────────┘ │
                            │                                           │
                            │  ┌─────────────┐  ┌─────────────────────┐ │
                            │  │ ElastiCache │  │        S3           │ │
                            │  │   Redis     │  │   remedyiq-logs-*   │ │
                            │  └─────────────┘  └─────────────────────┘ │
                            └───────────────────────────────────────────┘
```

---

## Service Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │    AWS ALB Ingress      │
                        │  (HTTPS, idle=3600s)    │
                        └───────────┬─────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
          ┌─────────────────┐             ┌─────────────────┐
          │    Frontend     │             │       API       │
          │   (Next.js)     │────────────►│      (Go)       │
          │   Port 3000     │             │    Port 8080    │
          │   HPA: 2-5      │             │    HPA: 2-10    │
          └─────────────────┘             └────────┬────────┘
                                                   │
                    ┌──────────────────────────────┴───────┐
                    │                                      │
                    ▼                                      ▼
          ┌─────────────────┐                    ┌─────────────────┐
          │     Worker      │                    │  Infrastructure │
          │   (Go + JAR)    │                    │                 │
          │   Replicas: 1   │                    │  ┌───────────┐  │
          │   Bleve PVC     │                    │  │ PostgreSQL│  │
          └────────┬────────┘                    │  ├───────────┤  │
                   │                             │  │ClickHouse │  │
                   │                             │  ├───────────┤  │
                   │                             │  │   NATS    │  │
                   │                             │  ├───────────┤  │
                   │                             │  │   Redis   │  │
                   │                             │  ├───────────┤  │
                   │                             │  │    S3     │  │
                   │                             │  └───────────┘  │
                   │                             └─────────────────┘
                   ▼
          ┌─────────────────┐
          │  Bleve Index    │
          │  (PVC 20-50Gi)  │
          └─────────────────┘
```

---

## File Structure

```
.
├── .github/
│   └── workflows/
│       ├── ci.yml                    # PR validation (lint, test, scan)
│       └── deploy.yml                # CD pipeline (staging + prod)
│
├── helm/
│   ├── remedyiq/                     # Main application chart
│   │   ├── Chart.yaml                # v0.1.0, NATS dependency
│   │   ├── Chart.lock                # Pinned NATS 2.12.5
│   │   ├── values.yaml               # Base configuration
│   │   ├── values-staging.yaml       # Staging overrides
│   │   ├── values-prod.yaml          # Production overrides
│   │   └── templates/
│   │       ├── _helpers.tpl          # Label helpers
│   │       ├── configmap.yaml        # Non-secret env vars
│   │       ├── externalsecrets.yaml  # ESO CRD
│   │       ├── api/
│   │       │   ├── serviceaccount.yaml
│   │       │   ├── deployment.yaml
│   │       │   ├── service.yaml
│   │       │   └── hpa.yaml
│   │       ├── worker/
│   │       │   ├── serviceaccount.yaml
│   │       │   ├── pvc.yaml
│   │       │   └── deployment.yaml
│   │       └── frontend/
│   │           ├── deployment.yaml
│   │           ├── service.yaml
│   │           ├── hpa.yaml
│   │           └── ingress.yaml
│   │
│   ├── clickhouse/
│   │   ├── ClusterSecretStore.yaml   # ESO provider
│   │   ├── ClickHouseInstallation-staging.yaml
│   │   └── ClickHouseInstallation-prod.yaml
│   │
│   └── clickhouse-operator/
│       └── values.yaml               # Altinity operator config
│
├── docs/
│   └── ops/
│       ├── cluster-setup-runbook.md
│       ├── secrets-management-runbook.md
│       └── github-environments-setup.md
│
├── docker-compose.yml                # Full-stack local dev
├── .env.example                      # Environment template
├── .dockerignore                     # Excludes secrets from images
└── Makefile                          # Added: docker-up-all, helm-lint, helm-dry-run
```

---

## Checkpoints

| Phase | Checkpoint | Status |
|-------|------------|--------|
| Phase 1 | Directory structure created | ✅ |
| Phase 2 | `helm lint` passes | ✅ |
| Phase 3 | `docker compose up --build` → 8 services healthy | Pending validation |
| Phase 4 | CI workflow syntax valid | Pending PR |
| Phase 5 | `deploy-prod` waits for approval | Pending PR |
| Phase 6 | HPA templates tuned with stabilization | ✅ |
| Phase 7 | Gitleaks in CI, .dockerignore verified | ✅ |
| Phase 8 | All files committed | Pending |

---

## Next Steps

1. **Merge PR** to trigger CI validation
2. **Create GitHub Environments** (staging, production)
3. **Configure AWS IAM** for GitHub OIDC and ESO IRSA
4. **Deploy to staging** to validate end-to-end
5. **Monitor and tune** HPA thresholds based on real traffic
