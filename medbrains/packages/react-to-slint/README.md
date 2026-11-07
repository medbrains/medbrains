# @medbrains/react-to-slint

Converts React + Mantine screens into Slint views for the native OS GUI (`docs/architecture/OS-NATIVE-GUI.md`). The web app stays React; each module's Slint version starts from an exact conversion, and the file marks what a person or the Rust view model still has to do.

**Every rule is in [docs/CONVERSIONS.md](docs/CONVERSIONS.md)**, generated from the converter's own tables, with links to the Mantine 9 and Slint 1.18 documentation.

## Paused 2026-11-07

Work on the converter is paused by owner decision. State at the pause (0.4.0, mapping version 9):

- 1,066 of 1,066 page files compile with the Slint 1.18.1 viewer; 86 of 129 menu entries open a native screen; 34 tests pass.
- Converted interactive elements: 7,485, every one with an accessible role; 131 have no accessible name (`bin/a11y-audit.mjs`).
- Target: on the OS, the Slint winit backend inside the cage compositor, not LinuxKMS, because only winit has AccessKit (screen-reader support).

Kit controls at the pause, checked by code review and compile only (no hands-on mouse, keyboard or screen-reader run yet):

| Control | Mouse | Keyboard | Screen reader |
|---|---|---|---|
| Text input, password | works (click anywhere in the box focuses; reveal button) | works (Tab, 2px ring) | works: label, required, value, placeholder, error |
| Number | partly: steppers, no typing | partly: Up and Down step, no typing | works: spinbox with value and range |
| Textarea | works | works | partly: label and error |
| Select | works (Slint ComboBox, placeholder, clear button) | partly: no type-to-jump | partly: label and error on the ComboBox |
| Multi-select | partly: checkable menu; tags need the view model | partly: Space, Enter, Down open the menu | partly: "N selected" |
| Menu | works (ContextMenuArea) | works when the target is a button (Enter, Space; arrows and Escape inside) | works: native menu |
| Checkbox, switch, chip | works | works (Space) | works: role and checked |
| Radio | works | partly: no arrows within the group | works |
| Segmented control | works | works (Left, Right) | partly |
| Tabs | works | partly: Enter and Space, no arrows | works: selected |
| Modal | works (mounted under `if`) | partly: Escape closes; focus is not trapped or returned | partly: announced as a group, not a dialog |
| Buttons, icon buttons | works | works | works |

Next steps, in order:

1. Text input: typed numbers in the number field, selection and caret checks by hand.
2. Select: type-to-jump, Alt+Down, focus back on Escape.
3. Menu: keyboard opening from non-button targets with a single tab stop.
4. Checkbox and switch: group arrows, hands-on screen-reader pass.
5. The rest: radio groups, tabs arrows, modal focus trap and return, multi-select values.
6. The 2D body map.
7. docs/CONVERSIONS.md: done in 0.4.0; keep it regenerated as the rules change.

Open visual gaps (not blocking): the Patients search field is narrow (its CSS-module width does not reach the field through the flex parent), the empty state shows its title without icon, description or action (the props pass through an inner DataTable), Pharmacy's tab row does not wrap, and the command bar's accent rule has no token (`teal-6` resolves to a colour no semantic token has).

## Use

```sh
pnpm --filter @medbrains/react-to-slint exec react-to-slint apps/web/src --project apps/web/src --out /tmp/app-slint --preview
node packages/react-to-slint/bin/app-shell.mjs --web apps/web/src --out /tmp/app-slint
slint-viewer -L medbrains-gui-kit=packages/react-to-slint/preview /tmp/app-slint/app.slint
```

It writes one `.slint` per `.tsx`, copies the Tabler icons the screens use into the kit, and prints what mapped, every prop it did not convert (each with its reason in the file), and what moves to Rust (`// rust:` markers).

- `--preview` starts permission and feature checks allowed (the web reference is a super admin), lists empty, nothing loading; `--preview-deny canX,canY` starts named checks denied. Preview values only; product builds take every value from the view model.
- `bin/app-shell.mjs` builds the app around the screens from the web's layout, navigation, module badges and routes.
- `preview/gallery.slint` shows every kit control live, each wired to a "last action" line.

## How it converts

- Values are written with the type the Slint property declares: builtins from the official reference (`src/slint-reference.json`), kit components from their own `.slint` source.
- Mantine's defaults, the theme's `defaultProps` and the seam's defaults apply first (`src/mantine-defaults.json`, `bin/mantine-defaults.mjs`).
- Sizes and colours come from the design system (`bin/tokens-to-slint.mjs` → `preview/tokens.slint`); colours only through tokens, CSS variables matched by measured light and dark values (`src/css-vars.json`).
- Layouts follow CSS: Stack/Group alignment, grids as GridLayout cells, margins as wrapping padding, responsive props on the window width, CSS module layout declarations.
- Lifecycle: `useEffect` → `init` / `changed`, timers → `Timer`, menus → `ContextMenuArea`, modals mounted under `if`.

## Kit

`preview/kit.slint` draws the MedBrains design (Carbon shapes, IBM Plex, the website colours). Interactive controls set an accessible role, label, value or checked state and actions, take Tab focus with a 2px ring, activate on Enter and Space, and have 24px targets. Components it does not draw yet are stand-ins in `preview/stubs.slint` (`bin/kit-stubs.mjs`).

## Scripts

```sh
pnpm --filter @medbrains/react-to-slint test      # one test per conversion rule
pnpm --filter @medbrains/react-to-slint docs      # regenerate docs/CONVERSIONS.md
pnpm --filter @medbrains/react-to-slint tokens    # regenerate preview/tokens.slint
pnpm --filter @medbrains/react-to-slint defaults  # regenerate src/mantine-defaults.json
node bin/usage.mjs apps/web/src                   # which Mantine and seam components and props the app uses
node bin/a11y-audit.mjs <converted dir>           # interactive elements without an accessible name
```

Change a rule in `src/mapping.json`, bump its `version`, regenerate the docs and note it in `CHANGELOG.md`.
