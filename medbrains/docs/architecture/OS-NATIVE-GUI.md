# Native OS GUI: plan for the G1 trial

Owner decision 2026-11-07 (`DECISIONS.md`, plan section G): the OS screen becomes a native GUI in Rust, safe for memory and security, needing no GPU. The web app stays for every other customer, built in parallel. Toolkit: Slint under GPLv3 for the trial (our files stay Apache-2.0); the licence for release is the owner's decision.

## What G1 builds

Two screens, enough to measure and to judge the toolkit, not a product:

1. **Launcher:** the app grid a signed-in person sees, one tile per module they may open, the same modules and order the web app shows.
2. **Pharmacy prescriptions list:** the first clinical screen, read-only, the same rows the web Pharmacy page shows, built as its own app (below) so the trial measures what one app really costs.

## How it is built

- **Crates:** `medbrains-gui-kit` (shared components), the launcher inside the shell, and `medbrains-app-pharmacy`, each a Slint binary where it runs alone. Screens in `.slint` files, logic in Rust. No `unsafe`, workspace lints apply.
- **Shared rules, not copied rules.** The GUI is Rust, so it uses `medbrains-core` directly: the same permission constants (`permissions::pharmacy::…`), the same domain types, the same three-outcome decisions. Nothing is hand-copied from TypeScript.
- **Same API as the web app.** It calls the server's existing endpoints; no endpoint is added for the native screens.
- **Colours from our tokens.** A script turns `packages/design-system/src/theme/figma-varspec.json` into a Slint global, so both UIs draw from one source and no hex is written by hand. Light and dark.
- **Backends:** LinuxKMS with the software renderer (no window system, no GPU) and winit under `cage`, both measured.

## Screen plan

| Item | Launcher | Pharmacy list |
|---|---|---|
| Who sees it | Any signed-in person | `pharmacy.prescriptions.list` holders; others never see the tile, and the list is never fetched |
| States | loading, unavailable (named outage and retry, never an empty grid), populated | loading, unavailable, empty in words, populated |
| Input | keyboard (arrows, Enter, Tab), touch, mouse | same; row selection by keyboard |
| Accessibility | every tile has a name for screen readers; visible focus of at least 2 px; targets at least 24 px | same; table headers named |

## What G1 measures, against today's WebKit page

| Measure | How |
|---|---|
| Memory | PSS of the GUI process signed in, idle and after opening Pharmacy, flat over an hour |
| Start time | Power-on to launcher, and launcher to Pharmacy list |
| CPU and heat | Idle and scrolling, on a VM with no GPU and on a Raspberry Pi |
| Screen reader | Orca reads tile names and the list, under each backend |
| Security | Process runs as its own user under systemd sandboxing; no network access except the server on localhost |

G1 passes if memory is clearly below the WebKit figure, nothing needs a GPU, and a screen reader works under at least one backend. If Slint fails, iced is tried with the same two screens.

## Splitting into apps (owner 2026-11-07)

Every module is its own app, as plan task O11 says, and the native GUI is built that way from the first screen. The rules:

1. **One app is one module, never a layer.** The list of modules and what each depends on comes from the one Rust dependency list in O11, the same list the web app and the Software Center use. App ids match the web app's module ids.
2. **Each app is its own process and crate** (`medbrains-app-<module>`), started by the shell under its own systemd unit and sandbox. A crash or a flaw in Billing cannot read Pharmacy's memory or stop it.
3. **Apps share only three things:** `medbrains-gui-kit` (components, tokens, accessibility, the loading, unavailable and empty states), `medbrains-core` (types, permissions, decisions) and the API client. **Apps never import each other.** Going from one to another, for example from a prescription to the patient in OPD, is a request to the shell to open the other app with an id, never a direct call.
4. **One sign-in, enterprise style** (owner 2026-11-07, like Okta or Windows sign-in): see *Identity for apps* below.
5. **A manifest per app,** extending the format the shell already reads in `/usr/share/medbrains/apps/`: id, name, icon, the binary, the permissions it needs, the modules it depends on, the roles that see it. Signed and checked by the Software Center (O14); turning an app on brings the apps it depends on.
6. **Each app is measured alone,** so it can be made faster on its own. One process per app costs memory, so G1 measures the cost of a second process; idle apps close after a while, and how many may be open at once is set from those numbers. If the cost per process is too high, apps can share one process per role while keeping the same crate boundaries, so the split in code stays either way.

