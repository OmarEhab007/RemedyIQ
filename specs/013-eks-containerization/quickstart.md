# Quickstart: EKS Containerization & CI/CD

**Feature**: 013-eks-containerization
**Date**: 2026-03-25

---

## Local Development (docker-compose)

### Prerequisites
- Docker Desktop (or Docker Engine + Docker Compose v2)
- `.env` file in repo root (copy from `.env.example`)

### Start everything
```bash
docker compose up --build
```

This starts: PostgreSQL, ClickHouse, NATS, Redis, MinIO, minio-init, **API**, **Worker**, **Frontend**.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8080/api/v1/health |
| ClickHouse HTTP | http://localhost:8123 |
| MinIO Console | http://localhost:9001 |
| NATS monitoring | http://localhost:8222 |

### Stop (preserving data)
```bash
docker compose stop
```

### Full reset (wipe all data)
```bash
docker compose down -v
```

### View logs for a specific service
```bash
docker compose logs -f api
docker compose logs -f worker
```

### Rebuild after code changes
```bash
docker compose up --build api worker  # rebuild only changed services
```

---

## Production Deployment (AWS EKS)

### Prerequisites (one-time cluster setup)

1. **AWS account** with EKS cluster and ECR registry provisioned
2. **GitHub OIDC provider** configured in AWS IAM:
   ```bash
   # Provider URL: https://token.actions.githubusercontent.com
   # Audience: sts.amazonaws.com
   ```
3. **IAM role** `github-actions-remedyiq` with trust policy for this repo (see `research.md` section 5)
4. **Install cluster add-ons** (run once per cluster):
   ```bash
   # External Secrets Operator
   helm repo add external-secrets https://charts.external-secrets.io
   helm install external-secrets external-secrets/external-secrets \
     --namespace external-secrets --create-namespace

   # Altinity ClickHouse Operator
   helm repo add altinity https://docs.altinity.com/clickhouse-operator/
   helm install clickhouse-operator altinity/altinity-clickhouse-operator \
     --namespace kube-system

   # AWS Load Balancer Controller (via EKS add-on or Helm)
   # (Follow AWS documentation for your cluster version)
   ```
5. **Create namespaces**:
   ```bash
   kubectl create namespace remedyiq-staging
   kubectl create namespace remedyiq-prod
   ```
6. **Configure AWS Secrets Manager** paths `/remedyiq/staging` and `/remedyiq/prod` with secret JSON (see `data-model.md` section 2)
7. **Apply ClusterSecretStore** (after ESO installed):
   ```bash
   kubectl apply -f helm/clickhouse/ClusterSecretStore.yaml
   ```
8. **Create ECR repositories**:
   ```bash
   aws ecr create-repository --repository-name remedyiq/api
   aws ecr create-repository --repository-name remedyiq/worker
   aws ecr create-repository --repository-name remedyiq/frontend
   ```
9. **Set GitHub repository secrets/variables**:
   - `AWS_ACCOUNT_ID`
   - `AWS_REGION`
   - `EKS_CLUSTER_NAME`
   - `AWS_ROLE_TO_ASSUME` (ARN of `github-actions-remedyiq` role)
   - GitHub Environment `production` with required reviewers

### Deploy ClickHouse cluster (one-time per namespace)
```bash
kubectl apply -f helm/clickhouse/ClickHouseInstallation.yaml -n remedyiq-staging
kubectl apply -f helm/clickhouse/ClickHouseInstallation-prod.yaml -n remedyiq-prod
```

### Manual deploy (staging)
```bash
helm dependency update helm/remedyiq
helm upgrade --install remedyiq-staging helm/remedyiq \
  --namespace remedyiq-staging \
  -f helm/remedyiq/values-staging.yaml \
  --set image.tag=<git-sha>
```

### Manual deploy (production)
```bash
helm upgrade --install remedyiq-prod helm/remedyiq \
  --namespace remedyiq-prod \
  -f helm/remedyiq/values-prod.yaml \
  --set image.tag=<git-sha>
```

### Rollback
```bash
# List history
helm history remedyiq-prod -n remedyiq-prod

# Roll back to previous release
helm rollback remedyiq-prod -n remedyiq-prod
```

### Check pod status
```bash
kubectl get pods -n remedyiq-staging
kubectl get pods -n remedyiq-prod
```

---

## CI/CD Pipeline

### Automated flows

| Trigger | Pipeline | Actions |
|---------|----------|---------|
| Pull Request opened/updated | `ci.yml` | Lint → Test → Build → Security scan |
| Merge to `main` | `deploy.yml` | Build → Push ECR → Deploy staging → [Gate] → Deploy prod |

### CI checks (on PR)
- Go lint (`golangci-lint`)
- Frontend lint (`npm run lint`)
- Go tests (`go test ./...`)
- Frontend tests (`npm test`, if present)
- Docker image build (all 3)
- Trivy security scan (fail on HIGH/CRITICAL CVEs)

### CD flow (on merge to main)
1. Build 3 images, tag with `${{ github.sha }}` + `staging-latest`
2. Push to ECR
3. `helm upgrade` to `remedyiq-staging` (automatic)
4. Wait for pods healthy
5. **Manual approval gate** in GitHub → environment `production`
6. Tag images `prod-latest`
7. `helm upgrade` to `remedyiq-prod`

### Approving a production deployment
1. Go to GitHub Actions → the running `deploy.yml` workflow
2. Find the `deploy-prod` job waiting for review
3. Click **Review deployments** → select `production` → **Approve and deploy**

---

## Helm Chart Validation (local)

```bash
# Update subchart dependencies
helm dependency update helm/remedyiq

# Lint
helm lint helm/remedyiq -f helm/remedyiq/values-staging.yaml

# Dry-run render (preview all manifests)
helm template remedyiq-staging helm/remedyiq \
  -f helm/remedyiq/values-staging.yaml \
  --set image.tag=abc1234 \
  | kubectl apply --dry-run=client -f -
```
