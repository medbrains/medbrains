# RFC-MODULE — Message simulator + the registration welcome journey

Status: **DRAFT — building** (2026-09-26). Decisions below are the operator's.

## 1. What was asked

> "Start with the user journey — registration message. We need a simulator for
> notifications received by the patient (mail, SMS, WhatsApp) so we can test that
> too." Also: "internal notification emails, message escalations".

Operator decisions (2026-09-26):

| Question | Answer |
|---|---|
| Where the simulator runs | **dev and test only**. It is refused in production. |
| What a newly registered patient receives | SMS with UHID + hospital · WhatsApp with the same plus the ID card · email if on file · portal invite link |
| Who else | staff: internal notification emails and escalations (e.g. unanswered nurse call) |
| Screen | **phone view**: pick a patient or staff member, see their SMS / WhatsApp / Email / In-app |

## 2. What exists

- SMS (Twilio), WhatsApp (Meta Cloud) and email (SendGrid/SMTP/Stalwart) outbox
  handlers. Without credentials each returns `{stub: true}` and **the message is
  thrown away** — nothing anywhere shows what the patient would have got.
- `patient.created` has **no subscriber**: registration sends the patient nothing.
- `patients.preferred_contact_method` exists, is empty for all 1,187 patients,
  and no screen writes it. There is no per-channel messaging consent
  (`dpdp_consents` is a single yes/no). There is no patient-portal invite flow.
- Staff escalations already land in `notifications` (in-app), e.g. the nurse-call
  escalation from token-queue P0.

### Found by the simulator (2026-09-26)

- **Every OPD visit texts "Your appointment is confirmed. Please carry this
  message and a photo ID."** (`on_opd_encounter_created`) — including walk-ins
  and camp patients who are standing at the desk. No switch turns it off, and
  the text names no date, doctor or hospital. With real SMS credentials every
  walk-in would get it. S2 replaces it: a confirmation belongs to *booking*; a
  visit gets "You're registered for <dept> at <hospital>, token <n>" only if the
  hospital turns that on.

## 3. Norms

| Norm | Rule here |
|---|---|
| DPDP Act 2023 + WhatsApp Business policy | WhatsApp and email go only to a patient who **opted in** at registration; SMS carrying the UHID is a service message (transactional), not marketing. The opt-in is recorded with who took it and when. |
| TRAI DLT | Welcome SMS uses a registered template; the simulator shows which template id would have been used. |
| Data minimisation | Messages carry UHID, name, hospital, link — never diagnosis or payer data. |
| Production safety | The simulator must be impossible to switch on in production: the server **refuses to start** with `MEDBRAINS_NOTIFY_SIMULATOR=true` and `MEDBRAINS_ENV=production`. |

## 4. Design

**Capture, not a fake provider.** One function in `medbrains-outbox`,
`simulator::capture(ctx, channel, message)`, called by the SMS, WhatsApp and
email handlers *instead of* the provider call when the simulator is on. Each
message is fully rendered first (template, DLT id, attachments), so what the
simulator shows is exactly what would have been sent.

```
simulated_messages (tenant-scoped, RLS)
  id, tenant_id, channel (sms|whatsapp|email), recipient (E.164 or email),
  patient_id NULL, user_id NULL, event_type, subject NULL, body,
  attachments jsonb, template_id NULL, outbox_event_id, created_at
```

In-app notifications are not copied — the phone view reads `notifications`
for a staff member directly.

**Registration welcome.** A `patient.created` subscriber enqueues
`sms.patient_welcome`, and — only when opted in — `whatsapp.patient_welcome`
(with the ID card PDF) and `email.patient_welcome`; each carries the portal
invite link. Each channel has a hospital switch in Admin → Settings →
Notifications (off by default in production; the operator turns them on when
the provider and templates are ready).

**Registration form** gains: contact preference and "May we message you on
WhatsApp / email" opt-ins (recorded with the registering user and time).

## 5. Permissions (Rust first)

| Code | Purpose | Holders |
|---|---|---|
| `admin.notifications.simulator.view` (new) | Open the message simulator | super_admin, hospital_admin |
| `admin.notifications.settings.manage` (new, or existing settings code if it fits exactly) | Welcome-message switches | admins |

Simulator routes are registered **only** when the simulator is on; in any other
deployment they do not exist (404), not merely 403.

## 6. Screens

- **Admin → Developer → Message simulator** (only when enabled): recipient
  picker (patient search · staff search · raw number/email) → phone mock-up
  with tabs SMS · WhatsApp · Email · In-app, newest first, refreshes live,
  "Clear" button. States: empty ("Nothing sent to this person yet"), loading,
  error (never blank).
- **Registration form**: contact preference + opt-ins.
- **Admin → Settings → Notifications**: welcome message switches per channel.

## 7. Acceptance scenarios

1. **Given** the simulator is on, **when** a receptionist registers a patient
   with a mobile number, **then** the patient's phone view shows one SMS with
   their UHID and the hospital name within 5 s.
2. **Given** the patient opted into WhatsApp, **then** a WhatsApp message with
   the same text and the ID card attachment appears; **given** they did not,
   **then** no WhatsApp is sent.
3. **Given** an email and email opt-in, **then** a welcome email with the UHID
   and the portal link appears on the Email tab; no email → nothing.
4. **Given** no mobile number, **then** no SMS is attempted and the
   registration still succeeds.
5. **Given** the welcome SMS switch is off, **then** registration sends nothing
   by SMS.
6. **Given** a nurse call unanswered past the escalation time, **then** the
   charge nurse's phone view shows the escalation on the In-app tab.
7. **Given** `MEDBRAINS_ENV=production` and the simulator flag, **then** the
   server refuses to start and says why.
8. **Given** the simulator is off, **then** its API answers 404 and the menu
   item does not exist.
9. **Given** a receptionist without the simulator permission, **then** they
   cannot open it (403 / page guard).
10. **Given** two patients registered back to back, **then** each phone view
    shows only that patient's messages.

## 8. Phases

| # | Scope | Ends when |
|---|---|---|
| S1 | `simulated_messages` + capture in the 3 handlers + production refusal + simulator API + **phone view** screen | a message sent today (e.g. token-call SMS) shows on the phone view |
| S2 | Registration opt-ins + contact preference on the form; `patient.created` welcome pipeline (SMS, WhatsApp + card, email, portal link); settings switches | Playwright: register → phone view shows the welcome messages |
| S3 | Staff: in-app tab for escalations + internal emails | Playwright: nurse-call escalation visible on the charge nurse's phone view |
