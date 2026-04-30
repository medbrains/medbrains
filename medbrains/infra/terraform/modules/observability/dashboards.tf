# Pre-built Grafana dashboards. The kube-prom-stack Grafana sidecar
# watches all namespaces for ConfigMaps with the
# `grafana_dashboard=1` label and auto-imports them.
#
# Dashboards live as JSON under `dashboards/` so they're easy to
# preview and edit without HCL noise.

locals {
  dashboards = {
    outbox  = "${path.module}/dashboards/outbox.json"
    patroni = "${path.module}/dashboards/patroni.json"
    spicedb = "${path.module}/dashboards/spicedb.json"
    edge    = "${path.module}/dashboards/edge.json"
  }
}

resource "kubernetes_config_map_v1" "dashboards" {
  for_each = local.dashboards

  metadata {
    name      = "grafana-dashboard-${each.key}"
    namespace = var.namespace
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "${each.key}.json" = file(each.value)
  }

  depends_on = [helm_release.kube_prom_stack]
}
