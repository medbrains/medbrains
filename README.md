<div align="center">

# MedBrains

### Open-source Hospital Management System — built as health infrastructure, not a product demo.

A multi-tenant HMS covering **67+ clinical, diagnostic, financial and administrative modules**, engineered for the safety, compliance and scale a real hospital demands. Rust on the backend, React on the front, regulatory rules baked in from the schema up.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-1F4332.svg)](./LICENSE)
[![Commercial license available](https://img.shields.io/badge/Commercial_license-available-B8924A.svg)](./COMMERCIAL-LICENSE.md)
[![Rust](https://img.shields.io/badge/Rust-2024_·_MSRV_1.85-CE412B?logo=rust&logoColor=white)](#tech-stack)
[![React](https://img.shields.io/badge/React-18_·_TypeScript-149ECA?logo=react&logoColor=white)](#tech-stack)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-success.svg)](./CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/Code_of_Conduct-2.1-5B4BC4.svg)](./CODE_OF_CONDUCT.md)

[**Why MedBrains**](#why-medbrains) · [**Features**](#features) · [**Architecture**](#architecture) · [**Quickstart**](#quickstart) · [**Compliance**](#regulatory--compliance) · [**Roadmap**](#roadmap) · [**Contributing**](#contributing) · [**Funding**](./GRANTS.md)

</div>

---

> [!NOTE]
> **MedBrains is positioned as a Digital Public Good for health.** Hospital software is some of the most expensive, most locked-in, least auditable software a country buys — and the institutions that need it most (district hospitals, NGO clinics, public health systems) can least afford the licence fees. We think the patient-safety logic of a hospital (medication checks, consent, infection control, statutory reporting) should be **open, inspectable, and free to run**. See [GRANTS.md](./GRANTS.md) for the public-good thesis and the programs we're aligning to.

## Why MedBrains

Most HMS products are closed boxes: you can't see how they decide a drug interaction, you can't audit how patient data flows, and you can't extend them without a vendor contract. MedBrains is the opposite:

- **Patient safety is in the code, not the brochure.** Drug-schedule enforcement (NDPS / Schedule H/H1/X), allergy & DDI cross-checks, LASA flags, dose validation, the WHO surgical checklist, critical-value lab alerts and notifiable-disease (IDSP) reporting are implemented as enforced rules — not optional add-ons.
- **Compliance-first schema.** Regulatory fields exist from the first migration: `drug_schedule`, `inn_name`, `atc_code`, `loinc_code`, `icd_code`, RLS `tenant_id` on every tenant-scoped table. NABH / JCI / ABDM alignment is a design constraint, not a retrofit.
- **Multi-tenant by construction.** PostgreSQL Row-Level Security with per-request, transaction-scoped tenant context — one deployment safely serves many hospitals.
- **Built to be run cheaply and audited freely.** Compile-time-checked SQL, strict linting, a small Rust footprint, and a fully open stack mean a district hospital can self-host it and a security researcher can read every line.

## Features

67+ modules across the hospital. A selection of what's implemented or in active development:

| Domain | Modules |
|--------|---------|
| **Clinical** | OPD, IPD/nursing (eMAR, IV infusions), perioperative (WHO checklist, OT handoffs), telemedicine, prescriptions (rx-suite), clinical knowledge base |
| **Diagnostics** | Laboratory (LOINC, critical-value alerts, NABL), radiology (DICOM, AERB/PCPNDT), blood bank |
| **Pharmacy** | Formulary/DTC, NDPS register + dual-lock, AWaRe stewardship, FEFO expiry, batch/lot tracking, dead-stock & indents |
| **Financial** | Billing (GST, CGHS/ECHS, TPA), multi-provider payments, insurance revenue integrity, cashier flows |
| **Administrative** | Multi-tenant onboarding, 111-permission RBAC, roles & per-user overrides, HR shift sessions & fatigue guard, MRD (paperless, deficiency gate, ROI) |
| **Quality & Safety** | Incident/CAPA, RCA, accreditation compliance, notifiable-disease (IDSP) reporting, consent management (digital signatures, witness, read-aloud) |
| **Surfaces** | Web console, mobile (React Native), TV queue/status displays, kiosk/workstation |

> The full module ledger (2,030+ tracked features across 12 domains) lives in the feature tracker and per-module RFCs.

## Architecture

```
┌─────────────┐   ┌─────────────┐   ┌──────────────┐
│  Web (React │   │   Mobile    │   │  TV / Kiosk  │
│  + Mantine) │   │ (RN + Paper)│   │ (RN Android) │
└──────┬──────┘   └──────┬──────┘   └──────┬───────┘
       └─────────────────┼─────────────────┘
                   HTTPS / JSON
                         │
              ┌──────────▼───────────┐
              │  Axum 0.8 + Tower    │  Rust, edition 2024
              │  JWT (Ed25519)       │  Argon2id, RBAC
              │  Per-request RLS ctx │  111 permissions
              └──────────┬───────────┘
                         │
              ┌──────────▼───────────┐   ┌──────────────┐
              │   PostgreSQL 16+     │   │ object store │
              │   single source of   │   │ (DICOM/PDF/  │
              │   truth · RLS · SQLx │   │  scans/blobs)│
              │   partition + shard  │   └──────────────┘
              │   ready (Citus path) │
              └──────────────────────┘
```

**Key patterns:** multi-tenancy via PostgreSQL Row-Level Security (keyed on `tenant_id`, which is also the future Citus shard key) · declarative range-partitioning + retention for high-volume clinical/audit tables · JSONB-defined workflow engine · compile-time-checked SQL (SQLx) · a typed permission system shared between backend enforcement and frontend visibility. Large binaries (DICOM, scans, PDFs) live in object storage, never in the database.

### Tech stack

| Layer | Technology |
|-------|------------|
| Backend | **Rust** (edition 2024, MSRV 1.85), Axum 0.8 + Tower, Tokio, SQLx, `thiserror`/`anyhow`, `tracing` |
| Auth | JWT (Ed25519), Argon2id, transaction-scoped Row-Level Security |
| Database | PostgreSQL 16+ — single source of truth; declarative partitioning + retention, Citus-ready sharding by `tenant_id` for scale |
| Web | React 18 + TypeScript, Vite, **Mantine v7**, SCSS, TanStack Query, Zustand, React Hook Form + Zod |
| Mobile / TV | React Native (New Architecture) + Paper v5; React Native for Android TV |
| Tooling | pnpm + Turborepo, Biome (lint/format), compile-time SQL, response compression |

## Quickstart

> **Prerequisites:** Rust 1.85+, Node 20+, pnpm, Docker (for PostgreSQL).

```bash
# 1. Clone
git clone https://github.com/DomnicAmalan/MedBrains.git
cd MedBrains/medbrains

# 2. Start the database (PostgreSQL 16)
docker compose up -d

# 3. Backend (migrations apply automatically on startup)
make dev-backend          # Axum server on :8080

# 4. Frontend
pnpm install
pnpm --filter=@medbrains/web dev   # Vite dev server on :5173
```

The default seed creates a `super_admin` account for local development. Production deployments **must** set `MEDBRAINS_SEED_ADMIN_PASSWORD` and the JWT signing keys — the server refuses default credentials when `MEDBRAINS_ENV=production`.

See [`medbrains/CLAUDE.md`](./medbrains/CLAUDE.md) for the full architecture, coding standards, and module build workflow, and the [`RFCs/`](./medbrains/RFCs) directory for module specifications.

## Regulatory & compliance

MedBrains treats compliance as a first-class engineering concern. Implemented or scaffolded:

- **Indian law:** NDPS Act 1985, Drugs & Cosmetics Act 1940 (Schedule H/H1/X/G), Clinical Establishments Act, PCPNDT, MTP, Mental Healthcare Act 2017, BMW Rules 2016.
- **Accreditation:** NABH / JCI checklists (34 department checklists, 700+ criteria); IPSG patient-safety goals.
- **Clinical coding:** ICD-10/11 (diagnoses), LOINC (labs), ATC + INN + RxNorm (drugs), CPT (procedures).
- **Interoperability:** HL7 FHIR R4, ABDM Health ID, DICOM, HL7 v2 (planned/partial).
- **Statutory reporting:** notifiable-disease (IDSP/IHIP) worklist + audit trail.

Security disclosures: see [SECURITY.md](./SECURITY.md). MedBrains is health software — please report vulnerabilities privately.

## Roadmap

- [x] Multi-tenant core, RBAC (111 permissions), auth (Ed25519 JWT)
- [x] OPD, billing, lab, pharmacy, IPD/nursing, perioperative
- [x] Telemedicine, consent management, MRD, quality/CAPA
- [x] Clinical knowledge base + notifiable-disease reporting
- [ ] HL7 FHIR R4 export/import surface
- [ ] ABDM (ABHA) full integration
- [ ] Compliance dashboard (NABH/JCI evidence tracking)
- [ ] AI clinical-decision-support conclusion layer (pluggable, audited)

Track progress in [Issues](https://github.com/DomnicAmalan/MedBrains/issues) and [Discussions](https://github.com/DomnicAmalan/MedBrains/discussions).

## Contributing

We welcome contributions — from a typo fix to a whole module. Start with [CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md). Because MedBrains is dual-licensed, contributors sign off on the [Contributor License Agreement](./CLA.md) (a one-time, automated check on your first PR).

Good first issues are labelled [`good first issue`](https://github.com/DomnicAmalan/MedBrains/labels/good%20first%20issue).

## License

MedBrains is **dual-licensed**:

- **[GNU AGPL-3.0](./LICENSE)** — free to use, study, modify and self-host. If you run a modified version as a network service, you must share your modifications under the same licence.
- **[Commercial license](./COMMERCIAL-LICENSE.md)** — for hospitals, vendors or SaaS providers who cannot meet the AGPL's source-sharing obligation. This funds continued open development.

If you're a public hospital, NGO or government health programme, the AGPL costs you nothing. If you're embedding MedBrains in a closed commercial product, [talk to us](./COMMERCIAL-LICENSE.md).

## Funding & public-good status

MedBrains is built to qualify as a **Digital Public Good**. If you represent a funder, ministry, or health programme, see [GRANTS.md](./GRANTS.md) for the thesis, eligibility status, and how to support the project. Individual sponsors: see [`.github/FUNDING.yml`](./.github/FUNDING.yml).

---

<div align="center">
<sub>Built in the open for hospitals that can't afford to be locked in. ⭐ Star the repo if you believe health software should be a public good.</sub>
</div>
