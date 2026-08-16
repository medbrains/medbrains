# Certification readiness — the engineering backlog

Companion to `docs/CERTIFICATIONS.md`, which covers *which* certifications and
in what order. This tracks the work that has to exist before any of them are
worth applying for, and separates what engineering can do from what needs a
signature.

Every finding below was verified against the running system on the date shown,
not inferred.

---

## Who does what

**Needs a person with authority** — cannot be delegated to engineering:

| | |
|---|---|
| NRCeS registration + SNOMED CT Affiliate Licence Agreement | signature, organisation details |
| ABDM / NHA registration, HFR and HPR | signature |
| ISO 27001 certification body engagement | contract, fees |
| SaMD determination | regulatory consultant's written opinion |
| DPDP Data Protection Officer appointment | named individual |
| CERT-In point of contact registration | signature |

**Engineering** — everything below.

---

## P0 — blocks every certification

### 0. Patient-access control is built but barely applied

*Verified 2026-08-12.*

The deployment model is **one hospital per database, on its own
infrastructure**. Hospital-to-hospital isolation is therefore a property of the
topology, not of RLS — a stronger control, not a weaker one. Within a hospital,
records are shared across locations by default, with named units (psychiatry,
de-addiction, VIP, employee health) restricted to their own staff and a
break-glass path for emergencies.

The machinery for that already exists: `sensitive_patients`,
`break_glass_events`, `relation_tuples` (32 partitions, ReBAC via SpiceDB),
`patient_record_access_log`, `roi_access_log`, `dpdp_consents`, and field-level
masking through `FieldAccessLevel::Mask`.

It is the *coverage* that is missing:

| | |
|---|---|
| routes taking a `{patient_id}` | **91** |
| call sites checking `require_patient_access` | **13** |
| `sensitive_patients` referenced in code | 2 files |
| `break_glass_events` referenced | **1 file** |
| `patient_record_access_log` referenced | **1 file** |
| crates each defining their own `require_patient_access` | **4** |

Roughly **86% of patient-facing routes perform no access check**. A restricted
psychiatric record is protected on the handful of routes that ask and readable
on the rest, which is worse than no restriction at all: the label implies a
guarantee the system does not keep, and staff act as though it does.

`break_glass_events` is the sharper problem. An emergency override that is not
recorded is indistinguishable from an ordinary read, so the one access most
needing scrutiny leaves the least trace.

**Fix.** Not more tables — one shared, enforced check:

1. collapse the four copies of `require_patient_access` into one crate;
2. apply it to all 91 routes, denying by default;
3. write `patient_record_access_log` on every read of a restricted record;
4. make break-glass an explicit, reasoned action that writes
   `break_glass_events`, rather than an absence of a check.

**Fails:** ISO 27001 A.5.15 / A.8.3, DPDP Act (purpose limitation and
unauthorised access), NABH patient confidentiality, and the first question any
hospital's own security review asks.

### 1. RLS is not enforced against the application's database role

*Verified 2026-08-12.*

```
808  tables with RLS enabled
 83  with FORCE ROW LEVEL SECURITY
725  without

application role:  medbrains
owns every table:  yes
superuser (dev):   yes
```

PostgreSQL exempts a table's **owner** from its RLS policies unless
`FORCE ROW LEVEL SECURITY` is set, and exempts a **superuser** unconditionally
even when it is. The application connects as the owner. So on 725 tables the
tenant-isolation policies are inert, and the only thing separating one
hospital's patients from another's is application code remembering to filter by
`tenant_id` — which is exactly what RLS exists to backstop.

This is not a missing concept. `FORCE` appears in **29 migrations** covering the
83 tables (doctor, nurse, OT, billing, procurement): somebody knew about
owner-bypass and applied the fix module by module. The remaining 725 were never
revisited, which is worse than never knowing, because the posture looks
handled.

**Production is affected too.** The superuser bypass is a dev-container
artefact — `POSTGRES_USER: medbrains` — and the Aurora master user is not a
true superuser, so that part does not travel. Owner-bypass does: the Terraform
Aurora module connects as `master_username` and creates no separate application
role, so the application still owns the tables in production.

**Demonstrated, not inferred.** In a rolled-back transaction: a second tenant
was created, given a department, and read back while `app.tenant_id` was set to
the *first* tenant — exactly as the application sets it per request.

```
A. table not FORCEd, acting as tenant A   -> other hospital's row VISIBLE
B. FORCE ROW LEVEL SECURITY turned on     -> other hospital's row STILL VISIBLE
```

