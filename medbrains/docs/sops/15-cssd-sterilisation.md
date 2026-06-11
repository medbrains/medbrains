---
module: cssd-sterilisation
priority: P2
status: draft
---

# SOP: CSSD — Central Sterile Supply Department

## Overview
CSSD manages the decontamination, sterilisation, and distribution of reusable surgical instruments and medical devices. The workflow: soiled instruments returned from OT/wards → decontamination → cleaning → packing → sterilisation (autoclave/ETO/plasma) → sterility testing → distribution to OT/departments. Every cycle is documented with batch, cycle number, sterilisation parameters, and operator ID. Integration with OT (instrument set requests), IPD/wards (procedure tray requests), and procurement (consumables like pouches, chemical indicators).

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `cssd_technician` | Decontamination, packing, cycle loading, result recording, issue | Primary operational actor |
| `ot_staff` | Request sterile instrument sets, return soiled sets | Consumes sterile output |
| `facilities_manager` | Equipment maintenance scheduling, QC review | Supervisory |
| `infection_control_officer` | Review sterilisation cycle logs, BD test results | Read-only audit |

---

## Scenario 1: CSSD Tech Processes Soiled Instruments and Loads Autoclave — Actor: CSSD Technician

**Actor**: `cssd_technician`  
**Entry point**: CSSD → Soiled Receiving  
**Preconditions**: Soiled instrument sets returned from OT/wards in sealed, labelled containers

**Steps**:
1. Tech receives soiled container; records originating department, instrument set name, and return time.
2. Decontamination: instruments placed in washer-disinfector; cycle run and logged (temperature, time).
3. Inspection after wash: checks for visible soil, function (hinges, tips), and completeness against set checklist.
4. Damaged instruments quarantined; replacement flagged to procurement.
5. Packing: instruments wrapped per CSSD protocol (double wrap or pouch); chemical indicator inserted inside pack.
6. External indicator (tape) applied; pack labelled: set name, contents count, date, tech ID, expiry (shelf life = sterilisation date + 3 months or per packaging standard).
7. Loads autoclave (or ETO/plasma chamber for heat-sensitive devices); records load configuration.
8. Runs cycle; records cycle number, temperature, pressure, time, and physical/chemical indicator results.
9. Bowie-Dick (BD) test run on first load of each day; result recorded and must pass before patient loads.

**Exit / Outcome**: Sterilised packs ready for distribution; cycle log complete with all parameters; BD test passed.  
**Regulatory note**: NABH CSSD.1 — sterilisation validation documented; ISO 17665 (steam sterilisation) / ISO 11135 (ETO); BD test mandatory daily (NABH); AERB — ETO registration required.  
**Existing test**: `apps/web/e2e/crud/cssd.spec.ts` (partial); `— needs full cycle-to-issue journey test`

---

## Scenario 2: CSSD Tech Issues Sterile Set to OT — Actor: CSSD Technician

**Actor**: `cssd_technician`  
**Entry point**: CSSD → Issue Queue (OT request pending)  
**Preconditions**: OT has raised a sterile instrument set request; sets are sterilised and available

**Steps**:
1. Tech opens issue request from OT; sees set name, surgery type, and required time.
2. Picks sterile pack from storage; checks integrity (no tears, seal intact, chemical indicator changed colour).
3. Checks expiry date.
4. Scans barcode or manually records pack batch number and sterilisation cycle.
5. Issues pack to OT runner; records issue time, recipient name, and destination OT room.
6. OT records receipt; pack used and linked to surgical case.
7. After surgery: soiled set returned to CSSD, completing the loop.

**Exit / Outcome**: Sterile set traceable from cycle to surgical case; chain of custody complete.  
**Regulatory note**: NABH CSSD.3 — sterile items traceable to patient use; recall capability — if cycle failure identified, all packs from that cycle are recalled.  
**Existing test**: `— needs test`

---

## Scenario 3: Infection Control Officer Reviews Sterilisation Compliance — Actor: ICO

**Actor**: `infection_control_officer`  
**Entry point**: Infection Control → CSSD Reports (read-only)  
**Preconditions**: CSSD cycle logs exist for review period

**Steps**:
1. ICO opens CSSD compliance dashboard; views:
   - BD test pass rate for the period.
   - Biological indicator (spore test) results (weekly or per protocol).
   - Any failed cycles and what actions were taken (recall, re-sterilisation).
   - Volume of sets processed vs OT caseload.
2. Flags any trends (e.g., repeated BD failures on specific autoclave) for facilities manager action.
3. Documents review in ICO log; escalates critical failures to hospital admin.

**Exit / Outcome**: CSSD compliance documented in ICO log; corrective action triggered if needed.  
**Regulatory note**: NABH IC.6 — CSSD audit part of infection control programme; biological indicator test frequency per sterilisation standard.  
**Existing test**: `— needs test`
