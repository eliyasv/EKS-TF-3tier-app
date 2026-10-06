# Application logs in CloudWatch

The existing `logging/fluent-bit` DaemonSet tails container logs from the
`mern-app` namespace and forwards structured records, including Kubernetes
metadata, to `/eks/ignite-cluster-dev/application` in `us-east-1`.
Fluent Bit's own logs and other namespaces are excluded. Existing application
log files start at their saved tail offsets; historical log backfill is not
part of this change.

Terraform in the infrastructure repository owns the log group (7-day retention)
and `ignite-cluster-dev-fluent-bit-irsa` IAM role. The trust policy permits only
`system:serviceaccount:logging:fluent-bit` with audience `sts.amazonaws.com`.
The role can describe/create streams and write events in this group; Fluent Bit
cannot create log groups or change retention. No static AWS credentials are used.

## Deployment order

1. Merge the infrastructure change and apply the reviewed dev Terraform plan
   using the usual infrastructure pipeline. Review the full plan because this
   cluster has also had manual access configuration changes. With EKS and IRSA
   enabled, `infra_enable_cloudwatch_logs = true` creates three resources:
   the log group, IAM role, and inline policy. Verify Terraform outputs
   `fluent_bit_irsa_role_arn` and `application_log_group_name`.
2. Merge/promote the application change into `main`, which the existing Argo CD
   Application watches. Argo CD updates the service account, ConfigMap, and
   DaemonSet. The new container environment configuration triggers a rollout,
   allowing EKS to inject the IRSA token and role into the new Pods.
3. On the jump server, verify:

   ```bash
   kubectl rollout status daemonset/fluent-bit -n logging --timeout=180s
   kubectl get serviceaccount fluent-bit -n logging \
     -o jsonpath='{.metadata.annotations.eks\.amazonaws\.com/role-arn}{"\n"}'
   kubectl logs -n logging -l k8s-app=fluent-bit --tail=50 --prefix
   aws logs describe-log-groups --region us-east-1 \
     --log-group-name-prefix /eks/ignite-cluster-dev/application \
     --query 'logGroups[].{Name:logGroupName,Retention:retentionInDays}'
   aws logs tail /eks/ignite-cluster-dev/application \
     --region us-east-1 --since 10m --follow
   ```

   Generate a backend request or application action that produces a log entry.
   Confirm CloudWatch records have namespace `mern-app`, Pod/container metadata,
   and the application log message. The AWS identity running these verification
   commands needs log read permissions; the Fluent Bit writer role does not.

## Troubleshooting and limits

- `AccessDenied`: check the annotated role, OIDC issuer, service-account subject,
  and inline policy. Existing Pods must be replaced after annotating the account.
- `ResourceNotFoundException`: apply the infrastructure first and confirm group
  name/region match the DaemonSet configuration.
- Connectivity errors: private workers need outbound HTTPS to regional STS and
  CloudWatch Logs via NAT or appropriate VPC endpoints.
- For later ConfigMap-only changes, restart the collector after Argo CD sync:
  `kubectl rollout restart daemonset/fluent-bit -n logging`. Configuration is
  mounted using `subPath`, so running Pods do not reload ConfigMap edits.
- Retries are enabled, but this collector uses memory buffering. Long outages or
  Pod restarts can lose buffered logs; durable buffering is a separate improvement.
- These are application container logs, not EKS control-plane audit logs. They
  also do not provide metrics dashboards, tracing, or alerts. CloudWatch ingestion
  and storage incur charges; 7-day retention bounds storage history.

The checked-in application configuration targets this dev cluster/account.
For another environment, update the role annotation, region, and log group to
match its Terraform outputs.

References: [Fluent Bit CloudWatch output](https://docs.fluentbit.io/manual/data-pipeline/outputs/cloudwatch)
and [AWS credentials / IRSA](https://docs.fluentbit.io/manual/administration/aws-credentials).
