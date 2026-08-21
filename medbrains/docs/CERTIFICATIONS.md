# Certifications & regulatory compliance — India and global

What MedBrains can hold, what it must hold, and in what order.

> Regulatory detail changes and varies by how a product is *positioned*, not
> only by what it does. Treat this as a map for planning, and confirm current
> requirements with a regulatory consultant before committing to a programme.
> Written August 2026.

---

## 0. The gating question: is MedBrains a medical device?

Answer this **first**. It decides whether the rest of this document is a
security-and-market-access exercise or a full medical-device quality programme,
and the two differ by years and an order of magnitude in cost.

MedBrains ships clinical decision support today:

```
/api/pharmacy/interactions/check        drug–drug interactions
/api/pharmacy/safety/allergy-check      allergy cross-check
/api/cds/drug-interactions              interaction catalogue
/api/icu/admissions/{id}/scores         ICU severity scoring
/api/nurse/fall-risk                    fall risk
/api/ltc/readmission-risk               readmission prediction
/api/radiology/cumulative-dose          cumulative radiation dose
```

Software "intended for diagnosis, prevention, monitoring, prediction,
prognosis, treatment or alleviation of disease" is a medical device in most
jurisdictions. Administrative HMS functions — registration, billing, beds — are
not. The list above sits on the boundary.

### The IMDRF frame everyone uses

Risk is the *significance of the information* multiplied by the *seriousness of
the situation*:

| | non-serious | serious | critical |
|---|---|---|---|
| **inform** clinical management | I | I | II |
| **drive** clinical management | I | II | III |
| **treat or diagnose** | II | III | IV |

A fall-risk score that informs a nurse is low. A DDI alert that blocks a
prescription in an ICU is not.

### The exemption is a design property

Most regimes exempt CDS where the clinician **can independently review the
basis** for the recommendation (US 21st Century Cures Act §3060 is the clearest
statement of it). This is something the product either does or does not do:

* an alert that **shows why it fired**, cites its source, and can be overridden
  with a recorded reason tends to fall outside;
* an alert that **silently blocks**, or whose reasoning cannot be inspected,
  tends to fall inside.

Design for the exemption deliberately rather than discovering which side you
landed on during an audit.

### Where each regime lands

| jurisdiction | instrument | note |
|---|---|---|
| **India** | Medical Device Rules 2017, CDSCO | follows IMDRF; classes A–D |
| **EU** | MDR 2017/745, **Rule 11** | harshest for software — most clinical software lands **Class IIa or above**, needing a Notified Body |
| **UK** | UK MDR 2002, MHRA, UKCA | diverging from EU post-Brexit |
| **US** | FD&C Act, FDA | §3060 CDS exemption is the escape hatch |
| **Australia** | TGA | software-specific rules since 2021 |
| **Canada** | Health Canada MDL | |

**EU MDR Rule 11 is the one that surprises people.** Software providing
information used for diagnostic or therapeutic decisions is Class IIa; if that
decision could cause death or irreversible deterioration, Class III. Very
little clinical software stays Class I in the EU.

### If you are a device

The quality programme is non-negotiable and roughly 18–30 months:

| standard | covers |
|---|---|
| **ISO 13485** | quality management system for medical devices |
| **IEC 62304** | medical device *software* lifecycle — the central one |
| **ISO 14971** | risk management |
| **IEC 62366-1** | usability engineering (use-error as a hazard) |
| **ISO/IEC 82304-1** | health software product safety |
| **MDSAP** | one audit accepted by AU, BR, CA, JP, US |

---

## 1. India

### Market access

| item | body | status for us |
|---|---|---|
| **ABDM Milestone M1** — ABHA create/verify | NHA | partway: `medbrains-abdm` has ABHA login, OTP, sessions, gateway callbacks |
| **ABDM Milestone M2** — link records as HIP | NHA | not started |
| **ABDM Milestone M3** — consume as HIU | NHA | not started |
| **HFR / HPR registration** | NHA | facility and professional registries; ABDM prerequisites |
| **NABH Digital Health Standards** | NABH | helps *customers* pass accreditation — a sales argument; we already carry the ACMSRC checklists |
| **STQC certification** | MeitY | needed for government hospital deployments |
| **MeitY / GeM empanelment** | MeitY | government procurement channel |
| **GIGW 3.0** | MeitY | accessibility for government-facing sites |

### Law — mandatory, not optional

| | |
|---|---|
| **DPDP Act 2023** | India's data protection law. Consent, notice, breach reporting, Data Protection Officer above a threshold. |
| **CERT-In Directions (2022)** | **Six-hour** incident reporting, 180-day log retention within India, NTP sync to NIC/NPL. Frequently missed and strictly worded. |
| **Medical Device Rules 2017** | applies only if the SaMD determination lands inside |
| **Clinical Establishments Act 2010** | our customers' obligation; shapes what records we must keep |
| **EHR Standards 2016 (MoHFW)** | prescribes SNOMED CT, LOINC, ICD-10, DICOM, HL7 |

### Clinical terminology

**SNOMED CT** is free for Indian use under the national licence held by NRCeS —
a real cost saving, since affiliate licences are otherwise expensive. LOINC is
free everywhere. ICD-10/11 comes from WHO.

---

## 2. Global — information security

