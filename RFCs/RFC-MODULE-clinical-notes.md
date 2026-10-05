# RFC — Clinical notes: one case sheet for every setting

Status: DRAFT for approval 2026-10-05. Supersedes the "one editable consultation per visit" model (#4700, #4702) for narrative notes.

## Why

On paper a visit is a sheet of entries, each written, signed, dated and timed
by its author; a second doctor writes below; a mistake is struck through and
initialled, never erased. MedBrains today keeps notes in seven shapes:

| Store | Shape today |
|---|---|
| `consultations` (OPD SOAP) | one row per visit, overwritten by every save (autosave since #4702); only `audit_consultations` knows history |
| `ipd_progress_notes` | per-entry author + date + SOAP + `is_addendum`/`parent_note_id` — closest to right, no sign/lock |
| `er_observation_notes`, `home_progress_notes` | per-entry author, no sign/lock |
| `nursing_shift_notes`, `patient_clinical_notes` | last author only — history lost |
| `tele_consultations.doctor_notes` | free text on the call |
| discharge / death summaries | signed via `signed_records` |

Nobody can answer "who wrote what, when" from the screen.

## How the field does it (research 2026-10-05)

- **Epic**: one note object across inpatient / outpatient / ED / nursing, with a note type and service per encounter. Sign or Pend; a change after signing becomes *Addendum*, re-timestamped; *Cosign Needed* until the attending signs; attribution shows who wrote which portion.
- **Oracle Health (Cerner)**: every note is a `clinical_event` with an event code (type) and result status (in progress, authenticated, modified, superseded, in error). Modify = *Addend* (append) or *Revise* (strikethrough) within a window (30 days non-provider / 180 provider), then addendum only. *In Error* needs a reason and stays visible.
- **FHIR R4**: `Composition` / `DocumentReference` status `preliminary | final | amended | entered-in-error`; attester modes; an addendum is a new document `relatesTo: appends`, a revision `replaces` (old → superseded). LOINC types: 11506-3 progress, 11488-4 consult, 34117-2 H&P, 18842-5 discharge summary, 28570-0 procedure.
- **India**: IMC Regulations 2002 §1.3 (in force again since NMC 2023 was held in abeyance) — records kept 3 years, furnished within 72 h. NABH 5th ed — every entry signed, dated, timed, author identifiable, corrections marked, no overwriting. MoHFW EHR Standards 2016 — immutable once entered, append with full audit trail, digital signature per IT Act, SNOMED CT / LOINC.

## Decisions (product owner, 2026-10-05)

- **One model** for every setting, like Epic/Cerner.
- **Lock on sign**, with a hospital-set **grace period** for revising.
- **Draft visibility** is a hospital setting.

## Model

- `note_types` (per tenant master): code, name, LOINC, category (physician / nursing / allied), sections template (e.g. SOAP, H&P, consult, procedure), roles that need a cosign, encounter kinds allowed. Seeded: Consultation (OPD), Consult opinion, H&P, Progress, Procedure, Nursing, ER observation, Discharge summary, Addendum.
- `clinical_notes`: patient, encounter, encounter kind, note type, service department, author + role, `service_at` (when the care happened), `signed_at`, `locked_at` (= signed + grace), status, cosigner required, `amends_note_id` + relation (appends / replaces), entered-in-error (at, by, reason), `late_entry` (generated: signed − service > tenant threshold, needs a reason), referral link.
- `note_versions` (append-only): sections jsonb `[{code, title, text}]`, saved by/at, content hash. Autosave rewrites the **draft** version only; signing freezes it; a trigger refuses UPDATE/DELETE of a frozen version.
- `note_signatures`: author / cosign / attest / review, attestation text, decision (signed / refused) + comment, linked to the existing `signed_records` (credential, payload hash, signature) — no second signing system.
- Status: `draft → signed → final` (`pending_cosign` between when a cosign is required); within grace the author may *revise* (new version, `revised`); after `locked_at` only an *addendum* (child note, own lifecycle; parent shows `amended`); any → `entered_in_error` (reason; struck through, hidden by default, never deleted). FHIR: draft→preliminary, final→final, revised/amended→amended.
- Settings `notes.*`: `grace_minutes`, `draft_visibility` (author_only / care_team / all_clinical), `late_entry_threshold_hours`, `cosign_roles`, `retention_years` per encounter kind, `require_dsc`.
- Structured findings (HPI, ROS, exam with body sites, vitals, diagnoses) stay structured; each records who and when, and the note can quote them.

## Screens

- **Case sheet** (visit / admission): entries in time order, each a block headed *Consultation — Dr A. Rao, General Medicine, Reg. 12345 · 5 Oct 2026 10:42 · Signed*; drafts marked *Draft — not signed* (per setting); addenda indented under their note; entered-in-error struck through behind a toggle. **New note** picks the type (Consultation, Consult opinion, Progress, Procedure, Nursing…). Writing autosaves the draft; **Sign** locks it; **Revise** shows only within grace; **Addendum** after.
- **Chart review** (patient): every note across visits, filter by type, author, department, status, date.
- **Print**: paper-style case sheet, every author block and signature; files to MRD.
- **Unsigned notes**: the author's worklist; drafts left at visit close / discharge become MRD deficiencies.

## Permissions (Rust first)

`clinical_notes.view`, `clinical_notes.write` (own notes), `clinical_notes.sign`, `clinical_notes.cosign`, `clinical_notes.addend`, `clinical_notes.mark_in_error` (own, or medical records), `clinical_notes.types.manage` (admin). Read is also gated by encounter access (ReBAC); note type category decides who may write (nursing notes by nurses).

## Phases (one PR each, web + server + tests)

1. **Ledger + OPD**: tables, settings, sign / revise-in-grace / addendum / in-error; the OPD Consultation tab becomes the case sheet; existing consultations migrate as signed Consultation notes (author = consultation doctor, service time = created). Cross-consult opinions (referral slice 2) are Consult-opinion notes on the same sheet.
2. **IPD + ER + nursing + home care** onto the ledger (migrate `ipd_progress_notes`, `er_observation_notes`, `nursing_shift_notes`, `home_progress_notes`, `patient_clinical_notes`).
3. **Cosign / attestation** for residents and students; unsigned-note worklist; MRD deficiency on unsigned drafts.
4. **Chart review + paper print to MRD**; FHIR `Composition` export.
5. Native (iOS / Android) case sheet read + write.
