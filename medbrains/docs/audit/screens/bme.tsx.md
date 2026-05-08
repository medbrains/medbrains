# `bme.tsx` walkthrough

_Source: [`apps/web/src/pages/bme.tsx`](../../../apps/web/src/pages/bme.tsx) (985 lines). Guard: `P.BME.EQUIPMENT_LIST`. API methods: 20. useForm: 0. Tables: 10. Modals: 7._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.BME.EQUIPMENT_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Equipment** (`equipment`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Equipment** (`equipment`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Equipment** (`equipment`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Preventive Maintenance** (`pm`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Preventive Maintenance** (`pm`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Preventive Maintenance** (`pm`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Calibration** (`calibration`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Calibration** (`calibration`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Calibration** (`calibration`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Contracts** (`contracts`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Contracts** (`contracts`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Contracts** (`contracts`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Breakdowns** (`breakdowns`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Breakdowns** (`breakdowns`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Breakdowns** (`breakdowns`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Analytics** (`analytics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Analytics** (`analytics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Analytics** (`analytics`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (55)
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Make / Model** (`make_model`) renders without `undefined` / `[object Object]`
- [ ] Column **Serial #** (`serial_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Asset Tag** (`asset_tag`) renders without `undefined` / `[object Object]`
- [ ] Column **Risk** (`risk_category`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Warranty Until** (`warranty_end`) renders without `undefined` / `[object Object]`
- [ ] Column **Equipment** (`equipment`) renders without `undefined` / `[object Object]`
- [ ] Column **Frequency** (`frequency`) renders without `undefined` / `[object Object]`
- [ ] Column **Next Due** (`next_due`) renders without `undefined` / `[object Object]`
- [ ] Column **Last Done** (`last_completed`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`active`) renders without `undefined` / `[object Object]`
- [ ] Column **WO #** (`wo_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Equipment** (`equipment`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`type`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Scheduled** (`scheduled`) renders without `undefined` / `[object Object]`
- [ ] Column **Equipment** (`equipment`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Frequency** (`frequency`) renders without `undefined` / `[object Object]`
- [ ] Column **Last Calibrated** (`last_cal`) renders without `undefined` / `[object Object]`
- [ ] Column **Next Due** (`next_due`) renders without `undefined` / `[object Object]`
- [ ] Column **In Tolerance** (`tolerance`) renders without `undefined` / `[object Object]`
- [ ] Column **Certificate #** (`certificate`) renders without `undefined` / `[object Object]`
- [ ] Column **Locked** (`locked`) renders without `undefined` / `[object Object]`
- [ ] Column **Contract #** (`number`) renders without `undefined` / `[object Object]`
- [ ] Column **Equipment** (`equipment`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`type`) renders without `undefined` / `[object Object]`
- [ ] Column **Validity** (`validity`) renders without `undefined` / `[object Object]`
- [ ] Column **Value** (`value`) renders without `undefined` / `[object Object]`
- [ ] Column **Expiry** (`expiry`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`active`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Period** (`period`) renders without `undefined` / `[object Object]`
- [ ] Column **Overall Score** (`overall`) renders without `undefined` / `[object Object]`
- [ ] Column **SLA Compliance** (`sla`) renders without `undefined` / `[object Object]`
- [ ] Column **Comments** (`comments`) renders without `undefined` / `[object Object]`
- [ ] Column **Equipment** (`equipment`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Description** (`description`) renders without `undefined` / `[object Object]`
- [ ] Column **Reported** (`reported`) renders without `undefined` / `[object Object]`
- [ ] Column **Downtime (min)** (`downtime`) renders without `undefined` / `[object Object]`
- [ ] Column **Repair Cost** (`cost`) renders without `undefined` / `[object Object]`
- [ ] Column **Equipment Name** (`equipment_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Equipment ID** (`equipment_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Total Operating Hours** (`total_operating_hours`) renders without `undefined` / `[object Object]`
- [ ] Column **Breakdown Count** (`breakdown_count`) renders without `undefined` / `[object Object]`
- [ ] Column **MTBF (hours)** (`mtbf_hours`) renders without `undefined` / `[object Object]`
- [ ] _… 5 more columns — review remaining_

### `<Table>` @ line 692
  - [ ] Header **Equipment** column shows correct value for at least one row
  - [ ] Header **Contract #** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Contract Value** column shows correct value for at least one row
  - [ ] Header **Total WO Cost** column shows correct value for at least one row
  - [ ] Header **Utilization** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Drawer — _<drawer @ line 256>_ @ [line 256](../../../apps/web/src/pages/bme.tsx#L256)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add PM Schedule_ @ [line 440](../../../apps/web/src/pages/bme.tsx#L440)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Work Order_ @ [line 450](../../../apps/web/src/pages/bme.tsx#L450)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Calibration_ @ [line 546](../../../apps/web/src/pages/bme.tsx#L546)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Contract_ @ [line 735](../../../apps/web/src/pages/bme.tsx#L735)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Vendor Evaluation_ @ [line 756](../../../apps/web/src/pages/bme.tsx#L756)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Report Breakdown_ @ [line 849](../../../apps/web/src/pages/bme.tsx#L849)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (54)

- [ ] **Name** (`TextInput`, [line 258](../../../apps/web/src/pages/bme.tsx#L258)) — accepts input, default value sensible, persists after refresh
- [ ] **Make** (`TextInput`, [line 260](../../../apps/web/src/pages/bme.tsx#L260)) — accepts input, default value sensible, persists after refresh
- [ ] **Model** (`TextInput`, [line 261](../../../apps/web/src/pages/bme.tsx#L261)) — accepts input, default value sensible, persists after refresh
- [ ] **Serial Number** (`TextInput`, [line 264](../../../apps/web/src/pages/bme.tsx#L264)) — accepts input, default value sensible, persists after refresh
- [ ] **Asset Tag** (`TextInput`, [line 265](../../../apps/web/src/pages/bme.tsx#L265)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 268](../../../apps/web/src/pages/bme.tsx#L268)) — accepts input, default value sensible, persists after refresh
- [ ] **Risk Category** (`Select`, [line 269](../../../apps/web/src/pages/bme.tsx#L269)) — accepts input, default value sensible, persists after refresh
- [ ] **Critical Equipment** (`Switch`, [line 271](../../../apps/web/src/pages/bme.tsx#L271)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 272](../../../apps/web/src/pages/bme.tsx#L272)) — accepts input, default value sensible, persists after refresh
- [ ] **Equipment** (`Select`, [line 442](../../../apps/web/src/pages/bme.tsx#L442)) — accepts input, default value sensible, persists after refresh
- [ ] **Frequency** (`Select`, [line 443](../../../apps/web/src/pages/bme.tsx#L443)) — accepts input, default value sensible, persists after refresh
- [ ] **Next Due Date** (`DateInput`, [line 444](../../../apps/web/src/pages/bme.tsx#L444)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 445](../../../apps/web/src/pages/bme.tsx#L445)) — accepts input, default value sensible, persists after refresh
- [ ] **Equipment** (`Select`, [line 452](../../../apps/web/src/pages/bme.tsx#L452)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 453](../../../apps/web/src/pages/bme.tsx#L453)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 454](../../../apps/web/src/pages/bme.tsx#L454)) — accepts input, default value sensible, persists after refresh
- [ ] **Scheduled Date** (`DateInput`, [line 455](../../../apps/web/src/pages/bme.tsx#L455)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 456](../../../apps/web/src/pages/bme.tsx#L456)) — accepts input, default value sensible, persists after refresh
- [ ] **Equipment** (`Select`, [line 548](../../../apps/web/src/pages/bme.tsx#L548)) — accepts input, default value sensible, persists after refresh
- [ ] **Status** (`Select`, [line 549](../../../apps/web/src/pages/bme.tsx#L549)) — accepts input, default value sensible, persists after refresh
- [ ] **Frequency** (`Select`, [line 550](../../../apps/web/src/pages/bme.tsx#L550)) — accepts input, default value sensible, persists after refresh
- [ ] **Calibrated On** (`DateInput`, [line 551](../../../apps/web/src/pages/bme.tsx#L551)) — accepts input, default value sensible, persists after refresh
- [ ] **Next Due** (`DateInput`, [line 552](../../../apps/web/src/pages/bme.tsx#L552)) — accepts input, default value sensible, persists after refresh
- [ ] **Calibrated By** (`TextInput`, [line 553](../../../apps/web/src/pages/bme.tsx#L553)) — accepts input, default value sensible, persists after refresh
- [ ] **Certificate Number** (`TextInput`, [line 554](../../../apps/web/src/pages/bme.tsx#L554)) — accepts input, default value sensible, persists after refresh
- [ ] **Reference Standard** (`TextInput`, [line 555](../../../apps/web/src/pages/bme.tsx#L555)) — accepts input, default value sensible, persists after refresh
- [ ] **In Tolerance** (`Switch`, [line 556](../../../apps/web/src/pages/bme.tsx#L556)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 557](../../../apps/web/src/pages/bme.tsx#L557)) — accepts input, default value sensible, persists after refresh
- [ ] **Contract Number** (`TextInput`, [line 737](../../../apps/web/src/pages/bme.tsx#L737)) — accepts input, default value sensible, persists after refresh
- [ ] **Equipment** (`Select`, [line 738](../../../apps/web/src/pages/bme.tsx#L738)) — accepts input, default value sensible, persists after refresh
- [ ] **Contract Type** (`Select`, [line 739](../../../apps/web/src/pages/bme.tsx#L739)) — accepts input, default value sensible, persists after refresh
- [ ] **Vendor ID** (`TextInput`, [line 740](../../../apps/web/src/pages/bme.tsx#L740)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Date** (`DateInput`, [line 742](../../../apps/web/src/pages/bme.tsx#L742)) — accepts input, default value sensible, persists after refresh
- [ ] **End Date** (`DateInput`, [line 743](../../../apps/web/src/pages/bme.tsx#L743)) — accepts input, default value sensible, persists after refresh
- [ ] **Contract Value (₹)** (`NumberInput`, [line 745](../../../apps/web/src/pages/bme.tsx#L745)) — accepts input, default value sensible, persists after refresh
- [ ] **Coverage Details** (`Textarea`, [line 746](../../../apps/web/src/pages/bme.tsx#L746)) — accepts input, default value sensible, persists after refresh
- [ ] **Exclusions** (`Textarea`, [line 747](../../../apps/web/src/pages/bme.tsx#L747)) — accepts input, default value sensible, persists after refresh
- [ ] **SLA Response (hrs)** (`NumberInput`, [line 749](../../../apps/web/src/pages/bme.tsx#L749)) — accepts input, default value sensible, persists after refresh
- [ ] **SLA Resolution (hrs)** (`NumberInput`, [line 750](../../../apps/web/src/pages/bme.tsx#L750)) — accepts input, default value sensible, persists after refresh
- [ ] **Vendor ID** (`TextInput`, [line 758](../../../apps/web/src/pages/bme.tsx#L758)) — accepts input, default value sensible, persists after refresh
- [ ] **Evaluation Date** (`DateInput`, [line 759](../../../apps/web/src/pages/bme.tsx#L759)) — accepts input, default value sensible, persists after refresh
- [ ] **Response Time (1-5)** (`NumberInput`, [line 761](../../../apps/web/src/pages/bme.tsx#L761)) — accepts input, default value sensible, persists after refresh
- [ ] **Resolution Quality (1-5)** (`NumberInput`, [line 762](../../../apps/web/src/pages/bme.tsx#L762)) — accepts input, default value sensible, persists after refresh
- [ ] **Spare Parts (1-5)** (`NumberInput`, [line 765](../../../apps/web/src/pages/bme.tsx#L765)) — accepts input, default value sensible, persists after refresh
- [ ] **Professionalism (1-5)** (`NumberInput`, [line 766](../../../apps/web/src/pages/bme.tsx#L766)) — accepts input, default value sensible, persists after refresh
- [ ] **Overall Score** (`NumberInput`, [line 768](../../../apps/web/src/pages/bme.tsx#L768)) — accepts input, default value sensible, persists after refresh
- [ ] **Total Calls** (`NumberInput`, [line 770](../../../apps/web/src/pages/bme.tsx#L770)) — accepts input, default value sensible, persists after refresh
- [ ] **Calls within SLA** (`NumberInput`, [line 771](../../../apps/web/src/pages/bme.tsx#L771)) — accepts input, default value sensible, persists after refresh
- [ ] **Comments** (`Textarea`, [line 773](../../../apps/web/src/pages/bme.tsx#L773)) — accepts input, default value sensible, persists after refresh
- [ ] **Equipment** (`Select`, [line 851](../../../apps/web/src/pages/bme.tsx#L851)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 852](../../../apps/web/src/pages/bme.tsx#L852)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 853](../../../apps/web/src/pages/bme.tsx#L853)) — accepts input, default value sensible, persists after refresh
- [ ] **Vendor Visit Required** (`Switch`, [line 854](../../../apps/web/src/pages/bme.tsx#L854)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 855](../../../apps/web/src/pages/bme.tsx#L855)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 14, `<ActionIcon>`: 3, `<Menu.Item>`: 0)

- [ ] **<button @ line 252>** ([line 252](../../../apps/web/src/pages/bme.tsx#L252)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 252>** ([line 252](../../../apps/web/src/pages/bme.tsx#L252)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 273>** ([line 273](../../../apps/web/src/pages/bme.tsx#L273)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 273>** ([line 273](../../../apps/web/src/pages/bme.tsx#L273)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 430>** ([line 430](../../../apps/web/src/pages/bme.tsx#L430)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 430>** ([line 430](../../../apps/web/src/pages/bme.tsx#L430)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 436>** ([line 436](../../../apps/web/src/pages/bme.tsx#L436)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 436>** ([line 436](../../../apps/web/src/pages/bme.tsx#L436)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 446>** ([line 446](../../../apps/web/src/pages/bme.tsx#L446)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 446>** ([line 446](../../../apps/web/src/pages/bme.tsx#L446)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 457>** ([line 457](../../../apps/web/src/pages/bme.tsx#L457)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 457>** ([line 457](../../../apps/web/src/pages/bme.tsx#L457)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 542>** ([line 542](../../../apps/web/src/pages/bme.tsx#L542)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 542>** ([line 542](../../../apps/web/src/pages/bme.tsx#L542)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 558>** ([line 558](../../../apps/web/src/pages/bme.tsx#L558)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 558>** ([line 558](../../../apps/web/src/pages/bme.tsx#L558)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 725>** ([line 725](../../../apps/web/src/pages/bme.tsx#L725)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 725>** ([line 725](../../../apps/web/src/pages/bme.tsx#L725)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 731>** ([line 731](../../../apps/web/src/pages/bme.tsx#L731)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 731>** ([line 731](../../../apps/web/src/pages/bme.tsx#L731)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 752>** ([line 752](../../../apps/web/src/pages/bme.tsx#L752)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 752>** ([line 752](../../../apps/web/src/pages/bme.tsx#L752)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 774>** ([line 774](../../../apps/web/src/pages/bme.tsx#L774)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 774>** ([line 774](../../../apps/web/src/pages/bme.tsx#L774)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 845>** ([line 845](../../../apps/web/src/pages/bme.tsx#L845)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 845>** ([line 845](../../../apps/web/src/pages/bme.tsx#L845)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 856>** ([line 856](../../../apps/web/src/pages/bme.tsx#L856)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 856>** ([line 856](../../../apps/web/src/pages/bme.tsx#L856)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 245>** ([line 245](../../../apps/web/src/pages/bme.tsx#L245)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 349>** ([line 349](../../../apps/web/src/pages/bme.tsx#L349)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 834>** ([line 834](../../../apps/web/src/pages/bme.tsx#L834)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (20)

- [ ] `api.createBmeBreakdown` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBmeCalibration` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBmeContract` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBmeEquipment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBmePmSchedule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBmeVendorEvaluation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBmeWorkOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getBmeMtbfAnalytics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getBmeStats` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getBmeUptimeAnalytics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBmeBreakdowns` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBmeCalibrations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBmeContracts` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBmeEquipment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBmePmSchedules` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBmeVendorEvaluations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBmeWorkOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateBmeBreakdownStatus` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateBmeEquipment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateBmeWorkOrderStatus` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._