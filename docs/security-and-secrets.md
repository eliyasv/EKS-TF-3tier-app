# Security and Secrets

This document summarizes security hardening and secret management for the application.

## Pod security

- Non-root containers for app and database
- `runAsNonRoot` enabled
- `readOnlyRootFilesystem` enabled for application workloads
- dropped Linux capabilities
- `allowPrivilegeEscalation: false`

## Network policies

NetworkPolicies are defined in `k8s/networkpolicies/networkpolicies.yaml`.

Traffic rules:
- `frontend` receives public HTTP traffic and may call `backend` on port 5000
- `backend` accepts traffic from `frontend` and accesses `mongodb` on port 27017
- `mongodb` accepts traffic from `backend` and replica peers only

## Secret management

This repository favors external secret management for production.

### AWS External Secrets

- External Secrets manifests are under `k8s/external-secrets/`
- Use AWS Secrets Manager for MongoDB credentials and keyfile
- Avoid storing static secrets in Git

### Secrets referenced by manifests

- `mongodb-secret` for database username/password
- `mongodb-keyfile` for replica set authentication
- `aws-credentials` for External Secrets controller authentication (recommend IRSA in production)
