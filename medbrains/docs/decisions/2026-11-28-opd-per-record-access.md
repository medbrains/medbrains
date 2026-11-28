---
date: 2026-11-28
title: OPD worklists show clinical detail per record, and a shared vitals counter nurse is a member of every department she serves
status: decided
area: authz
---

## What

The OPD queue and the verbal-order register check each row's visit in one bulk call
(`record_access::visit_access` through `kernel::authz::authorize_each`, which checks records of
several kinds in one backend round trip and keeps the three outcomes per record). A row is
readable by the visit's care team or by a grant on the patient, which is where break-glass lands.

- A row the caller may not read keeps its token, status and name (the desk calls everyone) and
  loses its chief complaint, appointment reason and referral reason (queue), or its patient and
  order summary (verbal-order register). A row the check could not answer is `unknown`, and the
  screen says "Couldn't check access", never "Not recorded".
- Referral tracking lists only referrals the caller sent or received, or that are to or from
  their department.
- Accept, decline, complete and cancel a referral were already record-level (addressee or sender,
  404); the checks are now named `require_*_access`.
- Role-only by decision, each with an `// authz: role-only` marker: `call_queue_entry`,
  `get_last_visit`, `get_doctor_docket`, `generate_doctor_docket`, `get_wait_estimate`,
  `followup_compliance`, `reports::get_summary`.
- **Owner decision, 2026-11-28: accepted as designed.** A nurse at a shared vitals counter must
  be a member of every department she serves to see the complaints of its visits.

The Postgres backend's one-statement bulk check is #6265's
(`2026-11-25-authz-pg-bulk-check.md`); this change only calls it.

## Why

Before, anyone whose role could open an OPD list saw every row's clinical detail, and every
doctor saw every referral's reason and clinical notes hospital-wide.

## Rejected

- Dropping withheld queue rows: the desk would stop calling patients it cannot read clinically.
- A care-team filter on referral tracking: a referral arrives before the receiving side holds any
  tuple, which would empty the inbox of the doctors who answer it.
- A record check on calling a token: the desk calls for every department; starting the
  consultation already checks the visit.
- A counter-wide exception for shared vitals counters: it would let anyone posted to a counter
  read every department's complaints; department membership is the existing, auditable grant.
- Open for the owner: `get_last_visit` names the last department, which for a psychiatry visit
  discloses psychiatric care to the desk; departments carry no confidentiality flag to withhold
  it by.
