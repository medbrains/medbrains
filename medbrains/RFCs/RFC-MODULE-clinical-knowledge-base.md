# RFC-MODULE — Clinical Knowledge Base (CKB)

**Status:** PR1 shipped (foundation + notifiable-disease reporting). Roadmap below.

## Purpose
A central **clinical-intelligence hub**: curated, GitHub-tracked clinical knowledge (diagnoses/ICD, drug formulary, lab reference ranges, notifiable-disease list) that powers realistic clinical **alerts** and a single, AI-pluggable conclusion seam. Where all alert types converge.

## Regulatory
- IDSP / IHIP notifiable-disease reporting (Epidemic Diseases Act 1897; NCDC; state P/L/S forms). Programme-specific: Ni-kshay/RNTCP (TB), NLEP (leprosy), NVBDCP (malaria/filaria).
- NABL critical-value reporting (lab).
- Drug safety: NLEM/WHO-EML, AWaRe, NDPS/D&C scheduling (already in `pharmacy_catalog`).

## Data provenance & PHI boundary
Clinical **knowledge** is generated from a de-identified local dataset (`~/Projects/sir/` — NLEM formulary, OPD diagnosis matrices, lab value/rule matrices) by `scripts/build_ckb_seed.py`, which emits **committed** CSV seed files (the GitHub-tracked source + backup). **Never** committed/seeded: real patient records (`patient_registry.json`, OPD registers). The generator reads only Dept/Diagnosis/ICD columns + embedded public-health lists.

## Architecture
- **Global reference** (no `tenant_id`, like `icd10_codes`): `cds_diagnosis_reference` (icd10, name, department, is_notifiable, reporting_body, report_timeframe), seeded from `seed/data/diagnosis_reference.csv` via `seed/ckb.rs` (`include_str!` → idempotent upsert). This is the **committed-data-file → DB** loader pattern the repo previously lacked; reused for formulary + lab CSVs in later PRs.
- **Tenant worklist** (RLS): `notifiable_disease_reports` (pending|submitted|exempted + report_ref + audit).
- **The conclusion seam:** `routes/ckb::flag_notifiable_diagnosis(tx, tenant, patient, encounter, by, icd)` — looks up the reference (exact or ICD-prefix), files a pending report (idempotent per encounter+code), returns the disease for the alert. Called from `opd::create_diagnosis`. **An AI clinical-reasoner can later own/augment this single function** without touching call sites.
- **Alerts** reuse `create_notification` (kind `warning`, category `Notifiable Disease`, action_url `/clinical-kb#reports`).
- **Frontend** `pages/clinical-kb.tsx` — `WorkspaceRail` workspace; Statutory group (Notifiable diseases reference · Reporting worklist with resolve modal). Permissions `P.CKB.{VIEW, REPORTS_LIST, REPORTS_MANAGE}`.

## PR1 (shipped) — files
DB `0185_clinical_knowledge_base.sql`; `scripts/build_ckb_seed.py` + `seed/data/diagnosis_reference.csv` (243 dx, 36 notifiable) + `seed/ckb.rs`; `routes/ckb.rs` (+ mod registration) + `opd.rs` hook; `pages/clinical-kb.tsx` + service + types + api + permissions + nav/route.

## Roadmap
- **PR2 — Formulary seed:** `build_ckb_seed.py` emits `drug_formulary.csv` from `pharmacology.py`; loader upserts CDS columns onto `pharmacy_catalog` (max_dose, dose_per_kg, renal/hepatic/pregnancy, ATC) → **activates the CDS depth layer with real drugs**. CKB Formulary tab.
- **PR3 — Lab reference seed:** `lab_reference.csv` from the lab matrices/category maps → seed `lab_test_catalog` ranges + `critical_value_rules` → realistic critical-value alerts (mechanism exists in `lab.rs`). CKB Lab tab.
- **PR4 — Ingredient combination chemistry:** drug/product ingredient model + admixture/incompatibility alerts (the "combination chemistry" detector) attaching at the same conclusion seam.
- **PR5 — CDS extras:** single-dose-max, CKD-EPI eGFR-from-creatinine, brands / government-medicine expansion; role-grant seeding for `ckb.*`.
- **AI layer:** replace/augment `flag_notifiable_diagnosis` (and future detectors) with an AI reasoner that concludes reportability/severity from the full encounter context.

## Out of scope
Real patient-data ingestion; ICD-11 full library; auto e-filing to the government IHIP/IDSP portal (we produce the worklist + audit).
