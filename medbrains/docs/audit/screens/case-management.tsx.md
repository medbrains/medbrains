# `case-management.tsx` walkthrough

_Source: [`apps/web/src/pages/case-management.tsx`](../../../apps/web/src/pages/case-management.tsx) (1152 lines). Guard: `P.CASE_MGMT.ASSIGNMENTS_LIST`. API methods: 14. useForm: 0. Tables: 5. Modals: 7._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.CASE_MGMT.ASSIGNMENTS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Case Board** (`board`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Case Board** (`board`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Case Board** (`board`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Discharge Barriers** (`barriers`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Discharge Barriers** (`barriers`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Discharge Barriers** (`barriers`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Referrals** (`referrals`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Referrals** (`referrals`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Referrals** (`referrals`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Analytics** (`analytics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Analytics** (`analytics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Analytics** (`analytics`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (23)
- [ ] Column **Admission** (`admission_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Case Manager** (`case_manager_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **LOS** (`los`) renders without `undefined` / `[object Object]`
- [ ] Column **Target Discharge** (`target_discharge_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Assignment** (`case_assignment_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Barrier Type** (`barrier_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Description** (`description`) renders without `undefined` / `[object Object]`
- [ ] Column **Identified** (`identified_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Resolved** (`is_resolved`) renders without `undefined` / `[object Object]`
- [ ] Column **Escalated To** (`escalated_to`) renders without `undefined` / `[object Object]`
- [ ] Column **Assignment** (`case_assignment_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`referral_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Referred To** (`referred_to`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Outcome** (`outcome`) renders without `undefined` / `[object Object]`
- [ ] Column **Disposition** (`disposition`) renders without `undefined` / `[object Object]`
- [ ] Column **Count** (`count`) renders without `undefined` / `[object Object]`
- [ ] Column **Barrier Type** (`barrier_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Count** (`count`) renders without `undefined` / `[object Object]`
- [ ] Column **Avg Days Open** (`avg_days_open`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Modal — _Case Details & Progress_ @ [line 602](../../../apps/web/src/pages/case-management.tsx#L602)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _Assign Case_ @ [line 466](../../../apps/web/src/pages/case-management.tsx#L466)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Auto-Assign Case_ @ [line 513](../../../apps/web/src/pages/case-management.tsx#L513)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Edit Case Assignment_ @ [line 541](../../../apps/web/src/pages/case-management.tsx#L541)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Discharge Barrier_ @ [line 824](../../../apps/web/src/pages/case-management.tsx#L824)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Referral_ @ [line 979](../../../apps/web/src/pages/case-management.tsx#L979)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Edit Referral_ @ [line 1025](../../../apps/web/src/pages/case-management.tsx#L1025)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (26)

- [ ] **<Select @ line 433>** (`Select`, [line 433](../../../apps/web/src/pages/case-management.tsx#L433)) — accepts input, default value sensible, persists after refresh
- [ ] **Admission ID** (`TextInput`, [line 468](../../../apps/web/src/pages/case-management.tsx#L468)) — accepts input, default value sensible, persists after refresh
- [ ] **Case Manager ID** (`TextInput`, [line 475](../../../apps/web/src/pages/case-management.tsx#L475)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 481](../../../apps/web/src/pages/case-management.tsx#L481)) — accepts input, default value sensible, persists after refresh
- [ ] **Target Discharge Date** (`DateInput`, [line 487](../../../apps/web/src/pages/case-management.tsx#L487)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 497](../../../apps/web/src/pages/case-management.tsx#L497)) — accepts input, default value sensible, persists after refresh
- [ ] **Admission ID** (`TextInput`, [line 515](../../../apps/web/src/pages/case-management.tsx#L515)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 522](../../../apps/web/src/pages/case-management.tsx#L522)) — accepts input, default value sensible, persists after refresh
- [ ] **Status** (`Select`, [line 543](../../../apps/web/src/pages/case-management.tsx#L543)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 557](../../../apps/web/src/pages/case-management.tsx#L557)) — accepts input, default value sensible, persists after refresh
- [ ] **Target Discharge Date** (`DateInput`, [line 563](../../../apps/web/src/pages/case-management.tsx#L563)) — accepts input, default value sensible, persists after refresh
- [ ] **Actual Discharge Date** (`DateInput`, [line 573](../../../apps/web/src/pages/case-management.tsx#L573)) — accepts input, default value sensible, persists after refresh
- [ ] **Discharge Disposition** (`TextInput`, [line 583](../../../apps/web/src/pages/case-management.tsx#L583)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 590](../../../apps/web/src/pages/case-management.tsx#L590)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 790>** (`TextInput`, [line 790](../../../apps/web/src/pages/case-management.tsx#L790)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 796>** (`Select`, [line 796](../../../apps/web/src/pages/case-management.tsx#L796)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 804>** (`Select`, [line 804](../../../apps/web/src/pages/case-management.tsx#L804)) — accepts input, default value sensible, persists after refresh
- [ ] **Case Assignment ID** (`TextInput`, [line 826](../../../apps/web/src/pages/case-management.tsx#L826)) — accepts input, default value sensible, persists after refresh
- [ ] **Barrier Type** (`Select`, [line 832](../../../apps/web/src/pages/case-management.tsx#L832)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 844](../../../apps/web/src/pages/case-management.tsx#L844)) — accepts input, default value sensible, persists after refresh
- [ ] **Case Assignment ID** (`TextInput`, [line 981](../../../apps/web/src/pages/case-management.tsx#L981)) — accepts input, default value sensible, persists after refresh
- [ ] **Referral Type** (`Select`, [line 987](../../../apps/web/src/pages/case-management.tsx#L987)) — accepts input, default value sensible, persists after refresh
- [ ] **Referred To** (`TextInput`, [line 994](../../../apps/web/src/pages/case-management.tsx#L994)) — accepts input, default value sensible, persists after refresh
- [ ] **Facility Name** (`TextInput`, [line 1000](../../../apps/web/src/pages/case-management.tsx#L1000)) — accepts input, default value sensible, persists after refresh
- [ ] **Status** (`Select`, [line 1027](../../../apps/web/src/pages/case-management.tsx#L1027)) — accepts input, default value sensible, persists after refresh
- [ ] **Outcome** (`Textarea`, [line 1039](../../../apps/web/src/pages/case-management.tsx#L1039)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 10, `<ActionIcon>`: 4, `<Menu.Item>`: 0)

- [ ] **<button @ line 448>** ([line 448](../../../apps/web/src/pages/case-management.tsx#L448)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 448>** ([line 448](../../../apps/web/src/pages/case-management.tsx#L448)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 455>** ([line 455](../../../apps/web/src/pages/case-management.tsx#L455)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 455>** ([line 455](../../../apps/web/src/pages/case-management.tsx#L455)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 502>** ([line 502](../../../apps/web/src/pages/case-management.tsx#L502)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 502>** ([line 502](../../../apps/web/src/pages/case-management.tsx#L502)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 529>** ([line 529](../../../apps/web/src/pages/case-management.tsx#L529)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 529>** ([line 529](../../../apps/web/src/pages/case-management.tsx#L529)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 595>** ([line 595](../../../apps/web/src/pages/case-management.tsx#L595)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 595>** ([line 595](../../../apps/web/src/pages/case-management.tsx#L595)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 816>** ([line 816](../../../apps/web/src/pages/case-management.tsx#L816)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 816>** ([line 816](../../../apps/web/src/pages/case-management.tsx#L816)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 850>** ([line 850](../../../apps/web/src/pages/case-management.tsx#L850)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 850>** ([line 850](../../../apps/web/src/pages/case-management.tsx#L850)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 970>** ([line 970](../../../apps/web/src/pages/case-management.tsx#L970)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 970>** ([line 970](../../../apps/web/src/pages/case-management.tsx#L970)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1014>** ([line 1014](../../../apps/web/src/pages/case-management.tsx#L1014)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1014>** ([line 1014](../../../apps/web/src/pages/case-management.tsx#L1014)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1044>** ([line 1044](../../../apps/web/src/pages/case-management.tsx#L1044)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1044>** ([line 1044](../../../apps/web/src/pages/case-management.tsx#L1044)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 378>** ([line 378](../../../apps/web/src/pages/case-management.tsx#L378)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 391>** ([line 391](../../../apps/web/src/pages/case-management.tsx#L391)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 774>** ([line 774](../../../apps/web/src/pages/case-management.tsx#L774)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 950>** ([line 950](../../../apps/web/src/pages/case-management.tsx#L950)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (14)

- [ ] `api.autoAssignCase` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.barrierAnalytics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.caseloadSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCaseAssignment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCaseReferral` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createDischargeBarrier` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.dispositionAnalytics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCaseAssignments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCaseReferrals` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDischargeBarriers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.outcomeAnalytics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateCaseAssignment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateCaseReferral` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateDischargeBarrier` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._