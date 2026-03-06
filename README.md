## 3-Tier Application CI/CD with Kubernetes, AWS EKS, Jenkins & Argo CD (GitOps)

This project demonstrates a production-style deployment of a containerized 3-tier application on AWS EKS using Jenkins CI pipelines for application delivery and Argo CD for GitOps-based Kubernetes deployment.

The platform infrastructure is provisioned separately using Terraform (see EKS-TF-infra project).

This repository focuses on application delivery workflows on Kubernetes.

---
### Directory Overview

     1 EKS-TF-3tier-app/
     2 ├── App-Code/          # Application source code
     3 ├── Jenkins-pipeline/  # CI/CD automation
     4 ├── k8s/               # Kubernetes deployment configs
     5 └── README.md          # Documentation

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

    
#### This setup enables:

- Scalability - Multiple replicas of frontend/backend
- High Availability - Health probes + rolling updates
- Persistence - MongoDB data survives pod restarts
- Security - Secrets for credentials, isolated namespace
- Automation - CI/CD pipeline for continuous deployment

#### Deployment responsibilities are separated:

- Infrastructure → Terraform
- Frontend & Backend→ Jenkins CI pipeline
- Database → GitOps (Argo CD)
- Cluster → AWS EKS
      
#### Frontend & Backend CI Pipeline (Jenkins)

Both pipeline includes:

- Code Quality check
- SonarQube analysis
- Quality gate validation
- Security Scanning
- OWASP Dependency-Check
- Trivy filesystem scan
- Trivy container image scan

Container Workflow

- Docker image build (multistage for optimised image)
- Image tagging using Jenkins build number
- Push image to Amazon ECR

GitOps Deployment Trigger

- Kubernetes deployment manifest updated with new image tag
- Changes committed to Git repository
- Argo CD automatically synchronizes deployment to EKS

#### Database Deployment (GitOps)

The database layer is deployed as a Kubernetes StatefulSet.

Characteristics:
- Persistent storage using StatefulSet
- Declarative Kubernetes manifests stored in Git
- Managed using Argo CD synchronization
- No CI build pipeline required

---

### App's Flow

    ┌──────────────────────────────────────────────────────────────┐
    │  User clicks "Add Task" on ignus.xyz                         │
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
│   2-8 pods      │              │   2-10 pods     │              │    1 pod        │
│   HPA + PDB     │              │   HPA + PDB     │              │    PDB + Backup │
│   ClusterIP     │              │   ClusterIP     │              │    PVC 1Gi      │
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

## High Availability

### Availability Targets

| Component | Replicas | PDB | Expected Availability |
|-----------|----------|-----|----------------------|
| Frontend | 2-8 | minAvailable: 1 | 99.5% |
| Backend | 2-10 | minAvailable: 1 | 99.5% |
| MongoDB | 1 | maxUnavailable: 1 | 99.0% (SPOF) |
| ALB | Managed | N/A | 99.99% |

### Failure Scenarios

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| Pod failure | No downtime (HPA maintains min 2) | Auto restart |
| Node failure | Pods rescheduled | Cluster autoscaler |
| AZ failure | **Disruption** (single AZ) | Multi-AZ recommended |
| MongoDB failure | **Database unavailable** | PVC persists; restore from backup |

---
### Known Limitations (Portfolio Context)

| Limitation | Severity | Why Accepted |
|------------|----------|--------------|
| Single MongoDB replica | High | Cost vs. portfolio value |
| Single AZ deployment | High | Cost; demonstrates concept |
| No metrics stack | Medium | Adds complexity without real traffic |
| Quality gates non-blocking | Medium | Development velocity |
| No network policies | Low | Single namespace; limited exposure |

**Note**: These are intentional trade-offs for a portfolio project. Production deployments should address High severity items.

---


### Prerequisites

#### Jenkins server Requirements

Ensure Jenkins is configured with:

- **Plugins**:
  - Docker
  - SonarQube Scanner
  - OWASP Dependency-Check

- **Installed Tools**:
  - AWS CLI
  - Trivy CLI

- **Credentials & Access**:
  - AWS credentials with ECR access
  - GitHub access token
  - SonarQube server and token

### Argo CD Requirements

- Argo CD installed and running
- Proper access configured to monitor your Git repository
- Applications created and configured to apply manifests to the EKS cluster

### Ingress

- Ensure Ingree controller is installed and configured
---

### Jenkins Environment Variables

These environment variables and credentials should be configured in Jenkins:

| Variable             | Description                                |
|----------------------|--------------------------------------------|
| `SONARQUBE_ENV`      | Jenkins SonarQube configuration name       |
| `AWS_ACCOUNT_ID`     | AWS account ID                             |
| `AWS_ECR_REPO_NAME`  | ECR repository names                       |
| `AWS_DEFAULT_REGION` | AWS region                                 |
| `ECR_REPO_URL`       | Complete ECR repository URL                |
| `GITHUB`             | GitHub credentials ID in Jenkins           |
| `sonar-token`        | SonarQube authentication token credentials |

---

### Usage

- Pipelines support both **manual** and **automated** triggers.
- Backend and frontend can build and deploy **in parallel**.
- Kubernetes deployments always point to the **latest image**.
- Argo CD ensures **cluster state matches Git** automatically.
- StatefulSet changes are GitOps-managed

---

#### Further improvements and sugestions 

- **Security Rules**: Tune SonarQube and Trivy policies for stricter or more lenient scanning.
- **Quality Gates**: Set `abortPipeline: true` to fail builds on SonarQube quality gate failure.
- **Approval Gates**: Add manual approvals for production releases if required.
- **Argo CD Policies**: Modify sync strategy (`auto`, `manual`, `hook-based`) as needed.
- **Prometheuse and Grafana**: Set up and configure Prometheus and Grafana for montoring

---




