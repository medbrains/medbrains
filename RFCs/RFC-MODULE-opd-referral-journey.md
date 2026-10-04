# RFC — OPD referral, cross-consult and return journey

Status: APPROVED scope 2026-10-04 (product owner answers recorded below). Built slice by slice.

## Why

A doctor must be able to send a patient to another doctor — inside the
hospital or outside it — for an opinion or for good, send them for tests and
have them come back, and every visit must say who referred whom. Today the
pieces exist but are not connected (journey map, 2026-10-04):

- `referrals` has a status column nothing ever changes: no accept, decline or
  complete; creating one puts nobody in anybody's queue.
- No external doctor/facility; `to_department_id` is NOT NULL.
- `return_to_referrer` (tokens) is never triggered and returns to a department,
  not a doctor; it does not reopen the visit.
- A visit has one `doctor_id`; a second consultation note is refused (409);
  `diagnoses` has no author.
- "Referred by" lives in `patients.attributes` JSON; visits carry no source, no
  parent visit, no `review` type.
- The OPD list sorts by token number, ignoring priority; every OPD token is
  issued `normal`.
- No vitals step; a nurse records vitals only in her own department.

## Decisions (product owner, 2026-10-04)

| Question | Answer |
|---|---|
| Second doctor the same day | **Both**, as separate menu actions: *Cross-consult in this visit* (same visit, own queue row/token/note) and *Open a linked visit* (new visit pointing at the first) |
| Outside doctors/facilities | **Both directions**, one partner master; **commission optional per partner** (off by default), audited |
| Review fee | **Doctor decides each time** — a "free review" tick, recorded with who and why |
| Entry points | **Both**: visit Actions menu **and** icons on the OPD queue row; front desk keeps Move on the token console |

## Regulatory notes

- NMC Professional Conduct Regulations 2023: a registered medical practitioner
  must not give or receive commission for referral (fee-splitting). Commission
  is therefore recorded only against a **partner that is a facility or agent**,
  never a doctor partner, and every payout is audited.
- NABH (COP / AAC): referral and transfer documented with reason, urgency,
  receiving clinician, and a handover summary; the patient is identified by two
  identifiers at each handover.
- Consumer Protection Act 2019: a referral letter to an outside facility carries
  the referring doctor's name and registration number.

## Model

- **Queue row per doctor.** `opd_queues` already holds its own `department_id`
  and `doctor_id` with no one-per-visit constraint. A cross-consult or a return
  is another row on the same encounter, with `kind` (`primary`,
  `cross_consult`, `review`, `returned`) and `referral_id`. Each row gets its
  own unified token in the same `visit_id`, so the boards and call-next see it.
- **Referral lifecycle** `pending → accepted → completed`, or `declined` /
  `cancelled`. Accept creates the receiving queue row + token and grants the
  receiving doctor `attending_physician` on the encounter (department
  `dept_member` if no doctor named). Complete records the opinion
  (`response_notes`) and, for an opinion request, returns the patient to the
  referring doctor's queue.
- **Notes per doctor.** One consultation per (encounter, doctor); the visit
  reads the caller's own note and lists the others read-only.
- **Partners.** `referral_partners` (kind doctor | facility | agent, name,
  registration number, contact, `commission_pct` only for facility/agent).
  `referrals.target_kind` internal | external, `external_partner_id`,
  `to_department_id` nullable for external.
- **Visit source.** `encounters.referred_by_kind`, `referred_by_user_id`,
  `referred_by_partner_id`, `referral_id`, `parent_encounter_id`; visit type
  `review`; `free_review` + `free_review_by` + `free_review_reason`.

## Permissions (defined in Rust first)

| Code | Who | Guards |
|---|---|---|
| `opd.referrals.respond` | doctors | accept / decline / complete a referral addressed to them or their department |
| `opd.referrals.cancel` | doctors | withdraw a pending referral they sent |
| `opd.cross_consult.create` | doctors | add another doctor to this visit |
| `opd.visit.transfer` | doctors, front desk | transfer care of a started visit |
| `opd.visit.free_review` | doctors | mark a review visit free |
| `opd.referral_partners.manage` | admin | partner master; commission fields |

## Slices (one PR each, web + server + tests; native follows per slice)

1. **Referral lifecycle**: respond/cancel endpoints, Accept puts the patient in the named doctor's queue (same visit), Complete returns them with the opinion; buttons on the Referrals tab and an incoming-referrals list.
2. **Cross-consult in this visit** + notes per doctor + diagnosis author.
3. **Send for tests and return** to the same doctor (on-hold → returned, priority `returned`).
4. **Transfer care** from the doctor's screen; **Open a linked visit**.
5. **Visit source + review visit** with the doctor's free-review tick.
6. **Referral partners** (both directions, letter, optional facility/agent commission).
7. **Priority at registration + OPD list ordering; vitals step + central vitals nurse.**
8. Queue-row action icons; native parity.

## Scenarios (acceptance)

- Given Dr A refers a patient to Dr B (Cardiology) for an opinion, When Dr B accepts, Then the patient appears in Dr B's queue with the same visit number and Dr A's note visible, and Dr A's referral reads *accepted*.
- When Dr B completes with an opinion, Then Dr A's referral shows the opinion and the patient is back in Dr A's queue ahead of new arrivals.
- Given a referral to Cardiology with no doctor named, When any Cardiology doctor accepts, Then it is theirs and leaves the others' incoming lists.
- Given Dr B declines with a reason, Then Dr A sees the reason and the patient stays with Dr A.
- A user without `opd.referrals.respond` sees no Accept button and the API answers 403; a doctor of another department answers 404 for someone else's referral.
- Given a referral already accepted, When it is accepted again, Then 409, nothing duplicated.
