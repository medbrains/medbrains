# `infection-control.tsx` walkthrough

_Source: [`apps/web/src/pages/infection-control.tsx`](../../../apps/web/src/pages/infection-control.tsx) (1460 lines). Guard: `P.INFECTION_CONTROL.SURVEILLANCE_LIST`. API methods: 26. useForm: 0. Tables: 15. Modals: 8._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.INFECTION_CONTROL.SURVEILLANCE_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>HAI Surveillance** (`surveillance`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>HAI Surveillance** (`surveillance`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>HAI Surveillance** (`surveillance`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Stewardship & Antibiogram** (`stewardship`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Stewardship & Antibiogram** (`stewardship`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Stewardship & Antibiogram** (`stewardship`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Bio-Waste** (`biowaste`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Bio-Waste** (`biowaste`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Bio-Waste** (`biowaste`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Hygiene & Bundles** (`hygiene`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Hygiene & Bundles** (`hygiene`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Hygiene & Bundles** (`hygiene`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Outbreaks** (`outbreaks`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Outbreaks** (`outbreaks`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Outbreaks** (`outbreaks`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Sharps Safety** (`sharps`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Sharps Safety** (`sharps`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Sharps Safety** (`sharps`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Analytics** (`analytics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Analytics** (`analytics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Analytics** (`analytics`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Meetings** (`meetings`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Meetings** (`meetings`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Meetings** (`meetings`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### `<Table>` @ line 378
  - [ ] Header **Organism** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 386
  - [ ] Header **Organism** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 533
  - [ ] Header **Category** column shows correct value for at least one row
  - [ ] Header **Total Weight (kg)** column shows correct value for at least one row
  - [ ] Header **Total Containers** column shows correct value for at least one row
  - [ ] Header **Record Count** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 540
  - [ ] Header **Category** column shows correct value for at least one row
  - [ ] Header **Total Weight (kg)** column shows correct value for at least one row
  - [ ] Header **Total Containers** column shows correct value for at least one row
  - [ ] Header **Record Count** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1164
  - [ ] Header **Organism** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

_… 5 more tables — list capped to keep checklist usable_
## Modals / Drawers

### Drawer — _Report HAI Event_ @ [line 241](../../../apps/web/src/pages/infection-control.tsx#L241)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Antibiotic Stewardship Request_ @ [line 426](../../../apps/web/src/pages/infection-control.tsx#L426)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Bio-waste Record_ @ [line 572](../../../apps/web/src/pages/infection-control.tsx#L572)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Hand Hygiene Audit_ @ [line 780](../../../apps/web/src/pages/infection-control.tsx#L780)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Report Outbreak_ @ [line 897](../../../apps/web/src/pages/infection-control.tsx#L897)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 907>_ @ [line 907](../../../apps/web/src/pages/infection-control.tsx#L907)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New IC Meeting_ @ [line 1393](../../../apps/web/src/pages/infection-control.tsx#L1393)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Exposure_ @ [line 1404](../../../apps/web/src/pages/infection-control.tsx#L1404)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (45)

- [ ] **<Select @ line 228>** (`Select`, [line 228](../../../apps/web/src/pages/infection-control.tsx#L228)) — accepts input, default value sensible, persists after refresh
- [ ] **HAI Type** (`Select`, [line 244](../../../apps/web/src/pages/infection-control.tsx#L244)) — accepts input, default value sensible, persists after refresh
- [ ] **Infection Date** (`TextInput`, [line 245](../../../apps/web/src/pages/infection-control.tsx#L245)) — accepts input, default value sensible, persists after refresh
- [ ] **Organism** (`TextInput`, [line 246](../../../apps/web/src/pages/infection-control.tsx#L246)) — accepts input, default value sensible, persists after refresh
- [ ] **Device Type** (`Select`, [line 247](../../../apps/web/src/pages/infection-control.tsx#L247)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 248](../../../apps/web/src/pages/infection-control.tsx#L248)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 370>** (`Select`, [line 370](../../../apps/web/src/pages/infection-control.tsx#L370)) — accepts input, default value sensible, persists after refresh
- [ ] **Antibiotic Name** (`TextInput`, [line 429](../../../apps/web/src/pages/infection-control.tsx#L429)) — accepts input, default value sensible, persists after refresh
- [ ] **Dose** (`TextInput`, [line 430](../../../apps/web/src/pages/infection-control.tsx#L430)) — accepts input, default value sensible, persists after refresh
- [ ] **Route** (`TextInput`, [line 431](../../../apps/web/src/pages/infection-control.tsx#L431)) — accepts input, default value sensible, persists after refresh
- [ ] **Indication** (`TextInput`, [line 432](../../../apps/web/src/pages/infection-control.tsx#L432)) — accepts input, default value sensible, persists after refresh
- [ ] **Duration (days)** (`NumberInput`, [line 433](../../../apps/web/src/pages/infection-control.tsx#L433)) — accepts input, default value sensible, persists after refresh
- [ ] **Culture Sent** (`Switch`, [line 434](../../../apps/web/src/pages/infection-control.tsx#L434)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 522>** (`Select`, [line 522](../../../apps/web/src/pages/infection-control.tsx#L522)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 525>** (`Select`, [line 525](../../../apps/web/src/pages/infection-control.tsx#L525)) — accepts input, default value sensible, persists after refresh
- [ ] **Waste Category** (`Select`, [line 575](../../../apps/web/src/pages/infection-control.tsx#L575)) — accepts input, default value sensible, persists after refresh
- [ ] **Weight (kg)** (`NumberInput`, [line 576](../../../apps/web/src/pages/infection-control.tsx#L576)) — accepts input, default value sensible, persists after refresh
- [ ] **Record Date** (`TextInput`, [line 577](../../../apps/web/src/pages/infection-control.tsx#L577)) — accepts input, default value sensible, persists after refresh
- [ ] **Container Count** (`NumberInput`, [line 578](../../../apps/web/src/pages/infection-control.tsx#L578)) — accepts input, default value sensible, persists after refresh
- [ ] **Disposal Vendor** (`TextInput`, [line 579](../../../apps/web/src/pages/infection-control.tsx#L579)) — accepts input, default value sensible, persists after refresh
- [ ] **Manifest Number** (`TextInput`, [line 580](../../../apps/web/src/pages/infection-control.tsx#L580)) — accepts input, default value sensible, persists after refresh
- [ ] **Audit Date** (`TextInput`, [line 782](../../../apps/web/src/pages/infection-control.tsx#L782)) — accepts input, default value sensible, persists after refresh
- [ ] **Total Observations** (`NumberInput`, [line 784](../../../apps/web/src/pages/infection-control.tsx#L784)) — accepts input, default value sensible, persists after refresh
- [ ] **Compliant** (`NumberInput`, [line 785](../../../apps/web/src/pages/infection-control.tsx#L785)) — accepts input, default value sensible, persists after refresh
- [ ] **Non-Compliant** (`NumberInput`, [line 786](../../../apps/web/src/pages/infection-control.tsx#L786)) — accepts input, default value sensible, persists after refresh
- [ ] **Staff Category** (`Select`, [line 787](../../../apps/web/src/pages/infection-control.tsx#L787)) — accepts input, default value sensible, persists after refresh
- [ ] **Findings** (`Textarea`, [line 788](../../../apps/web/src/pages/infection-control.tsx#L788)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 889>** (`Select`, [line 889](../../../apps/web/src/pages/infection-control.tsx#L889)) — accepts input, default value sensible, persists after refresh
- [ ] **Organism** (`TextInput`, [line 899](../../../apps/web/src/pages/infection-control.tsx#L899)) — accepts input, default value sensible, persists after refresh
- [ ] **Detected Date** (`TextInput`, [line 900](../../../apps/web/src/pages/infection-control.tsx#L900)) — accepts input, default value sensible, persists after refresh
- [ ] **Initial Cases** (`NumberInput`, [line 901](../../../apps/web/src/pages/infection-control.tsx#L901)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 902](../../../apps/web/src/pages/infection-control.tsx#L902)) — accepts input, default value sensible, persists after refresh
- [ ] **<DateInput @ line 1143>** (`DateInput`, [line 1143](../../../apps/web/src/pages/infection-control.tsx#L1143)) — accepts input, default value sensible, persists after refresh
- [ ] **<DateInput @ line 1144>** (`DateInput`, [line 1144](../../../apps/web/src/pages/infection-control.tsx#L1144)) — accepts input, default value sensible, persists after refresh
- [ ] **Month** (`Select`, [line 1340](../../../apps/web/src/pages/infection-control.tsx#L1340)) — accepts input, default value sensible, persists after refresh
- [ ] **Year** (`Select`, [line 1350](../../../apps/web/src/pages/infection-control.tsx#L1350)) — accepts input, default value sensible, persists after refresh
- [ ] **Meeting Date** (`TextInput`, [line 1395](../../../apps/web/src/pages/infection-control.tsx#L1395)) — accepts input, default value sensible, persists after refresh
- [ ] **Meeting Type** (`Select`, [line 1396](../../../apps/web/src/pages/infection-control.tsx#L1396)) — accepts input, default value sensible, persists after refresh
- [ ] **Agenda** (`Textarea`, [line 1397](../../../apps/web/src/pages/infection-control.tsx#L1397)) — accepts input, default value sensible, persists after refresh
- [ ] **Minutes** (`Textarea`, [line 1398](../../../apps/web/src/pages/infection-control.tsx#L1398)) — accepts input, default value sensible, persists after refresh
- [ ] **Event Type** (`Select`, [line 1406](../../../apps/web/src/pages/infection-control.tsx#L1406)) — accepts input, default value sensible, persists after refresh
- [ ] **Exposure Date** (`TextInput`, [line 1407](../../../apps/web/src/pages/infection-control.tsx#L1407)) — accepts input, default value sensible, persists after refresh
- [ ] **Exposure Type** (`Select`, [line 1408](../../../apps/web/src/pages/infection-control.tsx#L1408)) — accepts input, default value sensible, persists after refresh
- [ ] **PEP Initiated** (`Switch`, [line 1411](../../../apps/web/src/pages/infection-control.tsx#L1411)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1412](../../../apps/web/src/pages/infection-control.tsx#L1412)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 18, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 232>** ([line 232](../../../apps/web/src/pages/infection-control.tsx#L232)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 232>** ([line 232](../../../apps/web/src/pages/infection-control.tsx#L232)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate()}>Save** ([line 249](../../../apps/web/src/pages/infection-control.tsx#L249)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate()}>Save** ([line 249](../../../apps/web/src/pages/infection-control.tsx#L249)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 350>** ([line 350](../../../apps/web/src/pages/infection-control.tsx#L350)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 350>** ([line 350](../../../apps/web/src/pages/infection-control.tsx#L350)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 351>** ([line 351](../../../apps/web/src/pages/infection-control.tsx#L351)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 351>** ([line 351](../../../apps/web/src/pages/infection-control.tsx#L351)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 374>** ([line 374](../../../apps/web/src/pages/infection-control.tsx#L374)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 374>** ([line 374](../../../apps/web/src/pages/infection-control.tsx#L374)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate()}>Submit** ([line 435](../../../apps/web/src/pages/infection-control.tsx#L435)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate()}>Submit** ([line 435](../../../apps/web/src/pages/infection-control.tsx#L435)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 529>** ([line 529](../../../apps/web/src/pages/infection-control.tsx#L529)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 529>** ([line 529](../../../apps/web/src/pages/infection-control.tsx#L529)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>Save** ([line 581](../../../apps/web/src/pages/infection-control.tsx#L581)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>Save** ([line 581](../../../apps/web/src/pages/infection-control.tsx#L581)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 692>** ([line 692](../../../apps/web/src/pages/infection-control.tsx#L692)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 692>** ([line 692](../../../apps/web/src/pages/infection-control.tsx#L692)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>Save** ([line 789](../../../apps/web/src/pages/infection-control.tsx#L789)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>Save** ([line 789](../../../apps/web/src/pages/infection-control.tsx#L789)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 876>** ([line 876](../../../apps/web/src/pages/infection-control.tsx#L876)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 876>** ([line 876](../../../apps/web/src/pages/infection-control.tsx#L876)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 892>** ([line 892](../../../apps/web/src/pages/infection-control.tsx#L892)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 892>** ([line 892](../../../apps/web/src/pages/infection-control.tsx#L892)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>Report** ([line 903](../../../apps/web/src/pages/infection-control.tsx#L903)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>Report** ([line 903](../../../apps/web/src/pages/infection-control.tsx#L903)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **} disabled>             Report Incident** ([line 1004](../../../apps/web/src/pages/infection-control.tsx#L1004)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **} disabled>             Report Incident** ([line 1004](../../../apps/web/src/pages/infection-control.tsx#L1004)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1318>** ([line 1318](../../../apps/web/src/pages/infection-control.tsx#L1318)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1318>** ([line 1318](../../../apps/web/src/pages/infection-control.tsx#L1318)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1321>** ([line 1321](../../../apps/web/src/pages/infection-control.tsx#L1321)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1321>** ([line 1321](../../../apps/web/src/pages/infection-control.tsx#L1321)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMeetingMut.mutate(meetingForm)}>Create** ([line 1399](../../../apps/web/src/pages/infection-control.tsx#L1399)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMeetingMut.mutate(meetingForm)}>Create** ([line 1399](../../../apps/web/src/pages/infection-control.tsx#L1399)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createExposureMut.mutate(exposureForm)}>Save** ([line 1413](../../../apps/web/src/pages/infection-control.tsx#L1413)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createExposureMut.mutate(exposureForm)}>Save** ([line 1413](../../../apps/web/src/pages/infection-control.tsx#L1413)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 871>** ([line 871](../../../apps/web/src/pages/infection-control.tsx#L871)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (26)

- [ ] `api.createBiowasteRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createHygieneAudit` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createIcExposure` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createIcMeeting` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createOutbreak` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createStewardshipRequest` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSurveillanceEvent` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.icAntimicrobialConsumption` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.icCultureSensitivityReport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.icDeviceUtilization` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.icHaiRates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.icMdroTracking` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.icMonthlySurveillance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.icSurgicalProphylaxis` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBiowasteRecords` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCultureSurveillance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDeviceDays` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listHygieneAudits` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIcMeetings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listNeedleStickIncidents` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOutbreakContacts` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOutbreaks` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listStewardshipRequests` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSurveillanceEvents` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.reviewStewardshipRequest` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateOutbreak` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._