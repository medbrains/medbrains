# ── GitHub organisation "medbrains": verified domain ──
# GitHub shows this TXT record under the org's Settings → Verified domains.
# Verifying medbrains.in puts the "Verified" badge on github.com/medbrains and
# lets the org restrict notification emails to the domain. The value is a
# public challenge, not a secret.

variable "github_org_verification" {
  description = "TXT value GitHub shows for _gh-medbrains-o.<domain>. Empty skips it."
  type        = string
  default     = "4868ccb89c"
}

resource "godaddy-dns_record" "github_org_verify" {
  count  = var.github_org_verification == "" ? 0 : 1
  domain = var.company_domain
  type   = "TXT"
  name   = "_gh-medbrains-o"
  data   = var.github_org_verification
  ttl    = 600
}
