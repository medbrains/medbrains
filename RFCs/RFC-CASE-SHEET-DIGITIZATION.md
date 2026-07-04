# RFC — Handwritten Case-Sheet Digitization

Status: DRAFT · Owner: platform + clinical · Related: MRD-paperless program, AI clinical copilot (multimodal)

## 1. Problem
Most Indian hospitals still run on **handwritten paper case sheets** — admission notes, progress
notes, discharge summaries, vitals charts. They're the legal clinical record but are unsearchable,
un-analyzable, easily lost, and don't feed the EMR/AI. Digitizing them unlocks MRD-paperless, coding,
analytics, and the copilot. The catch: **OCR of clinical handwriting is patient-safety-critical** — a
misread "5.0 mg" as "50 mg" can kill. So this is *assisted digitization with a doctor in the loop*,
never blind auto-filing.

## 2. Non-goals
- Not auto-filing extracted data into the EMR without human verification.
- Not replacing structured data entry going forward (this is for *legacy paper* + hybrid wards).
- Not a general document store (that's MRD); this is the *extract-to-structured* layer.

## 3. Approach — on-prem, two-stage, human-verified
We do **not** send PHI to a cloud OCR. Both stages run **on-prem**:

1. **Layout / segmentation — MinerU** (self-hostable, "Private · Fully Offline", CPU-capable). Splits a
   scanned/photographed page into regions (header, sections, tables/vitals, signature block) and reading
   order → structured Markdown/JSON. Strong on *printed* forms + tables (most case sheets are a printed
   template with handwritten fills).
2. **Handwriting recognition — a VLM** (the on-prem `qwen3-vl` already in the AI stack, or a medical HTR
   model). MinerU's OCR is printed-oriented; the VLM reads the *handwritten* cells/notes within each
   region and returns text **with a per-field confidence**. This split (MinerU = where, VLM = what)
   beats either alone on template-with-handwriting pages.

Output = a **structured draft**: `{ field, value, confidence, region_bbox }[]` + the source image.

## 4. The safety spine (non-negotiable)
- **Never auto-commit.** Extraction produces a DRAFT only; nothing enters the EMR until a clinician
  reviews and commits.
- **Confidence-flagged.** Low-confidence fields are visually flagged; **medication/dose fields always
  require explicit confirmation** regardless of confidence.
- **Scan is the source of truth.** The original image is stored and shown side-by-side; the extracted
  text is an *aid*, and the image is retained as the legal record.
- **Full audit.** Who scanned, who reviewed, what was corrected, when committed — every field's
  original-vs-final value.
- **Fail safe.** Parse failure / low overall confidence → the sheet still lands as an image-only MRD
  document (no data loss), flagged for manual entry.

## 5. Architecture
```
[scan/photo upload] → object store (encrypted)      ─┐
        │                                            │  case_sheet_scans row (status=uploaded)
        ▼                                            │
[ingestion worker] MinerU (layout) → VLM (HTR)  ─────┤  status=parsed, extracted_json + confidence
        │                                            │
        ▼                                            │
[doctor review UI]  image  ⇄  editable fields   ─────┤  status=reviewing
        │  (correct + confirm)                       │
        ▼                                            │
[commit] → EMR (encounter note / structured fields) ─┘  status=committed, audit trail
```
- Ingestion is **async** (worker/outbox) — parsing takes seconds-to-minutes; the UI polls/streams status.
- On-prem models via the existing AI provider seam (Ollama/vLLM); no PHI egress.

## 6. Data model (B2)
`case_sheet_scans` (tenant-scoped, RLS):
- `id, tenant_id, patient_id, encounter_id?, uploaded_by, image_object_key`
- `status` (uploaded | parsing | parsed | reviewing | committed | failed | image_only)
- `doc_type` (admission | progress | discharge | vitals | other)
- `extracted_json` jsonb (`{fields:[{key,value,confidence,bbox}], raw_markdown}`)
- `overall_confidence` numeric, `parse_error` text?
- `reviewed_by?, committed_by?, committed_entity_type?, committed_entity_id?`, timestamps
- Audit via the standard AuditLogger (scan/parse/review/commit + per-field corrections).

## 7. Regulatory / privacy
- **On-prem only** — no third-party OCR; PHI never leaves the building (aligns with the whole platform).
- **Retention** — the source image is the retained legal record (MRD retention rules); extracted data is
  derived.
- **Consent/access** — same RLS + break-glass + audit as all clinical records.
- Extracted diagnoses/drugs, once committed, flow through the normal coding/DDI/NDPS checks — the
  digitizer does not bypass clinical safety gates.

## 8. Phasing
- **B1 (this RFC)** — design + safety spine. ✅
- **B2 — ingestion backend**: upload endpoint → `case_sheet_scans` → async MinerU+VLM worker → structured
  draft. Stand up MinerU on-prem (docker, offline) behind a small internal parse service; wire the VLM via
  the existing AI seam. Nothing auto-commits.
- **B3 — doctor review-and-commit UI**: side-by-side image + confidence-highlighted fields; correct +
  confirm (dose fields hard-gated) → commit to the EMR with full audit.
- **Later** — templates per hospital form, batch scanning, active-learning from corrections, coding assist.

## 9. Open questions (decide before B2)
- Which commit target for the first cut — a free-text encounter note, or structured vitals/diagnosis fields?
  (Recommend: start with a **progress/admission note** as verified rich text + attached image; structured
  fields follow.)
- MinerU deployment footprint on the target hardware (CPU pipeline vs GPU VLM) — sizing for a hospital box.
- HTR model choice: `qwen3-vl` (already present) vs a dedicated medical HTR — benchmark on real sheets.
