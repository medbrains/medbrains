# `appointments.tsx` walkthrough

_Source: [`apps/web/src/pages/appointments.tsx`](../../../apps/web/src/pages/appointments.tsx) (820 lines). Guard: `P.OPD.APPOINTMENT.LIST`. API methods: 11. useForm: 0. Tables: 1. Modals: 3._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.OPD.APPOINTMENT.LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tables / lists

### `<Table>` @ line 534
  - [ ] Header **Token** column shows correct value for at least one row
  - [ ] Header **Time** column shows correct value for at least one row
  - [ ] Header **Patient** column shows correct value for at least one row
  - [ ] Header **Doctor** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Reason** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _Book Appointment_ @ [line 199](../../../apps/web/src/pages/appointments.tsx#L199)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 689>_ @ [line 689](../../../apps/web/src/pages/appointments.tsx#L689)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 726>_ @ [line 726](../../../apps/web/src/pages/appointments.tsx#L726)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (8)

- [ ] **Patient** (`Select`, [line 207](../../../apps/web/src/pages/appointments.tsx#L207)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`Select`, [line 216](../../../apps/web/src/pages/appointments.tsx#L216)) — accepts input, default value sensible, persists after refresh
- [ ] **Doctor** (`Select`, [line 225](../../../apps/web/src/pages/appointments.tsx#L225)) — accepts input, default value sensible, persists after refresh
- [ ] **Appointment Type** (`Select`, [line 248](../../../apps/web/src/pages/appointments.tsx#L248)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason for Visit** (`Textarea`, [line 259](../../../apps/web/src/pages/appointments.tsx#L259)) — accepts input, default value sensible, persists after refresh
- [ ] **Recurring** (`Select`, [line 267](../../../apps/web/src/pages/appointments.tsx#L267)) — accepts input, default value sensible, persists after refresh
- [ ] **Number of Appointments** (`Select`, [line 280](../../../apps/web/src/pages/appointments.tsx#L280)) — accepts input, default value sensible, persists after refresh
- [ ] **Cancel Reason** (`Textarea`, [line 703](../../../apps/web/src/pages/appointments.tsx#L703)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 11, `<ActionIcon>`: 5, `<Menu.Item>`: 0)

- [ ] **Cancel** ([line 289](../../../apps/web/src/pages/appointments.tsx#L289)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 289](../../../apps/web/src/pages/appointments.tsx#L289)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 292>** ([line 292](../../../apps/web/src/pages/appointments.tsx#L292)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 292>** ([line 292](../../../apps/web/src/pages/appointments.tsx#L292)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 324>** ([line 324](../../../apps/web/src/pages/appointments.tsx#L324)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 324>** ([line 324](../../../apps/web/src/pages/appointments.tsx#L324)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setStep("form")}>               Back** ([line 343](../../../apps/web/src/pages/appointments.tsx#L343)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setStep("form")}>               Back** ([line 343](../../../apps/web/src/pages/appointments.tsx#L343)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 346>** ([line 346](../../../apps/web/src/pages/appointments.tsx#L346)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 346>** ([line 346](../../../apps/web/src/pages/appointments.tsx#L346)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 507>** ([line 507](../../../apps/web/src/pages/appointments.tsx#L507)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 507>** ([line 507](../../../apps/web/src/pages/appointments.tsx#L507)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setCancelTarget(null)}>               Keep** ([line 711](../../../apps/web/src/pages/appointments.tsx#L711)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setCancelTarget(null)}>               Keep** ([line 711](../../../apps/web/src/pages/appointments.tsx#L711)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 714>** ([line 714](../../../apps/web/src/pages/appointments.tsx#L714)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 714>** ([line 714](../../../apps/web/src/pages/appointments.tsx#L714)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 772>** ([line 772](../../../apps/web/src/pages/appointments.tsx#L772)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 772>** ([line 772](../../../apps/web/src/pages/appointments.tsx#L772)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 789>** ([line 789](../../../apps/web/src/pages/appointments.tsx#L789)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 789>** ([line 789](../../../apps/web/src/pages/appointments.tsx#L789)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 799>** ([line 799](../../../apps/web/src/pages/appointments.tsx#L799)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 799>** ([line 799](../../../apps/web/src/pages/appointments.tsx#L799)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **Check In** ([line 597](../../../apps/web/src/pages/appointments.tsx#L597)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **No Show** ([line 608](../../../apps/web/src/pages/appointments.tsx#L608)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **Reschedule** ([line 624](../../../apps/web/src/pages/appointments.tsx#L624)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **Complete** ([line 641](../../../apps/web/src/pages/appointments.tsx#L641)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **Cancel** ([line 656](../../../apps/web/src/pages/appointments.tsx#L656)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (11)

- [ ] `api.bookAppointment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.cancelAppointment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.checkInAppointment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.completeAppointment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAvailableSlots` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAppointments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDepartments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatients` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSetupUsers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.markAppointmentNoShow` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.rescheduleAppointment` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._