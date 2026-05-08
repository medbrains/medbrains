# `insurance.tsx` walkthrough

_Source: [`apps/web/src/pages/insurance.tsx`](../../../apps/web/src/pages/insurance.tsx) (1289 lines). Guard: `P.INSURANCE.VERIFICATION_LIST`. API methods: 15. useForm: 0. Tables: 4. Modals: 7._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.INSURANCE.VERIFICATION_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
          Verification** (`verification`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Verification** (`verification`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Verification** (`verification`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Prior Authorization** (`prior-auth`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Prior Authorization** (`prior-auth`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Prior Authorization** (`prior-auth`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Appeals** (`appeals`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Appeals** (`appeals`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Appeals** (`appeals`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          PA Rules** (`rules`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          PA Rules** (`rules`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          PA Rules** (`rules`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Dashboard** (`dashboard`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Dashboard** (`dashboard`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Dashboard** (`dashboard`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (27)
- [ ] Column **Patient ID** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Payer** (`payer_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Trigger** (`trigger_point`) renders without `undefined` / `[object Object]`
- [ ] Column **Scheme** (`scheme_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Coverage** (`coverage`) renders without `undefined` / `[object Object]`
- [ ] Column **Verified** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **PA #** (`pa_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Service** (`service_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Urgency** (`urgency`) renders without `undefined` / `[object Object]`
- [ ] Column **TAT** (`tat`) renders without `undefined` / `[object Object]`
- [ ] Column **Escalated** (`escalated`) renders without `undefined` / `[object Object]`
- [ ] Column **Appeal #** (`appeal_number`) renders without `undefined` / `[object Object]`
- [ ] Column **PA ID** (`prior_auth_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Level** (`level`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Deadline** (`deadline`) renders without `undefined` / `[object Object]`
- [ ] Column **Created** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Rule Name** (`rule_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Service Type** (`service_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Provider** (`insurance_provider`) renders without `undefined` / `[object Object]`
- [ ] Column **Code / Pattern** (`charge_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Thresholds** (`thresholds`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _Run Verification_ @ [line 256](../../../apps/web/src/pages/insurance.tsx#L256)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 283>_ @ [line 283](../../../apps/web/src/pages/insurance.tsx#L283)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Prior Authorization_ @ [line 555](../../../apps/web/src/pages/insurance.tsx#L555)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 607>_ @ [line 607](../../../apps/web/src/pages/insurance.tsx#L607)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 729>_ @ [line 729](../../../apps/web/src/pages/insurance.tsx#L729)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Appeal_ @ [line 938](../../../apps/web/src/pages/insurance.tsx#L938)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add PA Requirement Rule_ @ [line 1086](../../../apps/web/src/pages/insurance.tsx#L1086)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (37)

- [ ] **<Select @ line 183>** (`Select`, [line 183](../../../apps/web/src/pages/insurance.tsx#L183)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient ID** (`TextInput`, [line 258](../../../apps/web/src/pages/insurance.tsx#L258)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient Insurance ID** (`TextInput`, [line 264](../../../apps/web/src/pages/insurance.tsx#L264)) — accepts input, default value sensible, persists after refresh
- [ ] **Trigger Point** (`Select`, [line 270](../../../apps/web/src/pages/insurance.tsx#L270)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 467>** (`Select`, [line 467](../../../apps/web/src/pages/insurance.tsx#L467)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient ID** (`TextInput`, [line 557](../../../apps/web/src/pages/insurance.tsx#L557)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient Insurance ID** (`TextInput`, [line 563](../../../apps/web/src/pages/insurance.tsx#L563)) — accepts input, default value sensible, persists after refresh
- [ ] **Service Type** (`TextInput`, [line 569](../../../apps/web/src/pages/insurance.tsx#L569)) — accepts input, default value sensible, persists after refresh
- [ ] **Service Code** (`TextInput`, [line 575](../../../apps/web/src/pages/insurance.tsx#L575)) — accepts input, default value sensible, persists after refresh
- [ ] **Service Description** (`Textarea`, [line 580](../../../apps/web/src/pages/insurance.tsx#L580)) — accepts input, default value sensible, persists after refresh
- [ ] **Urgency** (`Select`, [line 585](../../../apps/web/src/pages/insurance.tsx#L585)) — accepts input, default value sensible, persists after refresh
- [ ] **Estimated Cost** (`NumberInput`, [line 593](../../../apps/web/src/pages/insurance.tsx#L593)) — accepts input, default value sensible, persists after refresh
- [ ] **Decision** (`Select`, [line 737](../../../apps/web/src/pages/insurance.tsx#L737)) — accepts input, default value sensible, persists after refresh
- [ ] **Auth Number** (`TextInput`, [line 751](../../../apps/web/src/pages/insurance.tsx#L751)) — accepts input, default value sensible, persists after refresh
- [ ] **Approved Amount** (`NumberInput`, [line 756](../../../apps/web/src/pages/insurance.tsx#L756)) — accepts input, default value sensible, persists after refresh
- [ ] **Approved Units** (`NumberInput`, [line 765](../../../apps/web/src/pages/insurance.tsx#L765)) — accepts input, default value sensible, persists after refresh
- [ ] **Denial Code** (`TextInput`, [line 777](../../../apps/web/src/pages/insurance.tsx#L777)) — accepts input, default value sensible, persists after refresh
- [ ] **Denial Reason** (`Textarea`, [line 782](../../../apps/web/src/pages/insurance.tsx#L782)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 791](../../../apps/web/src/pages/insurance.tsx#L791)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 863>** (`Select`, [line 863](../../../apps/web/src/pages/insurance.tsx#L863)) — accepts input, default value sensible, persists after refresh
- [ ] **Prior Auth ID (denied PA)** (`TextInput`, [line 940](../../../apps/web/src/pages/insurance.tsx#L940)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`Textarea`, [line 946](../../../apps/web/src/pages/insurance.tsx#L946)) — accepts input, default value sensible, persists after refresh
- [ ] **Clinical Rationale** (`Textarea`, [line 951](../../../apps/web/src/pages/insurance.tsx#L951)) — accepts input, default value sensible, persists after refresh
- [ ] **Supporting Evidence** (`Textarea`, [line 957](../../../apps/web/src/pages/insurance.tsx#L957)) — accepts input, default value sensible, persists after refresh
- [ ] **Appeal Letter Content** (`Textarea`, [line 963](../../../apps/web/src/pages/insurance.tsx#L963)) — accepts input, default value sensible, persists after refresh
- [ ] **<Switch @ line 1072>** (`Switch`, [line 1072](../../../apps/web/src/pages/insurance.tsx#L1072)) — accepts input, default value sensible, persists after refresh
- [ ] **Rule Name** (`TextInput`, [line 1088](../../../apps/web/src/pages/insurance.tsx#L1088)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 1094](../../../apps/web/src/pages/insurance.tsx#L1094)) — accepts input, default value sensible, persists after refresh
- [ ] **Insurance Provider (blank = all)** (`TextInput`, [line 1099](../../../apps/web/src/pages/insurance.tsx#L1099)) — accepts input, default value sensible, persists after refresh
- [ ] **Scheme Type** (`Select`, [line 1104](../../../apps/web/src/pages/insurance.tsx#L1104)) — accepts input, default value sensible, persists after refresh
- [ ] **TPA Name** (`TextInput`, [line 1111](../../../apps/web/src/pages/insurance.tsx#L1111)) — accepts input, default value sensible, persists after refresh
- [ ] **Service Type** (`TextInput`, [line 1116](../../../apps/web/src/pages/insurance.tsx#L1116)) — accepts input, default value sensible, persists after refresh
- [ ] **Charge Code** (`TextInput`, [line 1121](../../../apps/web/src/pages/insurance.tsx#L1121)) — accepts input, default value sensible, persists after refresh
- [ ] **Charge Code Pattern (regex)** (`TextInput`, [line 1126](../../../apps/web/src/pages/insurance.tsx#L1126)) — accepts input, default value sensible, persists after refresh
- [ ] **Cost Threshold (₹)** (`NumberInput`, [line 1131](../../../apps/web/src/pages/insurance.tsx#L1131)) — accepts input, default value sensible, persists after refresh
- [ ] **LOS Threshold (days)** (`NumberInput`, [line 1138](../../../apps/web/src/pages/insurance.tsx#L1138)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`NumberInput`, [line 1144](../../../apps/web/src/pages/insurance.tsx#L1144)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 12, `<ActionIcon>`: 4, `<Menu.Item>`: 0)

- [ ] **<button @ line 175>** ([line 175](../../../apps/web/src/pages/insurance.tsx#L175)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 175>** ([line 175](../../../apps/web/src/pages/insurance.tsx#L175)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **runMut.mutate(form)}>             Verify** ([line 276](../../../apps/web/src/pages/insurance.tsx#L276)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **runMut.mutate(form)}>             Verify** ([line 276](../../../apps/web/src/pages/insurance.tsx#L276)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 459>** ([line 459](../../../apps/web/src/pages/insurance.tsx#L459)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 459>** ([line 459](../../../apps/web/src/pages/insurance.tsx#L459)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>             Create PA Request** ([line 600](../../../apps/web/src/pages/insurance.tsx#L600)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>             Create PA Request** ([line 600](../../../apps/web/src/pages/insurance.tsx#L600)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 691>** ([line 691](../../../apps/web/src/pages/insurance.tsx#L691)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 691>** ([line 691](../../../apps/web/src/pages/insurance.tsx#L691)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 701>** ([line 701](../../../apps/web/src/pages/insurance.tsx#L701)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 701>** ([line 701](../../../apps/web/src/pages/insurance.tsx#L701)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 714>** ([line 714](../../../apps/web/src/pages/insurance.tsx#L714)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 714>** ([line 714](../../../apps/web/src/pages/insurance.tsx#L714)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 796>** ([line 796](../../../apps/web/src/pages/insurance.tsx#L796)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 796>** ([line 796](../../../apps/web/src/pages/insurance.tsx#L796)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 855>** ([line 855](../../../apps/web/src/pages/insurance.tsx#L855)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 855>** ([line 855](../../../apps/web/src/pages/insurance.tsx#L855)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>             Create Appeal** ([line 969](../../../apps/web/src/pages/insurance.tsx#L969)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>             Create Appeal** ([line 969](../../../apps/web/src/pages/insurance.tsx#L969)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1016>** ([line 1016](../../../apps/web/src/pages/insurance.tsx#L1016)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1016>** ([line 1016](../../../apps/web/src/pages/insurance.tsx#L1016)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>             Create Rule** ([line 1150](../../../apps/web/src/pages/insurance.tsx#L1150)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>             Create Rule** ([line 1150](../../../apps/web/src/pages/insurance.tsx#L1150)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 247>** ([line 247](../../../apps/web/src/pages/insurance.tsx#L247)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 534>** ([line 534](../../../apps/web/src/pages/insurance.tsx#L534)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 538>** ([line 538](../../../apps/web/src/pages/insurance.tsx#L538)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 922>** ([line 922](../../../apps/web/src/pages/insurance.tsx#L922)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (15)

- [ ] `api.cancelPriorAuth` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAppeal` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPaRule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPriorAuth` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getInsuranceDashboard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPriorAuth` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAppeals` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPaRules` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPriorAuths` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listVerifications` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.respondPriorAuth` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.runVerification` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.submitPriorAuth` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateAppeal` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updatePaRule` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._