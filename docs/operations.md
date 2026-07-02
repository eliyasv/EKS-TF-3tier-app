# Operations and Deployment

This document covers prerequisites, deployment checklist, maintenance, and troubleshooting.

## Prerequisites

### Cluster
- AWS EKS cluster
- ALB Ingress Controller
- EBS CSI Driver
- Argo CD installed
- External DNS (optional)

### Jenkins
- Jenkins with required plugins
- AWS credentials for ECR/EKS
- SonarQube integration
- GitHub integration

### AWS
- ECR repositories: `frontend`, `backend`
- ACM certificate for TLS
- WAF v2 WebACL (optional)
- IAM roles/policies for EKS nodes

## Deployment checklist

- Terraform infrastructure provisioned
- ECR repositories created
- Jenkins configured with credentials/plugins
- SonarQube server accessible
- Argo CD connected to Git repository
- ALB Ingress Controller running
- EBS CSI Driver installed
- Namespace `mern-app` created
- Secrets created or provisioned via External Secrets
- `k8s/ingress.yaml` updated with ACM certificate ARN, WAF ACL ARN, and domain

## GitOps workflow

1. Build and push frontend/backend images via Jenkins CI
2. Run the release pipeline to update `k8s/` manifests and open a PR
3. Argo CD syncs the cluster state from Git

## Troubleshooting

```bash
kubectl get pods -n mern-app
kubectl logs -n mern-app -l app=backend
kubectl describe deployment backend -n mern-app
kubectl get hpa -n mern-app
kubectl get ingress -n mern-app
kubectl get pdb -n mern-app
```

## High availability

- Multi-replica backend and frontend deployments
- 3-node MongoDB replica set
- PDBs to protect availability
- Topology spread and anti-affinity across zones

## Notes

- This repository focuses on application delivery and Kubernetes deployment
- Infrastructure provisioning is handled separately via Terraform
- Use managed AWS services and IRSA wherever possible for production
