# Epic: External-tool integrations (attendance hardware + OPD case sheets)

Pull two reusable assets from sibling local projects into MedBrains. Both were assessed 2026-06-17.

_Source: `/Users/apple/alagappa-tools` (Rust ZKTeco attendance puller) and `/Users/apple/Projects/sir` (OPD case-sheet renderer). Idea-pull only — not the ML handwriting model from sir._

Priority: P2 · Area: area:integration, area:hr · Milestone: M-later

---

## 1. Biometric attendance sidecar (ZKTeco → HR)

> As an **HR admin**, I want faculty/staff biometric punches pulled from on-prem ZKTeco devices into MedBrains automatically, so that attendance is captured without manual entry.

**Source asset:** `alagappa-tools/src-tauri/src/{zkteco_client.rs (1181 lines), device_scanner.rs, erp_sync.rs}` — pure-Tokio ZKTeco TCP/IP client (port 4370), reverse-engineered from pyzk, **no vendor SDK, zero unwrap/expect/panic** (clean for strict clippy). Deps overlap MedBrains (tokio/serde/chrono/reqwest); only `pnet`+`ipnetwork` new (LAN IP detection — can be simplified out).

**Approach:** extract the device core into a new workspace crate `crates/medbrains-attendance` (Tauri-free lib: `connect_and_fetch_attendance(ip,port)`, `scan_network()`, `AttendanceRecord{user_id,timestamp,status,punch,date,time}`, `DeviceInfo`). Add a headless `medbrains-attendance-sync` binary (DeviceBridge surface): config (device IPs, MedBrains API URL, service token, poll interval) → scan/fetch → POST to a new bulk-ingest endpoint. Reuse `erp_sync.rs` POST pattern, re-pointed to MedBrains.

**Stories / acceptance criteria**
- [ ] `medbrains-attendance` crate compiles in the workspace; `cargo clippy` clean (edition 2024, no unwrap/expect/panic); fix the 2 unwraps in `device_scanner.rs`; swap `log`→`tracing`.
- [ ] `POST /hr/attendance/bulk` ingest endpoint — tenant-scoped, service-auth, idempotent (unique tenant+employee+date). Migration `hr_attendance(tenant_id, employee_id, attendance_date, check_in_time, check_out_time, is_present, device_id, synced_at)` with RLS.
- [ ] Device `user_id` → MedBrains `employee_id` mapping (employee `biometric_id` column or a mapping table).
- [ ] `medbrains-attendance-sync` daemon: configurable devices + endpoint + token + interval; retry on failure; structured tracing.
- [ ] HR attendance view (frontend) lists ingested records (read path); contract balanced for `make check-api`.

**Effort:** L (~1–1.5 days). **Maps to:** DeviceBridge deployment surface + HR module.
**Limits to note:** ZKTeco-only (eSSL/Suprema need a protocol trait later); full-fetch (no incremental sync yet); device password support to add.

---

## 2. OPD case-sheet template (printed)

> As a **clinician**, I want an OPD encounter rendered as a formatted printable case sheet, so that the visit can be printed/archived in the standard hospital layout.

**Source asset:** `sir` generates a structured-data → formatted OPD case sheet (bilingual Tamil/English letterhead + clinical sections). **Pull the LAYOUT only**, not the HWT/OneDM handwriting ML (that's synthetic-demo-data only, not production intake).

**Layout to reproduce** (from the sample sheets):
- Letterhead: institution (bilingual), demographics row — PRM/Date/Time/Name/Age/Sex/Department/Doctor.
- Clinical sections: **C/O** (complaints), **H/O** (history), **O/E** (exam + vitals line: BP/PR/RR/SpO2/Temp), **Investigations**, **Diagnosis** (+ ICD), **Rx** (drug · dose · freq · duration), **Review/follow-up**.
- Signature block: doctor name + registration no.

**Approach:** a `document_templates` entry `opd_case_sheet` for the document-render engine (Gotenberg + Tera — see the document-templating plan). Context = existing OPD encounter print-data. No ML.

**Stories / acceptance criteria**
- [ ] `opd_case_sheet` Tera template (A4) rendering an OPD encounter into the layout above.
- [ ] Wired into `DocumentActions` on the OPD encounter (Generate PDF / Print / Download).
- [ ] ICD code shown next to diagnosis (reuse existing WHO ICD-11 integration).

**Effort:** M (~0.5 day, once the document-render engine lands). **Depends on:** unified document-templating engine (separate plan).
**Out of scope:** handwriting generation; OCR/handwriting recognition (sir does neither in production — it generates, not recognizes).

## Later: "No doctors found" + lean into Mantine components

When a doctor picker shows "No doctors found" (e.g. `DoctorSearchSelect`), audit the data source + empty state. More broadly: prefer Mantine's built-in components/patterns (Combobox/Select async, Spotlight, etc.) for the best solution wherever possible, per the custom-component rule in CLAUDE.md + `docs/ACCESSIBILITY.md`. Flagged 2026-06-20.
