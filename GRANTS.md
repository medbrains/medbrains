# MedBrains as a Digital Public Good — funding & public-good thesis

This document is for funders, ministries, health programmes, and anyone deciding whether to support MedBrains. It explains *why* MedBrains is built in the open, what makes it a candidate **Digital Public Good (DPG)**, and how to help.

## The thesis

Hospital software is among the most expensive, most locked-in, least auditable software a health system buys. Proprietary HMS/EHR licences run into crores; the data is trapped in vendor formats; and the very logic that governs patient safety — drug-interaction checks, consent, infection control, statutory reporting — is hidden inside a black box.

The institutions that need good hospital software most — **district hospitals, NGO clinics, public health systems in India and other emerging markets** — can least afford it.

**MedBrains exists to make the safety-critical core of a hospital information system open, inspectable, free to run, and standards-aligned**, so that a public hospital can self-host it, a regulator can audit it, and a developer anywhere can extend it.

## Why it qualifies as a Digital Public Good

The [DPG Standard](https://digitalpublicgoods.net/standard/) asks nine things. MedBrains' status against them:

| DPG criterion | MedBrains |
|---|---|
| 1. Relevance to SDGs | **SDG 3 (Good Health & Well-being)** — directly. |
| 2. Open licence | **Apache-2.0** (OSI-approved) — see [LICENSE](./LICENSE). |
| 3. Clear ownership | Copyright Domnic Amalan S and contributors ([NOTICE](./NOTICE)); contributions signed off under the DCO. |
| 4. Platform independence | Self-hostable; open stack (Rust, PostgreSQL, React); no proprietary runtime. |
| 5. Documentation | Architecture, module RFCs, and contribution docs in-repo. |
| 6. Data extraction / no lock-in | Open PostgreSQL schema; per-patient FHIR R4 Bundle download; CSV exports; documented backups. Whole-hospital FHIR bulk export on the roadmap. |
| 7. Privacy & applicable laws | Multi-tenant RLS, field redaction, audit trails, RBAC; designed for NABH/JCI/ABDM & DPDP. |
| 8. Standards & best practices | ICD-10/11, HL7 v2 (MLLP), DICOM via Orthanc, FHIR R4 (read). LOINC/SNOMED fields present; ABDM M1–M3 in progress. |
| 9. Do-no-harm by design | Patient-safety rules enforced in code; responsible security disclosure ([SECURITY.md](./SECURITY.md)); de-identified-data-only rule for contributors. |

> Action item: formally register MedBrains with the [DPG Alliance](https://digitalpublicgoods.net/submission-guidelines/) once the FHIR export and ABDM integration land (tracked on the [roadmap](./README.md#roadmap)).

## Where funding goes

Grants, sponsorship and paid services (setup, training, hosting, support) fund:

1. **Standards & interoperability** — HL7 FHIR R4, ABDM (ABHA) integration, DICOM.
2. **Compliance depth** — NABH/JCI evidence tracking, statutory reporting (IDSP), clinical coding libraries.
3. **Scale & longevity** — best-in-class PostgreSQL partitioning, retention, and Citus sharding so a hospital can run on this for decades.
4. **Reference deployments** — helping a district hospital or NGO actually go live, and turning that into reusable deployment automation.
5. **Security & audits** — independent security review of health-data paths.

## Programmes we're aligning to

Non-exhaustive; PRs/leads welcome via [Discussions](https://github.com/DomnicAmalan/MedBrains/discussions):

- **DPG Alliance** (UNICEF/UNDP-backed) — DPG registry listing.
- **ABDM / National Health Authority (India)** ecosystem partner programmes.
- **Open-source / FOSS funds** — e.g. NLnet, FOSS sustainability funds, Sovereign Tech Fund-style programmes.
- **Global health philanthropies** — Gates Foundation, Wellcome, Patrick J. McGovern, etc., for digital health infrastructure.
- **GitHub Sponsors / Open Collective** for recurring individual and corporate support (see [`.github/FUNDING.yml`](./.github/FUNDING.yml)).

## Dual-licensing keeps it sustainable

MedBrains is **Apache-2.0**. Everyone uses it free, forever. The team earns only from optional setup, training, hosting and support. Grants accelerate the public-good work that service revenue alone can't cover fast enough.

## The one-paragraph pitch (reuse in applications)

> MedBrains is an open-source, standards-aligned Hospital Management System covering 67+ clinical, diagnostic, financial, and administrative modules, engineered in Rust and PostgreSQL with patient-safety logic (medication checks, consent, infection control, statutory disease reporting) enforced in code rather than hidden in a vendor black box. Licensed under Apache-2.0 and designed against the Digital Public Goods Standard, it lets public hospitals, NGOs, and health ministries in India and other emerging markets deploy, audit, and own their hospital information system without licence lock-in — turning safety-critical health infrastructure into a public good.

---

**Want to fund, pilot, or partner?** Open a [Discussion](https://github.com/DomnicAmalan/MedBrains/discussions) or reach the maintainers via the contact in [SECURITY.md](./SECURITY.md).
