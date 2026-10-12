# Incident response plan — MedBrains

Draft 2026-10-12, written from the engineering side. **It is not in force until the organisation fills every
`[ORG: …]` field, approves it and records the approval below.** Legal timelines are summarised from the cited
instruments; confirm current text and commencement with counsel before relying on them.

| Field | Value |
|---|---|
| Owner | [ORG: name, role] |
| Approved by / date | [ORG] |
| Next review | [ORG: ≤ 12 months, and after every SEV1] |
| Scope | the MedBrains product, the production host (`app.medbrains.in`, EC2 `i-08e9496a3e110ebdc`, ap-south-1), the AWS account, the GitHub repository, `medbrains.in` mail and DNS |

## 1. Who we are in each regime

- **CERT-In:** MedBrains (the company) is a body corporate operating computer resources — it reports incidents on its
  own systems directly.
- **DPDP Act 2023:** for patient data, the **hospital is the Data Fiduciary** and MedBrains is its **Data Processor**.
  The hospital gives the breach notices to the Board and to patients; MedBrains must tell the hospital fast enough for
  that, and supply the facts. [ORG: confirm the notice period in each hospital contract / DPA — recommend ≤ 24 h.]
  For data MedBrains collects for itself (staff, website contacts, leads), MedBrains is the fiduciary.

## 2. Severity levels

| Sev | Definition | Examples | Response | Update cadence |
|---|---|---|---|---|
| **SEV1** | Patient safety or confirmed/likely exposure of personal data; or the hospital cannot use the system | app down in clinical hours; cross-tenant data visible; credential or DB dump leaked; ransomware; audit-chain break | page now, IC within 15 min, 24×7 | 30 min |
| **SEV2** | Major degradation or a control failed with no confirmed exposure | DB `degraded`; backups failing > 24 h; WAL archiving failing; a module down; suspicious admin activity | IC within 1 h (clinical hours) | 2 h |
| **SEV3** | Minor, workaround exists | one print broken; SES bounce spike; CPU alarm | next business day | daily |
| **SEV4** | Near miss / informational | a scan finding with no exploit path | ticket | — |

Any doubt between two levels → take the higher. Any incident that may involve personal data is at least SEV2 until
ruled out, because the reporting clocks below start at **noticing**, not at confirmation.

## 3. Roles

| Role | Does | Who |
|---|---|---|
| Incident Commander (IC) | owns the incident, decides severity, assigns work, decides notifications | [ORG: primary / backup] |
| Technical lead | investigates and fixes; preserves evidence | [ORG] |
| Communications lead | hospital, patients, public statements | [ORG] |
| Legal / DPO / Grievance Officer | DPDP + CERT-In decisions and filings | [ORG] |
| CERT-In Point of Contact (mandatory under the 2022 Directions, direction (ii)) | receives/answers CERT-In; registered with CERT-In | [ORG: name, email, phone — and confirm it is registered] |
| Hospital liaison (per customer) | the hospital's own IT/medical superintendent | [ORG: per hospital] |

One person may hold several roles in a small team, but the IC and the person typing fixes should differ for SEV1.

Contacts: [ORG: phone tree, out-of-hours numbers, a channel that works if Microsoft 365 / email is down].

## 4. Detection sources (wired in code — see `docs/ops/MONITORING.md`)

| Source | Signals | Where it lands |
|---|---|---|
| Route53 checks (`infra/terraform/envs/medbrains-in/ops.tf`) | `app.medbrains.in/api/health` not `"status":"ok"` (app down **or DB disconnected**); `www` down | SNS → email |
| CloudWatch EC2 alarms (`ops.tf`) | status checks (auto-recover on system fault), CPU, CPU credits | SNS `medbrains-prod-alerts` |
| `medbrains-host-check` (hourly) | disk < 15 %, TLS cert < 14 d, no backup in 26 h, WAL archiving failing | SNS via `ALERT_TOPIC_ARN` |
| Backup units `OnFailure=` | nightly dump / file mirror / WAL-G base backup failed | SNS |
| SES feedback (`mail.tf`) | bounce/complaint/reject | SNS `medbrains-in-ses-feedback` |
| Application | `audit_log` hash chain + `audit_chain_verifications` (tamper); `access_log` (who read which patient); `users.failed_login_attempts` / `locked_until` (brute force) | database; [gap: no alert wired] |
| CI `security.yml` | leaked verified secrets (TruffleHog), vulnerable dependencies | GitHub |
| People | hospital staff, patients, researchers | [ORG: published security contact, e.g. security@medbrains.in] |

