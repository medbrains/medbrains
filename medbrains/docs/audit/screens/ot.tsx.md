# `ot.tsx` walkthrough

_Source: [`apps/web/src/pages/ot.tsx`](../../../apps/web/src/pages/ot.tsx) (2228 lines). Guard: `P.OT.BOOKINGS_LIST`. API methods: 26. useForm: 0. Tables: 6. Modals: 4._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.OT.BOOKINGS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Schedule** (`schedule`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Schedule** (`schedule`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Schedule** (`schedule`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Bookings** (`bookings`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Bookings** (`bookings`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Bookings** (`bookings`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Rooms** (`rooms`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Rooms** (`rooms`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Rooms** (`rooms`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Surgeon Preferences** (`preferences`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Surgeon Preferences** (`preferences`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Surgeon Preferences** (`preferences`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Reports** (`reports`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Reports** (`reports`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Reports** (`reports`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Overview** (`overview`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Overview** (`overview`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Overview** (`overview`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Pre-Op** (`preop`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Pre-Op** (`preop`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Pre-Op** (`preop`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **WHO Checklist** (`checklist`) — clicking activates the panel + loads its data without console error
- [ ] Tab **WHO Checklist** (`checklist`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **WHO Checklist** (`checklist`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Case Record** (`case-record`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Case Record** (`case-record`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Case Record** (`case-record`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Anesthesia** (`anesthesia`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Anesthesia** (`anesthesia`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Anesthesia** (`anesthesia`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Post-Op** (`postop`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Post-Op** (`postop`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Post-Op** (`postop`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Consumables** (`consumables`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Consumables** (`consumables`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Consumables** (`consumables`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (12)
- [ ] Column **Procedure** (`procedure_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`scheduled_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Room** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Procedure** (`procedure_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Position** (`position`) renders without `undefined` / `[object Object]`
- [ ] Column **Skin Prep** (`skin_prep`) renders without `undefined` / `[object Object]`
- [ ] Column **Notes** (`special_instructions`) renders without `undefined` / `[object Object]`

### `<Table>` @ line 177
  - [ ] Header **Time** column shows correct value for at least one row
  - [ ] Header **Procedure** column shows correct value for at least one row
  - [ ] Header **Patient ID** column shows correct value for at least one row
  - [ ] Header **Priority** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2087
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Category** column shows correct value for at least one row
  - [ ] Header **Qty** column shows correct value for at least one row
  - [ ] Header **Unit Price** column shows correct value for at least one row
  - [ ] Header **Total** column shows correct value for at least one row
  - [ ] Header **Batch** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Header **Room** column shows correct value for at least one row
  - [ ] Header **Total Bookings** column shows correct value for at least one row
  - [ ] Header **Total Surgery (min)** column shows correct value for at least one row
  - [ ] Header **Avg Turnaround (min)** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2192
  - [ ] Header **Room** column shows correct value for at least one row
  - [ ] Header **Total Bookings** column shows correct value for at least one row
  - [ ] Header **Total Surgery (min)** column shows correct value for at least one row
  - [ ] Header **Avg Turnaround (min)** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Drawer — _Booking Detail_ @ [line 369](../../../apps/web/src/pages/ot.tsx#L369)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New OT Booking_ @ [line 399](../../../apps/web/src/pages/ot.tsx#L399)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New OT Room_ @ [line 1790](../../../apps/web/src/pages/ot.tsx#L1790)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Surgeon Preference Card_ @ [line 1888](../../../apps/web/src/pages/ot.tsx#L1888)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (83)

- [ ] **OT Room** (`Select`, [line 167](../../../apps/web/src/pages/ot.tsx#L167)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 336>** (`Select`, [line 336](../../../apps/web/src/pages/ot.tsx#L336)) — accepts input, default value sensible, persists after refresh
- [ ] **OT Room ID** (`TextInput`, [line 407](../../../apps/web/src/pages/ot.tsx#L407)) — accepts input, default value sensible, persists after refresh
- [ ] **Primary Surgeon ID** (`TextInput`, [line 412](../../../apps/web/src/pages/ot.tsx#L412)) — accepts input, default value sensible, persists after refresh
- [ ] **Procedure Name** (`TextInput`, [line 417](../../../apps/web/src/pages/ot.tsx#L417)) — accepts input, default value sensible, persists after refresh
- [ ] **Scheduled Date** (`TextInput`, [line 422](../../../apps/web/src/pages/ot.tsx#L422)) — accepts input, default value sensible, persists after refresh
- [ ] **Scheduled Start (ISO)** (`TextInput`, [line 427](../../../apps/web/src/pages/ot.tsx#L427)) — accepts input, default value sensible, persists after refresh
- [ ] **Scheduled End (ISO)** (`TextInput`, [line 431](../../../apps/web/src/pages/ot.tsx#L431)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 435](../../../apps/web/src/pages/ot.tsx#L435)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 445](../../../apps/web/src/pages/ot.tsx#L445)) — accepts input, default value sensible, persists after refresh
- [ ] **Consent** (`Checkbox`, [line 559](../../../apps/web/src/pages/ot.tsx#L559)) — accepts input, default value sensible, persists after refresh
- [ ] **Site Marked** (`Checkbox`, [line 560](../../../apps/web/src/pages/ot.tsx#L560)) — accepts input, default value sensible, persists after refresh
- [ ] **Blood Arranged** (`Checkbox`, [line 561](../../../apps/web/src/pages/ot.tsx#L561)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 665>** (`TextInput`, [line 665](../../../apps/web/src/pages/ot.tsx#L665)) — accepts input, default value sensible, persists after refresh
- [ ] **Fasting** (`Checkbox`, [line 792](../../../apps/web/src/pages/ot.tsx#L792)) — accepts input, default value sensible, persists after refresh
- [ ] **Labs Reviewed** (`Checkbox`, [line 793](../../../apps/web/src/pages/ot.tsx#L793)) — accepts input, default value sensible, persists after refresh
- [ ] **Imaging Reviewed** (`Checkbox`, [line 794](../../../apps/web/src/pages/ot.tsx#L794)) — accepts input, default value sensible, persists after refresh
- [ ] **Blood Group Confirmed** (`Checkbox`, [line 795](../../../apps/web/src/pages/ot.tsx#L795)) — accepts input, default value sensible, persists after refresh
- [ ] **Clearance Status** (`Select`, [line 832](../../../apps/web/src/pages/ot.tsx#L832)) — accepts input, default value sensible, persists after refresh
- [ ] **ASA Class** (`Select`, [line 848](../../../apps/web/src/pages/ot.tsx#L848)) — accepts input, default value sensible, persists after refresh
- [ ] **ASA Class** (`Select`, [line 886](../../../apps/web/src/pages/ot.tsx#L886)) — accepts input, default value sensible, persists after refresh
- [ ] **Fasting** (`Checkbox`, [line 894](../../../apps/web/src/pages/ot.tsx#L894)) — accepts input, default value sensible, persists after refresh
- [ ] **NPO Since** (`TextInput`, [line 899](../../../apps/web/src/pages/ot.tsx#L899)) — accepts input, default value sensible, persists after refresh
- [ ] **Lab Results Reviewed** (`Checkbox`, [line 904](../../../apps/web/src/pages/ot.tsx#L904)) — accepts input, default value sensible, persists after refresh
- [ ] **Imaging Reviewed** (`Checkbox`, [line 909](../../../apps/web/src/pages/ot.tsx#L909)) — accepts input, default value sensible, persists after refresh
- [ ] **Blood Group Confirmed** (`Checkbox`, [line 914](../../../apps/web/src/pages/ot.tsx#L914)) — accepts input, default value sensible, persists after refresh
- [ ] **Allergies** (`TextInput`, [line 919](../../../apps/web/src/pages/ot.tsx#L919)) — accepts input, default value sensible, persists after refresh
- [ ] **Current Medications** (`TextInput`, [line 923](../../../apps/web/src/pages/ot.tsx#L923)) — accepts input, default value sensible, persists after refresh
- [ ] **Conditions** (`Textarea`, [line 929](../../../apps/web/src/pages/ot.tsx#L929)) — accepts input, default value sensible, persists after refresh
- [ ] **Instruments (before)** (`Checkbox`, [line 1172](../../../apps/web/src/pages/ot.tsx#L1172)) — accepts input, default value sensible, persists after refresh
- [ ] **Instruments (after)** (`Checkbox`, [line 1179](../../../apps/web/src/pages/ot.tsx#L1179)) — accepts input, default value sensible, persists after refresh
- [ ] **Sponges** (`Checkbox`, [line 1186](../../../apps/web/src/pages/ot.tsx#L1186)) — accepts input, default value sensible, persists after refresh
- [ ] **Procedure Performed** (`TextInput`, [line 1220](../../../apps/web/src/pages/ot.tsx#L1220)) — accepts input, default value sensible, persists after refresh
- [ ] **Findings** (`Textarea`, [line 1225](../../../apps/web/src/pages/ot.tsx#L1225)) — accepts input, default value sensible, persists after refresh
- [ ] **Technique** (`Textarea`, [line 1229](../../../apps/web/src/pages/ot.tsx#L1229)) — accepts input, default value sensible, persists after refresh
- [ ] **Complications** (`Textarea`, [line 1233](../../../apps/web/src/pages/ot.tsx#L1233)) — accepts input, default value sensible, persists after refresh
- [ ] **Blood Loss (ml)** (`NumberInput`, [line 1237](../../../apps/web/src/pages/ot.tsx#L1237)) — accepts input, default value sensible, persists after refresh
- [ ] **Incision Time (ISO)** (`TextInput`, [line 1242](../../../apps/web/src/pages/ot.tsx#L1242)) — accepts input, default value sensible, persists after refresh
- [ ] **Closure Time (ISO)** (`TextInput`, [line 1247](../../../apps/web/src/pages/ot.tsx#L1247)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient In Time (ISO)** (`TextInput`, [line 1251](../../../apps/web/src/pages/ot.tsx#L1251)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient Out Time (ISO)** (`TextInput`, [line 1255](../../../apps/web/src/pages/ot.tsx#L1255)) — accepts input, default value sensible, persists after refresh
- [ ] **Instruments correct (before)** (`Checkbox`, [line 1263](../../../apps/web/src/pages/ot.tsx#L1263)) — accepts input, default value sensible, persists after refresh
- [ ] **Instruments correct (after)** (`Checkbox`, [line 1270](../../../apps/web/src/pages/ot.tsx#L1270)) — accepts input, default value sensible, persists after refresh
- [ ] **Sponges correct** (`Checkbox`, [line 1277](../../../apps/web/src/pages/ot.tsx#L1277)) — accepts input, default value sensible, persists after refresh
- [ ] **Specimens** (`Textarea`, [line 1290](../../../apps/web/src/pages/ot.tsx#L1290)) — accepts input, default value sensible, persists after refresh
- [ ] **Implants** (`Textarea`, [line 1300](../../../apps/web/src/pages/ot.tsx#L1300)) — accepts input, default value sensible, persists after refresh
- [ ] **Drains** (`Textarea`, [line 1310](../../../apps/web/src/pages/ot.tsx#L1310)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1317](../../../apps/web/src/pages/ot.tsx#L1317)) — accepts input, default value sensible, persists after refresh
- [ ] **Anesthesia Type** (`Select`, [line 1420](../../../apps/web/src/pages/ot.tsx#L1420)) — accepts input, default value sensible, persists after refresh
- [ ] **ASA Class** (`Select`, [line 1427](../../../apps/web/src/pages/ot.tsx#L1427)) — accepts input, default value sensible, persists after refresh
- [ ] **Induction Time (ISO)** (`TextInput`, [line 1435](../../../apps/web/src/pages/ot.tsx#L1435)) — accepts input, default value sensible, persists after refresh
- [ ] **Intubation Time (ISO)** (`TextInput`, [line 1439](../../../apps/web/src/pages/ot.tsx#L1439)) — accepts input, default value sensible, persists after refresh
- [ ] **Airway Details** (`Textarea`, [line 1443](../../../apps/web/src/pages/ot.tsx#L1443)) — accepts input, default value sensible, persists after refresh
- [ ] **Drugs Administered** (`Textarea`, [line 1453](../../../apps/web/src/pages/ot.tsx#L1453)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1463](../../../apps/web/src/pages/ot.tsx#L1463)) — accepts input, default value sensible, persists after refresh
- [ ] **Recovery Status** (`Select`, [line 1590](../../../apps/web/src/pages/ot.tsx#L1590)) — accepts input, default value sensible, persists after refresh
- [ ] **Aldrete Score (discharge)** (`NumberInput`, [line 1601](../../../apps/web/src/pages/ot.tsx#L1601)) — accepts input, default value sensible, persists after refresh
- [ ] **Discharge Time (ISO)** (`TextInput`, [line 1613](../../../apps/web/src/pages/ot.tsx#L1613)) — accepts input, default value sensible, persists after refresh
- [ ] **Disposition** (`TextInput`, [line 1620](../../../apps/web/src/pages/ot.tsx#L1620)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1626](../../../apps/web/src/pages/ot.tsx#L1626)) — accepts input, default value sensible, persists after refresh
- [ ] **Arrival Time (ISO)** (`TextInput`, [line 1658](../../../apps/web/src/pages/ot.tsx#L1658)) — accepts input, default value sensible, persists after refresh
- [ ] **Aldrete Score (arrival)** (`NumberInput`, [line 1663](../../../apps/web/src/pages/ot.tsx#L1663)) — accepts input, default value sensible, persists after refresh
- [ ] **Pain Assessment** (`TextInput`, [line 1671](../../../apps/web/src/pages/ot.tsx#L1671)) — accepts input, default value sensible, persists after refresh
- [ ] **Fluid Orders** (`TextInput`, [line 1676](../../../apps/web/src/pages/ot.tsx#L1676)) — accepts input, default value sensible, persists after refresh
- [ ] **Diet Orders** (`TextInput`, [line 1680](../../../apps/web/src/pages/ot.tsx#L1680)) — accepts input, default value sensible, persists after refresh
- [ ] **Activity Orders** (`TextInput`, [line 1684](../../../apps/web/src/pages/ot.tsx#L1684)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1688](../../../apps/web/src/pages/ot.tsx#L1688)) — accepts input, default value sensible, persists after refresh
- [ ] **Room Name** (`TextInput`, [line 1792](../../../apps/web/src/pages/ot.tsx#L1792)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 1798](../../../apps/web/src/pages/ot.tsx#L1798)) — accepts input, default value sensible, persists after refresh
- [ ] **Surgeon ID** (`TextInput`, [line 1896](../../../apps/web/src/pages/ot.tsx#L1896)) — accepts input, default value sensible, persists after refresh
- [ ] **Procedure Name** (`TextInput`, [line 1901](../../../apps/web/src/pages/ot.tsx#L1901)) — accepts input, default value sensible, persists after refresh
- [ ] **Position** (`TextInput`, [line 1906](../../../apps/web/src/pages/ot.tsx#L1906)) — accepts input, default value sensible, persists after refresh
- [ ] **Skin Prep** (`TextInput`, [line 1910](../../../apps/web/src/pages/ot.tsx#L1910)) — accepts input, default value sensible, persists after refresh
- [ ] **Draping** (`TextInput`, [line 1914](../../../apps/web/src/pages/ot.tsx#L1914)) — accepts input, default value sensible, persists after refresh
- [ ] **Special Instructions** (`Textarea`, [line 1918](../../../apps/web/src/pages/ot.tsx#L1918)) — accepts input, default value sensible, persists after refresh
- [ ] **Item Name** (`TextInput`, [line 2011](../../../apps/web/src/pages/ot.tsx#L2011)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 2017](../../../apps/web/src/pages/ot.tsx#L2017)) — accepts input, default value sensible, persists after refresh
- [ ] **Quantity** (`NumberInput`, [line 2025](../../../apps/web/src/pages/ot.tsx#L2025)) — accepts input, default value sensible, persists after refresh
- [ ] **Unit** (`TextInput`, [line 2033](../../../apps/web/src/pages/ot.tsx#L2033)) — accepts input, default value sensible, persists after refresh
- [ ] **Unit Price** (`NumberInput`, [line 2041](../../../apps/web/src/pages/ot.tsx#L2041)) — accepts input, default value sensible, persists after refresh
- [ ] **Batch Number** (`TextInput`, [line 2048](../../../apps/web/src/pages/ot.tsx#L2048)) — accepts input, default value sensible, persists after refresh
- [ ] **From** (`TextInput`, [line 2169](../../../apps/web/src/pages/ot.tsx#L2169)) — accepts input, default value sensible, persists after refresh
- [ ] **To** (`TextInput`, [line 2176](../../../apps/web/src/pages/ot.tsx#L2176)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 30, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 351>** ([line 351](../../../apps/web/src/pages/ot.tsx#L351)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 351>** ([line 351](../../../apps/web/src/pages/ot.tsx#L351)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 449>** ([line 449](../../../apps/web/src/pages/ot.tsx#L449)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 449>** ([line 449](../../../apps/web/src/pages/ot.tsx#L449)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 577>** ([line 577](../../../apps/web/src/pages/ot.tsx#L577)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 577>** ([line 577](../../../apps/web/src/pages/ot.tsx#L577)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 586>** ([line 586](../../../apps/web/src/pages/ot.tsx#L586)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 586>** ([line 586](../../../apps/web/src/pages/ot.tsx#L586)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 600>** ([line 600](../../../apps/web/src/pages/ot.tsx#L600)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 600>** ([line 600](../../../apps/web/src/pages/ot.tsx#L600)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 614>** ([line 614](../../../apps/web/src/pages/ot.tsx#L614)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 614>** ([line 614](../../../apps/web/src/pages/ot.tsx#L614)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 623>** ([line 623](../../../apps/web/src/pages/ot.tsx#L623)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 623>** ([line 623](../../../apps/web/src/pages/ot.tsx#L623)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 637>** ([line 637](../../../apps/web/src/pages/ot.tsx#L637)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 637>** ([line 637](../../../apps/web/src/pages/ot.tsx#L637)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 651>** ([line 651](../../../apps/web/src/pages/ot.tsx#L651)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 651>** ([line 651](../../../apps/web/src/pages/ot.tsx#L651)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 671>** ([line 671](../../../apps/web/src/pages/ot.tsx#L671)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 671>** ([line 671](../../../apps/web/src/pages/ot.tsx#L671)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 686>** ([line 686](../../../apps/web/src/pages/ot.tsx#L686)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 686>** ([line 686](../../../apps/web/src/pages/ot.tsx#L686)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 810>** ([line 810](../../../apps/web/src/pages/ot.tsx#L810)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 810>** ([line 810](../../../apps/web/src/pages/ot.tsx#L810)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 861>** ([line 861](../../../apps/web/src/pages/ot.tsx#L861)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 861>** ([line 861](../../../apps/web/src/pages/ot.tsx#L861)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setEditing(false)}>             Cancel** ([line 868](../../../apps/web/src/pages/ot.tsx#L868)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setEditing(false)}>             Cancel** ([line 868](../../../apps/web/src/pages/ot.tsx#L868)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 933>** ([line 933](../../../apps/web/src/pages/ot.tsx#L933)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 933>** ([line 933](../../../apps/web/src/pages/ot.tsx#L933)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1068>** ([line 1068](../../../apps/web/src/pages/ot.tsx#L1068)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1068>** ([line 1068](../../../apps/web/src/pages/ot.tsx#L1068)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1083>** ([line 1083](../../../apps/web/src/pages/ot.tsx#L1083)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1083>** ([line 1083](../../../apps/web/src/pages/ot.tsx#L1083)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1322>** ([line 1322](../../../apps/web/src/pages/ot.tsx#L1322)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1322>** ([line 1322](../../../apps/web/src/pages/ot.tsx#L1322)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1467>** ([line 1467](../../../apps/web/src/pages/ot.tsx#L1467)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1467>** ([line 1467](../../../apps/web/src/pages/ot.tsx#L1467)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1571>** ([line 1571](../../../apps/web/src/pages/ot.tsx#L1571)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1571>** ([line 1571](../../../apps/web/src/pages/ot.tsx#L1571)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1633>** ([line 1633](../../../apps/web/src/pages/ot.tsx#L1633)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1633>** ([line 1633](../../../apps/web/src/pages/ot.tsx#L1633)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setEditing(false)}>             Cancel** ([line 1640](../../../apps/web/src/pages/ot.tsx#L1640)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setEditing(false)}>             Cancel** ([line 1640](../../../apps/web/src/pages/ot.tsx#L1640)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1692>** ([line 1692](../../../apps/web/src/pages/ot.tsx#L1692)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1692>** ([line 1692](../../../apps/web/src/pages/ot.tsx#L1692)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1757>** ([line 1757](../../../apps/web/src/pages/ot.tsx#L1757)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1757>** ([line 1757](../../../apps/web/src/pages/ot.tsx#L1757)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1804>** ([line 1804](../../../apps/web/src/pages/ot.tsx#L1804)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1804>** ([line 1804](../../../apps/web/src/pages/ot.tsx#L1804)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1857>** ([line 1857](../../../apps/web/src/pages/ot.tsx#L1857)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1857>** ([line 1857](../../../apps/web/src/pages/ot.tsx#L1857)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1924>** ([line 1924](../../../apps/web/src/pages/ot.tsx#L1924)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1924>** ([line 1924](../../../apps/web/src/pages/ot.tsx#L1924)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1996>** ([line 1996](../../../apps/web/src/pages/ot.tsx#L1996)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1996>** ([line 1996](../../../apps/web/src/pages/ot.tsx#L1996)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2055>** ([line 2055](../../../apps/web/src/pages/ot.tsx#L2055)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2055>** ([line 2055](../../../apps/web/src/pages/ot.tsx#L2055)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setShowForm(false)}>                 Cancel** ([line 2072](../../../apps/web/src/pages/ot.tsx#L2072)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setShowForm(false)}>                 Cancel** ([line 2072](../../../apps/web/src/pages/ot.tsx#L2072)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 318>** ([line 318](../../../apps/web/src/pages/ot.tsx#L318)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2128>** ([line 2128](../../../apps/web/src/pages/ot.tsx#L2128)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (26)

- [ ] `api.createAnesthesiaRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCaseRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createOtBooking` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createOtConsumable` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createOtRoom` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPostopRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPreopAssessment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSafetyChecklist` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSurgeonPreference` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteOtConsumable` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAnesthesiaRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getCaseRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getOtBooking` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getOtSchedule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPostopRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOtBookings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOtConsumables` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOtRooms` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPreopAssessments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSafetyChecklists` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSurgeonPreferences` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.otUtilization` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateOtBookingStatus` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updatePostopRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updatePreopAssessment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateSafetyChecklist` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._