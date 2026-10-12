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
  email_identity         = var.company_domain
  configuration_set_name = aws_sesv2_configuration_set.mail.configuration_set_name
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

# ── Bounces and complaints ──
# The app has no SES feedback endpoint (docs/ops/SES-PRODUCTION-ACCESS.md).
# Until it does, SES itself stops mailing an address that hard-bounced or
# complained (account suppression list), and every such event is mailed to
# the operator through its own topic - recipient addresses are PII, so not
# the ops alert topic.
resource "aws_sesv2_account_suppression_attributes" "this" {
  suppressed_reasons = ["BOUNCE", "COMPLAINT"]
}

resource "aws_sesv2_configuration_set" "mail" {
  configuration_set_name = "medbrains-in-transactional"
  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}

resource "aws_sns_topic" "ses_feedback" {
  name = "medbrains-in-ses-feedback"
}

resource "aws_sns_topic_policy" "ses_feedback" {
  arn = aws_sns_topic.ses_feedback.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ses.amazonaws.com" }
      Action    = "sns:Publish"
      Resource  = aws_sns_topic.ses_feedback.arn
      Condition = { StringEquals = { "AWS:SourceAccount" = data.aws_caller_identity.current.account_id } }
    }]
  })
}

resource "aws_sns_topic_subscription" "ses_feedback_email" {
  count     = var.company_alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.ses_feedback.arn
  protocol  = "email"
  endpoint  = var.company_alarm_email
}

resource "aws_sesv2_configuration_set_event_destination" "feedback" {
  configuration_set_name = aws_sesv2_configuration_set.mail.configuration_set_name
  event_destination_name = "bounce-complaint-to-sns"
  event_destination {
    enabled              = true
    matching_event_types = ["BOUNCE", "COMPLAINT", "REJECT"]
    sns_destination {
      topic_arn = aws_sns_topic.ses_feedback.arn
    }
  }
  depends_on = [aws_sns_topic_policy.ses_feedback]
}