Not in place (gaps): AWS CloudTrail/GuardDuty status unverified; no alert on audit-chain failure, mass record reads or
repeated lockouts; no central log store. **Alarms deliver only after `ops.tf` is applied, the subscription emails are
confirmed and `ALERT_TOPIC_ARN` is set on the host.**

## 5. The response, step by step

1. **Open** — start an incident record (template §9) with the time the issue was **noticed**; that starts the CERT-In
   6-hour and DPDP clocks.
2. **Triage** — severity, scope (which hospital/tenant, which data, which systems), is it ongoing?
3. **Preserve evidence before changing anything** (§7) — unless a delay causes patient harm or further exposure;
   then contain first and note why.
4. **Contain** — e.g. revoke keys/sessions (`users.perm_version` bump forces re-auth; revoke API keys), block IPs at the
   security group, take the host off the internet, disable a compromised account, rotate secrets in `/etc/medbrains/env`.
5. **Notify** on the clocks in §6.
6. **Eradicate and recover** — fix root cause; restore from backup if integrity is in doubt
   (`docs/ops/BACKUP-RESTORE.md`, PITR if WAL archiving is on).
7. **Verify** — health check green, hospital confirms clinical workflows, monitoring watching.
8. **Close** — post-incident review (§10) within 5 working days for SEV1/2.

## 6. Mandatory reporting

### CERT-In — within 6 hours

**CERT-In Directions under section 70B(6) of the Information Technology Act, 2000, No. 20(3)/2022-CERT-In, dated
28 April 2022.**

- Report any incident of the types in Annexure I of the Directions **within 6 hours of noticing it or being told of
  it** (direction (ii)). Annexure I includes, among others: targeted scanning/probing of critical systems; compromise of
  critical systems/information; unauthorised access to IT systems/data; website defacement or intrusion; malicious code
  (virus, ransomware, etc.); attacks on servers (database, mail, DNS); identity theft, spoofing and phishing; DoS/DDoS;
  **data breach**; **data leak**; attacks on cloud computing systems/services.
- How: email `incident@cert-in.org.in` (or phone/fax per cert-in.org.in) using the current incident reporting form
  from cert-in.org.in. Report what is known at 6 hours; send updates as facts firm up. [ORG: keep a copy of the
  current form in the incident kit.]
- Related standing duties from the same Directions, which an investigation will need:
  - **Logs** of all ICT systems kept securely for a rolling **180 days within Indian jurisdiction** and provided to
    CERT-In on request (direction (iv)). [Engineering status: unverified — journald/app logs on the host are not
    configured for 180 days; CloudWatch log retention for prod not set up.]
  - **Clock sync** to NTP of NIC or NPL, or traceable to them (direction (i)). [Status: unverified on the host.]
  - **Point of contact** registered with CERT-In (direction (vi)).

### DPDP Act 2023 — personal data breach

- **Act, section 8(6):** on a personal data breach the Data Fiduciary must intimate **the Data Protection Board of
  India and each affected Data Principal**, in the form and manner prescribed.
- **Digital Personal Data Protection Rules, 2025, rule 7** (as notified): intimate each affected Data Principal
  **without delay** (plain language: what happened, likely consequences, mitigation, what they can do, contact); and
  the Board **without delay**, followed **within 72 hours of becoming aware** (or longer if the Board allows) by the
  detailed report — facts, cause, mitigation, findings about the person responsible, remedial measures, the reports
  made to Data Principals. [ORG/counsel: confirm the rules' commencement date for these obligations and the Board's
  filing channel.]
- For hospital patient data: MedBrains notifies the hospital (Data Fiduciary) per contract, with everything needed for
  both notices; the hospital files. Offer the patient notice template (§8).
- A breach that is also a CERT-In incident needs **both**: the 6-hour CERT-In report does not replace the Board notice.

