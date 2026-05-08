# `front-office.tsx` walkthrough

_Source: [`apps/web/src/pages/front-office.tsx`](../../../apps/web/src/pages/front-office.tsx) (881 lines). Guard: `P.FRONT_OFFICE.QUEUE_LIST`. API methods: 20. useForm: 0. Tables: 7. Modals: 6._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.FRONT_OFFICE.QUEUE_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Queue Dashboard** (`queue`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Queue Dashboard** (`queue`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Queue Dashboard** (`queue`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Visitor Management** (`visitors`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Visitor Management** (`visitors`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Visitor Management** (`visitors`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Queue Configuration** (`config`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Queue Configuration** (`config`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Queue Configuration** (`config`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Enquiry Desk** (`enquiry`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Enquiry Desk** (`enquiry`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Enquiry Desk** (`enquiry`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Visitor Analytics** (`analytics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Visitor Analytics** (`analytics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Visitor Analytics** (`analytics`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Queue Metrics** (`metrics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Queue Metrics** (`metrics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Queue Metrics** (`metrics`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (35)
- [ ] Column **Name** (`visitor_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Phone** (`phone`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **ID Type** (`id_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Purpose** (`purpose`) renders without `undefined` / `[object Object]`
- [ ] Column **Registered** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Pass #** (`pass_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Valid From** (`valid_from`) renders without `undefined` / `[object Object]`
- [ ] Column **Valid Until** (`valid_until`) renders without `undefined` / `[object Object]`
- [ ] Column **Bed** (`bed_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Weight** (`weight`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Location** (`location_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`display_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Doctors/Screen** (`doctors_per_screen`) renders without `undefined` / `[object Object]`
- [ ] Column **Show Wait** (`show_wait_time`) renders without `undefined` / `[object Object]`
- [ ] Column **Announce** (`announcement_enabled`) renders without `undefined` / `[object Object]`
- [ ] Column **Day** (`day_of_week`) renders without `undefined` / `[object Object]`
- [ ] Column **Start** (`start_time`) renders without `undefined` / `[object Object]`
- [ ] Column **End** (`end_time`) renders without `undefined` / `[object Object]`
- [ ] Column **Max Visitors** (`max_visitors_per_patient`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Caller** (`caller_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Phone** (`caller_phone`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`enquiry_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Response** (`response_text`) renders without `undefined` / `[object Object]`
- [ ] Column **Resolved** (`resolved`) renders without `undefined` / `[object Object]`
- [ ] Column **Time** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department`) renders without `undefined` / `[object Object]`
- [ ] Column **Currently Waiting** (`current_waiting`) renders without `undefined` / `[object Object]`
- [ ] Column **Avg Wait (min)** (`avg_wait_minutes`) renders without `undefined` / `[object Object]`
- [ ] Column **Longest Wait (min)** (`longest_wait_minutes`) renders without `undefined` / `[object Object]`
- [ ] Column **Throughput/hr** (`throughput_per_hour`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _Register Visitor_ @ [line 396](../../../apps/web/src/pages/front-office.tsx#L396)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Issue Visitor Pass_ @ [line 426](../../../apps/web/src/pages/front-office.tsx#L426)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Priority Rule_ @ [line 598](../../../apps/web/src/pages/front-office.tsx#L598)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Display Config_ @ [line 612](../../../apps/web/src/pages/front-office.tsx#L612)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Visiting Hours_ @ [line 640](../../../apps/web/src/pages/front-office.tsx#L640)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Log Enquiry_ @ [line 744](../../../apps/web/src/pages/front-office.tsx#L744)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (26)

- [ ] **Visitor Name** (`TextInput`, [line 398](../../../apps/web/src/pages/front-office.tsx#L398)) — accepts input, default value sensible, persists after refresh
- [ ] **Phone** (`TextInput`, [line 399](../../../apps/web/src/pages/front-office.tsx#L399)) — accepts input, default value sensible, persists after refresh
- [ ] **ID Type** (`Select`, [line 400](../../../apps/web/src/pages/front-office.tsx#L400)) — accepts input, default value sensible, persists after refresh
- [ ] **ID Number** (`TextInput`, [line 401](../../../apps/web/src/pages/front-office.tsx#L401)) — accepts input, default value sensible, persists after refresh
- [ ] **Relationship** (`TextInput`, [line 402](../../../apps/web/src/pages/front-office.tsx#L402)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 403](../../../apps/web/src/pages/front-office.tsx#L403)) — accepts input, default value sensible, persists after refresh
- [ ] **Purpose** (`Textarea`, [line 404](../../../apps/web/src/pages/front-office.tsx#L404)) — accepts input, default value sensible, persists after refresh
- [ ] **Valid Hours** (`NumberInput`, [line 429](../../../apps/web/src/pages/front-office.tsx#L429)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 600](../../../apps/web/src/pages/front-office.tsx#L600)) — accepts input, default value sensible, persists after refresh
- [ ] **Weight (higher = called sooner)** (`NumberInput`, [line 601](../../../apps/web/src/pages/front-office.tsx#L601)) — accepts input, default value sensible, persists after refresh
- [ ] **Location Name** (`TextInput`, [line 614](../../../apps/web/src/pages/front-office.tsx#L614)) — accepts input, default value sensible, persists after refresh
- [ ] **Display Type** (`Select`, [line 615](../../../apps/web/src/pages/front-office.tsx#L615)) — accepts input, default value sensible, persists after refresh
- [ ] **Doctors Per Screen** (`NumberInput`, [line 616](../../../apps/web/src/pages/front-office.tsx#L616)) — accepts input, default value sensible, persists after refresh
- [ ] **Show Patient Name** (`Switch`, [line 617](../../../apps/web/src/pages/front-office.tsx#L617)) — accepts input, default value sensible, persists after refresh
- [ ] **Show Wait Time** (`Switch`, [line 618](../../../apps/web/src/pages/front-office.tsx#L618)) — accepts input, default value sensible, persists after refresh
- [ ] **Enable Announcements** (`Switch`, [line 619](../../../apps/web/src/pages/front-office.tsx#L619)) — accepts input, default value sensible, persists after refresh
- [ ] **Day of Week** (`Select`, [line 642](../../../apps/web/src/pages/front-office.tsx#L642)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Time** (`TextInput`, [line 648](../../../apps/web/src/pages/front-office.tsx#L648)) — accepts input, default value sensible, persists after refresh
- [ ] **End Time** (`TextInput`, [line 649](../../../apps/web/src/pages/front-office.tsx#L649)) — accepts input, default value sensible, persists after refresh
- [ ] **Max Visitors Per Patient** (`NumberInput`, [line 650](../../../apps/web/src/pages/front-office.tsx#L650)) — accepts input, default value sensible, persists after refresh
- [ ] **Caller Name** (`TextInput`, [line 746](../../../apps/web/src/pages/front-office.tsx#L746)) — accepts input, default value sensible, persists after refresh
- [ ] **Caller Phone** (`TextInput`, [line 747](../../../apps/web/src/pages/front-office.tsx#L747)) — accepts input, default value sensible, persists after refresh
- [ ] **Enquiry Type** (`Select`, [line 748](../../../apps/web/src/pages/front-office.tsx#L748)) — accepts input, default value sensible, persists after refresh
- [ ] **Response** (`Textarea`, [line 749](../../../apps/web/src/pages/front-office.tsx#L749)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 801>** (`TextInput`, [line 801](../../../apps/web/src/pages/front-office.tsx#L801)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 802>** (`TextInput`, [line 802](../../../apps/web/src/pages/front-office.tsx#L802)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 11, `<ActionIcon>`: 5, `<Menu.Item>`: 0)

- [ ] **<button @ line 362>** ([line 362](../../../apps/web/src/pages/front-office.tsx#L362)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 362>** ([line 362](../../../apps/web/src/pages/front-office.tsx#L362)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 405>** ([line 405](../../../apps/web/src/pages/front-office.tsx#L405)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 405>** ([line 405](../../../apps/web/src/pages/front-office.tsx#L405)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 430>** ([line 430](../../../apps/web/src/pages/front-office.tsx#L430)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 430>** ([line 430](../../../apps/web/src/pages/front-office.tsx#L430)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 563>** ([line 563](../../../apps/web/src/pages/front-office.tsx#L563)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 563>** ([line 563](../../../apps/web/src/pages/front-office.tsx#L563)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 576>** ([line 576](../../../apps/web/src/pages/front-office.tsx#L576)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 576>** ([line 576](../../../apps/web/src/pages/front-office.tsx#L576)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 589>** ([line 589](../../../apps/web/src/pages/front-office.tsx#L589)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 589>** ([line 589](../../../apps/web/src/pages/front-office.tsx#L589)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 602>** ([line 602](../../../apps/web/src/pages/front-office.tsx#L602)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 602>** ([line 602](../../../apps/web/src/pages/front-office.tsx#L602)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 620>** ([line 620](../../../apps/web/src/pages/front-office.tsx#L620)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 620>** ([line 620](../../../apps/web/src/pages/front-office.tsx#L620)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 651>** ([line 651](../../../apps/web/src/pages/front-office.tsx#L651)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 651>** ([line 651](../../../apps/web/src/pages/front-office.tsx#L651)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 737>** ([line 737](../../../apps/web/src/pages/front-office.tsx#L737)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 737>** ([line 737](../../../apps/web/src/pages/front-office.tsx#L737)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 750>** ([line 750](../../../apps/web/src/pages/front-office.tsx#L750)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 750>** ([line 750](../../../apps/web/src/pages/front-office.tsx#L750)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 305>** ([line 305](../../../apps/web/src/pages/front-office.tsx#L305)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 334>** ([line 334](../../../apps/web/src/pages/front-office.tsx#L334)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 339>** ([line 339](../../../apps/web/src/pages/front-office.tsx#L339)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 344>** ([line 344](../../../apps/web/src/pages/front-office.tsx#L344)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 724>** ([line 724](../../../apps/web/src/pages/front-office.tsx#L724)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (20)

- [ ] `api.checkInVisitor` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.checkOutVisitor` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createEnquiry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createVisitor` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createVisitorPass` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getQueueStats` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listEnquiries` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listQueueDisplayConfig` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listQueuePriorityRules` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listVisitingHours` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listVisitorLogs` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listVisitorPasses` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listVisitors` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.queueMetrics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.resolveEnquiry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.revokeVisitorPass` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.upsertQueueDisplayConfig` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.upsertQueuePriorityRule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.upsertVisitingHours` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.visitorAnalytics` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._