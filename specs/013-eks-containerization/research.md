# Research: EKS Containerization & CI/CD

**Feature**: 013-eks-containerization
**Phase**: 0 — Research
**Date**: 2026-03-25

## 1. NATS Helm Chart

**Decision**: Use NATS official Helm chart v2.12.5 from `https://nats-io.github.io/k8s/helm/charts/`
**Rationale**: Official chart, actively maintained by NATS team, supports JetStream and clustering natively.
**Alternatives considered**: Self-managed StatefulSet YAML (rejected — more maintenance burden with no benefit).

**Key configuration** (values to embed as subchart in `helm/remedyiq/Chart.yaml`):
```yaml
# Chart.yaml dependency:
- name: nats
  version: "2.12.5"
  repository: "https://nats-io.github.io/k8s/helm/charts/"
  condition: nats.enabled

# values.yaml NATS section:
nats:
  enabled: true
  config:
    jetstream:
      enabled: true
      fileStore:
        enabled: true
        path: /data
      memoryStore:
        maxSize: 1Gi
    cluster:
      enabled: true
      port: 6222
      replicas: 3   # must be ≥2 when JetStream enabled; 3 for proper quorum
```

**Constraint**: The NATS chart requires ≥2 replicas when JetStream is enabled. Staging should use `replicas: 1` with JetStream enabled but clustering disabled to save resources.

---

## 2. AWS ALB + WebSocket/SSE Support

**Decision**: AWS ALB natively supports WebSocket upgrades — no special routing config needed.
**Rationale**: ALB handles the HTTP Upgrade handshake transparently. Only idle timeout needs explicit configuration.
**Alternatives considered**: NLB (Network Load Balancer) — supports WebSocket but no HTTP-level routing; rejected in favor of ALB for path-based routing.

**Required annotations for long-lived connections** (SSE streaming for AI assistant, WebSocket for log tailing):
```yaml
alb.ingress.kubernetes.io/load-balancer-attributes: >-
  idle_timeout.timeout_seconds=3600
alb.ingress.kubernetes.io/target-group-attributes: >-
  stickiness.enabled=true,stickiness.lb_cookie.duration_seconds=60
```

**Timeout rationale**: Default ALB idle timeout is 60s — too short for streaming log analysis (can run minutes). Set to 3600s (max recommended is 4000s per AWS limits).

---

## 3. External Secrets Operator (ESO) with IRSA

**Decision**: ClusterSecretStore using IRSA (IAM Roles for Service Accounts) — no static credentials.
**Rationale**: IRSA provides short-lived credentials via OIDC token projection. No long-lived AWS keys stored in K8s.
**Alternatives considered**: Kubernetes native Secrets with manually managed AWS keys (rejected — static keys are a security risk, rotation is manual).

**ESO Service Account** (annotated for IRSA):
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: external-secrets
  namespace: external-secrets
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::<ACCOUNT_ID>:role/external-secrets-role
```

**ClusterSecretStore** (AWS Secrets Manager, IRSA-based):
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secretsmanager
spec:
  provider:
    aws:
      service: SecretsManager
      region: <AWS_REGION>
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets
            namespace: external-secrets
```

**IAM policy** for the IRSA role must allow: `secretsmanager:GetSecretValue`, `secretsmanager:DescribeSecret`.

**Propagation**: ESO's `refreshInterval: 1h` in ExternalSecret CRDs satisfies FR-011 (propagate within 60 minutes).

---

## 4. Altinity ClickHouse Operator

**Decision**: Altinity `altinity-clickhouse-operator` Helm chart v0.26.1.
**Rationale**: Production-grade operator for ClickHouse on K8s, actively maintained, supports CRD-based ClickHouse cluster management.
**Alternatives considered**: ClickHouse Cloud (managed SaaS) — evaluated but rejected per user preference for self-hosted; raw StatefulSet without operator — rejected, too much YAML maintenance.

**Helm repo**: Add `https://docs.altinity.com/clickhouse-operator/` (chart: `altinity-clickhouse-operator`).

**ClickHouseInstallation CRD** (single-shard, single-replica for dev; extend for prod):
```yaml
apiVersion: clickhouse.altinity.com/v1
kind: ClickHouseInstallation
metadata:
  name: remedyiq
  namespace: remedyiq-staging  # or remedyiq-prod
spec:
  configuration:
    clusters:
      - name: remedyiq
        layout:
          shardsCount: 1
          replicasCount: 1    # increase to 2 for prod HA
  templates:
    podTemplates:
      - name: clickhouse-pod
        spec:
          containers:
            - name: clickhouse
              image: clickhouse/clickhouse-server:24
              resources:
                requests:
                  cpu: 500m
                  memory: 2Gi
                limits:
                  cpu: 2000m
                  memory: 8Gi
    volumeClaimTemplates:
      - name: clickhouse-storage
        spec:
          accessModes: [ReadWriteOnce]
          resources:
            requests:
              storage: 100Gi
```

