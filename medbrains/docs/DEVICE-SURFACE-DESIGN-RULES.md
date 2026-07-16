# Device-Surface Design Rules — the right design system per surface (Carbon brand layered on)

**Status:** LAW · Companion to `DESIGN-RULES.md` (web Carbon), `DEVICE-CONSTRAINED-RULES.md` (performance).

## The 10 Commandments of Device-Surface Design (LAW)

1. **Use the right design system per surface** — never force the web Carbon 2x-grid onto TV or mobile.
2. **Carbon is the brand, not the layout** — colour/type/spacing from `@medbrains/design-system` tokens; never a raw hex, never a per-surface palette fork.
3. **On TV, obey the 10-foot UI** — a default-focused element, explicit D-pad directional logic, and an **obvious** focus state (`hasTVPreferredFocus`/`TVFocusGuideView`).
4. **On TV, respect overscan** — keep content in the safe area (48dp L/R, 27dp T/B); light-on-dark, large legible type, nothing critical in the outer 5%.
5. **On mobile, follow Carbon-for-RN + platform HIG** — Material 3 / Apple HIG nav + safe-area insets; **touch targets ≥ 44px**.
6. **On kiosk, make it self-service** — large targets, one linear flow, forgiving timeouts, high contrast.
7. **Virtualize and bound everything** — `FlatList`/`getItemLayout`, never `ScrollView.map`; every loop/cache/queue capped (Power of Ten); memory flat over uptime.
8. **Fail safe, never blank** — an error boundary per screen, offline last-good render; a board never shows white or a spinner-forever.
9. **Share, never copy** — all shared logic/tokens from `@medbrains/*`; diverge only by surface variant, never by fork.
10. **Accessible on every surface (WCAG 2.2 AA)** — visible ≥2px focus, ≥ target size, real labels, never colour-alone, honour reduced-motion.

## Principle

IBM Carbon is MedBrains' **brand + token language** (Blue 60 `#0f62fe`, IBM Plex, Carbon neutral ramp,
emergency codes — `@medbrains/design-system`). But **layout/interaction rules are per-surface**: a TV is not a
web page, a phone is not a kiosk. Each surface follows **its own authoritative design system for layout,
navigation, and target sizing**, and **layers the MedBrains Carbon brand tokens on top** (colour, type,
spacing scale) via the shared packages. Do NOT force the web 2x-grid onto TV/mobile — use each surface's rules.

## Per-surface rules

### Web (`ui-desktop`) — IBM Carbon (unchanged)
Carbon **2x grid** (8px mini-unit, fluid columns, 16px padding, breakpoint margins), spacing tokens (×2/4/8),
sharp 2px corners, IBM Plex, WCAG 2.2 AA. See `DESIGN-RULES.md` + the `CARBON-*-RULES.md` docs.
Sources: carbondesignsystem.com/elements/2x-grid, /elements/spacing, ibm.com/design/language/2x-grid.

### Mobile (`ui-mobile`, all `Mobile-*`) — Carbon Native Mobile + platform HIG
- **Authoritative kit:** IBM **Carbon for React Native** (`carbon-design-system/carbon-react-native`, "Carbon
  Native Mobile", Carbon v11 tokens) — mobile-specific components, NOT the web library. Today MedBrains uses
  **React Native Paper (Material 3)** themed from `@medbrains/design-system` via `buildDeviceTheme` +
  `@medbrains/ui-mobile`; that is a valid Carbon-tokens-on-Material approach. Evaluate adopting
  `carbon-react-native` where its Native-Mobile patterns beat hand-rolled Paper.
- **Touch targets ≥ 44px** (Carbon/HIG); pad a 22px icon into a 48px hit area. (WCAG 2.2 SC 2.5.8 ≥24px is the
  floor; use 44px.)
- Platform conventions: Material 3 (Android) / Apple HIG (iOS) navigation, safe-area insets, gestures.
- Carbon brand: colour/type/spacing from `@medbrains/ui-mobile` tokens (never raw hex).
Sources: github.com/carbon-design-system/carbon-react-native, medium.com/carbondesign Carbon-for-RN,
carbondesignsystem.com/elements/icons/usage (44px targets).

### TV (`ui-display`, all `TV-*`) — 10-foot UI (Android TV / Google TV), NOT web Carbon layout
- **D-pad focus is the core interaction:** every screen has a **default-focused element**; explicit directional
  logic (up/down/left/right/select); the focused element has an **obvious visual state** (bold border / colour
  / scale). No hover, scroll, or pinch. → wire `hasTVPreferredFocus` / `TVFocusGuideView` in `apps/tv`.
- **Overscan safe area:** keep content off the edges — **5% margin (48dp L/R, 27dp T/B)**; nothing critical in
  the outer 5%.
- **10-foot legibility:** large type, high contrast, **light text on dark background**, minimal reading, big
  hit/focus areas; virtualize lists (`FlatList`, `DEVICE-CONSTRAINED-RULES`).
- Carbon brand: use `@medbrains/ui-mobile` `COLORS`/`INTENT` (as `tv-board.tsx` does) but on a **dark board**
  palette; emergency codes fixed from `@medbrains/design-system`.
Sources: developer.android.com/design/ui/tv (design-for-tv, layouts), Fire TV design guidelines,
pascalpotvin.medium.com "Designing a 10ft UI".

### Kiosk (`ui-touch`, `Desktop-Kiosk`) — self-service touch
- Large touch targets (≥44px, ideally bigger for public/gloved use), simple linear self-service flows, big
  primary actions, forgiving/timeout-reset, high contrast, no tiny controls. Carbon brand tokens, touch sizing.
- Reuse the web app in `display=kiosk`; the missing self-check-in/token-dispense screen follows these rules.

### Edge / IoT / device-bridge (`headless-edge`, `headless-iot`, `headless-equipment`) — mostly headless
- No rich UI; any small embedded display = minimal, fixed-layout, high-contrast, glanceable status only.
  Design is dominated by `DEVICE-CONSTRAINED-RULES` (bounded, flat memory) not visual layout.

## How the loop applies this
- **Do not** port the web 2x-grid to TV/mobile. Each surface's slice follows **its** section above.
- Brand consistency comes from the **shared Carbon token core** (`@medbrains/design-system` →
  `@medbrains/ui-mobile` → `buildDeviceTheme`), never raw hex, never a per-surface palette fork.
- Every device slice also obeys `DEVICE-CONSTRAINED-RULES` (perf) + `WCAG-2.2-RULES` (a11y).
