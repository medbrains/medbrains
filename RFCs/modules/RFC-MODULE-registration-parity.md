# RFC — Patient registration: one definition, web + iOS + Android + server

**Status:** In progress (R0 + R1 + R2 in one PR; R3 native wizard next)
**Decided by the user, 2026-09-27:** native registration reaches **full web parity**, driven by **one shared field definition**; the **same standard rules on web too**. Old React Native apps are reference only.

## Why

The native apps had a one-screen intake: about 15 of the web's ~75 inputs, none of its five steps, and three safety defects — sex silently defaulted to "female", allergy status never asked, a referral without a referrer only refused by the server. The rules existed several times (web Zod, the web quick-register form, Rust for native, the server) and disagreed.

A runtime server-driven form builder was tried and removed (`c72246ec`) for drift. This is **compile-time**: the definition is Rust, everything else reads or is generated from it.

## Rules (the standard set, everywhere)

| Rule | |
|---|---|
| First name | required (unless *Unknown patient*), ≤ 100 |
| Last name | **optional** — single-name patients are common |
| Phone | required unless *Has no phone* (or unknown patient); 10–15 digits, `+ - ( )` and spaces allowed |
| Sex | must be chosen: female / male / other — no default; "unknown" only via *Unknown patient* |
| Date of birth or age | one is required (second identifier, NABH); age 0–125; age → 1 January, estimated |
| Allergies | *Not asked yet* / *No known allergies* / *Known allergies*; *Known* needs the list |
| Medico-legal | needs the MLC number |
| Email updates | need an email; preferring WhatsApp/email needs that consent |
| Referral (source, type or a non-self referrer kind) | needs a referrer: name, facility or doctor |
| Camp | camp chosen or named; sending a camp patient to OPD needs the camp itself |
| Send to OPD | needs the department |
| ABHA 14 digits · Aadhaar 12 digits · email shape · attendant passes a whole number |

An API caller that sends no allergy answer is recorded as *not asked yet* — honest, never "none".

## Where it lives

- **Definition:** `crates/medbrains-clinical-core/src/registration/` — `catalogue.rs` (types), `options.rs`, `fields_intake.rs` / `fields_more.rs` (the four steps; Review draws from the answers), `rules.rs` (the one evaluator), `fixtures.rs` (cases with expected problems).
- **Server:** `crates/medbrains-patients/src/registration_rules.rs` flattens the create request to dotted ids and asks the evaluator.
- **Native (iOS/Android):** UniFFI `registration_catalogue_json()`, `registration_problems`, `registration_visible_fields` and `registration_request_json` (all over `record<string,string>` drafts); the wizard (`RegisterPatientView` / `RegisterPatientScreen`) draws fields from the catalogue via shared `CatalogueFieldView`s and sends the core's request.
- **Web:** `scripts/generate_registration_catalogue.py` → `packages/schemas/src/registration.generated.ts` + `registration.fixtures.generated.json`; `registration-rules.ts` is the TypeScript port, held to the fixtures case for case (`registration-rules.test.ts`). The full form's and the quick form's Zod schemas both call it. `make check-registration-catalogue` (in `check-all`) fails when the generated files are stale.

## Phases

1. **R0** — safety fixes on native (sex, allergies incl. the known-allergies list, referral). *Done.*
2. **R1 + R2** — catalogue + evaluator; server, both native intakes and both web forms ask it; web rule changes (last name optional, *Has no phone*, sex no default, IST date fix). *Done.*
3. **R3a** — native wizard rendered from the catalogue (iOS + Android): all four steps drawn generically by field kind, Review, Unknown patient, Send to OPD (issues the token in the same act). The core also owns **visibility** (`show_when` / `hide_when`, `registration_visible_fields`), **starting values** (`default`, the web form's own) and the **request** (`registration_request_json`: dotted ids → nested JSON, age → estimated DOB, unknown patient, no phone). The one-screen `registration_problem` API is removed. *In review.*
4. **R3b** — camp mode (entry from the Camp module), camp and drug-catalogue option sources, ICD-11 picker.

## Verification

Rust rule tests (20) and fixture generation; server tests for every file that creates patients (26); web fixture parity (27 cases), package tests, the full-form and quick-form screens; Playwright `registration-rules.spec.ts` (single name + no phone, the desk told what is missing) with registration-consent and walk-in 3× green; native reception journeys on both platforms.
