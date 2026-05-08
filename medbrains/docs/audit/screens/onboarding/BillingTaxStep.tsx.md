# `onboarding/BillingTaxStep.tsx` walkthrough

_Source: [`apps/web/src/pages/onboarding/BillingTaxStep.tsx`](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx) (339 lines). Guard: `—`. API methods: 0. useForm: 2. Tables: 0. Modals: 2._

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

### Modal — _<modal @ line 234>_ @ [line 234](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L234)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 293>_ @ [line 293](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L293)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (8)

- [ ] **Code** (`TextInput`, [line 241](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L241)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 250](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L250)) — accepts input, default value sensible, persists after refresh
- [ ] **Rate (%)** (`NumberInput`, [line 259](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L259)) — accepts input, default value sensible, persists after refresh
- [ ] **Applicability** (`Select`, [line 274](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L274)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`TextInput`, [line 283](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L283)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 300](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L300)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 309](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L309)) — accepts input, default value sensible, persists after refresh
- [ ] **Set as default payment method** (`Switch`, [line 318](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L318)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 8, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 150>** ([line 150](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L150)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 150>** ([line 150](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L150)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Quick-Add GST Templates** ([line 161](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L161)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Quick-Add GST Templates** ([line 161](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L161)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 196>** ([line 196](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L196)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 196>** ([line 196](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L196)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Quick-Add Common Methods** ([line 207](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L207)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Quick-Add Common Methods** ([line 207](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L207)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Add Tax Category** ([line 287](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L287)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Add Tax Category** ([line 287](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L287)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Add Payment Method** ([line 325](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L325)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Add Payment Method** ([line 325](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L325)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Back** ([line 331](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L331)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Back** ([line 331](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L331)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Continue** ([line 334](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L334)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Continue** ([line 334](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L334)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 176>** ([line 176](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L176)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 220>** ([line 220](../../../apps/web/src/pages/onboarding/BillingTaxStep.tsx#L220)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._