# EKS Cluster Setup Runbook

This runbook documents the one-time setup required to deploy RemedyIQ to an EKS cluster.

## Prerequisites

- EKS cluster running Kubernetes 1.28+
- `kubectl` configured with cluster admin access
- `helm` v3.14+
- AWS CLI v2 configured with appropriate credentials

## Setup Sequence

### 1. Install Metrics Server

Metrics Server is required for HorizontalPodAutoscaler (HPA) to function.

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

Verify installation:
```bash
kubectl get deployment metrics-server -n kube-system
kubectl top nodes
kubectl top pods -A
```

### 2. Install External Secrets Operator

External Secrets Operator syncs secrets from AWS Secrets Manager to Kubernetes.

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --set installCRDs=true
```

Create IRSA role for ESO (see `secrets-management-runbook.md` for details).

### 3. Install Altinity ClickHouse Operator

The operator manages ClickHouse clusters via CRDs.

```bash
helm repo add altinity https://docs.altinity.com/clickhouse-operator/
helm install clickhouse-operator altinity/altinity-clickhouse-operator \
  --namespace kube-system \
  -f helm/clickhouse-operator/values.yaml
```

Verify CRDs are installed:
```bash
kubectl get crd | grep clickhouse
```

### 4. Install AWS Load Balancer Controller

Required for ALB Ingress resources.

Follow the [AWS documentation](https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html) for your EKS version.

Quick install (requires IAM role for service account):
```bash
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=<YOUR_CLUSTER_NAME> \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### 5. Create Namespaces

```bash
kubectl create namespace remedyiq-staging
kubectl create namespace remedyiq-prod
```

### 6. Apply ClusterSecretStore

After External Secrets Operator is running and the IRSA role is configured:

```bash
# Edit the file to replace <AWS_REGION> with your region
sed -i '' 's/<AWS_REGION>/us-east-1/' helm/clickhouse/ClusterSecretStore.yaml
kubectl apply -f helm/clickhouse/ClusterSecretStore.yaml
```

### 7. Create ECR Repositories

```bash
aws ecr create-repository --repository-name remedyiq/api --region <REGION>
aws ecr create-repository --repository-name remedyiq/worker --region <REGION>
aws ecr create-repository --repository-name remedyiq/frontend --region <REGION>
```

### 8. Deploy ClickHouse Clusters

```bash
kubectl apply -f helm/clickhouse/ClickHouseInstallation-staging.yaml
kubectl apply -f helm/clickhouse/ClickHouseInstallation-prod.yaml
```

Verify ClickHouse pods are running:
```bash
kubectl get chi -A
kubectl get pods -n remedyiq-staging -l clickhouse.altinity.com/chi=remedyiq
kubectl get pods -n remedyiq-prod -l clickhouse.altinity.com/chi=remedyiq
```

### 9. Create OIDC Provider for GitHub Actions

This allows GitHub Actions to authenticate with AWS without static credentials.

1. Get your OIDC provider URL from EKS:
```bash
aws eks describe-cluster --name <CLUSTER_NAME> --query "cluster.identity.oidc.issuer" --output text
```

2. Create IAM OIDC provider in AWS Console or via CLI:
```bash
# Get the OIDC issuer URL without https://
OIDC_URL=$(aws eks describe-cluster --name <CLUSTER_NAME> --query "cluster.identity.oidc.issuer" --output text | sed 's|https://||')

# Create OIDC provider (one-time)
aws iam create-open-id-connect-provider \
  --url https://$OIDC_URL \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 9e99a48a9960b14926bb7f3b02e22da2afd0bdb0
```

3. Create IAM role with trust policy for GitHub Actions (see `secrets-management-runbook.md`).

## Worker Scaling Constraint

**Important**: The worker deployment is intentionally configured with `replicas: 1` and no HPA.

### Why?

- Bleve search index requires single-writer access
- PVC uses `ReadWriteOnce` access mode
- Multiple workers would cause index corruption

### Current Architecture

```
Worker (1 replica) → PVC (ReadWriteOnce) → Bleve Index
```

### Future Path

To enable worker scaling, consider:
1. Replace Bleve with a distributed search engine (Elasticsearch, Meilisearch, Typesense)
2. Use a shared storage backend with proper locking
3. Implement index sharding with coordinator

## Verification Checklist

After completing all steps:

- [ ] Metrics Server: `kubectl top nodes` returns data
- [ ] External Secrets Operator: `kubectl get pods -n external-secrets`
- [ ] ClickHouse Operator: `kubectl get crd clickhouseinstallations.clickhouse.altinity.com`
- [ ] AWS LB Controller: `kubectl get deployment -n kube-system aws-load-balancer-controller`
- [ ] Namespaces exist: `kubectl get ns remedyiq-staging remedyiq-prod`
- [ ] ClusterSecretStore: `kubectl get clustersecretstore aws-secretsmanager`
- [ ] ClickHouse clusters: `kubectl get chi -A`
- [ ] ECR repos: `aws ecr describe-repositories --repository-names remedyiq/api remedyiq/worker remedyiq/frontend`

## Troubleshooting

### Metrics Server Not Working

```bash
# Check logs
kubectl logs -n kube-system deployment/metrics-server

# Common fix: enable insecure TLS for local clusters
kubectl patch deployment metrics-server -n kube-system --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

### External Secret Not Syncing

```bash
# Check ExternalSecret status
kubectl get externalsecret -n remedyiq-staging
kubectl describe externalsecret remedyiq-staging-secrets-ext -n remedyiq-staging

# Check ESO logs
kubectl logs -n external-secrets deployment/external-secrets
```

### ClickHouse Pod Not Starting

```bash
# Check ClickHouseInstallation status
kubectl describe chi remedyiq -n remedyiq-staging

# Check operator logs
kubectl logs -n kube-system deployment/clickhouse-operator
```
