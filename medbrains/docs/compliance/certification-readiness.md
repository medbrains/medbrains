# Certification Readiness

MedBrains is not certified yet. This document is the product hardening map for the certification stack requested by the business team. External auditors, accredited certification bodies, and applicable regulators still decide the final certification or approval status.

## Applicability Rules

Treat each item as one of three kinds:

| Kind | Meaning | Product stance |
| --- | --- | --- |
| Mandatory for India product design | Required when MedBrains operates in India or connects to Indian digital-health rails. | Build into architecture, module workflows, evidence, and release gates. |
| Enterprise assurance / audit | Needed to sell or operate as a trusted SaaS/vendor, but certified by external auditors over a defined scope and period. | Build evidence collection, owners, control mapping, and audit exports. |
| Conditional jurisdiction / medical-device scope | Applies only when handling that market's patients or when software functions become regulated medical-device / SaMD behavior. | Keep a claim gate and classification checklist before enabling or marketing those capabilities. |

## Compliance Center UI

Add an Admin/Compliance Center UI so this readiness work is operational, not only a document.

| UI area | Required behavior |
| --- | --- |
| Standards register | Track ABDM, DPDP, DISHA readiness, MoHFW EHR, NABH Digital Health, ISO 27001, ISO 27701, SOC 2, HIPAA, GDPR, FHIR, HL7 v2, DICOM, ICD-10/11, SNOMED CT, LOINC, ISO 13485, CE/FDA/SaMD, VAPT, and HITRUST applicability. |
| Applicability wizard | Mark standard as mandatory, enterprise-assurance, conditional, not applicable, or future; capture deployment geography, SaaS/on-prem mode, patient origin, AI/SaMD scope, imaging scope, payment scope, and ABDM/NHCX participation. |
| Control matrix | Map every standard to controls, modules, screens, fields, permissions, backend routes, tests, and evidence artifacts. |
| Evidence locker | Upload/link policy docs, screenshots, logs, test reports, sandbox certificates, VAPT reports, audit samples, risk assessments, DPIA/PIA records, and training evidence. |
| Gap dashboard | Show status, owner, due date, severity, blocked reason, latest evidence, and next review date. |
| Module mapping | Surface gaps per module: patient registration, OPD, IPD, emergency, pharmacy, billing, insurance/TPA, MRD, lab, radiology, HR, audit, settings, integrations, mobile/TV/edge. |
| Audit export | Export auditor-ready bundles with control id, evidence id, evidence timestamp, approver, hash/checksum, and change history. |
| Permission model | Gate view/manage/export/evidence-approve separately; sensitive evidence reveals must be audited. |

## Example Control Mapping

Each compliance item should become one or more concrete product/infrastructure controls.

| Standard / area | Example control | Implementation evidence | Recurring evidence |
| --- | --- | --- | --- |
| SOC 2 / ISO 27001 | Patient, audit, document, backup, and log data is encrypted at rest. SOC 2 is an auditor report, not an application license; AICPA content/trademark use is a separate licensing question if embedded in-product. | `docs/compliance/soc2-encryption-at-rest-control-plan.md`, Postgres volume/database encryption setting, object-storage bucket encryption, backup encryption config, log-store encryption config, key management policy, restore test result. | Monthly control screenshot/export, key rotation record, backup restore drill, storage inventory diff, auditor sample. |
| SOC 2 / ISO 27701 / DPDP | Sensitive data is masked, redacted, pseudonymized, or generalized before it reaches users, logs, exports, demos, analytics, AI prompts, integrations, PDFs, or DICOM releases that do not need raw PHI/PII. | `docs/compliance/data-masking-redaction-control-plan.md`, `crates/medbrains-core/src/boundary_filter.rs`, field-access middleware, Aadhaar masked/hash storage, client-error route redaction, `make check-redaction-masking`. | Monthly field-access review, reveal audit sample, export redaction test, demo-data masking run, DICOM/PDF metadata redaction sample. |
| SOC 2 / ISO 27001 | Data is encrypted in transit. | TLS proxy config, HSTS config, internal service TLS/mTLS plan, certificate inventory. | Certificate expiry report, TLS scan, proxy config checksum. |
| SOC 2 / ISO 27001 | Privileged access is approved, time-bound, reviewed, and audited. | IAM access-request route, break-glass workflow, approval policy, audit log events. | Quarterly access review, break-glass review report, revoked-access sample. |
| DPDP / ABDM | Patient consent and withdrawal are captured with purpose, scope, expiry, and evidence. | Consent artifact, consent UI, backend validation, audit events, patient-facing notice. | Consent withdrawal sample, consent export, failed/revoked consent test. |
| NABH Digital Health | Clinical records have patient identifiers, author, timestamp, version, correction reason, and audit trail. | OPD/IPD/MRD case-sheet mapping, document versioning, sign/reprint audit. | Case-sheet completeness report, correction/reprint sample. |
| FHIR / interoperability | Shared clinical data validates against selected FHIR profiles. | FHIR validation output, profile/version register, sample bundles. | Partner exchange test report, validator rerun evidence. |

