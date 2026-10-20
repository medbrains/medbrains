# What people say about hospital software, and what it means for MedBrains

Research date: 2026-10-20. Quotes are kept under 15 words; everything else is paraphrased.

## 0. Read this first: Reddit could not be read

Every Reddit route returned a block page or HTTP 403, and Reddit is opted out of this agent's web search. That covers:

- `www.reddit.com/search.json`, `old.reddit.com`, `api.reddit.com`;
- `r/healthcareIT/top.json` and `new.json`;
- the thread `1wksuke` (AI-discovered drugs);
- `r/ProjectHospital/top.json`.

I did not route around the opt-out through Reddit mirrors or archives.

**The evidence below comes from other public sources:**

- Hacker News, via the Algolia API, including comments;
- Student Doctor Network (SDN) and allnurses;
- Steam reviews of Project Hospital: 799 English reviews, using helpful-vote counts;
- Steam community threads, KLAS and Becker's coverage, and peer-reviewed studies;
- Indian press, and ABDM/NHA documents.

**What Reddit-specific signals would need:** if you want them, open the Reddit links in your own browser and paste the threads in, or allow the use of the Reddit API with your own credentials. Every theme below still has a source; the gap is Reddit's vote counts.

Signal key: **HN p/c** = Hacker News points/comments. **Steam ▲** = helpful votes on a review.

---

## Bottlenecks, ranked

### This is not the r/healthcareIT ranking

You asked for a ranking built **only** from r/healthcareIT. That could not be done. On 2026-10-20 these all returned HTTP 403:

- `r/healthcareIT/top.json?t=all`;
- `top.json?t=year`;
- `search.json?restrict_sr=1`.

`old.reddit.com` redirects to the block page, and Reddit is opted out of this agent's search. I have no r/healthcareIT thread counts, upvotes or comments, and I will not invent them.

**Below is a PROVISIONAL ranking** built from the non-Reddit sources in this brief. Treat it as the secondary section the user allowed, not as the r/healthcareIT ranking.

**To get the real ranking:**

1. Open these four URLs in your logged-in browser:
   - `https://www.reddit.com/r/healthcareIT/top.json?t=year&limit=100`
   - `https://www.reddit.com/r/healthcareIT/top.json?t=all&limit=100`
   - `https://www.reddit.com/r/healthcareIT/search.json?q=downtime+OR+interface+OR+HL7+OR+slow+OR+migration+OR+login&restrict_sr=1&limit=100`
   - `https://www.reddit.com/r/healthcareIT/comments/1wksuke/.json` (the AI-drug thread)
2. Save each one with "Save as" into the scratchpad.
3. The re-rank is then mechanical: tag each thread to a row below, count threads, and sum score plus comments.

### Provisional ranking (from non-Reddit sources)

Evidence strength: **A** = several independent sources or a high-engagement thread (HN 100+ points). **B** = 2–3 sources. **C** = single or weak source.

