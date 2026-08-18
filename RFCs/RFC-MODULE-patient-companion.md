# RFC-MODULE: Patient Companion — standalone health app, hospital link later, device last

**Status:** Planning. No code yet.
**Decisions taken (operator, 2026-08-18):** standalone first with a record-link seam; **wellness-only** for v1;
built in this monorepo under AGPL; ships to **both** self-serve users and hospital patients; **both light and
dark themes**; built inside `apps/mobile-patient` rather than a new app.
**Reference product:** [Helix](https://www.projecthelix.app/) — Apple Watch/iPhone fitness intelligence. Morning readiness score, per-muscle recovery, an AI coach that "answers with your actual numbers", runs phone-local with no backend.

---

## 1. What transfers from Helix, and what does not

Helix's real trick is not the wearable data. It is turning passive numbers into **one answer to "what should I do today"**. Everything else is in service of that.

| Helix | Us |
|---|---|
| No backend, no PHI, anonymised aggregates to the LLM | **Impossible.** Retention duties, audit, tenant RLS. Data cannot live only on the phone once a record is linked. |
| Must *infer* what matters from biometrics | We have a clinician's actual care plan — `chronic_enrollments`, `adherence_records`, `patient_outcome_targets`, polypharmacy alerts |
| Readiness score → training advice | Adherence + trend → **explanation, not advice** (see §3) |
| Apple Watch + iPhone only, iOS 18+ | Phone-first, wearable optional, device ours in phase 3 |

The asymmetry is the opportunity: Helix has to guess what a number means. We are told, by the person who wrote the prescription.

---

## 2. Two tensions found while planning — neither blocks, both need a decision recorded

**2.1 AGPL and the App Store.** Apple's distribution terms conflict with GPLv3/AGPLv3 (the FSF's position; VLC was pulled in 2011 over GPLv2). An AGPL binary is not straightforwardly shippable on the App Store. **Resolution:** the copyright is ours, so we dual-license exactly as MedBrains already does — repo stays AGPL for others, our binary ships under our commercial licence. This works *only* while every dependency is ours or permissive. Pulling in one third-party GPL/AGPL library breaks it. Worth a `LICENSING.md` in the app and a dependency-licence check in CI before the first store submission.

**2.2 The stack has already diverged from the approved RFC.** CLAUDE.md records React Native CLI (bare) as APPROVED and Expo as the superseded draft. In practice **four of five mobile apps are Expo** — `mobile-patient`, `mobile-staff`, `mobile-camp`, `mobile-vendor`; only `apps/mobile` is RN CLI. This matters specifically because of phase 2: Expo has no first-party HealthKit module, so wearable ingest needs a config plugin plus a dev build (`@kingstinct/react-native-healthkit` or equivalent), where RN CLI has direct native access. **Decide before phase 2, not during it** — either bless Expo in the RFC and accept the plugin path, or move this one app to bare.

---

## 3. Regulatory position — wellness only, and it has to be a code boundary

v1 is **not** a medical device. The moment we tell a diabetic that a glucose trend suggests a dose change we are SaMD — CDSCO (India), MDR Class IIa (EU), FDA (US).

**In scope:** trends, summaries, adherence nudges, appointment and refill reminders, education, "your doctor set this target, here is where you are".
**Out of scope, explicitly:** diagnosis, triage, dosing, "should I go to hospital", interpreting an abnormal result.

This is a safety boundary, so it does not live in a policy document — it lives in code and in tests:

- The AI layer takes a **refusal list** and must decline dosing/diagnosis/triage with a fixed, tested response.
- Refusal is a unit test per category, not a prompt instruction. A prompt is not a control.
- **The grounding gate must fail closed.** This sweep already found the clinical grounding gate answering *ungrounded* when the database faulted — a fluent answer with the chart silently missing. Patient-facing, about medication, that is the failure that ends the product. `make check-authz-collapse` and `check-query-collapse` exist for exactly this shape; the companion's own grounding path needs the same treatment before a single user sees it.

Even wellness-only, keep the audit trail, versioned algorithm IDs and input traceability that a device submission would need. Retro-fitting provenance is a rewrite.

---

## 4. The starting point is better than "nothing"

