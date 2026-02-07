## 3-Tier Application CI/CD with Kubernetes, AWS EKS, Jenkins & Argo CD (GitOps)

This project demonstrates a production-style deployment of a containerized 3-tier application on AWS EKS using Jenkins CI pipelines for application delivery and Argo CD for GitOps-based Kubernetes deployment.

The platform infrastructure is provisioned separately using Terraform (see EKS-TF-infra project).

This repository focuses on application delivery workflows on Kubernetes.

---

### Architecture Overview

The application follows a standard 3-tier architecture:

Frontend 
Backend 
Database 

Deployment responsibilities are separated:

Infrastructure → Terraform
Frontend → Jenkins CI pipeline
Backend → Jenkins CI pipeline
Database → GitOps (Argo CD)
Cluster → AWS EKS

### Features

- Independent pipelines for **backend** and **frontend**
- GitOps-managed deployments with Argo CD
- Automated static code analysis using **SonarQube**
- Dependency scanning with **OWASP Dependency-Check**
- Vulnerability scanning via **Trivy**
- Docker image publishing to **Amazon ECR**
- Auto-update of Kubernetes manifests on successful builds
- Continuous delivery via Argo CD to **AWS EKS**

---

#### Frontend & Backend CI Pipeline (Jenkins)

Both pipeline includes:

- Code Quality
- SonarQube analysis
- Quality gate validation
- Security Scanning
- OWASP Dependency-Check
- Trivy filesystem scan
- Trivy container image scan

Container Workflow

- Docker image build
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

- Argo CD installed and running in the Kubernetes cluster
- Proper access configured to monitor your Git repository
- Applications created and configured to apply manifests to the EKS cluster

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
- StatefulSet changes are also GitOps-managed

---

### Customization Tips

- **Security Rules**: Tune SonarQube and Trivy policies for stricter or more lenient scanning.
- **Quality Gates**: Set `abortPipeline: true` to fail builds on SonarQube quality gate failure.
- **Approval Gates**: Add manual approvals for production releases if required.
- **Argo CD Policies**: Modify sync strategy (`auto`, `manual`, `hook-based`) as needed.
- **Prometheuse and Grafana**: Set up and configure Prometheus and Grafana for montoring

---

### Troubleshooting

-  Ensure all Jenkins credentials and tools are correctly configured.
-  Verify Jenkins agents have access to SonarQube, GitHub, and ECR.
-  Check Argo CD is properly syncing with the Git repository.
-  Ensure Argo CD and Jenkins have necessary Kubernetes access.

---

### Tech Stack

- **CI/CD**: Jenkins
- **GitOps Deployment**: Argo CD
- **Registry**: Amazon ECR
- **Static Analysis**: SonarQube
- **Dependency Scanning**: OWASP Dependency-Check
- **Container Scanning**: Trivy
- **Platform**: Kubernetes on AWS EKS

---





