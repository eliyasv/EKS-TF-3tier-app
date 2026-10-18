# Redeployment prerequisites

This is a production-style learning project. Terraform provisions the cluster
infrastructure; several bootstrap steps are still performed manually. Reuse
retained resources where appropriate rather than creating duplicates.

| Responsibility | Owner / action |
|---|---|
| S3 state bucket and locking resources | Bootstrap before Terraform init; `setupguids/setup-aws-backend.sh` in the shared workspace helps create them. Preserve until teardown is verified. |
| VPC, subnets, NAT, EKS, node groups, configured EKS add-ons, OIDC | Infrastructure Terraform. |
| External Secrets and Fluent Bit IAM roles; CloudWatch log group | Infrastructure Terraform; enable the appropriate flags. |
| Jenkins/SonarQube server | Manually provision host, tools/plugins, SonarQube integration, jobs and credentials. |
| Jump server | Manually provision in the cluster VPC with SSM access and API network connectivity. Record its instance ID, security group and any Elastic IP. |
| EKS authentication/access entries | Optional Terraform mode/grants or manual access entries; import existing grants before adoption. Defaults preserve manual ownership. |
| ECR repositories | Create/reuse manually or explicitly adopt/import through Terraform. Keep retained registries separate from temporary cluster state when desired. |
| MongoDB secret values | Create `/mern-app/mongodb/username`, `/password`, and `/keyfile` in AWS Secrets Manager. Username/password are plain strings; keyfile is JSON with property `keyfile`. Never commit values. |
| AWS Load Balancer Controller | Optional Terraform policy/IRSA role and a prepared pinned Helm script in the infra repository; dev enables IAM resources for its next apply. Live bootstrap verification is pending. Track manual/eksctl resources separately if used instead. |
| External Secrets Operator | Install the chart with service account `external-secrets/external-secrets` annotated with the Terraform role ARN. |
| Argo CD | Install Argo CD, then apply the AppProject/Application bootstrap manifests. Keep its Service ClusterIP and access through SSM. |
| Metrics Server | Install separately before workload deployment; supplies resource metrics to HPA. Prometheus does not replace it. |
| Grafana admin Secret | Create `monitoring/monitoring-grafana-admin` once, before creating the monitoring Application. |
| Kubernetes workloads and logging | Existing MERN Argo CD Application watches `main` and reconciles the manifests. |
| Prometheus/Grafana/Alertmanager | Monitoring Argo CD Application installs the pinned chart using values from `main`. |
| Custom Grafana dashboard | Import saved JSON or recreate; not provisioned by the current chart values. |
| Local private access | AWS CLI credentials, Session Manager plugin and SSM port-forwarding session. No SSH key needed. |

## Deployment order

1. Configure the backend and infrastructure pipeline. Apply the reviewed dev
   Terraform plan from the infra repository.
2. Configure the jump server, kubeconfig and EKS role access. Optional Terraform
   ownership is described in the [infra adoption guide](https://github.com/eliyasv/EKS-TF-infra/blob/main/docs/ecr-and-access.md).
   Use the IAM role
   ARN, not the temporary STS assumed-role session ARN. After changing access
   mode, use `aws eks describe-update` with the returned update ID until its
   status is `Successful`; `cluster-active` alone can return before the access
   update finishes. Then confirm `cluster.accessConfig.authenticationMode`.
3. Verify the EBS CSI controller, on-demand workers in three eligible AZs, and
   enough Spot capacity. Install Load Balancer Controller, External Secrets
   Operator and Metrics Server. The optional [controller bootstrap](https://github.com/eliyasv/EKS-TF-infra/blob/main/docs/load-balancer-bootstrap.md)
   runs after Terraform; do not also create an eksctl-owned role for that setup.
   Ensure the Fluent Bit Terraform role and log group exist before MERN sync.
4. Create the MongoDB Secrets Manager values. Apply namespace/External Secrets
   manifests and verify SecretStore Valid and both ExternalSecrets SecretSynced.
   The installed CRDs must serve `external-secrets.io/v1`.
5. Configure Jenkins credentials: `GITHUB` is username/password, with a GitHub
   personal access token in the password field. For a fine-grained token, select
   this repository and grant Contents and Pull requests read/write permissions.
   `ACCOUNT_ID` is the account ID credential used by the existing pipelines.
   Configure the named tools/server from the Jenkinsfiles and SonarQube webhook.
6. Build/push frontend and backend images, then run releases with each exact ECR
   tag. Jenkins build numbers can differ between components; use `both` only
   when that tag exists in both repositories. Review/merge release PRs into the
   branch watched by Argo CD (`main`). Checkout of main inside an inline Jenkins
   job does not replace its executing script; use Pipeline script from SCM or
   update the configured inline script explicitly.
7. Bootstrap the MERN Argo CD project/application. Verify Pods, MongoDB replica
   state, ALB HTTP `/ready`, and UI create/edit/delete. HTTP is the current dev
   listener; HTTPS requires additional configuration.
8. Verify delivery using the [logging guide](cloudwatch-logging.md). The Terraform
   role/log group must exist before step 7, because MERN sync includes Fluent Bit.
   Verify frontend/backend/MongoDB streams.
9. Bootstrap monitoring and Grafana credentials using [observability](observability.md).
   Verify all three backend scrape targets, dashboard queries, and the warning
   smoke-test alert. External notifications are optional and are not configured.
10. Before deleting resources, follow [teardown](teardown.md).

## Supporting guides

In the shared workspace, `setupguids/SETUP_GUIDE.md`, `CI-CD_PIPELINE_GUIDE.md`
and `ARGOCD_GUIDE.md` cover initial setup. Those standalone files are outside
this Git repository. Infrastructure-specific commands are in the
[infra usage guide](https://github.com/eliyasv/EKS-TF-infra/blob/main/docs/usage.md)
and [add-on guide](https://github.com/eliyasv/EKS-TF-infra/blob/main/docs/add-ons.md).
Use the current Terraform outputs instead of IDs from a previous deployment.