## Target Tracks

| Track | Current product state | Main gaps before audit |
| --- | --- | --- |
| ABDM sandbox and production integration | HFR, HIP relay, signature verification, ABHA client constants, and FHIR routes exist. | ABDM sandbox milestones/evidence, ABHA/PHR flows, consent artifact flow, HIP/HIU callbacks, revocation evidence, FHIR bundle validation captures, and production-key readiness. |
| DPDP Act 2023 | Privacy-sensitive paths exist for consent, audit, access logging, and document signing. | Data principal notice/consent/legitimate-use register, purpose limitation, consent withdrawal, grievance workflow, breach workflow, retention/deletion/export, processor contracts, children/guardian rules, and significant data fiduciary readiness if applicable. DPDP should not be treated as a blanket data-localization-only task; transfer restrictions and localization must be checked against current rules, ABDM policy, customer contract, and deployment geography. |
| DISHA readiness | No active certification claim should be made. | Track as healthcare-data-readiness because DISHA was a draft health-data law and was later intended to be subsumed into the broader data protection framework. Keep health-data consent, privacy, security, breach, and patient-rights controls mapped for future sector rules. |
| MoHFW EHR Standards for India | ICD/FHIR/DICOM style pieces exist in parts of the product. | Add a standards register for clinical summaries, prescriptions, discharge summaries, lab data, imaging, scanned records, terminology, privacy/security, and interoperability requirements. |
| NABH Digital Health / HIS-EMR | NABH evidence and indicator routes exist; quality, consent, infection control, and document categories are present. | Add NABH Digital Health / HIS-EMR objective-element mapping, evidence capture, test-case execution, non-conformity tracker, and module readiness dashboard. |
| ISO/IEC 27001:2022 | Strong technical controls are present: RLS checks, authz posture checks, audit middleware, tracing checks, region pinning, and egress allowlist checks. | Formal ISMS scope, asset inventory, risk treatment plan, Statement of Applicability, access review records, backup/restore evidence, vendor risk, and incident exercises. |
| SOC 2 Type II | Security, confidentiality, privacy, and availability controls are partially present in code. | Control matrix, evidence owners, change management samples, vulnerability management records, monitoring/SLO evidence, vendor reviews, encryption-at-rest evidence from `docs/compliance/soc2-encryption-at-rest-control-plan.md`, and at least one observation period. |
| ISO/IEC 27701:2025 | Privacy-sensitive paths exist for consent, audit, access logging, and document signing. | Data inventory, purpose register, retention/deletion flows, privacy impact assessments, DPA/BAA templates, breach workflows, and patient export/amendment procedures. |
| HIPAA readiness | PHI access logging and audit patterns are partially present. | HIPAA policies, BAAs, minimum necessary workflow, breach notification procedure, administrative safeguards evidence, and workforce training. Do not market this as HIPAA certified. |
| HITRUST | Foundational security/privacy controls exist. | HITRUST CSF mapping, selected assessment scope, control maturity evidence, third-party assessor process, and remediated VAPT findings. |
| VAPT | Static checks exist, but no external VAPT report is tracked in the repo. | External VAPT report, remediation tracker, retest report, recurring scan cadence, SBOM/dependency scan evidence. |
| NABH/JCI/IPSG | NABH evidence and indicator routes exist; quality, consent, infection control, and document categories are present. | Complete case-sheet evidence mapping, department checklist export, patient safety goal evidence completeness checks, and approval/audit for reprints and corrections. |
| HL7/FHIR interoperability | FHIR routes and fragments exist. | FHIR R4/R5 profile selection, HL7 v2 interface adapter plan, mapping tests, validation reports, and partner conformance evidence. |
| DICOM/PACS | DICOM fixture/demo route exists and must be dev-gated or removed from production. | DICOM storage/query/retrieve plan, PACS connector controls, imaging metadata privacy, modality worklist mapping, viewer audit, and AERB/PCPNDT-sensitive field controls where relevant. |
| ICD-10/ICD-11, SNOMED CT, LOINC | ICD/API work exists; catalog and diagnosis coding are present in parts. | Coding-system source/version register, license checks, mapping/version migration plan, diagnosis/procedure/lab terminology validation, and audit evidence for code changes. |
| Razorpay/POS | Razorpay order/webhook/refund flow and card-log ban checker exist. | Sandbox test-key evidence, webhook replay tests, POS mock-device tests, settlement reconciliation, void/refund approval audit, and receipt/printer simulation. |
| Printer/case sheets | Document and signed-document routes/types exist. | Persistent printer registry, print-job lifecycle, reprint reason and approver, watermark/version controls, and printer mock tests. |
| SaMD/medical-device standards | No certification claim should be made yet. | Intended-use statement, medical software risk file, ISO 14971 hazard analysis, IEC 62304 lifecycle traceability, IEC 82304-1 health software file, IEC 62366 usability validation, IEC 81001-5-1 cybersecurity file, SBOM, and FDA/CE/CDSCO classification. |
| ISO/IEC 42001:2023 | No AI governance evidence file is present yet. | AI system inventory, model risk register, evaluation plan, prompt/model version logging, human override policy, and incident review process. |

