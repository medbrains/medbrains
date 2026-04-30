# Falco — runtime threat detection. eBPF-based syscall monitor + the
# default rule set + medbrains-specific rules layered on top.
# Alerts ride out via the falcosidekick → Alertmanager → PagerDuty
# integration in production; in dev they just go to stdout.

resource "helm_release" "falco" {
  name             = "falco"
  repository       = "https://falcosecurity.github.io/charts"
  chart            = "falco"
  namespace        = var.namespace
  create_namespace = false
  atomic           = true

  values = [yamlencode({
    driver = {
      kind = "modern_ebpf"
    }
    falcosidekick = {
      enabled = true
      config = {
        prometheusgateway = {
          # Forward Falco events as Prometheus metrics — picked up by
          # the kube-prom-stack scrape.
          hostport = "kube-prom-stack-prometheus.${var.namespace}.svc.cluster.local:9090"
        }
      }
      webui = {
        enabled = false
      }
    }
    # Default rules are good baseline; we'll layer medbrains rules
    # via a follow-up ConfigMap once we have specific NDPS/PHI access
    # patterns to flag.
  })]

  depends_on = [helm_release.kube_prom_stack]
}
