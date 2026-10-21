# Roadmap

What we are working on, what comes next, and what we have shipped recently. Plans change as we learn from hospitals; the [issues](https://github.com/medbrains/medbrains/issues) are the live record.

A note on wording: "built for" or "built to integrate" means the code follows the published specification and is tested against a stand-in. It does not mean the system is certified or connected. We say "certified" only after the authority certifies MedBrains.

## Now — in progress

- **Payments end to end** ([#4875](https://github.com/medbrains/medbrains/issues/4875)) — every payment mode on every device. Open parts: collect anywhere at every point of service ([#4885](https://github.com/medbrains/medbrains/issues/4885)), the customer display and soundbox ([#4873](https://github.com/medbrains/medbrains/issues/4873)), terminal void, refund and settlement ([#4879](https://github.com/medbrains/medbrains/issues/4879)), counter and shift attribution ([#4880](https://github.com/medbrains/medbrains/issues/4880)), a refund engine ([#4881](https://github.com/medbrains/medbrains/issues/4881)) and payment accounting with three-way reconciliation ([#4882](https://github.com/medbrains/medbrains/issues/4882)).
- **Role-based testing** ([#4800](https://github.com/medbrains/medbrains/issues/4800)) — a training tenant with realistic data, one scripted test login per role, and every permission held by at least one test account ([#4801](https://github.com/medbrains/medbrains/issues/4801)–[#4803](https://github.com/medbrains/medbrains/issues/4803), [#4805](https://github.com/medbrains/medbrains/issues/4805)).
- **Native apps** — bringing the SwiftUI and Compose apps to every workflow the React Native apps had, measured against [`medbrains/docs/NATIVE-PARITY.md`](./medbrains/docs/NATIVE-PARITY.md); ABDM, notes and UHI modules in the native apps ([#4847](https://github.com/medbrains/medbrains/issues/4847)).
- **Gaps and paused work** ([#4852](https://github.com/medbrains/medbrains/issues/4852)) — including clinical note types for new hospitals ([#4906](https://github.com/medbrains/medbrains/issues/4906)) and failures that must not read as "no alerts" ([#4902](https://github.com/medbrains/medbrains/issues/4902)).
- **Website and blog** ([#4908](https://github.com/medbrains/medbrains/issues/4908)) — CMS fields, social previews and structured data.

## Next — planned

- **National health exchanges behind one layer** ([#4917](https://github.com/medbrains/medbrains/issues/4917)) — identity, record push and fetch with consent, e-prescription and insurance claims as capabilities, with each country's systems as adapters. ABDM and NHCX move behind the layer first. First wave: UAE (NABIDH, Malaffi, Riayati, eClaimLink, Shafafiya, Emirates ID / UAE Pass) and Saudi Arabia (NPHIES).
- **Lessons from the field** ([#4900](https://github.com/medbrains/medbrains/issues/4900)) — designing against the mistakes other hospital systems made:
  - a hospital that keeps working when the internet or server goes ([#4892](https://github.com/medbrains/medbrains/issues/4892));
  - enter once, flow everywhere — no double charting ([#4893](https://github.com/medbrains/medbrains/issues/4893));
  - tiered alerts and override telemetry against alert fatigue ([#4894](https://github.com/medbrains/medbrains/issues/4894));
  - the bed on the screen is the bed in the ward ([#4896](https://github.com/medbrains/medbrains/issues/4896));
  - assisted ABHA creation at the counter ([#4897](https://github.com/medbrains/medbrains/issues/4897));
  - a "waiting on" chip and a bottleneck heatmap ([#4898](https://github.com/medbrains/medbrains/issues/4898));
  - a legacy import kit and plain pricing against lock-in ([#4899](https://github.com/medbrains/medbrains/issues/4899)).
- **MedBrains Flow, phase 0** ([#4901](https://github.com/medbrains/medbrains/issues/4901)) — a live crowd and waiting view of the building from data the hospital already has (queues, appointments, passes), with no new hardware.
- **Pharmacy storefront, part 2** ([#4864](https://github.com/medbrains/medbrains/issues/4864)) — holds, substitution, returns, store selection.
- **ABDM and NHCX go-live** — sandbox checks and production keys for the integrations already built.

## Later — being explored

- More countries on the exchange layer: USA, UK, Germany, France, Australia, Singapore, Canada, Malaysia, Indonesia, the Philippines, Kenya and Nigeria ([#4917](https://github.com/medbrains/medbrains/issues/4917)).
- UAE market entry: country-specific patient IDs, tax and billing formats ([#1386](https://github.com/medbrains/medbrains/issues/1386), [#1392](https://github.com/medbrains/medbrains/issues/1392), [#1396](https://github.com/medbrains/medbrains/issues/1396)).
- Process mining: discover how work really flows from staff actions, in aggregate, and suggest workflow changes ([#4859](https://github.com/medbrains/medbrains/issues/4859)).
- The workflow engine and form builder from the workflows RFC: templates, branching, approvals, SLAs and escalation ([#3161](https://github.com/medbrains/medbrains/issues/3161)–[#3174](https://github.com/medbrains/medbrains/issues/3174)).
- Analytics: department and doctor revenue, lab turnaround, OT use, clinical indicators, a custom report builder ([#3145](https://github.com/medbrains/medbrains/issues/3145)–[#3160](https://github.com/medbrains/medbrains/issues/3160)).
- The waiting-room TV app rebuilt natively in Compose for TV ([`RFCs/RFC-NATIVE-MOBILE.md`](./RFCs/RFC-NATIVE-MOBILE.md)).

## Recently shipped (September–October 2026)

Pull request numbers in brackets.

**Payments and billing**
- Provider-neutral online payments: Razorpay, Cashfree, PhonePe, PayU behind one layer (#4904); a working checkout that posts money exactly once and a self-confirming counter UPI QR (#4876).
- Card machines on the counter — Pine Labs, Razorpay POS, Ezetap — through the bridge, with a simulator (#4877, #4887).
- Collect anywhere: one Collect drawer from a due chip at every desk (#4888, #4890); the patient's payment on a customer display (#4905); balance links paid part online and the rest in cash (#4915).
- Doctor payouts by agreement and rule, approved and paid with TDS (#4889).
- Insurer/patient split bills (#4797), OPD revisit windows and per-doctor fees (#4794), a discharge bill that waits for the stay's charges (#4786).

**Interoperability**
- ABDM, built to integrate and ready for go-live keys: ABHA verification and updates (#4833), M2 record linking and sharing (#4836), M3 records from other hospitals with consent (#4837, #4853), Scan & Share (#4840, #4855), a management dashboard (#4841), per-hospital gateway callbacks (#4780).
- NHCX: eligibility and pre-auth (#4835), final claims and payment posting (#4838, #4854).
- UHI provider: teleconsult, ambulance and blood availability (#4842, #4856).
- SNOMED CT terminology service (#4834); FHIR DiagnosticReport (#4785) and case-sheet Compositions (#4716); signed webhooks (#4791); API key budgets and the OpenAPI description (#4790).
- Lab analyzers over ASTM (#4795), imaging through the PACS (#4792) and an on-site PACS kit (#4793), print jobs to real printers (#4798).

**Clinical**
- One case sheet for every clinician's notes across OPD, ward and ER, with signing, countersignature and FHIR export (#4707–#4720).
- Referrals to a named colleague, answered and brought back (#4705, #4706).
- Dental odontogram (#4788), eye OPD workup and spectacle prescription (#4796), dialysis limits and booking (#4763), PC-PNDT Form F (#4764), video consultations as real visits (#4789).
- Hospital-built forms, starting with procedure consent (#4784).
- Every AI answer labelled; the module licence gate closes on faults (#4907).

**Pharmacy**
- Doctor-authorised refills and prescription expiry (#4745–#4748); home delivery by runner or courier (#4749, #4750, #4858).
- Pharmacy storefront and walk-in customers (#4865); supplier bills scanned into GRNs (#4866); day close and returns (#4759).

**Patient and staff apps**
- Native staff app: records from other hospitals, sticky notes, UHI requests (#4868); ABHA at reception and the Scan & Share desk (#4869); signed QR hospital binding (#4860).
- Alert sounds across web and native (#4863); attendance geofence (#4857).

**Privacy, security and compliance**
- DPDP: privacy notice and purpose-by-purpose consent (#4769), a rights desk (#4773), a processor register (#4775), patient privacy controls in the portal and apps (#4777, #4778), patient record download (#4779).
- Break the glass from the patient page (#4772), access alerts (#4774), an append-only audit trail with refusals and failed sign-ins (#4771), monthly audit partitions (#4799).
- Patient identities kept out of what the AI assistant sends to an outside model (#4776); Aadhaar numbers no longer stored in a reversible form (#4832).
- NABH checklist assessment on screen (#4768); database roles that row-level security applies to, and offsite backups (#4757).

**Onboarding and growth**
- A 30-day trial sign-up (#4760) and setup from one Excel workbook (#4761); custom domains proved by DNS (#4781).
- Website enquiries into the Marketing CRM (#4831); the website and blog (#4753, #4814, #4909–#4914).
- Per-role test logins and generated test-case workbooks (#4806, #4807, #4809).
