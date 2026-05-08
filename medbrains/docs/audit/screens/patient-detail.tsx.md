# `patient-detail.tsx` walkthrough

_Source: [`apps/web/src/pages/patient-detail.tsx`](../../../apps/web/src/pages/patient-detail.tsx) (2160 lines). Guard: `P.PATIENTS.VIEW`. API methods: 25. useForm: 0. Tables: 10. Modals: 4._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.PATIENTS.VIEW` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Overview** (`overview`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Overview** (`overview`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Overview** (`overview`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Allergies** (`allergies`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Allergies** (`allergies`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Allergies** (`allergies`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Visits** (`visits`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Visits** (`visits`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Visits** (`visits`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Prescriptions** (`prescriptions`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Prescriptions** (`prescriptions`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Prescriptions** (`prescriptions`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Lab Orders** (`lab`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Lab Orders** (`lab`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Lab Orders** (`lab`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Billing** (`billing`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Billing** (`billing`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Billing** (`billing`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Appointments** (`appointments`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Appointments** (`appointments`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Appointments** (`appointments`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Family** (`family`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Family** (`family`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Family** (`family`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Documents** (`documents`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Documents** (`documents`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Documents** (`documents`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Chronic Care** (`chronic`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Chronic Care** (`chronic`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Chronic Care** (`chronic`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Packages** (`packages`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Packages** (`packages`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Packages** (`packages`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Notes** (`notes`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Notes** (`notes`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Notes** (`notes`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Merge** (`merge`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Merge** (`merge`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Merge** (`merge`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### `<Table>` @ line 395
  - [ ] Header **Allergen** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Severity** column shows correct value for at least one row
  - [ ] Header **Reaction** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 528
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Doctor** column shows correct value for at least one row
  - [ ] Header **Department** column shows correct value for at least one row
  - [ ] Header **Chief Complaint** column shows correct value for at least one row
  - [ ] Header **Dx** column shows correct value for at least one row
  - [ ] Header **Rx** column shows correct value for at least one row
  - [ ] Header **Lab** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Test** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Priority** column shows correct value for at least one row
  - [ ] Header **Ordered By** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 657
  - [ ] Header **Test** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Priority** column shows correct value for at least one row
  - [ ] Header **Ordered By** column shows correct value for at least one row
  - [ ] Header **Results** column shows correct value for at least one row
  - [ ] Header **Ordered** column shows correct value for at least one row
  - [ ] Header **Updated** column shows correct value for at least one row
  - [ ] Header **Invoice #** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Items** column shows correct value for at least one row
  - [ ] Header **Amount** column shows correct value for at least one row
  - [ ] Header **Paid** column shows correct value for at least one row
  - [ ] Header **Balance** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 775
  - [ ] Header **Invoice #** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Items** column shows correct value for at least one row
  - [ ] Header **Amount** column shows correct value for at least one row
  - [ ] Header **Paid** column shows correct value for at least one row
  - [ ] Header **Balance** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Time** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Doctor** column shows correct value for at least one row
  - [ ] Header **Department** column shows correct value for at least one row
  - [ ] Header **Reason** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 857
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Time** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Doctor** column shows correct value for at least one row
  - [ ] Header **Department** column shows correct value for at least one row
  - [ ] Header **Reason** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 995
  - [ ] Header **Relationship** column shows correct value for at least one row
  - [ ] Header **UHID** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Phone** column shows correct value for at least one row
  - [ ] Header **Gender** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1034
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Size** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1127
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Size** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1227
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Surviving** column shows correct value for at least one row
  - [ ] Header **Merged** column shows correct value for at least one row
  - [ ] Header **Reason** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1657
  - [ ] Header **Drug** column shows correct value for at least one row
  - [ ] Header **Generic** column shows correct value for at least one row
  - [ ] Header **Dosage** column shows correct value for at least one row
  - [ ] Header **Frequency** column shows correct value for at least one row
  - [ ] Header **Route** column shows correct value for at least one row
  - [ ] Header **Started** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _Add Allergy_ @ [line 452](../../../apps/web/src/pages/patient-detail.tsx#L452)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Link Family Member_ @ [line 1027](../../../apps/web/src/pages/patient-detail.tsx#L1027)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Add Document_ @ [line 1160](../../../apps/web/src/pages/patient-detail.tsx#L1160)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Confirm Merge_ @ [line 1327](../../../apps/web/src/pages/patient-detail.tsx#L1327)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (11)

- [ ] **Allergy Type** (`Select`, [line 454](../../../apps/web/src/pages/patient-detail.tsx#L454)) — accepts input, default value sensible, persists after refresh
- [ ] **Allergen Name** (`TextInput`, [line 472](../../../apps/web/src/pages/patient-detail.tsx#L472)) — accepts input, default value sensible, persists after refresh
- [ ] **Severity** (`Select`, [line 480](../../../apps/web/src/pages/patient-detail.tsx#L480)) — accepts input, default value sensible, persists after refresh
- [ ] **Reaction** (`TextInput`, [line 487](../../../apps/web/src/pages/patient-detail.tsx#L487)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1030>** (`TextInput`, [line 1030](../../../apps/web/src/pages/patient-detail.tsx#L1030)) — accepts input, default value sensible, persists after refresh
- [ ] **Relationship** (`Select`, [line 1049](../../../apps/web/src/pages/patient-detail.tsx#L1049)) — accepts input, default value sensible, persists after refresh
- [ ] **Document Type** (`Select`, [line 1162](../../../apps/web/src/pages/patient-detail.tsx#L1162)) — accepts input, default value sensible, persists after refresh
- [ ] **Document Name** (`TextInput`, [line 1163](../../../apps/web/src/pages/patient-detail.tsx#L1163)) — accepts input, default value sensible, persists after refresh
- [ ] **File URL** (`TextInput`, [line 1164](../../../apps/web/src/pages/patient-detail.tsx#L1164)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1165](../../../apps/web/src/pages/patient-detail.tsx#L1165)) — accepts input, default value sensible, persists after refresh
- [ ] **Merge Reason** (`Textarea`, [line 1314](../../../apps/web/src/pages/patient-detail.tsx#L1314)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 20, `<ActionIcon>`: 4, `<Menu.Item>`: 0)

- [ ] **<button @ line 384>** ([line 384](../../../apps/web/src/pages/patient-detail.tsx#L384)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 384>** ([line 384](../../../apps/web/src/pages/patient-detail.tsx#L384)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 494](../../../apps/web/src/pages/patient-detail.tsx#L494)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 494](../../../apps/web/src/pages/patient-detail.tsx#L494)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Add Allergy** ([line 495](../../../apps/web/src/pages/patient-detail.tsx#L495)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Add Allergy** ([line 495](../../../apps/web/src/pages/patient-detail.tsx#L495)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 986>** ([line 986](../../../apps/web/src/pages/patient-detail.tsx#L986)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 986>** ([line 986](../../../apps/web/src/pages/patient-detail.tsx#L986)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Search** ([line 1031](../../../apps/web/src/pages/patient-detail.tsx#L1031)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Search** ([line 1031](../../../apps/web/src/pages/patient-detail.tsx#L1031)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 1051](../../../apps/web/src/pages/patient-detail.tsx#L1051)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 1051](../../../apps/web/src/pages/patient-detail.tsx#L1051)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1052>** ([line 1052](../../../apps/web/src/pages/patient-detail.tsx#L1052)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1052>** ([line 1052](../../../apps/web/src/pages/patient-detail.tsx#L1052)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1118>** ([line 1118](../../../apps/web/src/pages/patient-detail.tsx#L1118)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1118>** ([line 1118](../../../apps/web/src/pages/patient-detail.tsx#L1118)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 1167](../../../apps/web/src/pages/patient-detail.tsx#L1167)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 1167](../../../apps/web/src/pages/patient-detail.tsx#L1167)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1168>** ([line 1168](../../../apps/web/src/pages/patient-detail.tsx#L1168)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1168>** ([line 1168](../../../apps/web/src/pages/patient-detail.tsx#L1168)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1253>** ([line 1253](../../../apps/web/src/pages/patient-detail.tsx#L1253)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1253>** ([line 1253](../../../apps/web/src/pages/patient-detail.tsx#L1253)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setSelectedTarget(null)}>Cancel** ([line 1316](../../../apps/web/src/pages/patient-detail.tsx#L1316)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setSelectedTarget(null)}>Cancel** ([line 1316](../../../apps/web/src/pages/patient-detail.tsx#L1316)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Merge Records** ([line 1317](../../../apps/web/src/pages/patient-detail.tsx#L1317)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Merge Records** ([line 1317](../../../apps/web/src/pages/patient-detail.tsx#L1317)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 1332](../../../apps/web/src/pages/patient-detail.tsx#L1332)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 1332](../../../apps/web/src/pages/patient-detail.tsx#L1332)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1333>** ([line 1333](../../../apps/web/src/pages/patient-detail.tsx#L1333)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1333>** ([line 1333](../../../apps/web/src/pages/patient-detail.tsx#L1333)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1508>** ([line 1508](../../../apps/web/src/pages/patient-detail.tsx#L1508)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1508>** ([line 1508](../../../apps/web/src/pages/patient-detail.tsx#L1508)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1979>** ([line 1979](../../../apps/web/src/pages/patient-detail.tsx#L1979)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1979>** ([line 1979](../../../apps/web/src/pages/patient-detail.tsx#L1979)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1990>** ([line 1990](../../../apps/web/src/pages/patient-detail.tsx#L1990)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1990>** ([line 1990](../../../apps/web/src/pages/patient-detail.tsx#L1990)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2004>** ([line 2004](../../../apps/web/src/pages/patient-detail.tsx#L2004)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2004>** ([line 2004](../../../apps/web/src/pages/patient-detail.tsx#L2004)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2015>** ([line 2015](../../../apps/web/src/pages/patient-detail.tsx#L2015)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2015>** ([line 2015](../../../apps/web/src/pages/patient-detail.tsx#L2015)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 434>** ([line 434](../../../apps/web/src/pages/patient-detail.tsx#L434)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1016>** ([line 1016](../../../apps/web/src/pages/patient-detail.tsx#L1016)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1149>** ([line 1149](../../../apps/web/src/pages/patient-detail.tsx#L1149)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2025>** ([line 2025](../../../apps/web/src/pages/patient-detail.tsx#L2025)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (25)

- [ ] `api.adherenceSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createFamilyLink` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPatientAllergy` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPatientDocument` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteFamilyLink` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deletePatientAllergy` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deletePatientDocument` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.drugTimelineWithLabs` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPatient` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFamilyLinks` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listInteractionAlerts` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMergeHistory` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatientAllergies` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatientAppointments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatientDocuments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatientInvoices` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatientLabOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatientPrescriptions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatientVisits` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatients` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.mergePatients` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.outcomeDashboard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.patientEnrollments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.treatmentSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.unmergePatient` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._