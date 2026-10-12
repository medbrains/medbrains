# SES production access — medbrains.in

Last reviewed 2026-10-12. Identity and DNS: `infra/terraform/envs/medbrains-in/mail.tf` (domain identity
`medbrains.in`, Easy DKIM 2048-bit, custom MAIL FROM `mail.medbrains.in`, SPF on the MAIL FROM, DMARC `p=quarantine`
at GoDaddy). Region ap-south-1. The account is in the **sandbox** until this request is approved.

## What the app actually sends (so the form is truthful)

Outbox handlers registered in `crates/medbrains-server/src/main.rs` (sent by
`crates/medbrains-outbox/src/handlers/email_stub.rs`, `EMAIL_PROVIDER=smtp` against the SES SMTP endpoint):

`email.verify_email`, `email.invite`, `email.appointment_confirmation`, `email.invoice_receipt`,
`email.refund_notification`, `email.dunning_notice`, `email.lab_report`, `email.discharge_summary`,
`email.mis_daily_export`.

One-time passcodes for the patient portal go by **SMS** (`sms.patient_portal_otp`), not email. Email carries
address-verification and staff-invite messages. Do not claim email OTPs in the form unless that ships.

## Bounce and complaint handling — honest state

- **The application does not consume SES bounce or complaint notifications.** There is no SNS subscriber endpoint,
  no SES event ingestion, and no email suppression check in the transactional send path. The handler only sees
  synchronous SMTP errors at submission (permanent → dead-letter queue, transient → retry); SES bounces arrive
  asynchronously and never reach it.
- `mkt_suppressions` (migration `0996_marketing_consent.sql`) is a manual, marketing-only suppression list; the
  transactional email handler does not read it.
- No `List-Unsubscribe` header is set anywhere. Fine for transactional mail; **do not send marketing email through this
  identity** until it is.

Added as code (not applied — `docs/ops/MONITORING.md` has the apply command), so the answer below is true once applied:

- `aws_sesv2_account_suppression_attributes` — account-level suppression for `BOUNCE` and `COMPLAINT`: SES itself
  stops delivering to an address that hard-bounced or complained.
- Configuration set `medbrains-in-transactional` (also suppressing BOUNCE/COMPLAINT), set as the domain identity's
  default so every message uses it without app changes, with an event destination publishing `BOUNCE`, `COMPLAINT`,
  `REJECT` to SNS `medbrains-in-ses-feedback`, emailed to `company_alarm_email`.

Remaining engineering gap: ingest those events into the app (mark the patient/staff email undeliverable, show it on the
record, stop queuing to it). Until then a human reviews the feedback emails.

## Text to paste — "Request production access"

**Mail type:** Transactional

**Website URL:** https://www.medbrains.in

**Use case description:**

> MedBrains is a hospital management system used by hospitals in India; the production application runs at
> app.medbrains.in. We send only transactional email, from noreply@medbrains.in, triggered by an action the
> recipient took or a service they are receiving at the hospital:
>
> - staff account invitations and email-address verification;
> - appointment confirmations;
> - payment receipts, refund notifications and outstanding-bill reminders for the patient's own hospital bills;
> - lab reports and discharge summaries the patient has asked to receive by email;
> - a daily operational report to the hospital's own management.
>
> We do not send marketing or promotional email, we do not buy, rent or scrape lists, and every recipient is a
> patient or staff member of the hospital whose address was given to the hospital directly. Expected volume at launch
> is under 1,000 messages per day, growing with the number of hospitals.
>
> Authentication: the domain is verified with Easy DKIM (2048-bit), uses a custom MAIL FROM domain
> (mail.medbrains.in) with SPF, and publishes DMARC (p=quarantine).
>
> Bounces and complaints: the account-level suppression list is enabled for bounces and complaints, so SES stops
> delivery to any address that hard-bounces or complains. All sends use a configuration set that publishes bounce,
> complaint and reject events to an SNS topic monitored by our operations team, who correct or remove the address
> on the patient or staff record. We watch the bounce and complaint rates in the SES reputation dashboard and will
> pause sending if either approaches the AWS thresholds.
>
> Recipients who do not want email can choose SMS or paper at the hospital; email delivery is optional for every
> message type above.

Before submitting, check the last paragraph is true for each hospital's configuration; if a message type cannot be
switched off per patient today, delete that sentence rather than claim it.

## Console steps

1. Apply the SES additions first (`MONITORING.md`), confirm the `medbrains-in-ses-feedback` subscription email, and
   check in SES → **Identities → medbrains.in** that DKIM shows *Successful* and MAIL FROM shows *Successful*.
2. SES console, region **Asia Pacific (Mumbai) ap-south-1** (production access is per region).
3. **Account dashboard** → banner "Your Amazon SES account is in the sandbox" → **Request production access**
   (or **Get set up** → *Request production access*).
4. Mail type **Transactional**; Website URL; paste the use-case text; contact language English; tick the AUP
   acknowledgement; **Submit request**.
5. AWS replies by email within ~24 h, sometimes with follow-up questions — answer in the support case, same tone.
6. When approved: Account dashboard shows the daily sending quota and max send rate. Send one message to an address
   outside the verified list to prove it, then set `EMAIL_FROM_ADDRESS=noreply@medbrains.in` and the SMTP settings on
   the host (`terraform output smtp`; password via `terraform output -raw smtp_password`, piped, never pasted) — a prod
   change, made with a deploy.
7. Optional: **Virtual Deliverability Manager** → enable, for inbox-placement advice.
