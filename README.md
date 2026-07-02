
# EKS-TF-3tier-app

A production-style 3-tier application delivery repository for AWS EKS.
It uses Jenkins for CI, Argo CD for GitOps, and Kubernetes manifests for frontend, backend, and MongoDB deployment.

## What this repo contains

- `App-Code/` - frontend and backend application code
- `Jenkins-pipeline/` - CI pipelines and GitOps release flow
- `k8s/` - Kubernetes manifests for application, database, logging, networking, and GitOps
- `docs/` - focused docs for CI/CD, Kubernetes resources, observability, security, and operations

## Key concepts

- Jenkins builds and pushes Docker images to ECR
- A separate release pipeline updates `k8s/` manifests and creates a PR for Argo CD
- Argo CD syncs cluster state from Git
- MongoDB uses a 3-node replica set with a dedicated init Job
- Secrets are managed using AWS Secrets Manager and External Secrets
- Backend exposes health and readiness probes plus Prometheus-compatible `/metrics`

## Quick start

1. Ensure the EKS cluster and required services exist.
2. Apply the namespace and storage manifests if needed:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/db/storageclass.yaml
```

3. Install Argo CD and apply GitOps manifests:

```bash
kubectl apply -f k8s/argocd/argocd-project.yaml
kubectl apply -f k8s/argocd/argocd-application.yaml
```

4. Build and push frontend/backend images using Jenkins.
5. Run the release pipeline to update `k8s/` manifests and trigger Argo CD sync.

## Recommended docs

- `docs/ci-cd.md` - Jenkins pipelines and build flow
- `docs/k8s-resources.md` - Kubernetes manifest overview
- `docs/observability.md` - health checks and Prometheus/Grafana guidance
- `docs/security-and-secrets.md` - security hardening and secret management
- `docs/operations.md` - prerequisites, deployment, and troubleshooting

## Repository layout

```
App-Code/
Jenkins-pipeline/
k8s/
docs/
README.md
```

## Useful commands

```bash
kubectl get pods -n mern-app
kubectl get ingress -n mern-app
kubectl get hpa -n mern-app
kubectl apply -f k8s/db/mongodb-init-job.yaml
```

## Notes

This repository focuses on application delivery and Kubernetes deployment. Infrastructure provisioning is managed separately in the companion Terraform project.
