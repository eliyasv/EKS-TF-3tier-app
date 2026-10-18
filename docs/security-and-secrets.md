# Security and Secrets

This document summarizes security hardening and secret management for the application.

## Pod security

- Non-root containers for app and database
- `runAsNonRoot` enabled
- `readOnlyRootFilesystem` enabled for application workloads
- dropped Linux capabilities
- `allowPrivilegeEscalation: false`

These describe the main app/database containers. MongoDB's keyfile-permission
init container runs as root with the CHOWN capability; do not describe every
container as non-root. Secret values and actual enforcement must still be reviewed.

## Network policies

NetworkPolicies are defined in `k8s/networkpolicies/networkpolicies.yaml`.

Current rule intent and limitations:
- Frontend Service exposes port 80 but its Nginx pod listens on 8080. The policy
  currently allows ingress on 80, so it needs correction before enforcing it.
- Backend accepts port 5000 from frontend pods and the listed VPC CIDRs, including
  ALB IP-target traffic. It is not restricted solely to frontend pods.
- MongoDB accepts port 27017 from backend, replica peers, initialization and backup pods.
- DNS egress rules permit configured kube-system DNS traffic.
- Objects alone do not demonstrate isolation. The checked-in VPC CNI add-on inputs
  do not enable policy enforcement; inspect/test the live engine before claiming it.
- Browser-side React sends API requests through the ALB; the frontend Nginx
  configuration does not proxy /api to the backend.

## Secret management

This repository favors external secret management for production.

### AWS External Secrets

- External Secrets manifests are under `k8s/external-secrets/`
- Use AWS Secrets Manager for MongoDB credentials and keyfile
- Avoid storing static secrets in Git
- The companion `EKS-TF-infra` project creates an IRSA role for the External Secrets Operator service account: `system:serviceaccount:external-secrets:external-secrets`
- `k8s/external-secrets/aws-secretstore.yaml` relies on that IRSA role instead of a static AWS access key secret

### Secrets referenced by manifests

- `mongodb-secret` for database username/password
- `mongodb-keyfile` for replica set authentication
