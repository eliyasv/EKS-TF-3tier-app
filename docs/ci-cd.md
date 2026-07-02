# CI/CD Overview

This repository uses Jenkins for CI builds and a separate GitOps release flow for Kubernetes manifest updates.

## Pipelines

- `Jenkinsfile-Backend`: backend build, analysis, container build, and ECR push
- `Jenkinsfile-frontend`: frontend build, analysis, container build, and ECR push
- `Jenkinsfile-Release`: release pipeline that updates `k8s/` manifests and creates a GitHub pull request for Argo CD sync

## Pipeline stages

Common stages include:
- cleaning workspace
- checkout code
- build metadata
- validate package / build
- SonarQube analysis
- quality gate enforcement
- OWASP dependency scan
- Trivy file-system scan
- Docker image build and push
- Trivy image scan

## Security and quality checks

- SonarQube static analysis with hard quality gate enforcement
- OWASP Dependency-Check for vulnerable dependencies
- Trivy filesystem and image scanning

## Environment variables

| Variable | Purpose |
|----------|---------|
| `SCANNER_HOME` | SonarQube scanner path |
| `AWS_ACCOUNT_ID` | AWS account ID for ECR |
| `AWS_ECR_REPO_NAME` | ECR repository name |
| `AWS_DEFAULT_REGION` | AWS region |
| `ECR_REPO_URL` | Target ECR repository URL |
| `GIT_REPO_NAME` | GitHub repository name |
| `GIT_USER_NAME` | GitHub user name |

## Jenkins requirements

Required Jenkins components:
- Docker plugin
- SonarQube Scanner plugin
- OWASP Dependency-Check plugin

Required tooling:
- Node.js
- SonarQube Scanner
- Dependency-Check CLI

## Credentials

- `ACCOUNT_ID` — AWS account ID
- `GITHUB` — GitHub repo credentials
- `github` — GitHub token for commits
- `sonar-server` — SonarQube server configuration
