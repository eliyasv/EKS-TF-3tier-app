## 3-Tier Application CI/CD with Kubernetes, AWS EKS, Jenkins & Argo CD (GitOps)

This project demonstrates a production-style deployment of a containerized 3-tier application on AWS EKS using Jenkins CI pipelines for application delivery and Argo CD for GitOps-based Kubernetes deployment.

The platform infrastructure is provisioned separately using Terraform (see EKS-TF-infra project).

This repository focuses on application delivery workflows on Kubernetes.

---
### Directory Overview

```
EKS-TF-3tier-app/
├── App-Code/                    # Application source code (frontend & backend)
├── Jenkins-pipeline/            # CI/CD pipeline definitions
│   ├── Jenkinsfile-Backend      # Backend CI pipeline
│   └── Jenkinsfile-frontend     # Frontend CI pipeline
├── k8s/                         # Kubernetes manifests
│   ├── namespace.yaml           # Namespace definition
│   ├── hpa.yaml                 # Horizontal Pod Autoscaler
│   ├── pdb.yaml                 # Pod Disruption Budgets
│   ├── ingress.yaml             # ALB Ingress configuration
│   ├── backend/                 # Backend K8s resources
│   ├── frontend/                # Frontend K8s resources
│   ├── db/                      # Database K8s resources
│   └── logging/                 # Logging stack (Fluent Bit)
└── README.md                    # Documentation

```

---

### Architecture Overview

    ┌────────────┬────────────┬─────────────────┬──────────────────────┐
    │ Tier       │ Component  │ Technology      │ K8s Resource         │
    ├────────────┼────────────┼─────────────────┼──────────────────────┤
    │ Frontend   │ React UI   │ Node.js + React │ Deployment + Service │
    │ Backend    │ REST API   │ Express.js      │ Deployment + Service │
    │ Database   │ MongoDB    │ mongo:6         │ StatefulSet + PVC    │
    │ Networking │ Ingress    │ AWS ALB         │ Ingress              │
    │ Storage    │ Persistent │ AWS EBS gp3     │ StorageClass + PVC   │
    │ CI/CD      │ Automation │ Jenkins         │ Jenkinsfile          │
    └────────────┴────────────┴─────────────────┴──────────────────────┘

---

### App's Flow

    ┌──────────────────────────────────────────────────────────────┐
    │  User clicks "Add Task" on your-domain.com                   │
    └──────────────────────────────────────────────────────────────┘
         │
      ┌─────────────┐
      │  Frontend   │  React sends: POST /api/tasks
      │  (Pod:80)   │  { title: "Call friend" }
      └─────────────┘
         │
      ┌─────────────┐
      │  Backend    │  1. Validate task title
      │  (Pod:5000) │  2. Check user authenticated
      |             │  3. Add createdAt timestamp
      |             │  4. Build MongoDB query
      └─────────────┘
         │
      ┌─────────────┐
      │  MongoDB    │  1. Store in tasks collection
      │  (Pod:27017)│  2. Return saved document
      └─────────────┘
         │
       Response flows back to user 
      

---

### System Diagram

```
                               ┌─────────────────┐
                               │      Users      │
                               └────────┬────────┘
                                        │
                                ┌────────▼────────┐
                                │  AWS ALB + WAF  │
                                │  SSL/TLS (443)  │
                                └────────┬────────┘
                                         │
                          ┌──────────────▼──────────────┐
                          │     EKS Cluster (us-east-1) │
                          └──────────────┬──────────────┘
                                         │
         ┌───────────────────────────────┼──────────────────────────────────┐
         │                               │                                  │
         ▼                               ▼                                  ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│    Frontend     │              │     Backend     │              │     MongoDB     │
│   Deployment    │              │    Deployment   │              │    StatefulSet  │
│   3-8 pods      │              │   3-10 pods     │              │    3 pods       │
│   HPA + PDB     │              │   HPA + PDB     │              │    Replica Set  │
│   ClusterIP     │              │   ClusterIP     │              │    PVC 5Gi      │
└────────┬────────┘              └────────┬────────┘              └────────┬────────┘
         │                                │                                │
         └────────────────────────────────┴────────────────────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │  Fluent Bit DS  │
                                 │  (Log Agent)    │
                                 └─────────────────┘
```
---

