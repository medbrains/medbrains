# RFC-MODULE: Paperless meter

Status: built (PR "Measure how paperless the hospital is"), 2026-11-08.

## Why

"How paperless are we" was a claim. The meter answers it per department and
per day from what the system holds, and says what it cannot see.

## What counts as a clinical document

A row the system made that a clinician answers for, in one of:

| Type | Table | Signed when | Department |
|---|---|---|---|
| Every signable type (`medbrains_documents::signable::SIGNABLE`, 21 types since #5259) | the type's `table`, dated by `created_at` (`signed_at` for the order basket) | a live `signed_records` row for `(record_type, record_id)` | the record's `department_id` or `from_department_id`, else its registry parent's (`related` with a link column: lab/radiology order, OT booking), else the encounter's, else the admission's, reached from the record, the parent or its ER visit |
| Clinical note (OPD consultation, progress, nursing, ...) | `clinical_notes` (not `entered_in_error`) | `status = 'signed'` (its own ledger) | `service_department_id`, else the encounter's |

The department is found from the columns each table has, read from the
catalogue at run time, so a type added to the registry is counted with no
change to the meter. A blood transfusion record names only the patient, so
it counts under "No department". A type whose table has no `created_at` is listed on the
screen as not counted.

Paper still in use:

| Paper | Source |
|---|---|
| Case sheets scanned in | `case_sheet_scans` (any status; it was paper either way) |
| System documents printed | `document_outputs.first_printed_at` where `source_id` is set (a digital copy exists) |
| MRD physical file requests | not counted: the file-room tracker (#5255) is not merged |

Not counted, and said so on the screen: paper never scanned (so the digital
share is an upper bound); reprints (only the first print is dated); consent
forms (signed in the consent module).

## The three shares

- **Made in the system** = documents made / (documents made + case sheets scanned).
- **Signed digitally** = signed / documents made.
- **Legally signed** = documents with an IT Act s.3A / s.5 signature (DSC or
  Aadhaar eSign) / documents made. No provider exists, so it is 0% of a known
  count, with the reason. MedBrains signatures are Ed25519: they prove who
  signed and that nothing changed, but are not s.3A signatures.

A share with nothing under it is unknown, never 0%. A day never counted is
"not counted", never 0%. A failed read is an error, never 0%.

## Storage (migration 1424)

- `paperless_daily (tenant_id, day, department_id, doc_type, created, signed,
  scanned, printed)`, unique on the first four (`NULLS NOT DISTINCT`).
- `paperless_days (tenant_id, day, computed_at)`: which days were counted.

Both are derived and RLS-forced. A rebuild locks the hospital
(`pg_advisory_xact_lock`), sets `statement_timeout = 60s`, deletes the
window's rows and writes them again, marks the days counted, and audits
`analytics.paperless.rebuild`, all in one kernel unit of work: idempotent and
bounded (one statement per type, at most 90 days).

## Running

- Daily, every active hospital, last 7 days (a document signed days later is
  counted on its day): `medbrains-server` `services::paperless_meter`.
- On demand: `POST /api/analytics/paperless/refresh {days?}` (1–90, default 7).

## API

| Route | Permission |
|---|---|
| `GET /api/analytics/paperless?days=&from=&to=` | `analytics.paperless.view` |
| `POST /api/analytics/paperless/refresh` | `analytics.paperless.refresh` |

Granted to `quality_officer`, `medical_superintendent`, `mrd_officer`
(hospital admin bypasses). Counts only; no patient or clinician is named.

The management KPI `paperless_signed_pct` (seven-day signed share) reads the
same table and sits on the role-admin dashboard.

## Screen

Analytics → Paperless meter (`/analytics/paperless`): range picker (7/30/90
days) and "counted N of M days"; the sentence; three headline tiles; the
daily trend (`@mantine/charts` LineChart, 0–100%, gaps for days with no share,
lines told apart by dash and legend, a table view of the same days); the
department table; paper still in use and what is not counted. Recount button
for holders of the refresh permission.

## Repeat it

```
bash scripts/build_guard.sh --wait
DATABASE_URL=… cargo test -p medbrains-analytics --test paperless -- --ignored
cd apps/web && pnpm exec vitest run src/pages/paperless.test.tsx
```
