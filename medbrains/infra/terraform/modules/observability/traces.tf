# Tempo for trace storage + Grafana datasource. The OTEL Collector
# was already shipped by the EKS module; we add a TempoStack-style
# distributor here as the trace sink.

resource "helm_release" "tempo" {
  name             = "tempo"
  repository       = "https://grafana.github.io/helm-charts"
  chart            = "tempo"
  namespace        = var.namespace
  create_namespace = false
  atomic           = true

  values = [yamlencode({
    persistence = {
      enabled          = true
      storageClassName = "gp3"
      size             = "30Gi"
    }
    tempo = {
      reportingEnabled = false
      receivers = {
        otlp = {
          protocols = {
            grpc = { endpoint = "0.0.0.0:4317" }
            http = { endpoint = "0.0.0.0:4318" }
          }
        }
      }
    }
  })]

  depends_on = [helm_release.kube_prom_stack]
}

# Grafana datasource ConfigMap — the kube-prom-stack sidecar picks up
# any ConfigMap labeled grafana_datasource=1 in the namespace.
resource "kubernetes_config_map_v1" "grafana_datasources" {
  metadata {
    name      = "grafana-extra-datasources"
    namespace = var.namespace
    labels = {
      grafana_datasource = "1"
    }
  }
  data = {
    "datasources.yaml" = yamlencode({
      apiVersion = 1
      datasources = [
        {
          name      = "Loki"
          type      = "loki"
          access    = "proxy"
          url       = "http://loki.${var.namespace}.svc.cluster.local:3100"
          isDefault = false
        },
        {
          name   = "Tempo"
          type   = "tempo"
          access = "proxy"
          url    = "http://tempo.${var.namespace}.svc.cluster.local:3100"
          jsonData = {
            tracesToLogsV2 = {
              datasourceUid   = "loki"
              filterByTraceID = true
            }
          }
        },
      ]
    })
  }

  depends_on = [helm_release.tempo, helm_release.loki]
}
