# Kubernetes Resources

This document summarizes the main Kubernetes manifests in the repository.

## Namespace

- Namespace: `mern-app`

## Backend

- Deployment: `k8s/backend/deployment.yaml`
- Service: `k8s/backend/service.yaml`
- ConfigMap: `k8s/backend/configmap.yaml`

## Frontend

- Deployment: `k8s/frontend/deployment.yaml`
- Service: `k8s/frontend/service.yaml`
- ConfigMap: `k8s/frontend/configmap.yaml`

## MongoDB

- StatefulSet: `k8s/db/statefulset.yaml`
- Service: `k8s/db/service.yaml`
- PVC StorageClass: `k8s/db/storageclass.yaml`
- PDB: `k8s/db/pdb-mongodb.yaml`
- Initialization job: `k8s/db/mongodb-init-job.yaml`

### MongoDB notes

- Uses a 3-node replica set (`rs0`)
- Uses a keyfile-based replica authentication secret at `mongodb-keyfile`
- Uses a one-shot Job for replica set initialization rather than a long-running bootstrap sidecar

## Ingress

- ALB ingress configuration: `k8s/ingress.yaml`
- Health check path: `/healthz`

## Autoscaling

- HPA definitions: `k8s/hpa.yaml`

## Network and security

- NetworkPolicies: `k8s/networkpolicies/networkpolicies.yaml`
- Pod Disruption Budgets: `k8s/pdb.yaml`, `k8s/db/pdb-mongodb.yaml`

## GitOps

- Argo CD Project: `k8s/argocd/argocd-project.yaml`
- Argo CD Application: `k8s/argocd/argocd-application.yaml`

## Logging

- Fluent Bit manifest: `k8s/logging/daemonset.yaml`
- Fluent Bit config: `k8s/logging/configmap.yaml`
- Logging namespace and RBAC: `k8s/logging/namespace.yaml`, `k8s/logging/rbac.yaml`
