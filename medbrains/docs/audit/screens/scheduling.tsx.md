# `scheduling.tsx` walkthrough

_Source: [`apps/web/src/pages/scheduling.tsx`](../../../apps/web/src/pages/scheduling.tsx) (1498 lines). Guard: `P.SCHEDULING.PREDICTIONS_LIST`. API methods: 20. useForm: 0. Tables: 0. Modals: 5._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.SCHEDULING.PREDICTIONS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            No-Show Predictions** (`predictions`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            No-Show Predictions** (`predictions`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            No-Show Predictions** (`predictions`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Waitlist** (`waitlist`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Waitlist** (`waitlist`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Waitlist** (`waitlist`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Overbooking Config** (`overbooking`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Overbooking Config** (`overbooking`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Overbooking Config** (`overbooking`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Conflicts** (`conflicts`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Conflicts** (`conflicts`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Conflicts** (`conflicts`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Recurring & Blocks** (`scheduling`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Recurring & Blocks** (`scheduling`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Recurring & Blocks** (`scheduling`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Analytics** (`analytics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Analytics** (`analytics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Analytics** (`analytics`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (32)
- [ ] Column **Appointment** (`appointment_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **No-Show Probability** (`predicted_noshow_probability`) renders without `undefined` / `[object Object]`
- [ ] Column **Risk Level** (`risk_level`) renders without `undefined` / `[object Object]`
- [ ] Column **Model** (`model_version`) renders without `undefined` / `[object Object]`
- [ ] Column **Scored At** (`scored_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Doctor** (`doctor_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department_id`) renders without `undefined` / `[object Object]`
- [ ] Column **From** (`preferred_date_from`) renders without `undefined` / `[object Object]`
- [ ] Column **To** (`preferred_date_to`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Doctor** (`doctor_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Day** (`day_of_week`) renders without `undefined` / `[object Object]`
- [ ] Column **Max Overbook** (`max_overbook_slots`) renders without `undefined` / `[object Object]`
- [ ] Column **Threshold** (`overbook_threshold_probability`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Resource** (`resource_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Resource ID** (`resource_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Slot A** (`slot_a`) renders without `undefined` / `[object Object]`
- [ ] Column **Slot B** (`slot_b`) renders without `undefined` / `[object Object]`
- [ ] Column **Overlap Window** (`overlap`) renders without `undefined` / `[object Object]`
- [ ] Column **Doctor** (`doctor_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Total Appts** (`total_appointments`) renders without `undefined` / `[object Object]`
- [ ] Column **No-Shows** (`noshow_count`) renders without `undefined` / `[object Object]`
- [ ] Column **No-Show Rate** (`noshow_rate`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Modal — _Create Recurring Appointment Slots_ @ [line 1144](../../../apps/web/src/pages/scheduling.tsx#L1144)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Block Schedule_ @ [line 1213](../../../apps/web/src/pages/scheduling.tsx#L1213)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _Add to Waitlist_ @ [line 598](../../../apps/web/src/pages/scheduling.tsx#L598)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Offer Slot_ @ [line 649](../../../apps/web/src/pages/scheduling.tsx#L649)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 861>_ @ [line 861](../../../apps/web/src/pages/scheduling.tsx#L861)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (31)

- [ ] **<Select @ line 290>** (`Select`, [line 290](../../../apps/web/src/pages/scheduling.tsx#L290)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 556>** (`Select`, [line 556](../../../apps/web/src/pages/scheduling.tsx#L556)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient ID** (`TextInput`, [line 600](../../../apps/web/src/pages/scheduling.tsx#L600)) — accepts input, default value sensible, persists after refresh
- [ ] **Doctor ID** (`TextInput`, [line 606](../../../apps/web/src/pages/scheduling.tsx#L606)) — accepts input, default value sensible, persists after refresh
- [ ] **Department ID** (`TextInput`, [line 611](../../../apps/web/src/pages/scheduling.tsx#L611)) — accepts input, default value sensible, persists after refresh
- [ ] **Preferred Date From** (`DateInput`, [line 616](../../../apps/web/src/pages/scheduling.tsx#L616)) — accepts input, default value sensible, persists after refresh
- [ ] **Preferred Date To** (`DateInput`, [line 621](../../../apps/web/src/pages/scheduling.tsx#L621)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 626](../../../apps/web/src/pages/scheduling.tsx#L626)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`Textarea`, [line 637](../../../apps/web/src/pages/scheduling.tsx#L637)) — accepts input, default value sensible, persists after refresh
- [ ] **Offered Appointment ID** (`TextInput`, [line 654](../../../apps/web/src/pages/scheduling.tsx#L654)) — accepts input, default value sensible, persists after refresh
- [ ] **Doctor ID** (`TextInput`, [line 873](../../../apps/web/src/pages/scheduling.tsx#L873)) — accepts input, default value sensible, persists after refresh
- [ ] **Department ID** (`TextInput`, [line 880](../../../apps/web/src/pages/scheduling.tsx#L880)) — accepts input, default value sensible, persists after refresh
- [ ] **Day of Week** (`Select`, [line 887](../../../apps/web/src/pages/scheduling.tsx#L887)) — accepts input, default value sensible, persists after refresh
- [ ] **Max Overbook Slots** (`NumberInput`, [line 895](../../../apps/web/src/pages/scheduling.tsx#L895)) — accepts input, default value sensible, persists after refresh
- [ ] **Overbook Threshold Probability** (`NumberInput`, [line 902](../../../apps/web/src/pages/scheduling.tsx#L902)) — accepts input, default value sensible, persists after refresh
- [ ] **Active** (`Switch`, [line 912](../../../apps/web/src/pages/scheduling.tsx#L912)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1107>** (`TextInput`, [line 1107](../../../apps/web/src/pages/scheduling.tsx#L1107)) — accepts input, default value sensible, persists after refresh
- [ ] **Resource ID** (`TextInput`, [line 1151](../../../apps/web/src/pages/scheduling.tsx#L1151)) — accepts input, default value sensible, persists after refresh
- [ ] **Resource Type** (`Select`, [line 1158](../../../apps/web/src/pages/scheduling.tsx#L1158)) — accepts input, default value sensible, persists after refresh
- [ ] **Day of Week** (`Select`, [line 1168](../../../apps/web/src/pages/scheduling.tsx#L1168)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Time** (`TextInput`, [line 1175](../../../apps/web/src/pages/scheduling.tsx#L1175)) — accepts input, default value sensible, persists after refresh
- [ ] **End Time** (`TextInput`, [line 1181](../../../apps/web/src/pages/scheduling.tsx#L1181)) — accepts input, default value sensible, persists after refresh
- [ ] **Repeat Count (weeks)** (`NumberInput`, [line 1188](../../../apps/web/src/pages/scheduling.tsx#L1188)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Date** (`TextInput`, [line 1195](../../../apps/web/src/pages/scheduling.tsx#L1195)) — accepts input, default value sensible, persists after refresh
- [ ] **Resource ID** (`TextInput`, [line 1220](../../../apps/web/src/pages/scheduling.tsx#L1220)) — accepts input, default value sensible, persists after refresh
- [ ] **Resource Type** (`Select`, [line 1227](../../../apps/web/src/pages/scheduling.tsx#L1227)) — accepts input, default value sensible, persists after refresh
- [ ] **Block Start (ISO datetime)** (`TextInput`, [line 1237](../../../apps/web/src/pages/scheduling.tsx#L1237)) — accepts input, default value sensible, persists after refresh
- [ ] **Block End (ISO datetime)** (`TextInput`, [line 1244](../../../apps/web/src/pages/scheduling.tsx#L1244)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`Textarea`, [line 1251](../../../apps/web/src/pages/scheduling.tsx#L1251)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1360>** (`TextInput`, [line 1360](../../../apps/web/src/pages/scheduling.tsx#L1360)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1367>** (`TextInput`, [line 1367](../../../apps/web/src/pages/scheduling.tsx#L1367)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 12, `<ActionIcon>`: 6, `<Menu.Item>`: 0)

- [ ] **<button @ line 303>** ([line 303](../../../apps/web/src/pages/scheduling.tsx#L303)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 303>** ([line 303](../../../apps/web/src/pages/scheduling.tsx#L303)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 572>** ([line 572](../../../apps/web/src/pages/scheduling.tsx#L572)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 572>** ([line 572](../../../apps/web/src/pages/scheduling.tsx#L572)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 582>** ([line 582](../../../apps/web/src/pages/scheduling.tsx#L582)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 582>** ([line 582](../../../apps/web/src/pages/scheduling.tsx#L582)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Create Entry** ([line 642](../../../apps/web/src/pages/scheduling.tsx#L642)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Create Entry** ([line 642](../../../apps/web/src/pages/scheduling.tsx#L642)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Offer Slot** ([line 660](../../../apps/web/src/pages/scheduling.tsx#L660)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Offer Slot** ([line 660](../../../apps/web/src/pages/scheduling.tsx#L660)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 840>** ([line 840](../../../apps/web/src/pages/scheduling.tsx#L840)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 840>** ([line 840](../../../apps/web/src/pages/scheduling.tsx#L840)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 918>** ([line 918](../../../apps/web/src/pages/scheduling.tsx#L918)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 918>** ([line 918](../../../apps/web/src/pages/scheduling.tsx#L918)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1113>** ([line 1113](../../../apps/web/src/pages/scheduling.tsx#L1113)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1113>** ([line 1113](../../../apps/web/src/pages/scheduling.tsx#L1113)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1126>** ([line 1126](../../../apps/web/src/pages/scheduling.tsx#L1126)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1126>** ([line 1126](../../../apps/web/src/pages/scheduling.tsx#L1126)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1132>** ([line 1132](../../../apps/web/src/pages/scheduling.tsx#L1132)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1132>** ([line 1132](../../../apps/web/src/pages/scheduling.tsx#L1132)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1202>** ([line 1202](../../../apps/web/src/pages/scheduling.tsx#L1202)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1202>** ([line 1202](../../../apps/web/src/pages/scheduling.tsx#L1202)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1257>** ([line 1257](../../../apps/web/src/pages/scheduling.tsx#L1257)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1257>** ([line 1257](../../../apps/web/src/pages/scheduling.tsx#L1257)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 271>** ([line 271](../../../apps/web/src/pages/scheduling.tsx#L271)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **Offer Slot** ([line 505](../../../apps/web/src/pages/scheduling.tsx#L505)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **Accept** ([line 522](../../../apps/web/src/pages/scheduling.tsx#L522)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **Decline** ([line 533](../../../apps/web/src/pages/scheduling.tsx#L533)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 816>** ([line 816](../../../apps/web/src/pages/scheduling.tsx#L816)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 819>** ([line 819](../../../apps/web/src/pages/scheduling.tsx#L819)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (20)

- [ ] `api.autoFillSlots` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createOverbookingRule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRecurringAppointment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createScheduleBlock` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createWaitlistEntry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteOverbookingRule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOverbookingRules` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPredictions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listWaitlist` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.noshowRates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.offerSlot` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.predictionAccuracy` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.promoteWaitlist` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.respondToOffer` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.scheduleAnalytics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.schedulingConflicts` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.scoreAppointment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.scoreBatch` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateOverbookingRule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.waitlistStats` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._