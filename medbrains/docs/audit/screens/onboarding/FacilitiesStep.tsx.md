# `onboarding/FacilitiesStep.tsx` walkthrough

_Source: [`apps/web/src/pages/onboarding/FacilitiesStep.tsx`](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx) (262 lines). Guard: `—`. API methods: 0. useForm: 1. Tables: 0. Modals: 1._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `(none)` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Modals / Drawers

### Modal — _<modal @ line 154>_ @ [line 154](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L154)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (8)

- [ ] **Code** (`TextInput`, [line 161](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L161)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 170](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L170)) — accepts input, default value sensible, persists after refresh
- [ ] **Facility Type** (`Select`, [line 179](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L179)) — accepts input, default value sensible, persists after refresh
- [ ] **Parent Facility** (`Select`, [line 192](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L192)) — accepts input, default value sensible, persists after refresh
- [ ] **Shared Billing** (`Switch`, [line 206](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L206)) — accepts input, default value sensible, persists after refresh
- [ ] **Shared Pharmacy** (`Switch`, [line 217](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L217)) — accepts input, default value sensible, persists after refresh
- [ ] **Shared Lab** (`Switch`, [line 228](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L228)) — accepts input, default value sensible, persists after refresh
- [ ] **Shared HR** (`Switch`, [line 239](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L239)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 4, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **Add Sub-Institution** ([line 150](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L150)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Add Sub-Institution** ([line 150](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L150)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Add Facility** ([line 246](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L246)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Add Facility** ([line 246](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L246)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Back** ([line 254](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L254)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Back** ([line 254](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L254)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Continue** ([line 257](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L257)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Continue** ([line 257](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L257)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 139>** ([line 139](../../../apps/web/src/pages/onboarding/FacilitiesStep.tsx#L139)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._