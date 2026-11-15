# RFC: MedBrains for the world (locale profile and country packs)

Status: DRAFT, awaiting owner review · Owner: Domnic Amalan S · 2026-11-15 · Issue #5925, epic #5936,
exchanges #4917, meter #5937

## 0. First principle

**Fit any hospital in any country; never weaken a security or compliance floor.** (Owner,
2026-11-15: "we need a strong product that fits anything without compromising security and
compliance".) Every choice below is judged against both halves: a design that fits a country by
lowering a floor is refused, and a floor that blocks a country is met by adding, never by removing.

## 1. Goal and non-goals

**Goal.** The core assumes no country. A hospital picks a country (and, where rules differ inside it,
a region) and gets that country's identifiers, addresses, phone numbers, money, dates, tax,
controlled-drug rules, accreditation framework, retention minimums, hosting limits, languages and
exchange adapters. India becomes one country pack among many.

**Non-goals.**

| Not doing | Why |
|---|---|
| Change what an Indian hospital sees or does | The India pack reproduces today's behaviour; its golden tests are written from today's output before any sweep moves code |
| Per-country forks of screens, crates or apps | One screen, driven by the profile and the pack (ENGINEERING "share, never copy"; #4917 "clinical screens never change per country") |
| Multi-currency inside one hospital (billing a patient in two currencies) | No customer asks for it; one functional currency per hospital (§2.4); revisit with evidence |
| Translating clinical content (drug monographs, SNOMED descriptions) | Terminology is its own stream; this RFC covers UI strings and formatting |
| Claiming any country is "certified" | Honesty rule from #4917: "built for" until an authority certifies |

## 1a. Security and compliance floor

A country pack or a setting may only **add** restrictions, never remove them. The floor is code in
`medbrains-country` (`floor.rs`), not pack data, and no pack, setting, flow or plugin can lower it
(RFC-HOSPITAL-OS §3.3: flows and plugins can add checks, never remove them).

| Floor (universal) | What no pack or setting can do | What a pack may add |
|---|---|---|
| Audit logging | switch off or shorten the append-only, hash-chained audit of state changes and PHI reads | extra audited events, national audit export |
| Consent | skip consent capture or checks where the core requires them | stricter consent (per-purpose, guardian rules, re-consent periods) |
| Encryption at rest and in transit | allow plaintext storage, plaintext transport or weaker ciphers | stronger algorithms, in-country key custody |
| Permissions and authorisation | bypass `kernel::authorize`, collapse `Unknown` into allow, widen a role | extra permissions, stricter field classes |
| AI per-item accept | save AI text without per-item human accept (RFC-AI-CLINICAL-FLOWS §10.0) | extra AI restrictions, AI off |
| Controlled-drug gates | drop the floor gates (`rx_required` + `dual_sign` + `register_entry` for any `is_controlled` item) | more schedules, more gates, national reporting |
| Data residency | loosen a hosting rule set by the tenant, the install or a stricter pack | in-country only, region lists, backup location rules |
| Retention minimums | go below the floor minimum per record class | longer minimums, legal hold rules |

**Enforcement.**

- The loader checks every pack against the floor: a pack whose rules are not a superset of the floor
  **fails to load**, so the build fails (packs are compiled in, §3.2) and a runtime pack is refused.
- Settings are checked the same way at save time: a value below the floor is refused with the reason,
  never clamped silently.
- Each pack ships a **floor test** (§3.4) proving its rules are a superset of the floor; the `world`
  pack is the floor itself plus nothing.
- A change to the floor is a kernel-grade change: two reviewers, a stated reason, a DECISIONS.md
  row; it may only be raised, never lowered, without an owner-approved reversal row.

## 2. The tenant locale profile

### 2.1 What exists today (four sources that disagree)

| Where | What it holds | Problem |
|---|---|---|
| `tenants` columns (`0110_core.sql`) | `timezone` default `Asia/Kolkata`, `locale` `en-IN`, `currency` `INR`, `fy_start_month` 4, `country_id` | India defaults in the schema; no facility level |
| `tenant_settings` categories `units`, `locale` | measurement units, `date_format` | Only `date_format` is read from `locale`; currency, timezone, locale never are |
| `geo_countries` | `currency`, `phone_code`, `default_locale`, `default_timezone`, `date_format`, `measurement_system` | Good per-country defaults, not used to seed a tenant |
| `packages/stores/src/locale-store.ts` | `DEFAULT_CONFIG` with `INR`, `Asia/Kolkata` | `ProtectedRoute` swallows a load failure ("defaults will be used"), so a Dubai tenant silently becomes Indian |
| `hospital_groups` | `default_currency` `INR`, `timezone` `Asia/Kolkata` | Third copy |

### 2.2 Decision: one profile, in the kernel's configuration tree

The profile is a set of setting paths read only through `kernel::config::get` (RFC-HOSPITAL-OS §3.1
item 8). Nothing reads `tenants.timezone` and friends after the sweep; those columns are backfilled
into `tenant_settings` by one migration, then dropped when the last reader moves (#5928).

| Path | Type | Default source | Example |
|---|---|---|---|
| `locale/country` | ISO 3166-1 alpha-2 | onboarding (required, no default) | `IN`, `AE` |
| `locale/region` | ISO 3166-2, optional | onboarding | `AE-DU` (Dubai rules differ from `AE-AZ`) |
| `locale/pack_version` | semver | pack at install | `1.4.0` |
| `locale/currency` | ISO 4217 | pack | `INR`, `KWD` |
| `locale/locale` | BCP 47 | pack | `en-IN`, `ar-AE` |
| `locale/languages` | ordered BCP 47 list | pack | `["en","hi","ta"]` |
| `locale/timezone` | IANA zone | pack (first zone; required choice if the country has several) | `Asia/Dubai` |
| `locale/calendars` | primary + display-only extras | pack | `{"primary":"gregory","also":["islamic-umalqura"]}` |
| `locale/hour_cycle` | `h12` / `h23` | locale (CLDR) | `h23` |
| `locale/week_start` | weekday | locale (CLDR) | `sat` |
| `locale/fiscal_year_start` | month 1–12 | pack | `4` (India), `1` (UAE) |
| `locale/name_order` | `given_family` / `family_given` | pack | |
| `units/*` | existing keys, unchanged | pack | metric |

**Scopes.** Resolution is most specific first, as the kernel already promises:
`user › facility › hospital › pack default`. Today the resolver reads only `hospital`
(`RESOLVED_SCOPES` in `crates/medbrains-kernel/src/config.rs`); the facility scope (at least for
timezone and region) is built now, inside #5926, not deferred to K3. Which fields each scope may set:

| Field | Hospital | Facility | User |
|---|---|---|---|
| country, region, currency, pack_version | yes | region and timezone only (a group with sites in two emirates or US states) | no |
| timezone | yes | yes | no: clinical times show in the facility's zone, never the device's (§4.2) |
| locale, languages | yes | yes | language only |
| hour_cycle, calendars `also` | yes | yes | yes (display preference) |

A **different country per facility is not allowed in one tenant**: currency, tax and retention are
hospital-wide. A group across countries is **one tenant per country** under `hospital_groups`;
group reports aggregate across those tenants, each figure labelled with its currency (§6).

### 2.3 How each surface reads it

| Surface | How | When it cannot get it |
|---|---|---|
| Server | `kernel::config::get(&tx, "locale/…")`, memoised once per unit of work (one lookup per request, not per row) | `Unknown`: the request fails with a clear error; never falls back to India |
| Web | `GET /api/auth/me` gains `locale_profile` (resolved for the user's facility), so it is one round trip, not the two extra `getTenantSettings` calls `ProtectedRoute` makes today | Neutral render (ISO codes, UTC labelled "UTC") plus a banner "Hospital settings did not load"; `DEFAULT_CONFIG` loses its India values |
| iOS / Android | same field from `/auth/me`, cached with the session as last-good (SwiftData / Room) | last-good; on a first launch with none, the neutral render, as on web |
| Print (`medbrains-print-data`) | the server resolver, then the shared server formatter (§4) | print fails; `set_print_timezone` already refuses an unknown zone ("a wrong time on a legal document is worse than no document") |
| Jobs, HL7, CLI | the server resolver inside `kernel::work` | as server |

### 2.4 What happens on change

| Change | Rule |
|---|---|
| Language, hour cycle, display calendars | Immediate; clients refetch `/auth/me` on the settings save |
| Timezone | Allowed with second-person approval. Stored times are `timestamptz`, so history re-renders correctly; wall-clock settings (doctor schedules, shift times, report cut-offs) are listed on the confirm screen for review. Audited |
| Country, region, pack version | Through a knowledge change set (`RFC-KNOWLEDGE-CHANGE-SETS.md`): preview of rules that switch on and off, second-person approval, apply, rollback. It switches regulatory gates, so one person cannot do it alone |
| Currency | Refused once any financial row exists. Only 3 of 249 money columns carry a currency; amounts are in the hospital's functional currency by definition, so changing it would relabel every past invoice |

**Permission first:** `admin.locale_profile.update` (country, region, currency, timezone, pack) is
defined in `crates/medbrains-core/src/permissions.rs` before any handler, granted to
`hospital_admin` only, and separate from the general settings code so it cannot be held by
accident. Every change it covers needs a **second person's approval** (separation of privilege) and
is audited with before and after values. Language and display preferences stay on the existing
settings and profile codes.

## 3. Country packs

### 3.1 What a pack declares

| Area | Declared as data | Implemented as code (named by the pack) | Today's India source |
|---|---|---|---|
| Identifiers | scheme id (`in.aadhaar`), label, FHIR system URI, regex, which checksum, masking rule, required/optional at registration, data class (§ authz field classes) | checksum algorithms: Luhn, Verhoeff, mod-11, mod-97, ISO 7064 | `IdentifierType` enum (`patient.rs`, already has `NhsNumber`, `EmiratesId`, `Iqama`) |
| Address | admin level names and count (1–4), which are required, postal code regex and label, line-order template, source of level data (LGD for India) | none | `geo_states/districts/subdistricts/towns`, `pincode` columns |
| Phone | default calling code, mobile prefixes for SMS eligibility | E.164 parse/validate on the server (`phonenumber` crate, new dependency, server only) | `+91` literals (108 lines) |
| Tax | scheme id, rates with `effective_from`, exempt/zero-rated service classes, invoice fields, registration number format | tax schemes behind one trait: `in_gst` (CGST/SGST vs IGST by place of supply), `vat` (UAE 5%, KSA 15%, zero-rating), `none` | `tax_categories`, `gst_invoice_print.rs`, `gst_return_summaries` |
| Controlled drugs | schedule codes and labels, and per schedule a set of gates from a fixed vocabulary: `rx_required`, `register_entry`, `dual_sign`, `dual_lock_storage`, `duplicate_copy`, `max_supply_days`, `no_refill`, `id_check`, `report_to(adapter)` | each gate is code in `medbrains-pharmacy-safety`; packs can switch gates on, never define new ones | `drug_schedule` text + `is_controlled`, NDPS/Schedule H/H1/X in pharmacy |
| Accreditation | frameworks available (NABH, JCI, CBAHI, CQC, TJC, ACHS…), each as chapters → standard codes → the MedBrains evidence query that answers it | evidence queries (shared across frameworks where the measure is the same) | `medbrains-nabh` (`norms.rs`, `compliance.rs`), NABH in 178 files |
| Record retention | minimum years per record class, legal-hold rule | the MRD retention job | `mrd.rs` `retention_years` |
| Hosting | allowed regions, in-country requirement, backup location rule | install refuses (#5924) | none |
| Languages | official and common languages, default script | none (string files are per language, shared by every country) | `apps/web/public/locales/{en,hi,ta,ar}` |
| Exchanges | per capability (#4917: identity, record push/fetch, e-prescription, eligibility, prior auth, claims), the adapter id | adapters behind the exchange-layer trait (planned `RFC-EXCHANGE-LAYER.md`, #4917 step 2) | `medbrains-abdm`, NHCX |
| Calendar, fiscal year, name order, units | values feeding §2.2 defaults | Bikram Sambat converter (§4.3) | `fy_start_month` 4 |

**Why gates are code, not data.** RFC-HOSPITAL-OS §3.3: "Safety-critical gates are kernel or
service code, never configuration." A pack can only pick from gates that exist and are tested;
a pack typo cannot remove the NDPS dual-lock, because the India pack's golden test fails.

**A base pack, `world`,** applies when a country has no pack yet: passport and generic national ID,
E.164 phone, free-text address with postal code, tax off, controlled flag with `rx_required` +
`dual_sign` + `register_entry` (the §1a floor), no accreditation framework (JCI selectable), retention at the strictest common minimum,
no exchange adapters. It is honest about what it lacks: those capabilities are not offered
(#4917).

### 3.2 Where packs live

| Item | Location | Reason |
|---|---|---|
| Pack data | `medbrains/packs/<cc>/pack.toml` + `packs/<cc>/geo/*.csv`, `packs/world/` | Reviewable in git, diffable, no DB edit by hand ("setup lives in git") |
| Loader and traits | new service crate `medbrains-country` (not the kernel: `make check-kernel-no-domain`) | Packs are domain; the kernel stays technical |
| Embedding | packs compiled in with `include_str!` and parsed once at start into an immutable map keyed by country (hash lookup per request) | No runtime file reads; a broken pack fails the build, not a ward |
| Runtime packs (later) | loadable at runtime only when **signed**, verified like OS updates (same signing chain and refusal path, RFC-HOSPITAL-OS §8b/§8j), then floor-checked (§1a) and applied through a change set; an unsigned or unverifiable pack is refused | Partners can ship a country without a release, without opening a tampering path |
| Native | the same data and validators reach iOS and Android through the Rust edge core (`medbrains-edge-rn`, UniFFI) so offline registration validates exactly as the server does | No Swift/Kotlin copies of rules |
| Web | validators in `@medbrains/utils` (the five checksums, ~100 lines), checked against the same golden vectors as Rust | Server stays the authority; web gives instant feedback |
| Country list | `data/geo/countries.json` (exists, feeds `scripts/seed_world_geo.py`) stays the 195-country list; a `research` field per country feeds the meter's "N of 195 researched" | Reuse, not a new matrix |
| Exchange adapters | their own crates, as today (`medbrains-abdm`) | Per #4917 |

### 3.3 Versioning

- A pack is semver. **Major**: a rule gets stricter or a field becomes required. **Minor**: a new
  scheme, framework or adapter. **Patch**: labels, regex fixes.
- Every rate and rule carries `effective_from` (and optional `effective_to`). A record keeps what
  applied when it was made: invoice lines already store the applied tax percent; a reprint never
  recomputes with today's rate.
- A tenant pins `locale/pack_version`. A release may bring a newer pack; the upgrade is a change
  set (§2.4) showing the diff. A dated legal change (a new GST rate) applies automatically on its
  date **only from a pack version the hospital approved through a change set beforehand**; the
  preview shows the future-dated rule and its date. Nothing changes silently.

### 3.4 Tests every pack ships

| Test | Fails when |
|---|---|
| Schema lint (`make check-packs`) | a field is missing, a gate id is unknown, a regex does not compile, a rate has no date |
| Identifier vectors (valid and invalid samples per scheme), run by Rust and Vitest | either implementation disagrees |
| Format goldens: an amount, a date-time, an address, a name in each pack locale, on web, iOS, Android and print | output differs from the golden |
| Tax golden: one worked invoice per scheme | totals or invoice fields differ |
| Switch-on test: a tenant picks the country, and its gates, schemes and adapters are active; picking `world` turns them off | a rule does not follow the country |
| India no-change test: today's outputs (written before the first sweep) still match | any Indian behaviour changed |
| Adapter stand-in tests (per #4917) | an adapter breaks its spec |
| Floor test (§1a): the pack's rules are a superset of the floor, every floor gate present | the pack lowers or omits any floor; the loader refuses it |

## 4. Formatting and parsing

### 4.1 One helper set per platform, over the platform's own CLDR engine

| Platform | Home | Built on | Replaces |
|---|---|---|---|
| Web | `@medbrains/utils` `format/` (`formatMoney`, `formatDate`, `formatDateTime`, `formatTime`, `formatNumber`, `formatName`, `formatAddress`, `formatIdentifier`) reading the profile from the locale store | `Intl.*` (installed, free) | `formatDate`/`formatDateTime` hard-coded to `en-IN` in `packages/utils/src/index.ts`; 7 local copies (`formatInr` ×3, `formatMoney` ×3, `formatRupee` ×1); 348 bare `toLocaleString()` |
| iOS | `MedBrainsKit` `Format` | Foundation `FormatStyle` | `₹` literals in Patient app views |
| Android | `kit` `Format` | `android.icu` / `java.time` | `"₹%.2f".format(...)` in 9 files, which also does money in `Double` |
| Server / print | `medbrains-country::format` | ICU4X 2.x numbers (`icu_locale_core` 2.4 is already in the lockfile via `idna`; adds `icu_decimal` with baked data for pack locales only, inside the OS size budget, RFC-HOSPITAL-OS §3a). Stable ICU4X has no currency formatter, so each pack declares its currency symbol and placement; the zone maths runs in Postgres (`PrintZone`, one offset per timestamp) | `IST_OFFSET_SECONDS`-style constants (22 lines), the single-offset ceiling noted in `set_print_timezone` |

Rules:

- **Money** is a decimal string plus an ISO 4217 code end to end, never a float. Minor units come
  from ISO 4217: JPY 0, INR/AED 2, **KWD/BHD/OMR 3**. Today 233 of 249 money columns are
  `numeric(_,2)`: they cannot hold fils. They are widened to 4 decimals in #5927 (§6), which also
  leaves room for unit prices finer than the currency's minor unit.
- **Times** are stored UTC (`timestamptz`) and shown in the **facility's** zone. When the device's
  zone differs, the zone abbreviation is shown. Date-only values (date of birth, LMP) are `date` and
  are never shifted by a zone.
- **Numbers**: grouping follows the locale, so lakh/crore grouping (`12,34,567`) comes from `en-IN`
  for free. The words "lakh" and "crore" are India-pack strings.
- **Names**: stored as parts (given, middle, family, and pack-declared extras such as a patronymic);
  `formatName` orders them by `name_order`. No screen concatenates `first + " " + last`.
- **Addresses**: `formatAddress` uses the pack's line template and level labels ("Emirate",
  "County", "District").
- **Parsing**: amount and number inputs parse with the same locale (Mantine `NumberInput` gets the
  locale's separators); dates are entered with the date pickers, never parsed from free text.
- **Banned** (by the ratchet, §5): bare `toLocaleString()`, `toLocaleDateString()` without the
  helper, `new Intl.*` outside the helper module, literal currency symbols.

### 4.2 Right to left

| Surface | How |
|---|---|
| Web | `dir` on `<html>` from the language (`RTL_LANGUAGES` in `apps/web/src/i18n.ts` exists), Mantine `DirectionProvider`; SCSS uses logical properties (`margin-inline-start`), with a ratchet on physical `left/right` in SCSS |
| iOS / Android | system layout direction (SwiftUI and Compose mirror automatically); directional icons flip, clinical icons (body side, laterality) never do |
| Print | the template sets `dir`; numbers, UHIDs, doses and lab values are wrapped as LTR isolates so "5 mg" never renders as "mg 5" |
| Body-site atlas | left/right is the patient's anatomy, not the reading direction: never mirrored |

### 4.3 Calendars

Storage is always Gregorian. Other calendars are **display only**, shown beside the Gregorian date
on screens and print where the profile asks.

| Calendar | Countries | Web | iOS | Android | Server |
|---|---|---|---|---|---|
| Hijri (Umm al-Qura) | KSA, Gulf | `Intl` `islamic-umalqura` | `.islamicUmmAlQura` | ICU `IslamicCalendar` (umalqura) | ICU4X |
| Bikram Sambat | Nepal | not in CLDR on any platform: one table-driven converter (published month lengths per year) in Rust, exposed to native through the edge core, with the table as JSON for web; shared golden vectors | | | |
| Others (Persian, Thai Buddhist) | when a pack asks | CLDR on every platform | | | |

The Bikram Sambat table is bounded (2000–2100 BS); a date outside it shows Gregorian only.

## 5. Migration order, the ratchet and the world meter

### 5.1 Where the hard-coding is (measured 2026-11-15, files, tests/SQL/JSON/MD and outgoing React Native excluded)

| Literal | web pages | web other | crates | iOS | Android | Main place |
|---|---|---|---|---|---|---|
| `₹` | 115 | 34 | 35 | 8 | 7 | web pages; payment-gateway, billing, pharmacy crates |
| `en-IN` | 45 | 27 | 4 | 0 | 0 | web |
| `Asia/Kolkata` / `+05:30` | 2 | 0 | 25 | 0 | 0 | server, shell, platform; 22 IST offset constants (NHCX is right to keep its own; `hl7_adt/build.rs` is not) |
| bare `toLocaleString()` | 167 | 46 | 0 | 0 | 0 | web pages |
| Aadhaar | 3 | 13 | 43 | 5 | 5 | server, core, abdm, patients |
| PIN code | 21 | 7 | 55 | 7 | 6 | crates |
| `+91` | 8 | 3 | 23 | 0 | 0 | crates |
| CGST/SGST/IGST/GSTIN | 12 | 0 | 21 | 0 | 0 | billing |
| NDPS/CDSCO/Schedule H/X | 20 | 18 | 45 | 0 | 0 | pharmacy, core |
| NABH | 34 | 17 | 102 | 1 | 0 | clinical-scores (17), core, print-data |

Line totals are in #5936 (₹ 1,485 lines in 270 files; NABH 427 in 178; Aadhaar 524 in 113).

### 5.2 Order

| Step | Ticket | Why here |
|---|---|---|
| 0 | #5925 this RFC | Agree the shape before moving 1,500+ lines |
| 1 | #5935 ratchet | Stops the count growing while the sweeps run |
| 2 | #5926 profile + helpers on all four platforms + `medbrains-country` with the `india` and `world` packs (loader, lint, India goldens recorded) | Every sweep below calls these; goldens must be recorded before any code moves |
| 3 | #5927 currency | Largest count, mostly mechanical once `formatMoney` exists; includes the planned migration widening money columns to 4 decimals, run in a maintenance window (§6) |
| 4 | #5928 dates, times, `en-IN`, bare `toLocaleString()` | Second largest, mechanical; adds `chrono-tz`, removes the IST constants outside India adapters, drops the `tenants` locale columns |
| 5 | #5929 identity | Needs the pack's schemes; freezes the `identifier_type` enum and adds a `scheme` column (backfilled from the enum), so a new country never needs `ALTER TYPE` |
| 6 | #5930 address and phone | Geo tables become generic admin levels 1–4 with pack labels; `pincode` becomes `postal_code`; phones stored E.164 |
| 7 | #5931 tax | `in_gst` and `vat` behind the trait; `invoice_items`' `cgst/sgst/igst_amount` columns become generic per-line tax components (scheme, component, rate, amount), backfilled; GST printing moves into the India pack |
| 8 | #5932 drug schedules | Gate vocabulary first, then India's H/H1/X/NDPS mapped onto it with the no-change test, then other packs |
| 9 | #5933 accreditation | NABH becomes the first framework file; evidence queries shared |
| 10 | #5934 translations and RTL | Needs strings extracted and helpers in place; last because every earlier sweep touches the same screens |

Each sweep ships server, web, iOS, Android and print together, verified on screen as the role that
uses it, with goldens for India and at least one other pack (Every Change Ships Its UI).

### 5.3 The ratchet (#5935)

- `scripts/check_world_literals.py`, `make check-world-literals`, in CI, same pattern as
  `check_ui_seam.py`: a per-file, per-pattern baseline in `scripts/world_literals.baseline.json`,
  generated with `--update`. A file's count may only go down; a new file starts at zero.
- Patterns: the rows of §5.1, plus `new Intl.` outside `@medbrains/utils/format`, `"INR"`, and
  Indian state names.
- **Allow-list** (paths where an India literal is correct), each entry with a one-line reason in the
  script: `medbrains/packs/in/**`, India exchange adapters (`medbrains-abdm`, NHCX), India-only
  translation keys under an `in.` namespace, the migrations archive (history is not edited).
  Adding an entry needs a DECISIONS.md row in the same PR. Tests and fixtures are excluded by path,
  not by allow-list.
- `--count` prints the live total outside the allow-list; the meter shows it beside its baseline.

### 5.4 The world meter (#5937)

Meter `world` in `medbrains/docs/readiness.json` (existing evidence rules: a merged PR, a file, or a
named test; nothing typed by hand):

| Item | Ticket | Weight | Done when |
|---|---|---|---|
| `rfc` | #5925 | 1 | this file merged, row in DECISIONS.md |
| `ratchet` | #5935 | 1 | `check_world_literals.py` in CI with baseline |
| `locale-profile` | #5926 | 3 | `/auth/me` profile + helpers on 4 platforms + `india`/`world` packs, named switch-on test |
| `currency` | #5927 | 3 | ₹/INR at zero outside the allow-list (ratchet count) |
| `dates-times` | #5928 | 3 | `en-IN`, Kolkata, bare `toLocaleString()` at zero |
| `identity` | #5929 | 2 | `scheme` column + vectors for India and one other pack |
| `address-phone` | #5930 | 2 | E.164 + pack address goldens |
| `tax` | #5931 | 2 | `in_gst` and `vat` goldens |
| `drug-schedules` | #5932 | 3 | gate vocabulary + India no-change test + one other pack |
| `accreditation` | #5933 | 2 | NABH as framework data + one other framework |
| `translations-rtl` | #5934 | 3 | Arabic end to end on web, iOS, Android and print |

Partial = merged PRs exist but the ratchet for that row is above zero. Meter `countries`: one item
per country, done when its pack passes §3.4 and its adapters pass their stand-ins; partial when at
least one adapter is built. India starts partial (ABDM PRs as evidence).

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Money columns are `numeric(_,2)` (233 of 249) | A Kuwaiti, Bahraini or Omani hospital cannot record fils | Widen every money column to 4 decimals in one planned migration inside #5927, run in an announced maintenance window (a table rewrite on large tables); values round-trip unchanged, proven by a before/after checksum per table |
| Stored amounts carry no currency (3 currency columns) | Changing currency relabels history | Currency fixed after the first financial row (§2.4); exports and FHIR resources take the code from the profile |
| Identifier data migration | Aadhaar numbers, ABHA ids must not change, lose their hash or verification | Additive `scheme` column backfilled from the enum; `id_number_hash` and verification untouched; enum dropped only after every reader moves |
| Group spanning countries | Currency, tax, retention differ | One tenant per country under `hospital_groups`; group reports aggregate across tenants, each figure labelled with its currency, and any converted total states its rate and date |
| Region rules inside a country (Dubai vs Abu Dhabi, US states, Indian state PCPNDT rules) | Wrong gate per site | `locale/region` at facility scope; pack rules keyed by region where needed |
| Print | Wrong time or currency on a legal document | Print uses the same server formatter and goldens; DST handled by `chrono-tz`; unknown zone fails the print (existing rule) |
| Offline native | Rules drift from the server | Rules come from the Rust edge core with the same pack data; the profile is cached as last-good with the session; the server re-validates on sync |
| ICU4X data size on the Pi image | Budget overrun | Baked data limited to pack locales; size measured in the OS budget check |
| Accreditation standards text is copyrighted | Licence breach | Store codes and our own one-line summaries only, never the standard's text |
| Silent fallback to India | A foreign hospital looks right but is wrong | India defaults removed from `DEFAULT_CONFIG`, schema defaults and `hospital_groups`; neutral render + banner instead |

## 7. Owner questions, resolved

All resolved 2026-11-15 by owner principle (§0).

| # | Question | Resolution | Reason |
|---|---|---|---|
| 1 | Facility scope now or at K3? | Built now in #5926 (timezone and region at facility scope) | A group with sites in two zones must show each ward its own clinical time from day one |
| 2 | Packs compiled in, or installable? | Compiled in now; runtime-loadable later, signed only, verified like OS updates, unsigned refused (§3.2) | Fits partners and new countries without opening a tampering path |
| 3 | 3-decimal currencies? | Widen money columns to 4 decimals in a planned migration with a maintenance window, inside #5927 | Fits every currency; refusing Gulf currencies would not fit "anything" |
| 4 | Multi-country groups? | One tenant per country; group reports aggregate across tenants | Currency, tax and retention stay correct per country, and RLS stays per tenant |
| 5 | Second pack? | UAE (#5426) | Different currency, RTL, Hijri, VAT, a region split, a controlled-drug platform and data localisation: it exercises every row |
| 6 | Dated legal changes? | Apply automatically on their date only from a pack version approved beforehand through a change set (§3.3) | The law's date is met, and nothing changes silently |
| 7 | Who changes the locale profile? | `hospital_admin` only, plus second-person approval, audited (§2.4) | It switches regulatory rules; separation of privilege |

### 7a. Decided 2026-11-15 while building #5926 (owner: "do all things cleanly")

| # | Question | Resolution | Reason |
|---|---|---|---|
| 8 | Server and print money formatting | ICU4X number formatting, with the currency symbol and its placement declared per pack. Experimental ICU4X currency data and Postgres `to_char` were rejected | Stable API only; Postgres cannot format other countries' money well. The new crates still go through the owner's supply-chain review |
| 9 | Retention floor | 3 years for medical records and for audit logs; India 5 years for medical records (today's MRD default). Packs may raise these, never lower them | The lowest common legal minimum, with the existing India practice kept |
| 10 | Controlled drugs in the world pack | `rx_required` + `dual_sign` + `register_entry`, as in §1a; §3.1 is aligned | The floor decides and the text follows it |
| 11 | Tenant with no country | Left without a country and shown as incomplete until a change set sets one; never inferred from INR | Guessing a country would pick its regulatory rules silently |
| 12 | Second approver of a locale change | Any holder of `knowledge.change_sets.approve`; the applier stays `hospital_admin` | Requiring a second hospital administrator would block hospitals that have only one |
