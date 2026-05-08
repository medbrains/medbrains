# MedBrains Regulatory Evidence Map

Date: 2026-05-03

Purpose: map major regulations and standards to the MedBrains modules that must capture evidence.

This is not legal advice. It is an engineering control map for product implementation and audit readiness.

## NABH / JCI Patient Safety

Modules:

- OPD
- Emergency
- IPD
- ICU
- OT
- Nursing
- Lab
- Radiology
- Pharmacy
- Blood bank
- MRD
- Quality

Required evidence:

- two-identifier patient verification.
- medication safety checks.
- surgical safety checklist.
- critical value notification.
- fall risk and fall register.
- pressure ulcer risk and assessment.
- infection control surveillance.
- transfusion reaction log.
- incident/sentinel event register.
- discharge and mortality review.

Backend enforcement:

- block high-risk actions when patient identity is ambiguous.
- require allergy/interaction override reasons.
- require OT sign-in/time-out/sign-out.
- require acknowledgement and escalation for critical values.

UI indicators:

- allergy badge.
- MLC badge.
- fall risk badge.
- isolation/infection-control badge.
- pending consent badge.
- critical alert banner.

## DPDP Act 2023

Modules:

- Admin
- Audit
- Consent
- Patients
- MRD
- Offline packs
- Patient app
- Reporting

Required evidence:

- consent/purpose record.
- data principal request.
- erasure/correction request.
- breach register.
- 72-hour notification timer evidence.
- DPO registry.
- DPIA records.
- PHI read/write audit.

Backend enforcement:

- field-level redaction at export boundaries.
- retention-aware erasure cascade.
- audit every PHI access.
- deny export without permission and purpose.

UI indicators:

- consent status.
- restricted/export-controlled fields.
- pending data request.
- breach workflow status.

## ABDM / FHIR

Modules:

- Patient registration
- Consent
- OPD
- Lab
- Radiology
- Pharmacy
- IPD discharge
- Billing
- Documents

Required evidence:

- ABHA/Health ID linkage.
- consent request.
- consent grant/revoke callbacks.
- FHIR-compatible patient, encounter, prescription, diagnostic report, discharge summary, invoice, and document bundle.

Backend enforcement:

- validate resource shape before exchange.
- log consent grant usage.
- prevent export without active consent.

UI indicators:

- ABHA linked/unlinked.
- consent requested/granted/revoked.
- exchange success/failure.

## Drugs And Cosmetics / CDSCO / NDPS

Modules:

- Pharmacy
- CPOE/CDS
- Procurement
- Inventory
- Billing
- eMAR

Required evidence:

- CDSCO drug schedule.
- Schedule H/H1/X classification.
- controlled-substance flag.
- NDPS register.
- dual-witness dispensing/destruction.
- batch/lot traceability.
- expiry/FEFO.
- supplier license.

Backend enforcement:

- block Schedule X/NDPS flow without required witness evidence.
- block expired batch dispense.
- enforce FEFO selection or override.
- block PO from expired/unlicensed supplier.

UI indicators:

- Schedule H/H1/X badge.
- NDPS/controlled badge.
- LASA badge.
- expiry warning.
- witness-required warning.

## WHO Medication Safety / AWaRe / INN / ATC / RxNorm

Modules:

- Pharmacy catalog
- CPOE/CDS
- OPD
- IPD
- ICU
- eMAR
- Quality

Required evidence:

- generic INN name.
- ATC classification.
- RxNorm code where available.
- AWaRe class.
- antibiotic consumption report.
- allergy check log.
- interaction check log.
- ADR report.

Backend enforcement:

- Reserve antibiotic role restriction.
- allergy/interaction checks before order acceptance.
- dose validation by age, weight, renal/hepatic function.

UI indicators:

- AWaRe Access/Watch/Reserve badge.
- allergy conflict modal.
- interaction severity warning.
- ADR reporting shortcut.

## PCPNDT

Modules:

- Radiology
- Registration
- Documents
- Audit
- Regulatory

Required evidence:

- Form F.
- radiologist signature.
- ultrasound equipment registration Form A/B.
- quarterly summary.
- restricted field/content audit.

Backend enforcement:

- block prohibited sex-determination language.
- require Form F for applicable USG.
- require authorized radiologist signature.

UI indicators:

- PCPNDT-required badge.
- missing Form F warning.
- prohibited-content block message.

## MTP

Modules:

- OPD
- OT
- Consent
- Documents
- Regulatory
- MRD

Required evidence:

- Form II consent.
- Form III register.
- gestational age.
- required doctor opinion.
- medical board decision where applicable.

Backend enforcement:

- block workflow if gestational-age threshold evidence is incomplete.
- require consent and opinion before procedure state transition.

UI indicators:

- legal-gate pending badge.
- consent/opinion completion status.

## AERB / Radiation Safety

Modules:

- Radiology
- BME
- HR
- Regulatory

Required evidence:

- RSO registry.
- equipment QA and certification.
- occupational dose log.
- patient dose record where applicable.
- equipment downtime.

Backend enforcement:

- block equipment use if QA/certification expired.
- alert if occupational dose exceeds configured threshold.

UI indicators:

- equipment certification status.
- dose warning.
- RSO approval required badge.

## NABL / Laboratory Quality

Modules:

- Lab
- Quality
- Documents
- BME

Required evidence:

- IQC records.
- Westgard rule result.
- EQAS results.
- calibration log.
- SOP version and acknowledgement.
- specimen rejection log.
- critical value notification TAT.

Backend enforcement:

- flag/restrict result release after failed quality checks according to policy.
- escalate unacknowledged critical values.

UI indicators:

- IQC pass/fail.
- critical value alert.
- SOP acknowledgement pending.

## Biomedical Waste Rules

Modules:

- Housekeeping
- Infection control
- Facilities
- Regulatory
- Reports

Required evidence:

- waste category.
- collection location.
- quantity.
- handoff.
- disposal vendor.
- manifest/certificate.
- incident/spill log.

Backend enforcement:

- require category and quantity.
- block closure without disposal evidence.

UI indicators:

- disposal pending.
- spill/incident alert.

## Mental Healthcare Act

Modules:

- Psychiatry
- Consent
- IPD
- Emergency
- MRD

Required evidence:

- advance directive.
- nominated representative.
- admission category.
- restraint/seclusion log.
- consent and capacity assessment.

Backend enforcement:

- require legal basis for admission/restraint.
- restrict sensitive notes by permission.

UI indicators:

- confidentiality badge.
- advance directive badge.
- restraint review due.

## Clinical Establishments / Facility Compliance

Modules:

- Onboarding
- Facilities
- Admin
- Quality
- HR
- BME

Required evidence:

- facility registration.
- department/service scope.
- staff qualification/license.
- equipment availability.
- emergency stabilization process.

Backend enforcement:

- block module activation when required facility prerequisites are missing if configured.
- alert expired staff/equipment/facility registrations.

UI indicators:

- registration status.
- license expiry.
- service not configured.

