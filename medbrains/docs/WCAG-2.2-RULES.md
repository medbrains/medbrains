# WCAG 2.2 Rules (MedBrains — target: Level AA)

Actionable extraction of WCAG 2.2 (https://www.w3.org/TR/WCAG22/). MedBrains is a
clinical system used by specially-abled staff and patients — **AA is mandatory,
patient-safety-critical**. These rules complement `docs/ACCESSIBILITY.md` and are
enforced by Biome a11y rules + the `@/components/ui` seam. Every PR touching UI
must satisfy them.

## 1. Perceivable

- **1.1.1 Non-text content (A):** every `<img>`/icon-only control has a text
  alternative. Decorative → `alt=""` / `aria-hidden`. Informative icon button →
  `aria-label`.
- **1.3.1 Info & relationships (A):** use real semantics — `<h1..h6>` in order
  (one `h1`/page), `<label for>` wired to inputs, `<table>` with `<th scope>`,
  `<fieldset>/<legend>` for groups, list elements for lists. No styling-as-meaning.
- **1.3.5 Identify input purpose (AA):** set `autocomplete` on personal-data
  inputs (name, email, tel, address, etc.).
- **1.4.1 Use of colour (A):** never colour-alone for meaning (add icon/text/pattern).
- **1.4.3 Contrast minimum (AA):** text ≥ **4.5:1**; large text (≥24px or ≥19px
  bold) ≥ **3:1**. Use `--mb-text-secondary` not `--mb-text-muted` for body copy.
- **1.4.4 Resize text (AA):** usable at 200% zoom; no fixed px that clips text.
- **1.4.10 Reflow (AA):** no 2-D scroll at 320px width / 400% zoom — single-column.
- **1.4.11 Non-text contrast (AA):** UI components + states (input borders, focus
  ring, toggle, icon) ≥ **3:1** against adjacent colours.
- **1.4.12 Text spacing (AA):** content survives increased line/letter/word spacing.
- **1.4.13 Content on hover/focus (AA):** tooltips/popovers are dismissible (Esc),
  hoverable, and persistent.

## 2. Operable

- **2.1.1 Keyboard (A):** everything operable by keyboard. **No `div/span` onClick**
  — use `<button>` or `role` + `tabIndex={0}` + `onKeyDown` (Enter/Space).
- **2.1.2 No keyboard trap (A):** focus can always leave a widget/modal.
- **2.4.3 Focus order (A):** DOM/tab order matches visual/reading order.
- **2.4.7 Focus visible (AA):** every focusable element shows a clear focus
  indicator (we use a 2px ring/box — do **not** remove `outline`).
- **★ 2.4.11 Focus not obscured (minimum) (AA, NEW 2.2):** the focused element is
  not fully hidden by sticky headers/footers/overlays.
- **★ 2.4.13 Focus appearance (AA, NEW 2.2):** focus indicator is ≥ 2px thick and
  ≥ 3:1 contrast against unfocused state. (This is why the 2px input focus box
  must stay.)
- **★ 2.5.7 Dragging movements (AA, NEW 2.2):** any drag action (reorder, slider)
  has a single-pointer / button alternative (no drag-only).
- **★ 2.5.8 Target size (minimum) (AA, NEW 2.2):** interactive targets ≥ **24×24
  CSS px** (or 24px spacing). Icon buttons, checkboxes, close (×), table-row
  actions must meet this.

## 3. Understandable

- **3.1.1 Language of page (A):** `<html lang>` set (and `lang` on foreign passages).
- **3.2.1/3.2.2 On focus / on input (A):** no surprise context change on focus or
  on changing a field; submit needs an explicit action.
- **★ 3.2.6 Consistent help (A, NEW 2.2):** help mechanisms (contact, docs, chat)
  appear in the **same relative order** across pages.
- **3.3.1 Error identification (A):** errors are described in text, tied to the field.
- **3.3.2 Labels or instructions (A):** every input has a visible label (not
  placeholder-only) + required marker.
- **3.3.3 Error suggestion (AA):** suggest a fix when known.
- **3.3.4 Error prevention (legal/financial/data) (AA):** reversible / checked /
  confirmable for legal, financial, **clinical** data submissions.
- **★ 3.3.7 Redundant entry (A, NEW 2.2):** don't ask for the same info twice in a
  flow — auto-populate or let the user select previously entered data.
- **★ 3.3.8 Accessible authentication (minimum) (AA, NEW 2.2):** login must not
  rely on a cognitive function test (no "remember this", no transcription puzzle);
  allow password managers / paste / copy. Don't block paste on password fields.

## 4. Robust

- **4.1.2 Name, role, value (A):** custom widgets expose correct ARIA role/state/
  name; native elements preferred.
- **4.1.3 Status messages (AA):** toasts/inline status use `role="status"` /
  `aria-live` so they're announced without focus change.

## Enforcement

- Build from the `@/components/ui` seam (labels, focus, aria baked in).
- Biome a11y rules are all `error`.
- `prefers-reduced-motion` honoured for all motion (see `CARBON-MOTION-RULES.md`).
- Manual: keyboard-only pass + screen-reader smoke on every new screen; verify the
  9 new 2.2 criteria (marked ★) which automated tools often miss.
