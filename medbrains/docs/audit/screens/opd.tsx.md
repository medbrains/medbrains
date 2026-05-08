# `opd.tsx` walkthrough

_Source: [`apps/web/src/pages/opd.tsx`](../../../apps/web/src/pages/opd.tsx) (3881 lines). Guard: `P.OPD.QUEUE_LIST`. API methods: 61. useForm: 0. Tables: 11. Modals: 10._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.OPD.QUEUE_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Vitals** (`vitals`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Vitals** (`vitals`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Vitals** (`vitals`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Consultation** (`consultation`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Consultation** (`consultation`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Consultation** (`consultation`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>History** (`history`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>History** (`history`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>History** (`history`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>ROS** (`ros`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>ROS** (`ros`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>ROS** (`ros`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Physical Exam** (`physical-exam`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Physical Exam** (`physical-exam`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Physical Exam** (`physical-exam`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Diagnoses** (`diagnoses`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Diagnoses** (`diagnoses`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Diagnoses** (`diagnoses`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Investigations** (`investigations`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Investigations** (`investigations`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Investigations** (`investigations`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Procedures** (`procedures`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Procedures** (`procedures`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Procedures** (`procedures`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Prescriptions** (`prescriptions`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Prescriptions** (`prescriptions`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Prescriptions** (`prescriptions`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Referrals** (`referrals`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Referrals** (`referrals`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Referrals** (`referrals`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Rx History** (`rx-history`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Rx History** (`rx-history`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Rx History** (`rx-history`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Charts** (`charts`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Charts** (`charts`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Charts** (`charts`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Timeline** (`timeline`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Timeline** (`timeline`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Timeline** (`timeline`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Certificates** (`certificates`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Certificates** (`certificates`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Certificates** (`certificates`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Follow-up** (`followup`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Follow-up** (`followup`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Follow-up** (`followup`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Reminders** (`reminders`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Reminders** (`reminders`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Reminders** (`reminders`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Feedback** (`feedback`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Feedback** (`feedback`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Feedback** (`feedback`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Consents** (`consents`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Consents** (`consents`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Consents** (`consents`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Pre-Auth** (`pre-auth`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Pre-Auth** (`pre-auth`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Pre-Auth** (`pre-auth`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Docket** (`docket`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Docket** (`docket`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Docket** (`docket`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Pharmacy Dispatch** (`pharmacy-dispatch`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Pharmacy Dispatch** (`pharmacy-dispatch`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Pharmacy Dispatch** (`pharmacy-dispatch`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (21)
- [ ] Column **Token** (`token_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`queue_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Drug** (`drug_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Ordered** (`quantity_ordered`) renders without `undefined` / `[object Object]`
- [ ] Column **Dispensed** (`quantity_dispensed`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_name`) renders without `undefined` / `[object Object]`
- [ ] Column **From Dept** (`from_department`) renders without `undefined` / `[object Object]`
- [ ] Column **To Dept** (`to_department`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`referral_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Acknowledged** (`acknowledged_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Completed** (`completed_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department`) renders without `undefined` / `[object Object]`
- [ ] Column **Last Visit** (`last_visit_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Scheduled Follow-up** (`follow_up_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Days Overdue** (`days_overdue`) renders without `undefined` / `[object Object]`

### `<Table>` @ line 1437
  - [ ] Header **Test** column shows correct value for at least one row
  - [ ] Header **Priority** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Ordered** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1786
  - [ ] Header **Drug** column shows correct value for at least one row
  - [ ] Header **Dosage** column shows correct value for at least one row
  - [ ] Header **Freq** column shows correct value for at least one row
  - [ ] Header **Duration** column shows correct value for at least one row
  - [ ] Header **Route** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2395
  - [ ] Header **Procedure** column shows correct value for at least one row
  - [ ] Header **Priority** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Ordered** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2731
  - [ ] Header **Title** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Priority** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 3085
  - [ ] Header **Procedure** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Consented By** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 3250
  - [ ] Header **Insurance** column shows correct value for at least one row
  - [ ] Header **Policy #** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 3362
  - [ ] Header **Insurance** column shows correct value for at least one row
  - [ ] Header **Policy #** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Auth #** column shows correct value for at least one row
  - [ ] Header **Approved Amt** column shows correct value for at least one row
  - [ ] Header **Valid Until** column shows correct value for at least one row
  - [ ] Header **Created** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _New Medical Certificate_ @ [line 1933](../../../apps/web/src/pages/opd.tsx#L1933)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _New Referral_ @ [line 2576](../../../apps/web/src/pages/opd.tsx#L2576)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 2782>_ @ [line 2782](../../../apps/web/src/pages/opd.tsx#L2782)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 2953>_ @ [line 2953](../../../apps/web/src/pages/opd.tsx#L2953)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 3128>_ @ [line 3128](../../../apps/web/src/pages/opd.tsx#L3128)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _New Pre-Authorization Request_ @ [line 3394](../../../apps/web/src/pages/opd.tsx#L3394)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 3646>_ @ [line 3646](../../../apps/web/src/pages/opd.tsx#L3646)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Book Multi-Doctor Appointment_ @ [line 3798](../../../apps/web/src/pages/opd.tsx#L3798)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _New OPD Visit_ @ [line 412](../../../apps/web/src/pages/opd.tsx#L412)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 468>_ @ [line 468](../../../apps/web/src/pages/opd.tsx#L468)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (66)

- [ ] **<TextInput @ line 362>** (`TextInput`, [line 362](../../../apps/web/src/pages/opd.tsx#L362)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 369>** (`Select`, [line 369](../../../apps/web/src/pages/opd.tsx#L369)) — accepts input, default value sensible, persists after refresh
- [ ] **My Patients** (`Select`, [line 383](../../../apps/web/src/pages/opd.tsx#L383)) — accepts input, default value sensible, persists after refresh
- [ ] **My Patients** (`Switch`, [line 392](../../../apps/web/src/pages/opd.tsx#L392)) — accepts input, default value sensible, persists after refresh
- [ ] **Visit Type** (`Select`, [line 414](../../../apps/web/src/pages/opd.tsx#L414)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`Select`, [line 430](../../../apps/web/src/pages/opd.tsx#L430)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 443](../../../apps/web/src/pages/opd.tsx#L443)) — accepts input, default value sensible, persists after refresh
- [ ] **Load from template** (`Select`, [line 1037](../../../apps/web/src/pages/opd.tsx#L1037)) — accepts input, default value sensible, persists after refresh
- [ ] **Lab Test** (`Select`, [line 1362](../../../apps/web/src/pages/opd.tsx#L1362)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 1390](../../../apps/web/src/pages/opd.tsx#L1390)) — accepts input, default value sensible, persists after refresh
- [ ] **Clinical Notes** (`Textarea`, [line 1401](../../../apps/web/src/pages/opd.tsx#L1401)) — accepts input, default value sensible, persists after refresh
- [ ] **Follow-up Date** (`TextInput`, [line 1600](../../../apps/web/src/pages/opd.tsx#L1600)) — accepts input, default value sensible, persists after refresh
- [ ] **Available Slot** (`Select`, [line 1615](../../../apps/web/src/pages/opd.tsx#L1615)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason for Follow-up** (`Textarea`, [line 1629](../../../apps/web/src/pages/opd.tsx#L1629)) — accepts input, default value sensible, persists after refresh
- [ ] **Certificate Type** (`Select`, [line 1935](../../../apps/web/src/pages/opd.tsx#L1935)) — accepts input, default value sensible, persists after refresh
- [ ] **Issued Date** (`TextInput`, [line 1943](../../../apps/web/src/pages/opd.tsx#L1943)) — accepts input, default value sensible, persists after refresh
- [ ] **Valid From** (`TextInput`, [line 1950](../../../apps/web/src/pages/opd.tsx#L1950)) — accepts input, default value sensible, persists after refresh
- [ ] **Valid To** (`TextInput`, [line 1956](../../../apps/web/src/pages/opd.tsx#L1956)) — accepts input, default value sensible, persists after refresh
- [ ] **Diagnosis** (`Textarea`, [line 1963](../../../apps/web/src/pages/opd.tsx#L1963)) — accepts input, default value sensible, persists after refresh
- [ ] **Remarks** (`Textarea`, [line 1971](../../../apps/web/src/pages/opd.tsx#L1971)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 2057>** (`Select`, [line 2057](../../../apps/web/src/pages/opd.tsx#L2057)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 2189>** (`Select`, [line 2189](../../../apps/web/src/pages/opd.tsx#L2189)) — accepts input, default value sensible, persists after refresh
- [ ] **Procedure** (`Select`, [line 2340](../../../apps/web/src/pages/opd.tsx#L2340)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 2358](../../../apps/web/src/pages/opd.tsx#L2358)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 2368](../../../apps/web/src/pages/opd.tsx#L2368)) — accepts input, default value sensible, persists after refresh
- [ ] **Refer to Department** (`Select`, [line 2578](../../../apps/web/src/pages/opd.tsx#L2578)) — accepts input, default value sensible, persists after refresh
- [ ] **Urgency** (`Select`, [line 2587](../../../apps/web/src/pages/opd.tsx#L2587)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason for Referral** (`Textarea`, [line 2597](../../../apps/web/src/pages/opd.tsx#L2597)) — accepts input, default value sensible, persists after refresh
- [ ] **Clinical Notes** (`Textarea`, [line 2606](../../../apps/web/src/pages/opd.tsx#L2606)) — accepts input, default value sensible, persists after refresh
- [ ] **Title** (`TextInput`, [line 2784](../../../apps/web/src/pages/opd.tsx#L2784)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 2785](../../../apps/web/src/pages/opd.tsx#L2785)) — accepts input, default value sensible, persists after refresh
- [ ] **Reminder Date** (`TextInput`, [line 2792](../../../apps/web/src/pages/opd.tsx#L2792)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 2799](../../../apps/web/src/pages/opd.tsx#L2799)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 2810](../../../apps/web/src/pages/opd.tsx#L2810)) — accepts input, default value sensible, persists after refresh
- [ ] **Overall Rating** (`Select`, [line 2955](../../../apps/web/src/pages/opd.tsx#L2955)) — accepts input, default value sensible, persists after refresh
- [ ] **Wait Time** (`Select`, [line 2956](../../../apps/web/src/pages/opd.tsx#L2956)) — accepts input, default value sensible, persists after refresh
- [ ] **Staff Courtesy** (`Select`, [line 2957](../../../apps/web/src/pages/opd.tsx#L2957)) — accepts input, default value sensible, persists after refresh
- [ ] **Cleanliness** (`Select`, [line 2958](../../../apps/web/src/pages/opd.tsx#L2958)) — accepts input, default value sensible, persists after refresh
- [ ] **Overall Experience** (`Textarea`, [line 2959](../../../apps/web/src/pages/opd.tsx#L2959)) — accepts input, default value sensible, persists after refresh
- [ ] **Suggestions** (`Textarea`, [line 2966](../../../apps/web/src/pages/opd.tsx#L2966)) — accepts input, default value sensible, persists after refresh
- [ ] **Procedure Name** (`TextInput`, [line 3130](../../../apps/web/src/pages/opd.tsx#L3130)) — accepts input, default value sensible, persists after refresh
- [ ] **Consent Type** (`Select`, [line 3136](../../../apps/web/src/pages/opd.tsx#L3136)) — accepts input, default value sensible, persists after refresh
- [ ] **Risks Explained** (`Textarea`, [line 3142](../../../apps/web/src/pages/opd.tsx#L3142)) — accepts input, default value sensible, persists after refresh
- [ ] **Alternatives Explained** (`Textarea`, [line 3149](../../../apps/web/src/pages/opd.tsx#L3149)) — accepts input, default value sensible, persists after refresh
- [ ] **Benefits Explained** (`Textarea`, [line 3156](../../../apps/web/src/pages/opd.tsx#L3156)) — accepts input, default value sensible, persists after refresh
- [ ] **Consented By (Name)** (`TextInput`, [line 3164](../../../apps/web/src/pages/opd.tsx#L3164)) — accepts input, default value sensible, persists after refresh
- [ ] **Relation to Patient** (`TextInput`, [line 3169](../../../apps/web/src/pages/opd.tsx#L3169)) — accepts input, default value sensible, persists after refresh
- [ ] **Witness Name** (`TextInput`, [line 3175](../../../apps/web/src/pages/opd.tsx#L3175)) — accepts input, default value sensible, persists after refresh
- [ ] **Date** (`TextInput`, [line 3225](../../../apps/web/src/pages/opd.tsx#L3225)) — accepts input, default value sensible, persists after refresh
- [ ] **Insurance Provider** (`TextInput`, [line 3396](../../../apps/web/src/pages/opd.tsx#L3396)) — accepts input, default value sensible, persists after refresh
- [ ] **Policy Number** (`TextInput`, [line 3397](../../../apps/web/src/pages/opd.tsx#L3397)) — accepts input, default value sensible, persists after refresh
- [ ] **Procedure Codes** (`TextInput`, [line 3398](../../../apps/web/src/pages/opd.tsx#L3398)) — accepts input, default value sensible, persists after refresh
- [ ] **Diagnosis Codes** (`TextInput`, [line 3399](../../../apps/web/src/pages/opd.tsx#L3399)) — accepts input, default value sensible, persists after refresh
- [ ] **Estimated Cost (₹)** (`TextInput`, [line 3400](../../../apps/web/src/pages/opd.tsx#L3400)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 3401](../../../apps/web/src/pages/opd.tsx#L3401)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 3485>** (`Select`, [line 3485](../../../apps/web/src/pages/opd.tsx#L3485)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`Select`, [line 3648](../../../apps/web/src/pages/opd.tsx#L3648)) — accepts input, default value sensible, persists after refresh
- [ ] **Ward** (`Select`, [line 3657](../../../apps/web/src/pages/opd.tsx#L3657)) — accepts input, default value sensible, persists after refresh
- [ ] **Bed** (`Select`, [line 3666](../../../apps/web/src/pages/opd.tsx#L3666)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 3676](../../../apps/web/src/pages/opd.tsx#L3676)) — accepts input, default value sensible, persists after refresh
- [ ] **Doctor ${idx + 1}** (`Select`, [line 3806](../../../apps/web/src/pages/opd.tsx#L3806)) — accepts input, default value sensible, persists after refresh
- [ ] **Dept** (`Select`, [line 3816](../../../apps/web/src/pages/opd.tsx#L3816)) — accepts input, default value sensible, persists after refresh
- [ ] **Date** (`TextInput`, [line 3826](../../../apps/web/src/pages/opd.tsx#L3826)) — accepts input, default value sensible, persists after refresh
- [ ] **Start** (`TextInput`, [line 3835](../../../apps/web/src/pages/opd.tsx#L3835)) — accepts input, default value sensible, persists after refresh
- [ ] **End** (`TextInput`, [line 3843](../../../apps/web/src/pages/opd.tsx#L3843)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`TextInput`, [line 3851](../../../apps/web/src/pages/opd.tsx#L3851)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 40, `<ActionIcon>`: 11, `<Menu.Item>`: 0)

- [ ] **<button @ line 346>** ([line 346](../../../apps/web/src/pages/opd.tsx#L346)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 346>** ([line 346](../../../apps/web/src/pages/opd.tsx#L346)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 449>** ([line 449](../../../apps/web/src/pages/opd.tsx#L449)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 449>** ([line 449](../../../apps/web/src/pages/opd.tsx#L449)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **}>Back to Queue** ([line 474](../../../apps/web/src/pages/opd.tsx#L474)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **}>Back to Queue** ([line 474](../../../apps/web/src/pages/opd.tsx#L474)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 653>** ([line 653](../../../apps/web/src/pages/opd.tsx#L653)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 653>** ([line 653](../../../apps/web/src/pages/opd.tsx#L653)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 891>** ([line 891](../../../apps/web/src/pages/opd.tsx#L891)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 891>** ([line 891](../../../apps/web/src/pages/opd.tsx#L891)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Save Review of Systems** ([line 1166](../../../apps/web/src/pages/opd.tsx#L1166)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Save Review of Systems** ([line 1166](../../../apps/web/src/pages/opd.tsx#L1166)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1353>** ([line 1353](../../../apps/web/src/pages/opd.tsx#L1353)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1353>** ([line 1353](../../../apps/web/src/pages/opd.tsx#L1353)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1411>** ([line 1411](../../../apps/web/src/pages/opd.tsx#L1411)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1411>** ([line 1411](../../../apps/web/src/pages/opd.tsx#L1411)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1422>** ([line 1422](../../../apps/web/src/pages/opd.tsx#L1422)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1422>** ([line 1422](../../../apps/web/src/pages/opd.tsx#L1422)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setBooked(false)}>             Schedule Another** ([line 1586](../../../apps/web/src/pages/opd.tsx#L1586)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setBooked(false)}>             Schedule Another** ([line 1586](../../../apps/web/src/pages/opd.tsx#L1586)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1639>** ([line 1639](../../../apps/web/src/pages/opd.tsx#L1639)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1639>** ([line 1639](../../../apps/web/src/pages/opd.tsx#L1639)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1894>** ([line 1894](../../../apps/web/src/pages/opd.tsx#L1894)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1894>** ([line 1894](../../../apps/web/src/pages/opd.tsx#L1894)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 1980](../../../apps/web/src/pages/opd.tsx#L1980)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 1980](../../../apps/web/src/pages/opd.tsx#L1980)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **}             >               Create Certificate** ([line 1981](../../../apps/web/src/pages/opd.tsx#L1981)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **}             >               Create Certificate** ([line 1981](../../../apps/web/src/pages/opd.tsx#L1981)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2331>** ([line 2331](../../../apps/web/src/pages/opd.tsx#L2331)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2331>** ([line 2331](../../../apps/web/src/pages/opd.tsx#L2331)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2377>** ([line 2377](../../../apps/web/src/pages/opd.tsx#L2377)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2377>** ([line 2377](../../../apps/web/src/pages/opd.tsx#L2377)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2380>** ([line 2380](../../../apps/web/src/pages/opd.tsx#L2380)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2380>** ([line 2380](../../../apps/web/src/pages/opd.tsx#L2380)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2534>** ([line 2534](../../../apps/web/src/pages/opd.tsx#L2534)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2534>** ([line 2534](../../../apps/web/src/pages/opd.tsx#L2534)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 2615](../../../apps/web/src/pages/opd.tsx#L2615)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 2615](../../../apps/web/src/pages/opd.tsx#L2615)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **}             >               Create Referral** ([line 2616](../../../apps/web/src/pages/opd.tsx#L2616)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **}             >               Create Referral** ([line 2616](../../../apps/web/src/pages/opd.tsx#L2616)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2722>** ([line 2722](../../../apps/web/src/pages/opd.tsx#L2722)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2722>** ([line 2722](../../../apps/web/src/pages/opd.tsx#L2722)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setShowForm(false)}>Cancel** ([line 2818](../../../apps/web/src/pages/opd.tsx#L2818)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setShowForm(false)}>Cancel** ([line 2818](../../../apps/web/src/pages/opd.tsx#L2818)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Create Reminder** ([line 2819](../../../apps/web/src/pages/opd.tsx#L2819)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Create Reminder** ([line 2819](../../../apps/web/src/pages/opd.tsx#L2819)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2908>** ([line 2908](../../../apps/web/src/pages/opd.tsx#L2908)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2908>** ([line 2908](../../../apps/web/src/pages/opd.tsx#L2908)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setShowForm(false)}>Cancel** ([line 2974](../../../apps/web/src/pages/opd.tsx#L2974)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setShowForm(false)}>Cancel** ([line 2974](../../../apps/web/src/pages/opd.tsx#L2974)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Submit Feedback** ([line 2975](../../../apps/web/src/pages/opd.tsx#L2975)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Submit Feedback** ([line 2975](../../../apps/web/src/pages/opd.tsx#L2975)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3076>** ([line 3076](../../../apps/web/src/pages/opd.tsx#L3076)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3076>** ([line 3076](../../../apps/web/src/pages/opd.tsx#L3076)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setShowForm(false)}>Cancel** ([line 3181](../../../apps/web/src/pages/opd.tsx#L3181)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setShowForm(false)}>Cancel** ([line 3181](../../../apps/web/src/pages/opd.tsx#L3181)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **}             >               Create Consent** ([line 3182](../../../apps/web/src/pages/opd.tsx#L3182)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **}             >               Create Consent** ([line 3182](../../../apps/web/src/pages/opd.tsx#L3182)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3232>** ([line 3232](../../../apps/web/src/pages/opd.tsx#L3232)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3232>** ([line 3232](../../../apps/web/src/pages/opd.tsx#L3232)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3355>** ([line 3355](../../../apps/web/src/pages/opd.tsx#L3355)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3355>** ([line 3355](../../../apps/web/src/pages/opd.tsx#L3355)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 3403](../../../apps/web/src/pages/opd.tsx#L3403)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 3403](../../../apps/web/src/pages/opd.tsx#L3403)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Submit Request** ([line 3404](../../../apps/web/src/pages/opd.tsx#L3404)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Submit Request** ([line 3404](../../../apps/web/src/pages/opd.tsx#L3404)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3643>** ([line 3643](../../../apps/web/src/pages/opd.tsx#L3643)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3643>** ([line 3643](../../../apps/web/src/pages/opd.tsx#L3643)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 3685](../../../apps/web/src/pages/opd.tsx#L3685)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 3685](../../../apps/web/src/pages/opd.tsx#L3685)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Admit Patient** ([line 3686](../../../apps/web/src/pages/opd.tsx#L3686)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Admit Patient** ([line 3686](../../../apps/web/src/pages/opd.tsx#L3686)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3795>** ([line 3795](../../../apps/web/src/pages/opd.tsx#L3795)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3795>** ([line 3795](../../../apps/web/src/pages/opd.tsx#L3795)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 3867](../../../apps/web/src/pages/opd.tsx#L3867)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 3867](../../../apps/web/src/pages/opd.tsx#L3867)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 3871](../../../apps/web/src/pages/opd.tsx#L3871)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 3871](../../../apps/web/src/pages/opd.tsx#L3871)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3872>** ([line 3872](../../../apps/web/src/pages/opd.tsx#L3872)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3872>** ([line 3872](../../../apps/web/src/pages/opd.tsx#L3872)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 294>** ([line 294](../../../apps/web/src/pages/opd.tsx#L294)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 306>** ([line 306](../../../apps/web/src/pages/opd.tsx#L306)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 313>** ([line 313](../../../apps/web/src/pages/opd.tsx#L313)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 320>** ([line 320](../../../apps/web/src/pages/opd.tsx#L320)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 327>** ([line 327](../../../apps/web/src/pages/opd.tsx#L327)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1472>** ([line 1472](../../../apps/web/src/pages/opd.tsx#L1472)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2428>** ([line 2428](../../../apps/web/src/pages/opd.tsx#L2428)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2754>** ([line 2754](../../../apps/web/src/pages/opd.tsx#L2754)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2764>** ([line 2764](../../../apps/web/src/pages/opd.tsx#L2764)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 3111>** ([line 3111](../../../apps/web/src/pages/opd.tsx#L3111)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 3860>** ([line 3860](../../../apps/web/src/pages/opd.tsx#L3860)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (61)

- [ ] `api.admitFromOpd` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.bookAppointment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.bookAppointmentGroup` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.callQueueEntry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.cancelLabOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.cancelProcedureOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.cancelReminder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.checkDuplicateOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.completeQueueEntry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.completeReminder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCertificate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createConsultation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createDiagnosis` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createEncounter` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createFeedback` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createLabOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPreAuthRequest` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPrescription` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createProcedureConsent` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createProcedureOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createReferral` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createReminder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteDiagnosis` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.generateDoctorDocket` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAvailableSlots` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getConsultation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getDoctorDocket` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getTenantSettings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getWaitEstimate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAvailableBeds` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCertificates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listConsultationTemplates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDepartments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDiagnoses` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDoctors` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listLabCatalog` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listLabOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatientAllergies` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatientDiagnoses` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatientFeedback` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] _… 21 more methods_

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._