### CI/CD Flow

```
Developer Push → GitHub → Jenkins CI → ECR → Git Commit → Argo CD → EKS
                         │
                         ├─→ SonarQube (Quality)
                         ├─→ OWASP (Dependencies)
                         ├─→ Trivy FS (Code Scan)
                         ├─→ Trivy Image (Container Scan)
                         └─→ Docker Build & Push
```
---

## CI/CD Pipeline

### Jenkins Pipeline Stages

Both frontend and backend pipelines include:

```
1. Cleaning Workspace
2. Checkout (Git)
3. SonarQube Analysis
4. Quality Gate Check
5. OWASP Dependency Check
6. Trivy File System Scan
7. Docker Image Build
8. Push to ECR
9. Trivy Image Scan
10. Update Kubernetes Deployment Manifest
```

### Pipeline Features

- **Code Quality**: SonarQube static analysis with quality gates
- **Security Scanning**: 
  - OWASP Dependency-Check for vulnerable packages
  - Trivy filesystem scan for code vulnerabilities
  - Trivy container image scan for OS/package vulnerabilities
- **Container Build**: Multi-stage Docker builds for optimized images
- **GitOps Integration**: Automatic commit of updated deployment manifests to Git

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SCANNER_HOME` | SonarQube scanner tool path |
| `AWS_ACCOUNT_ID` | AWS account ID (from Jenkins credentials) |
| `AWS_ECR_REPO_NAME` | ECR repository name (`frontend` or `backend`) |
| `AWS_DEFAULT_REGION` | AWS region (`us-east-1`) |
| `ECR_REPO_URL` | Constructed ECR repository URL |
| `GIT_REPO_NAME` | GitHub repository name |
| `GIT_USER_NAME` | GitHub username |

### Required Jenkins Configuration

**Plugins:**
- Docker Plugin
- SonarQube Scanner
- OWASP Dependency-Check Plugin

**Tools:**
- NodeJS installation
- SonarQube Scanner
- Dependency-Check (DP-Check)

**Credentials:**
- `ACCOUNT_ID` - AWS account ID
- `GITHUB` - GitHub credentials for repository access
- `github` - GitHub token for commits
- `sonar-server` - SonarQube server configuration

---

## Kubernetes Resources

### Namespace
- **Name**: `mern-app`
- All application resources are isolated in a dedicated namespace

### Deployments

#### Backend Deployment
```yaml
Replicas: 3
Strategy: RollingUpdate (maxSurge: 1, maxUnavailable: 0)
Image: ECR backend
Port: 5000
Node Preference: Hybrid (OnDemand weight: 50, Spot weight: 30)
Topology Spread: Across zones and nodes
Security: Non-root user (1000), read-only filesystem, dropped capabilities
```

#### Frontend Deployment
```yaml
Replicas: 3
Strategy: RollingUpdate (maxSurge: 1, maxUnavailable: 0)
Image: ECR frontend
Port: 80
Node Preference: Spot nodes (weight: 80)
Topology Spread: Across zones and nodes
Security: Non-root user (1000), read-only filesystem, dropped capabilities
```

### MongoDB StatefulSet
```yaml
Replicas: 3 (Replica Set: rs0)
Image: mongo:6
Port: 27017
Storage: 5Gi PVC (ebs-csi StorageClass)
Node Selector: type=ondemand
Topology Spread: Across zones
Security: Non-root user (999), dropped capabilities
```

### Horizontal Pod Autoscaler (HPA)

| Component | Min Replicas | Max Replicas | CPU Target | Memory Target |
|-----------|--------------|--------------|------------|---------------|
| Backend | 3 | 10 | 70% | 80% |
| Frontend | 3 | 8 | 70% | 80% |

**Scaling Behavior:**
- Scale Down: 300s stabilization, 10% per 60s
- Scale Up: Immediate, max(100% or 4 pods) per 15s

### Pod Disruption Budget (PDB)

| Component | Policy |
|-----------|--------|
| Backend | `minAvailable: 2` |
| Frontend | `minAvailable: 2` |
| MongoDB | `minAvailable: 2` (defined in `k8s/db/pdb-mongodb.yaml`) |

### Ingress (AWS ALB)

**Configuration:**
- Scheme: Internet-facing
- Target Type: IP
- Ports: HTTP (80), HTTPS (443)
- SSL Redirect: Enabled
- Health Check: `/healthz` (200 OK)

**Routing Rules:**
| Path | Backend Service | Port |
|------|-----------------|------|
| `/api` | backend | 5000 |
| `/healthz` | backend | 5000 |
| `/ready` | backend | 5000 |
| `/started` | backend | 5000 |
| `/` | frontend | 80 |

**Annotations:**
- SSL certificate via ACM (update `k8s/ingress.yaml` with your ACM certificate ARN)
- WAF v2 ACL for rate limiting (update `k8s/ingress.yaml` with your WAF ACL ARN)
- CORS configuration for API paths

---

## Logging

### Fluent Bit DaemonSet (light weight)

**Namespace**: `logging`

**Configuration:**
- Runs on every node for log collection
- Collects logs from `/var/log`, `/var/lib/docker/containers`, `/var/lib/kubelet/logs`
- Exposes HTTP endpoint on port 2020 for monitoring

**Resources:**
- Requests: 32Mi memory, 100m CPU
- Limits: 128Mi memory, 500m CPU

**Components:**
- ConfigMap: `fluent-bit-config` (contains fluent-bit.conf, filters, outputs, parsers)
- ServiceAccount: `fluent-bit`
- RBAC: ClusterRole + ClusterRoleBinding

---

## Security Features

### Pod Security Context

| Setting | Value |
|---------|-------|
| `runAsNonRoot` | true |
| `runAsUser` | 1000 (app), 999 (db) |
| `allowPrivilegeEscalation` | false |
| `readOnlyRootFilesystem` | true (apps) |
| `capabilities.drop` | ["ALL"] |

### Network Security

- AWS WAF integration via ALB for rate limiting
- Namespace isolation (`mern-app`)

### Secret Management

- MongoDB credentials stored as Kubernetes Secrets
- ECR pull secrets for private registry access
- AWS credentials via IAM (IRSA)

---

## Storage Configuration

### MongoDB Persistent Storage

```yaml
StorageClass: ebs-csi
AccessMode: ReadWriteOnce
Size: 5Gi
VolumeClaimTemplate: mongo-persistent-storage
```

### Topology Spread Constraints

MongoDB StatefulSet includes:
- Zone spread for availability
- Pod anti-affinity for node distribution
- Node affinity for ondemand instance type

---

### Argo CD Integration

- Monitors Git repository for manifest changes
- Automatically syncs cluster state to Git-defined state
- Database deployment managed via GitOps (no CI pipeline)
- Frontend/Backend deployments triggered by Jenkins commits

---

## Prerequisites

### Cluster Requirements

- AWS EKS cluster (provisioned via Terraform)
- ALB Ingress Controller installed
- EBS CSI Driver installed
- Argo CD installed and configured
- External DNS (optional, for DNS management)

### Jenkins Requirements

- Jenkins server with required plugins
- AWS credentials with ECR and EKS access
- SonarQube server configured
- GitHub integration configured

### AWS Requirements

- ECR repositories: `frontend`, `backend`
- ACM certificate for SSL/TLS
- WAF v2 WebACL (optional)
- IAM roles/policies for EKS nodes

---

## Deployment Checklist

- Terraform infrastructure provisioned
- ECR repositories created
- Jenkins configured with credentials and plugins
- SonarQube server accessible
- Argo CD connected to Git repository
- ALB Ingress Controller running
- EBS CSI Driver installed
- Namespace created (`mern-app`)
- Secrets created (MongoDB credentials, ECR pull secret)
- ACM certificate ARN updated in ingress.yaml (replace `<CERTIFICATE_ID>` placeholder)
- WAF ACL ARN updated in ingress.yaml (replace `<WAF_ACL_NAME>` placeholder)
- Domain updated in ingress.yaml (replace `<YOUR_DOMAIN>` placeholder)

---

## Maintenance & Operations

### Scaling

- **Manual**: Update `replicas` in deployment.yaml
- **Automatic**: HPA manages based on CPU/memory utilization
- **Cluster**: Cluster Autoscaler for node scaling

### Updates

1. Code change → Jenkins pipeline triggers
2. New image built and pushed to ECR
3. Deployment manifest updated and committed
4. Argo CD syncs changes to cluster
5. Rolling update with zero downtime

### Troubleshooting

```bash
# Check pod status
kubectl get pods -n mern-app

