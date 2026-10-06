# Observability

Fluent Bit sends `mern-app` container logs to CloudWatch; see
[CloudWatch logging](cloudwatch-logging.md). The separate Argo CD `monitoring`
Application installs the pinned `kube-prometheus-stack` chart (91.9.0) using
values from this repository's `main` branch. Argo CD renders the chart; do not
also install this release manually with Helm.

## Included components

- Prometheus Operator, Prometheus, Grafana, Alertmanager, kube-state-metrics,
  and a node-exporter DaemonSet, with Kubernetes dashboards and default rules.
- Managed EKS etcd, scheduler, controller-manager, and kube-proxy scrape
  targets/rules are disabled because their usual endpoints are unavailable here.
- A ServiceMonitor scrapes `mern-app/backend` on its named `http` port at
  `/metrics`. Scrape annotations alone do not configure this installation.
- Custom alerts for unavailable application/MongoDB replicas, failed backup
  Jobs, and backend API HTTP 5xx rates above 5%. MongoDB Pod readiness does not
  measure replica-set health or replication lag; that requires an exporter.
- Metrics Server remains the source of CPU/memory metrics for HPAs.

Monitoring uses single replicas on on-demand workers for this learning cluster.
Prometheus has a 10Gi EBS PVC, 7-day retention, and an 8GB retention size limit;
Grafana has 5Gi and Alertmanager 2Gi. This is not an HA monitoring deployment.
Admission webhooks are disabled to simplify Argo CD bootstrap; operator
reconciliation remains enabled, but webhook admission validation is unavailable.
The existing backup script can mask dump failures, so Job success alone does
not prove a valid backup.

## Bootstrap after promotion to main

On the jump server, pull the merged configuration and check capacity:

```bash
cd ~/EKS-TF-3tier-app
git switch main
git pull --ff-only origin main
kubectl get storageclass ebs-csi
kubectl get nodes -l type=ondemand
kubectl top nodes
kubectl describe nodes -l type=ondemand
```

Check both usage and allocated resource requests before adding monitoring.
Create the Grafana admin Secret once. If it already exists, skip creation.
No password is committed to Git or passed as a literal command argument.

```bash
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl get secret monitoring-grafana-admin -n monitoring
# Only if the Secret was NotFound:
(
  umask 077
  GRAFANA_SECRET_DIR=$(mktemp -d)
  trap 'rm -f "$GRAFANA_SECRET_DIR/password"; rmdir "$GRAFANA_SECRET_DIR"' EXIT
  openssl rand -base64 32 | tr -d '\n' > "$GRAFANA_SECRET_DIR/password"
  kubectl create secret generic monitoring-grafana-admin -n monitoring \
    --from-literal=admin-user=admin \
    --from-file=admin-password="$GRAFANA_SECRET_DIR/password"
)
kubectl apply -f k8s/argocd/monitoring-project.yaml
kubectl apply -f k8s/argocd/monitoring-application.yaml
```

The Application uses multiple sources (Argo CD 2.6+). The existing MERN
Application excludes `argocd/*`; monitoring values live outside the recursively
synced `k8s` directory. The monitoring project permits the chart/Git repository,
monitoring resources, the chart's CoreDNS metrics Service in kube-system,
and its cluster RBAC/CRDs. Server-side apply handles large operator CRDs.

## Verify and access privately

```bash
kubectl get application monitoring -n argocd
kubectl get pods,pvc,services -n monitoring
kubectl get servicemonitor mern-backend -n monitoring
```

PVCs may initially be Pending with `WaitForFirstConsumer`. If Pods stay Pending,
inspect `kubectl describe pod <pod-name> -n monitoring` for resource capacity or
volume scheduling issues. Also verify the operator-generated Pods are ready;
Argo CD status alone is insufficient.

Grafana uses a ClusterIP Service and has no public ingress. On the jump server:

```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

On your laptop, use AWS CLI credentials with permission to start an SSM
port-forwarding session and the Session Manager plugin. The browser SSM shell
alone cannot forward ports to your laptop. No SSH key is required.

```bash
aws --version
session-manager-plugin --version
aws sts get-caller-identity
aws ssm start-session \
  --region us-east-1 \
  --target "<JUMP_INSTANCE_ID>" \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["3000"],"localPortNumber":["3000"]}'
```

Use the current jump instance ID, not the ID from a previous deployment. Keep
both the jump-server `kubectl port-forward` and laptop SSM tunnel running.
If the plugin is missing, follow the [AWS installation guide](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html).
On CachyOS/Arch, the AUR package used in this deployment was installed with
`paru -S aws-session-manager-plugin` (or `yay -S aws-session-manager-plugin`).
Review the package build instructions when prompted.

Open `http://localhost:3000`, username `admin`. Retrieve your password on the
jump server and keep it out of screenshots:

