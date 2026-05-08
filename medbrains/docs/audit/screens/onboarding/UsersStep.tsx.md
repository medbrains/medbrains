# `onboarding/UsersStep.tsx` walkthrough

_Source: [`apps/web/src/pages/onboarding/UsersStep.tsx`](../../../apps/web/src/pages/onboarding/UsersStep.tsx) (401 lines). Guard: `—`. API methods: 1. useForm: 2. Tables: 0. Modals: 2._

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

### Modal — _<modal @ line 247>_ @ [line 247](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L247)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 357>_ @ [line 357](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L357)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (13)

- [ ] **Full Name** (`TextInput`, [line 255](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L255)) — accepts input, default value sensible, persists after refresh
- [ ] **Username** (`TextInput`, [line 261](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L261)) — accepts input, default value sensible, persists after refresh
- [ ] **Email** (`TextInput`, [line 266](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L266)) — accepts input, default value sensible, persists after refresh
- [ ] **Password** (`PasswordInput`, [line 272](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L272)) — accepts input, default value sensible, persists after refresh
- [ ] **Role** (`Select`, [line 281](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L281)) — accepts input, default value sensible, persists after refresh
- [ ] **Specialization** (`TextInput`, [line 301](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L301)) — accepts input, default value sensible, persists after refresh
- [ ] **Medical Registration Number** (`TextInput`, [line 307](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L307)) — accepts input, default value sensible, persists after refresh
- [ ] **Qualification** (`TextInput`, [line 313](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L313)) — accepts input, default value sensible, persists after refresh
- [ ] **Consultation Fee** (`NumberInput`, [line 323](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L323)) — accepts input, default value sensible, persists after refresh
- [ ] **Departments** (`MultiSelect`, [line 337](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L337)) — accepts input, default value sensible, persists after refresh
- [ ] **Role Code** (`TextInput`, [line 365](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L365)) — accepts input, default value sensible, persists after refresh
- [ ] **Role Name** (`TextInput`, [line 375](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L375)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`TextInput`, [line 380](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L380)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 7, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 161>** ([line 161](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L161)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 161>** ([line 161](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L161)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 168>** ([line 168](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L168)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 168>** ([line 168](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L168)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 177>** ([line 177](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L177)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 177>** ([line 177](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L177)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Create User** ([line 349](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L349)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Create User** ([line 349](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L349)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Create Role** ([line 385](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L385)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Create Role** ([line 385](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L385)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Back** ([line 393](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L393)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Back** ([line 393](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L393)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Continue** ([line 396](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L396)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Continue** ([line 396](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L396)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 204>** ([line 204](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L204)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 234>** ([line 234](../../../apps/web/src/pages/onboarding/UsersStep.tsx#L234)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (1)

- [ ] `api.importUsers` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._