# View logs
kubectl logs -n mern-app -l app=backend

# Describe deployment
kubectl describe deployment backend -n mern-app

# Check HPA status
kubectl get hpa -n mern-app

# View ingress
kubectl get ingress -n mern-app

# Check PDB status
kubectl get pdb -n mern-app
```

---

## High Availability

| Component | Availability Target | Notes |
|-----------|---------------------|-------|
| Frontend | 99.9% | Min 3 replicas, PDB protected, zero-downtime updates |
| Backend | 99.9% | Min 3 replicas, PDB protected, zero-downtime updates |
| MongoDB | 99.9% | 3-node replica set with auto-failover |
| ALB | 99.99% | AWS managed service |

### Features Implemented

| Feature | Notes |
|---------|-------|
| Multi-replica MongoDB | 3-node replica set (rs0) with quorum |
| Multi-AZ deployment | Topology spread constraints across zones |
| Zero-downtime updates | maxUnavailable: 0 with PDB protection |
| Pod distribution | Spread across nodes and availability zones |

---

## Notes

- Infrastructure provisioning is handled separately via Terraform (EKS-TF-infra project)
- This repository focuses on application delivery and Kubernetes deployment
- Portfolio project - production deployments should address High severity limitations
- All container images use non-root users for security
- Spot instances used for cost optimization (with ondemand for database)

---

## Quick Start

```bash
# Apply namespace
kubectl apply -f k8s/namespace.yaml

