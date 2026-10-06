# Operations and Deployment

This document covers prerequisites, deployment checklist, maintenance, and troubleshooting.

For the full manual bootstrap checklist, see [redeployment](redeployment.md).
For ordered deletion, see [teardown](teardown.md). Monitoring and SSM access are in
[observability](observability.md).

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
- ACM certificate for HTTPS (optional for the current HTTP-only dev ingress)
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
- `k8s/ingress.yaml` provides a dev HTTP-only ALB ingress for smooth test deployments
- `k8s/ingress-prod.yaml.example` shows the production-style HTTPS/domain/WAF placeholders to fill before use

### Verify worker placement before installing MongoDB

Run from a host connected to the EKS cluster:

```bash
kubectl get nodes -l type=ondemand -L topology.kubernetes.io/zone
kubectl get nodes -l type=spot -L topology.kubernetes.io/zone
```

Require at least three schedulable, Ready on-demand workers, with one in each of
`us-east-1a`, `us-east-1b`, and `us-east-1c`, and enough allocatable capacity for
MongoDB and system pods. Three configured subnets do not confirm worker placement.
Also require Ready Spot workers with enough capacity for frontend/backend pods
and rolling updates.

MongoDB requires separate worker nodes and spreads its three members across at
least three eligible zones. If capacity is missing, members remain Pending instead
of sharing a worker or violating zone spread. Each member has its own EBS PVC;
existing volumes remain tied to their provisioned AZ.

Frontend and backend require nodes labelled `type=spot` and remain Pending when
Spot capacity is unavailable. After deployment, verify actual placement:

```bash
kubectl get pods -n mern-app -o wide
```

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
