# RFC-MODULE: Prescription rx-suite — research (components + features needed)

**Status:** Research before implementation (user directive: "research what components & features are needed on top of the design"). Build STANDALONE first, wire to pharmacy/OPD later.
**Design source:** claude_design MCP project `5c767ca5-…` `prescription/` — read all role views.

## 1. Component inventory (from the design — what to port)
| Component | Role | Notes |
|---|---|---|
| `PatientCard` (banner) | all | **shipped** — reusable header |
| `RxCompose` | doctor | strength chips · schedule (day-parts + custom times + SOS) · cadence (daily/every-N/weekdays/weekly/monthly) · duration/ongoing · food/timing · note + allergy/scope blocks |
| `RxTable` / `RxLine` | doctor | compact table + prose line renderers (column toggles: brand/salt/timing/notes; density) |
| `SafetyRail` | doctor | live: allergy, interactions, sedation, max-dose, duplicate-therapy |
| `PrescriberToggle` + sign card | doctor | doctor vs nurse scope; pendingMD route; signature block |
| `DispenseSheet` + `DispenseRow` | pharmacist | qty · batch · expiry · stock (in/low/out) · substitute · verify-strip · dispense log (audit) · billing |
| `PatientSchedule` | patient | next-dose hero · day-grid (plain-language + "why") · advice |
| `PrintRx` (A4) | print | letterhead · patient block · Dx · bordered Rx chart (schedule chips) · advice · signature + verify-QR · validity fineprint |
| `InteractionMatrix` + `DoseCalculator` | pharmacology | (not yet read — N×N severity grid + weight/renal dose calc) |
| Formulary KPIs / bars | sales | (analytics — lowest priority) |
| Role switcher (TopBar) | shell | tabs: doctor/pharmacist/pharmacology/sales/patient/print |

## 2. Features needed **on top of** the design (the real gap)
The mockup's formulary is 12 drugs + 6 hardcoded interactions. The live system already carries far more (ccc-confirmed: prescriptions store INN, ATC, drug schedule, AWaRe; DDI/allergy checks logged — `docs/sops/04-pharmacy-dispensing.md`). To be real:

### 2.1 Regulatory drug attributes (MANDATORY — CLAUDE.md §Pharmacology)
- **Drug schedule badge** — Schedule H / H1 / X / G (CDSCO). H1 + X demand a written Rx; **Schedule X → duplicate Rx + register entry**; the writer must surface the badge and the print must show it.
- **NDPS controlled** — controlled substances need the NDPS register + dual-lock; dispensing blocked without a register entry. Flag in formulary + dispense.
- **Generic/INN name + ATC code + RxNorm** — INN is the prescribing standard; some states **mandate generic prescribing** (toggle: show generic-first).
- **AWaRe class** (Access / Watch / Reserve) — antibiotic stewardship badge + consumption reporting.
- **LASA** (look-alike-sound-alike) — tall-man lettering + a confirm step.

### 2.2 Safety engine (replace the 6 hardcoded interactions)
- **DDI** from a real interaction set (`drug_interactions` exists in clinical masters); severity minor/moderate/major/contra; the matrix view.
- **Allergy cross-check** against the patient's actual allergy list incl. **cross-reactivity** (penicillin↔cephalosporin) — the design's penicillin block, generalised.
- **Dose validation** — max adult ceiling, **weight-based mg/kg (pediatric)**, **renal (CrCl) / hepatic adjustment**, the pharmacology dose calculator.
- **Duplicate therapy** (same ATC class), **pregnancy/lactation category**, geriatric caution, **max cumulative** (e.g. paracetamol 4 g/day).

### 2.3 Frequency / dosing completeness (extend the design model)
Design covers day-parts + cadence + SOS + food. Add: **route** (oral/IV/IM/SC/topical/inhaled), **q-frequency** (q4h/q6h/q8h/stat/once), **tapering schedules** (e.g. steroid taper), **PRN max/24h**, **infusion rate** for IV. `rxModel.ts` should grow `route`, `prn_max`, `taper[]`.

### 2.4 Operational / workflow
- **Prescriber scope** — doctor / nurse / intern / resident; **co-sign / countersign** queue (design's pendingMD); supervising-MD assignment.
- **Order sets / Rx templates** — common bundles (URTI pack); favourites per prescriber.
- **Prescription history** + **reconciliation** (IPSG 3) — reuse on visit.
- **Substitution** — generic↔brand, therapeutic substitution with pharmacist permission + reason; **partial dispense + refills** (validity, refills-remaining).
- **Stock-aware** writing — show stock/alternatives at compose time.

### 2.5 e-Prescription + print (regulatory)
- **Digital signature** (the codebase has `signatures.rs` + signed_documents) + **Rx number** + **QR verify** (already in `print_data` / event_tokens).
- **ABDM / NHCX e-Rx** push; validity ("valid for one dispense unless stated"); Schedule-X **red band**; clinic letterhead from facility config; doctor **registration number** (NMC).
- Reuse existing `print_data_clinical` / prescription print rather than a parallel PDF.

## 3. Integration map (phase 2 — when wiring off standalone)
| rx-suite needs | existing source |
|---|---|
| formulary + schedule/INN/ATC/AWaRe/LASA | `pharmacy_catalog` (has drug_schedule, is_controlled, inn_name, atc_code) |
| allergies | patient allergies (`patient_allergies`) |
| DDI | clinical masters `drug_interactions` |
| save / sign Rx | OPD prescriptions + `signatures` |
| dispense / substitute / batch / NDPS | `pharmacy.tsx` dispense + NDPS register |
| print | `print_data_clinical` prescription print + QR (`event_tokens`) |
| e-Rx push | ABDM / NHCX (`abdm/`, `nhcx_callback.rs`) |

## 4. Build phases
1. **Doctor writer** (standalone): port RxCompose + RxTable + SafetyRail + prescriber toggle on the shipped `rxModel` + `PatientCard`; extend the model with **schedule badge, AWaRe, LASA, route** so the regulatory signals are present from day one (even with mock data). Page + role switcher (other roles placeholder).
2. **Pharmacist** dispense/verify/substitute/log + **patient** schedule + **print** (regulatory A4 + QR).
3. **Pharmacology** interaction matrix + dose calculator.
4. **Wire to real data** (§3) + ABDM e-Rx + NDPS register enforcement.

Decisions confirmed: standalone-first; PatientCard reused everywhere (shipped). Open: keep the 6-role switcher as one page vs per-route pages (lean: one `prescription.tsx` with a role switch, deep-linkable).
