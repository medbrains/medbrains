# Day-Run Simulator (internal / training only)

`day-run.mjs` drives the live MedBrains HTTP API to generate one day's worth
of OPD + IPD + ER activity tied to **real registered patients**. Every POST
sets `is_dummy: true`, so seeded rows are flagged in the database for
internal-only use.

## Why a flag, not a separate environment

The simulator hits the production code path (same validation, audit trail,
event queue, queue tokens). The DB column `is_dummy boolean default false`
already exists on `encounters`, `admissions`, `er_visits`, `lab_orders`,
`radiology_orders`, `pharmacy_orders` (migration
`0139_clinical_is_dummy_flag.sql`). Partial indexes on `WHERE is_dummy =
false` keep the "real records only" path index-only.

**Regulator-facing reports MUST filter `WHERE is_dummy = false`.** This is a
separate cleanup task — until each report adds the filter, do not run the
simulator against an environment a regulator can see.

## Gate

Only `super_admin` and `hospital_admin` roles can set `is_dummy = true`.
Other callers passing the flag have it silently coerced to `false` inside
each route handler. Source of truth:
`crates/medbrains-server/src/middleware/authorization.rs:7` (`BYPASS_ROLES`).

## Usage

```bash
MEDBRAINS_API_BASE=http://localhost:8080 \
MEDBRAINS_TOKEN=<super_admin_jwt> \
node scripts/simulators/day-run.mjs --patients 20 --date 2026-05-24
```

Flags:

| Flag | Meaning |
|------|---------|
| `--patients N` | how many real patients to drive (default 10) |
| `--date YYYY-MM-DD` | simulated day label, used in the verify hint |
| `--opd-only` | skip the ER track |
| `--er-only` | skip the OPD track |
| `--dry-run` | log requests without sending |

## What it does

For each chosen patient:

- **OPD track (default 90% of patients)** — POST `/api/opd/encounters`, then
  `.../vitals`, `.../diagnoses`, `.../prescriptions`. ~25% branch to a lab
  order, ~15% to a radiology order, ~10% escalate to an IPD admission via
  `/api/ipd/admissions`.
- **ER track (~10% of patients)** — POST `/api/emergency/visits`,
  `.../triage`. Red/yellow triage has ~40% chance of `.../admit` (direct
  ER → IPD).

Reference data is fetched from `/api/patients`, `/api/admin/doctors`,
`/api/lab/test-catalog`, `/api/radiology/modalities` etc. Hard-coded
ICD-10 and drug shortlists provide variety without hitting external
catalogs.

## Verify

```sql
SELECT count(*) FROM encounters       WHERE is_dummy = true AND encounter_date = CURRENT_DATE;
SELECT count(*) FROM admissions       WHERE is_dummy = true;
SELECT count(*) FROM er_visits        WHERE is_dummy = true;
SELECT count(*) FROM lab_orders       WHERE is_dummy = true;
SELECT count(*) FROM radiology_orders WHERE is_dummy = true;
```

## Out of scope

- AI-generated narrative for prescriptions / diagnoses (Anthropic via `rig`
  is wired in `routes/custom_code.rs:284` — can be layered on later).
- Frontend simulator button — this script is the entry point.
- `is_dummy` on child tables (`vitals`, `diagnoses`, `prescriptions`,
  `er_triage_assessments`). They inherit via parent encounter / visit FK.
