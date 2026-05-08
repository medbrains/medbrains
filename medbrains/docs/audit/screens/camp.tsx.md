# `camp.tsx` walkthrough

_Source: [`apps/web/src/pages/camp.tsx`](../../../apps/web/src/pages/camp.tsx) (1055 lines). Guard: `P.CAMP.LIST`. API methods: 21. useForm: 0. Tables: 6. Modals: 7._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.CAMP.LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Camps** (`camps`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Camps** (`camps`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Camps** (`camps`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Registrations** (`registrations`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Registrations** (`registrations`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Registrations** (`registrations`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Screenings & Lab** (`screenings`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Screenings & Lab** (`screenings`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Screenings & Lab** (`screenings`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Follow-up & Conversion** (`followups`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Follow-up & Conversion** (`followups`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Follow-up & Conversion** (`followups`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Analytics & Reports** (`analytics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Analytics & Reports** (`analytics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Analytics & Reports** (`analytics`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (37)
- [ ] Column **Code** (`camp_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`camp_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`scheduled_date`) renders without `undefined` / `[object Object]`
- [ ] Column **City** (`venue_city`) renders without `undefined` / `[object Object]`
- [ ] Column **Expected** (`expected_participants`) renders without `undefined` / `[object Object]`
- [ ] Column **Employee ID** (`employee_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Role** (`role_in_camp`) renders without `undefined` / `[object Object]`
- [ ] Column **Confirmed** (`is_confirmed`) renders without `undefined` / `[object Object]`
- [ ] Column **Reg #** (`registration_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`person_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Age** (`age`) renders without `undefined` / `[object Object]`
- [ ] Column **Gender** (`gender`) renders without `undefined` / `[object Object]`
- [ ] Column **Phone** (`phone`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Complaint** (`chief_complaint`) renders without `undefined` / `[object Object]`
- [ ] Column **Reg ID** (`registration_id`) renders without `undefined` / `[object Object]`
- [ ] Column **BP** (`bp`) renders without `undefined` / `[object Object]`
- [ ] Column **Pulse** (`pulse_rate`) renders without `undefined` / `[object Object]`
- [ ] Column **SpO2** (`spo2`) renders without `undefined` / `[object Object]`
- [ ] Column **BSR** (`blood_sugar_random`) renders without `undefined` / `[object Object]`
- [ ] Column **BMI** (`bmi`) renders without `undefined` / `[object Object]`
- [ ] Column **Findings** (`findings`) renders without `undefined` / `[object Object]`
- [ ] Column **Referred** (`referred`) renders without `undefined` / `[object Object]`
- [ ] Column **Reg ID** (`registration_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Sample** (`sample_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Test** (`test_requested`) renders without `undefined` / `[object Object]`
- [ ] Column **Barcode** (`barcode`) renders without `undefined` / `[object Object]`
- [ ] Column **Sent to Lab** (`sent_to_lab`) renders without `undefined` / `[object Object]`
- [ ] Column **Result** (`result_summary`) renders without `undefined` / `[object Object]`
- [ ] Column **Reg ID** (`registration_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`followup_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`followup_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Converted** (`converted`) renders without `undefined` / `[object Object]`
- [ ] Column **Outcome** (`outcome`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _Plan New Camp_ @ [line 378](../../../apps/web/src/pages/camp.tsx#L378)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 403>_ @ [line 403](../../../apps/web/src/pages/camp.tsx#L403)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Team Member_ @ [line 488](../../../apps/web/src/pages/camp.tsx#L488)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Register Participant_ @ [line 588](../../../apps/web/src/pages/camp.tsx#L588)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Screening_ @ [line 741](../../../apps/web/src/pages/camp.tsx#L741)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Lab Sample_ @ [line 781](../../../apps/web/src/pages/camp.tsx#L781)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Schedule Follow-up_ @ [line 952](../../../apps/web/src/pages/camp.tsx#L952)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (54)

- [ ] **<Select @ line 357>** (`Select`, [line 357](../../../apps/web/src/pages/camp.tsx#L357)) — accepts input, default value sensible, persists after refresh
- [ ] **Camp Name** (`TextInput`, [line 380](../../../apps/web/src/pages/camp.tsx#L380)) — accepts input, default value sensible, persists after refresh
- [ ] **Camp Type** (`Select`, [line 381](../../../apps/web/src/pages/camp.tsx#L381)) — accepts input, default value sensible, persists after refresh
- [ ] **Scheduled Date** (`DateInput`, [line 382](../../../apps/web/src/pages/camp.tsx#L382)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Time** (`TextInput`, [line 383](../../../apps/web/src/pages/camp.tsx#L383)) — accepts input, default value sensible, persists after refresh
- [ ] **End Time** (`TextInput`, [line 384](../../../apps/web/src/pages/camp.tsx#L384)) — accepts input, default value sensible, persists after refresh
- [ ] **Venue Name** (`TextInput`, [line 385](../../../apps/web/src/pages/camp.tsx#L385)) — accepts input, default value sensible, persists after refresh
- [ ] **Venue Address** (`TextInput`, [line 386](../../../apps/web/src/pages/camp.tsx#L386)) — accepts input, default value sensible, persists after refresh
- [ ] **City** (`TextInput`, [line 388](../../../apps/web/src/pages/camp.tsx#L388)) — accepts input, default value sensible, persists after refresh
- [ ] **State** (`TextInput`, [line 389](../../../apps/web/src/pages/camp.tsx#L389)) — accepts input, default value sensible, persists after refresh
- [ ] **Pincode** (`TextInput`, [line 390](../../../apps/web/src/pages/camp.tsx#L390)) — accepts input, default value sensible, persists after refresh
- [ ] **Expected Participants** (`NumberInput`, [line 392](../../../apps/web/src/pages/camp.tsx#L392)) — accepts input, default value sensible, persists after refresh
- [ ] **Budget Allocated** (`NumberInput`, [line 393](../../../apps/web/src/pages/camp.tsx#L393)) — accepts input, default value sensible, persists after refresh
- [ ] **Free Camp** (`Switch`, [line 394](../../../apps/web/src/pages/camp.tsx#L394)) — accepts input, default value sensible, persists after refresh
- [ ] **Logistics Notes** (`Textarea`, [line 395](../../../apps/web/src/pages/camp.tsx#L395)) — accepts input, default value sensible, persists after refresh
- [ ] **Role** (`Select`, [line 491](../../../apps/web/src/pages/camp.tsx#L491)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 567>** (`Select`, [line 567](../../../apps/web/src/pages/camp.tsx#L567)) — accepts input, default value sensible, persists after refresh
- [ ] **Person Name** (`TextInput`, [line 590](../../../apps/web/src/pages/camp.tsx#L590)) — accepts input, default value sensible, persists after refresh
- [ ] **Age** (`NumberInput`, [line 592](../../../apps/web/src/pages/camp.tsx#L592)) — accepts input, default value sensible, persists after refresh
- [ ] **Gender** (`Select`, [line 593](../../../apps/web/src/pages/camp.tsx#L593)) — accepts input, default value sensible, persists after refresh
- [ ] **Phone** (`TextInput`, [line 595](../../../apps/web/src/pages/camp.tsx#L595)) — accepts input, default value sensible, persists after refresh
- [ ] **Address** (`Textarea`, [line 596](../../../apps/web/src/pages/camp.tsx#L596)) — accepts input, default value sensible, persists after refresh
- [ ] **ID Proof Type** (`Select`, [line 598](../../../apps/web/src/pages/camp.tsx#L598)) — accepts input, default value sensible, persists after refresh
- [ ] **ID Proof Number** (`TextInput`, [line 599](../../../apps/web/src/pages/camp.tsx#L599)) — accepts input, default value sensible, persists after refresh
- [ ] **Chief Complaint** (`Textarea`, [line 601](../../../apps/web/src/pages/camp.tsx#L601)) — accepts input, default value sensible, persists after refresh
- [ ] **Walk-in** (`Switch`, [line 602](../../../apps/web/src/pages/camp.tsx#L602)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 704>** (`Select`, [line 704](../../../apps/web/src/pages/camp.tsx#L704)) — accepts input, default value sensible, persists after refresh
- [ ] **Registration ID** (`TextInput`, [line 743](../../../apps/web/src/pages/camp.tsx#L743)) — accepts input, default value sensible, persists after refresh
- [ ] **BP Systolic** (`NumberInput`, [line 745](../../../apps/web/src/pages/camp.tsx#L745)) — accepts input, default value sensible, persists after refresh
- [ ] **BP Diastolic** (`NumberInput`, [line 746](../../../apps/web/src/pages/camp.tsx#L746)) — accepts input, default value sensible, persists after refresh
- [ ] **Pulse Rate** (`NumberInput`, [line 749](../../../apps/web/src/pages/camp.tsx#L749)) — accepts input, default value sensible, persists after refresh
- [ ] **SpO2 (%)** (`NumberInput`, [line 750](../../../apps/web/src/pages/camp.tsx#L750)) — accepts input, default value sensible, persists after refresh
- [ ] **Temperature** (`NumberInput`, [line 753](../../../apps/web/src/pages/camp.tsx#L753)) — accepts input, default value sensible, persists after refresh
- [ ] **Blood Sugar (Random)** (`NumberInput`, [line 754](../../../apps/web/src/pages/camp.tsx#L754)) — accepts input, default value sensible, persists after refresh
- [ ] **Height (cm)** (`NumberInput`, [line 757](../../../apps/web/src/pages/camp.tsx#L757)) — accepts input, default value sensible, persists after refresh
- [ ] **Weight (kg)** (`NumberInput`, [line 758](../../../apps/web/src/pages/camp.tsx#L758)) — accepts input, default value sensible, persists after refresh
- [ ] **Visual Acuity (L)** (`TextInput`, [line 761](../../../apps/web/src/pages/camp.tsx#L761)) — accepts input, default value sensible, persists after refresh
- [ ] **Visual Acuity (R)** (`TextInput`, [line 762](../../../apps/web/src/pages/camp.tsx#L762)) — accepts input, default value sensible, persists after refresh
- [ ] **Findings** (`Textarea`, [line 764](../../../apps/web/src/pages/camp.tsx#L764)) — accepts input, default value sensible, persists after refresh
- [ ] **Diagnosis** (`Textarea`, [line 765](../../../apps/web/src/pages/camp.tsx#L765)) — accepts input, default value sensible, persists after refresh
- [ ] **Advice** (`Textarea`, [line 766](../../../apps/web/src/pages/camp.tsx#L766)) — accepts input, default value sensible, persists after refresh
- [ ] **Referred to Hospital** (`Switch`, [line 767](../../../apps/web/src/pages/camp.tsx#L767)) — accepts input, default value sensible, persists after refresh
- [ ] **Referral Department** (`TextInput`, [line 770](../../../apps/web/src/pages/camp.tsx#L770)) — accepts input, default value sensible, persists after refresh
- [ ] **Urgency** (`Select`, [line 771](../../../apps/web/src/pages/camp.tsx#L771)) — accepts input, default value sensible, persists after refresh
- [ ] **Registration ID** (`TextInput`, [line 783](../../../apps/web/src/pages/camp.tsx#L783)) — accepts input, default value sensible, persists after refresh
- [ ] **Sample Type** (`Select`, [line 784](../../../apps/web/src/pages/camp.tsx#L784)) — accepts input, default value sensible, persists after refresh
- [ ] **Test Requested** (`TextInput`, [line 785](../../../apps/web/src/pages/camp.tsx#L785)) — accepts input, default value sensible, persists after refresh
- [ ] **Barcode** (`TextInput`, [line 786](../../../apps/web/src/pages/camp.tsx#L786)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 913>** (`Select`, [line 913](../../../apps/web/src/pages/camp.tsx#L913)) — accepts input, default value sensible, persists after refresh
- [ ] **Registration ID** (`TextInput`, [line 954](../../../apps/web/src/pages/camp.tsx#L954)) — accepts input, default value sensible, persists after refresh
- [ ] **Follow-up Date** (`DateInput`, [line 955](../../../apps/web/src/pages/camp.tsx#L955)) — accepts input, default value sensible, persists after refresh
- [ ] **Follow-up Type** (`Select`, [line 956](../../../apps/web/src/pages/camp.tsx#L956)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 957](../../../apps/web/src/pages/camp.tsx#L957)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1031>** (`Select`, [line 1031](../../../apps/web/src/pages/camp.tsx#L1031)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 12, `<ActionIcon>`: 8, `<Menu.Item>`: 0)

- [ ] **<button @ line 369>** ([line 369](../../../apps/web/src/pages/camp.tsx#L369)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 369>** ([line 369](../../../apps/web/src/pages/camp.tsx#L369)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 396>** ([line 396](../../../apps/web/src/pages/camp.tsx#L396)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 396>** ([line 396](../../../apps/web/src/pages/camp.tsx#L396)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 480>** ([line 480](../../../apps/web/src/pages/camp.tsx#L480)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 480>** ([line 480](../../../apps/web/src/pages/camp.tsx#L480)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 492>** ([line 492](../../../apps/web/src/pages/camp.tsx#L492)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 492>** ([line 492](../../../apps/web/src/pages/camp.tsx#L492)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 576>** ([line 576](../../../apps/web/src/pages/camp.tsx#L576)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 576>** ([line 576](../../../apps/web/src/pages/camp.tsx#L576)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 603>** ([line 603](../../../apps/web/src/pages/camp.tsx#L603)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 603>** ([line 603](../../../apps/web/src/pages/camp.tsx#L603)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 719>** ([line 719](../../../apps/web/src/pages/camp.tsx#L719)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 719>** ([line 719](../../../apps/web/src/pages/camp.tsx#L719)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 729>** ([line 729](../../../apps/web/src/pages/camp.tsx#L729)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 729>** ([line 729](../../../apps/web/src/pages/camp.tsx#L729)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 774>** ([line 774](../../../apps/web/src/pages/camp.tsx#L774)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 774>** ([line 774](../../../apps/web/src/pages/camp.tsx#L774)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 787>** ([line 787](../../../apps/web/src/pages/camp.tsx#L787)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 787>** ([line 787](../../../apps/web/src/pages/camp.tsx#L787)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 922>** ([line 922](../../../apps/web/src/pages/camp.tsx#L922)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 922>** ([line 922](../../../apps/web/src/pages/camp.tsx#L922)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 958>** ([line 958](../../../apps/web/src/pages/camp.tsx#L958)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 958>** ([line 958](../../../apps/web/src/pages/camp.tsx#L958)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 285>** ([line 285](../../../apps/web/src/pages/camp.tsx#L285)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 299>** ([line 299](../../../apps/web/src/pages/camp.tsx#L299)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 312>** ([line 312](../../../apps/web/src/pages/camp.tsx#L312)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 325>** ([line 325](../../../apps/web/src/pages/camp.tsx#L325)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 338>** ([line 338](../../../apps/web/src/pages/camp.tsx#L338)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 455>** ([line 455](../../../apps/web/src/pages/camp.tsx#L455)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 880>** ([line 880](../../../apps/web/src/pages/camp.tsx#L880)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 893>** ([line 893](../../../apps/web/src/pages/camp.tsx#L893)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (21)

- [ ] `api.activateCamp` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.addCampTeamMember` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.approveCamp` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.campAnalytics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.campReport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.cancelCamp` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.completeCamp` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCamp` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCampFollowup` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCampLabSample` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCampRegistration` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCampScreening` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getCampStats` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCampFollowups` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCampLabSamples` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCampRegistrations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCampScreenings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCampTeamMembers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCamps` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.removeCampTeamMember` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateCampFollowup` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._