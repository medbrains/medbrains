# Accessibility — WCAG 2.1 AA (for everyone, including specially-abled users)

MedBrains is a hospital system used by clinicians, front-desk staff, patients, and operators — some with visual, motor, hearing, or cognitive impairments, often under time pressure. **Accessibility is a patient-safety requirement, not a nicety.** Target: **WCAG 2.1 Level AA** across the whole app (AAA for contrast where feasible).

Enforcement: strict **Biome a11y** rules (all `error`, see `biome.json`) + build everything from the **`@/components/ui` seam** (the primitives bake in the rules below). `make check-ui-seam` blocks raw-Mantine leaks.

## 1. Perceivable

- **Colour contrast** — body text ≥ **4.5:1**, large text (≥18px/14px-bold) & UI components/icons ≥ **3:1**. Carbon tokens are pre-checked: `text-primary #161616` and `text-secondary #525252` on white pass AA; interactive `#0f62fe` on white passes. **Never** lower text contrast; **never** convey meaning by colour alone — pair colour with an icon, label, or text (e.g. status = colour **+** icon + word).
- **Don't rely on colour alone** — required fields, errors, statuses, and chart series all need a non-colour cue (icon/label/pattern).
- **Text alternatives** — every meaningful `<img>`/icon has `alt`/`aria-label`; decorative images use `alt=""`. Icon-only buttons (`IconButton`) **must** have `aria-label`.
- **Media** — video needs captions; audio needs a transcript.
- **Resize/zoom** — layouts must survive 200% zoom and reflow at 320px width without loss of content (use rem/responsive, no fixed pixel traps).

## 2. Operable

- **Keyboard** — every interactive element is reachable and operable by keyboard alone (Tab/Shift-Tab/Enter/Space/Esc/arrows). No mouse-only handlers: a `div`/`span` with `onClick` is forbidden — use `<button>`, or add `role` + `tabIndex={0}` + `onKeyDown` (Enter/Space). Biome enforces this (`noStaticElementInteractions`, `useKeyWithClickEvents`).
- **Focus visible** — a clear **2px** focus ring (Carbon `#0f62fe`) on every focusable element; never `outline: none` without an equivalent. Modals/drawers **trap focus** and restore it on close (Mantine handles this — don't defeat it).
- **No keyboard trap** — Esc closes overlays; focus order follows reading order; no `tabindex > 0`.
- **Targets** — interactive targets ≥ **24×24px** (AA 2.5.8); prefer 40px for primary touch controls.
- **Timing** — no time limits on clinical input; if a session must expire, warn and allow extension. Auto-dismissing toasts must **not** carry critical/required actions (those go to a Modal).
- **Motion** — honour `prefers-reduced-motion`: disable non-essential animation (ECG sweep, shimmer) for users who request it.
- **No seizures** — nothing flashes more than 3×/second.

## 3. Understandable

- **Language** — `<html lang>` is set (and updated per i18n); RTL via `DirectionProvider`.
- **Labels & instructions** — every form control has a programmatic `<label>` (not placeholder-only). Errors are announced, specific, and tied to the field via `aria-describedby`; describe how to fix, not just "invalid".
- **Consistent patterns** — same action looks/behaves the same everywhere (the seam guarantees this). No surprising context changes on focus.
- **Plain language** — clinical jargon where required, but UI chrome stays clear; show human labels, not raw codes (e.g. permission **label**, not `ipd.admissions.create`).

## 4. Robust (ARIA — the index)

Use **semantic HTML first**; reach for ARIA only to fill gaps. Wrong ARIA is worse than none.

| Pattern | Rule |
|---|---|
| Icon-only control | `aria-label` (or visible label) — `IconButton`, close buttons, sort toggles |
| Toggle / pressed state | `aria-pressed` / `aria-expanded` on disclosure + menu triggers |
| Live updates | toasts/notifications use a polite **live region** (`role="status"` / `aria-live="polite"`); critical alerts `aria-live="assertive"` |
| Loading | `role="status"` + `aria-label` (the `EcgLoader`); busy regions `aria-busy` |
| Dialogs | `role="dialog"` + `aria-modal` + labelled by the title (Mantine `Modal`/`Drawer`) |
| Tabs | `role="tablist"`/`tab`/`tabpanel` with `aria-selected` + arrow-key nav (Mantine `Tabs`) |
| Tables | real `<th scope>`, caption/`aria-label`; sortable headers expose `aria-sort` |
| Required / invalid | `aria-required`, `aria-invalid`, `aria-describedby` → error text |
| Decorative | `aria-hidden="true"` on purely decorative glyphs |
| Valid ARIA only | roles/props/values must be valid and supported for the element (Biome `useValidAriaProps`, `useAriaPropsForRole`, `useValidAriaValues`) |

## How to apply (definition of done for any UI work)

1. Build from `@/components/ui` (accessible by construction); don't hand-roll interactive `div`s.
2. Keyboard-test: Tab through, operate with Enter/Space/Esc/arrows, confirm a visible focus ring.
3. Every icon-only control has `aria-label`; every input has a real label + wired error.
4. Status/meaning never colour-only.
5. `pnpm biome check` passes the strict a11y rules (0 a11y errors).
6. Screen-reader smoke (VoiceOver) on new flagship screens; honour reduced-motion.
