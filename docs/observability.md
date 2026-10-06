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

On your laptop, in a separate terminal, substitute your usual jump-host/key:

```bash
ssh -i /path/to/key.pem -N -L 3000:127.0.0.1:3000 ubuntu@<jump-host-address>
```

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
ports through SSH in the same way as Grafana.

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
            severity: info
          annotations:
            summary: Temporary test of Prometheus and Alertmanager
YAML
```

Allow a few minutes for discovery, evaluation, and delivery to Alertmanager.
Verify the alert is Firing in Prometheus and visible in Alertmanager, then remove
only the temporary rule:

```bash
kubectl delete prometheusrule monitoring-smoke-test -n monitoring
```

Alertmanager initially has an empty (`null`) receiver: alerts are visible but
no email, Slack, or webhook notification is sent. Configure a receiver with
credentials in a Secret as a follow-up, then test notification delivery.

Portfolio evidence: Kubernetes dashboard filtered to `mern-app`, backend targets
UP, request-rate/latency queries under traffic, the test alert firing, and the
monitoring Application synced with ready Pods and Bound PVCs.

References: [chart documentation](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
and [Argo CD multiple sources](https://argo-cd.readthedocs.io/en/stable/user-guide/multiple_sources/).
