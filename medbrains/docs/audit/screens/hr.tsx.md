# `hr.tsx` walkthrough

_Source: [`apps/web/src/pages/hr.tsx`](../../../apps/web/src/pages/hr.tsx) (1037 lines). Guard: `P.HR.EMPLOYEES_LIST`. API methods: 27. useForm: 0. Tables: 11. Modals: 13._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.HR.EMPLOYEES_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Employees** (`employees`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Employees** (`employees`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Employees** (`employees`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Attendance** (`attendance`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Attendance** (`attendance`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Attendance** (`attendance`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Leave** (`leave`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Leave** (`leave`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Leave** (`leave`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Duty Roster** (`roster`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Duty Roster** (`roster`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Duty Roster** (`roster`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Training** (`training`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Training** (`training`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Training** (`training`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Compliance** (`compliance`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Compliance** (`compliance`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Compliance** (`compliance`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Info** (`info`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Info** (`info`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Info** (`info`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Credentials** (`credentials`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Credentials** (`credentials`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Credentials** (`credentials`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Leave Balances** (`leave-balances`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Leave Balances** (`leave-balances`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Leave Balances** (`leave-balances`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Duty Roster** (`roster`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Duty Roster** (`roster`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Duty Roster** (`roster`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Shift Definitions** (`shifts`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Shift Definitions** (`shifts`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Shift Definitions** (`shifts`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **On-Call Schedules** (`on-call`) — clicking activates the panel + loads its data without console error
- [ ] Tab **On-Call Schedules** (`on-call`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **On-Call Schedules** (`on-call`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Credential Expiry** (`credentials`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Credential Expiry** (`credentials`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Credential Expiry** (`credentials`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Appraisals** (`appraisals`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Appraisals** (`appraisals`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Appraisals** (`appraisals`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Statutory Records** (`statutory`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Statutory Records** (`statutory`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Statutory Records** (`statutory`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (63)
- [ ] Column **Code** (`employee_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`employment_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Phone** (`phone`) renders without `undefined` / `[object Object]`
- [ ] Column **Email** (`email`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`type`) renders without `undefined` / `[object Object]`
- [ ] Column **Reg No** (`reg`) renders without `undefined` / `[object Object]`
- [ ] Column **Issuing Body** (`body`) renders without `undefined` / `[object Object]`
- [ ] Column **Expiry** (`expiry`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Leave Type** (`type`) renders without `undefined` / `[object Object]`
- [ ] Column **Year** (`year`) renders without `undefined` / `[object Object]`
- [ ] Column **Opening** (`opening`) renders without `undefined` / `[object Object]`
- [ ] Column **Earned** (`earned`) renders without `undefined` / `[object Object]`
- [ ] Column **Used** (`used`) renders without `undefined` / `[object Object]`
- [ ] Column **Balance** (`balance`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Employee ID** (`employee`) renders without `undefined` / `[object Object]`
- [ ] Column **Check In** (`check_in`) renders without `undefined` / `[object Object]`
- [ ] Column **Check Out** (`check_out`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Late** (`late`) renders without `undefined` / `[object Object]`
- [ ] Column **OT** (`overtime`) renders without `undefined` / `[object Object]`
- [ ] Column **Source** (`source`) renders without `undefined` / `[object Object]`
- [ ] Column **Employee** (`employee`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`type`) renders without `undefined` / `[object Object]`
- [ ] Column **Period** (`dates`) renders without `undefined` / `[object Object]`
- [ ] Column **Days** (`days`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Reason** (`reason`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Employee** (`employee`) renders without `undefined` / `[object Object]`
- [ ] Column **Shift** (`shift`) renders without `undefined` / `[object Object]`
- [ ] Column **On-Call** (`on_call`) renders without `undefined` / `[object Object]`
- [ ] Column **Swap** (`swap`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`type`) renders without `undefined` / `[object Object]`
- [ ] Column **Time** (`time`) renders without `undefined` / `[object Object]`
- [ ] Column **Break** (`break`) renders without `undefined` / `[object Object]`
- [ ] Column **Night** (`night`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`active`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Employee** (`employee`) renders without `undefined` / `[object Object]`
- [ ] Column **Time** (`time`) renders without `undefined` / `[object Object]`
- [ ] Column **Primary** (`primary`) renders without `undefined` / `[object Object]`
- [ ] Column **Contact** (`contact`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] _… 13 more columns — review remaining_

## Modals / Drawers

### Drawer — _Add Employee_ @ [line 232](../../../apps/web/src/pages/hr.tsx#L232)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Designation_ @ [line 252](../../../apps/web/src/pages/hr.tsx#L252)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 300>_ @ [line 300](../../../apps/web/src/pages/hr.tsx#L300)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Credential_ @ [line 341](../../../apps/web/src/pages/hr.tsx#L341)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Mark Attendance_ @ [line 438](../../../apps/web/src/pages/hr.tsx#L438)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Apply Leave_ @ [line 547](../../../apps/web/src/pages/hr.tsx#L547)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Roster Entry_ @ [line 708](../../../apps/web/src/pages/hr.tsx#L708)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Shift Definition_ @ [line 719](../../../apps/web/src/pages/hr.tsx#L719)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add On-Call Schedule_ @ [line 738](../../../apps/web/src/pages/hr.tsx#L738)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Training Program_ @ [line 889](../../../apps/web/src/pages/hr.tsx#L889)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Training_ @ [line 902](../../../apps/web/src/pages/hr.tsx#L902)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Appraisal_ @ [line 998](../../../apps/web/src/pages/hr.tsx#L998)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Statutory Record_ @ [line 1018](../../../apps/web/src/pages/hr.tsx#L1018)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (70)

- [ ] **<TextInput @ line 197>** (`TextInput`, [line 197](../../../apps/web/src/pages/hr.tsx#L197)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 198>** (`Select`, [line 198](../../../apps/web/src/pages/hr.tsx#L198)) — accepts input, default value sensible, persists after refresh
- [ ] **Employee Code** (`TextInput`, [line 234](../../../apps/web/src/pages/hr.tsx#L234)) — accepts input, default value sensible, persists after refresh
- [ ] **First Name** (`TextInput`, [line 235](../../../apps/web/src/pages/hr.tsx#L235)) — accepts input, default value sensible, persists after refresh
- [ ] **Last Name** (`TextInput`, [line 236](../../../apps/web/src/pages/hr.tsx#L236)) — accepts input, default value sensible, persists after refresh
- [ ] **Phone** (`TextInput`, [line 237](../../../apps/web/src/pages/hr.tsx#L237)) — accepts input, default value sensible, persists after refresh
- [ ] **Email** (`TextInput`, [line 238](../../../apps/web/src/pages/hr.tsx#L238)) — accepts input, default value sensible, persists after refresh
- [ ] **Employment Type** (`Select`, [line 239](../../../apps/web/src/pages/hr.tsx#L239)) — accepts input, default value sensible, persists after refresh
- [ ] **Designation** (`Select`, [line 245](../../../apps/web/src/pages/hr.tsx#L245)) — accepts input, default value sensible, persists after refresh
- [ ] **Date of Joining** (`TextInput`, [line 246](../../../apps/web/src/pages/hr.tsx#L246)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 254](../../../apps/web/src/pages/hr.tsx#L254)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 255](../../../apps/web/src/pages/hr.tsx#L255)) — accepts input, default value sensible, persists after refresh
- [ ] **Level** (`NumberInput`, [line 256](../../../apps/web/src/pages/hr.tsx#L256)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 257](../../../apps/web/src/pages/hr.tsx#L257)) — accepts input, default value sensible, persists after refresh
- [ ] **Credential Type** (`Select`, [line 343](../../../apps/web/src/pages/hr.tsx#L343)) — accepts input, default value sensible, persists after refresh
- [ ] **Issuing Body** (`TextInput`, [line 350](../../../apps/web/src/pages/hr.tsx#L350)) — accepts input, default value sensible, persists after refresh
- [ ] **Registration No** (`TextInput`, [line 351](../../../apps/web/src/pages/hr.tsx#L351)) — accepts input, default value sensible, persists after refresh
- [ ] **State Code** (`TextInput`, [line 352](../../../apps/web/src/pages/hr.tsx#L352)) — accepts input, default value sensible, persists after refresh
- [ ] **Expiry Date** (`TextInput`, [line 353](../../../apps/web/src/pages/hr.tsx#L353)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 416>** (`TextInput`, [line 416](../../../apps/web/src/pages/hr.tsx#L416)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 417>** (`TextInput`, [line 417](../../../apps/web/src/pages/hr.tsx#L417)) — accepts input, default value sensible, persists after refresh
- [ ] **Date** (`TextInput`, [line 441](../../../apps/web/src/pages/hr.tsx#L441)) — accepts input, default value sensible, persists after refresh
- [ ] **Check In** (`TextInput`, [line 442](../../../apps/web/src/pages/hr.tsx#L442)) — accepts input, default value sensible, persists after refresh
- [ ] **Check Out** (`TextInput`, [line 443](../../../apps/web/src/pages/hr.tsx#L443)) — accepts input, default value sensible, persists after refresh
- [ ] **Status** (`Select`, [line 444](../../../apps/web/src/pages/hr.tsx#L444)) — accepts input, default value sensible, persists after refresh
- [ ] **Source** (`Select`, [line 449](../../../apps/web/src/pages/hr.tsx#L449)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 512>** (`Select`, [line 512](../../../apps/web/src/pages/hr.tsx#L512)) — accepts input, default value sensible, persists after refresh
- [ ] **Leave Type** (`Select`, [line 550](../../../apps/web/src/pages/hr.tsx#L550)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Date** (`TextInput`, [line 557](../../../apps/web/src/pages/hr.tsx#L557)) — accepts input, default value sensible, persists after refresh
- [ ] **End Date** (`TextInput`, [line 558](../../../apps/web/src/pages/hr.tsx#L558)) — accepts input, default value sensible, persists after refresh
- [ ] **Days** (`NumberInput`, [line 559](../../../apps/web/src/pages/hr.tsx#L559)) — accepts input, default value sensible, persists after refresh
- [ ] **Half Day** (`Switch`, [line 560](../../../apps/web/src/pages/hr.tsx#L560)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`Textarea`, [line 561](../../../apps/web/src/pages/hr.tsx#L561)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 645>** (`TextInput`, [line 645](../../../apps/web/src/pages/hr.tsx#L645)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 646>** (`TextInput`, [line 646](../../../apps/web/src/pages/hr.tsx#L646)) — accepts input, default value sensible, persists after refresh
- [ ] **Shift** (`Select`, [line 711](../../../apps/web/src/pages/hr.tsx#L711)) — accepts input, default value sensible, persists after refresh
- [ ] **Date** (`TextInput`, [line 712](../../../apps/web/src/pages/hr.tsx#L712)) — accepts input, default value sensible, persists after refresh
- [ ] **On-Call** (`Switch`, [line 713](../../../apps/web/src/pages/hr.tsx#L713)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 721](../../../apps/web/src/pages/hr.tsx#L721)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 722](../../../apps/web/src/pages/hr.tsx#L722)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 723](../../../apps/web/src/pages/hr.tsx#L723)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Time** (`TextInput`, [line 729](../../../apps/web/src/pages/hr.tsx#L729)) — accepts input, default value sensible, persists after refresh
- [ ] **End Time** (`TextInput`, [line 730](../../../apps/web/src/pages/hr.tsx#L730)) — accepts input, default value sensible, persists after refresh
- [ ] **Break (minutes)** (`NumberInput`, [line 731](../../../apps/web/src/pages/hr.tsx#L731)) — accepts input, default value sensible, persists after refresh
- [ ] **Night Shift** (`Switch`, [line 732](../../../apps/web/src/pages/hr.tsx#L732)) — accepts input, default value sensible, persists after refresh
- [ ] **Date** (`TextInput`, [line 741](../../../apps/web/src/pages/hr.tsx#L741)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Time** (`TextInput`, [line 742](../../../apps/web/src/pages/hr.tsx#L742)) — accepts input, default value sensible, persists after refresh
- [ ] **End Time** (`TextInput`, [line 743](../../../apps/web/src/pages/hr.tsx#L743)) — accepts input, default value sensible, persists after refresh
- [ ] **Primary On-Call** (`Switch`, [line 744](../../../apps/web/src/pages/hr.tsx#L744)) — accepts input, default value sensible, persists after refresh
- [ ] **Contact Number** (`TextInput`, [line 745](../../../apps/web/src/pages/hr.tsx#L745)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 891](../../../apps/web/src/pages/hr.tsx#L891)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 892](../../../apps/web/src/pages/hr.tsx#L892)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 893](../../../apps/web/src/pages/hr.tsx#L893)) — accepts input, default value sensible, persists after refresh
- [ ] **Mandatory** (`Switch`, [line 894](../../../apps/web/src/pages/hr.tsx#L894)) — accepts input, default value sensible, persists after refresh
- [ ] **Frequency (months)** (`NumberInput`, [line 895](../../../apps/web/src/pages/hr.tsx#L895)) — accepts input, default value sensible, persists after refresh
- [ ] **Duration (hours)** (`NumberInput`, [line 896](../../../apps/web/src/pages/hr.tsx#L896)) — accepts input, default value sensible, persists after refresh
- [ ] **Program** (`Select`, [line 905](../../../apps/web/src/pages/hr.tsx#L905)) — accepts input, default value sensible, persists after refresh
- [ ] **Training Date** (`TextInput`, [line 906](../../../apps/web/src/pages/hr.tsx#L906)) — accepts input, default value sensible, persists after refresh
- [ ] **Status** (`Select`, [line 907](../../../apps/web/src/pages/hr.tsx#L907)) — accepts input, default value sensible, persists after refresh
- [ ] **Score** (`NumberInput`, [line 912](../../../apps/web/src/pages/hr.tsx#L912)) — accepts input, default value sensible, persists after refresh
- [ ] **Certificate No** (`TextInput`, [line 913](../../../apps/web/src/pages/hr.tsx#L913)) — accepts input, default value sensible, persists after refresh
- [ ] **Trainer Name** (`TextInput`, [line 914](../../../apps/web/src/pages/hr.tsx#L914)) — accepts input, default value sensible, persists after refresh
- [ ] **Year** (`NumberInput`, [line 1001](../../../apps/web/src/pages/hr.tsx#L1001)) — accepts input, default value sensible, persists after refresh
- [ ] **Rating** (`NumberInput`, [line 1002](../../../apps/web/src/pages/hr.tsx#L1002)) — accepts input, default value sensible, persists after refresh
- [ ] **Strengths** (`Textarea`, [line 1003](../../../apps/web/src/pages/hr.tsx#L1003)) — accepts input, default value sensible, persists after refresh
- [ ] **Areas for Improvement** (`Textarea`, [line 1004](../../../apps/web/src/pages/hr.tsx#L1004)) — accepts input, default value sensible, persists after refresh
- [ ] **Record Type** (`Select`, [line 1021](../../../apps/web/src/pages/hr.tsx#L1021)) — accepts input, default value sensible, persists after refresh
- [ ] **Title** (`TextInput`, [line 1027](../../../apps/web/src/pages/hr.tsx#L1027)) — accepts input, default value sensible, persists after refresh
- [ ] **Compliance Date** (`TextInput`, [line 1028](../../../apps/web/src/pages/hr.tsx#L1028)) — accepts input, default value sensible, persists after refresh
- [ ] **Expiry Date** (`TextInput`, [line 1029](../../../apps/web/src/pages/hr.tsx#L1029)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 24, `<ActionIcon>`: 5, `<Menu.Item>`: 0)

- [ ] **<button @ line 205>** ([line 205](../../../apps/web/src/pages/hr.tsx#L205)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 205>** ([line 205](../../../apps/web/src/pages/hr.tsx#L205)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 206>** ([line 206](../../../apps/web/src/pages/hr.tsx#L206)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 206>** ([line 206](../../../apps/web/src/pages/hr.tsx#L206)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 247>** ([line 247](../../../apps/web/src/pages/hr.tsx#L247)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 247>** ([line 247](../../../apps/web/src/pages/hr.tsx#L247)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 260>** ([line 260](../../../apps/web/src/pages/hr.tsx#L260)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 260>** ([line 260](../../../apps/web/src/pages/hr.tsx#L260)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 327>** ([line 327](../../../apps/web/src/pages/hr.tsx#L327)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 327>** ([line 327](../../../apps/web/src/pages/hr.tsx#L327)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 354>** ([line 354](../../../apps/web/src/pages/hr.tsx#L354)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 354>** ([line 354](../../../apps/web/src/pages/hr.tsx#L354)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 419>** ([line 419](../../../apps/web/src/pages/hr.tsx#L419)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 419>** ([line 419](../../../apps/web/src/pages/hr.tsx#L419)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 452>** ([line 452](../../../apps/web/src/pages/hr.tsx#L452)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 452>** ([line 452](../../../apps/web/src/pages/hr.tsx#L452)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 517>** ([line 517](../../../apps/web/src/pages/hr.tsx#L517)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 517>** ([line 517](../../../apps/web/src/pages/hr.tsx#L517)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 562>** ([line 562](../../../apps/web/src/pages/hr.tsx#L562)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 562>** ([line 562](../../../apps/web/src/pages/hr.tsx#L562)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 648>** ([line 648](../../../apps/web/src/pages/hr.tsx#L648)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 648>** ([line 648](../../../apps/web/src/pages/hr.tsx#L648)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 671>** ([line 671](../../../apps/web/src/pages/hr.tsx#L671)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 671>** ([line 671](../../../apps/web/src/pages/hr.tsx#L671)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 690>** ([line 690](../../../apps/web/src/pages/hr.tsx#L690)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 690>** ([line 690](../../../apps/web/src/pages/hr.tsx#L690)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 714>** ([line 714](../../../apps/web/src/pages/hr.tsx#L714)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 714>** ([line 714](../../../apps/web/src/pages/hr.tsx#L714)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 733>** ([line 733](../../../apps/web/src/pages/hr.tsx#L733)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 733>** ([line 733](../../../apps/web/src/pages/hr.tsx#L733)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 746>** ([line 746](../../../apps/web/src/pages/hr.tsx#L746)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 746>** ([line 746](../../../apps/web/src/pages/hr.tsx#L746)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 824>** ([line 824](../../../apps/web/src/pages/hr.tsx#L824)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 824>** ([line 824](../../../apps/web/src/pages/hr.tsx#L824)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 825>** ([line 825](../../../apps/web/src/pages/hr.tsx#L825)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 825>** ([line 825](../../../apps/web/src/pages/hr.tsx#L825)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 897>** ([line 897](../../../apps/web/src/pages/hr.tsx#L897)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 897>** ([line 897](../../../apps/web/src/pages/hr.tsx#L897)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 915>** ([line 915](../../../apps/web/src/pages/hr.tsx#L915)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 915>** ([line 915](../../../apps/web/src/pages/hr.tsx#L915)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 992>** ([line 992](../../../apps/web/src/pages/hr.tsx#L992)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 992>** ([line 992](../../../apps/web/src/pages/hr.tsx#L992)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1005>** ([line 1005](../../../apps/web/src/pages/hr.tsx#L1005)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1005>** ([line 1005](../../../apps/web/src/pages/hr.tsx#L1005)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1012>** ([line 1012](../../../apps/web/src/pages/hr.tsx#L1012)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1012>** ([line 1012](../../../apps/web/src/pages/hr.tsx#L1012)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1030>** ([line 1030](../../../apps/web/src/pages/hr.tsx#L1030)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1030>** ([line 1030](../../../apps/web/src/pages/hr.tsx#L1030)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 223>** ([line 223](../../../apps/web/src/pages/hr.tsx#L223)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 535>** ([line 535](../../../apps/web/src/pages/hr.tsx#L535)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 536>** ([line 536](../../../apps/web/src/pages/hr.tsx#L536)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 540>** ([line 540](../../../apps/web/src/pages/hr.tsx#L540)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 662>** ([line 662](../../../apps/web/src/pages/hr.tsx#L662)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (27)

- [ ] `api.approveSwap` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.cancelLeave` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAppraisal` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAttendance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCredential` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createDesignation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createEmployee` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createLeaveRequest` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createOnCall` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRoster` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createShift` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createStatutoryRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createTrainingProgram` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createTrainingRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getEmployee` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.leaveAction` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAttendance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCredentials` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDesignations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listEmployees` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listLeaveBalances` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listLeaveRequests` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOnCall` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRosters` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listShifts` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listTrainingPrograms` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.trainingCompliance` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._