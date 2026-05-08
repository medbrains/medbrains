# `housekeeping.tsx` walkthrough

_Source: [`apps/web/src/pages/housekeeping.tsx`](../../../apps/web/src/pages/housekeeping.tsx) (2125 lines). Guard: `P.HOUSEKEEPING.CLEANING_LIST`. API methods: 27. useForm: 0. Tables: 12. Modals: 11._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.HOUSEKEEPING.CLEANING_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Room & Bed** (`room-bed`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Room & Bed** (`room-bed`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Room & Bed** (`room-bed`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Cleaning Schedules** (`schedules`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Cleaning Schedules** (`schedules`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Cleaning Schedules** (`schedules`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Linen & Laundry** (`linen`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Linen & Laundry** (`linen`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Linen & Laundry** (`linen`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Par Levels & Audit** (`par-audit`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Par Levels & Audit** (`par-audit`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Par Levels & Audit** (`par-audit`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              BMW** (`bmw`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              BMW** (`bmw`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              BMW** (`bmw`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (58)
- [ ] Column **Discharged** (`discharge_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Cleaned By** (`cleaned_by`) renders without `undefined` / `[object Object]`
- [ ] Column **TAT (min)** (`turnaround_minutes`) renders without `undefined` / `[object Object]`
- [ ] Column **Ready At** (`ready_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`task_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Area** (`area_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Assigned To** (`assigned_to`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Area** (`area_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Frequency** (`frequency_hours`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Notes** (`notes`) renders without `undefined` / `[object Object]`
- [ ] Column **Pest Type** (`pest_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Frequency** (`frequency_months`) renders without `undefined` / `[object Object]`
- [ ] Column **Last Done** (`last_done`) renders without `undefined` / `[object Object]`
- [ ] Column **Next Due** (`next_due`) renders without `undefined` / `[object Object]`
- [ ] Column **Vendor** (`vendor_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`treatment_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`treatment_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Chemicals** (`chemicals_used`) renders without `undefined` / `[object Object]`
- [ ] Column **Certificate** (`certificate_no`) renders without `undefined` / `[object Object]`
- [ ] Column **Vendor** (`vendor_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Barcode** (`barcode`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`item_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`current_status`) renders without `undefined` / `[object Object]`
- [ ] Column **Washes** (`wash_count`) renders without `undefined` / `[object Object]`
- [ ] Column **Commissioned** (`commissioned_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`movement_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`movement_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Qty** (`quantity`) renders without `undefined` / `[object Object]`
- [ ] Column **Weight (kg)** (`weight_kg`) renders without `undefined` / `[object Object]`
- [ ] Column **Contamination** (`contamination_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Recorded By** (`recorded_by`) renders without `undefined` / `[object Object]`
- [ ] Column **Batch #** (`batch_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Items** (`items_count`) renders without `undefined` / `[object Object]`
- [ ] Column **Weight (kg)** (`total_weight`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`contamination_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Item Type** (`item_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Par Level** (`par_level`) renders without `undefined` / `[object Object]`
- [ ] Column **Current Stock** (`current_stock`) renders without `undefined` / `[object Object]`
- [ ] Column **Reorder Level** (`reorder_level`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`condemned_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Reason** (`reason`) renders without `undefined` / `[object Object]`
- [ ] Column **Wash Count** (`wash_count_at_condemn`) renders without `undefined` / `[object Object]`
- [ ] Column **Replacement** (`replacement_requested`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`waste_category`) renders without `undefined` / `[object Object]`
- [ ] Column **Weight (kg)** (`weight_kg`) renders without `undefined` / `[object Object]`
- [ ] Column **Containers** (`container_count`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`record_date`) renders without `undefined` / `[object Object]`
- [ ] _… 8 more columns — review remaining_

## Modals / Drawers

### Modal — _Replace Sharp Container_ @ [line 1959](../../../apps/web/src/pages/housekeeping.tsx#L1959)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _New Cleaning Task_ @ [line 554](../../../apps/web/src/pages/housekeeping.tsx#L554)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Turnaround_ @ [line 585](../../../apps/web/src/pages/housekeeping.tsx#L585)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Cleaning Schedule_ @ [line 822](../../../apps/web/src/pages/housekeeping.tsx#L822)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Pest Control Schedule_ @ [line 853](../../../apps/web/src/pages/housekeeping.tsx#L853)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Pest Control Treatment_ @ [line 890](../../../apps/web/src/pages/housekeeping.tsx#L890)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Linen Item_ @ [line 1269](../../../apps/web/src/pages/housekeeping.tsx#L1269)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Linen Movement_ @ [line 1311](../../../apps/web/src/pages/housekeeping.tsx#L1311)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Laundry Batch_ @ [line 1361](../../../apps/web/src/pages/housekeeping.tsx#L1361)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Set Par Level_ @ [line 1544](../../../apps/web/src/pages/housekeeping.tsx#L1544)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _BMW Transport Manifest_ @ [line 2011](../../../apps/web/src/pages/housekeeping.tsx#L2011)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (54)

- [ ] **Area Type** (`Select`, [line 562](../../../apps/web/src/pages/housekeeping.tsx#L562)) — accepts input, default value sensible, persists after refresh
- [ ] **Assigned To** (`TextInput`, [line 568](../../../apps/web/src/pages/housekeeping.tsx#L568)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 573](../../../apps/web/src/pages/housekeeping.tsx#L573)) — accepts input, default value sensible, persists after refresh
- [ ] **Cleaned By** (`TextInput`, [line 593](../../../apps/web/src/pages/housekeeping.tsx#L593)) — accepts input, default value sensible, persists after refresh
- [ ] **Area Type** (`Select`, [line 830](../../../apps/web/src/pages/housekeeping.tsx#L830)) — accepts input, default value sensible, persists after refresh
- [ ] **Frequency (hours)** (`NumberInput`, [line 836](../../../apps/web/src/pages/housekeeping.tsx#L836)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 842](../../../apps/web/src/pages/housekeeping.tsx#L842)) — accepts input, default value sensible, persists after refresh
- [ ] **Pest Type** (`Select`, [line 861](../../../apps/web/src/pages/housekeeping.tsx#L861)) — accepts input, default value sensible, persists after refresh
- [ ] **Frequency (months)** (`NumberInput`, [line 868](../../../apps/web/src/pages/housekeeping.tsx#L868)) — accepts input, default value sensible, persists after refresh
- [ ] **Vendor Name** (`TextInput`, [line 874](../../../apps/web/src/pages/housekeeping.tsx#L874)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 879](../../../apps/web/src/pages/housekeeping.tsx#L879)) — accepts input, default value sensible, persists after refresh
- [ ] **Treatment Date** (`TextInput`, [line 898](../../../apps/web/src/pages/housekeeping.tsx#L898)) — accepts input, default value sensible, persists after refresh
- [ ] **Treatment Type** (`Select`, [line 904](../../../apps/web/src/pages/housekeeping.tsx#L904)) — accepts input, default value sensible, persists after refresh
- [ ] **Chemicals Used** (`TextInput`, [line 911](../../../apps/web/src/pages/housekeeping.tsx#L911)) — accepts input, default value sensible, persists after refresh
- [ ] **Vendor Name** (`TextInput`, [line 916](../../../apps/web/src/pages/housekeeping.tsx#L916)) — accepts input, default value sensible, persists after refresh
- [ ] **Certificate No** (`TextInput`, [line 921](../../../apps/web/src/pages/housekeeping.tsx#L921)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1078>** (`Select`, [line 1078](../../../apps/web/src/pages/housekeeping.tsx#L1078)) — accepts input, default value sensible, persists after refresh
- [ ] **Item Type** (`Select`, [line 1277](../../../apps/web/src/pages/housekeeping.tsx#L1277)) — accepts input, default value sensible, persists after refresh
- [ ] **Barcode** (`TextInput`, [line 1283](../../../apps/web/src/pages/housekeeping.tsx#L1283)) — accepts input, default value sensible, persists after refresh
- [ ] **Max Washes** (`NumberInput`, [line 1288](../../../apps/web/src/pages/housekeeping.tsx#L1288)) — accepts input, default value sensible, persists after refresh
- [ ] **Commissioned Date** (`TextInput`, [line 1294](../../../apps/web/src/pages/housekeeping.tsx#L1294)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1300](../../../apps/web/src/pages/housekeeping.tsx#L1300)) — accepts input, default value sensible, persists after refresh
- [ ] **Movement Type** (`Select`, [line 1319](../../../apps/web/src/pages/housekeeping.tsx#L1319)) — accepts input, default value sensible, persists after refresh
- [ ] **Quantity** (`NumberInput`, [line 1325](../../../apps/web/src/pages/housekeeping.tsx#L1325)) — accepts input, default value sensible, persists after refresh
- [ ] **Weight (kg)** (`NumberInput`, [line 1331](../../../apps/web/src/pages/housekeeping.tsx#L1331)) — accepts input, default value sensible, persists after refresh
- [ ] **Contamination** (`Select`, [line 1339](../../../apps/web/src/pages/housekeeping.tsx#L1339)) — accepts input, default value sensible, persists after refresh
- [ ] **Recorded By** (`TextInput`, [line 1347](../../../apps/web/src/pages/housekeeping.tsx#L1347)) — accepts input, default value sensible, persists after refresh
- [ ] **Batch Number** (`TextInput`, [line 1369](../../../apps/web/src/pages/housekeeping.tsx#L1369)) — accepts input, default value sensible, persists after refresh
- [ ] **Items Count** (`NumberInput`, [line 1375](../../../apps/web/src/pages/housekeeping.tsx#L1375)) — accepts input, default value sensible, persists after refresh
- [ ] **Total Weight (kg)** (`NumberInput`, [line 1381](../../../apps/web/src/pages/housekeeping.tsx#L1381)) — accepts input, default value sensible, persists after refresh
- [ ] **Contamination** (`Select`, [line 1389](../../../apps/web/src/pages/housekeeping.tsx#L1389)) — accepts input, default value sensible, persists after refresh
- [ ] **Wash Formula** (`TextInput`, [line 1395](../../../apps/web/src/pages/housekeeping.tsx#L1395)) — accepts input, default value sensible, persists after refresh
- [ ] **Temperature (°C)** (`NumberInput`, [line 1400](../../../apps/web/src/pages/housekeeping.tsx#L1400)) — accepts input, default value sensible, persists after refresh
- [ ] **Cycle (min)** (`NumberInput`, [line 1407](../../../apps/web/src/pages/housekeeping.tsx#L1407)) — accepts input, default value sensible, persists after refresh
- [ ] **Operator** (`TextInput`, [line 1414](../../../apps/web/src/pages/housekeeping.tsx#L1414)) — accepts input, default value sensible, persists after refresh
- [ ] **Item Type** (`Select`, [line 1552](../../../apps/web/src/pages/housekeeping.tsx#L1552)) — accepts input, default value sensible, persists after refresh
- [ ] **Par Level** (`NumberInput`, [line 1558](../../../apps/web/src/pages/housekeeping.tsx#L1558)) — accepts input, default value sensible, persists after refresh
- [ ] **Current Stock** (`NumberInput`, [line 1564](../../../apps/web/src/pages/housekeeping.tsx#L1564)) — accepts input, default value sensible, persists after refresh
- [ ] **Reorder Level** (`NumberInput`, [line 1570](../../../apps/web/src/pages/housekeeping.tsx#L1570)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1796>** (`Select`, [line 1796](../../../apps/web/src/pages/housekeeping.tsx#L1796)) — accepts input, default value sensible, persists after refresh
- [ ] **Department ID** (`TextInput`, [line 1966](../../../apps/web/src/pages/housekeeping.tsx#L1966)) — accepts input, default value sensible, persists after refresh
- [ ] **Container Type** (`Select`, [line 1973](../../../apps/web/src/pages/housekeeping.tsx#L1973)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1986](../../../apps/web/src/pages/housekeeping.tsx#L1986)) — accepts input, default value sensible, persists after refresh
- [ ] **Manifest Number** (`TextInput`, [line 2028](../../../apps/web/src/pages/housekeeping.tsx#L2028)) — accepts input, default value sensible, persists after refresh
- [ ] **Department ID** (`TextInput`, [line 2034](../../../apps/web/src/pages/housekeeping.tsx#L2034)) — accepts input, default value sensible, persists after refresh
- [ ] **Waste Category** (`Select`, [line 2041](../../../apps/web/src/pages/housekeeping.tsx#L2041)) — accepts input, default value sensible, persists after refresh
- [ ] **Weight (kg)** (`NumberInput`, [line 2057](../../../apps/web/src/pages/housekeeping.tsx#L2057)) — accepts input, default value sensible, persists after refresh
- [ ] **Container Count** (`NumberInput`, [line 2065](../../../apps/web/src/pages/housekeeping.tsx#L2065)) — accepts input, default value sensible, persists after refresh
- [ ] **Pickup Date** (`TextInput`, [line 2073](../../../apps/web/src/pages/housekeeping.tsx#L2073)) — accepts input, default value sensible, persists after refresh
- [ ] **Vehicle Number** (`TextInput`, [line 2080](../../../apps/web/src/pages/housekeeping.tsx#L2080)) — accepts input, default value sensible, persists after refresh
- [ ] **Driver Name** (`TextInput`, [line 2087](../../../apps/web/src/pages/housekeeping.tsx#L2087)) — accepts input, default value sensible, persists after refresh
- [ ] **Disposal Vendor / CBWTF** (`TextInput`, [line 2093](../../../apps/web/src/pages/housekeeping.tsx#L2093)) — accepts input, default value sensible, persists after refresh
- [ ] **Handover Person** (`TextInput`, [line 2100](../../../apps/web/src/pages/housekeeping.tsx#L2100)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 2107](../../../apps/web/src/pages/housekeeping.tsx#L2107)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 22, `<ActionIcon>`: 5, `<Menu.Item>`: 0)

- [ ] **<button @ line 393>** ([line 393](../../../apps/web/src/pages/housekeeping.tsx#L393)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 393>** ([line 393](../../../apps/web/src/pages/housekeeping.tsx#L393)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 472>** ([line 472](../../../apps/web/src/pages/housekeeping.tsx#L472)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 472>** ([line 472](../../../apps/web/src/pages/housekeeping.tsx#L472)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 578>** ([line 578](../../../apps/web/src/pages/housekeeping.tsx#L578)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 578>** ([line 578](../../../apps/web/src/pages/housekeeping.tsx#L578)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 598>** ([line 598](../../../apps/web/src/pages/housekeeping.tsx#L598)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 598>** ([line 598](../../../apps/web/src/pages/housekeeping.tsx#L598)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 687>** ([line 687](../../../apps/web/src/pages/housekeeping.tsx#L687)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 687>** ([line 687](../../../apps/web/src/pages/housekeeping.tsx#L687)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 729>** ([line 729](../../../apps/web/src/pages/housekeeping.tsx#L729)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 729>** ([line 729](../../../apps/web/src/pages/housekeeping.tsx#L729)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 732>** ([line 732](../../../apps/web/src/pages/housekeeping.tsx#L732)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 732>** ([line 732](../../../apps/web/src/pages/housekeeping.tsx#L732)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 847>** ([line 847](../../../apps/web/src/pages/housekeeping.tsx#L847)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 847>** ([line 847](../../../apps/web/src/pages/housekeeping.tsx#L847)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 884>** ([line 884](../../../apps/web/src/pages/housekeeping.tsx#L884)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 884>** ([line 884](../../../apps/web/src/pages/housekeeping.tsx#L884)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 926>** ([line 926](../../../apps/web/src/pages/housekeeping.tsx#L926)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 926>** ([line 926](../../../apps/web/src/pages/housekeeping.tsx#L926)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1028>** ([line 1028](../../../apps/web/src/pages/housekeeping.tsx#L1028)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1028>** ([line 1028](../../../apps/web/src/pages/housekeeping.tsx#L1028)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1108>** ([line 1108](../../../apps/web/src/pages/housekeeping.tsx#L1108)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1108>** ([line 1108](../../../apps/web/src/pages/housekeeping.tsx#L1108)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1200>** ([line 1200](../../../apps/web/src/pages/housekeeping.tsx#L1200)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1200>** ([line 1200](../../../apps/web/src/pages/housekeeping.tsx#L1200)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1305>** ([line 1305](../../../apps/web/src/pages/housekeeping.tsx#L1305)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1305>** ([line 1305](../../../apps/web/src/pages/housekeeping.tsx#L1305)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1352>** ([line 1352](../../../apps/web/src/pages/housekeeping.tsx#L1352)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1352>** ([line 1352](../../../apps/web/src/pages/housekeeping.tsx#L1352)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1419>** ([line 1419](../../../apps/web/src/pages/housekeeping.tsx#L1419)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1419>** ([line 1419](../../../apps/web/src/pages/housekeeping.tsx#L1419)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1472>** ([line 1472](../../../apps/web/src/pages/housekeeping.tsx#L1472)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1472>** ([line 1472](../../../apps/web/src/pages/housekeeping.tsx#L1472)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1576>** ([line 1576](../../../apps/web/src/pages/housekeeping.tsx#L1576)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1576>** ([line 1576](../../../apps/web/src/pages/housekeeping.tsx#L1576)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1807>** ([line 1807](../../../apps/web/src/pages/housekeeping.tsx#L1807)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1807>** ([line 1807](../../../apps/web/src/pages/housekeeping.tsx#L1807)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1903>** ([line 1903](../../../apps/web/src/pages/housekeeping.tsx#L1903)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1903>** ([line 1903](../../../apps/web/src/pages/housekeeping.tsx#L1903)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1993>** ([line 1993](../../../apps/web/src/pages/housekeeping.tsx#L1993)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1993>** ([line 1993](../../../apps/web/src/pages/housekeeping.tsx#L1993)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **}           >             Save Transport Manifest** ([line 2113](../../../apps/web/src/pages/housekeeping.tsx#L2113)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **}           >             Save Transport Manifest** ([line 2113](../../../apps/web/src/pages/housekeeping.tsx#L2113)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 448>** ([line 448](../../../apps/web/src/pages/housekeeping.tsx#L448)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 509>** ([line 509](../../../apps/web/src/pages/housekeeping.tsx#L509)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 523>** ([line 523](../../../apps/web/src/pages/housekeeping.tsx#L523)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 535>** ([line 535](../../../apps/web/src/pages/housekeeping.tsx#L535)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1250>** ([line 1250](../../../apps/web/src/pages/housekeeping.tsx#L1250)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (27)

- [ ] `api.completeLaundryBatch` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.completeTurnaround` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBiowasteRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCleaningSchedule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCleaningTask` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createLaundryBatch` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createLinenItem` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createLinenMovement` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPestControlLog` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPestControlSchedule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSharpReplacement` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createTurnaround` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getBmwSchedule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBiowasteRecords` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCleaningSchedules` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCleaningTasks` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listLaundryBatches` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listLinenCondemnations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listLinenItems` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listLinenMovements` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listParLevels` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPestControlLogs` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPestControlSchedules` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listTurnarounds` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateCleaningTaskStatus` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.upsertParLevel` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.verifyCleaningTask` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._