# `ipd.tsx` walkthrough

_Source: [`apps/web/src/pages/ipd.tsx`](../../../apps/web/src/pages/ipd.tsx) (5922 lines). Guard: `P.IPD.ADMISSIONS_LIST`. API methods: 74. useForm: 0. Tables: 25. Modals: 8._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.IPD.ADMISSIONS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Overview** (`overview`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Overview** (`overview`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Overview** (`overview`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Progress Notes** (`notes`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Progress Notes** (`notes`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Progress Notes** (`notes`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Clinical** (`assessments`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Clinical** (`assessments`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Clinical** (`assessments`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **MAR** (`mar`) — clicking activates the panel + loads its data without console error
- [ ] Tab **MAR** (`mar`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **MAR** (`mar`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Prescriptions** (`prescriptions`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Prescriptions** (`prescriptions`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Prescriptions** (`prescriptions`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **I/O Chart** (`io`) — clicking activates the panel + loads its data without console error
- [ ] Tab **I/O Chart** (`io`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **I/O Chart** (`io`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Nursing** (`nursing`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Nursing** (`nursing`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Nursing** (`nursing`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Attenders** (`attenders`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Attenders** (`attenders`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Attenders** (`attenders`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Clinical Docs** (`clinical-docs`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Clinical Docs** (`clinical-docs`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Clinical Docs** (`clinical-docs`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Checklist** (`checklist`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Checklist** (`checklist`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Checklist** (`checklist`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Transfer** (`transfer`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Transfer** (`transfer`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Transfer** (`transfer`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Investigations** (`investigations`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Investigations** (`investigations`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Investigations** (`investigations`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Billing** (`billing-tab`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Billing** (`billing-tab`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Billing** (`billing-tab`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Insurance/PA** (`insurance-pa`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Insurance/PA** (`insurance-pa`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Insurance/PA** (`insurance-pa`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **MLC** (`mlc-tab`) — clicking activates the panel + loads its data without console error
- [ ] Tab **MLC** (`mlc-tab`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **MLC** (`mlc-tab`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Diet** (`diet-tab`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Diet** (`diet-tab`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Diet** (`diet-tab`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Consents** (`consents-tab`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Consents** (`consents-tab`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Consents** (`consents-tab`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Death Summary** (`death-summary`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Death Summary** (`death-summary`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Death Summary** (`death-summary`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Birth Records** (`birth-records`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Birth Records** (`birth-records`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Birth Records** (`birth-records`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Discharge Summary** (`discharge-summary`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Discharge Summary** (`discharge-summary`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Discharge Summary** (`discharge-summary`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Discharge** (`discharge`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Discharge** (`discharge`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Discharge** (`discharge`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Discharge TAT** (`discharge-tat`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Discharge TAT** (`discharge-tat`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Discharge TAT** (`discharge-tat`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (24)
- [ ] Column **Patient** (`patient_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Ward** (`ward_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Admitted** (`admitted_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`ward_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Beds** (`beds`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Discharge Initiated** (`discharge_initiated_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Billing Cleared** (`billing_cleared_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Pharmacy Cleared** (`pharmacy_cleared_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Nursing Cleared** (`nursing_cleared_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Doctor Cleared** (`doctor_cleared_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Discharge Completed** (`discharge_completed_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Ward** (`ward`) renders without `undefined` / `[object Object]`
- [ ] Column **Bed** (`bed_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Expected Discharge** (`expected_discharge_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Attending Doctor** (`attending_doctor`) renders without `undefined` / `[object Object]`
- [ ] Column **Days Admitted** (`days_admitted`) renders without `undefined` / `[object Object]`

### `<Table>` @ line 885
  - [ ] Header **Done** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Description** column shows correct value for at least one row
  - [ ] Header **Due** column shows correct value for at least one row
  - [ ] Header **Notes** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1336
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Score** column shows correct value for at least one row
  - [ ] Header **Risk** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Drug** column shows correct value for at least one row
  - [ ] Header **Dose** column shows correct value for at least one row
  - [ ] Header **Route** column shows correct value for at least one row
  - [ ] Header **Scheduled** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Double-Check** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1393
  - [ ] Header **Drug** column shows correct value for at least one row
  - [ ] Header **Dose** column shows correct value for at least one row
  - [ ] Header **Route** column shows correct value for at least one row
  - [ ] Header **Scheduled** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Double-Check** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1535
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Category** column shows correct value for at least one row
  - [ ] Header **Volume (ml)** column shows correct value for at least one row
  - [ ] Header **Shift** column shows correct value for at least one row
  - [ ] Header **Time** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1819
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Relationship** column shows correct value for at least one row
  - [ ] Header **Phone** column shows correct value for at least one row
  - [ ] Header **Primary** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2623
  - [ ] Header **Bed** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Patient** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Header **IP Type** column shows correct value for at least one row
  - [ ] Header **Label** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2745
  - [ ] Header **IP Type** column shows correct value for at least one row
  - [ ] Header **Label** column shows correct value for at least one row
  - [ ] Header **Daily Rate** column shows correct value for at least one row
  - [ ] Header **Nursing Charge** column shows correct value for at least one row
  - [ ] Header **Deposit** column shows correct value for at least one row
  - [ ] Header **Billing Threshold** column shows correct value for at least one row
  - [ ] Header **Auto-Billing** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 3137
  - [ ] Header **Ward** column shows correct value for at least one row
  - [ ] Header **Total Beds** column shows correct value for at least one row
  - [ ] Header **Occupied** column shows correct value for at least one row
  - [ ] Header **Vacant** column shows correct value for at least one row
  - [ ] Header **Department** column shows correct value for at least one row
  - [ ] Header **Discharge Type** column shows correct value for at least one row
  - [ ] Header **Avg LOS (days)** column shows correct value for at least one row
  - [ ] Header **Count** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 3251
  - [ ] Header **Department** column shows correct value for at least one row
  - [ ] Header **Discharge Type** column shows correct value for at least one row
  - [ ] Header **Avg LOS (days)** column shows correct value for at least one row
  - [ ] Header **Count** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

_… 15 more tables — list capped to keep checklist usable_
## Modals / Drawers

### Modal — _Discharge Summary_ @ [line 5622](../../../apps/web/src/pages/ipd.tsx#L5622)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Bed Transfer_ @ [line 5735](../../../apps/web/src/pages/ipd.tsx#L5735)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _Admission Detail_ @ [line 363](../../../apps/web/src/pages/ipd.tsx#L363)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Admission_ @ [line 438](../../../apps/web/src/pages/ipd.tsx#L438)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 2413>_ @ [line 2413](../../../apps/web/src/pages/ipd.tsx#L2413)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Ward_ @ [line 2450](../../../apps/web/src/pages/ipd.tsx#L2450)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 2518>_ @ [line 2518](../../../apps/web/src/pages/ipd.tsx#L2518)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 4776>_ @ [line 4776](../../../apps/web/src/pages/ipd.tsx#L4776)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (117)

- [ ] **<Select @ line 330>** (`Select`, [line 330](../../../apps/web/src/pages/ipd.tsx#L330)) — accepts input, default value sensible, persists after refresh
- [ ] **Admission Source** (`Select`, [line 450](../../../apps/web/src/pages/ipd.tsx#L450)) — accepts input, default value sensible, persists after refresh
- [ ] **Referral From** (`TextInput`, [line 465](../../../apps/web/src/pages/ipd.tsx#L465)) — accepts input, default value sensible, persists after refresh
- [ ] **Referral Doctor** (`TextInput`, [line 470](../../../apps/web/src/pages/ipd.tsx#L470)) — accepts input, default value sensible, persists after refresh
- [ ] **Referral Notes** (`Textarea`, [line 475](../../../apps/web/src/pages/ipd.tsx#L475)) — accepts input, default value sensible, persists after refresh
- [ ] **Weight (kg)** (`NumberInput`, [line 483](../../../apps/web/src/pages/ipd.tsx#L483)) — accepts input, default value sensible, persists after refresh
- [ ] **Height (cm)** (`NumberInput`, [line 491](../../../apps/web/src/pages/ipd.tsx#L491)) — accepts input, default value sensible, persists after refresh
- [ ] **Expected Discharge Date** (`TextInput`, [line 500](../../../apps/web/src/pages/ipd.tsx#L500)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 506](../../../apps/web/src/pages/ipd.tsx#L506)) — accepts input, default value sensible, persists after refresh
- [ ] **Task Type** (`Select`, [line 856](../../../apps/web/src/pages/ipd.tsx#L856)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`TextInput`, [line 863](../../../apps/web/src/pages/ipd.tsx#L863)) — accepts input, default value sensible, persists after refresh
- [ ] **Assigned To (User ID)** (`TextInput`, [line 868](../../../apps/web/src/pages/ipd.tsx#L868)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`TextInput`, [line 872](../../../apps/web/src/pages/ipd.tsx#L872)) — accepts input, default value sensible, persists after refresh
- [ ] **<Checkbox @ line 899>** (`Checkbox`, [line 899](../../../apps/web/src/pages/ipd.tsx#L899)) — accepts input, default value sensible, persists after refresh
- [ ] **Note Type** (`Select`, [line 971](../../../apps/web/src/pages/ipd.tsx#L971)) — accepts input, default value sensible, persists after refresh
- [ ] **Subjective** (`Textarea`, [line 984](../../../apps/web/src/pages/ipd.tsx#L984)) — accepts input, default value sensible, persists after refresh
- [ ] **Objective** (`Textarea`, [line 989](../../../apps/web/src/pages/ipd.tsx#L989)) — accepts input, default value sensible, persists after refresh
- [ ] **Assessment** (`Textarea`, [line 994](../../../apps/web/src/pages/ipd.tsx#L994)) — accepts input, default value sensible, persists after refresh
- [ ] **Plan** (`Textarea`, [line 999](../../../apps/web/src/pages/ipd.tsx#L999)) — accepts input, default value sensible, persists after refresh
- [ ] **Assessment Type** (`Select`, [line 1167](../../../apps/web/src/pages/ipd.tsx#L1167)) — accepts input, default value sensible, persists after refresh
- [ ] **Sensory perception** (`NumberInput`, [line 1193](../../../apps/web/src/pages/ipd.tsx#L1193)) — accepts input, default value sensible, persists after refresh
- [ ] **Moisture** (`NumberInput`, [line 1200](../../../apps/web/src/pages/ipd.tsx#L1200)) — accepts input, default value sensible, persists after refresh
- [ ] **Activity** (`NumberInput`, [line 1207](../../../apps/web/src/pages/ipd.tsx#L1207)) — accepts input, default value sensible, persists after refresh
- [ ] **Mobility** (`NumberInput`, [line 1214](../../../apps/web/src/pages/ipd.tsx#L1214)) — accepts input, default value sensible, persists after refresh
- [ ] **Nutrition** (`NumberInput`, [line 1221](../../../apps/web/src/pages/ipd.tsx#L1221)) — accepts input, default value sensible, persists after refresh
- [ ] **Friction / shear** (`NumberInput`, [line 1228](../../../apps/web/src/pages/ipd.tsx#L1228)) — accepts input, default value sensible, persists after refresh
- [ ] **Pressure injury observed during this assessment** (`Checkbox`, [line 1244](../../../apps/web/src/pages/ipd.tsx#L1244)) — accepts input, default value sensible, persists after refresh
- [ ] **Injury stage** (`Select`, [line 1251](../../../apps/web/src/pages/ipd.tsx#L1251)) — accepts input, default value sensible, persists after refresh
- [ ] **Injury location** (`TextInput`, [line 1265](../../../apps/web/src/pages/ipd.tsx#L1265)) — accepts input, default value sensible, persists after refresh
- [ ] **Acquired** (`Select`, [line 1270](../../../apps/web/src/pages/ipd.tsx#L1270)) — accepts input, default value sensible, persists after refresh
- [ ] **Repositioning plan** (`TextInput`, [line 1280](../../../apps/web/src/pages/ipd.tsx#L1280)) — accepts input, default value sensible, persists after refresh
- [ ] **Nutritional plan** (`TextInput`, [line 1285](../../../apps/web/src/pages/ipd.tsx#L1285)) — accepts input, default value sensible, persists after refresh
- [ ] **Skin care plan** (`TextInput`, [line 1290](../../../apps/web/src/pages/ipd.tsx#L1290)) — accepts input, default value sensible, persists after refresh
- [ ] **Assessment notes** (`Textarea`, [line 1297](../../../apps/web/src/pages/ipd.tsx#L1297)) — accepts input, default value sensible, persists after refresh
- [ ] **Score** (`TextInput`, [line 1317](../../../apps/web/src/pages/ipd.tsx#L1317)) — accepts input, default value sensible, persists after refresh
- [ ] **Risk Level** (`Select`, [line 1322](../../../apps/web/src/pages/ipd.tsx#L1322)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 1750](../../../apps/web/src/pages/ipd.tsx#L1750)) — accepts input, default value sensible, persists after refresh
- [ ] **Relationship** (`TextInput`, [line 1756](../../../apps/web/src/pages/ipd.tsx#L1756)) — accepts input, default value sensible, persists after refresh
- [ ] **Phone** (`TextInput`, [line 1763](../../../apps/web/src/pages/ipd.tsx#L1763)) — accepts input, default value sensible, persists after refresh
- [ ] **Alt Phone** (`TextInput`, [line 1768](../../../apps/web/src/pages/ipd.tsx#L1768)) — accepts input, default value sensible, persists after refresh
- [ ] **Address** (`Textarea`, [line 1774](../../../apps/web/src/pages/ipd.tsx#L1774)) — accepts input, default value sensible, persists after refresh
- [ ] **ID Proof Type** (`Select`, [line 1780](../../../apps/web/src/pages/ipd.tsx#L1780)) — accepts input, default value sensible, persists after refresh
- [ ] **ID Proof Number** (`TextInput`, [line 1788](../../../apps/web/src/pages/ipd.tsx#L1788)) — accepts input, default value sensible, persists after refresh
- [ ] **Primary attender** (`Checkbox`, [line 1794](../../../apps/web/src/pages/ipd.tsx#L1794)) — accepts input, default value sensible, persists after refresh
- [ ] **Final Diagnosis** (`Textarea`, [line 2065](../../../apps/web/src/pages/ipd.tsx#L2065)) — accepts input, default value sensible, persists after refresh
- [ ] **Condition at Discharge** (`Textarea`, [line 2072](../../../apps/web/src/pages/ipd.tsx#L2072)) — accepts input, default value sensible, persists after refresh
- [ ] **Course in Hospital** (`Textarea`, [line 2077](../../../apps/web/src/pages/ipd.tsx#L2077)) — accepts input, default value sensible, persists after refresh
- [ ] **Treatment Given** (`Textarea`, [line 2084](../../../apps/web/src/pages/ipd.tsx#L2084)) — accepts input, default value sensible, persists after refresh
- [ ] **Investigation Summary** (`Textarea`, [line 2091](../../../apps/web/src/pages/ipd.tsx#L2091)) — accepts input, default value sensible, persists after refresh
- [ ] **Follow-up Instructions** (`Textarea`, [line 2096](../../../apps/web/src/pages/ipd.tsx#L2096)) — accepts input, default value sensible, persists after refresh
- [ ] **Follow-up Date** (`TextInput`, [line 2101](../../../apps/web/src/pages/ipd.tsx#L2101)) — accepts input, default value sensible, persists after refresh
- [ ] **Dietary Advice** (`Textarea`, [line 2107](../../../apps/web/src/pages/ipd.tsx#L2107)) — accepts input, default value sensible, persists after refresh
- [ ] **Activity Restrictions** (`Textarea`, [line 2112](../../../apps/web/src/pages/ipd.tsx#L2112)) — accepts input, default value sensible, persists after refresh
- [ ] **Warning Signs** (`Textarea`, [line 2117](../../../apps/web/src/pages/ipd.tsx#L2117)) — accepts input, default value sensible, persists after refresh
- [ ] **Transfer Notes** (`Textarea`, [line 2181](../../../apps/web/src/pages/ipd.tsx#L2181)) — accepts input, default value sensible, persists after refresh
- [ ] **<Checkbox @ line 2257>** (`Checkbox`, [line 2257](../../../apps/web/src/pages/ipd.tsx#L2257)) — accepts input, default value sensible, persists after refresh
- [ ] **Discharge Type** (`Select`, [line 2278](../../../apps/web/src/pages/ipd.tsx#L2278)) — accepts input, default value sensible, persists after refresh
- [ ] **Discharge Summary** (`Textarea`, [line 2291](../../../apps/web/src/pages/ipd.tsx#L2291)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 2452](../../../apps/web/src/pages/ipd.tsx#L2452)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 2458](../../../apps/web/src/pages/ipd.tsx#L2458)) — accepts input, default value sensible, persists after refresh
- [ ] **Ward Type** (`Select`, [line 2465](../../../apps/web/src/pages/ipd.tsx#L2465)) — accepts input, default value sensible, persists after refresh
- [ ] **Gender Restriction** (`Select`, [line 2471](../../../apps/web/src/pages/ipd.tsx#L2471)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 2526](../../../apps/web/src/pages/ipd.tsx#L2526)) — accepts input, default value sensible, persists after refresh
- [ ] **Ward Type** (`Select`, [line 2527](../../../apps/web/src/pages/ipd.tsx#L2527)) — accepts input, default value sensible, persists after refresh
- [ ] **Gender Restriction** (`Select`, [line 2533](../../../apps/web/src/pages/ipd.tsx#L2533)) — accepts input, default value sensible, persists after refresh
- [ ] **Active** (`Checkbox`, [line 2543](../../../apps/web/src/pages/ipd.tsx#L2543)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 2604>** (`TextInput`, [line 2604](../../../apps/web/src/pages/ipd.tsx#L2604)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 2609>** (`TextInput`, [line 2609](../../../apps/web/src/pages/ipd.tsx#L2609)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 2780>** (`NumberInput`, [line 2780](../../../apps/web/src/pages/ipd.tsx#L2780)) — accepts input, default value sensible, persists after refresh
- [ ] **<Checkbox @ line 2792>** (`Checkbox`, [line 2792](../../../apps/web/src/pages/ipd.tsx#L2792)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 2973>** (`Select`, [line 2973](../../../apps/web/src/pages/ipd.tsx#L2973)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 2981>** (`Select`, [line 2981](../../../apps/web/src/pages/ipd.tsx#L2981)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 2989>** (`Select`, [line 2989](../../../apps/web/src/pages/ipd.tsx#L2989)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 3046>** (`Select`, [line 3046](../../../apps/web/src/pages/ipd.tsx#L3046)) — accepts input, default value sensible, persists after refresh
- [ ] **Report** (`Select`, [line 3084](../../../apps/web/src/pages/ipd.tsx#L3084)) — accepts input, default value sensible, persists after refresh
- [ ] **From** (`TextInput`, [line 3100](../../../apps/web/src/pages/ipd.tsx#L3100)) — accepts input, default value sensible, persists after refresh
- [ ] **To** (`TextInput`, [line 3106](../../../apps/web/src/pages/ipd.tsx#L3106)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 3434>** (`Select`, [line 3434](../../../apps/web/src/pages/ipd.tsx#L3434)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 3452](../../../apps/web/src/pages/ipd.tsx#L3452)) — accepts input, default value sensible, persists after refresh
- [ ] **Title** (`TextInput`, [line 3459](../../../apps/web/src/pages/ipd.tsx#L3459)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 3577](../../../apps/web/src/pages/ipd.tsx#L3577)) — accepts input, default value sensible, persists after refresh
- [ ] **Status** (`Select`, [line 3685](../../../apps/web/src/pages/ipd.tsx#L3685)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 3692](../../../apps/web/src/pages/ipd.tsx#L3692)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 3779>** (`TextInput`, [line 3779](../../../apps/web/src/pages/ipd.tsx#L3779)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 3785>** (`TextInput`, [line 3785](../../../apps/web/src/pages/ipd.tsx#L3785)) — accepts input, default value sensible, persists after refresh
- [ ] **<Checkbox @ line 3816>** (`Checkbox`, [line 3816](../../../apps/web/src/pages/ipd.tsx#L3816)) — accepts input, default value sensible, persists after refresh
- [ ] **Transfer Type** (`Select`, [line 3896](../../../apps/web/src/pages/ipd.tsx#L3896)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`Textarea`, [line 3903](../../../apps/web/src/pages/ipd.tsx#L3903)) — accepts input, default value sensible, persists after refresh
- [ ] **Clinical Summary** (`Textarea`, [line 3908](../../../apps/web/src/pages/ipd.tsx#L3908)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 4575>** (`TextInput`, [line 4575](../../../apps/web/src/pages/ipd.tsx#L4575)) — accepts input, default value sensible, persists after refresh
- [ ] **Date of Death** (`TextInput`, [line 5138](../../../apps/web/src/pages/ipd.tsx#L5138)) — accepts input, default value sensible, persists after refresh
- [ ] **Time of Death** (`TextInput`, [line 5145](../../../apps/web/src/pages/ipd.tsx#L5145)) — accepts input, default value sensible, persists after refresh
- [ ] **Primary Cause of Death (ICD)** (`TextInput`, [line 5153](../../../apps/web/src/pages/ipd.tsx#L5153)) — accepts input, default value sensible, persists after refresh
- [ ] **Secondary Cause** (`TextInput`, [line 5159](../../../apps/web/src/pages/ipd.tsx#L5159)) — accepts input, default value sensible, persists after refresh
- [ ] **Underlying Cause** (`TextInput`, [line 5164](../../../apps/web/src/pages/ipd.tsx#L5164)) — accepts input, default value sensible, persists after refresh
- [ ] **Manner of Death** (`TextInput`, [line 5169](../../../apps/web/src/pages/ipd.tsx#L5169)) — accepts input, default value sensible, persists after refresh
- [ ] **Certificate Form** (`Select`, [line 5175](../../../apps/web/src/pages/ipd.tsx#L5175)) — accepts input, default value sensible, persists after refresh
- [ ] **Autopsy Requested** (`Checkbox`, [line 5185](../../../apps/web/src/pages/ipd.tsx#L5185)) — accepts input, default value sensible, persists after refresh
- [ ] **Medico-Legal Case** (`Checkbox`, [line 5190](../../../apps/web/src/pages/ipd.tsx#L5190)) — accepts input, default value sensible, persists after refresh
- [ ] **Witness Name** (`TextInput`, [line 5196](../../../apps/web/src/pages/ipd.tsx#L5196)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 5201](../../../apps/web/src/pages/ipd.tsx#L5201)) — accepts input, default value sensible, persists after refresh
- [ ] **Date of Birth** (`TextInput`, [line 5312](../../../apps/web/src/pages/ipd.tsx#L5312)) — accepts input, default value sensible, persists after refresh
- [ ] **Time of Birth** (`TextInput`, [line 5319](../../../apps/web/src/pages/ipd.tsx#L5319)) — accepts input, default value sensible, persists after refresh
- [ ] **Gender** (`Select`, [line 5326](../../../apps/web/src/pages/ipd.tsx#L5326)) — accepts input, default value sensible, persists after refresh
- [ ] **Delivery Type** (`Select`, [line 5336](../../../apps/web/src/pages/ipd.tsx#L5336)) — accepts input, default value sensible, persists after refresh
- [ ] **Weight (grams)** (`NumberInput`, [line 5347](../../../apps/web/src/pages/ipd.tsx#L5347)) — accepts input, default value sensible, persists after refresh
- [ ] **Length (cm)** (`NumberInput`, [line 5353](../../../apps/web/src/pages/ipd.tsx#L5353)) — accepts input, default value sensible, persists after refresh
- [ ] **Head Circumference (cm)** (`NumberInput`, [line 5354](../../../apps/web/src/pages/ipd.tsx#L5354)) — accepts input, default value sensible, persists after refresh
- [ ] **Apgar 1 min** (`NumberInput`, [line 5361](../../../apps/web/src/pages/ipd.tsx#L5361)) — accepts input, default value sensible, persists after refresh
- [ ] **Apgar 5 min** (`NumberInput`, [line 5369](../../../apps/web/src/pages/ipd.tsx#L5369)) — accepts input, default value sensible, persists after refresh
- [ ] **Live Birth** (`Checkbox`, [line 5379](../../../apps/web/src/pages/ipd.tsx#L5379)) — accepts input, default value sensible, persists after refresh
- [ ] **Birth Certificate Number** (`TextInput`, [line 5384](../../../apps/web/src/pages/ipd.tsx#L5384)) — accepts input, default value sensible, persists after refresh
- [ ] **Complications** (`Textarea`, [line 5389](../../../apps/web/src/pages/ipd.tsx#L5389)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 5394](../../../apps/web/src/pages/ipd.tsx#L5394)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`TextInput`, [line 5738](../../../apps/web/src/pages/ipd.tsx#L5738)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 5745](../../../apps/web/src/pages/ipd.tsx#L5745)) — accepts input, default value sensible, persists after refresh
- [ ] **Within next (hours)** (`NumberInput`, [line 5832](../../../apps/web/src/pages/ipd.tsx#L5832)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 50, `<ActionIcon>`: 7, `<Menu.Item>`: 5)

- [ ] **<button @ line 345>** ([line 345](../../../apps/web/src/pages/ipd.tsx#L345)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 345>** ([line 345](../../../apps/web/src/pages/ipd.tsx#L345)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 507>** ([line 507](../../../apps/web/src/pages/ipd.tsx#L507)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 507>** ([line 507](../../../apps/web/src/pages/ipd.tsx#L507)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 594>** ([line 594](../../../apps/web/src/pages/ipd.tsx#L594)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 594>** ([line 594](../../../apps/web/src/pages/ipd.tsx#L594)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 607>** ([line 607](../../../apps/web/src/pages/ipd.tsx#L607)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 607>** ([line 607](../../../apps/web/src/pages/ipd.tsx#L607)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **}>                 Actions** ([line 623](../../../apps/web/src/pages/ipd.tsx#L623)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **}>                 Actions** ([line 623](../../../apps/web/src/pages/ipd.tsx#L623)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 845>** ([line 845](../../../apps/web/src/pages/ipd.tsx#L845)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 845>** ([line 845](../../../apps/web/src/pages/ipd.tsx#L845)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 876>** ([line 876](../../../apps/web/src/pages/ipd.tsx#L876)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 876>** ([line 876](../../../apps/web/src/pages/ipd.tsx#L876)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 961>** ([line 961](../../../apps/web/src/pages/ipd.tsx#L961)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 961>** ([line 961](../../../apps/web/src/pages/ipd.tsx#L961)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1000>** ([line 1000](../../../apps/web/src/pages/ipd.tsx#L1000)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1000>** ([line 1000](../../../apps/web/src/pages/ipd.tsx#L1000)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1157>** ([line 1157](../../../apps/web/src/pages/ipd.tsx#L1157)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1157>** ([line 1157](../../../apps/web/src/pages/ipd.tsx#L1157)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1331>** ([line 1331](../../../apps/web/src/pages/ipd.tsx#L1331)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1331>** ([line 1331](../../../apps/web/src/pages/ipd.tsx#L1331)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1596>** ([line 1596](../../../apps/web/src/pages/ipd.tsx#L1596)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1596>** ([line 1596](../../../apps/web/src/pages/ipd.tsx#L1596)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1740>** ([line 1740](../../../apps/web/src/pages/ipd.tsx#L1740)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1740>** ([line 1740](../../../apps/web/src/pages/ipd.tsx#L1740)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1799>** ([line 1799](../../../apps/web/src/pages/ipd.tsx#L1799)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1799>** ([line 1799](../../../apps/web/src/pages/ipd.tsx#L1799)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1940>** ([line 1940](../../../apps/web/src/pages/ipd.tsx#L1940)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1940>** ([line 1940](../../../apps/web/src/pages/ipd.tsx#L1940)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1962>** ([line 1962](../../../apps/web/src/pages/ipd.tsx#L1962)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1962>** ([line 1962](../../../apps/web/src/pages/ipd.tsx#L1962)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Save** ([line 2123](../../../apps/web/src/pages/ipd.tsx#L2123)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Save** ([line 2123](../../../apps/web/src/pages/ipd.tsx#L2123)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setEditing(false)}>             Cancel** ([line 2127](../../../apps/web/src/pages/ipd.tsx#L2127)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setEditing(false)}>             Cancel** ([line 2127](../../../apps/web/src/pages/ipd.tsx#L2127)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2186>** ([line 2186](../../../apps/web/src/pages/ipd.tsx#L2186)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2186>** ([line 2186](../../../apps/web/src/pages/ipd.tsx#L2186)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2298>** ([line 2298](../../../apps/web/src/pages/ipd.tsx#L2298)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2298>** ([line 2298](../../../apps/web/src/pages/ipd.tsx#L2298)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2402>** ([line 2402](../../../apps/web/src/pages/ipd.tsx#L2402)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2402>** ([line 2402](../../../apps/web/src/pages/ipd.tsx#L2402)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2481>** ([line 2481](../../../apps/web/src/pages/ipd.tsx#L2481)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2481>** ([line 2481](../../../apps/web/src/pages/ipd.tsx#L2481)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2548>** ([line 2548](../../../apps/web/src/pages/ipd.tsx#L2548)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2548>** ([line 2548](../../../apps/web/src/pages/ipd.tsx#L2548)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2614>** ([line 2614](../../../apps/web/src/pages/ipd.tsx#L2614)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2614>** ([line 2614](../../../apps/web/src/pages/ipd.tsx#L2614)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2806>** ([line 2806](../../../apps/web/src/pages/ipd.tsx#L2806)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2806>** ([line 2806](../../../apps/web/src/pages/ipd.tsx#L2806)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setEditingId(null)}>                             Cancel** ([line 2821](../../../apps/web/src/pages/ipd.tsx#L2821)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setEditingId(null)}>                             Cancel** ([line 2821](../../../apps/web/src/pages/ipd.tsx#L2821)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3004>** ([line 3004](../../../apps/web/src/pages/ipd.tsx#L3004)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3004>** ([line 3004](../../../apps/web/src/pages/ipd.tsx#L3004)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3443>** ([line 3443](../../../apps/web/src/pages/ipd.tsx#L3443)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3443>** ([line 3443](../../../apps/web/src/pages/ipd.tsx#L3443)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3583>** ([line 3583](../../../apps/web/src/pages/ipd.tsx#L3583)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3583>** ([line 3583](../../../apps/web/src/pages/ipd.tsx#L3583)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setShowForm(false)}>                 Cancel** ([line 3597](../../../apps/web/src/pages/ipd.tsx#L3597)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setShowForm(false)}>                 Cancel** ([line 3597](../../../apps/web/src/pages/ipd.tsx#L3597)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3661>** ([line 3661](../../../apps/web/src/pages/ipd.tsx#L3661)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3661>** ([line 3661](../../../apps/web/src/pages/ipd.tsx#L3661)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3698>** ([line 3698](../../../apps/web/src/pages/ipd.tsx#L3698)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3698>** ([line 3698](../../../apps/web/src/pages/ipd.tsx#L3698)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setShowRestraintForm(null)}>                 Cancel** ([line 3712](../../../apps/web/src/pages/ipd.tsx#L3712)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setShowRestraintForm(null)}>                 Cancel** ([line 3712](../../../apps/web/src/pages/ipd.tsx#L3712)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3791>** ([line 3791](../../../apps/web/src/pages/ipd.tsx#L3791)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3791>** ([line 3791](../../../apps/web/src/pages/ipd.tsx#L3791)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3887>** ([line 3887](../../../apps/web/src/pages/ipd.tsx#L3887)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3887>** ([line 3887](../../../apps/web/src/pages/ipd.tsx#L3887)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3914>** ([line 3914](../../../apps/web/src/pages/ipd.tsx#L3914)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3914>** ([line 3914](../../../apps/web/src/pages/ipd.tsx#L3914)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setShowForm(false)}>                 Cancel** ([line 3928](../../../apps/web/src/pages/ipd.tsx#L3928)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setShowForm(false)}>                 Cancel** ([line 3928](../../../apps/web/src/pages/ipd.tsx#L3928)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4032>** ([line 4032](../../../apps/web/src/pages/ipd.tsx#L4032)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4032>** ([line 4032](../../../apps/web/src/pages/ipd.tsx#L4032)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4089>** ([line 4089](../../../apps/web/src/pages/ipd.tsx#L4089)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4089>** ([line 4089](../../../apps/web/src/pages/ipd.tsx#L4089)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4581>** ([line 4581](../../../apps/web/src/pages/ipd.tsx#L4581)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4581>** ([line 4581](../../../apps/web/src/pages/ipd.tsx#L4581)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4757>** ([line 4757](../../../apps/web/src/pages/ipd.tsx#L4757)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4757>** ([line 4757](../../../apps/web/src/pages/ipd.tsx#L4757)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **window.print()}>           Print** ([line 4851](../../../apps/web/src/pages/ipd.tsx#L4851)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **window.print()}>           Print** ([line 4851](../../../apps/web/src/pages/ipd.tsx#L4851)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5122>** ([line 5122](../../../apps/web/src/pages/ipd.tsx#L5122)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5122>** ([line 5122](../../../apps/web/src/pages/ipd.tsx#L5122)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5207>** ([line 5207](../../../apps/web/src/pages/ipd.tsx#L5207)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5207>** ([line 5207](../../../apps/web/src/pages/ipd.tsx#L5207)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setShowForm(false)}>                 Cancel** ([line 5230](../../../apps/web/src/pages/ipd.tsx#L5230)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setShowForm(false)}>                 Cancel** ([line 5230](../../../apps/web/src/pages/ipd.tsx#L5230)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5302>** ([line 5302](../../../apps/web/src/pages/ipd.tsx#L5302)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5302>** ([line 5302](../../../apps/web/src/pages/ipd.tsx#L5302)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5400>** ([line 5400](../../../apps/web/src/pages/ipd.tsx#L5400)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5400>** ([line 5400](../../../apps/web/src/pages/ipd.tsx#L5400)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setShowForm(false)}>                 Cancel** ([line 5425](../../../apps/web/src/pages/ipd.tsx#L5425)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setShowForm(false)}>                 Cancel** ([line 5425](../../../apps/web/src/pages/ipd.tsx#L5425)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5625>** ([line 5625](../../../apps/web/src/pages/ipd.tsx#L5625)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5625>** ([line 5625](../../../apps/web/src/pages/ipd.tsx#L5625)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5751>** ([line 5751](../../../apps/web/src/pages/ipd.tsx#L5751)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5751>** ([line 5751](../../../apps/web/src/pages/ipd.tsx#L5751)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 313>** ([line 313](../../../apps/web/src/pages/ipd.tsx#L313)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1850>** ([line 1850](../../../apps/web/src/pages/ipd.tsx#L1850)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2382>** ([line 2382](../../../apps/web/src/pages/ipd.tsx#L2382)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2388>** ([line 2388](../../../apps/web/src/pages/ipd.tsx#L2388)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2662>** ([line 2662](../../../apps/web/src/pages/ipd.tsx#L2662)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2826>** ([line 2826](../../../apps/web/src/pages/ipd.tsx#L2826)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 3650>** ([line 3650](../../../apps/web/src/pages/ipd.tsx#L3650)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Menu action **<menu item @ line 629>** ([line 629](../../../apps/web/src/pages/ipd.tsx#L629)) — visible only when allowed, click triggers expected modal/API/nav, and result is visible
- [ ] Menu action **<menu item @ line 637>** ([line 637](../../../apps/web/src/pages/ipd.tsx#L637)) — visible only when allowed, click triggers expected modal/API/nav, and result is visible
- [ ] Menu action **<menu item @ line 647>** ([line 647](../../../apps/web/src/pages/ipd.tsx#L647)) — visible only when allowed, click triggers expected modal/API/nav, and result is visible
- [ ] Menu action **<menu item @ line 663>** ([line 663](../../../apps/web/src/pages/ipd.tsx#L663)) — visible only when allowed, click triggers expected modal/API/nav, and result is visible
- [ ] Menu action **<menu item @ line 666>** ([line 666](../../../apps/web/src/pages/ipd.tsx#L666)) — visible only when allowed, click triggers expected modal/API/nav, and result is visible

## API methods used (74)

- [ ] `api.assignBedToWard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.bedDashboardBeds` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.bedDashboardSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.bedTransfer` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAdmission` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAdmissionChecklist` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAssessment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAttender` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createBirthRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createClinicalDoc` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createDeathSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createDischargeSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createNursingTask` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createProgressNote` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRestraintCheck` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createTransfer` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createWard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteAttender` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.dischargePatient` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.expectedDischarges` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.finalizeDischargeSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.generateDischargeSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAdmission` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAdmissionAdvances` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAdmissionBillingSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAdmissionConsents` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAdmissionDietOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAdmissionInvestigations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAdmissionMlc` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAdmissionPrintData` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAdmissionPriorAuth` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getDeathSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getDischargeSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getDischargeTat` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getEstimatedCost` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getIoBalance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPatient` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getSurgeonCaseload` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.initiateDischargeTat` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.linkMlc` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] _… 34 more methods_

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._