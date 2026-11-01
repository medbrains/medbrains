# MedBrains as a digital public good

This page is for funders, ministries, health programmes and anyone deciding whether to support MedBrains. It explains why MedBrains is built in the open, why it is a candidate **Digital Public Good (DPG)**, and how to help.

## The case

Hospital software is expensive, hard to leave and hard to audit. Proprietary HMS and EHR licences cost crores. The data sits in vendor formats. The logic that governs patient safety, such as drug-interaction checks, consent, infection control and statutory reporting, cannot be inspected.

The hospitals that need good software most can least afford it: district hospitals, NGO clinics and public health systems around the world.

MedBrains makes the safety-critical core of a hospital information system open to inspection, free to run and aligned with health standards. A public hospital can host it themselves, a regulator can audit it, and any developer can extend it.

## Against the DPG Standard

The [DPG Standard](https://digitalpublicgoods.net/standard/) has nine criteria. Where MedBrains stands on each:

| DPG criterion | MedBrains |
|---|---|
| 1. Relevance to SDGs | SDG 3 (good health and well-being). |
| 2. Open licence | Apache-2.0 (OSI-approved). See [LICENSE](./LICENSE). |
| 3. Clear ownership | Copyright Domnic Amalan S and contributors ([NOTICE](./NOTICE)). Contributions are signed off under the DCO. |
| 4. Platform independence | Self-hostable on an open stack (Rust, PostgreSQL, React). No proprietary runtime. |
| 5. Documentation | Architecture, module RFCs and contribution docs are in the repository. |
| 6. Data extraction and no lock-in | Open PostgreSQL schema, per-patient FHIR R4 Bundle download, CSV exports and documented backups. Whole-hospital FHIR bulk export is on the roadmap. |
| 7. Privacy and applicable laws | Multi-tenant row-level security, field redaction, audit trails and RBAC. Designed for NABH, JCI, ABDM and DPDP. |
| 8. Standards and best practices | ICD-10/11, HL7 v2 (MLLP), DICOM via Orthanc, FHIR R4 (read). LOINC and SNOMED fields are present. ABDM M1–M3 is in progress. |
| 9. Do no harm by design | Patient-safety rules are enforced in code. Security issues are disclosed responsibly ([SECURITY.md](./SECURITY.md)). Contributors may use de-identified data only. |

> Next step: register MedBrains with the [DPG Alliance](https://digitalpublicgoods.net/submission-guidelines/) once FHIR export and ABDM integration land (tracked on the [roadmap](./README.md#roadmap)).

## Where funding goes

Grants, sponsorship and paid services (setup, training, hosting, support) pay for:

1. **Standards and interoperability:** HL7 FHIR R4, ABDM (ABHA) integration, DICOM.
2. **Compliance depth:** NABH and JCI evidence tracking, statutory reporting (IDSP), clinical coding libraries.
3. **Scale and longevity:** PostgreSQL partitioning, retention and Citus sharding, so a hospital can run on it for decades.
4. **Reference deployments:** helping a district hospital or NGO go live, and turning that work into reusable deployment automation.
5. **Security audits:** independent security review of the paths that handle health data.

## Programmes we are aligning with

This list is not complete. Suggestions and leads are welcome in [Discussions](https://github.com/medbrains/medbrains/discussions).

- **DPG Alliance** (UNICEF and UNDP backed): listing on the DPG registry.
- **ABDM / National Health Authority**: ecosystem partner programmes.
- **Open-source funds**, for example NLnet, FOSS sustainability funds and programmes like the Sovereign Tech Fund.
- **Global health philanthropies**, such as the Gates Foundation, Wellcome and the Patrick J. McGovern Foundation, for digital health infrastructure.
- **GitHub Sponsors and Open Collective** for recurring support from individuals and companies (see [`.github/FUNDING.yml`](./.github/FUNDING.yml)).

## How it pays for itself

MedBrains is licensed under Apache-2.0 and is free for everyone to use. The team earns only from optional setup, training, hosting and support. Grants speed up the public-good work that service income cannot cover on its own.

## Short description for applications

> MedBrains is an open-source hospital management system built in Rust and PostgreSQL, designed to cover 67+ clinical, diagnostic, financial and administrative modules. Patient-safety logic (medication checks, consent, infection control, statutory disease reporting) is enforced in code that anyone can read. It is licensed under Apache-2.0 and designed against the Digital Public Goods Standard, so public hospitals, NGOs and health ministries anywhere can deploy, audit and own their hospital information system without licence lock-in.

---

**Want to fund, pilot or partner?** Open a [Discussion](https://github.com/medbrains/medbrains/discussions) or contact the maintainers through the address in [SECURITY.md](./SECURITY.md).
