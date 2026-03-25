# GitHub Environments Setup Guide

This guide explains how to configure GitHub Environments for the RemedyIQ deployment pipeline.

## Overview

The deployment workflow uses two GitHub Environments:
- **staging**: Automatic deployment (no approval required)
- **production**: Requires manual approval before deployment

## Creating GitHub Environments

### 1. Navigate to Repository Settings

1. Go to your GitHub repository
2. Click **Settings** → **Environments** (in the left sidebar)
3. Click **New environment**

### 2. Create Staging Environment

1. Name: `staging`
2. Click **Configure environment**
3. Leave protection rules empty (no approval required)
4. Add the following environment variables:
   - `AWS_ACCOUNT_ID`: Your AWS account ID (e.g., `123456789012`)
   - `AWS_REGION`: AWS region for deployment (e.g., `us-east-1`)
   - `EKS_CLUSTER_NAME`: Name of your EKS cluster (e.g., `remedyiq-prod`)
   - `AWS_ROLE_TO_ASSUME`: ARN of the GitHub Actions IAM role (e.g., `arn:aws:iam::123456789012:role/github-actions-remedyiq`)

### 3. Create Production Environment

1. Click **New environment**
2. Name: `production`
3. Click **Configure environment**
4. Enable **Required reviewers**:
   - Add the GitHub usernames of team members who can approve production deployments
   - Minimum 1 reviewer required
5. Set **Wait timer** (optional): `0` (or configure a delay)
6. Add the same environment variables as staging:
   - `AWS_ACCOUNT_ID`
   - `AWS_REGION`
   - `EKS_CLUSTER_NAME`
   - `AWS_ROLE_TO_ASSUME`

## Approving a Production Deployment

When a merge to `main` triggers the deployment workflow:

1. Go to **Actions** → select the running `Deploy` workflow
2. Wait for `build-push` and `deploy-staging` jobs to complete
3. The `deploy-prod` job will show "Waiting" status
4. Click **Review deployments**
5. Select the `production` environment
6. Add a comment (optional) and click **Approve and deploy**
7. The production deployment will begin

## Rollback Procedure

If a production deployment causes issues, you can roll back using Helm:

```bash
# List deployment history
helm history remedyiq-prod -n remedyiq-prod

# Roll back to previous release
helm rollback remedyiq-prod -n remedyiq-prod

# Roll back to a specific revision
helm rollback remedyiq-prod <REVISION> -n remedyiq-prod
```

### Rollback Timeline

- Rollback should complete within **5 minutes**
- Monitor pod status: `kubectl get pods -n remedyiq-prod -w`
- Verify health: `kubectl get ingress -n remedyiq-prod`

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_ACCOUNT_ID` | AWS account ID | `123456789012` |
| `AWS_REGION` | AWS region for EKS and ECR | `us-east-1` |
| `EKS_CLUSTER_NAME` | EKS cluster name | `remedyiq-prod` |
| `AWS_ROLE_TO_ASSUME` | IAM role ARN for GitHub Actions | `arn:aws:iam::123456789012:role/github-actions-remedyiq` |

## Security Notes

- The `AWS_ROLE_TO_ASSUME` role must have:
  - ECR read/write permissions
  - EKS cluster access (via `aws-auth` ConfigMap)
  - The GitHub OIDC provider must be configured in AWS IAM
- Production environment reviewers should be limited to senior team members
- Consider enabling deployment branches restriction to only allow `main` branch