## App catalogue (draft, owner 2026-11-07)

Apps are the size a person thinks in, like **Pharmacy, Patient Registration, EMR**: one job, not one screen and not a layer. The 78 permission modules group into these apps; the owner adjusts the grouping, and every permission module belongs to exactly one app.

| App | Permission modules inside it |
|---|---|
| Patient Registration | `front_office`, `patients`, `consent`, `abdm`, `uhi` |
| EMR (case sheet) | `clinical_notes`, `care_view`, `chronic`, `order_sets`, `order_basket`, `doctor`, `notes`, `terminology`, `ckb`, `knowledge` |
| OPD | `opd`, `scheduling`, `display` |
| Pharmacy | `pharmacy`, `pharmacy_improvements`, `pharmacy_finance` |
| Lab | `lab` |
| Radiology | `radiology` |
| Billing and Insurance | `billing`, `insurance`, `patient_packages`, `doctor_payouts` |
| IPD and Nursing | `ipd`, `nurse`, `bedside`, `diet`, `icu` |
| Emergency | `emergency`, `ambulance` |
| Operation Theatre | `ot`, `cssd` |
| Blood Bank | `blood_bank` |
| Stores and Purchase | `inventory`, `indent`, `procurement`, `assets`, `bme`, `devices` |
| Medical Records | `mrd`, `documents`, `retrospective` |
| Quality and Safety | `quality`, `qa`, `infection_control`, `regulatory`, `ur`, `case_mgmt` |
| HR and Learning | `hr`, `lms` |
| Facilities | `facilities`, `housekeeping`, `security` |
| Outreach | `marketing`, `communications`, `camp`, `home_health`, `occ_health` |
| Specialty and Research | `specialty`, `research` |
| Reports | `dashboard`, `analytics`, `command_center`, `health` |
| Administration | `admin`, `audit`, `integration`, `vpn`, `storage`, `flows`, `automation`, `forms`, `ai` |

## Identity for apps (owner 2026-11-07)

Sign-in works the way Okta or Windows sign-in works in a company: one sign-in, and every app gets its own credentials from it.

1. **Kanidm is the identity provider.** Each app is registered in Kanidm as its own OAuth2 client, with its own client id and only the scopes its permission modules need (Kanidm maps groups to scopes).
2. **Sign in once at the shell.** The shell holds the Kanidm session, like the Windows account manager. Opening an app gets that app a token for itself through the standard flow with PKCE, with no second password prompt.
3. **Each app has its own key.** The app keeps its own key pair in its own sandboxed storage, and its tokens are tied to that app. A token copied out of Pharmacy is refused when Billing presents it. Whether Kanidm can bind tokens to a key (as DPoP does) is checked in G1; if not, the server binds them through the shell's local socket.
4. **Permissions are checked where they always are.** The server checks every request and, for patient data, every record, exactly as for the web app. The app hides controls the person can't use, from the same Rust permission constants. A fault answers *unknown*, never *allowed*.
5. **Sign-out and lock reach every app.** Locking the screen or signing out at the shell ends every app's tokens at once. An app closed by the Software Center loses its client registration.
6. **Outside identity providers** (Entra, Okta) sign in to Kanidm, not to the apps, so nothing in the apps changes when a hospital uses one. Whether Kanidm's trust login works with them is tested under T3.

## Transition layer from React to Slint (owner 2026-11-07)

Two UIs must not mean two of everything. The layer below sits under both, so a module moves to Slint by writing only its views, and the web app keeps working unchanged. Most of a screen is not its view: it is the data, rules, permissions, text and states, and those are written once.

