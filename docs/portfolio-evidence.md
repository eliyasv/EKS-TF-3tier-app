# Evidence before teardown

Capture the UI with saved todo data; successful Jenkins CI and release logs;
merged image-release PRs; healthy Argo CD applications; Grafana Kubernetes and
custom application panels; the alert smoke test; and CloudWatch log events with
Kubernetes metadata and the log group's retention. Use a time range covering
application traffic, and export custom Grafana dashboard JSON locally.

Run on the jump server while the cluster still exists:

```bash
EVIDENCE_FILE="project-evidence-$(date +%Y%m%d-%H%M%S).txt"
{
  date -u
  kubectl get nodes -L type,topology.kubernetes.io/zone
  kubectl get applications -n argocd
  kubectl get pods,pvc,hpa -n mern-app
  kubectl get pods,pvc -n monitoring
  kubectl get externalsecrets,secretstores -n mern-app
  kubectl top nodes
  kubectl top pods -n mern-app
  aws logs describe-log-groups --region us-east-1 \
    --log-group-name-prefix /eks/ignite-cluster-dev/application \
    --query 'logGroups[].{Name:logGroupName,Retention:retentionInDays}'
} 2>&1 | tee "$EVIDENCE_FILE"
```

Save the MongoDB replica status showing one PRIMARY and two SECONDARY members,
backup logs showing documents dumped, restore logs and restored task count,
and ALB `/ready` HTTP 200 with database connected. A Complete backup Job alone
is insufficient because the current script can mask dump failures.

A useful resume description is: "Deployed a three-tier application on EKS with
Terraform, Jenkins/ECR and Argo CD; verified CRUD operations, MongoDB replication
and backup restore, centralized logs, application metrics and alert delivery."
Describe monitoring as single-replica and distinguish Alertmanager delivery
from external notifications, which remain unconfigured.

## Copy evidence off the jump server

For a small file, run `cat "$EVIDENCE_FILE"` in the browser SSM shell, copy its
output, and paste into a local text file. Check the first and last lines. If the
browser truncates the output, use `sed -n '1,80p' <filename>` and subsequent
ranges. Copy screenshots, dashboard JSON and Jenkins logs to your laptop too.
Do this before terminating either server. Do not include secret values, passwords
or access tokens in evidence; review logs before publishing them.

Evidence logs do not preserve database data. If you want the MongoDB backup,
copy its archive off the backup PVC before deleting the namespace. The current
backup is stored on EBS and is not uploaded to S3.
