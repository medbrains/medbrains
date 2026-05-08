# `cssd.tsx` walkthrough

_Source: [`apps/web/src/pages/cssd.tsx`](../../../apps/web/src/pages/cssd.tsx) (707 lines). Guard: `P.CSSD.INSTRUMENTS_LIST`. API methods: 17. useForm: 0. Tables: 7. Modals: 7._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.CSSD.INSTRUMENTS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Instruments** (`instruments`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Instruments** (`instruments`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Instruments** (`instruments`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Sterilization** (`sterilization`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Sterilization** (`sterilization`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Sterilization** (`sterilization`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Issuance** (`issuance`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Issuance** (`issuance`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Issuance** (`issuance`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Equipment** (`equipment`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Equipment** (`equipment`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Equipment** (`equipment`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### `<Table>` @ line 179
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Department** column shows correct value for at least one row
  - [ ] Header **Active** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 184
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Department** column shows correct value for at least one row
  - [ ] Header **Active** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 335
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Result** column shows correct value for at least one row
  - [ ] Header **Brand/Lot** column shows correct value for at least one row
  - [ ] Header **Time** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 398
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Result** column shows correct value for at least one row
  - [ ] Header **Brand/Lot** column shows correct value for at least one row
  - [ ] Header **Time** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 610
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **By** column shows correct value for at least one row
  - [ ] Header **Findings** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 632
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **By** column shows correct value for at least one row
  - [ ] Header **Findings** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Drawer — _Add Instrument_ @ [line 207](../../../apps/web/src/pages/cssd.tsx#L207)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Instrument Set_ @ [line 219](../../../apps/web/src/pages/cssd.tsx#L219)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Sterilization Load_ @ [line 337](../../../apps/web/src/pages/cssd.tsx#L337)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 360>_ @ [line 360](../../../apps/web/src/pages/cssd.tsx#L360)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Issue Sterile Pack_ @ [line 527](../../../apps/web/src/pages/cssd.tsx#L527)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Sterilizer_ @ [line 612](../../../apps/web/src/pages/cssd.tsx#L612)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 629>_ @ [line 629](../../../apps/web/src/pages/cssd.tsx#L629)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (32)

- [ ] **Barcode** (`TextInput`, [line 209](../../../apps/web/src/pages/cssd.tsx#L209)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 210](../../../apps/web/src/pages/cssd.tsx#L210)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 211](../../../apps/web/src/pages/cssd.tsx#L211)) — accepts input, default value sensible, persists after refresh
- [ ] **Manufacturer** (`TextInput`, [line 212](../../../apps/web/src/pages/cssd.tsx#L212)) — accepts input, default value sensible, persists after refresh
- [ ] **Max Uses (lifecycle)** (`NumberInput`, [line 213](../../../apps/web/src/pages/cssd.tsx#L213)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 214](../../../apps/web/src/pages/cssd.tsx#L214)) — accepts input, default value sensible, persists after refresh
- [ ] **Set Code** (`TextInput`, [line 221](../../../apps/web/src/pages/cssd.tsx#L221)) — accepts input, default value sensible, persists after refresh
- [ ] **Set Name** (`TextInput`, [line 222](../../../apps/web/src/pages/cssd.tsx#L222)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`TextInput`, [line 223](../../../apps/web/src/pages/cssd.tsx#L223)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 224](../../../apps/web/src/pages/cssd.tsx#L224)) — accepts input, default value sensible, persists after refresh
- [ ] **Sterilizer** (`Select`, [line 339](../../../apps/web/src/pages/cssd.tsx#L339)) — accepts input, default value sensible, persists after refresh
- [ ] **Method** (`Select`, [line 345](../../../apps/web/src/pages/cssd.tsx#L345)) — accepts input, default value sensible, persists after refresh
- [ ] **Flash Sterilization** (`Checkbox`, [line 351](../../../apps/web/src/pages/cssd.tsx#L351)) — accepts input, default value sensible, persists after refresh
- [ ] **Flash Reason** (`TextInput`, [line 353](../../../apps/web/src/pages/cssd.tsx#L353)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 355](../../../apps/web/src/pages/cssd.tsx#L355)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 423](../../../apps/web/src/pages/cssd.tsx#L423)) — accepts input, default value sensible, persists after refresh
- [ ] **Pass** (`Checkbox`, [line 429](../../../apps/web/src/pages/cssd.tsx#L429)) — accepts input, default value sensible, persists after refresh
- [ ] **Brand** (`TextInput`, [line 431](../../../apps/web/src/pages/cssd.tsx#L431)) — accepts input, default value sensible, persists after refresh
- [ ] **Lot #** (`TextInput`, [line 432](../../../apps/web/src/pages/cssd.tsx#L432)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`TextInput`, [line 529](../../../apps/web/src/pages/cssd.tsx#L529)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 531](../../../apps/web/src/pages/cssd.tsx#L531)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 614](../../../apps/web/src/pages/cssd.tsx#L614)) — accepts input, default value sensible, persists after refresh
- [ ] **Model** (`TextInput`, [line 615](../../../apps/web/src/pages/cssd.tsx#L615)) — accepts input, default value sensible, persists after refresh
- [ ] **Serial Number** (`TextInput`, [line 616](../../../apps/web/src/pages/cssd.tsx#L616)) — accepts input, default value sensible, persists after refresh
- [ ] **Method** (`Select`, [line 617](../../../apps/web/src/pages/cssd.tsx#L617)) — accepts input, default value sensible, persists after refresh
- [ ] **Chamber Size (Liters)** (`NumberInput`, [line 623](../../../apps/web/src/pages/cssd.tsx#L623)) — accepts input, default value sensible, persists after refresh
- [ ] **Location** (`TextInput`, [line 624](../../../apps/web/src/pages/cssd.tsx#L624)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 657](../../../apps/web/src/pages/cssd.tsx#L657)) — accepts input, default value sensible, persists after refresh
- [ ] **Performed By** (`TextInput`, [line 658](../../../apps/web/src/pages/cssd.tsx#L658)) — accepts input, default value sensible, persists after refresh
- [ ] **Findings** (`Textarea`, [line 659](../../../apps/web/src/pages/cssd.tsx#L659)) — accepts input, default value sensible, persists after refresh
- [ ] **Actions Taken** (`Textarea`, [line 660](../../../apps/web/src/pages/cssd.tsx#L660)) — accepts input, default value sensible, persists after refresh
- [ ] **Cost** (`NumberInput`, [line 661](../../../apps/web/src/pages/cssd.tsx#L661)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 12, `<ActionIcon>`: 6, `<Menu.Item>`: 0)

- [ ] **<button @ line 171>** ([line 171](../../../apps/web/src/pages/cssd.tsx#L171)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 171>** ([line 171](../../../apps/web/src/pages/cssd.tsx#L171)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 174>** ([line 174](../../../apps/web/src/pages/cssd.tsx#L174)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 174>** ([line 174](../../../apps/web/src/pages/cssd.tsx#L174)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createInstrMut.mutate(instrForm)}>Save** ([line 215](../../../apps/web/src/pages/cssd.tsx#L215)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createInstrMut.mutate(instrForm)}>Save** ([line 215](../../../apps/web/src/pages/cssd.tsx#L215)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createSetMut.mutate(setForm)}>Save** ([line 225](../../../apps/web/src/pages/cssd.tsx#L225)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createSetMut.mutate(setForm)}>Save** ([line 225](../../../apps/web/src/pages/cssd.tsx#L225)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 331>** ([line 331](../../../apps/web/src/pages/cssd.tsx#L331)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 331>** ([line 331](../../../apps/web/src/pages/cssd.tsx#L331)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createLoadMut.mutate(loadForm)}>Create** ([line 356](../../../apps/web/src/pages/cssd.tsx#L356)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createLoadMut.mutate(loadForm)}>Create** ([line 356](../../../apps/web/src/pages/cssd.tsx#L356)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **indicatorMut.mutate(indicatorForm)}>Record** ([line 434](../../../apps/web/src/pages/cssd.tsx#L434)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **indicatorMut.mutate(indicatorForm)}>Record** ([line 434](../../../apps/web/src/pages/cssd.tsx#L434)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 521>** ([line 521](../../../apps/web/src/pages/cssd.tsx#L521)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 521>** ([line 521](../../../apps/web/src/pages/cssd.tsx#L521)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>Issue** ([line 532](../../../apps/web/src/pages/cssd.tsx#L532)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>Issue** ([line 532](../../../apps/web/src/pages/cssd.tsx#L532)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 606>** ([line 606](../../../apps/web/src/pages/cssd.tsx#L606)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 606>** ([line 606](../../../apps/web/src/pages/cssd.tsx#L606)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>Save** ([line 625](../../../apps/web/src/pages/cssd.tsx#L625)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>Save** ([line 625](../../../apps/web/src/pages/cssd.tsx#L625)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **maintMut.mutate(maintForm)}>Log** ([line 662](../../../apps/web/src/pages/cssd.tsx#L662)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **maintMut.mutate(maintForm)}>Log** ([line 662](../../../apps/web/src/pages/cssd.tsx#L662)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 304>** ([line 304](../../../apps/web/src/pages/cssd.tsx#L304)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 310>** ([line 310](../../../apps/web/src/pages/cssd.tsx#L310)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 317>** ([line 317](../../../apps/web/src/pages/cssd.tsx#L317)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 501>** ([line 501](../../../apps/web/src/pages/cssd.tsx#L501)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 506>** ([line 506](../../../apps/web/src/pages/cssd.tsx#L506)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 594>** ([line 594](../../../apps/web/src/pages/cssd.tsx#L594)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (17)

- [ ] `api.createCssdInstrument` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCssdIssuance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCssdLoad` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCssdMaintenanceLog` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCssdSet` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCssdSterilizer` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCssdIndicators` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCssdInstruments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCssdIssuances` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCssdLoads` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCssdMaintenanceLogs` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCssdSets` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCssdSterilizers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.recallCssdIssuance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.recordCssdIndicator` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.returnCssdIssuance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateCssdLoadStatus` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._