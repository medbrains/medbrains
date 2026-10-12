# ── Product mail: Amazon SES sends as noreply@medbrains.in ──
# Signed with DKIM for the domain itself, so the zone's existing DMARC record
# (GoDaddy's, p=quarantine, relaxed alignment) passes. Bounces return to
# mail.<domain>. A new SES account starts in the sandbox — request production
# access once in the console (SES → Account dashboard) before mailing patients.
# Mailboxes (hello@ …) are separate: add the domain to Microsoft 365.

locals {
  mail_from = "mail.${var.company_domain}"
}

resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.company_domain
  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity         = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain       = local.mail_from
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "godaddy-dns_record" "ses_dkim" {
  count  = 3 # SES Easy DKIM always issues three tokens
  domain = var.company_domain
  type   = "CNAME"
  name   = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey"
  data   = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"
  ttl    = 600
}

resource "godaddy-dns_record" "mail_from_mx" {
  domain   = var.company_domain
  type     = "MX"
  name     = "mail"
  data     = "feedback-smtp.${var.company_region}.amazonses.com"
  priority = 10
  ttl      = 600
}

resource "godaddy-dns_record" "mail_from_spf" {
  domain = var.company_domain
  type   = "TXT"
  name   = "mail"
  data   = "v=spf1 include:amazonses.com ~all"
  ttl    = 600
}

# The app's SMTP login: may send only as this domain.
resource "aws_iam_user" "ses_smtp" {
  name = "medbrains-in-ses-smtp"
}

resource "aws_iam_user_policy" "ses_smtp" {
  name = "send-as-${var.company_domain}"
  user = aws_iam_user.ses_smtp.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendRawEmail", "ses:SendEmail"]
      Resource = aws_sesv2_email_identity.domain.arn
    }]
  })
}

resource "aws_iam_access_key" "ses_smtp" {
  user = aws_iam_user.ses_smtp.name
}
