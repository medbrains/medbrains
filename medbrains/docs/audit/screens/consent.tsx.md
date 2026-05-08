# `consent.tsx` walkthrough

_Source: [`apps/web/src/pages/consent.tsx`](../../../apps/web/src/pages/consent.tsx) (1757 lines). Guard: `P.CONSENT.TEMPLATES_LIST`. API methods: 10. useForm: 0. Tables: 4. Modals: 6._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.CONSENT.TEMPLATES_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Templates** (`templates`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Templates** (`templates`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Templates** (`templates`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Audit Trail** (`audit`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Audit Trail** (`audit`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Audit Trail** (`audit`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Verification** (`verification`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Verification** (`verification`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Verification** (`verification`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Signatures** (`signatures`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Signatures** (`signatures`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Signatures** (`signatures`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (24)
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Ver** (`version`) renders without `undefined` / `[object Object]`
- [ ] Column **Validity** (`validity`) renders without `undefined` / `[object Object]`
- [ ] Column **Requirements** (`flags`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`active`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Source** (`consent_source`) renders without `undefined` / `[object Object]`
- [ ] Column **Action** (`action`) renders without `undefined` / `[object Object]`
- [ ] Column **Status Change** (`status_change`) renders without `undefined` / `[object Object]`
- [ ] Column **Changed By** (`changed_by`) renders without `undefined` / `[object Object]`
- [ ] Column **Reason** (`change_reason`) renders without `undefined` / `[object Object]`
- [ ] Column **Timestamp** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`consent_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Source** (`source`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Valid Until** (`valid_until`) renders without `undefined` / `[object Object]`
- [ ] Column **Consent ID** (`consent_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Source** (`consent_source`) renders without `undefined` / `[object Object]`
- [ ] Column **Consent ID** (`consent_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`signature_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Witness** (`witness_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Captured** (`captured_at`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Modal — _<modal @ line 1279>_ @ [line 1279](../../../apps/web/src/pages/consent.tsx#L1279)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 1602>_ @ [line 1602](../../../apps/web/src/pages/consent.tsx#L1602)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _<drawer @ line 418>_ @ [line 418](../../../apps/web/src/pages/consent.tsx#L418)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Death Certificate — Form 4 / 4A_ @ [line 440](../../../apps/web/src/pages/consent.tsx#L440)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Medico-Legal Opinion_ @ [line 452](../../../apps/web/src/pages/consent.tsx#L452)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Signature_ @ [line 1599](../../../apps/web/src/pages/consent.tsx#L1599)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (72)

- [ ] **<Select @ line 375>** (`Select`, [line 375](../../../apps/web/src/pages/consent.tsx#L375)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 533](../../../apps/web/src/pages/consent.tsx#L533)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 540](../../../apps/web/src/pages/consent.tsx#L540)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 541](../../../apps/web/src/pages/consent.tsx#L541)) — accepts input, default value sensible, persists after refresh
- [ ] **Version** (`NumberInput`, [line 542](../../../apps/web/src/pages/consent.tsx#L542)) — accepts input, default value sensible, persists after refresh
- [ ] **Body Text (JSON by language)** (`JsonInput`, [line 548](../../../apps/web/src/pages/consent.tsx#L548)) — accepts input, default value sensible, persists after refresh
- [ ] **Risks Section (optional)** (`JsonInput`, [line 556](../../../apps/web/src/pages/consent.tsx#L556)) — accepts input, default value sensible, persists after refresh
- [ ] **Alternatives Section (optional)** (`JsonInput`, [line 564](../../../apps/web/src/pages/consent.tsx#L564)) — accepts input, default value sensible, persists after refresh
- [ ] **Benefits Section (optional)** (`JsonInput`, [line 572](../../../apps/web/src/pages/consent.tsx#L572)) — accepts input, default value sensible, persists after refresh
- [ ] **Required Fields** (`MultiSelect`, [line 580](../../../apps/web/src/pages/consent.tsx#L580)) — accepts input, default value sensible, persists after refresh
- [ ] **Requires Witness** (`Switch`, [line 587](../../../apps/web/src/pages/consent.tsx#L587)) — accepts input, default value sensible, persists after refresh
- [ ] **Requires Doctor** (`Switch`, [line 592](../../../apps/web/src/pages/consent.tsx#L592)) — accepts input, default value sensible, persists after refresh
- [ ] **Read-Aloud Required** (`Switch`, [line 597](../../../apps/web/src/pages/consent.tsx#L597)) — accepts input, default value sensible, persists after refresh
- [ ] **Active** (`Switch`, [line 602](../../../apps/web/src/pages/consent.tsx#L602)) — accepts input, default value sensible, persists after refresh
- [ ] **Validity (days, blank = no expiry)** (`NumberInput`, [line 608](../../../apps/web/src/pages/consent.tsx#L608)) — accepts input, default value sensible, persists after refresh
- [ ] **Sort Order** (`NumberInput`, [line 614](../../../apps/web/src/pages/consent.tsx#L614)) — accepts input, default value sensible, persists after refresh
- [ ] **Form Type** (`Radio`, [line 695](../../../apps/web/src/pages/consent.tsx#L695)) — accepts input, default value sensible, persists after refresh
- [ ] **Form 4 — Certificate of Cause of Death** (`Radio`, [line 697](../../../apps/web/src/pages/consent.tsx#L697)) — accepts input, default value sensible, persists after refresh
- [ ] **Form 4A — Certificate (Institutional)** (`Radio`, [line 698](../../../apps/web/src/pages/consent.tsx#L698)) — accepts input, default value sensible, persists after refresh
- [ ] **Name of Deceased** (`TextInput`, [line 706](../../../apps/web/src/pages/consent.tsx#L706)) — accepts input, default value sensible, persists after refresh
- [ ] **Age (years)** (`NumberInput`, [line 714](../../../apps/web/src/pages/consent.tsx#L714)) — accepts input, default value sensible, persists after refresh
- [ ] **Sex** (`Select`, [line 717](../../../apps/web/src/pages/consent.tsx#L717)) — accepts input, default value sensible, persists after refresh
- [ ] **Date of Death** (`TextInput`, [line 732](../../../apps/web/src/pages/consent.tsx#L732)) — accepts input, default value sensible, persists after refresh
- [ ] **Time of Death** (`TextInput`, [line 741](../../../apps/web/src/pages/consent.tsx#L741)) — accepts input, default value sensible, persists after refresh
- [ ] **Place of Death** (`TextInput`, [line 750](../../../apps/web/src/pages/consent.tsx#L750)) — accepts input, default value sensible, persists after refresh
- [ ] **(a) Immediate Cause** (`TextInput`, [line 763](../../../apps/web/src/pages/consent.tsx#L763)) — accepts input, default value sensible, persists after refresh
- [ ] **(b) Antecedent Cause** (`TextInput`, [line 770](../../../apps/web/src/pages/consent.tsx#L770)) — accepts input, default value sensible, persists after refresh
- [ ] **(c) Underlying Cause** (`TextInput`, [line 776](../../../apps/web/src/pages/consent.tsx#L776)) — accepts input, default value sensible, persists after refresh
- [ ] **Other Significant Conditions** (`Textarea`, [line 787](../../../apps/web/src/pages/consent.tsx#L787)) — accepts input, default value sensible, persists after refresh
- [ ] **Manner of Death** (`Select`, [line 798](../../../apps/web/src/pages/consent.tsx#L798)) — accepts input, default value sensible, persists after refresh
- [ ] **Duration of Illness** (`TextInput`, [line 806](../../../apps/web/src/pages/consent.tsx#L806)) — accepts input, default value sensible, persists after refresh
- [ ] **Autopsy Requested** (`Switch`, [line 816](../../../apps/web/src/pages/consent.tsx#L816)) — accepts input, default value sensible, persists after refresh
- [ ] **Medico-Legal Case** (`Switch`, [line 821](../../../apps/web/src/pages/consent.tsx#L821)) — accepts input, default value sensible, persists after refresh
- [ ] **Certifying Doctor Name** (`TextInput`, [line 839](../../../apps/web/src/pages/consent.tsx#L839)) — accepts input, default value sensible, persists after refresh
- [ ] **Medical Registration No.** (`TextInput`, [line 847](../../../apps/web/src/pages/consent.tsx#L847)) — accepts input, default value sensible, persists after refresh
- [ ] **Witness Name** (`TextInput`, [line 855](../../../apps/web/src/pages/consent.tsx#L855)) — accepts input, default value sensible, persists after refresh
- [ ] **Additional Notes** (`Textarea`, [line 860](../../../apps/web/src/pages/consent.tsx#L860)) — accepts input, default value sensible, persists after refresh
- [ ] **Case Reference / FIR No.** (`TextInput`, [line 957](../../../apps/web/src/pages/consent.tsx#L957)) — accepts input, default value sensible, persists after refresh
- [ ] **Date of Examination** (`TextInput`, [line 966](../../../apps/web/src/pages/consent.tsx#L966)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient Name** (`TextInput`, [line 980](../../../apps/web/src/pages/consent.tsx#L980)) — accepts input, default value sensible, persists after refresh
- [ ] **Age** (`NumberInput`, [line 988](../../../apps/web/src/pages/consent.tsx#L988)) — accepts input, default value sensible, persists after refresh
- [ ] **Sex** (`Select`, [line 991](../../../apps/web/src/pages/consent.tsx#L991)) — accepts input, default value sensible, persists after refresh
- [ ] **History of Incident** (`Textarea`, [line 1006](../../../apps/web/src/pages/consent.tsx#L1006)) — accepts input, default value sensible, persists after refresh
- [ ] **Findings on Examination** (`Textarea`, [line 1015](../../../apps/web/src/pages/consent.tsx#L1015)) — accepts input, default value sensible, persists after refresh
- [ ] **Investigations Done** (`Textarea`, [line 1024](../../../apps/web/src/pages/consent.tsx#L1024)) — accepts input, default value sensible, persists after refresh
- [ ] **Opinion** (`Textarea`, [line 1034](../../../apps/web/src/pages/consent.tsx#L1034)) — accepts input, default value sensible, persists after refresh
- [ ] **Classification of Injury** (`Select`, [line 1045](../../../apps/web/src/pages/consent.tsx#L1045)) — accepts input, default value sensible, persists after refresh
- [ ] **Weapon/Object Used (Likely)** (`TextInput`, [line 1054](../../../apps/web/src/pages/consent.tsx#L1054)) — accepts input, default value sensible, persists after refresh
- [ ] **Time Since Injury (Estimate)** (`TextInput`, [line 1063](../../../apps/web/src/pages/consent.tsx#L1063)) — accepts input, default value sensible, persists after refresh
- [ ] **Fitness for Discharge** (`Radio`, [line 1072](../../../apps/web/src/pages/consent.tsx#L1072)) — accepts input, default value sensible, persists after refresh
- [ ] **Yes — Fit for discharge** (`Radio`, [line 1078](../../../apps/web/src/pages/consent.tsx#L1078)) — accepts input, default value sensible, persists after refresh
- [ ] **No — Requires admission** (`Radio`, [line 1079](../../../apps/web/src/pages/consent.tsx#L1079)) — accepts input, default value sensible, persists after refresh
- [ ] **Conditional — With restrictions** (`Radio`, [line 1080](../../../apps/web/src/pages/consent.tsx#L1080)) — accepts input, default value sensible, persists after refresh
- [ ] **Discharge Conditions** (`Textarea`, [line 1085](../../../apps/web/src/pages/consent.tsx#L1085)) — accepts input, default value sensible, persists after refresh
- [ ] **Examining Doctor Name** (`TextInput`, [line 1098](../../../apps/web/src/pages/consent.tsx#L1098)) — accepts input, default value sensible, persists after refresh
- [ ] **Medical Registration No.** (`TextInput`, [line 1106](../../../apps/web/src/pages/consent.tsx#L1106)) — accepts input, default value sensible, persists after refresh
- [ ] **Additional Notes** (`Textarea`, [line 1115](../../../apps/web/src/pages/consent.tsx#L1115)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1239>** (`TextInput`, [line 1239](../../../apps/web/src/pages/consent.tsx#L1239)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1246>** (`Select`, [line 1246](../../../apps/web/src/pages/consent.tsx#L1246)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1265>** (`Select`, [line 1265](../../../apps/web/src/pages/consent.tsx#L1265)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1440>** (`TextInput`, [line 1440](../../../apps/web/src/pages/consent.tsx#L1440)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1581>** (`Select`, [line 1581](../../../apps/web/src/pages/consent.tsx#L1581)) — accepts input, default value sensible, persists after refresh
- [ ] **Consent Source** (`Select`, [line 1693](../../../apps/web/src/pages/consent.tsx#L1693)) — accepts input, default value sensible, persists after refresh
- [ ] **Consent ID (UUID)** (`TextInput`, [line 1703](../../../apps/web/src/pages/consent.tsx#L1703)) — accepts input, default value sensible, persists after refresh
- [ ] **Signature Type** (`Select`, [line 1709](../../../apps/web/src/pages/consent.tsx#L1709)) — accepts input, default value sensible, persists after refresh
- [ ] **Signature Image URL** (`TextInput`, [line 1716](../../../apps/web/src/pages/consent.tsx#L1716)) — accepts input, default value sensible, persists after refresh
- [ ] **Video Consent URL** (`TextInput`, [line 1721](../../../apps/web/src/pages/consent.tsx#L1721)) — accepts input, default value sensible, persists after refresh
- [ ] **Aadhaar e-Sign Reference** (`TextInput`, [line 1726](../../../apps/web/src/pages/consent.tsx#L1726)) — accepts input, default value sensible, persists after refresh
- [ ] **Witness Name** (`TextInput`, [line 1731](../../../apps/web/src/pages/consent.tsx#L1731)) — accepts input, default value sensible, persists after refresh
- [ ] **Witness Designation** (`Textarea`, [line 1736](../../../apps/web/src/pages/consent.tsx#L1736)) — accepts input, default value sensible, persists after refresh
- [ ] **Witness Signature URL** (`TextInput`, [line 1741](../../../apps/web/src/pages/consent.tsx#L1741)) — accepts input, default value sensible, persists after refresh
- [ ] **Doctor Signature URL** (`TextInput`, [line 1746](../../../apps/web/src/pages/consent.tsx#L1746)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 9, `<ActionIcon>`: 6, `<Menu.Item>`: 0)

- [ ] **<button @ line 385>** ([line 385](../../../apps/web/src/pages/consent.tsx#L385)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 385>** ([line 385](../../../apps/web/src/pages/consent.tsx#L385)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 395>** ([line 395](../../../apps/web/src/pages/consent.tsx#L395)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 395>** ([line 395](../../../apps/web/src/pages/consent.tsx#L395)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 405>** ([line 405](../../../apps/web/src/pages/consent.tsx#L405)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 405>** ([line 405](../../../apps/web/src/pages/consent.tsx#L405)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 615>** ([line 615](../../../apps/web/src/pages/consent.tsx#L615)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 615>** ([line 615](../../../apps/web/src/pages/consent.tsx#L615)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **}       >         Create Death Certificate Template** ([line 867](../../../apps/web/src/pages/consent.tsx#L867)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **}       >         Create Death Certificate Template** ([line 867](../../../apps/web/src/pages/consent.tsx#L867)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **}       >         Create Medico-Legal Opinion Template** ([line 1122](../../../apps/web/src/pages/consent.tsx#L1122)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **}       >         Create Medico-Legal Opinion Template** ([line 1122](../../../apps/web/src/pages/consent.tsx#L1122)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1450>** ([line 1450](../../../apps/web/src/pages/consent.tsx#L1450)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1450>** ([line 1450](../../../apps/web/src/pages/consent.tsx#L1450)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1593>** ([line 1593](../../../apps/web/src/pages/consent.tsx#L1593)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1593>** ([line 1593](../../../apps/web/src/pages/consent.tsx#L1593)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Record Signature** ([line 1751](../../../apps/web/src/pages/consent.tsx#L1751)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Record Signature** ([line 1751](../../../apps/web/src/pages/consent.tsx#L1751)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 318>** ([line 318](../../../apps/web/src/pages/consent.tsx#L318)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 331>** ([line 331](../../../apps/web/src/pages/consent.tsx#L331)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1224>** ([line 1224](../../../apps/web/src/pages/consent.tsx#L1224)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1422>** ([line 1422](../../../apps/web/src/pages/consent.tsx#L1422)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1554>** ([line 1554](../../../apps/web/src/pages/consent.tsx#L1554)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1563>** ([line 1563](../../../apps/web/src/pages/consent.tsx#L1563)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (10)

- [ ] `api.createConsentSignature` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createConsentTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteConsentSignature` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteConsentTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPatientConsentSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listConsentAudit` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listConsentSignatures` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listConsentTemplates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.revokeConsent` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateConsentTemplate` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._