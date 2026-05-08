# `chronic-care.tsx` walkthrough

_Source: [`apps/web/src/pages/chronic-care.tsx`](../../../apps/web/src/pages/chronic-care.tsx) (1119 lines). Guard: `P.CHRONIC.ENROLLMENTS_LIST`. API methods: 10. useForm: 0. Tables: 2. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.CHRONIC.ENROLLMENTS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Programs** (`programs`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Programs** (`programs`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Programs** (`programs`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Enrollments** (`enrollments`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Enrollments** (`enrollments`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Enrollments** (`enrollments`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Adherence** (`adherence`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Adherence** (`adherence`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Adherence** (`adherence`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Outcomes** (`outcomes`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Outcomes** (`outcomes`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Outcomes** (`outcomes`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Drug-o-gram** (`drugogram`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Drug-o-gram** (`drugogram`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Drug-o-gram** (`drugogram`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Treatment Summary** (`treatment-summary`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Treatment Summary** (`treatment-summary`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Treatment Summary** (`treatment-summary`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (12)
- [ ] Column **Program Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`program_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Duration** (`duration`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient`) renders without `undefined` / `[object Object]`
- [ ] Column **Program** (`program_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`program_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Enrolled** (`enrollment_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Doctor** (`doctor`) renders without `undefined` / `[object Object]`
- [ ] Column **ICD** (`icd`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _<drawer @ line 338>_ @ [line 338](../../../apps/web/src/pages/chronic-care.tsx#L338)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Enroll Patient_ @ [line 506](../../../apps/web/src/pages/chronic-care.tsx#L506)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (18)

- [ ] **<TextInput @ line 264>** (`TextInput`, [line 264](../../../apps/web/src/pages/chronic-care.tsx#L264)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 270>** (`Select`, [line 270](../../../apps/web/src/pages/chronic-care.tsx#L270)) — accepts input, default value sensible, persists after refresh
- [ ] **Program Name** (`TextInput`, [line 346](../../../apps/web/src/pages/chronic-care.tsx#L346)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 347](../../../apps/web/src/pages/chronic-care.tsx#L347)) — accepts input, default value sensible, persists after refresh
- [ ] **Program Type** (`Select`, [line 348](../../../apps/web/src/pages/chronic-care.tsx#L348)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 349](../../../apps/web/src/pages/chronic-care.tsx#L349)) — accepts input, default value sensible, persists after refresh
- [ ] **Default Duration (months)** (`NumberInput`, [line 350](../../../apps/web/src/pages/chronic-care.tsx#L350)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 433>** (`TextInput`, [line 433](../../../apps/web/src/pages/chronic-care.tsx#L433)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 439>** (`Select`, [line 439](../../../apps/web/src/pages/chronic-care.tsx#L439)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 447>** (`Select`, [line 447](../../../apps/web/src/pages/chronic-care.tsx#L447)) — accepts input, default value sensible, persists after refresh
- [ ] **Program** (`Select`, [line 509](../../../apps/web/src/pages/chronic-care.tsx#L509)) — accepts input, default value sensible, persists after refresh
- [ ] **ICD Code** (`TextInput`, [line 517](../../../apps/web/src/pages/chronic-care.tsx#L517)) — accepts input, default value sensible, persists after refresh
- [ ] **Enrollment Date** (`DateInput`, [line 518](../../../apps/web/src/pages/chronic-care.tsx#L518)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 519](../../../apps/web/src/pages/chronic-care.tsx#L519)) — accepts input, default value sensible, persists after refresh
- [ ] **Select Enrollment** (`Select`, [line 559](../../../apps/web/src/pages/chronic-care.tsx#L559)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient Outcome Detail** (`Select`, [line 697](../../../apps/web/src/pages/chronic-care.tsx#L697)) — accepts input, default value sensible, persists after refresh
- [ ] **Select Patient** (`Select`, [line 781](../../../apps/web/src/pages/chronic-care.tsx#L781)) — accepts input, default value sensible, persists after refresh
- [ ] **Select Patient** (`Select`, [line 957](../../../apps/web/src/pages/chronic-care.tsx#L957)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 5, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 279>** ([line 279](../../../apps/web/src/pages/chronic-care.tsx#L279)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 279>** ([line 279](../../../apps/web/src/pages/chronic-care.tsx#L279)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 351>** ([line 351](../../../apps/web/src/pages/chronic-care.tsx#L351)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 351>** ([line 351](../../../apps/web/src/pages/chronic-care.tsx#L351)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 463>** ([line 463](../../../apps/web/src/pages/chronic-care.tsx#L463)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 463>** ([line 463](../../../apps/web/src/pages/chronic-care.tsx#L463)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 520>** ([line 520](../../../apps/web/src/pages/chronic-care.tsx#L520)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 520>** ([line 520](../../../apps/web/src/pages/chronic-care.tsx#L520)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 967>** ([line 967](../../../apps/web/src/pages/chronic-care.tsx#L967)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 967>** ([line 967](../../../apps/web/src/pages/chronic-care.tsx#L967)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 239>** ([line 239](../../../apps/web/src/pages/chronic-care.tsx#L239)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 252>** ([line 252](../../../apps/web/src/pages/chronic-care.tsx#L252)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (10)

- [ ] `api.adherenceSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createChronicProgram` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createEnrollment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteChronicProgram` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.drugTimelineWithLabs` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listChronicEnrollments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listChronicPrograms` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.outcomeDashboard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.treatmentSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateChronicProgram` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._