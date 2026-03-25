---

description: "Task list for EKS Containerization & CI/CD"
---

# Tasks: EKS Containerization & CI/CD

**Input**: Design documents from `/specs/013-eks-containerization/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not explicitly requested in spec — no test task phases generated. Validation tasks included in each phase checkpoint.

**Organization**: Tasks grouped by user story (US1–US5) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete task dependencies)
- **[Story]**: Which user story ([US1]–[US5]) this task belongs to
- All paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create all required directory structures before any files are written.

- [x] T001 Create Helm chart directory tree: `mkdir -p helm/remedyiq/templates/api helm/remedyiq/templates/worker helm/remedyiq/templates/frontend`
- [x] T002 [P] Create GitHub Actions directory: `mkdir -p .github/workflows`
- [x] T003 [P] Create ClickHouse and operator directories: `mkdir -p helm/clickhouse helm/clickhouse-operator docs/ops`

---

## Phase 2: Foundational (Helm Scaffolding — Blocking Prerequisites)

**Purpose**: Helm chart skeleton that ALL Kubernetes templates depend on. No user story K8s work can begin until Chart.yaml, Chart.lock, `_helpers.tpl`, and `values.yaml` are complete.

**⚠️ CRITICAL**: All Phase 3+ Kubernetes template tasks depend on Phase 2 completion.

- [x] T004 Write `helm/remedyiq/Chart.yaml` — `apiVersion: v2`, `name: remedyiq`, `version: 0.1.0`, declare NATS dependency `name: nats, version: 2.12.5, repository: https://nats-io.github.io/k8s/helm/charts/, condition: nats.enabled`
- [x] T005 Run `helm dependency update helm/remedyiq` to resolve and lock Chart.lock with pinned NATS 2.12.5 digest
- [x] T006 [P] Write `helm/remedyiq/templates/_helpers.tpl` — define `remedyiq.fullname`, `remedyiq.labels`, `remedyiq.selectorLabels`, `remedyiq.serviceAccountName` helpers using `.Release.Name` and `.Values` conventions
- [x] T007 [P] Write `helm/remedyiq/values.yaml` — full base schema per `specs/013-eks-containerization/data-model.md` Section 1, covering: `image.*`, `api.*` (replicas/resources/hpa/podAntiAffinity), `worker.*` (replicas/resources/bleveStorage), `frontend.*` (replicas/resources/hpa/ingress), `secrets.*`, `nats.*` (JetStream enabled, cluster 3 replicas), `clickhouse.*`

**Checkpoint**: `helm lint helm/remedyiq` passes (no templates yet, just chart structure and values schema)

---

## Phase 3: User Story 1 — One-Command Local Dev Stack (Priority: P1) 🎯 MVP

**Goal**: `docker compose up --build` starts all 8 services; developer reaches API health check and frontend in under 3 minutes.

**Independent Test**: Clone repo, install Docker Desktop, run `docker compose up --build`, verify `curl http://localhost:8080/api/v1/health` → 200 and `curl http://localhost:3000` → HTML. Stop and restart; confirm data persists.

- [x] T008 [US1] Add `api` service to `docker-compose.yml` — `build.context: .`, `build.dockerfile: backend/Dockerfile`, `build.target: api`, `ports: ["8080:8080"]`, `env_file: .env`, `environment:` block overriding `POSTGRES_URL=postgres://remedyiq:remedyiq@postgres:5432/remedyiq?sslmode=disable`, `CLICKHOUSE_URL=clickhouse://clickhouse:9000/remedyiq`, `NATS_URL=nats://nats:4222`, `REDIS_URL=redis://redis:6379`, `S3_ENDPOINT=http://minio:9000`, `JAR_PATH=/app/ARLogAnalyzer.jar`, `depends_on` all infra services (healthy), `networks: [remedyiq]`
- [x] T009 [US1] Add `worker` service to `docker-compose.yml` — same build config as api but `target: worker`, no `ports`, same `env_file` + environment overrides as T008, `volumes: [bleve_data:/app/data]`, `depends_on` same as api (all infra healthy + minio-init completed), `networks: [remedyiq]`
- [x] T010 [US1] Add `frontend` service to `docker-compose.yml` — `build.context: ./frontend`, `build.dockerfile: Dockerfile`, `ports: ["3000:3000"]`, `environment: {NEXT_PUBLIC_API_URL: "http://api:8080"}`, `depends_on: [api]`, `networks: [remedyiq]`
- [x] T011 [US1] Add `bleve_data` named volume to `docker-compose.yml` volumes section (alongside existing postgres_data, clickhouse_data, etc.) — `bleve_data: {driver: local}`

