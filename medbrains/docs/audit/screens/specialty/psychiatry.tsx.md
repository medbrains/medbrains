# `specialty/psychiatry.tsx` walkthrough

_Source: [`apps/web/src/pages/specialty/psychiatry.tsx`](../../../apps/web/src/pages/specialty/psychiatry.tsx) (208 lines). Guard: `P.SPECIALTY.PSYCHIATRY.PATIENTS_LIST`. API methods: 7. useForm: 0. Tables: 5. Modals: 1._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.SPECIALTY.PSYCHIATRY.PATIENTS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Patients** (`patients`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Patients** (`patients`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Patients** (`patients`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Assessments** (`assessments`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Assessments** (`assessments`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Assessments** (`assessments`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **ECT Register** (`ect`) — clicking activates the panel + loads its data without console error
- [ ] Tab **ECT Register** (`ect`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **ECT Register** (`ect`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Seclusion & Restraint** (`restraint`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Seclusion & Restraint** (`restraint`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Seclusion & Restraint** (`restraint`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **MHRB** (`mhrb`) — clicking activates the panel + loads its data without console error
- [ ] Tab **MHRB** (`mhrb`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **MHRB** (`mhrb`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (23)
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Substance Abuse** (`substance`) renders without `undefined` / `[object Object]`
- [ ] Column **Restricted** (`restricted`) renders without `undefined` / `[object Object]`
- [ ] Column **Nominated Rep** (`nominated`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`type`) renders without `undefined` / `[object Object]`
- [ ] Column **HAM-D** (`ham_d`) renders without `undefined` / `[object Object]`
- [ ] Column **BPRS** (`bprs`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Session #** (`session`) renders without `undefined` / `[object Object]`
- [ ] Column **Laterality** (`laterality`) renders without `undefined` / `[object Object]`
- [ ] Column **Consent** (`consent`) renders without `undefined` / `[object Object]`
- [ ] Column **Stimulus** (`stimulus`) renders without `undefined` / `[object Object]`
- [ ] Column **Seizure Duration** (`seizure`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`type`) renders without `undefined` / `[object Object]`
- [ ] Column **Start** (`start`) renders without `undefined` / `[object Object]`
- [ ] Column **Review Due** (`review_due`) renders without `undefined` / `[object Object]`
- [ ] Column **Released** (`released`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`type`) renders without `undefined` / `[object Object]`
- [ ] Column **Reference** (`ref`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _Register Psychiatric Patient_ @ [line 193](../../../apps/web/src/pages/specialty/psychiatry.tsx#L193)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (7)

- [ ] **Patient ID** (`TextInput`, [line 195](../../../apps/web/src/pages/specialty/psychiatry.tsx#L195)) — accepts input, default value sensible, persists after refresh
- [ ] **Admission Category** (`Select`, [line 196](../../../apps/web/src/pages/specialty/psychiatry.tsx#L196)) — accepts input, default value sensible, persists after refresh
- [ ] **Advance Directive** (`Textarea`, [line 197](../../../apps/web/src/pages/specialty/psychiatry.tsx#L197)) — accepts input, default value sensible, persists after refresh
- [ ] **Nominated Rep Name** (`TextInput`, [line 198](../../../apps/web/src/pages/specialty/psychiatry.tsx#L198)) — accepts input, default value sensible, persists after refresh
- [ ] **Nominated Rep Contact** (`TextInput`, [line 199](../../../apps/web/src/pages/specialty/psychiatry.tsx#L199)) — accepts input, default value sensible, persists after refresh
- [ ] **Nominated Rep Relation** (`TextInput`, [line 200](../../../apps/web/src/pages/specialty/psychiatry.tsx#L200)) — accepts input, default value sensible, persists after refresh
- [ ] **Substance Abuse** (`Switch`, [line 201](../../../apps/web/src/pages/specialty/psychiatry.tsx#L201)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 2, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 152>** ([line 152](../../../apps/web/src/pages/specialty/psychiatry.tsx#L152)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 152>** ([line 152](../../../apps/web/src/pages/specialty/psychiatry.tsx#L152)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 202>** ([line 202](../../../apps/web/src/pages/specialty/psychiatry.tsx#L202)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 202>** ([line 202](../../../apps/web/src/pages/specialty/psychiatry.tsx#L202)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 110>** ([line 110](../../../apps/web/src/pages/specialty/psychiatry.tsx#L110)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 140>** ([line 140](../../../apps/web/src/pages/specialty/psychiatry.tsx#L140)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (7)

- [ ] `api.createPsychPatient` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listEctSessions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMhrbNotifications` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPsychAssessments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPsychPatients` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRestraints` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.releaseRestraint` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._