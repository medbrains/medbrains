# kube-prometheus-stack — Prometheus, Grafana, Alertmanager, kube-
# state-metrics, node-exporter, and the prom-operator CRDs.
#
# Persistence: Prometheus uses a 50Gi gp3 PVC; Grafana uses a 10Gi
# PVC. Loki is configured separately (logs.tf) to use S3 for cheaper
# long-term retention.

resource "random_password" "grafana_admin" {
  count   = var.grafana_admin_password == "" ? 1 : 0
  length  = 32
  special = false
}

resource "kubernetes_secret_v1" "grafana_admin" {
  metadata {
    name      = "grafana-admin"
    namespace = var.namespace
  }
  data = {
    "admin-user"     = "admin"
    "admin-password" = var.grafana_admin_password != "" ? var.grafana_admin_password : random_password.grafana_admin[0].result
  }
  depends_on = [kubernetes_namespace_v1.observability]
}

resource "helm_release" "kube_prom_stack" {
  name             = "kube-prom-stack"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  namespace        = var.namespace
  create_namespace = false
  atomic           = true
  cleanup_on_fail  = true
  timeout          = 600

  values = [yamlencode({
    crds = { enabled = true }

    prometheus = {
      prometheusSpec = {
        retention                 = "15d"
        retentionSize             = "45GB"
        scrapeInterval            = "30s"
        evaluationInterval        = "30s"
        enableRemoteWriteReceiver = true

        # Pick up ServiceMonitor / PodMonitor across all namespaces
        # without forcing helm-chart-managed selectors.
        serviceMonitorSelectorNilUsesHelmValues = false
        podMonitorSelectorNilUsesHelmValues     = false
        ruleSelectorNilUsesHelmValues           = false

        storageSpec = {
          volumeClaimTemplate = {
            spec = {
              storageClassName = "gp3"
              accessModes      = ["ReadWriteOnce"]
              resources        = { requests = { storage = "50Gi" } }
            }
          }
        }
      }
    }

    grafana = {
      admin = {
        existingSecret = kubernetes_secret_v1.grafana_admin.metadata[0].name
        userKey        = "admin-user"
        passwordKey    = "admin-password"
      }
      persistence = {
        enabled          = true
        storageClassName = "gp3"
        size             = "10Gi"
      }
      defaultDashboardsTimezone = "Asia/Kolkata"
      sidecar = {
        dashboards = {
          enabled         = true
          searchNamespace = "ALL"
          label           = "grafana_dashboard"
        }
        datasources = {
          enabled = true
          label   = "grafana_datasource"
        }
      }
    }

    alertmanager = {
      alertmanagerSpec = {
        storage = {
          volumeClaimTemplate = {
            spec = {
              storageClassName = "gp3"
              accessModes      = ["ReadWriteOnce"]
              resources        = { requests = { storage = "10Gi" } }
            }
          }
        }
      }
    }
  })]

  depends_on = [kubernetes_namespace_v1.observability]
}