**Checkpoint**: `docker compose up --build` → all 8 services healthy; `curl localhost:8080/api/v1/health` → 200; `curl localhost:3000` → HTML; `docker compose stop && docker compose up` → data persists; `docker compose down -v` → clean teardown.

---

## Phase 4: User Story 2 — Automated Staging Deployment on Merge (Priority: P1)

**Goal**: Merging to main auto-deploys to staging within 10 minutes; CI blocks merge on CVEs or test failures; failing health checks halt deployment.

**Independent Test**: Merge a change to main → `ci.yml` runs green → `deploy-staging` succeeds → `kubectl get pods -n remedyiq-staging` shows all pods Running within 10 min.

### 4a: Helm Values & Shared Templates

- [x] T012 [US2] Write `helm/remedyiq/values-staging.yaml` — override: `image.tag: staging-latest`, `api.replicas: 1`, `api.hpa.minReplicas: 1`, `api.hpa.maxReplicas: 3`, `worker.replicas: 1`, `worker.bleveStorage.size: 10Gi`, `frontend.replicas: 1`, `frontend.ingress.host: staging.remedyiq.com`, `secrets.managerPath: /remedyiq/staging`, `nats.config.cluster.enabled: false`, `nats.config.cluster.replicas: 1`, `clickhouse.replicasCount: 1`, `clickhouse.storage.size: 20Gi`
- [x] T013 [US2] Write `helm/remedyiq/templates/configmap.yaml` — ConfigMap named `{{ include "remedyiq.fullname" . }}-config` containing non-secret env vars per `data-model.md` Section 5: `ENVIRONMENT`, `API_PORT: "8080"`, `LOG_LEVEL`, `JAR_PATH: /app/ARLogAnalyzer.jar`, `JAR_DEFAULT_HEAP_MB: "4096"`, `JAR_TIMEOUT_SEC: "1800"`, `S3_ENDPOINT: ""`, `S3_USE_SSL: "true"`, `S3_SKIP_BUCKET_VERIFICATION: "false"`
- [x] T014 [US2] Write `helm/remedyiq/templates/externalsecrets.yaml` — ExternalSecret CRD (apiVersion `external-secrets.io/v1beta1`) named `remedyiq-secrets-ext`, `refreshInterval: 1h`, `secretStoreRef.name: aws-secretsmanager`, `secretStoreRef.kind: ClusterSecretStore`, target secret name `remedyiq-secrets`, mapping all 10 keys from `data-model.md` Section 2 (`POSTGRES_URL`, `CLICKHOUSE_URL`, `REDIS_URL`, `NATS_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `CLERK_SECRET_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`) to their `remoteRef.key: {{ .Values.secrets.managerPath }}` with matching `property` names

### 4b: API Kubernetes Resources

- [x] T015 [P] [US2] Write `helm/remedyiq/templates/api/serviceaccount.yaml` — ServiceAccount named `{{ include "remedyiq.fullname" . }}-api` with standard labels from `_helpers.tpl`
- [x] T016 [P] [US2] Write `helm/remedyiq/templates/api/deployment.yaml` — Deployment with `replicas: {{ .Values.api.replicas }}`, container image `{{ .Values.image.registry }}/remedyiq/api:{{ .Values.image.tag }}`, `imagePullPolicy: {{ .Values.image.pullPolicy }}`, port 8080, `envFrom` both configMapRef (`remedyiq-config`) and secretRef (`remedyiq-secrets`), `livenessProbe` httpGet at `/api/v1/health` port 8080 (initial delay 15s, period 20s), `readinessProbe` same (initial delay 5s, period 10s), resources from `{{ .Values.api.resources | toYaml | nindent 12 }}`, `podAntiAffinity` conditional block when `.Values.api.podAntiAffinity` is set
- [x] T017 [P] [US2] Write `helm/remedyiq/templates/api/service.yaml` — Service type ClusterIP, selector uses `remedyiq.selectorLabels` helper, port 8080 → targetPort 8080
- [x] T018 [P] [US2] Write `helm/remedyiq/templates/api/hpa.yaml` — HorizontalPodAutoscaler targeting the api Deployment, `minReplicas: {{ .Values.api.hpa.minReplicas }}`, `maxReplicas: {{ .Values.api.hpa.maxReplicas }}`, CPU utilization metric at `{{ .Values.api.hpa.targetCPUUtilization }}%`, conditional on `{{ .Values.api.hpa.enabled }}`

### 4c: Worker Kubernetes Resources

- [x] T019 [P] [US2] Write `helm/remedyiq/templates/worker/serviceaccount.yaml` — ServiceAccount named `{{ include "remedyiq.fullname" . }}-worker`
- [x] T020 [P] [US2] Write `helm/remedyiq/templates/worker/pvc.yaml` — PersistentVolumeClaim named `{{ include "remedyiq.fullname" . }}-bleve-index`, `accessModes: [ReadWriteOnce]`, `storageClassName: {{ .Values.worker.bleveStorage.storageClass }}` (default `gp3`), `storage: {{ .Values.worker.bleveStorage.size }}`
- [x] T021 [US2] Write `helm/remedyiq/templates/worker/deployment.yaml` — Deployment with `replicas: {{ .Values.worker.replicas }}` (1, no HPA), `strategy.type: Recreate` (required for PVC ReadWriteOnce — new pod must not start until old pod releases the volume), container image `{{ .Values.image.registry }}/remedyiq/worker:{{ .Values.image.tag }}`, `envFrom` both configMapRef and secretRef, `volumeMounts: [{name: bleve-index, mountPath: /app/data}]`, `volumes: [{name: bleve-index, persistentVolumeClaim: {claimName: {{ include "remedyiq.fullname" . }}-bleve-index}}]`, resources from `{{ .Values.worker.resources | toYaml | nindent 12 }}`, liveness probe `exec: {command: [pgrep, -f, worker]}` period 30s

### 4d: Frontend Kubernetes Resources

- [x] T022 [P] [US2] Write `helm/remedyiq/templates/frontend/deployment.yaml` — Deployment with `replicas: {{ .Values.frontend.replicas }}`, image `{{ .Values.image.registry }}/remedyiq/frontend:{{ .Values.image.tag }}`, port 3000, `env: [{name: NEXT_PUBLIC_API_URL, value: ...}]` from values, liveness/readiness probes httpGet `/` port 3000, resources from values
- [x] T023 [P] [US2] Write `helm/remedyiq/templates/frontend/service.yaml` — Service type ClusterIP, port 3000 → targetPort 3000
- [x] T024 [P] [US2] Write `helm/remedyiq/templates/frontend/hpa.yaml` — HPA targeting frontend Deployment, CPU-based, min/max from values, conditional on `{{ .Values.frontend.hpa.enabled }}`
- [x] T025 [US2] Write `helm/remedyiq/templates/frontend/ingress.yaml` — Ingress class `alb`, annotations: `alb.ingress.kubernetes.io/scheme: internet-facing`, `alb.ingress.kubernetes.io/target-type: ip`, `alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'`, `alb.ingress.kubernetes.io/certificate-arn: {{ .Values.frontend.ingress.certificateArn }}`, `alb.ingress.kubernetes.io/ssl-redirect: '443'`, `alb.ingress.kubernetes.io/load-balancer-attributes: idle_timeout.timeout_seconds=3600`, `alb.ingress.kubernetes.io/target-group-attributes: stickiness.enabled=true,stickiness.lb_cookie.duration_seconds=60`; spec rule: host `{{ .Values.frontend.ingress.host }}`, path `/`, pathType Prefix, backend service port 3000

### 4e: ClickHouse & ESO Infrastructure

- [x] T026 [P] [US2] Write `helm/clickhouse-operator/values.yaml` — Altinity `altinity-clickhouse-operator` v0.26.1 install values: disable metrics if not needed, `crdHook.enabled: true` (auto-installs CRDs via Helm hooks)
- [x] T027 [P] [US2] Write `helm/clickhouse/ClickHouseInstallation-staging.yaml` — ClickHouseInstallation CRD (apiVersion `clickhouse.altinity.com/v1`), metadata name `remedyiq`, namespace `remedyiq-staging`, spec: 1 cluster named `remedyiq`, layout `shardsCount: 1, replicasCount: 1`, podTemplate image `clickhouse/clickhouse-server:24`, resources `requests: {cpu: 500m, memory: 2Gi}, limits: {cpu: 2, memory: 8Gi}`, volumeClaimTemplate `storage: 20Gi, storageClass: gp3`
- [x] T028 [P] [US2] Write `helm/clickhouse/ClusterSecretStore.yaml` — ClusterSecretStore (apiVersion `external-secrets.io/v1beta1`) named `aws-secretsmanager`, provider AWS SecretsManager, region from placeholder comment, auth via `jwt.serviceAccountRef: {name: external-secrets, namespace: external-secrets}` (IRSA, no static keys)

### 4f: CI Pipeline

- [x] T029 [US2] Write `.github/workflows/ci.yml` — trigger `on: pull_request: branches: [main]`, five jobs: `lint-go` (golangci/golangci-lint-action@v6, working-directory backend), `lint-frontend` (setup-node@v4 node 20, `npm ci`, `npm run lint` in frontend/), `test-go` (setup-go@v5 go 1.24, `go test ./...` in backend/), `build-scan` (build api/worker from repo root with `docker build -f backend/Dockerfile --target {api,worker} .`, build frontend from `./frontend`, then aquasecurity/trivy-action@master on each image `exit-code: 1, severity: HIGH,CRITICAL`), `helm-lint` (azure/setup-helm@v4, `helm dependency update helm/remedyiq`, `helm lint helm/remedyiq -f helm/remedyiq/values-staging.yaml`, `helm lint helm/remedyiq -f helm/remedyiq/values-prod.yaml`)
- [x] T030 [US2] Run local validation: `helm dependency update helm/remedyiq && helm lint helm/remedyiq -f helm/remedyiq/values-staging.yaml && helm template remedyiq-staging helm/remedyiq -f helm/remedyiq/values-staging.yaml --set image.tag=test123 | kubectl apply --dry-run=client -f -` — fix any lint errors before proceeding

**Checkpoint**: All helm lint jobs pass; `helm template` renders valid YAML for all resources; CI workflow syntax is valid (verified via `act` or PR).

---

## Phase 5: User Story 3 — Production Deployment with Human Approval Gate (Priority: P1)

**Goal**: Production deploys require human approval; rollout is zero-downtime; rollback completes in < 5 min.

**Independent Test**: Approve the `production` gate in a running `deploy.yml` workflow; verify `kubectl get pods -n remedyiq-prod` shows Running; run `helm rollback remedyiq-prod -n remedyiq-prod`; confirm recovery in < 5 min.

- [x] T031 [US3] Write `helm/remedyiq/values-prod.yaml` — override: `image.tag: prod-latest`, `secrets.managerPath: /remedyiq/prod`, `frontend.ingress.host: app.remedyiq.com`, `api.podAntiAffinity: preferred`, `frontend.podAntiAffinity: preferred`, `nats.config.cluster.enabled: true, replicas: 3`, `clickhouse.replicasCount: 2, storage.size: 500Gi`
- [x] T032 [P] [US3] Write `helm/clickhouse/ClickHouseInstallation-prod.yaml` — same structure as staging CRD but namespace `remedyiq-prod`, `replicasCount: 2`, storage `500Gi gp3`, resources `requests: {cpu: 1, memory: 4Gi}, limits: {cpu: 4, memory: 16Gi}`
- [x] T033 [US3] Write `.github/workflows/deploy.yml` — trigger `on: push: branches: [main]`, `permissions: {id-token: write, contents: read}`, three jobs: `build-push` (aws-actions/configure-aws-credentials@v6 with `role-to-assume: ${{ vars.AWS_ROLE_TO_ASSUME }}`, amazon-ecr-login@v2, build+push all 3 images tagged `${SHA::7}` + `staging-latest`, output `image-tag`), `deploy-staging` (needs build-push, `environment: staging`, eks update-kubeconfig, azure/setup-helm@v4, `helm dependency update`, `helm upgrade --install remedyiq-staging helm/remedyiq --namespace remedyiq-staging -f helm/remedyiq/values-staging.yaml --set image.tag=${{ needs.build-push.outputs.image-tag }} --set image.registry=... --wait --timeout 10m`), `deploy-prod` (needs [build-push, deploy-staging], `environment: production` requiring reviewers, re-tag images to `prod-latest`, `helm upgrade --install remedyiq-prod helm/remedyiq --namespace remedyiq-prod -f helm/remedyiq/values-prod.yaml --set image.tag=... --wait --timeout 15m`)
- [x] T034 [US3] Write `docs/ops/github-environments-setup.md` — step-by-step: create GitHub Environments `staging` (no protection rules) and `production` (required reviewers list, 24h timeout), add variables `AWS_ACCOUNT_ID`, `AWS_REGION`, `EKS_CLUSTER_NAME`, `AWS_ROLE_TO_ASSUME`; document how to approve a deployment gate in the Actions UI; document rollback command: `helm rollback remedyiq-prod -n remedyiq-prod`

**Checkpoint**: `deploy.yml` triggers on merge to main; `deploy-prod` job waits for approval; after approval, pods are Running in `remedyiq-prod`; `helm rollback` completes without errors.

---

## Phase 6: User Story 4 — Automatic Scaling Under Load (Priority: P2)

**Goal**: API and frontend scale automatically under load; worker stays at 1 replica (Bleve constraint documented); Metrics Server is identified as prerequisite.

**Independent Test**: Simulate load against staging API → additional api pods appear in `kubectl get pods -n remedyiq-staging` within 2 minutes → load drops → pods scale back to minimum.

- [x] T035 [US4] Audit and tune `helm/remedyiq/templates/api/hpa.yaml` — verify CPU utilization target is `{{ .Values.api.hpa.targetCPUUtilization }}` (default 60%), confirm `minReplicas` and `maxReplicas` map correctly from values, add `# Requires Metrics Server installed in cluster` comment, ensure `behavior.scaleDown.stabilizationWindowSeconds: 300` to prevent thrashing
- [x] T036 [P] [US4] Audit and tune `helm/remedyiq/templates/frontend/hpa.yaml` — same as T035 for frontend, CPU target from `{{ .Values.frontend.hpa.targetCPUUtilization }}` (default 70%)
- [x] T037 [P] [US4] Write `docs/ops/cluster-setup-runbook.md` — one-time cluster setup sequence: (1) install Metrics Server (`kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml`), (2) install External Secrets Operator (`helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace`), (3) install Altinity ClickHouse Operator (`helm install clickhouse-operator altinity/altinity-clickhouse-operator -n kube-system`), (4) install AWS Load Balancer Controller (EKS docs link), (5) create namespaces (`kubectl create namespace remedyiq-staging && kubectl create namespace remedyiq-prod`), (6) apply ClusterSecretStore (`kubectl apply -f helm/clickhouse/ClusterSecretStore.yaml`), (7) create ECR repos (`aws ecr create-repository --repository-name remedyiq/{api,worker,frontend}`), (8) create OIDC provider for GitHub Actions; also document: worker intentionally has `replicas: 1` and no HPA due to Bleve single-writer constraint; future path: replace Bleve with distributed search to enable worker scaling

**Checkpoint**: `kubectl describe hpa -n remedyiq-staging` shows current and desired metrics; `kubectl top pods -n remedyiq-staging` returns metrics (Metrics Server working).

---

## Phase 7: User Story 5 — Secure Secret Management (Priority: P2)

**Goal**: No credentials in git, images, or manifests; secrets pulled from vault at runtime; rotation propagates without manual restarts.

**Independent Test**: `git log --all -p | grep -E 'AIzaSy|sk_live|minioadmin|AKIA'` → no matches; `trivy image remedyiq/api:latest --secret` → no secrets found; rotate a non-critical key in AWS Secrets Manager → ESO syncs within 60 min.

- [x] T038 [US5] Write `docs/ops/secrets-management-runbook.md` — (1) IAM IRSA role setup: create role `external-secrets-role` with trust policy for ESO service account (include exact JSON from `research.md` Section 3, substitute `<ACCOUNT_ID>` and `<REGION>`), attach policy allowing `secretsmanager:GetSecretValue` and `secretsmanager:DescribeSecret` on `arn:aws:secretsmanager:<REGION>:<ACCOUNT_ID>:secret:/remedyiq/*`; (2) initial secret creation: `aws secretsmanager create-secret --name /remedyiq/staging --secret-string '{"postgres_url":"...","redis_url":"...","nats_url":"...","s3_access_key":"...","s3_secret_key":"...","s3_bucket":"...","clerk_secret_key":"...","google_api_key":"...","anthropic_api_key":""}'`; (3) secret rotation: `aws secretsmanager update-secret --secret-id /remedyiq/prod --secret-string '{...}'` → ESO syncs within 60 min (no pod restart needed); (4) verify no secrets in manifests: `grep -r 'password\|secret\|key' helm/remedyiq/templates/ | grep -v '.Values\|#'`
- [x] T039 [P] [US5] Add gitleaks secret-scanning step to `.github/workflows/ci.yml` — in `build-scan` job, add step before Trivy: `uses: gitleaks/gitleaks-action@v2` with `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to scan repository for committed secrets on every PR
- [x] T040 [P] [US5] Verify `.dockerignore` at repository root excludes `.env`, `.env.local`, `*.pem`, `*.key`, and any credential files — add exclusions if missing; confirm `docker build` does not copy `.env` into any image layer by running `docker run --rm remedyiq/api:ci cat /app/.env 2>&1 | grep 'No such file'`
- [x] T041 [US5] Add `.env.example` to repository root — template with all required variable names but empty or placeholder values (safe to commit), covering every variable in `data-model.md` Section 5; add comment block describing which variables are injected by ESO in production vs set manually for local dev

**Checkpoint**: `git log --all -p | grep -E 'AKIA|AIzaSy|minioadmin'` → no output; `trivy image remedyiq/api:ci` → no secrets; `.env.example` committed; gitleaks step passes on CI.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, Makefile targets, and final full-stack validation.

- [x] T042 Write `docs/plans/2026-03-25-containerization-design.md` — design document covering: problem statement (partial containerization), decision log (Approach A chosen: Helm monorepo + AWS managed + NATS/ClickHouse StatefulSets), architecture diagram (ASCII service topology showing ALB → frontend → api → worker → infra), key decisions table (NATS chart v2.12.5, ALB idle_timeout=3600, ESO IRSA, Altinity operator, worker single-replica Bleve constraint, GitHub OIDC)
- [x] T043 [P] Update `Makefile` — add targets: `docker-up-all` (docker compose up with all services including api/worker/frontend), `docker-build` (docker compose build), `helm-lint` (helm dependency update + lint staging + lint prod), `helm-dry-run` (helm template with dry-run kubectl apply), keeping existing targets unchanged
- [x] T044 [P] Run `quickstart.md` validation sequence — execute every command in the Local Development section of `specs/013-eks-containerization/quickstart.md`: `docker compose build`, `docker compose up -d`, health checks, stop/start data persistence, `docker compose down -v`; fix any errors found
- [ ] T045 Commit all files on branch `013-eks-containerization` with message: `feat: containerize RemedyIQ for EKS — docker-compose full stack + Helm chart + GitHub Actions CI/CD (013)`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)          → no deps, start immediately
Phase 2 (Foundational)   → requires Phase 1 complete → BLOCKS all K8s work
Phase 3 (US1)            → requires Phase 1 only (docker-compose, no Helm needed)
Phase 4 (US2)            → requires Phase 2 complete
Phase 5 (US3)            → requires Phase 4 complete
Phase 6 (US4)            → requires Phase 4 complete (HPA templates exist)
Phase 7 (US5)            → requires Phase 4 complete (ExternalSecret template exists)
Phase 8 (Polish)         → requires all phases complete
```

### User Story Dependencies

- **US1 (P1 — docker-compose)**: Independent of US2–US5. Can be implemented and tested after Phase 1 only.
- **US2 (P1 — staging deploy)**: Requires Phase 2 (Helm scaffolding). Independent of US3–US5 logic (uses ESO template but not the vault config).
- **US3 (P1 — prod deploy)**: Requires US2 complete (extends Helm chart with prod values + CD workflow).
- **US4 (P2 — scaling)**: Requires US2 complete (HPA templates already exist; this phase tunes and documents them).
- **US5 (P2 — secrets)**: Requires US2 complete (ExternalSecret template exists; this phase configures the vault side and adds scanning).

### Within Each Phase

- Phase 4 internal order: T012 (values) → T013–T014 (configmap, externalsecrets) → T015–T028 [P] (all templates, parallelizable) → T029 (ci.yml) → T030 (validate)
- Worker Deployment (T021) should be written after PVC (T020) — references PVC claim name

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 all parallel
- **Phase 2**: T006, T007 parallel (after T004 and T005)
- **Phase 4**: T015–T028 all parallel (independent template files)
- **Phase 5**: T031, T032 parallel (independent files)
- **Phase 6**: T035, T036, T037 all parallel
- **Phase 7**: T039, T040 parallel
- **US1 and Phase 2**: US1 (T008–T011) can start immediately after Phase 1; Phase 2 (T004–T007) can run in parallel with US1

---

## Parallel Example: Phase 4 (US2 — Kubernetes Templates)

```bash
# After T012–T014 are complete, launch all template tasks in parallel:
Task T015: helm/remedyiq/templates/api/serviceaccount.yaml
Task T016: helm/remedyiq/templates/api/deployment.yaml
Task T017: helm/remedyiq/templates/api/service.yaml
Task T018: helm/remedyiq/templates/api/hpa.yaml
Task T019: helm/remedyiq/templates/worker/serviceaccount.yaml
Task T020: helm/remedyiq/templates/worker/pvc.yaml
Task T022: helm/remedyiq/templates/frontend/deployment.yaml
Task T023: helm/remedyiq/templates/frontend/service.yaml
Task T024: helm/remedyiq/templates/frontend/hpa.yaml
Task T026: helm/clickhouse-operator/values.yaml
Task T027: helm/clickhouse/ClickHouseInstallation-staging.yaml
Task T028: helm/clickhouse/ClusterSecretStore.yaml
# T021 (worker deployment) and T025 (frontend ingress) after their deps
```

---

## Implementation Strategy

### MVP First (US1 Only — docker-compose)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 3: US1 (T008–T011) — no Phase 2 needed for docker-compose
3. **STOP and VALIDATE**: `docker compose up --build` → all services healthy
4. This alone delivers FR-001 (one-command local dev) and SC-001

### Incremental Delivery

1. Phase 1 + US1 → Developer onboarding solved (MVP)
2. Phase 2 + US2 → Staging auto-deploys on merge (CI/CD enabled)
3. US3 → Production deploy with gate (release-ready)
4. US4 + US5 → Scaling and security hardened (production-grade)

### Parallel Team Strategy

With two developers after Phase 1 completes:
- **Developer A**: Phase 2 (Helm scaffolding) → Phase 4 (US2 templates)
- **Developer B**: Phase 3 (US1 docker-compose) → Phase 7 (US5 secret docs)

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks within same phase
- Worker intentionally excluded from HPA — Bleve search index requires single-writer access (ReadWriteOnce PVC)
- Frontend `NEXT_PUBLIC_*` env vars baked at build time: pass `--build-arg NEXT_PUBLIC_API_URL=...` in CI docker build if different from default
- ClickHouse CRDs are NOT Helm subcharts — they are separate YAML files applied directly via `kubectl apply`
- `helm dependency update` must be re-run any time `Chart.yaml` dependency versions change
- Commit after each phase checkpoint to maintain bisectable history on the feature branch
