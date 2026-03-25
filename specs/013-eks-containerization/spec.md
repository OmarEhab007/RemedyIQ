# Feature Specification: EKS Containerization & CI/CD

**Feature Branch**: `013-eks-containerization`
**Created**: 2026-03-25
**Status**: Draft
**Input**: User description: "Containerize the RemedyIQ platform for production deployment on AWS EKS. Add app services (api, worker, frontend) to docker-compose for complete local dev. Create Helm chart (helm/remedyiq/) with values for staging and production environments. Map stateful infra to: AWS RDS (PostgreSQL), AWS ElastiCache (Redis), AWS S3 (storage), NATS StatefulSet (K8s), ClickHouse StatefulSet via Altinity operator. Set up GitHub Actions CI (lint/test/scan on PR) and CD (build+push ECR → helm upgrade staging auto → helm upgrade prod with manual gate). Use External Secrets Operator to pull secrets from AWS Secrets Manager into K8s."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Command Local Dev Stack (Priority: P1)

A developer joins the RemedyIQ team and wants to run the complete platform locally. Instead of installing database servers, message brokers, and multiple language runtimes on their machine, they run a single command and the entire platform — API server, background worker, web frontend, and all supporting infrastructure — starts up and is ready to use.

**Why this priority**: Eliminates "works on my machine" problems and drastically reduces onboarding time. Every developer on the team is unblocked by this.

**Independent Test**: Can be fully tested by a new team member cloning the repo, running one start command, and successfully accessing the web frontend and API health endpoint within 5 minutes — with no prior environment setup.

**Acceptance Scenarios**:

1. **Given** a developer has cloned the repo and installed only the container runtime, **When** they run the single start command, **Then** all services start in correct dependency order and the web frontend is accessible within 3 minutes.
2. **Given** the platform is running locally, **When** a developer uploads a log file and triggers analysis, **Then** the background worker processes it and results appear in the dashboard — confirming the end-to-end flow works.
3. **Given** a service crashes during local development, **When** the developer inspects logs, **Then** they can see the failure cause with a single command.
4. **Given** the platform is stopped and restarted, **When** it comes back up, **Then** previously loaded data (database records, search indexes) is still present.

---

### User Story 2 - Automated Staging Deployment on Merge (Priority: P1)

A developer merges a pull request to the main branch. Without any manual action, a pipeline validates the code, packages it into immutable versioned deployment artifacts, and deploys those artifacts to the staging environment where the team immediately verifies the changes.

**Why this priority**: Eliminates the manual "deploy to staging" bottleneck. Ensures staging always reflects what is in main and provides fast feedback on integration issues.

**Independent Test**: Can be fully tested by merging a code change to main and observing the staging environment reflects the change within 10 minutes, with no manual steps required.

**Acceptance Scenarios**:

1. **Given** a PR is opened, **When** the CI pipeline runs, **Then** it validates code quality, runs tests, and checks for security vulnerabilities — reporting all results on the PR before merge is allowed.
2. **Given** the CI pipeline detects a high-severity security vulnerability in a deployment artifact, **When** it reports results, **Then** the merge is blocked until the vulnerability is resolved.
3. **Given** a PR passes all CI checks and is merged to main, **When** the pipeline detects the merge, **Then** deployment to staging begins automatically within 1 minute.
4. **Given** a deployment to staging is in progress and a service fails its health check, **When** the pipeline detects the failure, **Then** the deployment halts and the team is notified — the previous version keeps running.

---

### User Story 3 - Production Deployment with Human Approval Gate (Priority: P1)

After verifying a release on staging, a release manager approves the production deployment through the same pipeline interface. The deployment rolls out to production with zero downtime. If a problem is detected post-deployment, they can roll back to the previous version within minutes.

**Why this priority**: Production reliability directly affects customers. The human gate prevents regressions from reaching production automatically; rollback ensures business continuity.

**Independent Test**: Can be fully tested by approving a production deployment in the pipeline, verifying the rollout completes with no dropped requests under synthetic load, then triggering rollback and confirming recovery in under 5 minutes.

**Acceptance Scenarios**:

1. **Given** staging is healthy after a deployment, **When** a release manager approves the production gate, **Then** production deployment begins using the same versioned artifacts validated on staging.
2. **Given** production deployment is underway, **When** each service instance is replaced, **Then** in-flight requests complete normally before the instance is removed — no requests are dropped.
3. **Given** a bad deployment reaches production, **When** the team triggers a rollback, **Then** the previous stable version is restored and serving traffic within 5 minutes.
4. **Given** a production deployment is awaiting approval for more than 24 hours, **When** the gate expires, **Then** the deployment does not proceed automatically.

---

### User Story 4 - Automatic Scaling Under Load (Priority: P2)

During peak usage — such as multiple teams uploading large log files simultaneously — the platform automatically scales the API and worker services to handle the load, then scales back down when demand subsides.

**Why this priority**: Ensures reliability during load spikes without permanently over-provisioning, controlling infrastructure cost.

**Independent Test**: Can be fully tested by simulating 3× normal load against staging and observing additional service instances appear automatically within 2 minutes, then terminate after load drops.

**Acceptance Scenarios**:

1. **Given** the platform is under sustained high load, **When** the autoscaler detects resource utilization above threshold, **Then** additional service instances are launched automatically within 2 minutes.
2. **Given** load returns to normal, **When** the autoscaler detects sustained low utilization, **Then** extra instances are terminated, returning to the minimum replica count.
3. **Given** the analysis job queue grows large, **When** queue depth exceeds a defined threshold, **Then** additional worker instances launch to process the backlog.