The list every enterprise buyer works from. None are legally required; all are
commercially required.

| certification | scope | effort |
|---|---|---|
| **ISO/IEC 27001** | information security management. **Start here.** | 6–12 months |
| **ISO/IEC 27799** | 27002 applied to health data | small add-on once 27001 exists |
| **ISO/IEC 27017** | cloud security controls | add-on |
| **ISO/IEC 27018** | personal data in public cloud | add-on |
| **ISO/IEC 27701** | privacy information management; maps to GDPR and DPDP | add-on |
| **SOC 2 Type II** | AICPA trust criteria, observed over 3–12 months | US SaaS buyers |
| **HITRUST CSF** | prescriptive US healthcare framework | expensive; only when named |
| **Cyber Essentials / Plus** | UK baseline | **required for NHS** work |

> **There is no "HIPAA certification."** HIPAA is compliance plus a Business
> Associate Agreement. Anyone selling certification is selling an attestation
> with no statutory standing.

---

## 3. Regional market access

### European Union
* **CE marking under MDR 2017/745** — via a Notified Body for Class IIa+
* **GDPR** — Article 9 special-category data; a DPO and DPIAs
* **EUDAMED** registration
* **EN 301 549** — accessibility, mandatory in public procurement
* **NIS2** — security obligations for essential entities, healthcare included

### United Kingdom
* **UKCA marking**, MHRA registration
* **DTAC** — Digital Technology Assessment Criteria; the NHS entry gate
* **DCB0129** (manufacturer) and **DCB0160** (deploying organisation) —
  **clinical risk management standards, mandatory for NHS health IT.** They
  require a named **Clinical Safety Officer**, a hazard log and a clinical
  safety case. Routinely overlooked by non-UK vendors and a hard blocker.
* **NHS Data Security and Protection Toolkit (DSPT)** — annual
* **Cyber Essentials Plus**

### United States
* **HIPAA** compliance + BAA (no certification exists)
* **ONC Health IT Certification** via an ONC-ACB such as Drummond or ICSA —
  needed to call yourself a certified EHR; substantial
* **FDA** clearance only if the SaMD determination lands inside
* **21 CFR Part 11** if handling electronic signatures for regulated records

### Middle East — a realistic export market for an Indian HMS
* **Saudi Arabia** — SFDA registration; NPHIES interoperability
* **UAE** — MOHAP, DHA (Dubai), DoH (Abu Dhabi) Malaffi integration
* **Qatar** — MOPH

### Asia-Pacific
* **Singapore** — HSA; IMDA cybersecurity
* **Australia** — TGA; My Health Record conformance
* **Japan** — PMDA

---

## 4. Interoperability

Conformance rather than certification, but buyers ask for evidence.

| | |
|---|---|
| **HL7 FHIR R4** | test with **Inferno** (ONC) or **Touchstone**; ABDM defines Indian profiles |
| **IHE profiles** | Connectathon results are published — real third-party evidence |
| **DICOM** | a conformance statement is self-declared but expected |
| **HL7 v2.x** | still how most lab and radiology analysers speak |
| **SNOMED CT** | affiliate licence; free in India via NRCeS |
| **LOINC / ICD-10 / ICD-11** | free |

---

## 5. Accessibility and quality

| | |
|---|---|
| **WCAG 2.2 AA** | already mandated in `CLAUDE.md` and enforced by Biome a11y rules |
| **VPAT** | a self-declaration of WCAG conformance; scores in procurement, costs days |
| **EN 301 549** | the EU procurement form of the same thing |
| **ISO 9001** | general quality management; sometimes asked for in tenders |

---

## 6. Cloud and platform

| | |
|---|---|
| **AWS Foundational Technical Review** | prerequisite for AWS partner status |
| **Azure / GCP marketplace certification** | Helm chart qualifies (see `deploy/helm`) |
| **Red Hat OpenShift certification** | needs a UBI base image; ours is distroless |

---

## 7. Suggested order

Ranked by leverage for our actual market, not by prestige.

1. **SaMD determination** — weeks, and everything else depends on the answer.
   Do not start any other programme before this one lands.
2. **CERT-In and DPDP compliance** — already legally required in India.
3. **ABDM M1** — the gate for Indian hospitals, and we are closest to it.
4. **ISO 27001** — every serious buyer asks; enables 27799/27017/27018/27701.
5. **VPAT** — days, because the underlying work is already done.
6. **ABDM M2 / M3** — as customers need record exchange.
7. Everything else **only when a named buyer asks for it.**

---

## 8. What a certificate does not do

A certification asserts that a **process exists**, not that the software is
correct. Held against real defects found in this codebase during a single
working session:

* 51 tables with RLS enabled and **no policy** — tenant isolation that looks
  configured and is not;
* leave approvals that could be **self-approved** and whose department stage
  could be **skipped**;
* an analytics pipeline dropping **8 hypertensive patients** from a screening
  yield because staging required both blood-pressure readings when either one
  is diagnostic.

ISO 27001 would have caught none of them. The certifications are for market
access; correctness comes from the tests, the reviews and the controls in the
code — see `docs/DESIGN-RULES.md` and the approvals platform in
`RFCs/RFC-MODULE-central-approvals.md`, where the controls are enforced once,
centrally, rather than re-derived per module.
