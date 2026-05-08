# `admin/doctor-schedules.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/doctor-schedules.tsx`](../../../apps/web/src/pages/admin/doctor-schedules.tsx) (924 lines). Guard: `P.OPD.SCHEDULE.LIST`. API methods: 9. useForm: 0. Tables: 2. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.OPD.SCHEDULE.LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tables / lists

### `<Table>` @ line 729
  - [ ] Header **Day** column shows correct value for at least one row
  - [ ] Header **Department** column shows correct value for at least one row
  - [ ] Header **Time** column shows correct value for at least one row
  - [ ] Header **Slot Duration** column shows correct value for at least one row
  - [ ] Header **Max Patients** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 832
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Hours** column shows correct value for at least one row
  - [ ] Header **Reason** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 166>_ @ [line 166](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L166)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Add Schedule Exception_ @ [line 308](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L308)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (14)

- [ ] **<Checkbox @ line 181>** (`Checkbox`, [line 181](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L181)) — accepts input, default value sensible, persists after refresh
- [ ] **Day of Week** (`Checkbox`, [line 184](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L184)) — accepts input, default value sensible, persists after refresh
- [ ] **Day of Week** (`TextInput`, [line 191](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L191)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Time** (`Select`, [line 198](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L198)) — accepts input, default value sensible, persists after refresh
- [ ] **End Time** (`Select`, [line 208](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L208)) — accepts input, default value sensible, persists after refresh
- [ ] **Slot Duration (min)** (`NumberInput`, [line 220](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L220)) — accepts input, default value sensible, persists after refresh
- [ ] **Max Patients / Slot** (`NumberInput`, [line 228](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L228)) — accepts input, default value sensible, persists after refresh
- [ ] **Active** (`Switch`, [line 237](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L237)) — accepts input, default value sensible, persists after refresh
- [ ] **Override with custom availability** (`Switch`, [line 337](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L337)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Time** (`Select`, [line 345](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L345)) — accepts input, default value sensible, persists after refresh
- [ ] **End Time** (`Select`, [line 352](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L352)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`Textarea`, [line 361](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L361)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 553>** (`TextInput`, [line 553](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L553)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`Select`, [line 636](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L636)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 11, `<ActionIcon>`: 3, `<Menu.Item>`: 0)

- [ ] **setSelectedDays(["1","2","3","4","5"])}>Mon–Fri** ([line 177](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L177)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setSelectedDays(["1","2","3","4","5"])}>Mon–Fri** ([line 177](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L177)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setSelectedDays(["0","1","2","3","4","5","6"])}>All Days** ([line 178](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L178)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setSelectedDays(["0","1","2","3","4","5","6"])}>All Days** ([line 178](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L178)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setSelectedDays([])}>Clear** ([line 179](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L179)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setSelectedDays([])}>Clear** ([line 179](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L179)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 244](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L244)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 244](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L244)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 247>** ([line 247](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L247)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 247>** ([line 247](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L247)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 325>** ([line 325](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L325)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 325>** ([line 325](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L325)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 369](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L369)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 369](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L369)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 372>** ([line 372](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L372)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 372>** ([line 372](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L372)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setSelectedDoctor(null)}>               Back to Doctors** ([line 627](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L627)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setSelectedDoctor(null)}>               Back to Doctors** ([line 627](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L627)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 666>** ([line 666](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L666)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 666>** ([line 666](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L666)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 676>** ([line 676](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L676)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 676>** ([line 676](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L676)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **Edit** ([line 787](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L787)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **Delete** ([line 799](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L799)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **Remove** ([line 873](../../../apps/web/src/pages/admin/doctor-schedules.tsx#L873)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (9)

- [ ] `api.createSchedule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createScheduleException` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteSchedule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteScheduleException` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDepartments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDoctors` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listScheduleExceptions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSchedules` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateSchedule` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._