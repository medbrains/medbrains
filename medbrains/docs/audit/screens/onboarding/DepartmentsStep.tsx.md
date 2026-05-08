# `onboarding/DepartmentsStep.tsx` walkthrough

_Source: [`apps/web/src/pages/onboarding/DepartmentsStep.tsx`](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx) (383 lines). Guard: `—`. API methods: 1. useForm: 1. Tables: 0. Modals: 1._

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

### Modal — _<modal @ line 250>_ @ [line 250](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L250)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (8)

- [ ] **Code** (`TextInput`, [line 258](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L258)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 267](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L267)) — accepts input, default value sensible, persists after refresh
- [ ] **Department Type** (`Select`, [line 276](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L276)) — accepts input, default value sensible, persists after refresh
- [ ] **Parent Department** (`Select`, [line 289](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L289)) — accepts input, default value sensible, persists after refresh
- [ ] **AM Start** (`TextInput`, [line 323](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L323)) — accepts input, default value sensible, persists after refresh
- [ ] **AM End** (`TextInput`, [line 332](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L332)) — accepts input, default value sensible, persists after refresh
- [ ] **PM Start** (`TextInput`, [line 341](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L341)) — accepts input, default value sensible, persists after refresh
- [ ] **PM End** (`TextInput`, [line 350](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L350)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 7, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **Quick-Add from Template** ([line 189](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L189)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Quick-Add from Template** ([line 189](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L189)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Quick-Add from Template** ([line 196](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L196)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Quick-Add from Template** ([line 196](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L196)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 202>** ([line 202](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L202)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 202>** ([line 202](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L202)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 308>** ([line 308](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L308)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 308>** ([line 308](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L308)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Add Department** ([line 367](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L367)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Add Department** ([line 367](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L367)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Back** ([line 375](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L375)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Back** ([line 375](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L375)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Continue** ([line 378](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L378)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Continue** ([line 378](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L378)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 238>** ([line 238](../../../apps/web/src/pages/onboarding/DepartmentsStep.tsx#L238)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (1)

- [ ] `api.importDepartments` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._