# Bridge wiring — ties cloud + on-prem together.
#
# Most of the Headscale ACL work happens in the cloud-side
# infra/terraform/modules/headscale module: the ACL JSON file ships
# default-deny with per-tenant tag wildcards. This file just adds the
# tenant's tag to the global ACL JSON via the headscale admin API,
# and inserts the matching tenant_db_topology row hint.
#
# Per-tenant subnet routes are NOT created here. Headscale
# auto-discovers subnets advertised by --advertise-routes when the
# bridge VM joins the tailnet (configured in PR2's
# modules-onprem/bridge-agent cloud-init).

resource "null_resource" "register_tenant_tag" {
  triggers = {
    tenant_id       = var.tenant_id
    headscale_url   = var.headscale_url
    tunnel_provider = var.tunnel_provider
  }

  # When tunnel_provider=none we skip everything — air-gapped tenant
  count = var.tunnel_provider == "none" ? 0 : 1

  provisioner "local-exec" {
    command = <<-EOT
      # Ensure the tenant user exists in headscale (idempotent)
      curl -sfH "Authorization: Bearer ${var.headscale_admin_api_key}" \
        ${var.headscale_url}/api/v1/user \
        -d '{"name":"tenant-${var.tenant_id}"}' || true

      # Adding tags to the ACL JSON requires editing the headscale
      # acl.hujson and reloading. We log the line the operator must
      # add to the source-of-truth file in the GitOps repo instead of
      # mutating the live ACL via API (the API endpoint is gated on
      # filemode = "database" config; we use file mode for git
      # auditability per the headscale module).
      echo "[hybrid-tenant-template] add this line to headscale-acl.hujson under tagOwners:"
      echo "    \"tag:hospital-${var.tenant_id}\": [\"medbrains-admin@${var.cloud_apex_domain}\"],"
    EOT
  }

  depends_on = [null_resource.headscale_preauth_key]
}

output "tunnel_provider" {
  value = var.tunnel_provider
}

output "tenant_topology_sql" {
  value = <<-EOT
    -- Run on the cloud-side admin DB after on-prem soak (T+7 days):
    UPDATE tenant_db_topology
    SET topology   = 'patroni_with_cloud_analytics',
        deploy_mode = 'hybrid',
        tunnel_provider = '${var.tunnel_provider}',
        onprem_cluster_id = 'medbrains-${var.tenant_id}-onprem-pg',
        notes      = 'Cutover ${formatdate("YYYY-MM-DD", timestamp())} via hybrid-tenant-template'
    WHERE tenant_id = (SELECT id FROM tenants WHERE slug = '${var.tenant_id}');
  EOT
  description = "SQL the cloud admin runs to flip the tenant from Aurora → on-prem Patroni after soak"
}
