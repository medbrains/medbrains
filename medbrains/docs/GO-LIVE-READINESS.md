# Giving this to a hospital — what is pending

An honest assessment, written 2026-08-12. Every claim below was measured
against the running system, not estimated.

Companion to `CERTIFICATIONS.md` (market access) and
`CERTIFICATION-READINESS.md` (the engineering those certifications audit).
This one asks a narrower question: **if a hospital went live on Monday, what
would hurt them?**

---

## What is genuinely ready

Worth stating first, because the list below is long and the foundation is not
the problem.

| | |
|---|---|
| tests | 731 Rust test functions, 91 vitest files, 173 e2e specs |
| schema | 48 migrations, verified equivalent to the 262 they replaced |
| deployment | a 401-line standalone installer, a Helm chart, an on-prem Caddy stack |
| clinical breadth | 874 tables across ~43 domains — OPD, IPD, lab, pharmacy, theatre, blood bank, emergency |
| interoperability | ABDM ABHA login and gateway callbacks, ICD-10/11 via the WHO API |
| audit | append-only decision records, hash-chained audit log, partitioned |

This is not a prototype. The gaps below are the gaps of a system that is
nearly there, which is a different and more dangerous position than one that
obviously is not — because it invites going live.

---

## Hard blockers — do not go live

### 1. CI has never successfully run. Not once.

```
gh run list  →  startup_failure ×5, most recent 2026-08-11
```

Every run fails at startup, which a seven-line test workflow proved is
**billing, not the workflow file**. There is also a dead second workflow at
`medbrains/.github/workflows/ci.yml` — the wrong directory, which is why
nothing ran between June and August.

Nothing in this repository is verified by anything except a developer
remembering to run it. For software that calculates drug interactions, that is
not a process gap; it is the absence of a process. **Fix the billing, delete
the dead workflow, make the gate blocking.**

### 2. Patient access control is built and barely applied

**13 of 91 patient-facing routes check access.** `break_glass_events` has one
code reference; `patient_record_access_log` has one.

A restricted psychiatric or de-addiction record is protected on the routes that
ask and readable on the rest. That is worse than no restriction, because the
label implies a guarantee the system does not keep and staff act as though it
does. And an emergency override that is not recorded is indistinguishable from
an ordinary read — so the access most deserving of scrutiny leaves the least
trace.

Detail in `CERTIFICATION-READINESS.md` §0.

### 3. A production credential is in a public git history

`medbrains/.env.production` was committed 2026-04-24 and removed 2026-05-08.
Deleting a file does not remove it from history, and the repository is now
public. It contained `DATABASE_URL`.

**Rotate it. Assume it is known.** Public GitHub is scraped continuously.

### 4. Nobody has decided whether this is a medical device

The product ships drug–drug interaction checking, allergy cross-checks, ICU
severity scores, fall and pressure-ulcer risk, readmission prediction and
cumulative radiation dose.

Under India's Medical Device Rules 2017 that may be a regulated device; under
EU MDR Rule 11 it almost certainly is. Going live commercially without a
written determination is a legal exposure taken unknowingly, and the
remediation if the answer is "yes" is ISO 13485 + IEC 62304 + ISO 14971 —
18 to 30 months.

Weeks of a regulatory consultant's time. Do it before the first contract, not
after.

### 5. Restore has never been tested

`deploy/standalone/install.sh` references backup ten times. There is no
evidence anywhere in the repository that a restore has ever been performed.

A backup nobody has restored from is a belief, not a control. Prove it: take a
backup, restore to a clean host, and confirm a patient's record and their
audit trail both come back.

---

## Serious — go live and it will hurt

### 6. Legally required in India, today

| | |
|---|---|
| **CERT-In Directions (2022)** | six-hour incident reporting, 180-day log retention held in India, NTP sync to NIC/NPL. None built. |
| **DPDP Act 2023** | consent records exist; data-subject access and erasure do not. The soft-delete guardrail actively conflicts with erasure — every DELETE becomes an UPDATE, which is right for clinical records and wrong for a lawful erasure request. |

### 7. There is no mobile application

Five React Native apps exist as TypeScript — 87 files in `mobile-staff` — with
**no native projects generated**. No `android/` in any of them. They cannot be
built or installed.

If mobile was sold, it does not exist. If it was not, say so plainly before
somebody assumes.

### 8. The database role is a superuser that owns every table

RLS policies are inert against it — proven by a cross-tenant read in a
rolled-back transaction. Single hospital per deployment makes this defence in
depth rather than a live leak, but it is a control that looks enforced and is
not, which is a trap for whoever reads the schema next.

### 9. Twelve backend endpoints have no client

Including `/api/admin/roles` and both payment webhooks. Backend work already
paid for, unreachable. Historically the highest-yield thing in this codebase.

### 10. Clinical coding is ICD-only

No SNOMED licence. The FHIR client is built and tested; the content needs
NRCeS registration, which is free for India and is a signature nobody has
given.

---

## The part that is not code, and is usually what actually fails

None of this is in the repository, and a go-live fails on it more often than
on software:

| | |
|---|---|
| **data migration** | the hospital has records in something today. Moving them is a project of its own, and it is the single most common cause of a stalled HMS rollout. |
| **acceptance testing** | with real clinicians, on real workflows, before go-live. Not a demo. |
| **training** | per role, per shift, including the night staff nobody schedules |
| **support** | who answers at 02:00 when the ward cannot admit a patient, and how fast |
| **parallel running** | paper alongside the system for a period, because the first week will find things |
| **rollback plan** | what happens if week one goes badly, decided before week one |

A hospital cannot stop admitting patients while a vendor debugs. Whatever the
software readiness, this list decides whether the go-live survives.

---

## Sequence

1. **Rotate the leaked credential.** Today. It costs ten minutes.
2. **Fix CI billing, delete the dead workflow, make the gate blocking.**
   Everything else is unverifiable until this is true.
3. **SaMD determination.** Weeks, and it changes the shape of everything after.
4. **Patient access control** — one shared check, applied to all 91 routes,
   break-glass recorded.
5. **Prove a restore.**
6. **CERT-In and DPDP** — already legally required.
7. Then market access: ABDM M1, ISO 27001, SNOMED.

Items 1 and 2 are days. Items 3 to 6 are the difference between software that
works and software a hospital can be given.
