# Secrets Management Runbook

This runbook documents how to manage secrets for RemedyIQ deployments on EKS.

## Overview

RemedyIQ uses **AWS Secrets Manager** as the source of truth for all secrets, synchronized to Kubernetes via **External Secrets Operator (ESO)** with **IRSA** (IAM Roles for Service Accounts).

### Architecture

```
AWS Secrets Manager          External Secrets Operator          Kubernetes Pods
       │                            │                                  │
       │  /remedyiq/staging         │                                  │
       │  /remedyiq/prod  ──────►  ClusterSecretStore  ──────►  Secret (remedyiq-secrets)
       │                            │                                  │
       └────────────────────────────┘                                  │
                                                                        ▼
                                                              envFrom.secretRef
```

## 1. IAM IRSA Role Setup

### Create IAM Role for External Secrets Operator

```bash
# Set variables
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1

# Create trust policy document
cat > eso-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "pods.eks.amazonaws.com"
      },
      "Action": [
        "sts:AssumeRole",
        "sts:TagSession"
      ]
    }
  ]
}
EOF

# Create IAM role
aws iam create-role \
  --role-name external-secrets-role \
  --assume-role-policy-document file://eso-trust-policy.json

# Create permissions policy
cat > eso-permissions.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:/remedyiq/*"
      ]
    }
  ]
}
EOF

# Attach policy to role
aws iam put-role-policy \
  --role-name external-secrets-role \
  --policy-name ExternalSecretsPolicy \
  --policy-document file://eso-permissions.json
```

### Annotate ESO Service Account

```bash
# Get the OIDC provider URL
CLUSTER_NAME=remedyiq-prod
OIDC_PROVIDER=$(aws eks describe-cluster \
  --name $CLUSTER_NAME \
  --region $REGION \
  --query "cluster.identity.oidc.issuer" \
  --output text | sed 's|https://||')

# Annotate the service account
kubectl annotate serviceaccount external-secrets \
  -n external-secrets \
  eks.amazonaws.com/role-arn=arn:aws:iam::${ACCOUNT_ID}:role/external-secrets-role
```

## 2. Initial Secret Creation

### Create Staging Secrets

```bash
aws secretsmanager create-secret \
  --name /remedyiq/staging \
  --secret-string '{
    "postgres_url": "postgres://remedyiq:PASSWORD@staging-db.cluster-xxx.region.rds.amazonaws.com:5432/remedyiq?sslmode=require",
    "clickhouse_url": "clickhouse://default:@clickhouse-clickhouse.clickhouse-staging.svc:9000/remedyiq",
    "redis_url": "redis://:PASSWORD@staging-redis.xxx.0001.use1.cache.amazonaws.com:6379",
    "nats_url": "nats://nats:4222",
    "s3_access_key": "AKIAIOSFODNN7EXAMPLE",
    "s3_secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "s3_bucket": "remedyiq-logs-staging",
    "clerk_secret_key": "sk_test_xxx",
    "google_api_key": "AIzaSyxxx",
    "anthropic_api_key": ""
  }'
```

### Create Production Secrets

```bash
aws secretsmanager create-secret \
  --name /remedyiq/prod \
  --secret-string '{
    "postgres_url": "postgres://remedyiq:PASSWORD@prod-db.cluster-xxx.region.rds.amazonaws.com:5432/remedyiq?sslmode=require",
    "clickhouse_url": "clickhouse://default:@clickhouse-clickhouse.clickhouse-prod.svc:9000/remedyiq",
    "redis_url": "redis://:PASSWORD@prod-redis.xxx.0001.use1.cache.amazonaws.com:6379",
    "nats_url": "nats://nats:4222",
    "s3_access_key": "AKIAIOSFODNN7EXAMPLE",
    "s3_secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "s3_bucket": "remedyiq-logs-prod",
    "clerk_secret_key": "sk_live_xxx",
    "google_api_key": "AIzaSyxxx",
    "anthropic_api_key": ""
  }'
```

## 3. Secret Rotation

### Update a Secret

```bash
# Update staging secrets
aws secretsmanager update-secret \
  --secret-id /remedyiq/staging \
  --secret-string '{
    "postgres_url": "postgres://remedyiq:NEW_PASSWORD@staging-db.cluster-xxx.region.rds.amazonaws.com:5432/remedyiq?sslmode=require",
    ...
  }'
```

### Propagation

- ESO syncs secrets every **1 hour** (`refreshInterval: 1h`)
- Pods automatically receive updated secrets on next sync
- **No pod restart required** for secret updates
- For immediate propagation, force a sync:
  ```bash
  kubectl restart externalsecret remedyiq-staging-secrets-ext -n remedyiq-staging
  ```

## 4. Verify No Secrets in Manifests

Run this command to ensure no hardcoded secrets exist in Kubernetes manifests:

```bash
# Should return no output (except .Values references and comments)
grep -r 'password\|secret\|key' helm/remedyiq/templates/ | grep -v '.Values\|#'
```

Expected: No matches (all values come from `.Values` which references ESO)

## 5. Security Checklist

- [ ] No AWS access keys stored in Kubernetes or git
- [ ] No secrets in Docker images (verified by Trivy scan)
- [ ] `.env` files excluded from git via `.gitignore`
- [ ] `.env` files excluded from Docker images via `.dockerignore`
- [ ] Gitleaks runs on every PR to detect committed secrets
- [ ] IRSA role has minimal permissions (only `secretsmanager:GetSecretValue`)
- [ ] Secrets are encrypted at rest in AWS Secrets Manager
- [ ] Secrets are encrypted in transit (TLS) between ESO and AWS

## Troubleshooting

### ExternalSecret Not Syncing

```bash
# Check ExternalSecret status
kubectl get externalsecret -n remedyiq-staging
kubectl describe externalsecret remedyiq-staging-secrets-ext -n remedyiq-staging

# Check ESO controller logs
kubectl logs -n external-secrets deployment/external-secrets

# Common issues:
# 1. IRSA role not annotated: kubectl describe sa external-secrets -n external-secrets
# 2. Secret path doesn't exist: aws secretsmanager describe-secret --secret-id /remedyiq/staging
# 3. IAM permissions missing: Check CloudTrail for denied calls
```

### Pod Can't Read Secret

```bash
# Verify secret exists in namespace
kubectl get secret remedyiq-staging-secrets -n remedyiq-staging

# Check secret contents (base64 encoded)
kubectl get secret remedyiq-staging-secrets -n remedyiq-staging -o jsonpath='{.data.POSTGRES_URL}' | base64 -d

# Verify pod has envFrom configured
kubectl get deployment remedyiq-staging-api -n remedyiq-staging -o yaml | grep -A5 envFrom
```

### Gitleaks False Positive

If Gitleaks flags a false positive, add a `.gitleaks.toml` file:

```toml
[allowlist]
paths = [
  '''docs/ops/secrets-management-runbook.md''',
]
```
