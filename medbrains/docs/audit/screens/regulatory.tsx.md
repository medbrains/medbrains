# `regulatory.tsx` walkthrough

_Source: [`apps/web/src/pages/regulatory.tsx`](../../../apps/web/src/pages/regulatory.tsx) (1905 lines). Guard: `P.REGULATORY.DASHBOARD_VIEW`. API methods: 27. useForm: 0. Tables: 14. Modals: 7._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.REGULATORY.DASHBOARD_VIEW` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
          Dashboard** (`dashboard`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Dashboard** (`dashboard`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Dashboard** (`dashboard`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Checklists** (`checklists`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Checklists** (`checklists`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Checklists** (`checklists`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          ADR & Device Reports** (`adr`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          ADR & Device Reports** (`adr`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          ADR & Device Reports** (`adr`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          PCPNDT Forms** (`pcpndt`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          PCPNDT Forms** (`pcpndt`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          PCPNDT Forms** (`pcpndt`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Compliance Calendar** (`calendar`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Compliance Calendar** (`calendar`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Compliance Calendar** (`calendar`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Submissions** (`submissions`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Submissions** (`submissions`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Submissions** (`submissions`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Mock Surveys** (`mock-surveys`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Mock Surveys** (`mock-surveys`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Mock Surveys** (`mock-surveys`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Staff Credentials** (`staff-credentials`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Staff Credentials** (`staff-credentials`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Staff Credentials** (`staff-credentials`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          License Dashboard** (`licenses`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          License Dashboard** (`licenses`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          License Dashboard** (`licenses`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          NABL Documents** (`nabl`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          NABL Documents** (`nabl`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          NABL Documents** (`nabl`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (85)
- [ ] Column **Department** (`department_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Avg Score** (`avg_score`) renders without `undefined` / `[object Object]`
- [ ] Column **Checklists** (`checklist_count`) renders without `undefined` / `[object Object]`
- [ ] Column **Checklist** (`checklist_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Body** (`accreditation_body`) renders without `undefined` / `[object Object]`
- [ ] Column **Gaps** (`non_compliant_items`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Body** (`accreditation_body`) renders without `undefined` / `[object Object]`
- [ ] Column **Standard** (`standard_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`overall_status`) renders without `undefined` / `[object Object]`
- [ ] Column **Score** (`compliance_score`) renders without `undefined` / `[object Object]`
- [ ] Column **Items** (`items`) renders without `undefined` / `[object Object]`
- [ ] Column **Period** (`period`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Checklist** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Body** (`body`) renders without `undefined` / `[object Object]`
- [ ] Column **Total** (`total`) renders without `undefined` / `[object Object]`
- [ ] Column **Met** (`met`) renders without `undefined` / `[object Object]`
- [ ] Column **Partial** (`partial`) renders without `undefined` / `[object Object]`
- [ ] Column **Unmet** (`unmet`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Report #** (`report_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Drug** (`drug_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Reaction** (`reaction_description`) renders without `undefined` / `[object Object]`
- [ ] Column **Severity** (`severity`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **PvPI** (`pvpi`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Report #** (`report_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Device** (`device_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Event** (`event_description`) renders without `undefined` / `[object Object]`
- [ ] Column **Severity** (`severity`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **CDSCO** (`cdsco`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Form #** (`form_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Procedure** (`procedure_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Indication** (`indication`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Gender Blocked** (`gender_blocked`) renders without `undefined` / `[object Object]`
- [ ] Column **Gest. Age** (`gestational_age`) renders without `undefined` / `[object Object]`
- [ ] Column **In Quarterly** (`quarterly`) renders without `undefined` / `[object Object]`
- [ ] Column **Created** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Title** (`title`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`event_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Due Date** (`due_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Recurrence** (`recurrence`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] _… 35 more columns — review remaining_

## Modals / Drawers

### Drawer — _New Compliance Checklist_ @ [line 539](../../../apps/web/src/pages/regulatory.tsx#L539)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New ADR Report_ @ [line 916](../../../apps/web/src/pages/regulatory.tsx#L916)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Device Adverse Event_ @ [line 955](../../../apps/web/src/pages/regulatory.tsx#L955)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New PCPNDT Form F_ @ [line 1078](../../../apps/web/src/pages/regulatory.tsx#L1078)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Calendar Event_ @ [line 1201](../../../apps/web/src/pages/regulatory.tsx#L1201)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Regulatory Submission_ @ [line 1583](../../../apps/web/src/pages/regulatory.tsx#L1583)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Mock Survey_ @ [line 1677](../../../apps/web/src/pages/regulatory.tsx#L1677)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (47)

- [ ] **Self-Assessment Score** (`NumberInput`, [line 422](../../../apps/web/src/pages/regulatory.tsx#L422)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes / Evidence** (`Textarea`, [line 432](../../../apps/web/src/pages/regulatory.tsx#L432)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 541](../../../apps/web/src/pages/regulatory.tsx#L541)) — accepts input, default value sensible, persists after refresh
- [ ] **Accreditation Body** (`Select`, [line 542](../../../apps/web/src/pages/regulatory.tsx#L542)) — accepts input, default value sensible, persists after refresh
- [ ] **Standard Code** (`TextInput`, [line 556](../../../apps/web/src/pages/regulatory.tsx#L556)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 557](../../../apps/web/src/pages/regulatory.tsx#L557)) — accepts input, default value sensible, persists after refresh
- [ ] **Assessment Start** (`DateInput`, [line 558](../../../apps/web/src/pages/regulatory.tsx#L558)) — accepts input, default value sensible, persists after refresh
- [ ] **Assessment End** (`DateInput`, [line 559](../../../apps/web/src/pages/regulatory.tsx#L559)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 598>** (`Select`, [line 598](../../../apps/web/src/pages/regulatory.tsx#L598)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 857>** (`Select`, [line 857](../../../apps/web/src/pages/regulatory.tsx#L857)) — accepts input, default value sensible, persists after refresh
- [ ] **Drug Name** (`TextInput`, [line 918](../../../apps/web/src/pages/regulatory.tsx#L918)) — accepts input, default value sensible, persists after refresh
- [ ] **Generic Name** (`TextInput`, [line 919](../../../apps/web/src/pages/regulatory.tsx#L919)) — accepts input, default value sensible, persists after refresh
- [ ] **Batch Number** (`TextInput`, [line 920](../../../apps/web/src/pages/regulatory.tsx#L920)) — accepts input, default value sensible, persists after refresh
- [ ] **Manufacturer** (`TextInput`, [line 921](../../../apps/web/src/pages/regulatory.tsx#L921)) — accepts input, default value sensible, persists after refresh
- [ ] **Reaction Description** (`Textarea`, [line 922](../../../apps/web/src/pages/regulatory.tsx#L922)) — accepts input, default value sensible, persists after refresh
- [ ] **Reaction Date** (`DateInput`, [line 923](../../../apps/web/src/pages/regulatory.tsx#L923)) — accepts input, default value sensible, persists after refresh
- [ ] **Severity** (`Select`, [line 924](../../../apps/web/src/pages/regulatory.tsx#L924)) — accepts input, default value sensible, persists after refresh
- [ ] **Causality Assessment** (`Select`, [line 936](../../../apps/web/src/pages/regulatory.tsx#L936)) — accepts input, default value sensible, persists after refresh
- [ ] **Device Name** (`TextInput`, [line 957](../../../apps/web/src/pages/regulatory.tsx#L957)) — accepts input, default value sensible, persists after refresh
- [ ] **Manufacturer** (`TextInput`, [line 958](../../../apps/web/src/pages/regulatory.tsx#L958)) — accepts input, default value sensible, persists after refresh
- [ ] **Model** (`TextInput`, [line 959](../../../apps/web/src/pages/regulatory.tsx#L959)) — accepts input, default value sensible, persists after refresh
- [ ] **Batch/Lot** (`TextInput`, [line 960](../../../apps/web/src/pages/regulatory.tsx#L960)) — accepts input, default value sensible, persists after refresh
- [ ] **Event Description** (`Textarea`, [line 961](../../../apps/web/src/pages/regulatory.tsx#L961)) — accepts input, default value sensible, persists after refresh
- [ ] **Event Date** (`DateInput`, [line 962](../../../apps/web/src/pages/regulatory.tsx#L962)) — accepts input, default value sensible, persists after refresh
- [ ] **Severity** (`Select`, [line 963](../../../apps/web/src/pages/regulatory.tsx#L963)) — accepts input, default value sensible, persists after refresh
- [ ] **Device Action** (`Select`, [line 975](../../../apps/web/src/pages/regulatory.tsx#L975)) — accepts input, default value sensible, persists after refresh
- [ ] **Procedure Type** (`Select`, [line 1083](../../../apps/web/src/pages/regulatory.tsx#L1083)) — accepts input, default value sensible, persists after refresh
- [ ] **Medical Indication** (`Textarea`, [line 1095](../../../apps/web/src/pages/regulatory.tsx#L1095)) — accepts input, default value sensible, persists after refresh
- [ ] **Gestational Age (weeks)** (`NumberInput`, [line 1096](../../../apps/web/src/pages/regulatory.tsx#L1096)) — accepts input, default value sensible, persists after refresh
- [ ] **Doctor's Declaration** (`Textarea`, [line 1097](../../../apps/web/src/pages/regulatory.tsx#L1097)) — accepts input, default value sensible, persists after refresh
- [ ] **Title** (`TextInput`, [line 1203](../../../apps/web/src/pages/regulatory.tsx#L1203)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 1204](../../../apps/web/src/pages/regulatory.tsx#L1204)) — accepts input, default value sensible, persists after refresh
- [ ] **Event Type** (`Select`, [line 1205](../../../apps/web/src/pages/regulatory.tsx#L1205)) — accepts input, default value sensible, persists after refresh
- [ ] **Due Date** (`DateInput`, [line 1220](../../../apps/web/src/pages/regulatory.tsx#L1220)) — accepts input, default value sensible, persists after refresh
- [ ] **Recurrence** (`Select`, [line 1221](../../../apps/web/src/pages/regulatory.tsx#L1221)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1271>** (`Select`, [line 1271](../../../apps/web/src/pages/regulatory.tsx#L1271)) — accepts input, default value sensible, persists after refresh
- [ ] **Submission Type** (`Select`, [line 1585](../../../apps/web/src/pages/regulatory.tsx#L1585)) — accepts input, default value sensible, persists after refresh
- [ ] **Submitted To** (`TextInput`, [line 1592](../../../apps/web/src/pages/regulatory.tsx#L1592)) — accepts input, default value sensible, persists after refresh
- [ ] **Reference Number** (`TextInput`, [line 1593](../../../apps/web/src/pages/regulatory.tsx#L1593)) — accepts input, default value sensible, persists after refresh
- [ ] **Submission Date** (`DateInput`, [line 1594](../../../apps/web/src/pages/regulatory.tsx#L1594)) — accepts input, default value sensible, persists after refresh
- [ ] **Status** (`Select`, [line 1595](../../../apps/web/src/pages/regulatory.tsx#L1595)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1601](../../../apps/web/src/pages/regulatory.tsx#L1601)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 1679](../../../apps/web/src/pages/regulatory.tsx#L1679)) — accepts input, default value sensible, persists after refresh
- [ ] **Accreditation Body** (`Select`, [line 1680](../../../apps/web/src/pages/regulatory.tsx#L1680)) — accepts input, default value sensible, persists after refresh
- [ ] **Standard Code** (`TextInput`, [line 1694](../../../apps/web/src/pages/regulatory.tsx#L1694)) — accepts input, default value sensible, persists after refresh
- [ ] **Assessment Start** (`DateInput`, [line 1695](../../../apps/web/src/pages/regulatory.tsx#L1695)) — accepts input, default value sensible, persists after refresh
- [ ] **Assessment End** (`DateInput`, [line 1696](../../../apps/web/src/pages/regulatory.tsx#L1696)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 17, `<ActionIcon>`: 3, `<Menu.Item>`: 0)

- [ ] **<button @ line 443>** ([line 443](../../../apps/web/src/pages/regulatory.tsx#L443)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 443>** ([line 443](../../../apps/web/src/pages/regulatory.tsx#L443)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 512>** ([line 512](../../../apps/web/src/pages/regulatory.tsx#L512)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 512>** ([line 512](../../../apps/web/src/pages/regulatory.tsx#L512)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 560>** ([line 560](../../../apps/web/src/pages/regulatory.tsx#L560)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 560>** ([line 560](../../../apps/web/src/pages/regulatory.tsx#L560)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 640>** ([line 640](../../../apps/web/src/pages/regulatory.tsx#L640)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 640>** ([line 640](../../../apps/web/src/pages/regulatory.tsx#L640)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **} variant="light" size="sm">             Export Report** ([line 702](../../../apps/web/src/pages/regulatory.tsx#L702)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **} variant="light" size="sm">             Export Report** ([line 702](../../../apps/web/src/pages/regulatory.tsx#L702)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 843>** ([line 843](../../../apps/web/src/pages/regulatory.tsx#L843)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 843>** ([line 843](../../../apps/web/src/pages/regulatory.tsx#L843)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 848>** ([line 848](../../../apps/web/src/pages/regulatory.tsx#L848)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 848>** ([line 848](../../../apps/web/src/pages/regulatory.tsx#L848)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 948>** ([line 948](../../../apps/web/src/pages/regulatory.tsx#L948)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 948>** ([line 948](../../../apps/web/src/pages/regulatory.tsx#L948)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 986>** ([line 986](../../../apps/web/src/pages/regulatory.tsx#L986)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 986>** ([line 986](../../../apps/web/src/pages/regulatory.tsx#L986)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1039>** ([line 1039](../../../apps/web/src/pages/regulatory.tsx#L1039)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1039>** ([line 1039](../../../apps/web/src/pages/regulatory.tsx#L1039)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1103>** ([line 1103](../../../apps/web/src/pages/regulatory.tsx#L1103)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1103>** ([line 1103](../../../apps/web/src/pages/regulatory.tsx#L1103)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1168>** ([line 1168](../../../apps/web/src/pages/regulatory.tsx#L1168)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1168>** ([line 1168](../../../apps/web/src/pages/regulatory.tsx#L1168)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1233>** ([line 1233](../../../apps/web/src/pages/regulatory.tsx#L1233)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1233>** ([line 1233](../../../apps/web/src/pages/regulatory.tsx#L1233)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1562>** ([line 1562](../../../apps/web/src/pages/regulatory.tsx#L1562)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1562>** ([line 1562](../../../apps/web/src/pages/regulatory.tsx#L1562)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1602>** ([line 1602](../../../apps/web/src/pages/regulatory.tsx#L1602)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1602>** ([line 1602](../../../apps/web/src/pages/regulatory.tsx#L1602)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1647>** ([line 1647](../../../apps/web/src/pages/regulatory.tsx#L1647)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1647>** ([line 1647](../../../apps/web/src/pages/regulatory.tsx#L1647)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1697>** ([line 1697](../../../apps/web/src/pages/regulatory.tsx#L1697)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1697>** ([line 1697](../../../apps/web/src/pages/regulatory.tsx#L1697)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 886>** ([line 886](../../../apps/web/src/pages/regulatory.tsx#L886)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 908>** ([line 908](../../../apps/web/src/pages/regulatory.tsx#L908)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1302>** ([line 1302](../../../apps/web/src/pages/regulatory.tsx#L1302)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (27)

- [ ] `api.autoPopulateChecklist` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAdrReport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCalendarEvent` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createChecklist` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createMockSurvey` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createMvReport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPcpndtForm` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRegulatorySubmission` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getComplianceGaps` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getOverdueCalendarEvents` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getRegulatoryDashboard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.licenseDashboard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAccreditationCompliance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAccreditationStandards` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAdrReports` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCalendarEvents` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listChecklists` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMockSurveys` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMvReports` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPcpndtForms` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRegulatorySubmissions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.nablDocumentTracking` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.staffCredentials` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.submitAdrToPvpi` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.submitMvToCdsco` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateAccreditationCompliance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateCalendarEvent` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._