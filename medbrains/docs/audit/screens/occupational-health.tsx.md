# `occupational-health.tsx` walkthrough

_Source: [`apps/web/src/pages/occupational-health.tsx`](../../../apps/web/src/pages/occupational-health.tsx) (1982 lines). Guard: `P.OCC_HEALTH.SCREENINGS_LIST`. API methods: 17. useForm: 0. Tables: 5. Modals: 9._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.OCC_HEALTH.SCREENINGS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Health Screenings** (`screenings`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Health Screenings** (`screenings`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Health Screenings** (`screenings`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Drug Screening** (`drug-screens`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Drug Screening** (`drug-screens`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Drug Screening** (`drug-screens`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Vaccinations** (`vaccinations`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Vaccinations** (`vaccinations`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Vaccinations** (`vaccinations`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Injuries & RTW** (`injuries`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Injuries & RTW** (`injuries`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Injuries & RTW** (`injuries`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Hazard Registry** (`hazards`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Hazard Registry** (`hazards`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Hazard Registry** (`hazards`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Analytics** (`analytics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Analytics** (`analytics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Analytics** (`analytics`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            RTW Clearance** (`rtw-clearance`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            RTW Clearance** (`rtw-clearance`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            RTW Clearance** (`rtw-clearance`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (31)
- [ ] Column **Employee** (`employee_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`screening_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Screening Date** (`screening_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Fitness Status** (`fitness_status`) renders without `undefined` / `[object Object]`
- [ ] Column **Next Due** (`next_due_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Employee** (`employee_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Specimen ID** (`specimen_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Panel** (`panel`) renders without `undefined` / `[object Object]`
- [ ] Column **MRO Decision** (`mro_decision`) renders without `undefined` / `[object Object]`
- [ ] Column **Collected** (`collected_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Employee** (`employee_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Vaccine** (`vaccine_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Dose #** (`dose_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Administered** (`administered_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Compliant** (`is_compliant`) renders without `undefined` / `[object Object]`
- [ ] Column **Next Due** (`next_due_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Batch** (`batch_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Report #** (`report_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Employee** (`employee_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Injury Date** (`injury_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`injury_type`) renders without `undefined` / `[object Object]`
- [ ] Column **OSHA** (`is_osha_recordable`) renders without `undefined` / `[object Object]`
- [ ] Column **RTW Status** (`rtw_status`) renders without `undefined` / `[object Object]`
- [ ] Column **Lost Days** (`lost_work_days`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`hazard_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Location** (`location`) renders without `undefined` / `[object Object]`
- [ ] Column **Risk Level** (`risk_level`) renders without `undefined` / `[object Object]`
- [ ] Column **Description** (`description`) renders without `undefined` / `[object Object]`
- [ ] Column **Mitigation** (`mitigation`) renders without `undefined` / `[object Object]`
- [ ] Column **Assessed** (`assessed_date`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Modal — _Fitness to Work Certificate_ @ [line 725](../../../apps/web/src/pages/occupational-health.tsx#L725)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _New Health Screening_ @ [line 537](../../../apps/web/src/pages/occupational-health.tsx#L537)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Update Screening_ @ [line 687](../../../apps/web/src/pages/occupational-health.tsx#L687)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Drug Screening_ @ [line 964](../../../apps/web/src/pages/occupational-health.tsx#L964)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Update Drug Screen_ @ [line 1003](../../../apps/web/src/pages/occupational-health.tsx#L1003)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Vaccination_ @ [line 1168](../../../apps/web/src/pages/occupational-health.tsx#L1168)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Report Workplace Injury_ @ [line 1438](../../../apps/web/src/pages/occupational-health.tsx#L1438)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Manage Injury & Return-to-Work_ @ [line 1504](../../../apps/web/src/pages/occupational-health.tsx#L1504)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Register Workplace Hazard_ @ [line 1718](../../../apps/web/src/pages/occupational-health.tsx#L1718)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (67)

- [ ] **<Select @ line 447>** (`Select`, [line 447](../../../apps/web/src/pages/occupational-health.tsx#L447)) — accepts input, default value sensible, persists after refresh
- [ ] **Employee ID** (`TextInput`, [line 545](../../../apps/web/src/pages/occupational-health.tsx#L545)) — accepts input, default value sensible, persists after refresh
- [ ] **Screening Type** (`Select`, [line 551](../../../apps/web/src/pages/occupational-health.tsx#L551)) — accepts input, default value sensible, persists after refresh
- [ ] **Screening Date** (`DateInput`, [line 558](../../../apps/web/src/pages/occupational-health.tsx#L558)) — accepts input, default value sensible, persists after refresh
- [ ] **Diabetes** (`Checkbox`, [line 580](../../../apps/web/src/pages/occupational-health.tsx#L580)) — accepts input, default value sensible, persists after refresh
- [ ] **Hypertension** (`Checkbox`, [line 581](../../../apps/web/src/pages/occupational-health.tsx#L581)) — accepts input, default value sensible, persists after refresh
- [ ] **Asthma** (`Checkbox`, [line 582](../../../apps/web/src/pages/occupational-health.tsx#L582)) — accepts input, default value sensible, persists after refresh
- [ ] **Cardiac Conditions** (`Checkbox`, [line 583](../../../apps/web/src/pages/occupational-health.tsx#L583)) — accepts input, default value sensible, persists after refresh
- [ ] **Previous Surgery** (`Checkbox`, [line 584](../../../apps/web/src/pages/occupational-health.tsx#L584)) — accepts input, default value sensible, persists after refresh
- [ ] **Height (cm)** (`TextInput`, [line 588](../../../apps/web/src/pages/occupational-health.tsx#L588)) — accepts input, default value sensible, persists after refresh
- [ ] **Weight (kg)** (`TextInput`, [line 594](../../../apps/web/src/pages/occupational-health.tsx#L594)) — accepts input, default value sensible, persists after refresh
- [ ] **BP Systolic** (`TextInput`, [line 602](../../../apps/web/src/pages/occupational-health.tsx#L602)) — accepts input, default value sensible, persists after refresh
- [ ] **BP Diastolic** (`TextInput`, [line 608](../../../apps/web/src/pages/occupational-health.tsx#L608)) — accepts input, default value sensible, persists after refresh
- [ ] **Vision Left** (`TextInput`, [line 616](../../../apps/web/src/pages/occupational-health.tsx#L616)) — accepts input, default value sensible, persists after refresh
- [ ] **Vision Right** (`TextInput`, [line 622](../../../apps/web/src/pages/occupational-health.tsx#L622)) — accepts input, default value sensible, persists after refresh
- [ ] **Hearing Test Result** (`TextInput`, [line 629](../../../apps/web/src/pages/occupational-health.tsx#L629)) — accepts input, default value sensible, persists after refresh
- [ ] **Lab Results Reference** (`TextInput`, [line 635](../../../apps/web/src/pages/occupational-health.tsx#L635)) — accepts input, default value sensible, persists after refresh
- [ ] **Fitness Status** (`Select`, [line 645](../../../apps/web/src/pages/occupational-health.tsx#L645)) — accepts input, default value sensible, persists after refresh
- [ ] **Next Due Date** (`DateInput`, [line 652](../../../apps/web/src/pages/occupational-health.tsx#L652)) — accepts input, default value sensible, persists after refresh
- [ ] **Examiner ID** (`TextInput`, [line 662](../../../apps/web/src/pages/occupational-health.tsx#L662)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 669](../../../apps/web/src/pages/occupational-health.tsx#L669)) — accepts input, default value sensible, persists after refresh
- [ ] **Fitness Status** (`Select`, [line 695](../../../apps/web/src/pages/occupational-health.tsx#L695)) — accepts input, default value sensible, persists after refresh
- [ ] **Next Due Date** (`DateInput`, [line 701](../../../apps/web/src/pages/occupational-health.tsx#L701)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 711](../../../apps/web/src/pages/occupational-health.tsx#L711)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 946>** (`Select`, [line 946](../../../apps/web/src/pages/occupational-health.tsx#L946)) — accepts input, default value sensible, persists after refresh
- [ ] **Employee ID** (`TextInput`, [line 972](../../../apps/web/src/pages/occupational-health.tsx#L972)) — accepts input, default value sensible, persists after refresh
- [ ] **Screening ID** (`TextInput`, [line 978](../../../apps/web/src/pages/occupational-health.tsx#L978)) — accepts input, default value sensible, persists after refresh
- [ ] **Panel** (`Select`, [line 986](../../../apps/web/src/pages/occupational-health.tsx#L986)) — accepts input, default value sensible, persists after refresh
- [ ] **Status** (`Select`, [line 1011](../../../apps/web/src/pages/occupational-health.tsx#L1011)) — accepts input, default value sensible, persists after refresh
- [ ] **MRO Decision** (`TextInput`, [line 1017](../../../apps/web/src/pages/occupational-health.tsx#L1017)) — accepts input, default value sensible, persists after refresh
- [ ] **Employee ID** (`TextInput`, [line 1176](../../../apps/web/src/pages/occupational-health.tsx#L1176)) — accepts input, default value sensible, persists after refresh
- [ ] **Vaccine Name** (`TextInput`, [line 1182](../../../apps/web/src/pages/occupational-health.tsx#L1182)) — accepts input, default value sensible, persists after refresh
- [ ] **Dose Number** (`NumberInput`, [line 1188](../../../apps/web/src/pages/occupational-health.tsx#L1188)) — accepts input, default value sensible, persists after refresh
- [ ] **Administered Date** (`DateInput`, [line 1196](../../../apps/web/src/pages/occupational-health.tsx#L1196)) — accepts input, default value sensible, persists after refresh
- [ ] **Batch Number** (`TextInput`, [line 1207](../../../apps/web/src/pages/occupational-health.tsx#L1207)) — accepts input, default value sensible, persists after refresh
- [ ] **Next Due Date** (`DateInput`, [line 1214](../../../apps/web/src/pages/occupational-health.tsx#L1214)) — accepts input, default value sensible, persists after refresh
- [ ] **Is Compliant** (`Switch`, [line 1224](../../../apps/web/src/pages/occupational-health.tsx#L1224)) — accepts input, default value sensible, persists after refresh
- [ ] **Exemption Type** (`TextInput`, [line 1229](../../../apps/web/src/pages/occupational-health.tsx#L1229)) — accepts input, default value sensible, persists after refresh
- [ ] **Exemption Reason** (`Textarea`, [line 1236](../../../apps/web/src/pages/occupational-health.tsx#L1236)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1243](../../../apps/web/src/pages/occupational-health.tsx#L1243)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1420>** (`Select`, [line 1420](../../../apps/web/src/pages/occupational-health.tsx#L1420)) — accepts input, default value sensible, persists after refresh
- [ ] **Employee ID** (`TextInput`, [line 1446](../../../apps/web/src/pages/occupational-health.tsx#L1446)) — accepts input, default value sensible, persists after refresh
- [ ] **Injury Date** (`DateInput`, [line 1452](../../../apps/web/src/pages/occupational-health.tsx#L1452)) — accepts input, default value sensible, persists after refresh
- [ ] **Injury Type** (`Select`, [line 1460](../../../apps/web/src/pages/occupational-health.tsx#L1460)) — accepts input, default value sensible, persists after refresh
- [ ] **Body Part Affected** (`TextInput`, [line 1467](../../../apps/web/src/pages/occupational-health.tsx#L1467)) — accepts input, default value sensible, persists after refresh
- [ ] **Location of Incident** (`TextInput`, [line 1474](../../../apps/web/src/pages/occupational-health.tsx#L1474)) — accepts input, default value sensible, persists after refresh
- [ ] **Injury Description** (`Textarea`, [line 1481](../../../apps/web/src/pages/occupational-health.tsx#L1481)) — accepts input, default value sensible, persists after refresh
- [ ] **OSHA Recordable** (`Switch`, [line 1488](../../../apps/web/src/pages/occupational-health.tsx#L1488)) — accepts input, default value sensible, persists after refresh
- [ ] **RTW Status** (`Select`, [line 1512](../../../apps/web/src/pages/occupational-health.tsx#L1512)) — accepts input, default value sensible, persists after refresh
- [ ] **Lost Work Days** (`NumberInput`, [line 1523](../../../apps/web/src/pages/occupational-health.tsx#L1523)) — accepts input, default value sensible, persists after refresh
- [ ] **Restricted Days** (`NumberInput`, [line 1531](../../../apps/web/src/pages/occupational-health.tsx#L1531)) — accepts input, default value sensible, persists after refresh
- [ ] **OSHA Recordable** (`Switch`, [line 1542](../../../apps/web/src/pages/occupational-health.tsx#L1542)) — accepts input, default value sensible, persists after refresh
- [ ] **Workers Comp Claim Number** (`TextInput`, [line 1549](../../../apps/web/src/pages/occupational-health.tsx#L1549)) — accepts input, default value sensible, persists after refresh
- [ ] **Workers Comp Status** (`TextInput`, [line 1559](../../../apps/web/src/pages/occupational-health.tsx#L1559)) — accepts input, default value sensible, persists after refresh
- [ ] **Employer Access Notes** (`Textarea`, [line 1569](../../../apps/web/src/pages/occupational-health.tsx#L1569)) — accepts input, default value sensible, persists after refresh
- [ ] **Injury Description** (`Textarea`, [line 1579](../../../apps/web/src/pages/occupational-health.tsx#L1579)) — accepts input, default value sensible, persists after refresh
- [ ] **Hazard Type** (`Select`, [line 1726](../../../apps/web/src/pages/occupational-health.tsx#L1726)) — accepts input, default value sensible, persists after refresh
- [ ] **Location** (`TextInput`, [line 1733](../../../apps/web/src/pages/occupational-health.tsx#L1733)) — accepts input, default value sensible, persists after refresh
- [ ] **Risk Level** (`Select`, [line 1740](../../../apps/web/src/pages/occupational-health.tsx#L1740)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 1752](../../../apps/web/src/pages/occupational-health.tsx#L1752)) — accepts input, default value sensible, persists after refresh
- [ ] **Mitigation Measures** (`Textarea`, [line 1757](../../../apps/web/src/pages/occupational-health.tsx#L1757)) — accepts input, default value sensible, persists after refresh
- [ ] **Assessment Date** (`DateInput`, [line 1762](../../../apps/web/src/pages/occupational-health.tsx#L1762)) — accepts input, default value sensible, persists after refresh
- [ ] **Employee ID** (`TextInput`, [line 1925](../../../apps/web/src/pages/occupational-health.tsx#L1925)) — accepts input, default value sensible, persists after refresh
- [ ] **Clearance Date** (`DateInput`, [line 1932](../../../apps/web/src/pages/occupational-health.tsx#L1932)) — accepts input, default value sensible, persists after refresh
- [ ] **Restrictions** (`Textarea`, [line 1943](../../../apps/web/src/pages/occupational-health.tsx#L1943)) — accepts input, default value sensible, persists after refresh
- [ ] **Follow-up Date** (`DateInput`, [line 1951](../../../apps/web/src/pages/occupational-health.tsx#L1951)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1961](../../../apps/web/src/pages/occupational-health.tsx#L1961)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 18, `<ActionIcon>`: 4, `<Menu.Item>`: 0)

- [ ] **<button @ line 458>** ([line 458](../../../apps/web/src/pages/occupational-health.tsx#L458)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 458>** ([line 458](../../../apps/web/src/pages/occupational-health.tsx#L458)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 474>** ([line 474](../../../apps/web/src/pages/occupational-health.tsx#L474)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 474>** ([line 474](../../../apps/web/src/pages/occupational-health.tsx#L474)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 488>** ([line 488](../../../apps/web/src/pages/occupational-health.tsx#L488)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 488>** ([line 488](../../../apps/web/src/pages/occupational-health.tsx#L488)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 676>** ([line 676](../../../apps/web/src/pages/occupational-health.tsx#L676)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 676>** ([line 676](../../../apps/web/src/pages/occupational-health.tsx#L676)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 718>** ([line 718](../../../apps/web/src/pages/occupational-health.tsx#L718)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 718>** ([line 718](../../../apps/web/src/pages/occupational-health.tsx#L718)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Close** ([line 797](../../../apps/web/src/pages/occupational-health.tsx#L797)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Close** ([line 797](../../../apps/web/src/pages/occupational-health.tsx#L797)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 800>** ([line 800](../../../apps/web/src/pages/occupational-health.tsx#L800)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 800>** ([line 800](../../../apps/web/src/pages/occupational-health.tsx#L800)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 955>** ([line 955](../../../apps/web/src/pages/occupational-health.tsx#L955)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 955>** ([line 955](../../../apps/web/src/pages/occupational-health.tsx#L955)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 992>** ([line 992](../../../apps/web/src/pages/occupational-health.tsx#L992)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 992>** ([line 992](../../../apps/web/src/pages/occupational-health.tsx#L992)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1024>** ([line 1024](../../../apps/web/src/pages/occupational-health.tsx#L1024)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1024>** ([line 1024](../../../apps/web/src/pages/occupational-health.tsx#L1024)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1154>** ([line 1154](../../../apps/web/src/pages/occupational-health.tsx#L1154)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1154>** ([line 1154](../../../apps/web/src/pages/occupational-health.tsx#L1154)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1250>** ([line 1250](../../../apps/web/src/pages/occupational-health.tsx#L1250)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1250>** ([line 1250](../../../apps/web/src/pages/occupational-health.tsx#L1250)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1429>** ([line 1429](../../../apps/web/src/pages/occupational-health.tsx#L1429)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1429>** ([line 1429](../../../apps/web/src/pages/occupational-health.tsx#L1429)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1493>** ([line 1493](../../../apps/web/src/pages/occupational-health.tsx#L1493)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1493>** ([line 1493](../../../apps/web/src/pages/occupational-health.tsx#L1493)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1589>** ([line 1589](../../../apps/web/src/pages/occupational-health.tsx#L1589)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1589>** ([line 1589](../../../apps/web/src/pages/occupational-health.tsx#L1589)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1703>** ([line 1703](../../../apps/web/src/pages/occupational-health.tsx#L1703)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1703>** ([line 1703](../../../apps/web/src/pages/occupational-health.tsx#L1703)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1770>** ([line 1770](../../../apps/web/src/pages/occupational-health.tsx#L1770)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1770>** ([line 1770](../../../apps/web/src/pages/occupational-health.tsx#L1770)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1969>** ([line 1969](../../../apps/web/src/pages/occupational-health.tsx#L1969)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1969>** ([line 1969](../../../apps/web/src/pages/occupational-health.tsx#L1969)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 368>** ([line 368](../../../apps/web/src/pages/occupational-health.tsx#L368)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 383>** ([line 383](../../../apps/web/src/pages/occupational-health.tsx#L383)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 922>** ([line 922](../../../apps/web/src/pages/occupational-health.tsx#L922)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1390>** ([line 1390](../../../apps/web/src/pages/occupational-health.tsx#L1390)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (17)

- [ ] `api.createDrugScreen` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createInjury` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createOccHealthHazard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createOccScreening` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createVaccination` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDrugScreens` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDueScreenings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listInjuries` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOccHealthHazards` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOccScreenings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listVaccinations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.occHealthAnalytics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.returnToWorkClearance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateDrugScreen` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateInjury` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateOccScreening` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.vaccinationCompliance` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._