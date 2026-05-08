# `indent.tsx` walkthrough

_Source: [`apps/web/src/pages/indent.tsx`](../../../apps/web/src/pages/indent.tsx) (2353 lines). Guard: `P.INDENT.LIST`. API methods: 30. useForm: 0. Tables: 21. Modals: 10._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.INDENT.LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>My Indents** (`my-indents`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>My Indents** (`my-indents`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>My Indents** (`my-indents`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Pending Approval** (`pending-approval`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Pending Approval** (`pending-approval`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Pending Approval** (`pending-approval`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>All Indents** (`all-indents`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>All Indents** (`all-indents`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>All Indents** (`all-indents`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Flow Tracker** (`flow-tracker`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Flow Tracker** (`flow-tracker`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Flow Tracker** (`flow-tracker`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Store Catalog** (`catalog`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Store Catalog** (`catalog`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Store Catalog** (`catalog`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Stock** (`stock`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Stock** (`stock`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Stock** (`stock`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Analytics** (`analytics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Analytics** (`analytics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Analytics** (`analytics`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Patient Consumables** (`patient-consumables`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Patient Consumables** (`patient-consumables`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Patient Consumables** (`patient-consumables`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Assets &amp; Implants** (`assets-implants`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Assets &amp; Implants** (`assets-implants`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Assets &amp; Implants** (`assets-implants`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (74)
- [ ] Column **Indent #** (`indent_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`indent_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Amount** (`total_amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Created** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Unit** (`unit`) renders without `undefined` / `[object Object]`
- [ ] Column **Price** (`base_price`) renders without `undefined` / `[object Object]`
- [ ] Column **Stock** (`current_stock`) renders without `undefined` / `[object Object]`
- [ ] Column **Reorder Level** (`reorder_level`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`movement_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Qty** (`quantity`) renders without `undefined` / `[object Object]`
- [ ] Column **Reference** (`reference_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Notes** (`notes`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Item** (`item_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Total Issued** (`total_issued`) renders without `undefined` / `[object Object]`
- [ ] Column **Total Value** (`total_value`) renders without `undefined` / `[object Object]`
- [ ] Column **Item** (`item_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Annual Value** (`annual_value`) renders without `undefined` / `[object Object]`
- [ ] Column **Cumulative %** (`cumulative_pct`) renders without `undefined` / `[object Object]`
- [ ] Column **Class** (`abc_class`) renders without `undefined` / `[object Object]`
- [ ] Column **Item** (`item_name`) renders without `undefined` / `[object Object]`
- [ ] Column **VED Class** (`ved_class`) renders without `undefined` / `[object Object]`
- [ ] Column **Current Stock** (`current_stock`) renders without `undefined` / `[object Object]`
- [ ] Column **Reorder Level** (`reorder_level`) renders without `undefined` / `[object Object]`
- [ ] Column **Item** (`item_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Last Issue** (`last_issue_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Days Idle** (`days_since_last_issue`) renders without `undefined` / `[object Object]`
- [ ] Column **Class** (`fsn_class`) renders without `undefined` / `[object Object]`
- [ ] Column **Item** (`item_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Stock** (`current_stock`) renders without `undefined` / `[object Object]`
- [ ] Column **Value** (`stock_value`) renders without `undefined` / `[object Object]`
- [ ] Column **Last Movement** (`last_movement_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Days Idle** (`days_idle`) renders without `undefined` / `[object Object]`
- [ ] Column **Period** (`period`) renders without `undefined` / `[object Object]`
- [ ] Column **Purchased** (`total_purchased`) renders without `undefined` / `[object Object]`
- [ ] Column **Consumed** (`total_consumed`) renders without `undefined` / `[object Object]`
- [ ] Column **Net Change** (`net_change`) renders without `undefined` / `[object Object]`
- [ ] Column **Item** (`item_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Stock** (`current_stock`) renders without `undefined` / `[object Object]`
- [ ] Column **Avg Unit Cost** (`avg_unit_cost`) renders without `undefined` / `[object Object]`
- [ ] Column **Total Value** (`total_value`) renders without `undefined` / `[object Object]`
- [ ] Column **Check** (`check_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] _… 24 more columns — review remaining_

### `<Table>` @ line 319
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Requested** column shows correct value for at least one row
  - [ ] Header **Approved** column shows correct value for at least one row
  - [ ] Header **Issued** column shows correct value for at least one row
  - [ ] Header **Price** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 411
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Requested** column shows correct value for at least one row
  - [ ] Header **Approved** column shows correct value for at least one row
  - [ ] Header **Issued** column shows correct value for at least one row
  - [ ] Header **Price** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 668
  - [ ] Header **Indent #** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Requested** column shows correct value for at least one row
  - [ ] Header **Approved** column shows correct value for at least one row
  - [ ] Header **Issued** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 746
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Requested** column shows correct value for at least one row
  - [ ] Header **Approved** column shows correct value for at least one row
  - [ ] Header **Issued** column shows correct value for at least one row
  - [ ] Header **Event** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Action** column shows correct value for at least one row
  - [ ] Header **PO #** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Amount** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 794
  - [ ] Header **Event** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Action** column shows correct value for at least one row
  - [ ] Header **PO #** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Amount** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 850
  - [ ] Header **PO #** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Amount** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 976
  - [ ] Header **Item Name** column shows correct value for at least one row
  - [ ] Header **Catalog Item** column shows correct value for at least one row
  - [ ] Header **Qty** column shows correct value for at least one row
  - [ ] Header **Unit Price** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Drawer — _Indent Details_ @ [line 330](../../../apps/web/src/pages/indent.tsx#L330)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Approve Indent Items_ @ [line 519](../../../apps/web/src/pages/indent.tsx#L519)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Issue Indent Items_ @ [line 582](../../../apps/web/src/pages/indent.tsx#L582)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Catalog Item_ @ [line 1119](../../../apps/web/src/pages/indent.tsx#L1119)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Edit Catalog Item_ @ [line 1128](../../../apps/web/src/pages/indent.tsx#L1128)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Stock Movement_ @ [line 1257](../../../apps/web/src/pages/indent.tsx#L1257)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Issue to Patient_ @ [line 1816](../../../apps/web/src/pages/indent.tsx#L1816)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Register Implant_ @ [line 1970](../../../apps/web/src/pages/indent.tsx#L1970)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Initiate Condemnation_ @ [line 2168](../../../apps/web/src/pages/indent.tsx#L2168)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Update Condemnation Status_ @ [line 2176](../../../apps/web/src/pages/indent.tsx#L2176)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (47)

- [ ] **<NumberInput @ line 524>** (`NumberInput`, [line 524](../../../apps/web/src/pages/indent.tsx#L524)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 589>** (`NumberInput`, [line 589](../../../apps/web/src/pages/indent.tsx#L589)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 627>** (`TextInput`, [line 627](../../../apps/web/src/pages/indent.tsx#L627)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`Select`, [line 946](../../../apps/web/src/pages/indent.tsx#L946)) — accepts input, default value sensible, persists after refresh
- [ ] **Indent Type** (`Select`, [line 955](../../../apps/web/src/pages/indent.tsx#L955)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 961](../../../apps/web/src/pages/indent.tsx#L961)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 973](../../../apps/web/src/pages/indent.tsx#L973)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 990>** (`TextInput`, [line 990](../../../apps/web/src/pages/indent.tsx#L990)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 999>** (`Select`, [line 999](../../../apps/web/src/pages/indent.tsx#L999)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 1017>** (`NumberInput`, [line 1017](../../../apps/web/src/pages/indent.tsx#L1017)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 1026>** (`NumberInput`, [line 1026](../../../apps/web/src/pages/indent.tsx#L1026)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 1190](../../../apps/web/src/pages/indent.tsx#L1190)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 1191](../../../apps/web/src/pages/indent.tsx#L1191)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`TextInput`, [line 1192](../../../apps/web/src/pages/indent.tsx#L1192)) — accepts input, default value sensible, persists after refresh
- [ ] **Unit** (`TextInput`, [line 1193](../../../apps/web/src/pages/indent.tsx#L1193)) — accepts input, default value sensible, persists after refresh
- [ ] **Base Price** (`NumberInput`, [line 1194](../../../apps/web/src/pages/indent.tsx#L1194)) — accepts input, default value sensible, persists after refresh
- [ ] **Reorder Level** (`NumberInput`, [line 1195](../../../apps/web/src/pages/indent.tsx#L1195)) — accepts input, default value sensible, persists after refresh
- [ ] **Catalog Item** (`Select`, [line 1300](../../../apps/web/src/pages/indent.tsx#L1300)) — accepts input, default value sensible, persists after refresh
- [ ] **Movement Type** (`Select`, [line 1309](../../../apps/web/src/pages/indent.tsx#L1309)) — accepts input, default value sensible, persists after refresh
- [ ] **Quantity** (`NumberInput`, [line 1321](../../../apps/web/src/pages/indent.tsx#L1321)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1322](../../../apps/web/src/pages/indent.tsx#L1322)) — accepts input, default value sensible, persists after refresh
- [ ] **From Date** (`TextInput`, [line 1399](../../../apps/web/src/pages/indent.tsx#L1399)) — accepts input, default value sensible, persists after refresh
- [ ] **To Date** (`TextInput`, [line 1406](../../../apps/web/src/pages/indent.tsx#L1406)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`Select`, [line 1413](../../../apps/web/src/pages/indent.tsx#L1413)) — accepts input, default value sensible, persists after refresh
- [ ] **Period (days)** (`Select`, [line 1570](../../../apps/web/src/pages/indent.tsx#L1570)) — accepts input, default value sensible, persists after refresh
- [ ] **Idle threshold (days)** (`Select`, [line 1622](../../../apps/web/src/pages/indent.tsx#L1622)) — accepts input, default value sensible, persists after refresh
- [ ] **Catalog Item** (`Select`, [line 1863](../../../apps/web/src/pages/indent.tsx#L1863)) — accepts input, default value sensible, persists after refresh
- [ ] **Quantity** (`NumberInput`, [line 1872](../../../apps/web/src/pages/indent.tsx#L1872)) — accepts input, default value sensible, persists after refresh
- [ ] **Chargeable to patient** (`Switch`, [line 1879](../../../apps/web/src/pages/indent.tsx#L1879)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1884](../../../apps/web/src/pages/indent.tsx#L1884)) — accepts input, default value sensible, persists after refresh
- [ ] **Catalog Item** (`Select`, [line 2026](../../../apps/web/src/pages/indent.tsx#L2026)) — accepts input, default value sensible, persists after refresh
- [ ] **Serial Number** (`TextInput`, [line 2036](../../../apps/web/src/pages/indent.tsx#L2036)) — accepts input, default value sensible, persists after refresh
- [ ] **Implant Date** (`TextInput`, [line 2041](../../../apps/web/src/pages/indent.tsx#L2041)) — accepts input, default value sensible, persists after refresh
- [ ] **Implant Site** (`TextInput`, [line 2048](../../../apps/web/src/pages/indent.tsx#L2048)) — accepts input, default value sensible, persists after refresh
- [ ] **Surgeon ID** (`TextInput`, [line 2053](../../../apps/web/src/pages/indent.tsx#L2053)) — accepts input, default value sensible, persists after refresh
- [ ] **Manufacturer** (`TextInput`, [line 2059](../../../apps/web/src/pages/indent.tsx#L2059)) — accepts input, default value sensible, persists after refresh
- [ ] **Model Number** (`TextInput`, [line 2064](../../../apps/web/src/pages/indent.tsx#L2064)) — accepts input, default value sensible, persists after refresh
- [ ] **Warranty Expiry** (`TextInput`, [line 2069](../../../apps/web/src/pages/indent.tsx#L2069)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 2075](../../../apps/web/src/pages/indent.tsx#L2075)) — accepts input, default value sensible, persists after refresh
- [ ] **Catalog Item** (`Select`, [line 2225](../../../apps/web/src/pages/indent.tsx#L2225)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason for Condemnation** (`Textarea`, [line 2234](../../../apps/web/src/pages/indent.tsx#L2234)) — accepts input, default value sensible, persists after refresh
- [ ] **Current Value** (`NumberInput`, [line 2241](../../../apps/web/src/pages/indent.tsx#L2241)) — accepts input, default value sensible, persists after refresh
- [ ] **Purchase Value** (`NumberInput`, [line 2249](../../../apps/web/src/pages/indent.tsx#L2249)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 2257](../../../apps/web/src/pages/indent.tsx#L2257)) — accepts input, default value sensible, persists after refresh
- [ ] **New Status** (`Select`, [line 2317](../../../apps/web/src/pages/indent.tsx#L2317)) — accepts input, default value sensible, persists after refresh
- [ ] **Committee Remarks** (`Textarea`, [line 2324](../../../apps/web/src/pages/indent.tsx#L2324)) — accepts input, default value sensible, persists after refresh
- [ ] **Disposal Method** (`Select`, [line 2330](../../../apps/web/src/pages/indent.tsx#L2330)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 22, `<ActionIcon>`: 5, `<Menu.Item>`: 0)

- [ ] **<button @ line 171>** ([line 171](../../../apps/web/src/pages/indent.tsx#L171)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 171>** ([line 171](../../../apps/web/src/pages/indent.tsx#L171)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 439>** ([line 439](../../../apps/web/src/pages/indent.tsx#L439)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 439>** ([line 439](../../../apps/web/src/pages/indent.tsx#L439)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 446>** ([line 446](../../../apps/web/src/pages/indent.tsx#L446)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 446>** ([line 446](../../../apps/web/src/pages/indent.tsx#L446)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 461>** ([line 461](../../../apps/web/src/pages/indent.tsx#L461)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 461>** ([line 461](../../../apps/web/src/pages/indent.tsx#L461)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 516>** ([line 516](../../../apps/web/src/pages/indent.tsx#L516)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 516>** ([line 516](../../../apps/web/src/pages/indent.tsx#L516)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **mutation.mutate()}>             Confirm Approval** ([line 535](../../../apps/web/src/pages/indent.tsx#L535)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **mutation.mutate()}>             Confirm Approval** ([line 535](../../../apps/web/src/pages/indent.tsx#L535)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 579>** ([line 579](../../../apps/web/src/pages/indent.tsx#L579)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 579>** ([line 579](../../../apps/web/src/pages/indent.tsx#L579)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **mutation.mutate()}>             Confirm Issue** ([line 601](../../../apps/web/src/pages/indent.tsx#L601)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **mutation.mutate()}>             Confirm Issue** ([line 601](../../../apps/web/src/pages/indent.tsx#L601)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1045>** ([line 1045](../../../apps/web/src/pages/indent.tsx#L1045)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1045>** ([line 1045](../../../apps/web/src/pages/indent.tsx#L1045)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 1050](../../../apps/web/src/pages/indent.tsx#L1050)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 1050](../../../apps/web/src/pages/indent.tsx#L1050)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 1057](../../../apps/web/src/pages/indent.tsx#L1057)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 1057](../../../apps/web/src/pages/indent.tsx#L1057)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1108>** ([line 1108](../../../apps/web/src/pages/indent.tsx#L1108)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1108>** ([line 1108](../../../apps/web/src/pages/indent.tsx#L1108)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1196>** ([line 1196](../../../apps/web/src/pages/indent.tsx#L1196)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1196>** ([line 1196](../../../apps/web/src/pages/indent.tsx#L1196)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1243>** ([line 1243](../../../apps/web/src/pages/indent.tsx#L1243)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1243>** ([line 1243](../../../apps/web/src/pages/indent.tsx#L1243)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1323>** ([line 1323](../../../apps/web/src/pages/indent.tsx#L1323)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1323>** ([line 1323](../../../apps/web/src/pages/indent.tsx#L1323)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1804>** ([line 1804](../../../apps/web/src/pages/indent.tsx#L1804)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1804>** ([line 1804](../../../apps/web/src/pages/indent.tsx#L1804)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1889>** ([line 1889](../../../apps/web/src/pages/indent.tsx#L1889)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1889>** ([line 1889](../../../apps/web/src/pages/indent.tsx#L1889)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1958>** ([line 1958](../../../apps/web/src/pages/indent.tsx#L1958)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1958>** ([line 1958](../../../apps/web/src/pages/indent.tsx#L1958)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2080>** ([line 2080](../../../apps/web/src/pages/indent.tsx#L2080)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2080>** ([line 2080](../../../apps/web/src/pages/indent.tsx#L2080)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2156>** ([line 2156](../../../apps/web/src/pages/indent.tsx#L2156)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2156>** ([line 2156](../../../apps/web/src/pages/indent.tsx#L2156)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2262>** ([line 2262](../../../apps/web/src/pages/indent.tsx#L2262)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2262>** ([line 2262](../../../apps/web/src/pages/indent.tsx#L2262)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2343>** ([line 2343](../../../apps/web/src/pages/indent.tsx#L2343)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2343>** ([line 2343](../../../apps/web/src/pages/indent.tsx#L2343)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 302>** ([line 302](../../../apps/web/src/pages/indent.tsx#L302)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **View details** ([line 686](../../../apps/web/src/pages/indent.tsx#L686)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1036>** ([line 1036](../../../apps/web/src/pages/indent.tsx#L1036)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1098>** ([line 1098](../../../apps/web/src/pages/indent.tsx#L1098)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2138>** ([line 2138](../../../apps/web/src/pages/indent.tsx#L2138)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (30)

- [ ] `api.approveIndentRequisition` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.cancelIndentRequisition` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCondemnation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createImplantEntry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createIndentRequisition` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createStoreCatalogItem` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createStoreStockMovement` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAbcAnalysis` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getComplianceReport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getConsumptionAnalysis` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getDeadStockReport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getFsnAnalysis` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getIndentRequisition` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getInventoryValuation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPurchaseConsumptionTrend` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getVedAnalysis` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.issueIndentRequisition` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.issueToPatient` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCondemnations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDepartments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listImplantRegistry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIndentRequisitions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatientConsumables` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPurchaseOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listStoreCatalog` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listStoreStockMovements` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.rejectIndentRequisition` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.submitIndentRequisition` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateCondemnationStatus` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateStoreCatalogItem` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._