**Note**: The operator installs 4 CRDs automatically via Helm hooks. Install the operator cluster-wide (one-time), then apply ClickHouseInstallation per namespace.

---

## 5. GitHub Actions OIDC for AWS EKS Deployments

**Decision**: `aws-actions/configure-aws-credentials@v6.0.0` with OIDC — no static AWS access keys.
**Rationale**: Short-lived credentials, no secrets to rotate, full CloudTrail audit trail.
**Alternatives considered**: Static AWS keys stored as GitHub Secrets (rejected — rotation burden, blast radius if leaked).

**Workflow permissions** (required for OIDC token):
```yaml
permissions:
  id-token: write
  contents: read
```

**Auth step**:
```yaml
- uses: aws-actions/configure-aws-credentials@v6.0.0
  with:
    role-to-assume: arn:aws:iam::<ACCOUNT_ID>:role/github-actions-remedyiq
    aws-region: <AWS_REGION>
```

**IAM trust policy** for `github-actions-remedyiq` role:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:OmarEhab007/RemedyIQ:*"
      }
    }
  }]
}
```

**One-time AWS prerequisite**: Create OIDC provider in IAM with URL `https://token.actions.githubusercontent.com` and audience `sts.amazonaws.com`.

**IAM permissions** the role needs:
- `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`
- `eks:DescribeCluster` (for `update-kubeconfig`)
- Kubernetes RBAC: the role must be mapped in the `aws-auth` ConfigMap to a K8s ClusterRole with Helm/namespace deploy permissions

---

## 6. Bleve Search Index Persistence in K8s

**Decision**: Worker Deployment uses a PersistentVolumeClaim (PVC) for `/app/data` (Bleve index storage).
**Rationale**: Bleve stores the full-text search index on disk. Without persistence, the index is rebuilt on every pod restart — expensive for large log datasets.
**Alternatives considered**: Shared ReadWriteMany NFS volume for multi-replica workers (rejected — Bleve is not designed for concurrent multi-process write access; worker is single-writer by design).

**Implication**: Worker cannot have more than 1 replica using the same PVC. HPA for worker should use `minReplicas: 1, maxReplicas: 1` unless Bleve is replaced with a distributed index or the index is rebuilt at startup. Recommend: set worker replicas to 1 initially.

**PVC spec** (in worker Deployment or as a separate PVC):
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: worker-bleve-index
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 20Gi
  storageClassName: gp3
```

**docker-compose local dev**: Named volume `bleve_data:/app/data` preserves the index across restarts.

---

## 7. Image Tagging Strategy

**Decision**: Dual-tag strategy — `<git-sha>` (primary) + environment alias (`staging-latest`, `prod-latest`).
**Rationale**: SHA tags are immutable and tie images to exact commits. Alias tags simplify rollback (Helm can reference `prod-latest` while SHA is the authoritative version).
**Alternatives considered**: Semantic versioning tags (e.g., `v1.2.3`) — not needed for a CD pipeline without manual release tagging process.

**Tag format**:
- `<sha>` = first 7 chars of `${{ github.sha }}`
- `staging-latest` = mutable alias updated on each staging deploy
- `prod-latest` = mutable alias updated on each prod deploy

---

## 8. Container Image Build Context

**Decision**: Backend Dockerfile uses repo root as build context; frontend uses `frontend/` as context.
**Rationale**: `backend/Dockerfile` copies `ARLogAnalyzer/ARLogAnalyzer-3/ARLogAnalyzer.jar` which lives at repo root. The build context must be `.` (repo root), not `backend/`.

**docker-compose build config**:
```yaml
api:
  build:
    context: .                    # repo root
    dockerfile: backend/Dockerfile
    target: api

frontend:
  build:
    context: ./frontend           # frontend subdirectory
    dockerfile: Dockerfile
```

**GitHub Actions** `docker build` command:
```bash
docker build -t remedyiq/api:$SHA -f backend/Dockerfile --target api .
docker build -t remedyiq/frontend:$SHA ./frontend
```

---

## Resolved Unknowns Summary

| Question | Resolution |
|----------|-----------|
| NATS chart version | 2.12.5, JetStream + cluster via `config.*` keys |
| ALB WebSocket | Native, add `idle_timeout=3600` + stickiness |
| ESO with IRSA | `auth.jwt.serviceAccountRef` + IRSA SA annotation |
| Altinity operator | v0.26.1, ClickHouseInstallation CRD |
| GitHub OIDC | `configure-aws-credentials@v6.0.0`, trust policy with `sts.amazonaws.com` aud |
| Bleve persistence | PVC for worker; single-replica constraint |
| Build contexts | Backend: repo root; Frontend: `./frontend/` |
