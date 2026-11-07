# Native OS GUI: plan for the G1 trial

Owner decision 2026-11-07 (`DECISIONS.md`, plan section G): the OS screen becomes a native GUI in Rust, safe for memory and security, needing no GPU. The web app stays for every other customer, built in parallel. Toolkit: Slint under GPLv3 for the trial (our files stay Apache-2.0); the licence for release is the owner's decision.

## What G1 builds

Two screens, enough to measure and to judge the toolkit, not a product:

1. **Launcher:** the app grid a signed-in person sees, one tile per module they may open, the same modules and order the web app shows.
2. **Pharmacy prescriptions list:** the first clinical screen, read-only, the same rows the web Pharmacy page shows.

## How it is built

- **One new crate, `medbrains-gui`,** a Slint binary. Screens in `.slint` files, logic in Rust. No `unsafe`, workspace lints apply.
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
