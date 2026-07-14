# RFC — Patient access control: linking, enforcement & leakage prevention

**Status:** Accepted (direction) · **Date:** 2026-07-14 · **Relates to:** `RBAC-POLICY-MATRIX.md`,
`RFC-AUTH-STORAGE-HARDENING.md`, `project_patient_linking_access`, `project_rebac_authz_audit`,
`feedback_check_access_controls`

## Context & decision

MedBrains isolates tenants with Postgres RLS, and gates *actions* with RBAC (`require_permission`). Neither
answers the question this RFC is about: **which patients may a given user see inside their own tenant?** Today,
for most read paths, the answer is "any authenticated user in the tenant with the coarse module permission" —
so a clinician holding `mrd.records.list` can open **any** patient's medical record, scanned case sheet,
progress notes, vitals, or wound chart, regardless of whether they are on that patient's care team. That is a
patient-confidentiality breach (DPDP Act 2023, NABH IPSG/MOM, HIPAA-equivalent minimum-necessary) and the core
problem this RFC closes.

The building blocks already exist: a **Zanzibar/ReBAC** engine (`medbrains-authz`) over a `relation_tuples`
table (`0003_auth.sql:157`) and a SpiceDB schema (`infra/spicedb/schema.zed`), with a proven per-record guard
(`require_patient_access`, `routes/consent.rs:26`). What is missing is (1) the **linking write-path** — the
relation tuples that record who is on a patient's care team are written at registration and by a one-time
backfill, but **not at the live lifecycle events** (encounter, admission, referral, follow-up); and (2) the
**enforcement read-path** — the guard is applied to a handful of routes and absent from ~17+ patient-data
handlers. **Linking is the key**: enforcement without complete linking locks out legitimate care teams;
linking without enforcement protects nothing. They must ship together, resource by resource, linking first.

**Decision.** Adopt patient access control as a first-class layer with three moving parts — **link** (populate
care-team tuples at every lifecycle event, department-scoped for efficiency), **enforce** (apply the right
per-object guard to every per-patient detail/document read), and **keep it cheap** (cacheable consistency +
a non-pathological bulk path). Deliver it in small, safe, resource-by-resource slices behind this RFC.

## Principles

1. **Two gates, both required.** RBAC/RLS answers "may this user perform this action in this tenant";
   access-control answers "on *this* patient." A read must pass both. They compose — never replace RBAC with
   ReBAC or vice-versa.
2. **Link first, then enforce — in the same slice.** For each resource: confirm/complete its linking so
   legitimate users resolve, *then* add the guard. Never add a guard whose object type has no populated
   linking.
3. **Fail closed, reveal nothing.** A denied per-patient read returns **`NotFound` (404)**, not `Forbidden`,
   so the endpoint is not an existence oracle. On an authz-engine error the guard denies (`unwrap_or(false)`).
4. **Department-scoped linking over per-user fan-out.** Link the treating **department** to the encounter/
   admission (one tuple, whole team resolves) rather than every individual — efficient and matches how wards
   actually staff. Individuals (attending, referred-to) get their own grant on top.
5. **Operational ≠ clinical.** Records-department and registry reads are legitimately cross-patient — they stay
   **role-gated** (the module permission is the control). Only **per-patient clinical/document detail** reads
   are **link-gated**. Decide the bucket per handler before gating.
6. **Break-glass is a feature, not a bypass.** Emergencies require any clinician to reach any patient — model
   it as an explicit, audited, time-boxed **emergency-access grant**, not by leaving the door open.
7. **Minimum necessary, including fields.** Beyond *which* patient, restrict *which fields* (field-level
   redaction) so masked identifiers/notes never reach unauthorized roles.

---

## 1. The model as-built (reuse, don't reinvent)

- **Engine:** `medbrains-authz`, `check(ctx, Relation, object_type, object_id) -> bool`. Object types:
  `patient`, `encounter`, `admission`, `invoice`, `lab_order`, … (`infra/spicedb/schema.zed`). The `patient`
  permission `view = owner + attending + dept_member + group_member + viewer + editor` (`schema.zed:38-63`);
  `encounter`/`admission` mirror it.
- **Relations** (`relations.rs:10-29`, closed enum) with implication (`implies()`, `relations.rs:75-92`):
  Owner→Editor→Viewer; AttendingPhysician→Editor→Viewer; Consultant→Viewer. Raw schema relations
  `dept_member`, `ward_member`, `group_member` have **no enum variant** — written via a raw path (see §6/§7).
- **Backends:** production is `DurableSpiceDbBackend` (`main.rs:135`) = SpiceDB gRPC with a Postgres
  `relation_tuples` fallback on `false`/error. Bypass roles (`super_admin`/`hospital_admin`) short-circuit to
  `true`.
