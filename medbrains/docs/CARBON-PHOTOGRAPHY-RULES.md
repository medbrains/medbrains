# Carbon Photography Rules (MedBrains)

Actionable extraction of IBM Carbon photography
(https://www.ibm.com/design/language/photography/overview + /tips-and-techniques).
Imagery in a hospital system must be **authentic, human, and dignified** — never
generic stock. Photography appears on login, health-news/tips, marketing, empty
states.

## Principles

- **Authentic & candid, not staged.** Real people in real environments; capture
  genuine moments, not posed "smiling doctor + clipboard" clichés.
- **Human-centered & diverse.** Represent real patients/staff across age, gender,
  ability, ethnicity, body type — respectfully and accurately. Avoid tokenism.
- **Purposeful.** Every image supports the message/context; if it's decoration,
  cut it. No filler imagery.
- **True to life.** Natural light, true colour, realistic processing. Carbon does
  **not** heavily filter/duotone photos — keep them real. No heavy vignettes,
  gradients-over-photo, or fake "tech" overlays.
- **Clear focal point & composition.** One subject/decisive moment; use the grid
  + rule-of-thirds; give the subject room. Strong foreground/background depth.

## Healthcare-specific (mandatory)

- **Patient dignity & privacy first.** No identifiable patient image without
  written consent; never show real PHI (charts, screens, wristbands, faces in a
  clinical context) in imagery. Prefer staff/illustrative/abstracted clinical
  scenes when in doubt.
- **No distressing/graphic medical imagery** in product chrome (login, dashboards).
  Keep it reassuring and professional.
- **Accurate representation** — don't imply outcomes/claims an image can't support.

## Technical & a11y

- **Decorative photos** → `alt=""` + `aria-hidden`. **Informative photos** → a
  meaningful `alt`.
- **Text over images must stay legible** — overlay a scrim/solid panel so text
  meets contrast (WCAG 1.4.3 ≥4.5:1); never put body text directly on a busy photo.
- **Responsive & on-grid** — use the Carbon aspect ratios (1:1, 4:3, 16:9, 2:1),
  `object-fit: cover`, art-direct crops per breakpoint; lazy-load, sized to avoid
  layout shift.
- **Performance** — compress (WebP/AVIF), serve responsive sizes; imagery never
  blocks a clinical task.
- **Honour `prefers-reduced-motion`** for any Ken-Burns/parallax/auto-advancing
  image motion (provide a static fallback + pause control).

## Applied

- Login left panel / news slider: real, warm, human health imagery with a scrim
  behind any text; rotate via an accessible, pausable carousel.
- Source from licensed authentic libraries or commissioned shoots — not generic
  "medical stock". Keep a consistent grade/tone across a surface.