`apps/mobile-patient` is **not** a skeleton. It already has:

- OTP auth against `/api/portal/auth/request-otp` + `/verify`
- Six modules: appointments, bills, consent, family-share, lab-reports, prescriptions
- `expo-secure-store` (token storage), `expo-local-authentication` (biometric unlock), `expo-notifications`
- `@medbrains/{api,types,ui-mobile,mobile-shell}`, TanStack Query, Zustand, Paper v5

That is the **linked** half already built. "Standalone first, link later" therefore does not mean starting from zero — it means the engagement loop is the new part, and this app is what phase 2 connects to. The login gate inverts: today the app cannot start without a hospital; it must become a hospital-optional app that *can* link.

---

## 5. Architecture — standalone core, link as a seam

```
┌─ engagement core (new, phone-local, no hospital) ──────────┐
│  local store (SQLite/WatermelonDB) · daily brief · streaks │
│  goals · reminders · trends · education                    │
└──────────────────┬─────────────────────────────────────────┘
                   │ RecordSource trait — the seam
        ┌──────────┴───────────┬──────────────────┐
   ManualEntry            MedBrainsPortal      HealthKit /
   (phase 1)              (phase 2, exists)    Health Connect (phase 2)
                                               └── DeviceBridge (phase 3)
```

One rule: **the core never imports a source.** It consumes `RecordSource`. That is what keeps the app sellable to someone with no hospital, and what makes phase 3 an added implementation rather than a rewrite.

Local-first, sync optional. Unlinked, nothing leaves the phone — which is also the cheapest possible privacy story to tell a consumer, and the honest one.

---

## 6. Two audiences, one app

The operator's call: this ships to **both** self-serve users and hospital patients. They are not the same person and the app must not pretend they are.

| | Self-serve | Hospital patient |
|---|---|---|
| How they arrive | App store, found via content | Hospital hands them the app |
| Identity | Local, no account needed | OTP against the tenant portal — **exists today** |
| Their record | What they type + wearable | Their actual chart, plus what they type |
| What the daily loop says | "You vs you", personal baselines | Same, plus "your doctor set this target" |
| Who pays | Them | The hospital |

The existing six modules (appointments, bills, consent, family-share, lab-reports, prescriptions) already serve the hospital patient. What neither audience has is a **reason to open the app on a day nothing is scheduled**. That is the daily loop, and it is phase 1 for both.

**Theme: both light and dark**, also the operator's call. Helix, Whoop and Oura are dark because a consumer health app is opened at 6am and 11pm. `buildDeviceTheme` already supports both. This contradicts CLAUDE.md's "Light theme only", which is written for the clinical web surface — **that rule needs scoping to the staff/web surfaces explicitly**, or this app is permanent drift. Amend it as part of phase 1, do not just diverge.

---

## 7. What to take from the reference, and what to leave

Their information design is excellent and is not the protectable part. Their naming and their fitness domain are theirs.

**Take — interaction and information design:**
- One hero number with a **one-sentence verdict** in plain language. Not a dashboard of twelve numbers.
- **Baseline and confidence chips** ("Established", "84-day baseline"). The app says how much it trusts itself, which is the honest version of a score.
- **"You vs you"** — personal rolling baselines rather than population percentiles. Correct for health as well as fitness, and it dodges the "am I normal" trap that invites diagnosis.
- Dense dark cards, each a single idea, each tappable into detail.
- Bottom tabs, four plus an AI entry point.

**Take — the calculator set.** Thirty-five tools, and a dozen are genuinely clinical and built on published formulas anyone may implement: **CKD-EPI 2021** (eGFR), **Du Bois / Mosteller** (body surface area), **Devine** (ideal weight), **Mifflin-St Jeor** (BMR), **Karvonen** (target heart rate), BMI, due date, ovulation, sleep debt. For a hospital patient with kidney disease, their own eGFR trend is genuinely useful. **They need triaging first** (§3): a BMI calculator is reference; an eGFR result is a clinical interpretation and must be framed as "what your last lab said", never "your kidney function is X".

