# WCAG 2.2 Rules (MedBrains — conformance target: Level AA)

Complete, actionable mapping of **every Level A + AA** WCAG 2.2 success criterion
(https://www.w3.org/TR/WCAG22/) to a project rule. 32 A + 27 AA = the full AA
target; key AAA we also aim for are listed at the end. ★ = new in WCAG 2.2.
Accessibility is **patient-safety-critical** here — AA is mandatory. Enforced by
Biome a11y rules + the `@/components/ui` seam; verify the rest manually.

## 1. Perceivable

**1.1 Text alternatives**
- **1.1.1 Non-text content (A):** `alt` on informative images/icons; `alt=""` /
  `aria-hidden` for decorative; `aria-label` on icon-only controls.

**1.2 Time-based media** (only when audio/video is used — e.g. telemedicine, training)
- **1.2.1 Audio/video-only (A):** transcript for audio-only; transcript or audio
  track for video-only.
- **1.2.2 Captions, prerecorded (A):** captions on prerecorded video.
- **1.2.3 Audio description / media alternative, prerecorded (A).**
- **1.2.4 Captions, live (AA):** captions on live video (e.g. live telemed sessions).
- **1.2.5 Audio description, prerecorded (AA).**

**1.3 Adaptable**
- **1.3.1 Info & relationships (A):** real semantics — headings, `<label for>`,
  `<table>`+`<th scope>`, `<fieldset>/<legend>`, lists. No styling-as-meaning.
- **1.3.2 Meaningful sequence (A):** DOM/reading order is correct without CSS.
- **1.3.3 Sensory characteristics (A):** instructions don't rely on shape/size/
  position/sound alone ("the round button" → name it).
- **1.3.4 Orientation (AA):** works in both portrait & landscape; don't lock
  orientation (matters for tablets/kiosks at the bedside).
- **1.3.5 Identify input purpose (AA):** `autocomplete` on personal-data inputs.

**1.4 Distinguishable**
- **1.4.1 Use of colour (A):** never colour-alone — add icon/text/shape.
- **1.4.2 Audio control (A):** any auto-playing audio >3s has pause/stop/volume.
- **1.4.3 Contrast minimum (AA):** text ≥ 4.5:1; large (≥24px/≥19px bold) ≥ 3:1.
- **1.4.4 Resize text (AA):** usable at 200% zoom, no clipping.
- **1.4.5 Images of text (AA):** use real text, not text baked into images
  (except logos).
- **1.4.10 Reflow (AA):** no 2-D scroll at 320px / 400% zoom — single column.
- **1.4.11 Non-text contrast (AA):** UI components + states (borders, focus,
  toggles, meaningful icons) ≥ 3:1.
- **1.4.12 Text spacing (AA):** survives increased line/letter/word/paragraph spacing.
- **1.4.13 Content on hover/focus (AA):** tooltips/popovers dismissible (Esc),
  hoverable, persistent.

## 2. Operable

**2.1 Keyboard**
- **2.1.1 Keyboard (A):** everything keyboard-operable. No `div/span onClick` —
  `<button>` or role+`tabIndex`+`onKeyDown`.
- **2.1.2 No keyboard trap (A):** focus can always leave (modals, widgets).
- **2.1.4 Character key shortcuts (A):** single-character shortcuts can be turned
  off/remapped or are active only on focus.

**2.2 Enough time**
- **2.2.1 Timing adjustable (A):** session/idle timeouts can be extended/turned off
  with warning (clinical sessions — warn before logout, allow extend).
- **2.2.2 Pause, stop, hide (A):** auto-updating/moving/auto-advancing content
  (marquee, carousels, live boards) is pausable.

**2.3 Seizures**
- **2.3.1 Three flashes or below threshold (A):** nothing flashes >3×/sec.

**2.4 Navigable**
- **2.4.1 Bypass blocks (A):** provide a "skip to main content" link + landmark
  regions (`<main>/<nav>/<aside>`).
- **2.4.2 Page titled (A):** every route sets a descriptive `<title>`.
- **2.4.3 Focus order (A):** tab order matches visual/reading order.
- **2.4.4 Link purpose in context (A):** link/button text is meaningful (no bare
  "click here"/"read more").
- **2.4.5 Multiple ways (AA):** more than one way to reach a page (nav + search/
  spotlight + breadcrumbs).
- **2.4.6 Headings and labels (AA):** headings + form labels are descriptive.
- **2.4.7 Focus visible (AA):** clear focus indicator on every focusable element —
  never remove `outline`.
- **★ 2.4.11 Focus not obscured (minimum) (AA):** focused element isn't fully
  hidden by sticky headers/footers/overlays.

**2.5 Input modalities**
- **2.5.1 Pointer gestures (A):** multipoint/path gestures (pinch, swipe-path) have
  a single-pointer alternative.
- **2.5.2 Pointer cancellation (A):** actions fire on up-event, not down; abortable.
- **2.5.3 Label in name (A):** an element's accessible name contains its visible
  label text (so voice control works).
- **2.5.4 Motion actuation (A):** device-motion-triggered actions have a UI control
  + can be disabled.
- **★ 2.5.7 Dragging movements (AA):** any drag (reorder, slider) has a single-tap/
  button alternative.
- **★ 2.5.8 Target size minimum (AA):** interactive targets ≥ 24×24 CSS px (or 24px
  spacing) — icon buttons, checkboxes, close ×, row actions.

## 3. Understandable

**3.1 Readable**
- **3.1.1 Language of page (A):** `<html lang>` set.
- **3.1.2 Language of parts (AA):** `lang` on foreign-language passages.

**3.2 Predictable**
- **3.2.1 On focus (A):** no context change merely on focus.
- **3.2.2 On input (A):** no surprise context change on changing a field; submit is
  explicit.
- **3.2.3 Consistent navigation (AA):** nav appears in the same relative order
  across pages.
- **3.2.4 Consistent identification (AA):** the same component/icon means the same
  thing everywhere.
- **★ 3.2.6 Consistent help (A):** help mechanisms (contact/docs/chat) in the same
  relative order across pages.

**3.3 Input assistance**
- **3.3.1 Error identification (A):** errors described in text, tied to the field.
- **3.3.2 Labels or instructions (A):** visible label (not placeholder-only) +
  required marker.
- **3.3.3 Error suggestion (AA):** suggest a fix when known.
- **3.3.4 Error prevention — legal/financial/data (AA):** reversible/checked/
  confirmable for legal, financial, **clinical** submissions.
- **★ 3.3.7 Redundant entry (A):** don't re-ask info already given in a flow —
  auto-fill or let the user pick it.
- **★ 3.3.8 Accessible authentication (minimum) (AA):** no cognitive-function test
  to log in; allow password managers, paste, copy. Don't block paste on password.

## 4. Robust

- **4.1.2 Name, role, value (A):** custom widgets expose correct ARIA role/state/
  name; prefer native elements. (4.1.1 Parsing was removed in 2.2.)
- **4.1.3 Status messages (AA):** toasts/inline status use `role="status"`/
  `aria-live` — announced without moving focus.

## AAA we also aim for (best practice, not required)

- **★ 2.4.13 Focus appearance (AAA):** focus indicator ≥ 2px thick, ≥ 3:1 vs
  unfocused — why the 2px input focus box stays.
- **2.5.5 Target size enhanced (AAA):** prefer ≥ 44×44px for primary touch targets.
- **3.1.5 Reading level (AAA):** plain language for non-clinical chrome.
- **1.4.6 Contrast enhanced (AAA):** 7:1 where feasible for dense clinical text.

## Enforcement

- Build from `@/components/ui` (labels/focus/aria baked in); Biome a11y all `error`.
- Manual per screen: keyboard-only pass, screen-reader smoke, the ★ new-2.2 SC,
  and the items tools miss (2.4.1 skip link, 2.4.2 title, 2.5.x pointer, 2.2.1
  timeouts, 3.2.3/3.2.4 consistency).