- **Established guards:** `require_patient_access` (`consent.rs:26`, checks `"patient"`),
  `require_encounter_access` (`nurse_handoff.rs:24`, checks `"encounter"`), `require_admission_access`
  (`icu.rs:26`, checks `"admission"`), `ensure_invoice_view_access` (`billing.rs:691`). List filtering via
  `list_accessible` / `bulk_check` (`patients.rs:1279`, `opd.rs:571`, `radiology.rs:470`, `lab.rs`,
  `billing.rs:1153`).

## 2. Linking write-path — lifecycle → relation map (the foundation)

The invariant: **every clinical object records its care team at creation.** Current state vs target:

| Lifecycle event | Site | Written today | Gap to close |
|---|---|---|---|
| Patient registered | `patients.rs:1586` | `patient#owner@user` (clerk), `patient#attending@user` (consultant, if given) | (adequate) |
| **Encounter created** | `opd.rs:718` | **nothing** | `encounter#attending@user:doctor_id` + `encounter#dept_member@department:department_id` |
| **Admission created** | `ipd.rs:1365` | **nothing** | `admission#attending@user:admitting_doctor` + `admission#ward_member@department:ward/dept` |
| **Referral created** | `opd.rs:3671` | nothing | `patient#viewer@user:referred_to` (or `referred_to` relation) — the referred clinician |
| Follow-up assigned | (opd) | nothing | `followup_assignee` grant |
| Explicit share | `sharing.rs` | full (works) | (adequate) |
| Backfill (one-time) | `bin/backfill.rs` | `attending`/`dept_member` on encounter/admission | keep for existing rows |

Grants are written **post-commit**, mirroring `patients::create_patient`, and are **fatal on failure** so the
care-team invariant holds. Department/ward grants use `Subject::Department` with the raw `dept_member`/
`ward_member` relation (requires §7). The `attending` grant maps cleanly through the enum
(`Relation::AttendingPhysician` → SpiceDB `"attending"`, `backend_spicedb.rs:192`).

## 3. Enforcement read-path — pick the object type by the key

For each per-patient detail/document read, guard with the helper matching the **path key**, because that is
where the care-team tuple lives:

- key = `patient_id` → `require_patient_access` (`"patient"`)
- key = `encounter_id` → `require_encounter_access` (`"encounter"`)
- key = `admission_id` → `require_admission_access` (`"admission"`)
- key = a sub-resource id (`certificate_id`, `consent_id`, `scan_id`, `record_id`) → resolve it to its owning
  patient/encounter/admission **inside the same tx**, then guard that.

**Confirmed leakage surface (0 checks today, tenant-RLS only)** — the enforcement backlog, clinical first:

| Resource | Handlers | Example (file:line) |
|---|---|---|
| Scanned case sheets | `case_sheet_scan.rs` (7) | `get_scan:106`, `list_scans:82` |
| MRD records | `mrd.rs` (34 — *operational subset stays role-gated*) | `get_record:381`, `list_records:278` |
| Generated documents | `documents.rs` | `get_output:828`, `list_outputs:798` |
| Ingested documents | `document_ingestion.rs` (8) | `search_ingested:76`, `file_item:333` |
| IPD print packs | `print_data_mrd.rs` | progress/MAR/vitals/I-O by `admission_id` (:46/:296/:429/:533) |
| Clinical print packs | `print_data_clinical.rs` | certificate/consent/wristband (:116/:302/:528) |
| Nursing vitals/clinical | `nurse_vitals.rs`, `nurse_clinical.rs` | `list_vitals_for_encounter:93`, `list_wounds_for_encounter:186` |

`bedside_portal.rs`, `care_view.rs`, `doctor_dashboard.rs`, `order_sets.rs`, `cds.rs`, `ai.rs` also read
patient data and need per-handler audit.

## 4. Operational-vs-clinical rule (the judgment each slice makes)

- **Role-gated (leave as permission-only):** MRD filing/movement/retention lists, registries, audit logs,
  aggregate dashboards, camp/OPD registration desks — staff here legitimately span all patients.
- **Link-gated (add the guard):** any handler returning one patient's clinical content or documents keyed by
  that patient/encounter/admission — case sheets, progress notes, results, prescriptions, diagnoses, vitals,
  wounds, print packs.
- Ambiguous → gate the by-id detail read, leave the department-scoped operational list. Document the call in
  the PR.

## 5. Field-level access (already present; extend later)

`middleware/field_access.rs` provides **write-time field redaction** (`View|Mask|Hidden` per `module.field`
from `roles.field_access_defaults` + `users.access_matrix`). It masks a few output fields only where a handler
explicitly filters (e.g. `get_patient` → `filter_patient_response`, `patients.rs:1651`). Non-goal for the
first phases; a later phase extends **read masking** coverage so restricted identifiers (Aadhaar, phone, HIV/
psych flags) are masked consistently on every patient response, not per-handler.

## 6. Efficiency (make the gate cheap before rolling it out)