**Leave:**
- Their naming — Training Lab, VO₂MAX Lab, Energy Schedule, Load Balance are their product's trade dress.
- Muscle recovery maps, strain, training programmes. That is a fitness app; it is not what a hospital gives a patient.
- The comparison-blog engine (~83 posts of "WHOOP vs Oura"). That is *their* acquisition model for a no-backend consumer app. Ours is a hospital handing out the app plus condition-led content, which is a different funnel.

---

## 8. Phases

**Phase 0 — foundation. Done.**
`src/health/`: record types, `RecordSource` seam, phone-local store, merge policy and history cap under test.

**Phase 1 — the daily loop.** The reason to open the app on a quiet day.
- `Today` screen: hero ring, one-line verdict, baseline/confidence chip, cards for the day's medications, latest observations, next appointment.
- Manual entry: medications with reminder times, observations with explicit units.
- Adherence: taken / skipped / missed, and a streak built from it.
- **Both themes**, and the CLAUDE.md amendment that makes dark legitimate here.
- Works with no hospital. For a linked patient the same screen is fed by their chart.
- Exit criterion: a person with no hospital finds it worth opening daily.

**Phase 2 — trends and the content engine.**
- Trends tab: per-observation charts against personal baselines, `@mantine/charts` equivalent for RN.
- Calculators, triaged per §3 — reference tools ship, clinical-interpretation tools ship only with framing.
- Condition-led guides (hypertension, diabetes, pregnancy) rather than gear comparisons.
- This is the self-serve acquisition surface and the hospital's patient-education surface at once.

**Phase 3 — deepen the link.** The portal API already exists; this is about the daily loop consuming it.
- `PortalSource` implements `RecordSource` over the existing six modules.
- The clinician's care plan becomes the app's goals — the single biggest advantage over any consumer product.
- Login gate inverts: hospital-optional rather than hospital-required.

**Phase 4 — wearable.** HealthKit / Health Connect as a `RecordSource`. Decide Expo-vs-bare first (§2.2).

**Phase 5 — device.** Ours, over `medbrains-bridge`. **Decide the SaMD question here** (§3).

Phases 1–2 must stand alone commercially. If they do not, 3–5 are subsidising a product nobody wanted.

---

## 9. Device path — finish what exists, do not invent it

`medbrains-bridge` already does HL7 ingest: `hl7_listener.rs`, `ingest.rs`, `buffer.rs`, `heartbeat.rs`, `transport/`. It posts to `/api/device-ingest/{module}`.

**It sends no credential.** Verified: there is no `Authorization` header anywhere in the crate, and the route sits behind auth middleware, so it 401s and `device_messages` has zero rows. The fix is an API key holding `devices.ingest` — the machine-identity path already exists. Do this before designing hardware, not after; it is the difference between a pipeline that has never run and one that works.

Note the bridge is **biomedical HL7 kit**, not consumer wearables. Different pipeline, different phase. Do not conflate them.

---

## 10. What to reuse, and what not to

**Reuse:** `@medbrains/types` (Zod + TS contracts), `@medbrains/api`, `@medbrains/ui-mobile`, the Carbon design tokens, the portal API surface, `expo-secure-store`/`local-authentication` patterns already working in this app.

**Do not reuse:** the tenant/RLS model. A standalone user has no tenant. Forcing one produces a fake tenant per user, which corrupts every downstream count and every RLS assumption in the HMS. The standalone core owns its own identity and *maps* to a patient only on link.

---

## 11. Open questions

1. **Expo or bare RN** for this app (§2.2) — blocks phase 4, not phase 1.
2. **Pricing.** Helix does not publish one. Subscription, one-off, or hardware-subsidised?
3. **India first?** ABDM/ABHA is already integrated (`abdm.abha.*` permissions exist and are now grantable) — a standalone app that can pull a real ABHA record is a materially stronger phase-3 story than a single hospital link.
5. **Which calculators ship, and how framed.** Thirty-five exist in the reference; a dozen are clinically useful and built on published formulas. eGFR via CKD-EPI is the sharp case: useful to a renal patient, and one careless sentence away from being a diagnosis.
6. **CLAUDE.md amendment for the theme rule** (§6) — scope "light theme only" to the web/staff surfaces, or this app is drift rather than a decision.
4. **Who owns the refusal list** (§3) — it needs a clinician's sign-off, not an engineer's judgement.
