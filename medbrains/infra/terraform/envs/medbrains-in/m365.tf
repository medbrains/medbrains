# ── Mailboxes: medbrains.in in the hospital's Microsoft 365 tenant ──
# Same records amh.org.in runs on (MX to Outlook, SPF, autodiscover). The
# domain is added in M365 admin (Settings → Domains → Add domain → "add a TXT
# record"); paste the MS=ms… value it shows into m365_verification and apply.
# SES keeps sending noreply@ — its SPF sits on mail.<domain>, so the bare
# domain's SPF names Outlook only.

variable "m365_verification" {
  description = "The MS=ms… TXT value M365 admin shows when the domain is added. Empty skips it."
  type        = string
  default     = "MS=ms54569396"
}

variable "m365_mx" {
  description = "MX target M365 admin lists for the domain (newer tenants show *.mx.microsoft)."
  type        = string
  default     = "medbrains-in.mail.protection.outlook.com"
}

resource "godaddy-dns_record" "m365_verify" {
  count  = var.m365_verification == "" ? 0 : 1
  domain = var.company_domain
  type   = "TXT"
  name   = "@"
  data   = var.m365_verification
  ttl    = 600
}

resource "godaddy-dns_record" "m365_mx" {
  domain   = var.company_domain
  type     = "MX"
  name     = "@"
  data     = var.m365_mx
  priority = 0
  ttl      = 3600
}

resource "godaddy-dns_record" "m365_spf" {
  domain = var.company_domain
  type   = "TXT"
  name   = "@"
  data   = "v=spf1 include:spf.protection.outlook.com -all"
  ttl    = 3600
}

resource "godaddy-dns_record" "m365_autodiscover" {
  domain = var.company_domain
  type   = "CNAME"
  name   = "autodiscover"
  data   = "autodiscover.outlook.com"
  ttl    = 3600
}
