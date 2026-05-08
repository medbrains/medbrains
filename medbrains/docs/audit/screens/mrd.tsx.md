# `mrd.tsx` walkthrough

_Source: [`apps/web/src/pages/mrd.tsx`](../../../apps/web/src/pages/mrd.tsx) (1074 lines). Guard: `P.MRD.RECORDS_LIST`. API methods: 13. useForm: 0. Tables: 8. Modals: 6._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.MRD.RECORDS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Records** (`records`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Records** (`records`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Records** (`records`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Birth Register** (`births`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Birth Register** (`births`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Birth Register** (`births`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Death Register** (`deaths`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Death Register** (`deaths`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Death Register** (`deaths`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Statistics** (`stats`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Statistics** (`stats`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Statistics** (`stats`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Retention Policies** (`retention`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Retention Policies** (`retention`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Retention Policies** (`retention`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (42)
- [ ] Column **Record #** (`record_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`record_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Vol** (`volume_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Shelf** (`shelf_location`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Last Accessed** (`last_accessed_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Issued** (`issued_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Due** (`due_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Returned** (`returned_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Purpose** (`purpose`) renders without `undefined` / `[object Object]`
- [ ] Column **Reg #** (`register_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`birth_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Gender** (`baby_gender`) renders without `undefined` / `[object Object]`
- [ ] Column **Weight (g)** (`baby_weight_grams`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`birth_type`) renders without `undefined` / `[object Object]`
- [ ] Column **APGAR** (`apgar`) renders without `undefined` / `[object Object]`
- [ ] Column **Certificate** (`cert`) renders without `undefined` / `[object Object]`
- [ ] Column **Reg #** (`register_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`death_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Cause** (`cause_of_death`) renders without `undefined` / `[object Object]`
- [ ] Column **Manner** (`manner_of_death`) renders without `undefined` / `[object Object]`
- [ ] Column **MLC** (`is_medico_legal`) renders without `undefined` / `[object Object]`
- [ ] Column **Certificate** (`cert`) renders without `undefined` / `[object Object]`
- [ ] Column **Reported** (`municipality`) renders without `undefined` / `[object Object]`
- [ ] Column **ICD Code** (`icd_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Diagnosis** (`diagnosis_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Cases** (`count`) renders without `undefined` / `[object Object]`
- [ ] Column **Cause** (`cause_of_death`) renders without `undefined` / `[object Object]`
- [ ] Column **Manner** (`manner_of_death`) renders without `undefined` / `[object Object]`
- [ ] Column **Deaths** (`count`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Admitted** (`total_admitted`) renders without `undefined` / `[object Object]`
- [ ] Column **Discharged** (`total_discharged`) renders without `undefined` / `[object Object]`
- [ ] Column **Deaths** (`total_deaths`) renders without `undefined` / `[object Object]`
- [ ] Column **Avg LOS** (`avg_los_days`) renders without `undefined` / `[object Object]`
- [ ] Column **Record Type** (`record_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Years** (`retention_years`) renders without `undefined` / `[object Object]`
- [ ] Column **Legal Ref** (`legal_reference`) renders without `undefined` / `[object Object]`
- [ ] Column **Destruction** (`destruction_method`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _Index Medical Record_ @ [line 294](../../../apps/web/src/pages/mrd.tsx#L294)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 356>_ @ [line 356](../../../apps/web/src/pages/mrd.tsx#L356)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 393>_ @ [line 393](../../../apps/web/src/pages/mrd.tsx#L393)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Register Birth_ @ [line 529](../../../apps/web/src/pages/mrd.tsx#L529)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Register Death_ @ [line 693](../../../apps/web/src/pages/mrd.tsx#L693)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Retention Policy_ @ [line 1025](../../../apps/web/src/pages/mrd.tsx#L1025)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (33)

- [ ] **<Select @ line 271>** (`Select`, [line 271](../../../apps/web/src/pages/mrd.tsx#L271)) — accepts input, default value sensible, persists after refresh
- [ ] **Record Type** (`Select`, [line 308](../../../apps/web/src/pages/mrd.tsx#L308)) — accepts input, default value sensible, persists after refresh
- [ ] **Volume** (`NumberInput`, [line 314](../../../apps/web/src/pages/mrd.tsx#L314)) — accepts input, default value sensible, persists after refresh
- [ ] **Shelf Location** (`Select`, [line 320](../../../apps/web/src/pages/mrd.tsx#L320)) — accepts input, default value sensible, persists after refresh
- [ ] **Filing Method** (`Select`, [line 329](../../../apps/web/src/pages/mrd.tsx#L329)) — accepts input, default value sensible, persists after refresh
- [ ] **Total Pages** (`NumberInput`, [line 337](../../../apps/web/src/pages/mrd.tsx#L337)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 344](../../../apps/web/src/pages/mrd.tsx#L344)) — accepts input, default value sensible, persists after refresh
- [ ] **Purpose** (`TextInput`, [line 375](../../../apps/web/src/pages/mrd.tsx#L375)) — accepts input, default value sensible, persists after refresh
- [ ] **Due in (days)** (`NumberInput`, [line 380](../../../apps/web/src/pages/mrd.tsx#L380)) — accepts input, default value sensible, persists after refresh
- [ ] **Birth Date** (`TextInput`, [line 544](../../../apps/web/src/pages/mrd.tsx#L544)) — accepts input, default value sensible, persists after refresh
- [ ] **Baby Gender** (`Select`, [line 551](../../../apps/web/src/pages/mrd.tsx#L551)) — accepts input, default value sensible, persists after refresh
- [ ] **Baby Weight (grams)** (`NumberInput`, [line 558](../../../apps/web/src/pages/mrd.tsx#L558)) — accepts input, default value sensible, persists after refresh
- [ ] **Birth Type** (`Select`, [line 563](../../../apps/web/src/pages/mrd.tsx#L563)) — accepts input, default value sensible, persists after refresh
- [ ] **APGAR 1min** (`NumberInput`, [line 570](../../../apps/web/src/pages/mrd.tsx#L570)) — accepts input, default value sensible, persists after refresh
- [ ] **APGAR 5min** (`NumberInput`, [line 577](../../../apps/web/src/pages/mrd.tsx#L577)) — accepts input, default value sensible, persists after refresh
- [ ] **Father Name** (`TextInput`, [line 585](../../../apps/web/src/pages/mrd.tsx#L585)) — accepts input, default value sensible, persists after refresh
- [ ] **Mother Age** (`NumberInput`, [line 590](../../../apps/web/src/pages/mrd.tsx#L590)) — accepts input, default value sensible, persists after refresh
- [ ] **Complications** (`Textarea`, [line 595](../../../apps/web/src/pages/mrd.tsx#L595)) — accepts input, default value sensible, persists after refresh
- [ ] **Death Date** (`TextInput`, [line 707](../../../apps/web/src/pages/mrd.tsx#L707)) — accepts input, default value sensible, persists after refresh
- [ ] **Cause of Death** (`TextInput`, [line 714](../../../apps/web/src/pages/mrd.tsx#L714)) — accepts input, default value sensible, persists after refresh
- [ ] **Immediate Cause** (`TextInput`, [line 719](../../../apps/web/src/pages/mrd.tsx#L719)) — accepts input, default value sensible, persists after refresh
- [ ] **Antecedent Cause** (`TextInput`, [line 724](../../../apps/web/src/pages/mrd.tsx#L724)) — accepts input, default value sensible, persists after refresh
- [ ] **Underlying Cause** (`TextInput`, [line 729](../../../apps/web/src/pages/mrd.tsx#L729)) — accepts input, default value sensible, persists after refresh
- [ ] **Manner of Death** (`Select`, [line 734](../../../apps/web/src/pages/mrd.tsx#L734)) — accepts input, default value sensible, persists after refresh
- [ ] **Medico-Legal?** (`Select`, [line 741](../../../apps/web/src/pages/mrd.tsx#L741)) — accepts input, default value sensible, persists after refresh
- [ ] **Brought Dead?** (`Select`, [line 750](../../../apps/web/src/pages/mrd.tsx#L750)) — accepts input, default value sensible, persists after refresh
- [ ] **From** (`DateInput`, [line 795](../../../apps/web/src/pages/mrd.tsx#L795)) — accepts input, default value sensible, persists after refresh
- [ ] **To** (`DateInput`, [line 796](../../../apps/web/src/pages/mrd.tsx#L796)) — accepts input, default value sensible, persists after refresh
- [ ] **Record Type** (`Select`, [line 1033](../../../apps/web/src/pages/mrd.tsx#L1033)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`TextInput`, [line 1040](../../../apps/web/src/pages/mrd.tsx#L1040)) — accepts input, default value sensible, persists after refresh
- [ ] **Retention Years** (`NumberInput`, [line 1047](../../../apps/web/src/pages/mrd.tsx#L1047)) — accepts input, default value sensible, persists after refresh
- [ ] **Legal Reference** (`TextInput`, [line 1054](../../../apps/web/src/pages/mrd.tsx#L1054)) — accepts input, default value sensible, persists after refresh
- [ ] **Destruction Method** (`Select`, [line 1059](../../../apps/web/src/pages/mrd.tsx#L1059)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 10, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 286>** ([line 286](../../../apps/web/src/pages/mrd.tsx#L286)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 286>** ([line 286](../../../apps/web/src/pages/mrd.tsx#L286)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 349>** ([line 349](../../../apps/web/src/pages/mrd.tsx#L349)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 349>** ([line 349](../../../apps/web/src/pages/mrd.tsx#L349)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 386>** ([line 386](../../../apps/web/src/pages/mrd.tsx#L386)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 386>** ([line 386](../../../apps/web/src/pages/mrd.tsx#L386)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 434>** ([line 434](../../../apps/web/src/pages/mrd.tsx#L434)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 434>** ([line 434](../../../apps/web/src/pages/mrd.tsx#L434)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 522>** ([line 522](../../../apps/web/src/pages/mrd.tsx#L522)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 522>** ([line 522](../../../apps/web/src/pages/mrd.tsx#L522)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 600>** ([line 600](../../../apps/web/src/pages/mrd.tsx#L600)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 600>** ([line 600](../../../apps/web/src/pages/mrd.tsx#L600)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 686>** ([line 686](../../../apps/web/src/pages/mrd.tsx#L686)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 686>** ([line 686](../../../apps/web/src/pages/mrd.tsx#L686)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 760>** ([line 760](../../../apps/web/src/pages/mrd.tsx#L760)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 760>** ([line 760](../../../apps/web/src/pages/mrd.tsx#L760)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1018>** ([line 1018](../../../apps/web/src/pages/mrd.tsx#L1018)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1018>** ([line 1018](../../../apps/web/src/pages/mrd.tsx#L1018)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1066>** ([line 1066](../../../apps/web/src/pages/mrd.tsx#L1066)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1066>** ([line 1066](../../../apps/web/src/pages/mrd.tsx#L1066)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 237>** ([line 237](../../../apps/web/src/pages/mrd.tsx#L237)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 251>** ([line 251](../../../apps/web/src/pages/mrd.tsx#L251)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (13)

- [ ] `api.createMrdBirth` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createMrdDeath` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createMrdRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createMrdRetentionPolicy` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getMrdAdmissionDischarge` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getMrdMorbidityMortality` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.issueMrdRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMrdBirths` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMrdDeaths` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMrdMovements` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMrdRecords` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMrdRetentionPolicies` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.returnMrdRecord` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._