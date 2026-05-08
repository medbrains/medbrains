# `security.tsx` walkthrough

_Source: [`apps/web/src/pages/security.tsx`](../../../apps/web/src/pages/security.tsx) (579 lines). Guard: `P.SECURITY.ACCESS_LIST`. API methods: 19. useForm: 0. Tables: 8. Modals: 7._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.SECURITY.ACCESS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Access Control** (`access`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Access Control** (`access`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Access Control** (`access`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>CCTV** (`cctv`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>CCTV** (`cctv`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>CCTV** (`cctv`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Incidents** (`incidents`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Incidents** (`incidents`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Incidents** (`incidents`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Patient Safety** (`patient-safety`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Patient Safety** (`patient-safety`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Patient Safety** (`patient-safety`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Code Debriefs** (`debriefs`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Code Debriefs** (`debriefs`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Code Debriefs** (`debriefs`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (48)
- [ ] Column **Code** (`zone_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Level** (`level`) renders without `undefined` / `[object Object]`
- [ ] Column **After Hours** (`after_hours`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Card #** (`card_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Employee** (`employee_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`card_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Issued** (`issued_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Zone** (`zone_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Person** (`person_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Method** (`access_method`) renders without `undefined` / `[object Object]`
- [ ] Column **Direction** (`direction`) renders without `undefined` / `[object Object]`
- [ ] Column **Access** (`granted`) renders without `undefined` / `[object Object]`
- [ ] Column **After Hours** (`is_after_hours`) renders without `undefined` / `[object Object]`
- [ ] Column **Time** (`accessed_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Zone** (`zone_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`camera_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Resolution** (`resolution`) renders without `undefined` / `[object Object]`
- [ ] Column **Retention** (`retention_days`) renders without `undefined` / `[object Object]`
- [ ] Column **Recording** (`is_recording`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Incident #** (`incident_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Severity** (`severity`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Zone** (`zone_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Occurred** (`occurred_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Police** (`police_notified`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Tag Type** (`tag_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Tag ID** (`tag_identifier`) renders without `undefined` / `[object Object]`
- [ ] Column **Zone** (`allowed_zone_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`alert_status`) renders without `undefined` / `[object Object]`
- [ ] Column **Activated** (`activated_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Alert Type** (`alert_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Triggered** (`triggered_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Zone** (`zone_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`is_resolved`) renders without `undefined` / `[object Object]`
- [ ] Column **False Alarm** (`was_false_alarm`) renders without `undefined` / `[object Object]`
- [ ] Column **Code Activation** (`code_activation_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`debrief_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Response (sec)** (`response_time_seconds`) renders without `undefined` / `[object Object]`
- [ ] Column **Duration (min)** (`total_duration_minutes`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`action_items`) renders without `undefined` / `[object Object]`
- [ ] Column **Created** (`created_at`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _Add Security Zone_ @ [line 231](../../../apps/web/src/pages/security.tsx#L231)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Issue Access Card_ @ [line 249](../../../apps/web/src/pages/security.tsx#L249)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Access Log_ @ [line 259](../../../apps/web/src/pages/security.tsx#L259)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Camera_ @ [line 310](../../../apps/web/src/pages/security.tsx#L310)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Report Security Incident_ @ [line 383](../../../apps/web/src/pages/security.tsx#L383)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Activate Patient Safety Tag_ @ [line 481](../../../apps/web/src/pages/security.tsx#L481)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Code Debrief_ @ [line 529](../../../apps/web/src/pages/security.tsx#L529)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (45)

- [ ] **Zone Code** (`TextInput`, [line 233](../../../apps/web/src/pages/security.tsx#L233)) — accepts input, default value sensible, persists after refresh
- [ ] **Zone Name** (`TextInput`, [line 234](../../../apps/web/src/pages/security.tsx#L234)) — accepts input, default value sensible, persists after refresh
- [ ] **Security Level** (`Select`, [line 235](../../../apps/web/src/pages/security.tsx#L235)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 236](../../../apps/web/src/pages/security.tsx#L236)) — accepts input, default value sensible, persists after refresh
- [ ] **After Hours Restricted** (`Switch`, [line 237](../../../apps/web/src/pages/security.tsx#L237)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Time** (`TextInput`, [line 240](../../../apps/web/src/pages/security.tsx#L240)) — accepts input, default value sensible, persists after refresh
- [ ] **End Time** (`TextInput`, [line 241](../../../apps/web/src/pages/security.tsx#L241)) — accepts input, default value sensible, persists after refresh
- [ ] **Employee ID** (`TextInput`, [line 251](../../../apps/web/src/pages/security.tsx#L251)) — accepts input, default value sensible, persists after refresh
- [ ] **Card Number** (`TextInput`, [line 252](../../../apps/web/src/pages/security.tsx#L252)) — accepts input, default value sensible, persists after refresh
- [ ] **Card Type** (`Select`, [line 253](../../../apps/web/src/pages/security.tsx#L253)) — accepts input, default value sensible, persists after refresh
- [ ] **Zone** (`Select`, [line 261](../../../apps/web/src/pages/security.tsx#L261)) — accepts input, default value sensible, persists after refresh
- [ ] **Person Name** (`TextInput`, [line 262](../../../apps/web/src/pages/security.tsx#L262)) — accepts input, default value sensible, persists after refresh
- [ ] **Access Method** (`Select`, [line 263](../../../apps/web/src/pages/security.tsx#L263)) — accepts input, default value sensible, persists after refresh
- [ ] **Direction** (`Select`, [line 264](../../../apps/web/src/pages/security.tsx#L264)) — accepts input, default value sensible, persists after refresh
- [ ] **Granted** (`Switch`, [line 265](../../../apps/web/src/pages/security.tsx#L265)) — accepts input, default value sensible, persists after refresh
- [ ] **After Hours** (`Switch`, [line 266](../../../apps/web/src/pages/security.tsx#L266)) — accepts input, default value sensible, persists after refresh
- [ ] **Camera Name** (`TextInput`, [line 312](../../../apps/web/src/pages/security.tsx#L312)) — accepts input, default value sensible, persists after refresh
- [ ] **Camera ID** (`TextInput`, [line 313](../../../apps/web/src/pages/security.tsx#L313)) — accepts input, default value sensible, persists after refresh
- [ ] **Zone** (`Select`, [line 314](../../../apps/web/src/pages/security.tsx#L314)) — accepts input, default value sensible, persists after refresh
- [ ] **Location Description** (`TextInput`, [line 315](../../../apps/web/src/pages/security.tsx#L315)) — accepts input, default value sensible, persists after refresh
- [ ] **Camera Type** (`Select`, [line 316](../../../apps/web/src/pages/security.tsx#L316)) — accepts input, default value sensible, persists after refresh
- [ ] **Resolution** (`TextInput`, [line 317](../../../apps/web/src/pages/security.tsx#L317)) — accepts input, default value sensible, persists after refresh
- [ ] **Retention Days** (`NumberInput`, [line 318](../../../apps/web/src/pages/security.tsx#L318)) — accepts input, default value sensible, persists after refresh
- [ ] **IP Address** (`TextInput`, [line 319](../../../apps/web/src/pages/security.tsx#L319)) — accepts input, default value sensible, persists after refresh
- [ ] **Severity** (`Select`, [line 385](../../../apps/web/src/pages/security.tsx#L385)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 386](../../../apps/web/src/pages/security.tsx#L386)) — accepts input, default value sensible, persists after refresh
- [ ] **Zone** (`Select`, [line 387](../../../apps/web/src/pages/security.tsx#L387)) — accepts input, default value sensible, persists after refresh
- [ ] **Location** (`TextInput`, [line 388](../../../apps/web/src/pages/security.tsx#L388)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 389](../../../apps/web/src/pages/security.tsx#L389)) — accepts input, default value sensible, persists after refresh
- [ ] **Police Notified** (`Switch`, [line 390](../../../apps/web/src/pages/security.tsx#L390)) — accepts input, default value sensible, persists after refresh
- [ ] **Police Report Number** (`TextInput`, [line 392](../../../apps/web/src/pages/security.tsx#L392)) — accepts input, default value sensible, persists after refresh
- [ ] **Tag Type** (`Select`, [line 484](../../../apps/web/src/pages/security.tsx#L484)) — accepts input, default value sensible, persists after refresh
- [ ] **Tag Identifier** (`TextInput`, [line 485](../../../apps/web/src/pages/security.tsx#L485)) — accepts input, default value sensible, persists after refresh
- [ ] **Allowed Zone** (`Select`, [line 486](../../../apps/web/src/pages/security.tsx#L486)) — accepts input, default value sensible, persists after refresh
- [ ] **Mother ID (for infant tags)** (`TextInput`, [line 487](../../../apps/web/src/pages/security.tsx#L487)) — accepts input, default value sensible, persists after refresh
- [ ] **Code Activation ID** (`TextInput`, [line 531](../../../apps/web/src/pages/security.tsx#L531)) — accepts input, default value sensible, persists after refresh
- [ ] **Response Time (seconds)** (`NumberInput`, [line 532](../../../apps/web/src/pages/security.tsx#L532)) — accepts input, default value sensible, persists after refresh
- [ ] **Total Duration (minutes)** (`NumberInput`, [line 533](../../../apps/web/src/pages/security.tsx#L533)) — accepts input, default value sensible, persists after refresh
- [ ] **What Went Well** (`Textarea`, [line 534](../../../apps/web/src/pages/security.tsx#L534)) — accepts input, default value sensible, persists after refresh
- [ ] **What Went Wrong** (`Textarea`, [line 535](../../../apps/web/src/pages/security.tsx#L535)) — accepts input, default value sensible, persists after refresh
- [ ] **Root Cause** (`Textarea`, [line 536](../../../apps/web/src/pages/security.tsx#L536)) — accepts input, default value sensible, persists after refresh
- [ ] **Lessons Learned** (`Textarea`, [line 537](../../../apps/web/src/pages/security.tsx#L537)) — accepts input, default value sensible, persists after refresh
- [ ] **Equipment Issues** (`Textarea`, [line 538](../../../apps/web/src/pages/security.tsx#L538)) — accepts input, default value sensible, persists after refresh
- [ ] **Training Gaps** (`Textarea`, [line 539](../../../apps/web/src/pages/security.tsx#L539)) — accepts input, default value sensible, persists after refresh
- [ ] **Protocol Changes Recommended** (`Textarea`, [line 540](../../../apps/web/src/pages/security.tsx#L540)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 14, `<ActionIcon>`: 6, `<Menu.Item>`: 0)

- [ ] **<button @ line 214>** ([line 214](../../../apps/web/src/pages/security.tsx#L214)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 214>** ([line 214](../../../apps/web/src/pages/security.tsx#L214)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 220>** ([line 220](../../../apps/web/src/pages/security.tsx#L220)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 220>** ([line 220](../../../apps/web/src/pages/security.tsx#L220)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 226>** ([line 226](../../../apps/web/src/pages/security.tsx#L226)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 226>** ([line 226](../../../apps/web/src/pages/security.tsx#L226)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 244>** ([line 244](../../../apps/web/src/pages/security.tsx#L244)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 244>** ([line 244](../../../apps/web/src/pages/security.tsx#L244)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 254>** ([line 254](../../../apps/web/src/pages/security.tsx#L254)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 254>** ([line 254](../../../apps/web/src/pages/security.tsx#L254)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 267>** ([line 267](../../../apps/web/src/pages/security.tsx#L267)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 267>** ([line 267](../../../apps/web/src/pages/security.tsx#L267)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 305>** ([line 305](../../../apps/web/src/pages/security.tsx#L305)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 305>** ([line 305](../../../apps/web/src/pages/security.tsx#L305)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 320>** ([line 320](../../../apps/web/src/pages/security.tsx#L320)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 320>** ([line 320](../../../apps/web/src/pages/security.tsx#L320)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 378>** ([line 378](../../../apps/web/src/pages/security.tsx#L378)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 378>** ([line 378](../../../apps/web/src/pages/security.tsx#L378)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 394>** ([line 394](../../../apps/web/src/pages/security.tsx#L394)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 394>** ([line 394](../../../apps/web/src/pages/security.tsx#L394)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 474>** ([line 474](../../../apps/web/src/pages/security.tsx#L474)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 474>** ([line 474](../../../apps/web/src/pages/security.tsx#L474)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 488>** ([line 488](../../../apps/web/src/pages/security.tsx#L488)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 488>** ([line 488](../../../apps/web/src/pages/security.tsx#L488)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 524>** ([line 524](../../../apps/web/src/pages/security.tsx#L524)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 524>** ([line 524](../../../apps/web/src/pages/security.tsx#L524)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 541>** ([line 541](../../../apps/web/src/pages/security.tsx#L541)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 541>** ([line 541](../../../apps/web/src/pages/security.tsx#L541)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 183>** ([line 183](../../../apps/web/src/pages/security.tsx#L183)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 360>** ([line 360](../../../apps/web/src/pages/security.tsx#L360)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 366>** ([line 366](../../../apps/web/src/pages/security.tsx#L366)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 438>** ([line 438](../../../apps/web/src/pages/security.tsx#L438)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 456>** ([line 456](../../../apps/web/src/pages/security.tsx#L456)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 461>** ([line 461](../../../apps/web/src/pages/security.tsx#L461)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (19)

- [ ] `api.createSecurityAccessCard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSecurityAccessLog` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSecurityCamera` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSecurityCodeDebrief` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSecurityIncident` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSecurityPatientTag` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSecurityZone` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deactivateSecurityAccessCard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deactivateSecurityPatientTag` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSecurityAccessCards` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSecurityAccessLogs` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSecurityCameras` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSecurityCodeDebriefs` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSecurityIncidents` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSecurityPatientTags` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSecurityTagAlerts` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSecurityZones` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.resolveSecurityTagAlert` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateSecurityIncident` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._