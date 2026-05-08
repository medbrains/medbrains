# `emergency.tsx` walkthrough

_Source: [`apps/web/src/pages/emergency.tsx`](../../../apps/web/src/pages/emergency.tsx) (2016 lines). Guard: `P.EMERGENCY.VISITS_LIST`. API methods: 12. useForm: 0. Tables: 5. Modals: 11._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.EMERGENCY.VISITS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Triage Log** (`triage`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Triage Log** (`triage`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Triage Log** (`triage`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (45)
- [ ] Column **Defibrillator present and functional** (`defibrillator_present`) renders without `undefined` / `[object Object]`
- [ ] Column **Defibrillator charge test passed** (`defibrillator_charge_test`) renders without `undefined` / `[object Object]`
- [ ] Column **Airway equipment (ETT, laryngoscope, ambu bag)** (`airway_equipment`) renders without `undefined` / `[object Object]`
- [ ] Column **IV access supplies (cannulas, fluids, sets)** (`iv_access_supplies`) renders without `undefined` / `[object Object]`
- [ ] Column **Adrenaline (Epinephrine) 1mg ampoules** (`adrenaline`) renders without `undefined` / `[object Object]`
- [ ] Column **Atropine 0.6mg ampoules** (`atropine`) renders without `undefined` / `[object Object]`
- [ ] Column **Amiodarone 150mg ampoules** (`amiodarone`) renders without `undefined` / `[object Object]`
- [ ] Column **Suction equipment functional** (`suction_equipment`) renders without `undefined` / `[object Object]`
- [ ] Column **Oxygen supply connected and flowing** (`oxygen_supply`) renders without `undefined` / `[object Object]`
- [ ] Column **Cardiac monitor leads and pads** (`monitor_leads`) renders without `undefined` / `[object Object]`
- [ ] Column **Visit #** (`visit_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Arrival** (`arrival_time`) renders without `undefined` / `[object Object]`
- [ ] Column **Mode** (`arrival_mode`) renders without `undefined` / `[object Object]`
- [ ] Column **Chief Complaint** (`chief_complaint`) renders without `undefined` / `[object Object]`
- [ ] Column **Triage** (`triage_level`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **MLC** (`is_mlc`) renders without `undefined` / `[object Object]`
- [ ] Column **Bay** (`bay_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Wait Time** (`wait_time`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Activated** (`activated_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Location** (`location`) renders without `undefined` / `[object Object]`
- [ ] Column **Outcome** (`outcome`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`deactivated_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Crash Cart** (`crash_cart`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Court** (`court_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Case #** (`case_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Created** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **MLC #** (`mlc_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Registered** (`registered_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`case_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **FIR #** (`fir_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Police Station** (`police_station`) renders without `undefined` / `[object Object]`
- [ ] Column **POCSO** (`is_pocso`) renders without `undefined` / `[object Object]`
- [ ] Column **Death** (`is_death_case`) renders without `undefined` / `[object Object]`
- [ ] Column **Event** (`event_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`event_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Activated** (`activated_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Est. Casualties** (`estimated_casualties`) renders without `undefined` / `[object Object]`
- [ ] Column **Actual** (`actual_casualties`) renders without `undefined` / `[object Object]`
- [ ] Column **Location** (`location`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Modal — _<modal @ line 556>_ @ [line 556](../../../apps/web/src/pages/emergency.tsx#L556)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _Register ER Visit_ @ [line 511](../../../apps/web/src/pages/emergency.tsx#L511)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 792>_ @ [line 792](../../../apps/web/src/pages/emergency.tsx#L792)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Code Activation Details_ @ [line 829](../../../apps/web/src/pages/emergency.tsx#L829)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 1393>_ @ [line 1393](../../../apps/web/src/pages/emergency.tsx#L1393)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 1456>_ @ [line 1456](../../../apps/web/src/pages/emergency.tsx#L1456)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 1540>_ @ [line 1540](../../../apps/web/src/pages/emergency.tsx#L1540)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 1616>_ @ [line 1616](../../../apps/web/src/pages/emergency.tsx#L1616)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Register MLC Case_ @ [line 1790](../../../apps/web/src/pages/emergency.tsx#L1790)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 1871>_ @ [line 1871](../../../apps/web/src/pages/emergency.tsx#L1871)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Activate Mass Casualty Event_ @ [line 1971](../../../apps/web/src/pages/emergency.tsx#L1971)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (45)

- [ ] **<Select @ line 335>** (`Select`, [line 335](../../../apps/web/src/pages/emergency.tsx#L335)) — accepts input, default value sensible, persists after refresh
- [ ] **Arrival Mode** (`Select`, [line 519](../../../apps/web/src/pages/emergency.tsx#L519)) — accepts input, default value sensible, persists after refresh
- [ ] **Chief Complaint** (`TextInput`, [line 525](../../../apps/web/src/pages/emergency.tsx#L525)) — accepts input, default value sensible, persists after refresh
- [ ] **Bay Number** (`TextInput`, [line 530](../../../apps/web/src/pages/emergency.tsx#L530)) — accepts input, default value sensible, persists after refresh
- [ ] **MLC** (`Select`, [line 535](../../../apps/web/src/pages/emergency.tsx#L535)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 544](../../../apps/web/src/pages/emergency.tsx#L544)) — accepts input, default value sensible, persists after refresh
- [ ] **Admission Notes** (`Textarea`, [line 578](../../../apps/web/src/pages/emergency.tsx#L578)) — accepts input, default value sensible, persists after refresh
- [ ] **<Checkbox @ line 635>** (`Checkbox`, [line 635](../../../apps/web/src/pages/emergency.tsx#L635)) — accepts input, default value sensible, persists after refresh
- [ ] **Code Type** (`Select`, [line 803](../../../apps/web/src/pages/emergency.tsx#L803)) — accepts input, default value sensible, persists after refresh
- [ ] **Location** (`TextInput`, [line 810](../../../apps/web/src/pages/emergency.tsx#L810)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 815](../../../apps/web/src/pages/emergency.tsx#L815)) — accepts input, default value sensible, persists after refresh
- [ ] **Situation** (`Textarea`, [line 1408](../../../apps/web/src/pages/emergency.tsx#L1408)) — accepts input, default value sensible, persists after refresh
- [ ] **Background** (`Textarea`, [line 1416](../../../apps/web/src/pages/emergency.tsx#L1416)) — accepts input, default value sensible, persists after refresh
- [ ] **Assessment** (`Textarea`, [line 1424](../../../apps/web/src/pages/emergency.tsx#L1424)) — accepts input, default value sensible, persists after refresh
- [ ] **Recommendation** (`Textarea`, [line 1432](../../../apps/web/src/pages/emergency.tsx#L1432)) — accepts input, default value sensible, persists after refresh
- [ ] **Ossification Center Findings** (`Textarea`, [line 1471](../../../apps/web/src/pages/emergency.tsx#L1471)) — accepts input, default value sensible, persists after refresh
- [ ] **Dental Examination** (`Textarea`, [line 1481](../../../apps/web/src/pages/emergency.tsx#L1481)) — accepts input, default value sensible, persists after refresh
- [ ] **Secondary Sexual Characteristics** (`Textarea`, [line 1491](../../../apps/web/src/pages/emergency.tsx#L1491)) — accepts input, default value sensible, persists after refresh
- [ ] **Estimated Age Range** (`TextInput`, [line 1504](../../../apps/web/src/pages/emergency.tsx#L1504)) — accepts input, default value sensible, persists after refresh
- [ ] **Examiner Opinion** (`Textarea`, [line 1513](../../../apps/web/src/pages/emergency.tsx#L1513)) — accepts input, default value sensible, persists after refresh
- [ ] **Child Age** (`TextInput`, [line 1555](../../../apps/web/src/pages/emergency.tsx#L1555)) — accepts input, default value sensible, persists after refresh
- [ ] **Guardian Details** (`Textarea`, [line 1562](../../../apps/web/src/pages/emergency.tsx#L1562)) — accepts input, default value sensible, persists after refresh
- [ ] **Statement Summary** (`Textarea`, [line 1572](../../../apps/web/src/pages/emergency.tsx#L1572)) — accepts input, default value sensible, persists after refresh
- [ ] **Injuries Documented** (`Textarea`, [line 1582](../../../apps/web/src/pages/emergency.tsx#L1582)) — accepts input, default value sensible, persists after refresh
- [ ] **Psychological assessment needed** (`Checkbox`, [line 1592](../../../apps/web/src/pages/emergency.tsx#L1592)) — accepts input, default value sensible, persists after refresh
- [ ] **Date** (`TextInput`, [line 1627](../../../apps/web/src/pages/emergency.tsx#L1627)) — accepts input, default value sensible, persists after refresh
- [ ] **Court Name** (`TextInput`, [line 1634](../../../apps/web/src/pages/emergency.tsx#L1634)) — accepts input, default value sensible, persists after refresh
- [ ] **Case Number** (`TextInput`, [line 1640](../../../apps/web/src/pages/emergency.tsx#L1640)) — accepts input, default value sensible, persists after refresh
- [ ] **Status** (`Select`, [line 1646](../../../apps/web/src/pages/emergency.tsx#L1646)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1657](../../../apps/web/src/pages/emergency.tsx#L1657)) — accepts input, default value sensible, persists after refresh
- [ ] **Case Type** (`Select`, [line 1798](../../../apps/web/src/pages/emergency.tsx#L1798)) — accepts input, default value sensible, persists after refresh
- [ ] **FIR Number** (`TextInput`, [line 1804](../../../apps/web/src/pages/emergency.tsx#L1804)) — accepts input, default value sensible, persists after refresh
- [ ] **Police Station** (`TextInput`, [line 1809](../../../apps/web/src/pages/emergency.tsx#L1809)) — accepts input, default value sensible, persists after refresh
- [ ] **Brought By** (`Select`, [line 1814](../../../apps/web/src/pages/emergency.tsx#L1814)) — accepts input, default value sensible, persists after refresh
- [ ] **Informant Name** (`TextInput`, [line 1825](../../../apps/web/src/pages/emergency.tsx#L1825)) — accepts input, default value sensible, persists after refresh
- [ ] **Informant Relation** (`TextInput`, [line 1830](../../../apps/web/src/pages/emergency.tsx#L1830)) — accepts input, default value sensible, persists after refresh
- [ ] **Informant Contact** (`TextInput`, [line 1835](../../../apps/web/src/pages/emergency.tsx#L1835)) — accepts input, default value sensible, persists after refresh
- [ ] **History of Incident** (`Textarea`, [line 1840](../../../apps/web/src/pages/emergency.tsx#L1840)) — accepts input, default value sensible, persists after refresh
- [ ] **POCSO Case** (`Select`, [line 1846](../../../apps/web/src/pages/emergency.tsx#L1846)) — accepts input, default value sensible, persists after refresh
- [ ] **Death Case** (`Select`, [line 1855](../../../apps/web/src/pages/emergency.tsx#L1855)) — accepts input, default value sensible, persists after refresh
- [ ] **Event Name** (`TextInput`, [line 1979](../../../apps/web/src/pages/emergency.tsx#L1979)) — accepts input, default value sensible, persists after refresh
- [ ] **Event Type** (`Select`, [line 1985](../../../apps/web/src/pages/emergency.tsx#L1985)) — accepts input, default value sensible, persists after refresh
- [ ] **Location** (`TextInput`, [line 1991](../../../apps/web/src/pages/emergency.tsx#L1991)) — accepts input, default value sensible, persists after refresh
- [ ] **Estimated Casualties** (`NumberInput`, [line 1996](../../../apps/web/src/pages/emergency.tsx#L1996)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 2003](../../../apps/web/src/pages/emergency.tsx#L2003)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 18, `<ActionIcon>`: 3, `<Menu.Item>`: 0)

- [ ] **<button @ line 485>** ([line 485](../../../apps/web/src/pages/emergency.tsx#L485)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 485>** ([line 485](../../../apps/web/src/pages/emergency.tsx#L485)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 504>** ([line 504](../../../apps/web/src/pages/emergency.tsx#L504)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 504>** ([line 504](../../../apps/web/src/pages/emergency.tsx#L504)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 549>** ([line 549](../../../apps/web/src/pages/emergency.tsx#L549)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 549>** ([line 549](../../../apps/web/src/pages/emergency.tsx#L549)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 585>** ([line 585](../../../apps/web/src/pages/emergency.tsx#L585)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 585>** ([line 585](../../../apps/web/src/pages/emergency.tsx#L585)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 784>** ([line 784](../../../apps/web/src/pages/emergency.tsx#L784)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 784>** ([line 784](../../../apps/web/src/pages/emergency.tsx#L784)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Activate Code** ([line 822](../../../apps/web/src/pages/emergency.tsx#L822)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Activate Code** ([line 822](../../../apps/web/src/pages/emergency.tsx#L822)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1138>** ([line 1138](../../../apps/web/src/pages/emergency.tsx#L1138)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1138>** ([line 1138](../../../apps/web/src/pages/emergency.tsx#L1138)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1141>** ([line 1141](../../../apps/web/src/pages/emergency.tsx#L1141)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1141>** ([line 1141](../../../apps/web/src/pages/emergency.tsx#L1141)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1150>** ([line 1150](../../../apps/web/src/pages/emergency.tsx#L1150)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1150>** ([line 1150](../../../apps/web/src/pages/emergency.tsx#L1150)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1159>** ([line 1159](../../../apps/web/src/pages/emergency.tsx#L1159)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1159>** ([line 1159](../../../apps/web/src/pages/emergency.tsx#L1159)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1440>** ([line 1440](../../../apps/web/src/pages/emergency.tsx#L1440)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1440>** ([line 1440](../../../apps/web/src/pages/emergency.tsx#L1440)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1523>** ([line 1523](../../../apps/web/src/pages/emergency.tsx#L1523)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1523>** ([line 1523](../../../apps/web/src/pages/emergency.tsx#L1523)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1599>** ([line 1599](../../../apps/web/src/pages/emergency.tsx#L1599)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1599>** ([line 1599](../../../apps/web/src/pages/emergency.tsx#L1599)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Save Court Summons** ([line 1662](../../../apps/web/src/pages/emergency.tsx#L1662)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Save Court Summons** ([line 1662](../../../apps/web/src/pages/emergency.tsx#L1662)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1782>** ([line 1782](../../../apps/web/src/pages/emergency.tsx#L1782)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1782>** ([line 1782](../../../apps/web/src/pages/emergency.tsx#L1782)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1864>** ([line 1864](../../../apps/web/src/pages/emergency.tsx#L1864)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1864>** ([line 1864](../../../apps/web/src/pages/emergency.tsx#L1864)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1964>** ([line 1964](../../../apps/web/src/pages/emergency.tsx#L1964)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1964>** ([line 1964](../../../apps/web/src/pages/emergency.tsx#L1964)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2008>** ([line 2008](../../../apps/web/src/pages/emergency.tsx#L2008)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2008>** ([line 2008](../../../apps/web/src/pages/emergency.tsx#L2008)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 758>** ([line 758](../../../apps/web/src/pages/emergency.tsx#L758)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 764>** ([line 764](../../../apps/web/src/pages/emergency.tsx#L764)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1770>** ([line 1770](../../../apps/web/src/pages/emergency.tsx#L1770)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (12)

- [ ] `api.admitFromEr` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCodeActivation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createErVisit` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createMassCasualtyEvent` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createMlcCase` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createMlcDocument` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deactivateCode` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCodeActivations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listErVisits` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMassCasualtyEvents` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMlcCases` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMlcDocuments` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._