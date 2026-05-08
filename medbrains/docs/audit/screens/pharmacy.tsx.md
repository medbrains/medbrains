# `pharmacy.tsx` walkthrough

_Source: [`apps/web/src/pages/pharmacy.tsx`](../../../apps/web/src/pages/pharmacy.tsx) (3133 lines). Guard: `P.PHARMACY.PRESCRIPTIONS_LIST`. API methods: 33. useForm: 0. Tables: 19. Modals: 7._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.PHARMACY.PRESCRIPTIONS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Returns** (`credit-notes`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Returns** (`credit-notes`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Returns** (`credit-notes`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Store Requests** (`store-requests`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Store Requests** (`store-requests`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Store Requests** (`store-requests`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (75)
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`dispensing_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Generic** (`generic_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Price** (`base_price`) renders without `undefined` / `[object Object]`
- [ ] Column **Stock** (`current_stock`) renders without `undefined` / `[object Object]`
- [ ] Column **Regulatory** (`regulatory`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Drug Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Current Stock** (`current_stock`) renders without `undefined` / `[object Object]`
- [ ] Column **Reorder Level** (`reorder_level`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Action** (`action`) renders without `undefined` / `[object Object]`
- [ ] Column **Qty** (`quantity`) renders without `undefined` / `[object Object]`
- [ ] Column **Balance** (`balance_after`) renders without `undefined` / `[object Object]`
- [ ] Column **By** (`dispensed_by`) renders without `undefined` / `[object Object]`
- [ ] Column **Witness** (`witnessed_by`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Batch #** (`batch_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Expiry** (`expiry_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Received** (`quantity_received`) renders without `undefined` / `[object Object]`
- [ ] Column **Dispensed** (`quantity_dispensed`) renders without `undefined` / `[object Object]`
- [ ] Column **On Hand** (`quantity_on_hand`) renders without `undefined` / `[object Object]`
- [ ] Column **Location** (`store_location_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Drug** (`drug_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Batch #** (`batch_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Expiry** (`expiry_date`) renders without `undefined` / `[object Object]`
- [ ] Column **On Hand** (`quantity_on_hand`) renders without `undefined` / `[object Object]`
- [ ] Column **Days Left** (`days_until_expiry`) renders without `undefined` / `[object Object]`
- [ ] Column **Drug** (`drug_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Stock** (`current_stock`) renders without `undefined` / `[object Object]`
- [ ] Column **Value** (`stock_value`) renders without `undefined` / `[object Object]`
- [ ] Column **Last Dispensed** (`last_dispensed_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Days Idle** (`days_idle`) renders without `undefined` / `[object Object]`
- [ ] Column **Location** (`store_location_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Central** (`is_central`) renders without `undefined` / `[object Object]`
- [ ] Column **Departments** (`serves_departments`) renders without `undefined` / `[object Object]`
- [ ] Column **Created** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **From** (`from_location_id`) renders without `undefined` / `[object Object]`
- [ ] Column **To** (`to_location_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Drug** (`drug_name`) renders without `undefined` / `[object Object]`
- [ ] _… 25 more columns — review remaining_

### `<Table>` @ line 820
  - [ ] Header **Drug** column shows correct value for at least one row
  - [ ] Header **Batch** column shows correct value for at least one row
  - [ ] Header **Expiry** column shows correct value for at least one row
  - [ ] Header **Qty** column shows correct value for at least one row
  - [ ] Header **Unit Price** column shows correct value for at least one row
  - [ ] Header **Total** column shows correct value for at least one row
  - [ ] Header **Returned** column shows correct value for at least one row
  - [ ] Header **Action** column shows correct value for at least one row
  - [ ] Header **Field** column shows correct value for at least one row
  - [ ] Header **Old Value** column shows correct value for at least one row
  - [ ] Header **New Value** column shows correct value for at least one row
  - [ ] Header **Changed By** column shows correct value for at least one row
  - [ ] Header **Time** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 924
  - [ ] Header **Action** column shows correct value for at least one row
  - [ ] Header **Field** column shows correct value for at least one row
  - [ ] Header **Old Value** column shows correct value for at least one row
  - [ ] Header **New Value** column shows correct value for at least one row
  - [ ] Header **Changed By** column shows correct value for at least one row
  - [ ] Header **Time** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2734
  - [ ] Header **#** column shows correct value for at least one row
  - [ ] Header **Drug** column shows correct value for at least one row
  - [ ] Header **Dosage** column shows correct value for at least one row
  - [ ] Header **Frequency** column shows correct value for at least one row
  - [ ] Header **Duration** column shows correct value for at least one row
  - [ ] Header **Route** column shows correct value for at least one row
  - [ ] Header **Instructions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

_… 9 more tables — list capped to keep checklist usable_
## Modals / Drawers

### Modal — _Drug Interaction Check_ @ [line 987](../../../apps/web/src/pages/pharmacy.tsx#L987)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Formulary Check_ @ [line 1053](../../../apps/web/src/pages/pharmacy.tsx#L1053)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 2550>_ @ [line 2550](../../../apps/web/src/pages/pharmacy.tsx#L2550)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _Order Detail_ @ [line 482](../../../apps/web/src/pages/pharmacy.tsx#L482)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _OTC Walk-in Sale_ @ [line 519](../../../apps/web/src/pages/pharmacy.tsx#L519)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Pharmacy Order_ @ [line 636](../../../apps/web/src/pages/pharmacy.tsx#L636)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 2532>_ @ [line 2532](../../../apps/web/src/pages/pharmacy.tsx#L2532)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (40)

- [ ] **<Select @ line 439>** (`Select`, [line 439](../../../apps/web/src/pages/pharmacy.tsx#L439)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 521](../../../apps/web/src/pages/pharmacy.tsx#L521)) — accepts input, default value sensible, persists after refresh
- [ ] **Qty** (`NumberInput`, [line 548](../../../apps/web/src/pages/pharmacy.tsx#L548)) — accepts input, default value sensible, persists after refresh
- [ ] **Price** (`NumberInput`, [line 558](../../../apps/web/src/pages/pharmacy.tsx#L558)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 645](../../../apps/web/src/pages/pharmacy.tsx#L645)) — accepts input, default value sensible, persists after refresh
- [ ] **Medication safety override reason** (`Textarea`, [line 647](../../../apps/web/src/pages/pharmacy.tsx#L647)) — accepts input, default value sensible, persists after refresh
- [ ] **Qty** (`NumberInput`, [line 680](../../../apps/web/src/pages/pharmacy.tsx#L680)) — accepts input, default value sensible, persists after refresh
- [ ] **Unit Price** (`NumberInput`, [line 690](../../../apps/web/src/pages/pharmacy.tsx#L690)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1258>** (`Select`, [line 1258](../../../apps/web/src/pages/pharmacy.tsx#L1258)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 1274](../../../apps/web/src/pages/pharmacy.tsx#L1274)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 1279](../../../apps/web/src/pages/pharmacy.tsx#L1279)) — accepts input, default value sensible, persists after refresh
- [ ] **Generic Name** (`TextInput`, [line 1286](../../../apps/web/src/pages/pharmacy.tsx#L1286)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 1292](../../../apps/web/src/pages/pharmacy.tsx#L1292)) — accepts input, default value sensible, persists after refresh
- [ ] **Manufacturer** (`TextInput`, [line 1301](../../../apps/web/src/pages/pharmacy.tsx#L1301)) — accepts input, default value sensible, persists after refresh
- [ ] **Unit** (`TextInput`, [line 1307](../../../apps/web/src/pages/pharmacy.tsx#L1307)) — accepts input, default value sensible, persists after refresh
- [ ] **Base Price** (`NumberInput`, [line 1313](../../../apps/web/src/pages/pharmacy.tsx#L1313)) — accepts input, default value sensible, persists after refresh
- [ ] **Tax %** (`NumberInput`, [line 1320](../../../apps/web/src/pages/pharmacy.tsx#L1320)) — accepts input, default value sensible, persists after refresh
- [ ] **Reorder Level** (`NumberInput`, [line 1327](../../../apps/web/src/pages/pharmacy.tsx#L1327)) — accepts input, default value sensible, persists after refresh
- [ ] **Drug Schedule** (`Select`, [line 1337](../../../apps/web/src/pages/pharmacy.tsx#L1337)) — accepts input, default value sensible, persists after refresh
- [ ] **Formulary Status** (`Select`, [line 1354](../../../apps/web/src/pages/pharmacy.tsx#L1354)) — accepts input, default value sensible, persists after refresh
- [ ] **AWaRe Category** (`Select`, [line 1368](../../../apps/web/src/pages/pharmacy.tsx#L1368)) — accepts input, default value sensible, persists after refresh
- [ ] **INN Name** (`TextInput`, [line 1385](../../../apps/web/src/pages/pharmacy.tsx#L1385)) — accepts input, default value sensible, persists after refresh
- [ ] **ATC Code** (`TextInput`, [line 1390](../../../apps/web/src/pages/pharmacy.tsx#L1390)) — accepts input, default value sensible, persists after refresh
- [ ] **Controlled Substance** (`Switch`, [line 1396](../../../apps/web/src/pages/pharmacy.tsx#L1396)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 1516](../../../apps/web/src/pages/pharmacy.tsx#L1516)) — accepts input, default value sensible, persists after refresh
- [ ] **Quantity** (`NumberInput`, [line 1529](../../../apps/web/src/pages/pharmacy.tsx#L1529)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`TextInput`, [line 1536](../../../apps/web/src/pages/pharmacy.tsx#L1536)) — accepts input, default value sensible, persists after refresh
- [ ] **Action** (`Select`, [line 1679](../../../apps/web/src/pages/pharmacy.tsx#L1679)) — accepts input, default value sensible, persists after refresh
- [ ] **Quantity** (`NumberInput`, [line 1690](../../../apps/web/src/pages/pharmacy.tsx#L1690)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`TextInput`, [line 1697](../../../apps/web/src/pages/pharmacy.tsx#L1697)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 2514>** (`Select`, [line 2514](../../../apps/web/src/pages/pharmacy.tsx#L2514)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 2557](../../../apps/web/src/pages/pharmacy.tsx#L2557)) — accepts input, default value sensible, persists after refresh
- [ ] **Rejection Reason** (`Textarea`, [line 2563](../../../apps/web/src/pages/pharmacy.tsx#L2563)) — accepts input, default value sensible, persists after refresh
- [ ] **Customer** (`TextInput`, [line 2978](../../../apps/web/src/pages/pharmacy.tsx#L2978)) — accepts input, default value sensible, persists after refresh
- [ ] **Phone** (`TextInput`, [line 2985](../../../apps/web/src/pages/pharmacy.tsx#L2985)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 3012>** (`NumberInput`, [line 3012](../../../apps/web/src/pages/pharmacy.tsx#L3012)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 3021>** (`NumberInput`, [line 3021](../../../apps/web/src/pages/pharmacy.tsx#L3021)) — accepts input, default value sensible, persists after refresh
- [ ] **Discount %** (`NumberInput`, [line 3056](../../../apps/web/src/pages/pharmacy.tsx#L3056)) — accepts input, default value sensible, persists after refresh
- [ ] **Payment** (`Select`, [line 3065](../../../apps/web/src/pages/pharmacy.tsx#L3065)) — accepts input, default value sensible, persists after refresh
- [ ] **Received** (`NumberInput`, [line 3078](../../../apps/web/src/pages/pharmacy.tsx#L3078)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 26, `<ActionIcon>`: 9, `<Menu.Item>`: 0)

- [ ] **<button @ line 202>** ([line 202](../../../apps/web/src/pages/pharmacy.tsx#L202)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 202>** ([line 202](../../../apps/web/src/pages/pharmacy.tsx#L202)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 211>** ([line 211](../../../apps/web/src/pages/pharmacy.tsx#L211)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 211>** ([line 211](../../../apps/web/src/pages/pharmacy.tsx#L211)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 454>** ([line 454](../../../apps/web/src/pages/pharmacy.tsx#L454)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 454>** ([line 454](../../../apps/web/src/pages/pharmacy.tsx#L454)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 457>** ([line 457](../../../apps/web/src/pages/pharmacy.tsx#L457)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 457>** ([line 457](../../../apps/web/src/pages/pharmacy.tsx#L457)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 575>** ([line 575](../../../apps/web/src/pages/pharmacy.tsx#L575)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 575>** ([line 575](../../../apps/web/src/pages/pharmacy.tsx#L575)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 583>** ([line 583](../../../apps/web/src/pages/pharmacy.tsx#L583)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 583>** ([line 583](../../../apps/web/src/pages/pharmacy.tsx#L583)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 712>** ([line 712](../../../apps/web/src/pages/pharmacy.tsx#L712)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 712>** ([line 712](../../../apps/web/src/pages/pharmacy.tsx#L712)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 725>** ([line 725](../../../apps/web/src/pages/pharmacy.tsx#L725)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 725>** ([line 725](../../../apps/web/src/pages/pharmacy.tsx#L725)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 735>** ([line 735](../../../apps/web/src/pages/pharmacy.tsx#L735)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 735>** ([line 735](../../../apps/web/src/pages/pharmacy.tsx#L735)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 866>** ([line 866](../../../apps/web/src/pages/pharmacy.tsx#L866)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 866>** ([line 866](../../../apps/web/src/pages/pharmacy.tsx#L866)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 875>** ([line 875](../../../apps/web/src/pages/pharmacy.tsx#L875)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 875>** ([line 875](../../../apps/web/src/pages/pharmacy.tsx#L875)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 997>** ([line 997](../../../apps/web/src/pages/pharmacy.tsx#L997)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 997>** ([line 997](../../../apps/web/src/pages/pharmacy.tsx#L997)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1056>** ([line 1056](../../../apps/web/src/pages/pharmacy.tsx#L1056)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1056>** ([line 1056](../../../apps/web/src/pages/pharmacy.tsx#L1056)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1250>** ([line 1250](../../../apps/web/src/pages/pharmacy.tsx#L1250)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1250>** ([line 1250](../../../apps/web/src/pages/pharmacy.tsx#L1250)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1403>** ([line 1403](../../../apps/web/src/pages/pharmacy.tsx#L1403)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1403>** ([line 1403](../../../apps/web/src/pages/pharmacy.tsx#L1403)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1499>** ([line 1499](../../../apps/web/src/pages/pharmacy.tsx#L1499)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1499>** ([line 1499](../../../apps/web/src/pages/pharmacy.tsx#L1499)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1540>** ([line 1540](../../../apps/web/src/pages/pharmacy.tsx#L1540)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1540>** ([line 1540](../../../apps/web/src/pages/pharmacy.tsx#L1540)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1662>** ([line 1662](../../../apps/web/src/pages/pharmacy.tsx#L1662)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1662>** ([line 1662](../../../apps/web/src/pages/pharmacy.tsx#L1662)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1701>** ([line 1701](../../../apps/web/src/pages/pharmacy.tsx#L1701)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1701>** ([line 1701](../../../apps/web/src/pages/pharmacy.tsx#L1701)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 2571](../../../apps/web/src/pages/pharmacy.tsx#L2571)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 2571](../../../apps/web/src/pages/pharmacy.tsx#L2571)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2574>** ([line 2574](../../../apps/web/src/pages/pharmacy.tsx#L2574)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2574>** ([line 2574](../../../apps/web/src/pages/pharmacy.tsx#L2574)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2696>** ([line 2696](../../../apps/web/src/pages/pharmacy.tsx#L2696)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2696>** ([line 2696](../../../apps/web/src/pages/pharmacy.tsx#L2696)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2704>** ([line 2704](../../../apps/web/src/pages/pharmacy.tsx#L2704)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2704>** ([line 2704](../../../apps/web/src/pages/pharmacy.tsx#L2704)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2713>** ([line 2713](../../../apps/web/src/pages/pharmacy.tsx#L2713)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2713>** ([line 2713](../../../apps/web/src/pages/pharmacy.tsx#L2713)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **}>               Create Dispense Order** ([line 2725](../../../apps/web/src/pages/pharmacy.tsx#L2725)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **}>               Create Dispense Order** ([line 2725](../../../apps/web/src/pages/pharmacy.tsx#L2725)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3105>** ([line 3105](../../../apps/web/src/pages/pharmacy.tsx#L3105)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3105>** ([line 3105](../../../apps/web/src/pages/pharmacy.tsx#L3105)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 399>** ([line 399](../../../apps/web/src/pages/pharmacy.tsx#L399)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 412>** ([line 412](../../../apps/web/src/pages/pharmacy.tsx#L412)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 421>** ([line 421](../../../apps/web/src/pages/pharmacy.tsx#L421)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2123>** ([line 2123](../../../apps/web/src/pages/pharmacy.tsx#L2123)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2457>** ([line 2457](../../../apps/web/src/pages/pharmacy.tsx#L2457)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2471>** ([line 2471](../../../apps/web/src/pages/pharmacy.tsx#L2471)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2482>** ([line 2482](../../../apps/web/src/pages/pharmacy.tsx#L2482)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2493>** ([line 2493](../../../apps/web/src/pages/pharmacy.tsx#L2493)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 3038>** ([line 3038](../../../apps/web/src/pages/pharmacy.tsx#L3038)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (33)

- [ ] `api.approvePharmacyTransfer` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.cancelPharmacyOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.checkDrugInteractions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createNdpsEntry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createOtcSale` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPharmacyCatalog` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPharmacyOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPosSale` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createStockTransaction` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.dispenseOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.formularyCheck` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getDrugUtilization` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getNdpsBalance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getNearExpiryReport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPharmacyAbcVed` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPharmacyConsumption` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPharmacyDeadStock` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPharmacyOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPosDaySummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPrescription` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getRxDetail` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getTenantSettings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listNdpsEntries` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPharmacyBatches` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPharmacyCatalog` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPharmacyOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPharmacyStoreAssignments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPharmacyTransfers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPosSales` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRxQueue` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listStock` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.prescriptionAudit` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.reviewPrescription` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._