The check runs on every per-patient read, so cost matters (the user's explicit concern):

- **Consistency:** SpiceDB `check` currently uses `FullyConsistent` (`backend_spicedb.rs:226`), the most
  expensive mode — it defeats SpiceDB's check cache. Move per-request checks to `minimize_latency` /
  `at_least_as_fresh` (as reads/lists already do, `:150`), reserving full consistency for post-write reads
  that must see their own grant.
- **`bulk_check`:** `PgAuthzBackend` does **not** override it → default fan-out issues N single-`check`
  transactions (`lib.rs:133`); `list_patients` = 3 relations × page-size (`patients.rs:1279`), i.e. 150
  transactions for a 50-row page on the PG fallback. Override with one `LEFT JOIN … BOOL_OR` query.
- **Department-scoped linking (§2/§4)** keeps tuple counts O(departments) not O(users), and lets a single
  `dept_member` grant satisfy a whole team without per-user tuples.
- Optionally a request-scoped memo so repeated checks for the same object in one handler don't re-query.

## 7. Trait gap to unblock linking

`state.authz` is `Arc<dyn AuthzBackend>`; the trait exposes enum `write_tuple` but **not** raw-relation writes.
`write_raw` exists only on the concrete `SpiceDbBackend` (`backend_spicedb.rs:531`), used by the backfill
binary. To write `dept_member`/`ward_member` from routes, add `write_raw(ctx, object_type, object_id,
relation_name: &str, subject, …)` to the `AuthzBackend` trait and implement it on all backends
(`DurableSpiceDbBackend` delegates to both; `PgAuthzBackend` = INSERT into `relation_tuples`;
`TestBackend`). Additive — no existing caller changes. This is the first enabling step.

## 8. Break-glass (emergency access)

Model an explicit, audited **emergency access** path: a clinician with an `emergency.break_glass` permission may
self-grant a **time-boxed** `patient#viewer` (e.g. 12h, `expires_at`) with a mandatory reason, which the guard
then honours. Every break-glass grant is audit-logged and surfaced for review. This preserves care in a
crisis without leaving reads ungated. (Aligns with the break-glass work in `RFC-AUTH-STORAGE-HARDENING`.)

## 9. Constraints & non-goals

- **Local Postgres is DOWN** this session and there is no local SpiceDB, so authz SQL / schema writes validate
  in CI or once services return — do not ship an unvalidated migration or trust a runtime write blind.
- Clean migration files (no patch-on-patch); keep `make check-rls` / `check-tenant-leak` green — access control
  layers **on top of** RLS, never replaces it.
- Non-goal: reworking the RBAC permission catalog, or cross-tenant/operator access (that is the managed-service
  RFC). This RFC is strictly within-tenant patient visibility.

## 10. Phased rollout (each its own PR, approved individually)

- **P1 — Trait raw-write** (§7): add `write_raw` to `AuthzBackend` + all backend impls. Additive, unit-tested
  (TestBackend), no behaviour change. Unblocks live department linking.
- **P2 — Care-team linking at creation** (§2): wire encounter (`opd.rs:718`) then admission (`ipd.rs:1365`)
  grants — attending + dept/ward. One resource per PR. Additive; no enforcement yet → zero lock-out.
- **P3 — Efficiency** (§6): consistency mode + `PgAuthzBackend::bulk_check` override. Measurable, no behaviour
  change to results.
- **P4…Pn — Enforcement per resource** (§3/§4): documents first (case sheets, MRD detail, generated/ingested
  docs), then IPD/clinical print packs, then nursing vitals/wounds, then the dashboards/care-view audit. Each
  PR: confirm linking is populated for its object type, add the guard, verify the UI surfaces the 404/empty
  state, gate.
- **P(n+1) — Break-glass** (§8) and **read-side field masking** (§5).

## 11. Verification / acceptance

Per PR: `SQLX_OFFLINE=true CARGO_TARGET_DIR=/tmp/mb-target cargo clippy 0` + authz unit tests (TestBackend +
pure decision fns), `pnpm typecheck+build`, `biome`, `make check-api` + `check-rls`/`check-tenant-leak`; authz
writes/migrations validated in CI or on a live DB once back. **End-to-end acceptance:** with patient P linked
to department D and doctor Dr, a clinician in D can read P's case sheet/vitals; a clinician in an unrelated
department gets **404**; the attending Dr can read; a break-glass grant (audited) temporarily allows and then
expires; `super_admin` bypasses; and no legitimate care-team member is locked out of a patient they are
treating.

## Sources

- In-repo: `medbrains-authz` (relations.rs, backend_spicedb.rs, backend_pg.rs, backend_durable_spicedb.rs,
  bin/backfill.rs), `infra/spicedb/schema.zed`, `0003_auth.sql`, guards in consent/icu/nurse_handoff/billing,
  leakage handlers per §3.
- External model: Google **Zanzibar** paper; **SpiceDB** docs (consistency modes, `BulkCheckPermission`);
  DPDP Act 2023 + NABH minimum-necessary / access-control standards.