| # | Bottleneck | Who | Workflow step | How it shows up | Evidence | MedBrains status | Fix idea for the gap |
|---|---|---|---|---|---|---|---|
| 1 | Downtime pushes care to paper | Nurse, doctor, pharmacist, lab | All; orders and MAR hit worst | Handwritten orders walked to departments; lost information; OPD collapses | **A**: [Oracle 5-day outage, HN 174p/106c](https://news.ycombinator.com/item?id=43828915); [Ascension, NPR](https://www.npr.org/sections/shots-health-news/2024/05/23/1253011397/how-the-ascension-cyberattack-is-disrupting-care-at-hospitals); [AIIMS 15k to under 5k OPD/day](https://thewire.in/health/online-systems-still-down-after-cyber-attack-aiims-daily-opd-registrations-fall-substantially). Union: info "missed, lost or not communicated". | **Partial.** CRDT offline for handoff, triage and notes (`crates/medbrains-clinical-offline`); edge sync (`medbrains-edge`); offline authz (`medbrains-offline-core`). | Hourly local read-only downtime snapshot (census, allergies, active meds and orders), plus offline orders and MAR. |
| 2 | Nursing flowsheet / eMAR double entry | Nurse | Medication administration, assessments | Clicks; same data twice; paper for IV stop-times | **A**: [Ochsner 11M clicks saved](https://www.beckershospitalreview.com/quality/nursing/systems-ramp-up-efforts-to-reduce-documentation-time/); [Capterra](https://www.capterra.com/p/122278/EpicCare-EMR/reviews/%3Fpage%3D2): "enter the same information multiple times"; [allnurses](https://allnurses.com/profile/459000-umrn1/content/) | **Partial.** eMAR #3313, IV #3314, `medbrains-nursing`. | Per-task click telemetry; one-tap start and stop at bedside. |
| 3 | Order entry and alert fatigue | Doctor, pharmacist | CPOE, prescribing | One-click override of every alert; dangerous doses slip through | **A**: [PMC study](https://pmc.ncbi.nlm.nih.gov/articles/PMC5820226); [HN 49370524](https://news.ycombinator.com/item?id=49370524) "had to dismiss at least one alert"; Leapfrog alert-fatigue category | **Partial.** Rx safety gate (`crates/medbrains-opd/src/rx_policy.rs`); `override_reason` captured. | Override-rate per alert on the admin dashboard; retire alerts nobody heeds. |
| 4 | Physician documentation and after-hours charting | Doctor, resident | Notes, discharge summary | Pajama time; dialog boxes; notes of poor quality | **A**: [SDN](https://forums.studentdoctor.net/threads/program-specific-questions.1041075/post-16066605) "99% of people on SDN hate them"; [CMAJ via PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6102113/); [MIT Launchpad India](https://orbit.mit.edu/launchpad/ideas/ayuconnect) | **Partial.** One case sheet (#4707–#4724), templates. | Smart phrases and structured discharge summary drafted from the encounter, under an AiLabel. |
| 5 | AI scribe errors become a new review burden | Doctor | Notes | Hallucinated history; doctors don't re-read | **A**: [HN 157p/129c](https://news.ycombinator.com/item?id=49294441) "The doctor probably didn't even read it"; [pilot: 11.5% hallucinations](https://escholarship.org/uc/item/9r89g3sp) | **Gap / by design.** No scribe; AiLabel used on 1 page. | AI drafts as proposals with accept and diff, an "AI error" flag, and AiLabel everywhere. |
| 6 | Interface backlog and per-interface fees | IT, lab | HL7/FHIR feeds, analyzers | Months-long queue; $10–25k per interface; Mirth click-config | **B**: [HealthExec](https://healthexec.com/topics/patient-care/digital-transformation/achieving-data-integration-taming-interoperability-beast); [HN 36930725](https://news.ycombinator.com/item?id=36930725) "mind-numbingly boring interfaces"; [HN 46946030](https://news.ycombinator.com/item?id=46946030) | **Partial.** HL7 listener (`crates/medbrains-bridge/src/hl7_listener.rs`), `medbrains-fhir`, `medbrains-integration-hub`. | Interface catalogue page: last message, error queue, replay. |
| 7 | Migration and go-live disruption | All | Go-live | Programs avoided mid-transition; partial modules left live | **B**: SDN (Epic roll-outs "miserable"); [KLAS via Becker's](https://www.beckershospitalreview.com/ehrs/what-ehrs-do-small-hospitals-prefer.html); [Tulsi case](https://www.scribd.com/document/562908665/Case-Study-Tulsi) | **Gap.** Masters import only (`medbrains-catalog-import`). | Legacy patient/visit/bill importer with a reconciliation report. |
| 8 | OPD registration queue and ABHA | Front desk, patient | Registration | Long lines; OTP to the wrong phone; no smartphone | **B**: [Gandhi Hospital](https://www.ocacademy.in/blogs/digital-opd-system-gandhi-hospital-challenges); [AIIMS kiosks 7am–10pm](https://www.outlookindia.com/national/aiims-to-promote-use-of-ayushman-bharat-health-account-for-opd-registrations-news-238226) | **Partial.** `medbrains-abdm`; ABHA V3 not key-ready (memory); token queues. | Assisted ABHA creation at the counter, with a biometric or Aadhaar-OTP fallback. |
| 9 | Bed status that isn't true | Bed manager, ED, admissions | Admission, bed allocation | Portal shows a free bed; the patient is denied | **B**: [Delhi HC audit, Jul 2026](https://www.scconline.com/blog/post/2026/07/11/delhi-hc-orders-hmis-audit-after-icu-bed-denial-in-govt-hospitals/); [Tribune](https://www.tribuneindia.com/news/delhi/give-patients-real-time-info-on-availability-of-hospital-beds-doctors-delhi-hc-directs-govt) | **Partial.** `bed_states`; command-centre bed tab; occupancy KPI fixed (#4695). | Last-verified time and verifier on each bed, plus a stale-bed alert. |
| 10 | Slow screens under load | All | Peak OPD | Servers fail under load; doctors reject slow software | **B**: [PGIMER](https://www.tribuneindia.com/news/chandigarh/pgi-to-table-agenda-for-replacing-17-yr-old-management-software-401934); [NestorBird](https://nestorbird.com/biggest-gaps-in-indian-hospital-software-and-how-to-fix-them/) (vendor) | **Partial.** `medbrains-loadtest`; the load test is still pending (memory). | Publish p95 per screen at peak OPD load. |
| 11 | Unreliable internet and power | All, rural | Everything | Cloud-only HMIS stops working | **C**: [Ken Research 49%](https://www.kenresearch.com/articles/clinical-digitisation-barrier-hms-vendors-india) (unverified); [NIC e-Hospital cloud-only](https://healthcareitnews.com/node/551970) | **Partial.** Edge node and offline authz. | Local-first registration and billing on the edge, syncing when online. |
| 12 | Insurance pre-auth and claims | Billing, TPA desk | Claims | Small providers squeezed; claims lost | **B**: [HN 37310850](https://news.ycombinator.com/item?id=37310850) (works in health IT for small practices); NHCX claims lost (internal memory) | **Partial.** TPA pipeline, NHCX crates; NHCX handler unregistered. | NHCX P0 fix, plus a claim status tracker. |
| 13 | Billing and coding corrections | Coder, billing | Charge correction | Corrections are slow | **C**: [AAPC thread](https://www.aapc.com/discuss/threads/what-is-the-best-emr-system-you-have-ever-used.172685/post-471216) (Cerner corrections "very time-consuming") | **Partial.** Billing worklist; `opd_unbilled_pct` KPI. | Worklist of unbilled or un-coded encounters with one-click fixes. |
| 14 | Report requests queued at IT | Admin, quality, IT | Reporting | Custom reports slow; extra tools bought | **B**: [Healthray](https://www.techjockey.com/reviews/healthray-hmis); [Meditech wants capacity built in](https://fiercehealthcare.com/health-tech/epic-continues-grow-ehr-market-share-it-makes-gains-small-health-systems) | **Strength / partial.** Management KPIs vs the usual day; report catalogue; command centre. | Self-serve report builder over the KPI catalogue. |
| 15 | Vendor lock-in and support | IT, admin | Contracts, support | Can't switch; poor first-line support | **B**: [HN 43829392](https://news.ycombinator.com/item?id=43829392) "legacy lock in"; [HN 43829720](https://news.ycombinator.com/item?id=43829720) | **Strength.** PostgreSQL, FHIR, AGPL+commercial. | Publish an export guarantee. |
| 16 | Production access and ransomware exposure | IT, security | Operations | Anyone could drop tables | **B**: [HN 43831873](https://news.ycombinator.com/item?id=43831873); AIIMS and Ascension | **Strength.** Authz RFC, RLS, audit, MFA. | Buyer-facing trust page. |
| 17 | Training load | All | Onboarding | Vendors sell training to work around their UI | **B**: [Epic SmartUser](https://www.fiercehealthcare.com/providers/epic-launches-ehr-training-program-nurses-help-cut-clicks); [ISB](https://blogs.isb.edu/healthcare/2026/03/18/why-sme-hospitals-matter-in-india-digital-health-transformation/) | **Partial.** `/help` Docusaurus guide (#4724). | In-context help per screen. |
| 18 | Shift handoff gaps | Nurse, doctor | Handover | Patients stranded overnight with pending items | **C**: Ascension union huddles; game (inspiration only) | **Partial.** Handoff CRDT log exists. | Night sweep: pending items with no owner after shift change. |
| 19 | Hybrid paper and digital workarounds | Nurse | eMAR, orders | Paper for steps the system lacks | **C**: [allnurses](https://allnurses.com/profile/459000-umrn1/content/) "Everything is in computer except the stop time option" | **Partial.** | Find paper steps during implementation; close each one. |
| 20 | DPDP consent paperwork | Front desk, MRD | Admission consent | Bundled consent forms that fail the law | **C**: [AMLegals](https://amlegals.com/building-audit-ready-consent-systems-for-healthcare/) (commentary) | **Partial.** `medbrains-consent`. | Purpose-specific consent at registration, mapped to ABDM artefacts. |

**Asked about, but no evidence reached:**

- login/MFA/SSO friction;
- printing;
- lab result routing (only game evidence);
- discharge-summary bottlenecks as a distinct complaint.

These are typical r/healthcareIT topics. Expect them to rank once real data is pulled.

---

## 1. Pain points with existing products

### 1.1 Usability, click count, alert fatigue (strongest and most consistent signal)

- **Epic is famous for bad UX.** One Kaiser engineer says a doctor built his own macro recorder to "replay them on single button click". [HN 44791098](https://news.ycombinator.com/item?id=44791098), on *Why doctors hate their computers*.
- **Nurses re-enter the same data.** "Have to enter the same information multiple times" ([Capterra, Epic](https://www.capterra.com/p/122278/EpicCare-EMR/reviews/%3Fpage%3D2)).
- **Health systems are now running click-reduction projects.**
  - Ochsner saved nurses 11M clicks in a quarter ([Becker's](https://www.beckershospitalreview.com/quality/nursing/systems-ramp-up-efforts-to-reduce-documentation-time/)).
  - Houston Methodist found thousands of redundant flowsheet rows ([Houston Methodist IT](https://it.houstonmethodist.org/?p=47027)).
  - Epic ships a free "Nursing SmartUser" course of 60 tips ([Fierce](https://www.fiercehealthcare.com/providers/epic-launches-ehr-training-program-nurses-help-cut-clicks)).
  - In other words, vendors are selling training to work around their own UI.
- **Alert fatigue.**
  - After Epic replaced an older system, users could override all alerts with one click ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5820226)).
  - On HN, a near-miss dose error drew the comment "The prescribing clinician likely had to dismiss at least one alert" ([HN 49370524](https://news.ycombinator.com/item?id=49370524), in a 157p/129c thread).
- **Hybrid paper and digital breaks workflows.** An allnurses poster on Epic MAR: "Everything is in computer except the stop time option" ([allnurses](https://allnurses.com/profile/459000-umrn1/content/)).
- **Indian vendors.** Doctors reject software with many clicks and slow screens, and many Indian HMSs are billing-first with thin clinical workflow ([NestorBird](https://nestorbird.com/biggest-gaps-in-indian-hospital-software-and-how-to-fix-them/); vendor blog, weak signal).

### 1.2 Documentation burden, and why AI scribes are the response

- SDN residents: "Seems like 99% of people on SDN hate them" (EMRs). Epic roll-outs are called miserable, and some applicants avoid programs that are mid-transition ([SDN thread](https://forums.studentdoctor.net/threads/program-specific-questions.1041075/post-16066605)).
- Epic's dot-phrases are the one widely praised time-saver (same thread).
- India: OPD visits run about four minutes at 40 or more patients a day ([hackmd](https://hackmd.io/@wondrx/HkhssLzKGx)). Startups report late-night charting from 25+ interviews ([MIT Launchpad](https://orbit.mit.edu/launchpad/ideas/ayuconnect)). Both are self-reported.

### 1.3 Downtime, outages and ransomware

- **Oracle Health outage.** Engineers deleted critical storage, causing a five-day outage at US hospitals. **HN 174p/106c** ([HN 43828915](https://news.ycombinator.com/item?id=43828915)).
  - An ex-Cerner engineer: "anyone could ssh into a hospitals cerner and drop tables" ([HN 43831873](https://news.ycombinator.com/item?id=43831873)).
- **VA Oracle sites.** An advocacy group tallies about 1,909 hours of downtime. The VA Inspector General found orders vanishing into an "unknown queue" ([stoptherollout.org](https://stoptherollout.org/); [The Register](https://www.theregister.com/2024/11/27/oracle_cerner_project/)).
- **Ascension ransomware (2024).** Orders were handwritten and walked to departments by hand. A NICU nurse said the hospital wasn't ready ([NPR](https://www.npr.org/sections/shots-health-news/2024/05/23/1253011397/how-the-ascension-cyberattack-is-disrupting-care-at-hospitals)). The union warned that information could be "missed, lost or not communicated" ([BankInfoSecurity](https://www.bankinfosecurity.com/union-demands-patient-safety-fixes-in-ascension-cyber-outage-a-25343)).
- **India.**
  - The AIIMS cyberattack cut online OPD registrations from about 15,000 to under 5,000 a day for more than eight days ([The Wire](https://thewire.in/health/online-systems-still-down-after-cyber-attack-aiims-daily-opd-registrations-fall-substantially)).
  - PGIMER's replacement HMS had server issues under heavy load ([Tribune](https://www.tribuneindia.com/news/chandigarh/pgi-to-table-agenda-for-replacing-17-yr-old-management-software-401934)).

### 1.4 Data that lies

- **Delhi High Court, July 2026.** A patient was denied an ICU bed that the e-HMIS portal showed as free. The court ordered a surprise audit of 38 hospitals ([SCC Online](https://www.scconline.com/blog/post/2026/07/11/delhi-hc-orders-hmis-audit-after-icu-bed-denial-in-govt-hospitals/); [Bar & Bench](https://www.barandbench.com/news/delhi-high-court-directs-surprise-audit-of-government-hospitals-over-implementation-of-nextgen-e-hmis-portal)).
- **Tulsi Hospital, Delhi.** Departments complained that HMIS modules and integrations were never completed ([Scribd case](https://www.scribd.com/document/562908665/Case-Study-Tulsi)).

### 1.5 Interoperability, pricing and lock-in

- **Lock-in.** "It's legacy lock in. You can't just switch stuff." ([HN 43829392](https://news.ycombinator.com/item?id=43829392)). Buyers say Oracle sells to executives and bypasses the technical staff (same thread).
- **Interface costs.**
  - Per-interface fees are a recurring complaint. A single interface costs about $10–25k, and engines are priced per interface ([HealthExec](https://healthexec.com/topics/patient-care/digital-transformation/achieving-data-integration-taming-interoperability-beast); [PilotFish](https://healthcare.pilotfishtechnology.com/cut-hl7-interface-fees)). These are vendor sources.
  - "nobody wants to write all the necessary but mind-numbingly boring interfaces" ([HN 36930725](https://news.ycombinator.com/item?id=36930725)).
- **India.** Software from multiple vendors does not interoperate, and up-front cost is the top barrier ([ISB 2026](https://blogs.isb.edu/healthcare/2026/03/18/why-sme-hospitals-matter-in-india-digital-health-transformation/)).

### 1.6 Vendor churn (KLAS)

- Small hospitals change EHRs more often than large ones, and most moves go to Epic Community Connect ([Becker's](https://www.beckershospitalreview.com/ehrs/what-ehrs-do-small-hospitals-prefer.html)).
- Oracle Health satisfaction and share have declined for three straight years ([Healthcare IT News](https://www.healthcareitnews.com/news/epic-gains-ground-acute-care-ehr-purchasing-slows)).
- Meditech customers ask for capacity management built in, so they can drop third-party tools ([Fierce](https://fiercehealthcare.com/health-tech/epic-continues-grow-ehr-market-share-it-makes-gains-small-health-systems)).

### 1.7 Implementation, training, support, customisation (India)

Indian HMS failures cluster around:

- inflexible software;
- weak management backing;
- inexperienced implementers;
- partial go-live, where only some modules ship;
- inconsistent data-entry standards.

Sources: [MocDoc](https://mocdoc.com/blog/how-to-implement-hms-successfully-in-hospitals) and [Slideshare](https://www.slideshare.net/slideshow/challenges-while-implementing-the-hospital-management-systempptx/254090034); both are vendor or academic, mostly 2014–2019.

Product notes:

- **Insta HMS.** A 2017 review rated it 3/5, asking for better usability and better diet, procurement, lab and stores modules ([Software Advice](https://www.softwareadvice.co.uk/software/115581/insta)).
- **Healthray.** Custom reports are slow ([Techjockey](https://www.techjockey.com/reviews/healthray-hmis)).
- **KareXpert, Suvarna, Birlamedisoft, Medeil, Bahmni.** No independent user voice found. That itself is a signal: the Indian buyer conversation happens offline and through referrals.

### 1.8 Offline and unreliable internet (rural India)

- Poor internet or power is cited as a barrier by 49% of tier-3 hospitals ([Ken Research](https://www.kenresearch.com/articles/clinical-digitisation-barrier-hms-vendors-india); method undisclosed, so unverified).
- NIC e-Hospital is cloud-only on MeghRaj, which means no local server, but also no work without the link ([Healthcare IT News](https://healthcareitnews.com/node/551970)).

### 1.9 ABDM / ABHA hassles

- **Gandhi Hospital, Hyderabad.** QR-token OPD registration created long lines at the conventional counters. Patients without smartphones or data, and OTPs going to the wrong mobile, were the blockers ([OC Academy](https://www.ocacademy.in/blogs/digital-opd-system-gandhi-hospital-challenges)).
- **Quasi-mandatory.** ABHA is formally voluntary, but in practice it is mandated for OPD registration in places. G.B. Pant Hospital in the Andamans made it mandatory ([Nicobar Times](https://nicobartimes.com/?p=25328)). AIIMS runs ABHA-creation kiosks from 7am to 10pm ([Outlook](https://www.outlookindia.com/national/aiims-to-promote-use-of-ayushman-bharat-health-account-for-opd-registrations-news-238226)).
- **NHA's own admission.** "affordable, easy-to-use software for small clinics" remains a challenge ([DHIS policy](https://abdm.gov.in:8081/uploads/Financial_Incentive_Policy_DHIS_e96a62fd28.pdf)).
- **App quality.** ABHA app release notes fix blank State/District fields in Scan & Share ([App Store](https://apps.apple.com/in/app/abha-abdm/id1630917266)).

### 1.10 Data migration

No good forum evidence surfaced.

- Indirect signals: SDN residents avoid programs mid-transition, and KLAS reports frequent small-hospital switching.
- One positive Insta review (2017) called the migration smooth.
- Treat migration as a buyer fear that is under-documented, not as a proven complaint.

---

## 2. What clinicians, nurses, pharmacists, admins and IT ask for

| Who | Asks for or praises | Source |
|---|---|---|
| Physicians | Dot-phrases and templates. Fewer dialogs: documentation quality drops as dialog boxes rise. | SDN; [CMAJ via PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6102113/) |
| Nurses | Everything at the bedside in one place (no paper stop-times). Fewer redundant flowsheet rows. Downtime training and huddles. | allnurses; Houston Methodist; Ascension union |
| Pharmacy | Hard stops on dose/unit errors that pharmacists actually see, the "multiple things have to go wrong" model | [HN 49370863](https://news.ycombinator.com/item?id=49370863) |
| Admins / management | Capacity management in the core product. Real-time bed truth. | KLAS/Fierce; Delhi HC |
| IT | No per-interface fees. Interfaces as code, version control, CI (an HN builder of a Mirth alternative). Least-privilege production access. | [HN 46946030](https://news.ycombinator.com/item?id=46946030); HN 43831873 |

---

## 3. Small and mid-size buyers, especially India

- **Market size.** About 30,000 Indian hospitals have 30–100 beds, and about 45,000 have fewer than 30 ([newsreel.asia](https://newsreel.asia/articles/india-healthcare-small-medium-hospitals-digitalisation)).
- **Barriers:**
  - up-front cost and doubt over return on investment;
  - ongoing IT support;
  - training;
  - fear of disrupting workflow;
  - privacy uncertainty ([ISB](https://blogs.isb.edu/healthcare/2026/03/18/why-sme-hospitals-matter-in-india-digital-health-transformation/); [BMC 2025 survey of 105 doctors](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12087044/)).
- **Price floor.** IndiaMART HMS listings start around ₹10k–50k a pack, so buyers anchor low.
- **How hospitals evaluate.** Visit an existing site of similar size before buying (MocDoc guide). Trust comes from referrals, not reviews.
- **Cloud vs on-prem.** Tier-3 cloud adoption is reportedly around 29% (Ken Research, unverified). The public sector is pushing cloud-only through NIC e-Hospital. That leaves room for "cloud with a local fallback".

---

## 4. The builders' perspective

- **"my users are doctors, and the potential buyers are not"** ([HN 42283554](https://news.ycombinator.com/item?id=42283554)): a doctor-founder building an ER-only MVP on about $2.5k. Commenters warned that production software costs "around the cost of a new car", and that pre-selling is the only reliable funding.
- **Practo's early playbook** ([iSPIRT](https://pn.ispirt.in/category/playbook-roundtable/page/6/)):
  - founders sold the first 50 customers themselves;
  - targeted specialists, not GPs;
  - skipped clinics with no computers;
  - kept a strict no-discount policy;
  - later sold by territory.
- **Practo bought Insta HMS for about $12M**, so the Indian HMS market consolidates cheaply ([TechCrunch](https://techcrunch.com/?p=1208532)).
- **Long cycles with many gatekeepers.** Pitching the CEO or the ministry rarely works ([TiE](https://hub.tie.org/e/selling-to-healthcare-enterprises); [BW Healthcare](https://bwhealthcareworld.com/article/navigating-business-with-hospitals-a-ready-reckoner-for-healthcare-entrepreneurs-302835)).
- **A capital-starved Indian HMS** sold through resellers and inside sales ([Stanford EE204 case](https://web.stanford.edu/class/ee204/2016/SalesManagement.html)).

---

## 5. Regulatory and compliance

- **ABDM.**
  - ABHA create/verify is mandatory for certified HMIS ([MVP doc](https://abdm.gov.in:8081/uploads/Approved_MVP_Document_Version_2_0_4a85e329f9.pdf)).
  - DHIS pays facilities with 10 or more beds, and HMIS vendors, for linked records, up to ₹4 cr ([BioSpectrum](https://www.biospectrumindia.com/news/98/22400/govt-promotes-adoption-of-abdm-by-offering-incentives-up-to-rs-4-cr-to-hospitals-labs.html)).
  - Complaints are about patient friction (OTP, smartphones), not about doctors.
- **DPDP.**
  - A bundled admission consent fails the purpose-specific standard ([AMLegals](https://amlegals.com/building-audit-ready-consent-systems-for-healthcare/)).
  - ABDM consent artefacts are not the same as DPDP purpose consent.
  - Penalties run up to ₹250 cr. Commentators say the burden is disproportionate for small providers ([KPMG](https://assets.kpmg.com/content/dam/kpmgsites/in/pdf/2025/12/the-privacy-prescription-impact-of-dpdp-act-and-rules-in-healthcare-and-life-sciences-sector.pdf.coredownload.pdf); [Tsaaro](https://tsaaro.com/blogs/privacy-and-healthcare-the-impact-of-the-dpdp-act-2023-and-india%E2%80%99s-sectoral-healthcare-regulations)).
- **NABH and DPDP together** shape digital compliance ([IndiaLaw](https://www.indialaw.in/blog/civil/nabh-and-dpdp-digital-healthcare/)).
- **HIPAA** appears only indirectly, in US vendor material. It is not a buyer theme for India.

---

## 6. Ideas from r/healthcareIT, read through substitute sources

r/healthcareIT returned 403. Its topic list is covered here from HN health-IT comments, the trade press and KLAS.

| Topic | What practitioners say | Idea for MedBrains |
|---|---|---|
| HL7/FHIR, interface engines | Per-interface fees. Interfaces are tedious. Builders want interfaces as code with version control and CI instead of a click-UI like Mirth. | No per-interface pricing. An interface catalogue with live health (last message, error queue). |
| EHR migrations | Transitions are dreaded (SDN). Small hospitals churn most (KLAS). | A migration kit: legacy patient/visit/bill import with a reconciliation report. |
| Downtime procedures | Ascension went to paper with no read-only data. The VA had orders lost in an "unknown queue". | A read-only downtime snapshot (census, MAR, allergies, active orders), printable and local, plus a "lost order" detector. |
| Device integration | Lab analyzers and modalities over HL7/ASTM are usually a separate paid project. | Bridge listener exists. Show analyzer status on the command centre. |
| Identity / SSO | Least-privilege production access was missing at Cerner (HN 43831873). | Our authz law and audit are a selling point; show it to IT buyers. |
| Security / ransomware | AIIMS 2022, Ascension 2024, Change Healthcare 2024. | Offline-capable edge nodes and continuity as a ransomware answer. |
| Analytics / reporting | Custom reports are slow (Healthray). Meditech users want capacity tools built in. | Management KPIs vs the usual day, with a report builder. |
| AI / scribes | See §7. | Assist, label, review. |
| Ticket volume / config | Vendors sell training to fix the UI (Epic SmartUser). | Self-serve configuration, and an in-app guide (`/help` exists). |

## 7. AI in healthcare: what practitioners actually think

**The AI-discovered drug thread could not be read (403).** The study it almost certainly discusses is BCG / Jayatunga et al., *Drug Discovery Today*, 2024 ([summary](https://garymarklevin.substack.com/p/how-successful-are-ai-discovered); [HT World](https://www.htworld.co.uk/news/ai/ai-discovered-drugs-achieved-higher-success-rate-than-those-by-humans-study/)):

- **Phase I: 21 of 24 succeeded (80–90%)**, against a historical 40–65%.
- **Phase II: 4 of 10 advanced (about 40%)**, which matches the historical 30–40%.
- The authors flag small samples and AI-native biotechs only.

**Sceptic reading:** AI improves tolerability and design, but has not shown it predicts efficacy in patients ([philippdubach](https://philippdubach.com/posts/ai-can-now-design-drugs-in-seconds-we-still-cant-tell-you-if-they-work./)). The headline "80–90% success" circulates as hype on investor forums ([Motley Fool discussion](https://discussion.fool.com/t/ai-discovered-drugs-have-80-90-success-rate-in-clinical-trials/104931)).

**Scribes:**

- A 2024 pilot reviewed 356 notes and found 18% omissions, 11.5% hallucinations and 2.5% serious-risk notes ([eScholarship](https://escholarship.org/uc/item/9r89g3sp)).
- A Mayo simulation of five products found 26.3% errors.
- A randomised trial found faster notes and less burnout, but 15% of physicians never used the scribe.
- Measured time saved is modest: about 13–16 minutes a day.

**On HN:**

- "Error by AI scribe…" drew **157p/129c** ([HN 49294441](https://news.ycombinator.com/item?id=49294441)). A physician who tried scribes and stopped: "The doctor probably didn't even read it" ([49370308](https://news.ycombinator.com/item?id=49370308)).
- On recovery: "the error recovery paths often simply don't exist" ([49370456](https://news.ycombinator.com/item?id=49370456)).
- The counterpoint: compare against human error rates, since 42% of human notes contain an error ([49370413](https://news.ycombinator.com/item?id=49370413)).

**What this means for MedBrains:**

1. **Clinical trials module** (`crates/medbrains-ancillary/src/clinical_trials.rs`, `pages/clinical-trials.tsx`) already covers screening, consent, randomisation and unblinding, adverse events, IRB and export. That serves hospitals as **trial sites**, the realistic role.
   - We should not claim drug-discovery AI.
   - Useful AI is assistive: eligibility pre-screen suggestions with clinician confirmation, and an adverse-event coding assist.
2. **Assist, never auto-commit.**
   - Any AI-drafted note, code or summary arrives as a **proposal** with a source trace.
   - It needs an explicit accept, and an edit diff kept for audit.
   - Measure omission and hallucination on our own data before claiming time savings.
3. **Labelling.**
   - `AiLabel` exists (`components/ui/AiLabel.tsx`, with an explainer popover showing title, description and model).
   - **It is used on only one page (`pages/setup/infrastructure.tsx`).** AI surfaces such as `medbrains-ai` chat and `whispers` should carry it consistently.
   - **Rule: every AI-originated value is labelled where it is shown, printed and exported.**
4. **The error-recovery path is a feature.** Patients and clinicians need "flag this as AI error". Correction workflow and MRD amendment already exist; link them.

---

## 8. Ideas from Project Hospital (game)

**This is inspiration, not user evidence.** The game has 3,807 Steam reviews, 87% positive. Many top reviewers are real RNs and medical students. r/ProjectHospital itself was blocked, so this uses [Steam reviews](https://store.steampowered.com/app/868360) and [Steam community threads](https://steamcommunity.com/app/868360/discussions/0/3836549485403754526).

**What players find satisfying:**

- "When you see all the departments work perfectly". The whole hospital as one legible machine.
- "Releasing treated patients gives me serotonin" (Steam ▲80): visible throughput.
- An RN on a med-surg floor (**▲531**, the top review) calls it the most accurate portrayal of running a hospital.
- A parent (▲71): everything is reachable by "clicking on a sensible icon", and the game pauses on events.

**What frustrates them:**

- **Patients left "sitting in waiting rooms overnight with pending labs"** waiting for a specialist (▲90). This is the night-handover gap.
- **Night-shift assignments silently lost** when departments change; reported for six years (▲204).
- **"excel spreadsheet with a GUI"** (▲93): optimisation without feedback is boring.
- **Bigger hospitals get less profitable**, because new departments split a fixed patient pool (▲226).
- **Throughput.** Ten doctors are needed for 50 patients a day (▲68). Theatres idle with full staff, "preparing for surgery" (negative review).

**Mechanics players use to see the hospital:**

- the patient card showing **what each waiting patient is waiting on**;
- the code-blue priority flag;
- per-department staff cards with stress levels;
- prefab rooms.

The community fix for bottlenecks is to open waiting patients, see which test they are stuck on, and staff the lab ([Steam thread](https://steamcommunity.com/app/868360/discussions/0/3836549485403754526)).

**Mapping to MedBrains.** The command centre already has `patient_flow_snapshot`, `hourly_flow`, `detect_bottlenecks`, `department_load`, alerts and thresholds, discharge blockers, bed turnaround and transport (`crates/medbrains-analytics/src/command_center.rs`). Management KPIs cover the value vs the usual day for OPD wait, lab TAT, bed turnaround and occupancy.

| Game mechanic | MedBrains idea | Status |
|---|---|---|
| "What is this patient waiting on?" | A **waiting-on reason chip** per queued patient: lab result, radiology, specialist, bed, bill. Aggregate it into the bottleneck view. | Partial. Bottlenecks exist; no per-patient waiting reason confirmed. |
| Department efficiency overview | Department load plus the **bottleneck heatmap** (department × hour). | Partial. `hourly_flow` and `department_load` exist; echarts heatmap allowed by rules. |
| Overnight stranded patients | A **night-handover sweep**: patients with pending items and no owner after shift change. | Gap. |
| Staff stress / workload cards | **Staff load view**: patients per nurse or doctor now vs norm, duty hours. | Partial. Shift and fatigue guard exist (#3316–#3323); "workload" appears in only 6 files. |
| Silent loss of night-shift assignments | Roster change **diff and alert** when a shift loses its staff. | Gap. The roster screen is unbuilt (memory). |
| Code-blue flag | Priority flags on tokens. | Strength. Code-blue response shipped (#4648). |
| Live hospital floor | **Floor occupancy map** over the location hierarchy, with bed states. | Partial. Bed board and `bed_states` exist; no spatial floor view confirmed. |
| Throughput "serotonin" | A discharges-today counter vs the usual day on the TV/command centre. | Strength-ish. KPI framework exists. |

---

## 9. Map to MedBrains

| Theme | Strength we have | Partial | Gap |
|---|---|---|---|
| Usability / clicks | Carbon UI seam, WCAG law, order sets, order basket | Click budgets are not measured | No per-task click telemetry |
| Alert fatigue | Rx safety gate, server-verified safety flags; override reasons captured (`override_reason` in about 62 files) | Override-rate analytics per alert are not confirmed | Alert tuning dashboard |
| Documentation burden | One case sheet (#4707–#4724), clinical scores, templates | AI whispers and chat exist but are not labelled | No validated scribe; no copy-forward guard (no code mentions it) |
| Downtime / outages | Offline CRDT for handoff, triage and notes (`medbrains-clinical-offline`), iroh edge sync, offline authz cache | Offline covers 4 domains only | No clinical downtime snapshot / BCA print ("downtime" means equipment only) |
| Data truth (beds) | `bed_states`; occupancy KPI fixed (#4695) | The command-centre overview shows "—" for unbuilt codes | Reconciliation audit (portal vs reality) |
| Interop / lock-in | `medbrains-fhir`, HL7 bridge listener, DICOM, integration hub, PostgreSQL, AGPL+commercial | Interface health is not on screen | A no-per-interface-fee message; an interface catalogue page |
| Billing / insurance | Billing, TPA pipeline, insurance, NHCX crates | NHCX claims "silently LOST" (unregistered handler, memory) | NHCX P0 fix |
| ABDM / ABHA | `medbrains-abdm`, ABDM settings, M4 (#4831) | ABHA V3 not key-ready (no OAEP-SHA1, about 85% of endpoints missing; memory 10-19) | Assisted ABHA-at-counter flow for patients without smartphones; M2/M3 (DHIS pays only these) |
| DPDP / consent | `medbrains-consent`, DPDP references (about 81 files), contact consent | Purpose-specific consent vs ABDM artefact mapping not verified | Breach-notification workflow |
| Training / support | Docusaurus `/help` guide, role-based testing epic | Guide coverage is in progress | — |
| Mobile | Native SwiftUI + Compose plan, staff/patient apps | Parity still in progress | — |
| Rural / offline | Edge nodes, offline authz | — | Low-bandwidth mode for web; local-first registration |
| Data migration | `medbrains-catalog-import` (masters) | — | Legacy patient/visit/bill importer with reconciliation (not found in a quick grep) |
| Customisation | 7-layer config, forms, workflow and automation engines, widgets per role/group/user | — | — |
| Clinical trials / research | Full trial site workflow | No AI assist | — |
| Command centre / management | Bottlenecks, department load, discharge blockers, KPIs vs the usual day | The overview has unbuilt codes | Waiting-on reasons, staff load, floor map |
| Security posture | Authz RFC, RLS on all tables, audit, MFA, SSO | — | A buyer-facing trust page (least-privilege production access) |

---

## 10. Top 10 opportunities (evidence strength × fit)

| # | Opportunity | Evidence | Fit |
|---|---|---|---|
| 1 | **Downtime-proof hospital.** Extend offline CRDT beyond 4 domains to registration, MAR and orders. Add an automatic read-only downtime snapshot (census, allergies, active meds, orders) printed or held locally every hour. | Ascension, AIIMS, Oracle 5-day outage (HN 174p), VA, rural internet | Very high. Edge and offline foundations already exist. |
| 2 | **ABHA at the counter, not the phone.** Assisted creation and verification for patients without smartphones (Aadhaar OTP or biometric fallback, kiosk mode). Finish ABHA V3 and M2/M3, which DHIS pays. | Gandhi Hospital queues, AIIMS kiosks, NHA admits small-clinic gap | Very high. Already the active loop. |
| 3 | **"Waiting on" chip plus bottleneck heatmap** in the command centre and OPD queue, including overnight stranded patients. | Game (inspiration), Meditech wants capacity built in, Delhi HC | High. `detect_bottlenecks` and `hourly_flow` exist. |
| 4 | **Bed truth with audit.** Reconcile bed board vs actual, with last-verified time and who verified it. | Delhi HC ICU denial (July 2026) | High. `bed_states` exist. |
| 5 | **Assist-only AI with mandatory `AiLabel` and an error-flag path.** Proposals with accept and diff; measure our own omission and hallucination rates. | Scribe studies (11.5% hallucinations), HN 157p thread | High. AiLabel exists but is used on one page. |
| 6 | **Click and alert budget telemetry.** Clicks per task and override rate per alert, shown to admins so they can tune. | Epic click culture, Ochsner 11M clicks, alert-fatigue literature | High. Fits the KPI framework. |
| 7 | **Migration kit.** Legacy HMS import (patients, visits, bills, stock) with a reconciliation report, and go-live in phases, not partial modules. | SDN transition dread, KLAS churn, Indian partial-go-live failures | Medium-high. |
| 8 | **Flat, published pricing with no per-interface fees.** Interface catalogue and health page. | Per-interface fee complaints, lock-in (HN), ₹10k anchors | Medium-high. Fits the facility-type pricing work. |
| 9 | **DPDP purpose-specific consent and breach workflow**, mapped to ABDM consent artefacts. | Law-firm commentary, ₹250 cr penalty | Medium. Partly built. |
| 10 | **Staff load and roster safety view.** Patients per nurse now, duty-hours guard, and alerts when a shift loses staff. | Game (inspiration), nurse understaffing comments on HN, Ascension huddles | Medium. Roster screen unbuilt. |

## 11. Five positioning lines

1. **"When the internet goes, the ward doesn't."** Offline-first charting and a downtime snapshot. Against: Ascension, AIIMS, cloud-only HMIS.
2. **"The bed on the screen is the bed in the ward."** Verified bed state with audit. Against: the Delhi HC ICU case.
3. **"ABHA at the counter in under a minute, smartphone optional."** Against: OTP and QR queues.
4. **"AI that drafts, labels itself, and waits for your signature."** Against: scribe hallucination stories.
5. **"Your data, your interfaces, no per-interface invoice."** Open standards (FHIR, HL7, DICOM) on PostgreSQL. Against: lock-in and per-interface fees.

---

## Method notes and limitations

- **No Reddit data** (see §0). Vote and comment signals are from HN and Steam only.
- **Weak sources.** Several Indian sources are vendor blogs. Ken Research numbers are undisclosed-method. These are flagged inline.
- **Repo mapping** is from a quick grep plus memory notes, not a full audit. Items marked "not confirmed" need a check before planning.
