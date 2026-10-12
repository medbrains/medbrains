# ── The prod host: app.medbrains.in, and medbrains.in for its redirect ──
# The hospital app moved here from medbrains.amh.org.in (2026-10-12). The old
# name stays in the amh.org.in zone and Caddy answers it with a permanent
# redirect (deploy/standalone/move-host.sh), so links already sent still work.

data "aws_instance" "prod" {
  instance_id = var.company_prod_instance_id
}

resource "godaddy-dns_record" "prod" {
  for_each = toset(["app", "@"])
  domain   = var.company_domain
  type     = "A"
  name     = each.key
  data     = data.aws_instance.prod.public_ip
  ttl      = 600
}
