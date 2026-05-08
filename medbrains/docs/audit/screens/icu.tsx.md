# `icu.tsx` walkthrough

_Source: [`apps/web/src/pages/icu.tsx`](../../../apps/web/src/pages/icu.tsx) (1283 lines). Guard: `P.ICU.FLOWSHEETS_LIST`. API methods: 17. useForm: 0. Tables: 9. Modals: 7._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.ICU.FLOWSHEETS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Flowsheets** (`flowsheets`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Flowsheets** (`flowsheets`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Flowsheets** (`flowsheets`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Ventilator** (`ventilator`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Ventilator** (`ventilator`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Ventilator** (`ventilator`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Scores** (`scores`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Scores** (`scores`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Scores** (`scores`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Devices** (`devices`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Devices** (`devices`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Devices** (`devices`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Nutrition** (`nutrition`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Nutrition** (`nutrition`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Nutrition** (`nutrition`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>NICU** (`nicu`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>NICU** (`nicu`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>NICU** (`nicu`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Analytics** (`analytics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Analytics** (`analytics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Analytics** (`analytics`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### `<Table>` @ line 236
  - [ ] Header **Drug** column shows correct value for at least one row
  - [ ] Header **Rate (mL/hr)** column shows correct value for at least one row
  - [ ] Header **Concentration** column shows correct value for at least one row
  - [ ] Header **Start Time** column shows correct value for at least one row
  - [ ] Header **Duration (hrs)** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 761
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Compliant** column shows correct value for at least one row
  - [ ] Header **Still Needed** column shows correct value for at least one row
  - [ ] Header **Notes** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 783
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Compliant** column shows correct value for at least one row
  - [ ] Header **Still Needed** column shows correct value for at least one row
  - [ ] Header **Notes** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Drawer — _Record ICU Vitals_ @ [line 371](../../../apps/web/src/pages/icu.tsx#L371)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Ventilator Settings_ @ [line 455](../../../apps/web/src/pages/icu.tsx#L455)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record ICU Score_ @ [line 650](../../../apps/web/src/pages/icu.tsx#L650)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Track New Device_ @ [line 766](../../../apps/web/src/pages/icu.tsx#L766)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 780>_ @ [line 780](../../../apps/web/src/pages/icu.tsx#L780)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Nutrition_ @ [line 869](../../../apps/web/src/pages/icu.tsx#L869)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Neonatal Data_ @ [line 1133](../../../apps/web/src/pages/icu.tsx#L1133)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (61)

- [ ] **Admission ID** (`TextInput`, [line 77](../../../apps/web/src/pages/icu.tsx#L77)) — accepts input, default value sensible, persists after refresh
- [ ] **Drug Name** (`TextInput`, [line 266](../../../apps/web/src/pages/icu.tsx#L266)) — accepts input, default value sensible, persists after refresh
- [ ] **Rate (mL/hr)** (`NumberInput`, [line 272](../../../apps/web/src/pages/icu.tsx#L272)) — accepts input, default value sensible, persists after refresh
- [ ] **Concentration** (`TextInput`, [line 280](../../../apps/web/src/pages/icu.tsx#L280)) — accepts input, default value sensible, persists after refresh
- [ ] **Duration (hours)** (`NumberInput`, [line 286](../../../apps/web/src/pages/icu.tsx#L286)) — accepts input, default value sensible, persists after refresh
- [ ] **Heart Rate** (`NumberInput`, [line 374](../../../apps/web/src/pages/icu.tsx#L374)) — accepts input, default value sensible, persists after refresh
- [ ] **SpO2 %** (`NumberInput`, [line 375](../../../apps/web/src/pages/icu.tsx#L375)) — accepts input, default value sensible, persists after refresh
- [ ] **Systolic BP** (`NumberInput`, [line 378](../../../apps/web/src/pages/icu.tsx#L378)) — accepts input, default value sensible, persists after refresh
- [ ] **Diastolic BP** (`NumberInput`, [line 379](../../../apps/web/src/pages/icu.tsx#L379)) — accepts input, default value sensible, persists after refresh
- [ ] **Resp Rate** (`NumberInput`, [line 382](../../../apps/web/src/pages/icu.tsx#L382)) — accepts input, default value sensible, persists after refresh
- [ ] **Temp °C** (`NumberInput`, [line 383](../../../apps/web/src/pages/icu.tsx#L383)) — accepts input, default value sensible, persists after refresh
- [ ] **CVP** (`NumberInput`, [line 386](../../../apps/web/src/pages/icu.tsx#L386)) — accepts input, default value sensible, persists after refresh
- [ ] **MAP** (`NumberInput`, [line 387](../../../apps/web/src/pages/icu.tsx#L387)) — accepts input, default value sensible, persists after refresh
- [ ] **Intake mL** (`NumberInput`, [line 390](../../../apps/web/src/pages/icu.tsx#L390)) — accepts input, default value sensible, persists after refresh
- [ ] **Output mL** (`NumberInput`, [line 391](../../../apps/web/src/pages/icu.tsx#L391)) — accepts input, default value sensible, persists after refresh
- [ ] **Urine mL** (`NumberInput`, [line 394](../../../apps/web/src/pages/icu.tsx#L394)) — accepts input, default value sensible, persists after refresh
- [ ] **Drain mL** (`NumberInput`, [line 395](../../../apps/web/src/pages/icu.tsx#L395)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 397](../../../apps/web/src/pages/icu.tsx#L397)) — accepts input, default value sensible, persists after refresh
- [ ] **Mode** (`Select`, [line 457](../../../apps/web/src/pages/icu.tsx#L457)) — accepts input, default value sensible, persists after refresh
- [ ] **FiO2 %** (`NumberInput`, [line 464](../../../apps/web/src/pages/icu.tsx#L464)) — accepts input, default value sensible, persists after refresh
- [ ] **PEEP** (`NumberInput`, [line 465](../../../apps/web/src/pages/icu.tsx#L465)) — accepts input, default value sensible, persists after refresh
- [ ] **Tidal Volume mL** (`NumberInput`, [line 468](../../../apps/web/src/pages/icu.tsx#L468)) — accepts input, default value sensible, persists after refresh
- [ ] **Resp Rate** (`NumberInput`, [line 469](../../../apps/web/src/pages/icu.tsx#L469)) — accepts input, default value sensible, persists after refresh
- [ ] **PIP** (`NumberInput`, [line 472](../../../apps/web/src/pages/icu.tsx#L472)) — accepts input, default value sensible, persists after refresh
- [ ] **Plateau** (`NumberInput`, [line 473](../../../apps/web/src/pages/icu.tsx#L473)) — accepts input, default value sensible, persists after refresh
- [ ] **pH** (`NumberInput`, [line 477](../../../apps/web/src/pages/icu.tsx#L477)) — accepts input, default value sensible, persists after refresh
- [ ] **PaO2** (`NumberInput`, [line 478](../../../apps/web/src/pages/icu.tsx#L478)) — accepts input, default value sensible, persists after refresh
- [ ] **PaCO2** (`NumberInput`, [line 481](../../../apps/web/src/pages/icu.tsx#L481)) — accepts input, default value sensible, persists after refresh
- [ ] **HCO3** (`NumberInput`, [line 482](../../../apps/web/src/pages/icu.tsx#L482)) — accepts input, default value sensible, persists after refresh
- [ ] **SaO2** (`NumberInput`, [line 485](../../../apps/web/src/pages/icu.tsx#L485)) — accepts input, default value sensible, persists after refresh
- [ ] **Lactate** (`NumberInput`, [line 486](../../../apps/web/src/pages/icu.tsx#L486)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 488](../../../apps/web/src/pages/icu.tsx#L488)) — accepts input, default value sensible, persists after refresh
- [ ] **Score Type** (`Select`, [line 652](../../../apps/web/src/pages/icu.tsx#L652)) — accepts input, default value sensible, persists after refresh
- [ ] **Score Value** (`NumberInput`, [line 658](../../../apps/web/src/pages/icu.tsx#L658)) — accepts input, default value sensible, persists after refresh
- [ ] **Predicted Mortality %** (`NumberInput`, [line 659](../../../apps/web/src/pages/icu.tsx#L659)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 660](../../../apps/web/src/pages/icu.tsx#L660)) — accepts input, default value sensible, persists after refresh
- [ ] **Device Type** (`Select`, [line 768](../../../apps/web/src/pages/icu.tsx#L768)) — accepts input, default value sensible, persists after refresh
- [ ] **Insertion Site** (`TextInput`, [line 774](../../../apps/web/src/pages/icu.tsx#L774)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 775](../../../apps/web/src/pages/icu.tsx#L775)) — accepts input, default value sensible, persists after refresh
- [ ] **Compliant** (`Checkbox`, [line 808](../../../apps/web/src/pages/icu.tsx#L808)) — accepts input, default value sensible, persists after refresh
- [ ] **Device Still Needed** (`Checkbox`, [line 809](../../../apps/web/src/pages/icu.tsx#L809)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 810](../../../apps/web/src/pages/icu.tsx#L810)) — accepts input, default value sensible, persists after refresh
- [ ] **Route** (`Select`, [line 871](../../../apps/web/src/pages/icu.tsx#L871)) — accepts input, default value sensible, persists after refresh
- [ ] **Formula Name** (`TextInput`, [line 877](../../../apps/web/src/pages/icu.tsx#L877)) — accepts input, default value sensible, persists after refresh
- [ ] **Rate mL/hr** (`NumberInput`, [line 879](../../../apps/web/src/pages/icu.tsx#L879)) — accepts input, default value sensible, persists after refresh
- [ ] **Volume mL** (`NumberInput`, [line 880](../../../apps/web/src/pages/icu.tsx#L880)) — accepts input, default value sensible, persists after refresh
- [ ] **Calories kcal** (`NumberInput`, [line 883](../../../apps/web/src/pages/icu.tsx#L883)) — accepts input, default value sensible, persists after refresh
- [ ] **Protein g** (`NumberInput`, [line 884](../../../apps/web/src/pages/icu.tsx#L884)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 886](../../../apps/web/src/pages/icu.tsx#L886)) — accepts input, default value sensible, persists after refresh
- [ ] **Gestational Age (weeks)** (`NumberInput`, [line 1136](../../../apps/web/src/pages/icu.tsx#L1136)) — accepts input, default value sensible, persists after refresh
- [ ] **Birth Weight (g)** (`NumberInput`, [line 1137](../../../apps/web/src/pages/icu.tsx#L1137)) — accepts input, default value sensible, persists after refresh
- [ ] **Current Weight (g)** (`NumberInput`, [line 1139](../../../apps/web/src/pages/icu.tsx#L1139)) — accepts input, default value sensible, persists after refresh
- [ ] **Bilirubin Total** (`NumberInput`, [line 1141](../../../apps/web/src/pages/icu.tsx#L1141)) — accepts input, default value sensible, persists after refresh
- [ ] **Bilirubin Direct** (`NumberInput`, [line 1142](../../../apps/web/src/pages/icu.tsx#L1142)) — accepts input, default value sensible, persists after refresh
- [ ] **Phototherapy Active** (`Checkbox`, [line 1144](../../../apps/web/src/pages/icu.tsx#L1144)) — accepts input, default value sensible, persists after refresh
- [ ] **Phototherapy Hours** (`NumberInput`, [line 1146](../../../apps/web/src/pages/icu.tsx#L1146)) — accepts input, default value sensible, persists after refresh
- [ ] **Breast Milk Type** (`TextInput`, [line 1149](../../../apps/web/src/pages/icu.tsx#L1149)) — accepts input, default value sensible, persists after refresh
- [ ] **Breast Milk Volume mL** (`NumberInput`, [line 1150](../../../apps/web/src/pages/icu.tsx#L1150)) — accepts input, default value sensible, persists after refresh
- [ ] **Hearing Screen** (`TextInput`, [line 1153](../../../apps/web/src/pages/icu.tsx#L1153)) — accepts input, default value sensible, persists after refresh
- [ ] **Sepsis Screen** (`TextInput`, [line 1154](../../../apps/web/src/pages/icu.tsx#L1154)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1157](../../../apps/web/src/pages/icu.tsx#L1157)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 16, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 229>** ([line 229](../../../apps/web/src/pages/icu.tsx#L229)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 229>** ([line 229](../../../apps/web/src/pages/icu.tsx#L229)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 294>** ([line 294](../../../apps/web/src/pages/icu.tsx#L294)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 294>** ([line 294](../../../apps/web/src/pages/icu.tsx#L294)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 297>** ([line 297](../../../apps/web/src/pages/icu.tsx#L297)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 297>** ([line 297](../../../apps/web/src/pages/icu.tsx#L297)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 347>** ([line 347](../../../apps/web/src/pages/icu.tsx#L347)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 347>** ([line 347](../../../apps/web/src/pages/icu.tsx#L347)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>Save** ([line 398](../../../apps/web/src/pages/icu.tsx#L398)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>Save** ([line 398](../../../apps/web/src/pages/icu.tsx#L398)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 445>** ([line 445](../../../apps/web/src/pages/icu.tsx#L445)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 445>** ([line 445](../../../apps/web/src/pages/icu.tsx#L445)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>Save** ([line 489](../../../apps/web/src/pages/icu.tsx#L489)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>Save** ([line 489](../../../apps/web/src/pages/icu.tsx#L489)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 637>** ([line 637](../../../apps/web/src/pages/icu.tsx#L637)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 637>** ([line 637](../../../apps/web/src/pages/icu.tsx#L637)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>Save** ([line 661](../../../apps/web/src/pages/icu.tsx#L661)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>Save** ([line 661](../../../apps/web/src/pages/icu.tsx#L661)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 756>** ([line 756](../../../apps/web/src/pages/icu.tsx#L756)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 756>** ([line 756](../../../apps/web/src/pages/icu.tsx#L756)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>Save** ([line 776](../../../apps/web/src/pages/icu.tsx#L776)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>Save** ([line 776](../../../apps/web/src/pages/icu.tsx#L776)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **bundleMut.mutate(bundleForm)}>Save Check** ([line 811](../../../apps/web/src/pages/icu.tsx#L811)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **bundleMut.mutate(bundleForm)}>Save Check** ([line 811](../../../apps/web/src/pages/icu.tsx#L811)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 859>** ([line 859](../../../apps/web/src/pages/icu.tsx#L859)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 859>** ([line 859](../../../apps/web/src/pages/icu.tsx#L859)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>Save** ([line 887](../../../apps/web/src/pages/icu.tsx#L887)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>Save** ([line 887](../../../apps/web/src/pages/icu.tsx#L887)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1118>** ([line 1118](../../../apps/web/src/pages/icu.tsx#L1118)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1118>** ([line 1118](../../../apps/web/src/pages/icu.tsx#L1118)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>Save** ([line 1158](../../../apps/web/src/pages/icu.tsx#L1158)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>Save** ([line 1158](../../../apps/web/src/pages/icu.tsx#L1158)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 736>** ([line 736](../../../apps/web/src/pages/icu.tsx#L736)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 742>** ([line 742](../../../apps/web/src/pages/icu.tsx#L742)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (17)

- [ ] `api.createIcuBundleCheck` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createIcuDevice` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createIcuFlowsheet` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createIcuNeonatalRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createIcuNutrition` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createIcuScore` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createIcuVentilatorRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getIcuDeviceInfectionRates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getIcuLosAnalytics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIcuBundleChecks` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIcuDevices` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIcuFlowsheets` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIcuNeonatalRecords` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIcuNutrition` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIcuScores` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIcuVentilatorRecords` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.removeIcuDevice` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._