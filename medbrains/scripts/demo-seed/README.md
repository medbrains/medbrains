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
| `s11_extra_modules` (+ `extra_*.py`) | OT, diet, HR roster/attendance, store/indent/procurement, camp, blood bank, ICU, housekeeping, CSSD, infection control, quality, ambulance, BME, home health, telemedicine, front office, maternity, dental/ophthalmology, MRD, LMS, facilities; `--verify` checks the links |
| `run_history.py` | a year of history through the import API (below) |
| `s99_verify` | reads everything back through the API and checks the links between modules |

It builds on the G2DEMO base data (the tenant, 9 departments, 5 doctors, a nurse, a
receptionist, 14 patients, 2 wards with 20 beds, and the lab, pharmacy and radiology
catalogues). It does not create that base.

`test-questions.md` lists chatbot questions with the answers computed from the snapshot
below. Re-run `facts.sh` to recompute the answers after any change to the data.

## A year of history (`make demo-seed-history`)

The live steps above fill today. The past comes in the way a real hospital's would:
through **Admin → Import history** (`POST /api/history-import/batches`, #5045). Each record is
dated when it happened, before the go-live cut-over (2026-10-25 00:00 IST by default), and
goes through the import's checks.

```bash
make demo-seed-history                        # 12 months, ~Rs 10 crore billed
make demo-seed-history DEMO_MONTHS=6 DEMO_TARGET_CRORE=4
```

- `history_plan.py` builds the year deterministically (fixed seed). It covers new and
  returning patients, OPD visits with ICD-11 diagnoses and vitals, lab results, dispenses,
  one bill per visit, closed admissions (medical stays, surgical and obstetric packages,
  PTCA, TKR) at tier-2 Indian private-hospital tariffs, and cashless claims.
- Volumes follow the seasons. Monsoon (June to October) brings dengue, typhoid and
  gastroenteritis, and winter brings respiratory illness. Mondays are busy and Sundays
  quiet. Every day of the year has a full day's activity, including the last 30 days.
- `run_history.py` solves the volume for the revenue target, then sends batches of
  200 records one at a time with a short pause between them.
  - Re-running it is safe, because records already imported are skipped by external id.
  - The live patients it may attach history to are frozen in `state.json` on the first
    run, so the plan never changes between runs.

## Known limits (product gaps, not seed bugs)
- `POST /diet/orders` and `POST /cssd/issuances` answer 200 but save nothing, and OT
  "completed" returns a 500. In all three, a discarded auto-billing error aborts the
  transaction. `POST /chronic-care/programs` returns a 500 (an enum is read into a
  `String`).
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
