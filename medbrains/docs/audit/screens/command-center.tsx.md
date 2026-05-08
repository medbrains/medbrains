# `command-center.tsx` walkthrough

_Source: [`apps/web/src/pages/command-center.tsx`](../../../apps/web/src/pages/command-center.tsx) (1322 lines). Guard: `P.COMMAND_CENTER.VIEW`. API methods: 15. useForm: 0. Tables: 0. Modals: 3._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.COMMAND_CENTER.VIEW` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Overview** (`overview`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Overview** (`overview`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Overview** (`overview`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Bed Management** (`beds`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Bed Management** (`beds`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Bed Management** (`beds`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Discharge Coordinator** (`discharge`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Discharge Coordinator** (`discharge`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Discharge Coordinator** (`discharge`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Transport** (`transport`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Transport** (`transport`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Transport** (`transport`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Alerts & Thresholds** (`alerts`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Alerts & Thresholds** (`alerts`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Alerts & Thresholds** (`alerts`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (54)
- [ ] Column **Department** (`department`) renders without `undefined` / `[object Object]`
- [ ] Column **Beds** (`beds`) renders without `undefined` / `[object Object]`
- [ ] Column **Occupancy %** (`occupancy`) renders without `undefined` / `[object Object]`
- [ ] Column **Queue** (`queue`) renders without `undefined` / `[object Object]`
- [ ] Column **Avg Wait** (`avg_wait`) renders without `undefined` / `[object Object]`
- [ ] Column **Level** (`level`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`dept`) renders without `undefined` / `[object Object]`
- [ ] Column **Message** (`message`) renders without `undefined` / `[object Object]`
- [ ] Column **Time** (`time`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Location** (`location`) renders without `undefined` / `[object Object]`
- [ ] Column **Ward** (`ward`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Discharge Time** (`discharge_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Cleaning Started** (`cleaning_started`) renders without `undefined` / `[object Object]`
- [ ] Column **Completed** (`cleaning_completed`) renders without `undefined` / `[object Object]`
- [ ] Column **Turnaround (min)** (`turnaround`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient`) renders without `undefined` / `[object Object]`
- [ ] Column **UHID** (`uhid`) renders without `undefined` / `[object Object]`
- [ ] Column **Ward** (`ward`) renders without `undefined` / `[object Object]`
- [ ] Column **Bed** (`bed`) renders without `undefined` / `[object Object]`
- [ ] Column **Expected Discharge** (`expected`) renders without `undefined` / `[object Object]`
- [ ] Column **Days** (`days`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient`) renders without `undefined` / `[object Object]`
- [ ] Column **Ward** (`ward`) renders without `undefined` / `[object Object]`
- [ ] Column **Bed** (`bed`) renders without `undefined` / `[object Object]`
- [ ] Column **Doctor** (`doctor`) renders without `undefined` / `[object Object]`
- [ ] Column **Admitted** (`admitted`) renders without `undefined` / `[object Object]`
- [ ] Column **Expected Discharge** (`expected`) renders without `undefined` / `[object Object]`
- [ ] Column **Days** (`days`) renders without `undefined` / `[object Object]`
- [ ] Column **Blockers** (`blockers`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient`) renders without `undefined` / `[object Object]`
- [ ] Column **From** (`from`) renders without `undefined` / `[object Object]`
- [ ] Column **To** (`to`) renders without `undefined` / `[object Object]`
- [ ] Column **Mode** (`mode`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Requested By** (`requested_by`) renders without `undefined` / `[object Object]`
- [ ] Column **Assigned To** (`assigned_to`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`dept`) renders without `undefined` / `[object Object]`
- [ ] Column **Level** (`level`) renders without `undefined` / `[object Object]`
- [ ] Column **Metric** (`metric`) renders without `undefined` / `[object Object]`
- [ ] Column **Current Value** (`current`) renders without `undefined` / `[object Object]`
- [ ] Column **Threshold** (`threshold`) renders without `undefined` / `[object Object]`
- [ ] Column **Message** (`message`) renders without `undefined` / `[object Object]`
- [ ] Column **Time** (`time`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`dept`) renders without `undefined` / `[object Object]`
- [ ] Column **Metric** (`metric`) renders without `undefined` / `[object Object]`
- [ ] _… 4 more columns — review remaining_

## Modals / Drawers

### Modal — _New Transport Request_ @ [line 961](../../../apps/web/src/pages/command-center.tsx#L961)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 1007>_ @ [line 1007](../../../apps/web/src/pages/command-center.tsx#L1007)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Add Alert Threshold_ @ [line 1275](../../../apps/web/src/pages/command-center.tsx#L1275)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (11)

- [ ] **Patient Name (optional)** (`TextInput`, [line 963](../../../apps/web/src/pages/command-center.tsx#L963)) — accepts input, default value sensible, persists after refresh
- [ ] **From Location** (`TextInput`, [line 968](../../../apps/web/src/pages/command-center.tsx#L968)) — accepts input, default value sensible, persists after refresh
- [ ] **To Location** (`TextInput`, [line 974](../../../apps/web/src/pages/command-center.tsx#L974)) — accepts input, default value sensible, persists after refresh
- [ ] **Mode** (`Select`, [line 980](../../../apps/web/src/pages/command-center.tsx#L980)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 986](../../../apps/web/src/pages/command-center.tsx#L986)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`TextInput`, [line 992](../../../apps/web/src/pages/command-center.tsx#L992)) — accepts input, default value sensible, persists after refresh
- [ ] **Assign To (Staff Name / ID)** (`TextInput`, [line 1014](../../../apps/web/src/pages/command-center.tsx#L1014)) — accepts input, default value sensible, persists after refresh
- [ ] **Department ID** (`TextInput`, [line 1277](../../../apps/web/src/pages/command-center.tsx#L1277)) — accepts input, default value sensible, persists after refresh
- [ ] **Metric** (`Select`, [line 1284](../../../apps/web/src/pages/command-center.tsx#L1284)) — accepts input, default value sensible, persists after refresh
- [ ] **Warning Threshold** (`NumberInput`, [line 1291](../../../apps/web/src/pages/command-center.tsx#L1291)) — accepts input, default value sensible, persists after refresh
- [ ] **Critical Threshold** (`NumberInput`, [line 1299](../../../apps/web/src/pages/command-center.tsx#L1299)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 10, `<ActionIcon>`: 3, `<Menu.Item>`: 0)

- [ ] **setAssignModalId(r.id)}>                 Assign** ([line 910](../../../apps/web/src/pages/command-center.tsx#L910)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setAssignModalId(r.id)}>                 Assign** ([line 910](../../../apps/web/src/pages/command-center.tsx#L910)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 915>** ([line 915](../../../apps/web/src/pages/command-center.tsx#L915)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 915>** ([line 915](../../../apps/web/src/pages/command-center.tsx#L915)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 952>** ([line 952](../../../apps/web/src/pages/command-center.tsx#L952)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 952>** ([line 952](../../../apps/web/src/pages/command-center.tsx#L952)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 998](../../../apps/web/src/pages/command-center.tsx#L998)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 998](../../../apps/web/src/pages/command-center.tsx#L998)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 999>** ([line 999](../../../apps/web/src/pages/command-center.tsx#L999)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 999>** ([line 999](../../../apps/web/src/pages/command-center.tsx#L999)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1021>** ([line 1021](../../../apps/web/src/pages/command-center.tsx#L1021)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1021>** ([line 1021](../../../apps/web/src/pages/command-center.tsx#L1021)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1024>** ([line 1024](../../../apps/web/src/pages/command-center.tsx#L1024)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1024>** ([line 1024](../../../apps/web/src/pages/command-center.tsx#L1024)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1266>** ([line 1266](../../../apps/web/src/pages/command-center.tsx#L1266)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1266>** ([line 1266](../../../apps/web/src/pages/command-center.tsx#L1266)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 1308](../../../apps/web/src/pages/command-center.tsx#L1308)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 1308](../../../apps/web/src/pages/command-center.tsx#L1308)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1309>** ([line 1309](../../../apps/web/src/pages/command-center.tsx#L1309)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1309>** ([line 1309](../../../apps/web/src/pages/command-center.tsx#L1309)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 324>** ([line 324](../../../apps/web/src/pages/command-center.tsx#L324)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1151>** ([line 1151](../../../apps/web/src/pages/command-center.tsx#L1151)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1214>** ([line 1214](../../../apps/web/src/pages/command-center.tsx#L1214)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (15)

- [ ] `api.acknowledgeDeptAlert` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.assignTransport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.completeTransport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAlertThreshold` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createTransportRequest` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getActiveAlerts` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getBedTurnaround` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getDepartmentLoad` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getKpis` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPatientFlow` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getTurnaroundStats` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAlertThresholds` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPendingDischarges` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listTransportRequests` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateAlertThreshold` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._