# Plan UI before build

**Rule:** before writing any UI code for a story, produce a short **UI plan** and
get it agreed. No layout/components/UX decided while typing JSX. Planning is a
distinct step, not a paragraph in the PR description after the fact.

This pairs with [UI_GUIDELINES.md](./UI_GUIDELINES.md) — the guidelines say *how*
things must look; this says *decide the shape first*.

## When it applies

Any story that adds or materially changes a screen, page, drawer, modal, or
flow. Skip only for: pure logic/data changes with no visual change, copy tweaks,
or a one-line prop fix.

## The plan (keep it short — half a page)

Write it in the story/issue or a scratch note, then build to it:

1. **Placement** — where it lives in the service-nav; route; does it collapse the
   global rail (detail route)? one identity source on screen.
2. **Layout** — page skeleton in words or ASCII: header, toolbar, content
   regions, side pane. Density/console rules apply.
3. **Components** — which `@/components/ui` primitives. If something's missing,
   say so **now** — add the primitive to the seam first, don't inline raw
   Mantine. Reuse `PageHeader`/`DataTable`/`FormModal`/`PatientContextBanner`.
4. **Surface choice** — drawer (work alongside content) vs modal (short task) vs
   full page. Justify it.
5. **States** — loading (skeleton/ECG), empty (what + next action), error,
   partial/stale, disabled-with-reason. List them; don't discover them later.
6. **Data** — TanStack queries/mutations, query keys, optimistic vs confirmed.
7. **Permissions** — page guard `useRequirePermission(...)`; which actions gate
   on which `P.*`; query `enabled` gating.
8. **A11y & responsive** — keyboard path, labels, focus, ≥36px targets; how it
   reflows narrow.
9. **Clinical/safety** — persistent safety info, semantic decorations, regulatory
   badges if relevant.

## How to run it

- For non-trivial screens, use **plan mode** (EnterPlanMode) — draft the plan,
  use AskUserQuestion for genuine forks (drawer vs modal, which primitive), then
  ExitPlanMode to get sign-off **before** coding.
- For small changes, a 3–5 line plan inline in the PR/issue is enough.
- If building reveals the plan was wrong, stop and revise the plan, then continue
  — don't let the code silently drift from the agreed shape.

## Definition of done (planning)

A UI story isn't "started" until the plan exists and these are answered:
placement · layout · primitives (and any new ones) · surface · all states ·
permissions. If any is "we'll see when we build it," the plan isn't done.