`FORCE` changed nothing, because a superuser bypasses row security
unconditionally. **The role is the problem, not the flag** — a migration adding
`FORCE` to 725 tables would have produced a diff, a sense of progress, and no
change in enforcement whatsoever.

**Fix — a non-owning, non-superuser application role. `FORCE` alone is not it.**

Turning `FORCE` on for 725 tables in one migration is the tempting move and the
risky one: `FORCE` subjects the owner to RLS too, so every path that
legitimately runs without a tenant context — migrations, seeding, cross-tenant
administration, the global tables that deliberately use `&state.db` rather than
a transaction — would start returning zero rows. Silently. That failure looks
like missing data, not like a permission error.

The safer and more standard arrangement:

1. create `medbrains_app`, owning nothing, without `BYPASSRLS`;
2. grant it DML on the application tables;
3. point the runtime at it, leaving migrations and seeding as the owner;
4. verify with a cross-tenant read that must return zero rows;
5. add `FORCE` afterwards as defence in depth, once nothing depends on
   owner-bypass.

Ordering matters: step 3 before step 5, so a mistake shows up as a permission
error rather than as quietly absent data.

**Severity, corrected.** This was first written as P0 on the assumption that
several hospitals share a database. They do not — one hospital per deployment,
one tenant row per database — so there is no other tenant for a leak to reach,
and the demonstration above only worked because a second tenant was
manufactured for it.

`tenant_id` stays on all 829 tables: it costs nothing, and it keeps
consolidation possible later. What drops is the urgency. This is now **P2
defence-in-depth** — worth doing before any deployment ever hosts two
hospitals, and worth doing because a control that looks enforced and is not is
a trap for whoever reads the schema next. It is not what stands between one
hospital's patients and another's today; the topology is.

The real access-control gap for this deployment model is §0 above.

### 2. SaMD determination is unresolved

`docs/CERTIFICATIONS.md §0`. The product ships drug–drug interaction checking,
allergy cross-checks, ICU severity scores, fall and pressure-ulcer risk,
readmission prediction and cumulative radiation dose. Whether that is a
regulated medical device decides whether the programme is ISO 27001 or
ISO 13485 + IEC 62304 + ISO 14971 — a difference of years.

**Engineering can move the odds** by building for the exemption rather than
hoping for it: every alert should state *why* it fired, cite its source, and be
overridable with a recorded reason. That is a design property, it is checkable
in code, and it is the difference between "informs" and "drives" clinical
management under IMDRF. Audit not yet run.

---

## P1 — legally required in India, now

### 3. CERT-In Directions (2022)

| requirement | state |
|---|---|
| incident reporting within **six hours** | not built |
| 180-day log retention, held **in India** | unverified |
| NTP sync to NIC/NPL | unverified |
| designated point of contact | needs a person |

### 4. DPDP Act 2023

| requirement | state |
|---|---|
| consent records with purpose | partial — `patient_consents`, `consent_records`, `consent_audit_log` exist |
| data-subject access / erasure | not built |
| breach notification | not built |
| DPO contact published | needs a person |

Worth noting the soft-delete guardrail: every `DELETE` is converted to a soft
delete by a trigger. That is right for clinical records and wrong for an
erasure request, which needs a real deletion path with its own audit.

---

## P2 — commercially required

### 5. ISO 27001 technical controls

Most of 27001 is process and belongs to the organisation. The technical annexes
that are ours: access control (§1 above), audit logging, encryption at rest and
in transit, key management, backup and restore evidence, and change management.

CI is relevant here and is currently not running — a control that exists only
on developers' machines is not evidence of anything.

### 6. VPAT / WCAG 2.2 AA

Cheapest item on the list. The work is already done and enforced by strict
Biome a11y rules; what is missing is the document. Days, not months.

---

## P3 — market access, once the above hold

### 7. ABDM M1

`medbrains-abdm` has ABHA login, OTP verification, sessions and gateway
callbacks. Gap analysis against the M1 checklist not yet done.

### 8. FHIR conformance

**Inferno is free, self-hostable, and needs no registration or programme.**
Running it against our endpoints would give a concrete conformance gap list
today. Best value-per-effort item here, and it is not blocked on anybody's
signature.

Note the direction: `medbrains-snomed` *consumes* FHIR terminology; ABDM
requires MedBrains to *serve* FHIR as a HIP/HIU. They share a vocabulary and
nothing else — one does not advance the other.

---

## Corrections to earlier claims

* "51 tables with RLS enabled and no policy" — **fixed**, by migration 0300 and
  0302. Now zero. The real problem was never the missing policies; it is that
  the policies which do exist are not enforced against the role that uses them
  (§1).
