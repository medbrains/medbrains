# `blood-bank.tsx` walkthrough

_Source: [`apps/web/src/pages/blood-bank.tsx`](../../../apps/web/src/pages/blood-bank.tsx) (1905 lines). Guard: `P.BLOOD_BANK.DONORS_LIST`. API methods: 30. useForm: 0. Tables: 14. Modals: 16._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.BLOOD_BANK.DONORS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Donors** (`donors`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Donors** (`donors`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Donors** (`donors`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Inventory** (`inventory`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Inventory** (`inventory`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Inventory** (`inventory`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Crossmatch** (`crossmatch`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Crossmatch** (`crossmatch`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Crossmatch** (`crossmatch`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Transfusions** (`transfusions`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Transfusions** (`transfusions`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Transfusions** (`transfusions`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Reports** (`reports`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Reports** (`reports`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Reports** (`reports`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Returns & MSBOS** (`returns`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Returns & MSBOS** (`returns`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Returns & MSBOS** (`returns`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Cold Chain** (`coldchain`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Cold Chain** (`coldchain`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Cold Chain** (`coldchain`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Compliance** (`compliance`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Compliance** (`compliance`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Compliance** (`compliance`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### `<Table>` @ line 330
  - [ ] Header **Bag #** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Volume** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Reaction** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 347
  - [ ] Header **Bag #** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Volume** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Reaction** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Drawer — _Register Blood Donor_ @ [line 222](../../../apps/web/src/pages/blood-bank.tsx#L222)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 230>_ @ [line 230](../../../apps/web/src/pages/blood-bank.tsx#L230)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Donation_ @ [line 402](../../../apps/web/src/pages/blood-bank.tsx#L402)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 406>_ @ [line 406](../../../apps/web/src/pages/blood-bank.tsx#L406)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Blood Component_ @ [line 743](../../../apps/web/src/pages/blood-bank.tsx#L743)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 755>_ @ [line 755](../../../apps/web/src/pages/blood-bank.tsx#L755)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Crossmatch Request_ @ [line 968](../../../apps/web/src/pages/blood-bank.tsx#L968)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Transfusion_ @ [line 1089](../../../apps/web/src/pages/blood-bank.tsx#L1089)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 1093>_ @ [line 1093](../../../apps/web/src/pages/blood-bank.tsx#L1093)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Blood Return_ @ [line 1366](../../../apps/web/src/pages/blood-bank.tsx#L1366)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add MSBOS Guideline_ @ [line 1407](../../../apps/web/src/pages/blood-bank.tsx#L1407)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 1547>_ @ [line 1547](../../../apps/web/src/pages/blood-bank.tsx#L1547)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Cold Chain Device_ @ [line 1557](../../../apps/web/src/pages/blood-bank.tsx#L1557)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Log Temperature Reading_ @ [line 1589](../../../apps/web/src/pages/blood-bank.tsx#L1589)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Lookback Event_ @ [line 1725](../../../apps/web/src/pages/blood-bank.tsx#L1725)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Recruitment Campaign_ @ [line 1871](../../../apps/web/src/pages/blood-bank.tsx#L1871)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (67)

- [ ] **<Select @ line 196>** (`Select`, [line 196](../../../apps/web/src/pages/blood-bank.tsx#L196)) — accepts input, default value sensible, persists after refresh
- [ ] **Donor Number** (`TextInput`, [line 247](../../../apps/web/src/pages/blood-bank.tsx#L247)) — accepts input, default value sensible, persists after refresh
- [ ] **First Name** (`TextInput`, [line 249](../../../apps/web/src/pages/blood-bank.tsx#L249)) — accepts input, default value sensible, persists after refresh
- [ ] **Last Name** (`TextInput`, [line 250](../../../apps/web/src/pages/blood-bank.tsx#L250)) — accepts input, default value sensible, persists after refresh
- [ ] **Blood Group** (`Select`, [line 252](../../../apps/web/src/pages/blood-bank.tsx#L252)) — accepts input, default value sensible, persists after refresh
- [ ] **Gender** (`Select`, [line 253](../../../apps/web/src/pages/blood-bank.tsx#L253)) — accepts input, default value sensible, persists after refresh
- [ ] **Phone** (`TextInput`, [line 254](../../../apps/web/src/pages/blood-bank.tsx#L254)) — accepts input, default value sensible, persists after refresh
- [ ] **Bag Number** (`TextInput`, [line 439](../../../apps/web/src/pages/blood-bank.tsx#L439)) — accepts input, default value sensible, persists after refresh
- [ ] **Donation Type** (`Select`, [line 440](../../../apps/web/src/pages/blood-bank.tsx#L440)) — accepts input, default value sensible, persists after refresh
- [ ] **Volume (ml)** (`NumberInput`, [line 450](../../../apps/web/src/pages/blood-bank.tsx#L450)) — accepts input, default value sensible, persists after refresh
- [ ] **Camp Name** (`TextInput`, [line 451](../../../apps/web/src/pages/blood-bank.tsx#L451)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 452](../../../apps/web/src/pages/blood-bank.tsx#L452)) — accepts input, default value sensible, persists after refresh
- [ ] **Reaction Type** (`Select`, [line 492](../../../apps/web/src/pages/blood-bank.tsx#L492)) — accepts input, default value sensible, persists after refresh
- [ ] **Severity** (`Select`, [line 506](../../../apps/web/src/pages/blood-bank.tsx#L506)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 517](../../../apps/web/src/pages/blood-bank.tsx#L517)) — accepts input, default value sensible, persists after refresh
- [ ] **Treatment Given** (`Textarea`, [line 525](../../../apps/web/src/pages/blood-bank.tsx#L525)) — accepts input, default value sensible, persists after refresh
- [ ] **Outcome** (`Select`, [line 533](../../../apps/web/src/pages/blood-bank.tsx#L533)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 689>** (`Select`, [line 689](../../../apps/web/src/pages/blood-bank.tsx#L689)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 690>** (`Select`, [line 690](../../../apps/web/src/pages/blood-bank.tsx#L690)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 691>** (`Select`, [line 691](../../../apps/web/src/pages/blood-bank.tsx#L691)) — accepts input, default value sensible, persists after refresh
- [ ] **Donation ID** (`TextInput`, [line 791](../../../apps/web/src/pages/blood-bank.tsx#L791)) — accepts input, default value sensible, persists after refresh
- [ ] **Component Type** (`Select`, [line 792](../../../apps/web/src/pages/blood-bank.tsx#L792)) — accepts input, default value sensible, persists after refresh
- [ ] **Bag Number** (`TextInput`, [line 800](../../../apps/web/src/pages/blood-bank.tsx#L800)) — accepts input, default value sensible, persists after refresh
- [ ] **Blood Group** (`Select`, [line 801](../../../apps/web/src/pages/blood-bank.tsx#L801)) — accepts input, default value sensible, persists after refresh
- [ ] **Volume (ml)** (`NumberInput`, [line 802](../../../apps/web/src/pages/blood-bank.tsx#L802)) — accepts input, default value sensible, persists after refresh
- [ ] **Expiry Date** (`TextInput`, [line 803](../../../apps/web/src/pages/blood-bank.tsx#L803)) — accepts input, default value sensible, persists after refresh
- [ ] **Storage Location** (`TextInput`, [line 804](../../../apps/web/src/pages/blood-bank.tsx#L804)) — accepts input, default value sensible, persists after refresh
- [ ] **Discard Reason** (`Select`, [line 850](../../../apps/web/src/pages/blood-bank.tsx#L850)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 865](../../../apps/web/src/pages/blood-bank.tsx#L865)) — accepts input, default value sensible, persists after refresh
- [ ] **Blood Group** (`Select`, [line 985](../../../apps/web/src/pages/blood-bank.tsx#L985)) — accepts input, default value sensible, persists after refresh
- [ ] **Component Type** (`Select`, [line 986](../../../apps/web/src/pages/blood-bank.tsx#L986)) — accepts input, default value sensible, persists after refresh
- [ ] **Units Requested** (`NumberInput`, [line 992](../../../apps/web/src/pages/blood-bank.tsx#L992)) — accepts input, default value sensible, persists after refresh
- [ ] **Clinical Indication** (`Textarea`, [line 993](../../../apps/web/src/pages/blood-bank.tsx#L993)) — accepts input, default value sensible, persists after refresh
- [ ] **Component ID** (`TextInput`, [line 1108](../../../apps/web/src/pages/blood-bank.tsx#L1108)) — accepts input, default value sensible, persists after refresh
- [ ] **Crossmatch ID** (`TextInput`, [line 1109](../../../apps/web/src/pages/blood-bank.tsx#L1109)) — accepts input, default value sensible, persists after refresh
- [ ] **Reaction Type** (`Select`, [line 1134](../../../apps/web/src/pages/blood-bank.tsx#L1134)) — accepts input, default value sensible, persists after refresh
- [ ] **Severity** (`Select`, [line 1135](../../../apps/web/src/pages/blood-bank.tsx#L1135)) — accepts input, default value sensible, persists after refresh
- [ ] **Details** (`Textarea`, [line 1141](../../../apps/web/src/pages/blood-bank.tsx#L1141)) — accepts input, default value sensible, persists after refresh
- [ ] **Component ID** (`TextInput`, [line 1368](../../../apps/web/src/pages/blood-bank.tsx#L1368)) — accepts input, default value sensible, persists after refresh
- [ ] **Return Reason** (`Textarea`, [line 1369](../../../apps/web/src/pages/blood-bank.tsx#L1369)) — accepts input, default value sensible, persists after refresh
- [ ] **Temperature at Return** (`NumberInput`, [line 1370](../../../apps/web/src/pages/blood-bank.tsx#L1370)) — accepts input, default value sensible, persists after refresh
- [ ] **Time Out (minutes)** (`NumberInput`, [line 1371](../../../apps/web/src/pages/blood-bank.tsx#L1371)) — accepts input, default value sensible, persists after refresh
- [ ] **Procedure Name** (`TextInput`, [line 1409](../../../apps/web/src/pages/blood-bank.tsx#L1409)) — accepts input, default value sensible, persists after refresh
- [ ] **Procedure Code** (`TextInput`, [line 1410](../../../apps/web/src/pages/blood-bank.tsx#L1410)) — accepts input, default value sensible, persists after refresh
- [ ] **Blood Group** (`Select`, [line 1411](../../../apps/web/src/pages/blood-bank.tsx#L1411)) — accepts input, default value sensible, persists after refresh
- [ ] **Component Type** (`Select`, [line 1412](../../../apps/web/src/pages/blood-bank.tsx#L1412)) — accepts input, default value sensible, persists after refresh
- [ ] **Max Units** (`NumberInput`, [line 1418](../../../apps/web/src/pages/blood-bank.tsx#L1418)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1419](../../../apps/web/src/pages/blood-bank.tsx#L1419)) — accepts input, default value sensible, persists after refresh
- [ ] **Device Name** (`TextInput`, [line 1559](../../../apps/web/src/pages/blood-bank.tsx#L1559)) — accepts input, default value sensible, persists after refresh
- [ ] **Serial Number** (`TextInput`, [line 1560](../../../apps/web/src/pages/blood-bank.tsx#L1560)) — accepts input, default value sensible, persists after refresh
- [ ] **Location** (`TextInput`, [line 1561](../../../apps/web/src/pages/blood-bank.tsx#L1561)) — accepts input, default value sensible, persists after refresh
- [ ] **Equipment Type** (`Select`, [line 1562](../../../apps/web/src/pages/blood-bank.tsx#L1562)) — accepts input, default value sensible, persists after refresh
- [ ] **Min Temp (C)** (`NumberInput`, [line 1568](../../../apps/web/src/pages/blood-bank.tsx#L1568)) — accepts input, default value sensible, persists after refresh
- [ ] **Max Temp (C)** (`NumberInput`, [line 1569](../../../apps/web/src/pages/blood-bank.tsx#L1569)) — accepts input, default value sensible, persists after refresh
- [ ] **Device** (`Select`, [line 1591](../../../apps/web/src/pages/blood-bank.tsx#L1591)) — accepts input, default value sensible, persists after refresh
- [ ] **Temperature (C)** (`NumberInput`, [line 1598](../../../apps/web/src/pages/blood-bank.tsx#L1598)) — accepts input, default value sensible, persists after refresh
- [ ] **Humidity (%)** (`NumberInput`, [line 1599](../../../apps/web/src/pages/blood-bank.tsx#L1599)) — accepts input, default value sensible, persists after refresh
- [ ] **Infection Type** (`Select`, [line 1727](../../../apps/web/src/pages/blood-bank.tsx#L1727)) — accepts input, default value sensible, persists after refresh
- [ ] **Detection Date** (`TextInput`, [line 1728](../../../apps/web/src/pages/blood-bank.tsx#L1728)) — accepts input, default value sensible, persists after refresh
- [ ] **Donation ID** (`TextInput`, [line 1729](../../../apps/web/src/pages/blood-bank.tsx#L1729)) — accepts input, default value sensible, persists after refresh
- [ ] **Investigation Notes** (`Textarea`, [line 1731](../../../apps/web/src/pages/blood-bank.tsx#L1731)) — accepts input, default value sensible, persists after refresh
- [ ] **Campaign Name** (`TextInput`, [line 1873](../../../apps/web/src/pages/blood-bank.tsx#L1873)) — accepts input, default value sensible, persists after refresh
- [ ] **Campaign Type** (`Select`, [line 1874](../../../apps/web/src/pages/blood-bank.tsx#L1874)) — accepts input, default value sensible, persists after refresh
- [ ] **Target Donor Count** (`NumberInput`, [line 1880](../../../apps/web/src/pages/blood-bank.tsx#L1880)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Date** (`TextInput`, [line 1881](../../../apps/web/src/pages/blood-bank.tsx#L1881)) — accepts input, default value sensible, persists after refresh
- [ ] **End Date** (`TextInput`, [line 1882](../../../apps/web/src/pages/blood-bank.tsx#L1882)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1883](../../../apps/web/src/pages/blood-bank.tsx#L1883)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 39, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 205>** ([line 205](../../../apps/web/src/pages/blood-bank.tsx#L205)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 205>** ([line 205](../../../apps/web/src/pages/blood-bank.tsx#L205)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 255>** ([line 255](../../../apps/web/src/pages/blood-bank.tsx#L255)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 255>** ([line 255](../../../apps/web/src/pages/blood-bank.tsx#L255)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 340>** ([line 340](../../../apps/web/src/pages/blood-bank.tsx#L340)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 340>** ([line 340](../../../apps/web/src/pages/blood-bank.tsx#L340)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 381>** ([line 381](../../../apps/web/src/pages/blood-bank.tsx#L381)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 381>** ([line 381](../../../apps/web/src/pages/blood-bank.tsx#L381)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 453>** ([line 453](../../../apps/web/src/pages/blood-bank.tsx#L453)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 453>** ([line 453](../../../apps/web/src/pages/blood-bank.tsx#L453)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 544>** ([line 544](../../../apps/web/src/pages/blood-bank.tsx#L544)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 544>** ([line 544](../../../apps/web/src/pages/blood-bank.tsx#L544)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 644>** ([line 644](../../../apps/web/src/pages/blood-bank.tsx#L644)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 644>** ([line 644](../../../apps/web/src/pages/blood-bank.tsx#L644)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 649>** ([line 649](../../../apps/web/src/pages/blood-bank.tsx#L649)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 649>** ([line 649](../../../apps/web/src/pages/blood-bank.tsx#L649)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 699>** ([line 699](../../../apps/web/src/pages/blood-bank.tsx#L699)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 699>** ([line 699](../../../apps/web/src/pages/blood-bank.tsx#L699)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 805>** ([line 805](../../../apps/web/src/pages/blood-bank.tsx#L805)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 805>** ([line 805](../../../apps/web/src/pages/blood-bank.tsx#L805)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 872>** ([line 872](../../../apps/web/src/pages/blood-bank.tsx#L872)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 872>** ([line 872](../../../apps/web/src/pages/blood-bank.tsx#L872)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 932>** ([line 932](../../../apps/web/src/pages/blood-bank.tsx#L932)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 932>** ([line 932](../../../apps/web/src/pages/blood-bank.tsx#L932)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 938>** ([line 938](../../../apps/web/src/pages/blood-bank.tsx#L938)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 938>** ([line 938](../../../apps/web/src/pages/blood-bank.tsx#L938)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 941>** ([line 941](../../../apps/web/src/pages/blood-bank.tsx#L941)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 941>** ([line 941](../../../apps/web/src/pages/blood-bank.tsx#L941)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 955>** ([line 955](../../../apps/web/src/pages/blood-bank.tsx#L955)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 955>** ([line 955](../../../apps/web/src/pages/blood-bank.tsx#L955)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 994>** ([line 994](../../../apps/web/src/pages/blood-bank.tsx#L994)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 994>** ([line 994](../../../apps/web/src/pages/blood-bank.tsx#L994)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setReactionId(t.id)}>               Report Reaction** ([line 1063](../../../apps/web/src/pages/blood-bank.tsx#L1063)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setReactionId(t.id)}>               Report Reaction** ([line 1063](../../../apps/web/src/pages/blood-bank.tsx#L1063)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1076>** ([line 1076](../../../apps/web/src/pages/blood-bank.tsx#L1076)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1076>** ([line 1076](../../../apps/web/src/pages/blood-bank.tsx#L1076)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1110>** ([line 1110](../../../apps/web/src/pages/blood-bank.tsx#L1110)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1110>** ([line 1110](../../../apps/web/src/pages/blood-bank.tsx#L1110)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1142>** ([line 1142](../../../apps/web/src/pages/blood-bank.tsx#L1142)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1142>** ([line 1142](../../../apps/web/src/pages/blood-bank.tsx#L1142)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1359>** ([line 1359](../../../apps/web/src/pages/blood-bank.tsx#L1359)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1359>** ([line 1359](../../../apps/web/src/pages/blood-bank.tsx#L1359)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1372>** ([line 1372](../../../apps/web/src/pages/blood-bank.tsx#L1372)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1372>** ([line 1372](../../../apps/web/src/pages/blood-bank.tsx#L1372)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1395>** ([line 1395](../../../apps/web/src/pages/blood-bank.tsx#L1395)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1395>** ([line 1395](../../../apps/web/src/pages/blood-bank.tsx#L1395)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1420>** ([line 1420](../../../apps/web/src/pages/blood-bank.tsx#L1420)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1420>** ([line 1420](../../../apps/web/src/pages/blood-bank.tsx#L1420)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setSelectedDevice(d)}>           Readings** ([line 1510](../../../apps/web/src/pages/blood-bank.tsx#L1510)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setSelectedDevice(d)}>           Readings** ([line 1510](../../../apps/web/src/pages/blood-bank.tsx#L1510)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1529>** ([line 1529](../../../apps/web/src/pages/blood-bank.tsx#L1529)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1529>** ([line 1529](../../../apps/web/src/pages/blood-bank.tsx#L1529)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1532>** ([line 1532](../../../apps/web/src/pages/blood-bank.tsx#L1532)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1532>** ([line 1532](../../../apps/web/src/pages/blood-bank.tsx#L1532)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1570>** ([line 1570](../../../apps/web/src/pages/blood-bank.tsx#L1570)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1570>** ([line 1570](../../../apps/web/src/pages/blood-bank.tsx#L1570)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1600>** ([line 1600](../../../apps/web/src/pages/blood-bank.tsx#L1600)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1600>** ([line 1600](../../../apps/web/src/pages/blood-bank.tsx#L1600)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1694>** ([line 1694](../../../apps/web/src/pages/blood-bank.tsx#L1694)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1694>** ([line 1694](../../../apps/web/src/pages/blood-bank.tsx#L1694)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1699>** ([line 1699](../../../apps/web/src/pages/blood-bank.tsx#L1699)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1699>** ([line 1699](../../../apps/web/src/pages/blood-bank.tsx#L1699)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1704>** ([line 1704](../../../apps/web/src/pages/blood-bank.tsx#L1704)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1704>** ([line 1704](../../../apps/web/src/pages/blood-bank.tsx#L1704)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1717>** ([line 1717](../../../apps/web/src/pages/blood-bank.tsx#L1717)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1717>** ([line 1717](../../../apps/web/src/pages/blood-bank.tsx#L1717)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1732>** ([line 1732](../../../apps/web/src/pages/blood-bank.tsx#L1732)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1732>** ([line 1732](../../../apps/web/src/pages/blood-bank.tsx#L1732)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Generate SBTC Report** ([line 1767](../../../apps/web/src/pages/blood-bank.tsx#L1767)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Generate SBTC Report** ([line 1767](../../../apps/web/src/pages/blood-bank.tsx#L1767)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1845>** ([line 1845](../../../apps/web/src/pages/blood-bank.tsx#L1845)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1845>** ([line 1845](../../../apps/web/src/pages/blood-bank.tsx#L1845)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1850>** ([line 1850](../../../apps/web/src/pages/blood-bank.tsx#L1850)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1850>** ([line 1850](../../../apps/web/src/pages/blood-bank.tsx#L1850)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1863>** ([line 1863](../../../apps/web/src/pages/blood-bank.tsx#L1863)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1863>** ([line 1863](../../../apps/web/src/pages/blood-bank.tsx#L1863)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1884>** ([line 1884](../../../apps/web/src/pages/blood-bank.tsx#L1884)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1884>** ([line 1884](../../../apps/web/src/pages/blood-bank.tsx#L1884)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 185>** ([line 185](../../../apps/web/src/pages/blood-bank.tsx#L185)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 655>** ([line 655](../../../apps/web/src/pages/blood-bank.tsx#L655)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (30)

- [ ] `api.addBbReading` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBbCampaign` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBbDevice` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBbLookback` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBbMsbos` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBbReturn` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBloodComponent` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBloodDonor` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCrossmatchRequest` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createDonation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createTransfusion` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getBbSbtcReport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getHemovigilanceReport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getTtiReport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBbCampaigns` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBbDevices` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBbLookback` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBbMsbos` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBbReadings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBloodComponents` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBloodDonors` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCrossmatchRequests` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDonations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listTransfusions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.recordTransfusionReaction` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateBbCampaign` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateBbLookback` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateComponentStatus` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateCrossmatchRequest` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateDonation` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._