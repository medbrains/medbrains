# Demo hospital seed (G2DEMO)

These scripts fill the **MedBrains Demo Hospital** (hospital code `G2DEMO`) with clearly
fictional data through the app's own REST API. Because every row goes through the API,
business rules, audit rows, sequences and invoices are all real. SQL is used only to read
data back (`q.sh` opens a read-only session).

The data is synthetic. Phones are in the `90000 xxxxx` range, ABHA numbers are dummy
`99-0000-…` values, and all names are invented.

## Run

```bash
cd medbrains
make demo-seed                          # every step, then the API read-back
python3 scripts/demo-seed/run_all.py s06_lab s99_verify   # just some steps
```

| Variable | Default | Meaning |
|---|---|---|
| `MB_DEMO_API` | `http://127.0.0.1:3071/api` | backend serving the demo database |
| `MB_DEMO_LOGIN_FILE` | `/tmp/mb-demo-login.txt` | `hospital code:`, `username:`, `password:` lines |
| `MB_DEMO_HOSPITAL` / `MB_DEMO_USER` / `MB_DEMO_PASSWORD` | — | use these instead of the file |
| `MB_DEMO_STATE` | `scripts/demo-seed/state.json` | id map that makes re-runs resume (gitignored) |
| `MB_DEMO_DB`, `MB_DEMO_PGPORT` | `medbrains_wt_g2shots`, `5435` | used by `q.sh` / `facts.sh` (read-only) |
| `MB_DEMO_TENANT_ID` | — | the G2DEMO tenant id, for `facts.sh` |

No credentials are stored in the repository. Run this only against a demo database, never
the shared `medbrains` database.

The client in `api.py` is deliberately polite. It makes one call at a time, pauses after
each call, and backs off when the server is slow, because the demo backend is shared with
people using the app.

## What it creates

The steps run in this order, and each one is idempotent:

| Step | Creates |
|---|---|
| `s01_patients` | 61 patients from every region (ages 1–90), 12 allergies, 15 dummy ABHAs, insurance/PMJAY/CGHS categories |
| `s02_staff` | Emergency, Radiology and Surgery departments; 5 doctors and 3 nurses; weekly OPD schedules |
| `s03_drugs` | 16 drugs with full regulatory fields (Schedule H/H1/NDPS, ATC, AWaRe, LASA pair, cold chain), plus batches that are near expiry or low on stock |
| `s04_lab_masters` | 11 tests with LOINC codes, units, and reference and critical ranges |
| `s05_opd` | today's OPD: ~92 visits, queue states, vitals, ICD-11 diagnoses, prescriptions, lab orders, follow-ups, past and future appointments |
| `s06_lab` | sample collection, processing, results (abnormal and critical), read-back acknowledgement, verification |
| `s07_ipd` | 20 admissions: nursing notes (2 Tamil, 2 Hindi), vitals charts, tasks, a bed transfer, discharge summaries, 2 stuck on discharge clearance, a DAMA |
| `s08_pharmacy` | dispensing after payment, NDPS receipts and a witnessed morphine dispense, OTC sales, a return |
| `s09_billing` | IPD tariff lines, cash/UPI/card payments with partial and outstanding balances, a refund, an advance, the day close; insurers, policies, pre-auths, claims |
| `s10_er_radiology` | 5 ER visits including a road-traffic MLC (injuries, police intimation); 13 radiology orders and reports, one of them critical |
| `s11_extra_modules` | OT, diet, HR roster/attendance, indent, camp, blood bank and other modules |
| `s99_verify` | reads everything back through the API and checks the links between modules |

It builds on the G2DEMO base data (the tenant, 9 departments, 5 doctors, a nurse, a
receptionist, 14 patients, 2 wards with 20 beds, and the lab, pharmacy and radiology
catalogues). It does not create that base.

`test-questions.md` lists chatbot questions with the answers computed from the snapshot
below. Re-run `facts.sh` to recompute the answers after any change to the data.

## Known limits (product gaps, not seed bugs)

- **No backdating through the API.** Every create stamps the time it was made, so the
  activity is dated "today". Appointments are the exception, because they accept past
  dates. `POST /retrospective/encounters`, the only backdating path, fails with a 500: its
  INSERT names a `chief_complaint` column that `encounters` does not have. A
  months-of-history seed needs that fixed, and needs the same capability for admissions,
  orders and invoices.
- Platelet results are auto-flagged against a lakh/cumm reference with the unit ignored,
  so the seed reports platelets in lakh/cumm.

## Snapshot and restore

Seeding is slow on purpose, so a finished run is kept as a dump outside the repository:

```
/Users/apple/Projects/MedBrains-demo-data/g2demo-<date>.dump   (pg_dump -Fc)
/Users/apple/Projects/MedBrains-demo-data/README.md           (commit + migration level it matches)
```

```bash
make demo-restore DEMO_DUMP=/Users/apple/Projects/MedBrains-demo-data/g2demo-2026-10-25.dump DEMO_DB=medbrains_demo_copy
```

`demo-restore` always creates a **new** database. It refuses to restore over `medbrains` or
over a database that already exists. A dump only matches the migration level it was taken
at: run the server's migrations after restoring into a newer build, or rebuild it with
`make demo-seed`.