# Apply secrets (update values first)
kubectl apply -f k8s/db/secrets.yaml

# Apply storage class
kubectl apply -f k8s/db/storageclass.yaml

# Apply all resources
kubectl apply -f k8s/

# Initialize MongoDB replica set (run once after first deploy)
kubectl exec -it mongodb-0 -n mern-app -- mongosh --eval '
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongodb-0.mongodb-svc:27017" },
    { _id: 1, host: "mongodb-1.mongodb-svc:27017" },
    { _id: 2, host: "mongodb-2.mongodb-svc:27017" }
  ]
})
'

# Verify deployment
kubectl get all -n mern-app

# Check replica set status
kubectl exec -it mongodb-0 -n mern-app -- mongosh --eval 'rs.status()'

# Check ingress
kubectl get ingress -n mern-app
```

**Note**: The backend ConfigMap (`k8s/backend/configmap.yaml`) is pre-configured with the replica set connection string. No changes needed.

---
#### Further improvements and sugestions 

- **Security Rules**: Tune SonarQube and Trivy policies for stricter or more lenient scanning.
- **Quality Gates**: Set `abortPipeline: true` to fail builds on SonarQube quality gate failure.
- **Approval Gates**: Add manual approvals for production releases if required.
- **Argo CD Policies**: Modify sync strategy (`auto`, `manual`, `hook-based`) as needed.
- **Prometheuse and Grafana**: Set up and configure Prometheus and Grafana for montoring

---