```bash
kubectl get secret monitoring-grafana-admin -n monitoring \
  -o jsonpath='{.data.admin-password}' | base64 --decode
echo
```

Open built-in Kubernetes dashboards, choose `mern-app`, and check CPU/memory,
replicas, and restarts. In Explore, select Prometheus and try:

```promql
up{namespace="mern-app",service="backend"}
sum(rate(todo_app_http_requests_total{namespace="mern-app",route!~"/metrics|/healthz|/ready|/started"}[5m]))
histogram_quantile(0.95, sum by (le) (rate(todo_app_http_request_duration_seconds_bucket{namespace="mern-app",route!~"/metrics|/healthz|/ready|/started"}[5m])))
```

Each ready backend replica should have an UP target. Use the UI to create/edit
and read todos, then allow multiple scrapes for rates to appear. The metrics
exist in backend source; if `/metrics` returns 404, check the deployed image.
The backend NetworkPolicy currently allows VPC traffic on port 5000; future
policy tightening must preserve monitoring access.

For targets/rules, port-forward `svc/monitoring-kube-prometheus-prometheus`
from local port 9090 to service port 9090. For Alertmanager, port-forward
`svc/monitoring-kube-prometheus-alertmanager` on port 9093 to 9093. Tunnel these
ports through separate SSM sessions in the same way as Grafana, changing both
`portNumber` and `localPortNumber` to 9090 or 9093. For Alertmanager:

```bash
# Jump server, in a separate SSM shell:
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-alertmanager 9093:9093
# Laptop, in a separate terminal:
aws ssm start-session \
  --region us-east-1 \
  --target "<JUMP_INSTANCE_ID>" \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["9093"],"localPortNumber":["9093"]}'
```

Open `http://localhost:9093`.

## Test an alert without interrupting workloads

Apply a temporary rule on the jump server:

```bash
kubectl apply -f - <<'YAML'
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: monitoring-smoke-test
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: smoke-test
      rules:
        - alert: MonitoringSmokeTest
          expr: vector(1)
          for: 1m
          labels:
            severity: warning
          annotations:
            summary: Temporary test of Prometheus and Alertmanager
YAML
```

Allow a few minutes for discovery, evaluation, and delivery to Alertmanager.
In Grafana Explore, run `ALERTS{alertname="MonitoringSmokeTest"}`. In an
instant query, expect `alertstate="firing"` with value 1 after the one-minute
pending period. Clear filters in Alertmanager and confirm the test alert is
visible. Watchdog is a separate always-firing built-in alert.

The test uses `warning` because InfoInhibitor suppresses `info` alerts. If an
alert is firing but hidden in the UI, check the API from another jump-server
shell while the port-forward is running:

```bash
curl -sS http://127.0.0.1:9093/api/v2/alerts | python3 -m json.tool
```

`inhibitedBy` and state `suppressed` mean Alertmanager received the alert but
inhibition is active. Once verified, remove only the temporary rule:

```bash
kubectl delete prometheusrule monitoring-smoke-test -n monitoring
```

Alertmanager initially has an empty (`null`) receiver: alerts are visible but
no email, Slack, or webhook notification is sent. Configure a receiver with
credentials in a Secret as a follow-up, then test notification delivery.

## Custom application dashboard

In Grafana, choose Dashboards → New dashboard → Add visualization, select
Prometheus, and use Code mode to enter each panel's query. Save the dashboard
as `MERN Application Overview`.

- Backend scrape targets (Stat): `sum(up{namespace="mern-app",service="backend"})`.
  Expect 3. This measures scrape availability, not MongoDB connectivity.
- Requests/second (Time series): use the request-rate query above.
- p95 latency (Time series, unit seconds): use the histogram query above.
- Application 5xx errors/second (Time series):

```promql
sum(rate(todo_app_http_requests_total{namespace="mern-app",route!~"/metrics|/healthz|/ready|/started",status=~"5.."}[5m])) or vector(0)
```

Use one query per panel. Copy plain query text with straight quotes and `!~`
without a backslash. An unterminated quoted string error means the editor
received incomplete or malformed query text. Request rate is requests/second;
latency is seconds (0.27 seconds = 270 ms). An empty `{}` label set is expected
for aggregation across replicas. Zero errors is normal; `or vector(0)` also
returns zero when there is no matching series, so verify scrape targets too.

Generate todo traffic and choose a time range covering it to verify the panels.
Export/download the custom dashboard JSON through Grafana's dashboard export
controls and save it locally before deleting Grafana. It is stored on the
Grafana PVC, not automatically in Git. Built-in dashboard names vary; search
for Kubernetes Namespace (Pods), Pod, and Node Exporter dashboards.

See [redeployment prerequisites](redeployment.md) and [ordered teardown](teardown.md).

References: [chart documentation](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
and [Argo CD multiple sources](https://argo-cd.readthedocs.io/en/stable/user-guide/multiple_sources/).
