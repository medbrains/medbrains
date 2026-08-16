# RFC — Adopt `boneyard-js` for skeleton loading states

**Status:** DRAFT — evaluation + integration plan (user request: "use boneyard js for skeletonjs", https://github.com/0xGF/boneyard)
**Owner:** frontend
**Surfaces:** web (React 18 + Vite 8/Rolldown), mobile (React Native CLI), TV (React Native)

## What it is

`boneyard-js` (npm, v1.9.0) auto-generates **pixel-perfect skeleton loading screens** from your real components. You wrap a component in `<Skeleton name="..." loading={isLoading}>`; a build/dev step opens the app in a **headless browser (Playwright)**, finds every `<Skeleton>`, and snapshots its actual DOM layout at multiple breakpoints into a generated "bone registry". At runtime the `<Skeleton>` renders that captured layout while `loading`, then swaps to children.

- **Cross-framework** — exports `/react`, `/vue`, `/svelte`, `/preact`, `/angular`, `/react-native` (+ `/native-scan`, `/layout`, `/vite`). Matches our web + mobile + TV surface split (one skeleton system across all three).
- **Peers:** `react>=18` (we're on 18 ✓), `vite>=5` (we're on **Vite 8 / Rolldown** — compat unverified), `react-native>=0.71`.
- **Runtime dep:** `playwright ^1.58` (the capture engine — heavy; browser binaries download on demand).
- **API props:** `loading` (bool), `name` (unique id), `color`, `animate` ('pulse'|'shimmer'|'solid'), `transition`.

```tsx
import { Skeleton } from "boneyard-js/react";
<Skeleton name="patient-card" loading={isLoading}>
  {data && <PatientCard data={data} />}
</Skeleton>
```

## Why it fits MedBrains

- We currently hand-roll loading states (ECG loader, DataTable `loading`, ad-hoc placeholders). Skeletons that match the *real* layout are better perceived-performance UX and remove hand-tuned placeholder drift.
- One cross-framework skeleton system aligns with the "share via `@medbrains/*`, never fork per surface" rule (DEVICE-SURFACE-DESIGN-RULES) — same `name` registry concept usable on web/mobile/TV.
- Ties into the constrained-device rules (fail-safe, never-blank): a captured skeleton is a real last-good render.

## Risks / open questions (blockers before wiring into build)

1. **Vite 8 / Rolldown compat** — plugin peer is `vite>=5`; Rolldown-vite is drop-in but plugin behaviour isn't guaranteed. → **Spike:** add `boneyard()` to `apps/web/vite.config.ts` behind a flag, confirm `pnpm --filter @medbrains/web build` still `built in`.
2. **Playwright weight** — adds a browser toolchain to install/CI. `<Skeleton>` runtime component must NOT pull playwright (only the CLI/vite-plugin capture does); verify the `/react` entry is playwright-free and gate the capture step so normal `build`/`dev` don't spawn a browser unless capturing.
3. **Capture cadence (DECISION NEEDED):** when does the bone-capture run and are generated bones committed?
   - (a) **dev-watch** — regenerate on component change (fastest feedback, noisy);
   - (b) **pre-commit / explicit `pnpm bones`** — commit the generated registry (deterministic, reviewable) — *recommended*;
   - (c) **CI-only** — capture in CI, artifact the registry (no local browser needed, but PRs can't preview skeletons).
4. **a11y** — skeletons must keep `aria-busy`/reduced-motion honoured (WCAG 2.2 + Carbon motion rules). Confirm boneyard emits these or wrap it in the seam to add them.

## Integration plan (staged)

- **P0 spike (this task):** `pnpm --filter @medbrains/web add -D boneyard-js`; add `boneyard/vite` plugin behind an env flag; confirm Vite 8/Rolldown build stays green; add a `Skeleton` primitive to `@/components/ui` that wraps `boneyard-js/react` (seam-first, adds `aria-busy` + reduced-motion). One proof usage on a real loading screen (e.g. a patient card).
- **P1:** decide capture cadence (Q3), wire the `pnpm bones` script + commit the registry, replace 3–5 hand-rolled loaders.
- **P2:** extend to mobile (`boneyard-js/react-native` + `/native-scan`) and TV, sharing the skeleton seam via `@medbrains/*`.
- **P3:** sweep remaining loaders to skeletons where layout is stable.

## Recommendation

Proceed with the **P0 spike** (isolated, reversible, one PR) to de-risk Vite 8/Rolldown compat + playwright isolation before any broad rollout. Hold P1+ until the capture-cadence decision (Q3) is made — recommend **(b) explicit `pnpm bones` + committed registry** for a reviewable, deterministic build.
