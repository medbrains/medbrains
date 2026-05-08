# `facilities.tsx` walkthrough

_Source: [`apps/web/src/pages/facilities.tsx`](../../../apps/web/src/pages/facilities.tsx) (767 lines). Guard: `P.FACILITIES.GAS_LIST`. API methods: 21. useForm: 0. Tables: 10. Modals: 10._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.FACILITIES.GAS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>MGPS** (`mgps`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>MGPS** (`mgps`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>MGPS** (`mgps`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Fire Safety** (`fire`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Fire Safety** (`fire`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Fire Safety** (`fire`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Water Quality** (`water`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Water Quality** (`water`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Water Quality** (`water`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Energy** (`energy`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Energy** (`energy`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Energy** (`energy`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Work Orders** (`work-orders`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Work Orders** (`work-orders`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Work Orders** (`work-orders`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (59)
- [ ] Column **Gas** (`gas_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Source** (`source_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Purity %** (`purity_percent`) renders without `undefined` / `[object Object]`
- [ ] Column **Pressure (bar)** (`pressure_bar`) renders without `undefined` / `[object Object]`
- [ ] Column **Flow (LPM)** (`flow_lpm`) renders without `undefined` / `[object Object]`
- [ ] Column **Tank %** (`tank_level_percent`) renders without `undefined` / `[object Object]`
- [ ] Column **Alarm** (`is_alarm`) renders without `undefined` / `[object Object]`
- [ ] Column **Time** (`reading_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Gas** (`gas_type`) renders without `undefined` / `[object Object]`
- [ ] Column **PESO License** (`peso_license_number`) renders without `undefined` / `[object Object]`
- [ ] Column **PESO Valid To** (`peso_valid_to`) renders without `undefined` / `[object Object]`
- [ ] Column **Drug License** (`drug_license_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`compliance_status`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`equipment_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Serial** (`serial_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Expiry** (`expiry_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`inspection_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Functional** (`is_functional`) renders without `undefined` / `[object Object]`
- [ ] Column **Findings** (`findings`) renders without `undefined` / `[object Object]`
- [ ] Column **Next Due** (`next_inspection_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`drill_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`drill_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Duration (min)** (`duration_minutes`) renders without `undefined` / `[object Object]`
- [ ] Column **Participants** (`participants_count`) renders without `undefined` / `[object Object]`
- [ ] Column **Evac Time (s)** (`evacuation_time_seconds`) renders without `undefined` / `[object Object]`
- [ ] Column **Next Due** (`next_drill_due`) renders without `undefined` / `[object Object]`
- [ ] Column **NOC Number** (`noc_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Authority** (`issuing_authority`) renders without `undefined` / `[object Object]`
- [ ] Column **Valid To** (`valid_to`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Source** (`source_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Test** (`test_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Parameter** (`parameter_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Result** (`result_value`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`is_within_limits`) renders without `undefined` / `[object Object]`
- [ ] Column **Sampled** (`sample_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`schedule_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Frequency** (`frequency`) renders without `undefined` / `[object Object]`
- [ ] Column **Last Done** (`last_completed_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Next Due** (`next_due_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Source** (`source_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Equipment** (`equipment_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Voltage** (`voltage`) renders without `undefined` / `[object Object]`
- [ ] Column **Power (kW)** (`power_kw`) renders without `undefined` / `[object Object]`
- [ ] Column **Load %** (`load_percent`) renders without `undefined` / `[object Object]`
- [ ] Column **Fuel %** (`fuel_level_percent`) renders without `undefined` / `[object Object]`
- [ ] Column **Battery %** (`battery_health_percent`) renders without `undefined` / `[object Object]`
- [ ] _… 9 more columns — review remaining_

## Modals / Drawers

### Drawer — _Record Gas Reading_ @ [line 287](../../../apps/web/src/pages/facilities.tsx#L287)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Gas Compliance_ @ [line 303](../../../apps/web/src/pages/facilities.tsx#L303)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Fire Equipment_ @ [line 395](../../../apps/web/src/pages/facilities.tsx#L395)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Fire Drill_ @ [line 408](../../../apps/web/src/pages/facilities.tsx#L408)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Water Test_ @ [line 481](../../../apps/web/src/pages/facilities.tsx#L481)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Water Schedule_ @ [line 496](../../../apps/web/src/pages/facilities.tsx#L496)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Energy Reading_ @ [line 554](../../../apps/web/src/pages/facilities.tsx#L554)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Work Order_ @ [line 722](../../../apps/web/src/pages/facilities.tsx#L722)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 732>_ @ [line 732](../../../apps/web/src/pages/facilities.tsx#L732)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Schedule Preventive Maintenance_ @ [line 745](../../../apps/web/src/pages/facilities.tsx#L745)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (71)

- [ ] **Gas Type** (`Select`, [line 289](../../../apps/web/src/pages/facilities.tsx#L289)) — accepts input, default value sensible, persists after refresh
- [ ] **Source** (`Select`, [line 290](../../../apps/web/src/pages/facilities.tsx#L290)) — accepts input, default value sensible, persists after refresh
- [ ] **Purity %** (`NumberInput`, [line 291](../../../apps/web/src/pages/facilities.tsx#L291)) — accepts input, default value sensible, persists after refresh
- [ ] **Pressure (bar)** (`NumberInput`, [line 292](../../../apps/web/src/pages/facilities.tsx#L292)) — accepts input, default value sensible, persists after refresh
- [ ] **Flow (LPM)** (`NumberInput`, [line 293](../../../apps/web/src/pages/facilities.tsx#L293)) — accepts input, default value sensible, persists after refresh
- [ ] **Tank Level %** (`NumberInput`, [line 294](../../../apps/web/src/pages/facilities.tsx#L294)) — accepts input, default value sensible, persists after refresh
- [ ] **Cylinder Count** (`NumberInput`, [line 295](../../../apps/web/src/pages/facilities.tsx#L295)) — accepts input, default value sensible, persists after refresh
- [ ] **Alarm** (`Switch`, [line 296](../../../apps/web/src/pages/facilities.tsx#L296)) — accepts input, default value sensible, persists after refresh
- [ ] **Alarm Reason** (`TextInput`, [line 297](../../../apps/web/src/pages/facilities.tsx#L297)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 298](../../../apps/web/src/pages/facilities.tsx#L298)) — accepts input, default value sensible, persists after refresh
- [ ] **Gas Type** (`Select`, [line 305](../../../apps/web/src/pages/facilities.tsx#L305)) — accepts input, default value sensible, persists after refresh
- [ ] **PESO License Number** (`TextInput`, [line 306](../../../apps/web/src/pages/facilities.tsx#L306)) — accepts input, default value sensible, persists after refresh
- [ ] **Drug License Number** (`TextInput`, [line 307](../../../apps/web/src/pages/facilities.tsx#L307)) — accepts input, default value sensible, persists after refresh
- [ ] **Inspector Name** (`TextInput`, [line 308](../../../apps/web/src/pages/facilities.tsx#L308)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 309](../../../apps/web/src/pages/facilities.tsx#L309)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 397](../../../apps/web/src/pages/facilities.tsx#L397)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 398](../../../apps/web/src/pages/facilities.tsx#L398)) — accepts input, default value sensible, persists after refresh
- [ ] **Serial Number** (`TextInput`, [line 399](../../../apps/web/src/pages/facilities.tsx#L399)) — accepts input, default value sensible, persists after refresh
- [ ] **Make** (`TextInput`, [line 400](../../../apps/web/src/pages/facilities.tsx#L400)) — accepts input, default value sensible, persists after refresh
- [ ] **Capacity** (`TextInput`, [line 401](../../../apps/web/src/pages/facilities.tsx#L401)) — accepts input, default value sensible, persists after refresh
- [ ] **Barcode** (`TextInput`, [line 402](../../../apps/web/src/pages/facilities.tsx#L402)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 403](../../../apps/web/src/pages/facilities.tsx#L403)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 410](../../../apps/web/src/pages/facilities.tsx#L410)) — accepts input, default value sensible, persists after refresh
- [ ] **Drill Date** (`DateInput`, [line 411](../../../apps/web/src/pages/facilities.tsx#L411)) — accepts input, default value sensible, persists after refresh
- [ ] **Duration (minutes)** (`NumberInput`, [line 412](../../../apps/web/src/pages/facilities.tsx#L412)) — accepts input, default value sensible, persists after refresh
- [ ] **Participants** (`NumberInput`, [line 413](../../../apps/web/src/pages/facilities.tsx#L413)) — accepts input, default value sensible, persists after refresh
- [ ] **Evacuation Time (seconds)** (`NumberInput`, [line 414](../../../apps/web/src/pages/facilities.tsx#L414)) — accepts input, default value sensible, persists after refresh
- [ ] **Scenario** (`Textarea`, [line 415](../../../apps/web/src/pages/facilities.tsx#L415)) — accepts input, default value sensible, persists after refresh
- [ ] **Findings** (`Textarea`, [line 416](../../../apps/web/src/pages/facilities.tsx#L416)) — accepts input, default value sensible, persists after refresh
- [ ] **Improvement Actions** (`Textarea`, [line 417](../../../apps/web/src/pages/facilities.tsx#L417)) — accepts input, default value sensible, persists after refresh
- [ ] **Source** (`Select`, [line 483](../../../apps/web/src/pages/facilities.tsx#L483)) — accepts input, default value sensible, persists after refresh
- [ ] **Test Type** (`Select`, [line 484](../../../apps/web/src/pages/facilities.tsx#L484)) — accepts input, default value sensible, persists after refresh
- [ ] **Parameter** (`TextInput`, [line 485](../../../apps/web/src/pages/facilities.tsx#L485)) — accepts input, default value sensible, persists after refresh
- [ ] **Result Value** (`NumberInput`, [line 486](../../../apps/web/src/pages/facilities.tsx#L486)) — accepts input, default value sensible, persists after refresh
- [ ] **Unit** (`TextInput`, [line 487](../../../apps/web/src/pages/facilities.tsx#L487)) — accepts input, default value sensible, persists after refresh
- [ ] **Min Acceptable** (`NumberInput`, [line 488](../../../apps/web/src/pages/facilities.tsx#L488)) — accepts input, default value sensible, persists after refresh
- [ ] **Max Acceptable** (`NumberInput`, [line 489](../../../apps/web/src/pages/facilities.tsx#L489)) — accepts input, default value sensible, persists after refresh
- [ ] **Lab Name** (`TextInput`, [line 490](../../../apps/web/src/pages/facilities.tsx#L490)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 491](../../../apps/web/src/pages/facilities.tsx#L491)) — accepts input, default value sensible, persists after refresh
- [ ] **Schedule Type** (`Select`, [line 498](../../../apps/web/src/pages/facilities.tsx#L498)) — accepts input, default value sensible, persists after refresh
- [ ] **Frequency** (`Select`, [line 499](../../../apps/web/src/pages/facilities.tsx#L499)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 500](../../../apps/web/src/pages/facilities.tsx#L500)) — accepts input, default value sensible, persists after refresh
- [ ] **Source** (`Select`, [line 556](../../../apps/web/src/pages/facilities.tsx#L556)) — accepts input, default value sensible, persists after refresh
- [ ] **Equipment Name** (`TextInput`, [line 557](../../../apps/web/src/pages/facilities.tsx#L557)) — accepts input, default value sensible, persists after refresh
- [ ] **Voltage** (`NumberInput`, [line 558](../../../apps/web/src/pages/facilities.tsx#L558)) — accepts input, default value sensible, persists after refresh
- [ ] **Current (A)** (`NumberInput`, [line 559](../../../apps/web/src/pages/facilities.tsx#L559)) — accepts input, default value sensible, persists after refresh
- [ ] **Power (kW)** (`NumberInput`, [line 560](../../../apps/web/src/pages/facilities.tsx#L560)) — accepts input, default value sensible, persists after refresh
- [ ] **Load %** (`NumberInput`, [line 561](../../../apps/web/src/pages/facilities.tsx#L561)) — accepts input, default value sensible, persists after refresh
- [ ] **Fuel %** (`NumberInput`, [line 562](../../../apps/web/src/pages/facilities.tsx#L562)) — accepts input, default value sensible, persists after refresh
- [ ] **Runtime (hrs)** (`NumberInput`, [line 563](../../../apps/web/src/pages/facilities.tsx#L563)) — accepts input, default value sensible, persists after refresh
- [ ] **Battery Voltage** (`NumberInput`, [line 564](../../../apps/web/src/pages/facilities.tsx#L564)) — accepts input, default value sensible, persists after refresh
- [ ] **Battery Health %** (`NumberInput`, [line 565](../../../apps/web/src/pages/facilities.tsx#L565)) — accepts input, default value sensible, persists after refresh
- [ ] **Backup (min)** (`NumberInput`, [line 566](../../../apps/web/src/pages/facilities.tsx#L566)) — accepts input, default value sensible, persists after refresh
- [ ] **Alarm** (`Switch`, [line 567](../../../apps/web/src/pages/facilities.tsx#L567)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 568](../../../apps/web/src/pages/facilities.tsx#L568)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 602>** (`TextInput`, [line 602](../../../apps/web/src/pages/facilities.tsx#L602)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 603>** (`TextInput`, [line 603](../../../apps/web/src/pages/facilities.tsx#L603)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 724](../../../apps/web/src/pages/facilities.tsx#L724)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 725](../../../apps/web/src/pages/facilities.tsx#L725)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 726](../../../apps/web/src/pages/facilities.tsx#L726)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 727](../../../apps/web/src/pages/facilities.tsx#L727)) — accepts input, default value sensible, persists after refresh
- [ ] **Status** (`Select`, [line 734](../../../apps/web/src/pages/facilities.tsx#L734)) — accepts input, default value sensible, persists after refresh
- [ ] **Findings** (`Textarea`, [line 735](../../../apps/web/src/pages/facilities.tsx#L735)) — accepts input, default value sensible, persists after refresh
- [ ] **Actions Taken** (`Textarea`, [line 736](../../../apps/web/src/pages/facilities.tsx#L736)) — accepts input, default value sensible, persists after refresh
- [ ] **Vendor Cost** (`NumberInput`, [line 737](../../../apps/web/src/pages/facilities.tsx#L737)) — accepts input, default value sensible, persists after refresh
- [ ] **Material Cost** (`NumberInput`, [line 738](../../../apps/web/src/pages/facilities.tsx#L738)) — accepts input, default value sensible, persists after refresh
- [ ] **Labor Cost** (`NumberInput`, [line 739](../../../apps/web/src/pages/facilities.tsx#L739)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 740](../../../apps/web/src/pages/facilities.tsx#L740)) — accepts input, default value sensible, persists after refresh
- [ ] **Equipment IDs (comma-separated)** (`TextInput`, [line 747](../../../apps/web/src/pages/facilities.tsx#L747)) — accepts input, default value sensible, persists after refresh
- [ ] **Frequency** (`Select`, [line 751](../../../apps/web/src/pages/facilities.tsx#L751)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Date** (`TextInput`, [line 760](../../../apps/web/src/pages/facilities.tsx#L760)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 20, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 277>** ([line 277](../../../apps/web/src/pages/facilities.tsx#L277)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 277>** ([line 277](../../../apps/web/src/pages/facilities.tsx#L277)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 283>** ([line 283](../../../apps/web/src/pages/facilities.tsx#L283)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 283>** ([line 283](../../../apps/web/src/pages/facilities.tsx#L283)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 299>** ([line 299](../../../apps/web/src/pages/facilities.tsx#L299)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 299>** ([line 299](../../../apps/web/src/pages/facilities.tsx#L299)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 310>** ([line 310](../../../apps/web/src/pages/facilities.tsx#L310)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 310>** ([line 310](../../../apps/web/src/pages/facilities.tsx#L310)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 379>** ([line 379](../../../apps/web/src/pages/facilities.tsx#L379)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 379>** ([line 379](../../../apps/web/src/pages/facilities.tsx#L379)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 388>** ([line 388](../../../apps/web/src/pages/facilities.tsx#L388)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 388>** ([line 388](../../../apps/web/src/pages/facilities.tsx#L388)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 404>** ([line 404](../../../apps/web/src/pages/facilities.tsx#L404)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 404>** ([line 404](../../../apps/web/src/pages/facilities.tsx#L404)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 418>** ([line 418](../../../apps/web/src/pages/facilities.tsx#L418)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 418>** ([line 418](../../../apps/web/src/pages/facilities.tsx#L418)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 471>** ([line 471](../../../apps/web/src/pages/facilities.tsx#L471)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 471>** ([line 471](../../../apps/web/src/pages/facilities.tsx#L471)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 477>** ([line 477](../../../apps/web/src/pages/facilities.tsx#L477)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 477>** ([line 477](../../../apps/web/src/pages/facilities.tsx#L477)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 492>** ([line 492](../../../apps/web/src/pages/facilities.tsx#L492)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 492>** ([line 492](../../../apps/web/src/pages/facilities.tsx#L492)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 501>** ([line 501](../../../apps/web/src/pages/facilities.tsx#L501)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 501>** ([line 501](../../../apps/web/src/pages/facilities.tsx#L501)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 544>** ([line 544](../../../apps/web/src/pages/facilities.tsx#L544)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 544>** ([line 544](../../../apps/web/src/pages/facilities.tsx#L544)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 545>** ([line 545](../../../apps/web/src/pages/facilities.tsx#L545)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 545>** ([line 545](../../../apps/web/src/pages/facilities.tsx#L545)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 569>** ([line 569](../../../apps/web/src/pages/facilities.tsx#L569)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 569>** ([line 569](../../../apps/web/src/pages/facilities.tsx#L569)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 716>** ([line 716](../../../apps/web/src/pages/facilities.tsx#L716)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 716>** ([line 716](../../../apps/web/src/pages/facilities.tsx#L716)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 717>** ([line 717](../../../apps/web/src/pages/facilities.tsx#L717)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 717>** ([line 717](../../../apps/web/src/pages/facilities.tsx#L717)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 728>** ([line 728](../../../apps/web/src/pages/facilities.tsx#L728)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 728>** ([line 728](../../../apps/web/src/pages/facilities.tsx#L728)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 741>** ([line 741](../../../apps/web/src/pages/facilities.tsx#L741)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 741>** ([line 741](../../../apps/web/src/pages/facilities.tsx#L741)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 761>** ([line 761](../../../apps/web/src/pages/facilities.tsx#L761)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 761>** ([line 761](../../../apps/web/src/pages/facilities.tsx#L761)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 704>** ([line 704](../../../apps/web/src/pages/facilities.tsx#L704)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (21)

- [ ] `api.createFmsEnergyReading` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createFmsFireDrill` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createFmsFireEquipment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createFmsGasCompliance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createFmsGasReading` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createFmsWaterSchedule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createFmsWaterTest` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createFmsWorkOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.energyAnalytics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFmsEnergyReadings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFmsFireDrills` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFmsFireEquipment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFmsFireInspections` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFmsFireNoc` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFmsGasCompliance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFmsGasReadings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFmsWaterSchedules` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFmsWaterTests` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFmsWorkOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.schedulePm` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateFmsWorkOrderStatus` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._