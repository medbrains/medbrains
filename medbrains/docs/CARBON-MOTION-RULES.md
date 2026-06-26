# Carbon Motion Rules (MedBrains)

Actionable extraction of IBM Carbon animation
(https://www.ibm.com/design/language/animation/classic-principles +
/animation/tips-and-techniques). Motion in a clinical system must be **purposeful,
fast, and never decorative** — it guides attention and explains state, then gets
out of the way.

## Two motion styles

- **Productive (default):** UI feedback, transitions, data updates. Short, subtle,
  efficient. Use for almost everything in MedBrains.
- **Expressive:** moments of significance (first run, success, empty→filled). Use
  sparingly; never on routine clinical actions.

## Durations (Carbon scale)

| Token | ms | Use |
|---|---|---|
| fast-01 | 70 | micro: hover, small state |
| fast-02 | 110 | micro: checkbox, toggle |
| moderate-01 | 150 | productive: most transitions |
| moderate-02 | 240 | productive: larger surfaces |
| slow-01 | 400 | expressive: dialogs, page |
| slow-02 | 700 | expressive: large/hero only |

- The bigger the element / longer the distance, the longer the duration — but
  **cap UI feedback at ~240ms**. Anything slower feels laggy in a busy ward.

## Easing

- **Productive — standard easing** `cubic-bezier(0.2, 0, 0.38, 0.9)` for most
  enter/exit; `ease-out` for entrances, `ease-in` for exits.
- **Expressive easing** `cubic-bezier(0.4, 0.14, 0.3, 1)` for significant motion.
- Never linear for UI (feels mechanical) except continuous loops (spinners, the
  ECG loader).

## Classic principles (applied)

- **Easing/slow-in-slow-out:** motion accelerates and decelerates — no constant
  velocity for discrete transitions.
- **Follow-through / staggering:** sequence related elements with small delays
  (e.g. list items 20–40ms apart) rather than all-at-once; one orchestrated reveal
  beats scattered micro-animations.
- **Anticipation:** a brief cue before a big change (e.g. press scale before action).
- **Continuity:** animate between states (shared element / position) so the user
  tracks what changed; don't pop.

## Hard rules for MedBrains

- **Respect `prefers-reduced-motion: reduce`** — disable non-essential motion
  (transitions → none, transforms → none). Already wired globally in
  `signature-spectrum.css`; every new animation must include the reduced-motion
  fallback (WCAG 2.3.3 / 2.2.2).
- **No motion that blocks a task** — never gate a clinical action behind an
  animation; status must be readable instantly.
- **No infinite/auto-playing motion > 5s** without a pause control (WCAG 2.2.2);
  the news/marquee + carousels must be pausable.
- Drive motion from **tokens** (durations/easing above), not magic numbers.
- Use the existing `AnimatedIcon` / `PageTransition` / `TopProgressBar` primitives;
  don't hand-roll keyframes per component.
