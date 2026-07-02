# Observability and Monitoring

This repository includes health checks for the backend and guidance for Prometheus/Grafana.

## Health endpoints

The backend exposes the following readiness and liveness endpoints:

- `/healthz` — liveness probe and ALB health check
- `/ready` — readiness probe, checks MongoDB connectivity
- `/started` — startup probe

These endpoints are configured in `k8s/backend/deployment.yaml`.

## Prometheus metrics

The application exposes health endpoints and now also exposes `/metrics` via `prom-client`.

### Recommended metrics

- `http_requests_total`
- `http_request_duration_seconds`
- `process_cpu_seconds_total`
- `process_resident_memory_bytes`
- application-specific task creation and database metrics

### Recommendation for Node.js

Use the `prom-client` library and expose `/metrics` in the backend.

### Example Prometheus scrape annotations

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "5000"
    prometheus.io/path: "/metrics"
```

## Grafana dashboards

Suggested dashboards:

- backend request rate, latency, and error rate
- backend health and readiness
- MongoDB replica set health and replication lag
- pod restart rate and OOM events
- node and cluster resource utilization

## Alerts

Suggested alert conditions:

- readiness probe failures
- elevated 5xx rate
- high 95th/99th percentile latency
- MongoDB replica set or replication lag issues
- frequent pod restarts, OOMs, or node pressure