## Module Compliance Map

| Module group | Required readiness focus |
| --- | --- |
| Clinical | PHI audit, consent, ICD/FHIR terminology, case sheets, patient identification, clinical safety risk controls, SaMD claim gate. |
| Diagnostics | LOINC/DICOM/FHIR, critical value audit, NABH/NABL evidence, report signing, device integration controls. |
| Pharmacy | Drug scheduling, allergy checks, batch/FEFO, LASA, controlled substance logs, POS billing, payment and audit evidence. |
| Inpatient | MAR, nursing handoff, vitals, OT safety checklist, fall risk, discharge summary, reprint/correction audit. |
| Finance | Razorpay sandbox, POS mock, reconciliation, refunds, receipts, GST/TPA evidence, PCI scope reduction. |
| Operations | Procurement, CSSD, housekeeping, BME, MRD, security, printer devices, asset maintenance, vendor risk evidence. |
| Compliance | NABH/JCI indicators, consent, infection control, audit exports, incident and corrective action evidence. |
| Specialty | Specialty-specific consent, safety checklists, risk scoring, case-sheet templates, coding standards. |
| Admin and Infrastructure | ISO/SOC/HITRUST controls, RBAC, RLS, tenant isolation, logging, deployment, network, backups, access reviews. |
| Mobile/TV/Edge | Offline privacy controls, device registration, secure sync, queue display privacy, printer/edge device audit. |

## Immediate Hardening Sequence

1. Keep `make check-cert-readiness` green as a non-UI compliance map.
2. Implement ABDM ABHA sandbox backend endpoints and sandbox evidence tests.
3. Add Razorpay sandbox and POS mock test harness with webhook replay and settlement evidence.
4. Replace printer stubs with persistent printer registry, print-job audit, and reprint approval.
5. Add case-sheet/NABH evidence completeness checks per clinical workflow.
6. Create SaMD intended-use and risk files before any diagnostic, treatment, monitoring, or autonomous clinical claim.
7. Create ISO 27001/SOC 2/27701/HITRUST evidence registers and assign owners/frequencies.
8. Add AI governance documents before enabling any AI clinical workflow.
9. Build the Compliance Center UI with standards register, applicability wizard, control matrix, evidence locker, gap dashboard, and audit export.
10. Add official-source refresh dates for every regulatory item so legal/current-state changes are reviewed before release.

## Official Source Register

Use official or standards-owner sources when updating this file:

| Area | Source |
| --- | --- |
| ABDM / HFR / HPR / sandbox | `https://abdm.gov.in`, `https://facility.abdm.gov.in`, `https://doctorsbx.abdm.gov.in` |
| DPDP Act | `https://www.indiacode.nic.in/indiacode/handle/123456789/22037` |
| DISHA draft/status | `https://www.mohfw.gov.in/?q=en/newshighlights/comments-draft-digital-information-security-health-care-actdisha`, PIB release on DISHA being submitted to MeitY |
| MoHFW EHR Standards | `https://www.mohfw.gov.in/sites/default/files/EMR-EHR_Standards_for_India_as_notified_by_MOHFW_2016.pdf` |
| NABH Digital Health / HIS-EMR | `https://nabh.co/programmes/digital-health-accreditation-programme/`, `https://nabh.co/apply-for-software-certification/` |
| ISO standards | `https://www.iso.org/standard/27001`, `https://www.iso.org/standard/85819.html`, `https://www.iso.org/standard/59752.html` |
| SOC 2 / AICPA Trust Services Criteria | `https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022`, `https://www.aicpa-cima.com/cpe-learning/publication/soc-2-reporting-on-an-examination-of-controls-at-a-service-organization-relevant-to-security-availability-processing-integrity-confidentiality-or-privacy`, `https://www.aicpa-cima.com/resources/landing/licensing-for-teams` |
| Storage encryption / key management | `https://csrc.nist.gov/pubs/sp/800/111/final`, `https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final` |
| Data masking / redaction / de-identification | `https://csrc.nist.gov/pubs/sp/800/122/final`, `https://csrc.nist.gov/pubs/sp/800/188/final`, `https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html`, `https://eur-lex.europa.eu/eli/reg/2016/679/oj` |
| HIPAA | `https://www.hhs.gov/hipaa/for-professionals/security/index.html` |
| GDPR | `https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en` |
| HL7 FHIR | `https://hl7.org/fhir/` |
| DICOM | `https://www.dicomstandard.org/about` |
| ICD | `https://www.who.int/standards/classifications/classification-of-diseases` |
| SNOMED CT | `https://docs.snomed.org/` |
| FDA SaMD/CDS | `https://www.fda.gov/medical-devices/software-medical-device-samd` |

## Static Check

Run:

```sh
make check-cert-readiness
```

For future release gates, use:

```sh
python3 ../scripts/check_cert_readiness.py --strict
```

Strict mode is expected to fail until the missing audit evidence and implementation gaps are closed.