| Layer | Written once, in | React reads it through | Slint reads it through |
|---|---|---|---|
| **API types and client** | Rust server types | a TypeScript client generated from the server (X15), replacing hand-written `client.ts` methods | the same generated description, as a Rust client |
| **Permissions** | `medbrains-core/src/permissions.rs` | the generated `permissions.ts` (already) | the Rust constants directly |
| **Design tokens** | `figma-varspec.json` | the generated theme (already) | a generated Slint global |
| **Text and languages** | the translation files in `apps/web/public/locales/` (16 namespaces, English and Arabic) | i18next (already) | a loader for the same JSON files, so a translation is done once |
| **Forms** | form definitions in the database, resolved by the server (`ResolvedFormDefinition`) | the existing dynamic form renderer | one Slint form renderer for the same definitions, so every configured form works natively at once |
| **Field rules** (required, ranges, conditions) | moved from `packages/schemas/src/dynamic-form.ts` into one Rust crate | that crate compiled to WebAssembly | the crate directly; the server runs it too, so a rule cannot pass on screen and fail on save |
| **Screen logic** (state, actions, what happens on each tap) | a Rust view model per screen, actions in and state out, in the style of Crux (`redbadger/crux`, Apache-2.0) and Shopify's Reflex | for new or rewritten screens only, through WebAssembly; existing React screens keep their hooks | the view model directly |
| **UI components** (Button, Badge, Input, Select, Table, Modal, Panel, the state views and the rest of the seam) | one component catalogue: each component's name, props, variants, states, tokens, keyboard behaviour and screen-reader role, in one file per component | the existing seam components in `components/ui`, checked against the catalogue | Slint components in `medbrains-gui-kit`, generated as skeletons from the catalogue, so the same props and variants exist on both |
| **States** (loading, unavailable with a named outage, empty in words) | the view model's state | one React component per state (already in the seam) | one Slint component per state in `medbrains-gui-kit` |
| **Tests** | one journey file per module, driving the view model (Reflex) | the same journeys against the web build, plus a few browser end-to-end runs | the same journeys against the native build |

**Why components are specified once but drawn twice:** Slint can run in a browser as WebAssembly, but it draws onto a canvas, so the web app would lose screen-reader support, text selection, browser find and autofill, and gain megabytes of download. That breaks WCAG 2.2 AA for every staff browser. So each component is defined once in the catalogue and implemented twice, and parity is proved, not hoped for: every component, in every variant and state, is screenshotted on both (Storybook for React, Slint's preview for native) and the pairs are compared in CI, along with its keyboard and screen-reader behaviour.

**How a module moves:** its API, permissions, text, forms and rules already come from this layer, so moving it means writing its Slint views and, if its logic still lives in React hooks, moving that logic into a Rust view model first. Until a module is native, the native shell opens it in the sandboxed web view (G4), so nothing goes missing.

**Order:** tokens, permissions and text first (cheapest, already half done); then the generated API clients; then field rules in Rust; then the Slint form renderer, which brings every configured form across at once; then view models, module by module, starting with Pharmacy.

**Limits to measure before relying on them:** WebAssembly adds download size to the web app, so field rules and view models go to the web only where the size cost is measured and small; Crux is studied as a pattern first, and adopted only if it beats a plain view model trait.

## One view for MedBrains modules on the OS screen (owner 2026-11-07)

While modules are web pages, every MedBrains module opens in **one shared WebKit view**: a launcher tile switches the route inside it rather than starting a new view, because each view costs about 400 MB. Third-party apps keep a view of their own, because isolation between vendors comes from separate storage and processes.

Separation between people and roles never came from separate views, so sharing one changes nothing about who may open what:

1. **The server refuses** every request the person's permissions do not allow, and checks patient data record by record. A pharmacist's call to an EMR endpoint is refused from any screen.
2. **The launcher shows only the modules the person may open**, so pharmacy staff see no EMR tile and finance staff no HR tile.
3. **Each screen checks on open** (`useRequirePermission`), so typing an address does not get around the launcher.
4. **Data classes decide masking**, so a sensitive field is hidden or masked the same way on every screen.
5. **Switching person clears the view**: locking the screen or signing in as someone else ends the session and reloads the view empty, so nothing of the previous person stays in memory or on screen.