---

### User Story 5 - Secure Secret Management (Priority: P2)

Database passwords, API keys, and other sensitive credentials are never stored in the codebase, container images, or deployment manifests. They are stored in a centralized secure vault and automatically injected into the appropriate services at startup.

**Why this priority**: Prevents credential leakage via source code repositories, log outputs, or image scanning tools. Required for production security compliance.

**Independent Test**: Can be fully tested by scanning all deployment manifests, container images, and git history for credential patterns — none should appear.

**Acceptance Scenarios**:

1. **Given** a credential is stored in the secure vault, **When** a service starts, **Then** the credential is available to the service without appearing in any configuration file, deployment artifact, or container image layer.
2. **Given** a credential is rotated in the vault, **When** the rotation takes effect, **Then** services receive the updated value within 1 hour without requiring a redeployment or manual restart.
3. **Given** a developer scans the git history and container images for credential patterns, **When** the scan completes, **Then** no credentials are found.

---

### Edge Cases

- What happens when a container image build fails partway through the CI pipeline — are partial or unverified artifacts pushed to the registry?
- How does the system behave when a database schema change is required by a new release — does the service fail to start until migration runs?
- What if the staging deployment health check passes but a feature is silently broken (health endpoint is superficial)?
- How are newly added secrets propagated to services that didn't previously need them — is a manual restart required?
- What happens when the cluster lacks capacity to schedule new pods during a deployment?
- How does the platform behave when the secure vault is temporarily unreachable during a service restart?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Developers MUST be able to start the complete local platform (all application services and infrastructure) with a single command, requiring only a container runtime pre-installed.
- **FR-002**: The CI pipeline MUST automatically run on every pull request and report: code quality check results, automated test results, and security vulnerability scan results.
- **FR-003**: The CI pipeline MUST block merge (and halt artifact promotion) if any critical or high-severity security vulnerabilities are detected in the built artifacts.
- **FR-004**: On every merge to the main branch, the platform MUST automatically build versioned deployment artifacts and deploy them to the staging environment without any manual action.
- **FR-005**: Production deployments MUST require explicit human approval in the pipeline interface before any changes are applied to production.
- **FR-006**: Staging and production deployments MUST use the same versioned artifacts validated by CI — no environment-specific rebuilds are permitted.
- **FR-007**: The platform MUST support zero-downtime deployments, ensuring in-flight requests are not dropped during a release rollout.
- **FR-008**: A complete rollback to the immediately preceding production release MUST be achievable within 5 minutes.
- **FR-009**: API and worker services MUST automatically scale the number of running instances based on measured load, within defined minimum and maximum bounds.
- **FR-010**: Sensitive credentials MUST be stored in a centralized secure vault and injected at runtime — never embedded in source code, manifests, or container images.
- **FR-011**: Updated credentials in the vault MUST propagate to running services within 60 minutes without requiring a manual redeployment.
- **FR-012**: Staging and production environments MUST share a single base configuration source, differing only in environment-specific overrides (hostnames, resource sizes, replica counts).
- **FR-013**: All application services MUST expose health status indicators that the platform uses to detect failed deployments and route traffic only to healthy instances.
- **FR-014**: Local development data (databases, indexes) MUST persist across container restarts unless explicitly reset by the developer.

### Key Entities

- **Container Image**: Immutable, versioned snapshot of an application service built from source code. Identified by the git commit SHA that produced it. Cannot be changed after creation.
- **Deployment Environment**: A named, isolated runtime context (staging, production) with its own configuration and data. Changes to one environment do not affect another.
- **Release**: A specific, coordinated set of container images (API, worker, frontend) built from the same source commit and promoted through environments as a unit.
- **Secret**: A sensitive configuration value (password, API key, certificate) stored only in a centralized vault. Injected into service processes at runtime; never persisted in deployment artifacts.
- **Infrastructure Service**: A stateful data system (database, cache, message queue, object store) that application services depend on. Managed independently from application releases.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new team member with only a container runtime installed can have the complete local development environment running and functional within 5 minutes of cloning the repository.
- **SC-002**: Code merged to main is running on staging within 10 minutes, measured from merge time to first successful health check on the updated staging deployment.
- **SC-003**: Production deployments complete with zero requests dropped, verified by a synthetic load test running concurrently during the rollout.
- **SC-004**: A rollback from a failed production release to the previous stable version completes within 5 minutes of the rollback being triggered.
- **SC-005**: The platform automatically handles a 3× spike in analysis job volume by scaling workers, with no jobs lost and the queue clearing within 15 minutes.
- **SC-006**: Security scans detect 100% of known critical and high-severity vulnerabilities in container images before any artifact reaches the staging environment.
- **SC-007**: Credential rotation in the vault propagates to all running services within 60 minutes, with no manual service restarts required.
- **SC-008**: Staging and production configurations share a verified single base source — any change to the base applies to both environments without duplication.

## Assumptions

- An AWS account with an EKS cluster and container image registry is already provisioned before implementation begins.
- The cluster has sufficient initial capacity to run the minimum configured replicas for all services.
- Database schema migrations are handled separately from service deployments and do not block deployment completion.
- The existing API health check endpoint (`/api/v1/health`) is sufficient for liveness and readiness detection; no new health endpoints are required.
- Local development data persistence across restarts is desired; the start command does not wipe data by default.
- The team uses GitHub as the version control platform and will trigger pipelines via GitHub-native events.
- Staging auto-deployments serve as the primary integration test environment; manual QA verification on staging precedes production approval.
- The production approval gate requires a human action; pipeline timeout (24h) does not auto-approve.