Other notices to consider [ORG/counsel]: the hospital's own regulators/NABH where clinical care was affected; police
(cyber crime) for extortion/ransomware; insurers; payment providers if card/UPI data could be involved.

## 7. Evidence preservation

Do this before rebooting, restoring or "cleaning up":

- **Snapshot the volume:** `aws ec2 create-snapshot --volume-id <vol> --description "incident <id> <UTC>"` and tag it
  `Hold=incident-<id>`; keep it outside lifecycle deletion.
- **Database:** `umask 077; sudo -u postgres pg_dump -Fc -d medbrains -f /var/backups/medbrains/incident-<id>.dump`;
  export the relevant `audit_log` / `access_log` window to CSV; run the audit-chain verification and save the result.
- **Logs:** `journalctl --since … -o export > incident-<id>.journal` for `medbrains-server`, `caddy`, `postgresql`,
  `sshd`; Caddy access logs; `last`, `/var/log/auth.log`; AWS CloudTrail for the window (if enabled).
- **Volatile state if live compromise is suspected:** `ps auxf`, `ss -tupan`, `who`, open files — before shutdown.
- Hash every artefact (`sha256sum`) and record it in the evidence log; store in a restricted, versioned location
  (not on the affected host). Record who handled each item and when (chain of custody).
- Do not alert a suspected insider through channels they can read.

## 8. Communication templates

**Hospital — initial (within [ORG: hours] of noticing):**

> Subject: [MedBrains] Security incident affecting <hospital> — initial notice (ref <id>)
>
> At <time IST> on <date> we identified <one-line description>. Current impact: <systems/data/patients affected, or
> "under investigation">. What we have done: <containment>. What we need from you: <e.g. nothing / reset passwords /
> switch to downtime procedures>. Personal data: <involved / not involved / being determined>. We will update you by
> <time>. Incident lead: <name, phone>.

**Hospital — update / closure:** same subject with "update N" / "resolved"; add root cause, data affected, what changed
to stop recurrence, and the facts they need for their Board and patient notices.

**Data Principal (patient) notice — for the hospital to send, plain language, in the patient's language:**

> We are writing to tell you about an incident involving your personal data held by <hospital>. On <date>,
> <what happened, in one or two sentences>. The information involved was <categories, e.g. name, contact details,
> appointment records>. This may mean <likely consequences>. We have <steps taken>. You can <steps the person can
> take>. For questions contact <name/role, phone, email>.

**CERT-In report:** use the current CERT-In form; attach indicators (IPs, hashes, URLs), affected systems, timeline,
actions taken, and the PoC's details.

**Status page / public:** [ORG: decide whether one exists; if not, hospital-direct only].

## 9. Incident record (copy per incident)

```
Incident ID:                 Severity:            Status: open / contained / resolved / closed
Noticed at (UTC + IST):      Reported by:         IC:
CERT-In 6h deadline:         Sent at:             CERT-In ref:
Hospital(s) notified at:     DPDP Board notice by fiduciary:   72h report due:
Systems / tenants affected:
Personal data involved (categories, count):
Timeline (UTC): …
Evidence log (item, sha256, location, handler, time): …
Containment / recovery actions: …
Root cause:
Follow-up actions (owner, due): …
Closed by / at:
```

## 10. Post-incident review

Blameless, within 5 working days for SEV1/SEV2, written up in the incident record:

1. Timeline from first signal to resolution; time to detect, to notify, to contain, to recover.
2. Did each clock (CERT-In 6 h, contract notice, DPDP) get met? If not, why.
3. Root cause and contributing factors (technical and process).
4. What detected it; what should have detected it earlier.
5. Actions, each with an owner and a due date; tracked to done; the plan or runbooks updated where they were wrong.
6. Shared with the affected hospital where it concerns them.

## 11. Exercise

Run a tabletop at least yearly and after major changes: [ORG: date of first exercise]. Suggested first scenario: a
leaked database dump found on a public site — exercises evidence, CERT-In 6 h, the hospital contract notice and the
DPDP notices together.

## Approval record

| Version | Date | Approved by | Changes |
|---|---|---|---|
| 0.1 draft | 2026-10-12 | — (engineering draft) | initial |
| [ORG] | | | |
