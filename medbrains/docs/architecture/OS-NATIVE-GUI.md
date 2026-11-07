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
4. **One sign-in.** The shell holds the session. Each app gets a short-lived token over a local socket from the shell, limited to the permissions that app needs, and cannot read another app's token.
5. **A manifest per app,** extending the format the shell already reads in `/usr/share/medbrains/apps/`: id, name, icon, the binary, the permissions it needs, the modules it depends on, the roles that see it. Signed and checked by the Software Center (O14); turning an app on brings the apps it depends on.
6. **Each app is measured alone,** so it can be made faster on its own. One process per app costs memory, so G1 measures the cost of a second process; idle apps close after a while, and how many may be open at once is set from those numbers. If the cost per process is too high, apps can share one process per role while keeping the same crate boundaries, so the split in code stays either way.
