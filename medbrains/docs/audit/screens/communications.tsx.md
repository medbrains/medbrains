# `communications.tsx` walkthrough

_Source: [`apps/web/src/pages/communications.tsx`](../../../apps/web/src/pages/communications.tsx) (610 lines). Guard: `P.COMMUNICATIONS.MESSAGES_LIST`. API methods: 20. useForm: 0. Tables: 7. Modals: 6._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.COMMUNICATIONS.MESSAGES_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Messages** (`messages`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Messages** (`messages`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Messages** (`messages`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Clinical** (`clinical`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Clinical** (`clinical`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Clinical** (`clinical`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Alerts** (`alerts`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Alerts** (`alerts`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Alerts** (`alerts`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Complaints** (`complaints`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Complaints** (`complaints`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Complaints** (`complaints`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Feedback** (`feedback`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Feedback** (`feedback`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Feedback** (`feedback`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>DLT** (`dlt`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>DLT** (`dlt`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>DLT** (`dlt`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Config** (`config`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Config** (`config`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Config** (`config`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (47)
- [ ] Column **Code** (`message_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Channel** (`channel`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Recipient** (`recipient_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Body** (`body`) renders without `undefined` / `[object Object]`
- [ ] Column **Created** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`message_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`message_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Subject** (`subject`) renders without `undefined` / `[object Object]`
- [ ] Column **Body** (`body`) renders without `undefined` / `[object Object]`
- [ ] Column **Read** (`is_read`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`alert_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Source** (`alert_source`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Title** (`title`) renders without `undefined` / `[object Object]`
- [ ] Column **Value** (`alert_value`) renders without `undefined` / `[object Object]`
- [ ] Column **Normal** (`normal_range`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`complaint_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Source** (`source`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Severity** (`severity`) renders without `undefined` / `[object Object]`
- [ ] Column **Complainant** (`complainant_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Subject** (`subject`) renders without `undefined` / `[object Object]`
- [ ] Column **SLA** (`sla_deadline`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`feedback_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`feedback_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Rating** (`overall_rating`) renders without `undefined` / `[object Object]`
- [ ] Column **NPS** (`nps_score`) renders without `undefined` / `[object Object]`
- [ ] Column **Recommend** (`would_recommend`) renders without `undefined` / `[object Object]`
- [ ] Column **Comments** (`comments`) renders without `undefined` / `[object Object]`
- [ ] Column **Submitted** (`submitted_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`template_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`template_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Channel** (`channel`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`template_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Lang** (`language`) renders without `undefined` / `[object Object]`
- [ ] Column **Scope** (`scope`) renders without `undefined` / `[object Object]`
- [ ] Column **DLT ID** (`template_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`template_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Sender** (`sender_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Lang** (`language`) renders without `undefined` / `[object Object]`
- [ ] Column **Expires** (`expires_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _Send Message_ @ [line 74](../../../apps/web/src/pages/communications.tsx#L74)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Clinical Message_ @ [line 132](../../../apps/web/src/pages/communications.tsx#L132)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Register Complaint_ @ [line 253](../../../apps/web/src/pages/communications.tsx#L253)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Collect Feedback_ @ [line 318](../../../apps/web/src/pages/communications.tsx#L318)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Template_ @ [line 368](../../../apps/web/src/pages/communications.tsx#L368)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Register DLT Template_ @ [line 493](../../../apps/web/src/pages/communications.tsx#L493)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (53)

- [ ] **<Select @ line 68>** (`Select`, [line 68](../../../apps/web/src/pages/communications.tsx#L68)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 69>** (`Select`, [line 69](../../../apps/web/src/pages/communications.tsx#L69)) — accepts input, default value sensible, persists after refresh
- [ ] **Channel** (`Select`, [line 76](../../../apps/web/src/pages/communications.tsx#L76)) — accepts input, default value sensible, persists after refresh
- [ ] **Recipient Name** (`TextInput`, [line 77](../../../apps/web/src/pages/communications.tsx#L77)) — accepts input, default value sensible, persists after refresh
- [ ] **Recipient Contact** (`TextInput`, [line 78](../../../apps/web/src/pages/communications.tsx#L78)) — accepts input, default value sensible, persists after refresh
- [ ] **Subject** (`TextInput`, [line 79](../../../apps/web/src/pages/communications.tsx#L79)) — accepts input, default value sensible, persists after refresh
- [ ] **Body** (`Textarea`, [line 80](../../../apps/web/src/pages/communications.tsx#L80)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 128>** (`Select`, [line 128](../../../apps/web/src/pages/communications.tsx#L128)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 135](../../../apps/web/src/pages/communications.tsx#L135)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 136](../../../apps/web/src/pages/communications.tsx#L136)) — accepts input, default value sensible, persists after refresh
- [ ] **Subject** (`TextInput`, [line 137](../../../apps/web/src/pages/communications.tsx#L137)) — accepts input, default value sensible, persists after refresh
- [ ] **Body** (`Textarea`, [line 138](../../../apps/web/src/pages/communications.tsx#L138)) — accepts input, default value sensible, persists after refresh
- [ ] **Urgent** (`Switch`, [line 139](../../../apps/web/src/pages/communications.tsx#L139)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 197>** (`Select`, [line 197](../../../apps/web/src/pages/communications.tsx#L197)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 249>** (`Select`, [line 249](../../../apps/web/src/pages/communications.tsx#L249)) — accepts input, default value sensible, persists after refresh
- [ ] **Source** (`Select`, [line 255](../../../apps/web/src/pages/communications.tsx#L255)) — accepts input, default value sensible, persists after refresh
- [ ] **Complainant Name** (`TextInput`, [line 256](../../../apps/web/src/pages/communications.tsx#L256)) — accepts input, default value sensible, persists after refresh
- [ ] **Phone** (`TextInput`, [line 257](../../../apps/web/src/pages/communications.tsx#L257)) — accepts input, default value sensible, persists after refresh
- [ ] **Email** (`TextInput`, [line 258](../../../apps/web/src/pages/communications.tsx#L258)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 259](../../../apps/web/src/pages/communications.tsx#L259)) — accepts input, default value sensible, persists after refresh
- [ ] **Severity** (`Select`, [line 260](../../../apps/web/src/pages/communications.tsx#L260)) — accepts input, default value sensible, persists after refresh
- [ ] **Subject** (`TextInput`, [line 261](../../../apps/web/src/pages/communications.tsx#L261)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 262](../../../apps/web/src/pages/communications.tsx#L262)) — accepts input, default value sensible, persists after refresh
- [ ] **SLA Hours** (`NumberInput`, [line 263](../../../apps/web/src/pages/communications.tsx#L263)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 314>** (`Select`, [line 314](../../../apps/web/src/pages/communications.tsx#L314)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 320](../../../apps/web/src/pages/communications.tsx#L320)) — accepts input, default value sensible, persists after refresh
- [ ] **Overall Rating (1-5)** (`NumberInput`, [line 321](../../../apps/web/src/pages/communications.tsx#L321)) — accepts input, default value sensible, persists after refresh
- [ ] **NPS Score (0-10)** (`NumberInput`, [line 322](../../../apps/web/src/pages/communications.tsx#L322)) — accepts input, default value sensible, persists after refresh
- [ ] **Staff Rating (1-5)** (`NumberInput`, [line 323](../../../apps/web/src/pages/communications.tsx#L323)) — accepts input, default value sensible, persists after refresh
- [ ] **Cleanliness (1-5)** (`NumberInput`, [line 324](../../../apps/web/src/pages/communications.tsx#L324)) — accepts input, default value sensible, persists after refresh
- [ ] **Would Recommend** (`Switch`, [line 325](../../../apps/web/src/pages/communications.tsx#L325)) — accepts input, default value sensible, persists after refresh
- [ ] **Comments** (`Textarea`, [line 326](../../../apps/web/src/pages/communications.tsx#L326)) — accepts input, default value sensible, persists after refresh
- [ ] **Suggestions** (`Textarea`, [line 327](../../../apps/web/src/pages/communications.tsx#L327)) — accepts input, default value sensible, persists after refresh
- [ ] **Anonymous** (`Switch`, [line 328](../../../apps/web/src/pages/communications.tsx#L328)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 370](../../../apps/web/src/pages/communications.tsx#L370)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 371](../../../apps/web/src/pages/communications.tsx#L371)) — accepts input, default value sensible, persists after refresh
- [ ] **Channel** (`Select`, [line 372](../../../apps/web/src/pages/communications.tsx#L372)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 373](../../../apps/web/src/pages/communications.tsx#L373)) — accepts input, default value sensible, persists after refresh
- [ ] **Subject** (`TextInput`, [line 374](../../../apps/web/src/pages/communications.tsx#L374)) — accepts input, default value sensible, persists after refresh
- [ ] **Body Template** (`Textarea`, [line 375](../../../apps/web/src/pages/communications.tsx#L375)) — accepts input, default value sensible, persists after refresh
- [ ] **<Switch @ line 462>** (`Switch`, [line 462](../../../apps/web/src/pages/communications.tsx#L462)) — accepts input, default value sensible, persists after refresh
- [ ] **DLT Template ID** (`TextInput`, [line 495](../../../apps/web/src/pages/communications.tsx#L495)) — accepts input, default value sensible, persists after refresh
- [ ] **Template Name** (`TextInput`, [line 502](../../../apps/web/src/pages/communications.tsx#L502)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 509](../../../apps/web/src/pages/communications.tsx#L509)) — accepts input, default value sensible, persists after refresh
- [ ] **Language** (`Select`, [line 520](../../../apps/web/src/pages/communications.tsx#L520)) — accepts input, default value sensible, persists after refresh
- [ ] **Sender ID (Header)** (`TextInput`, [line 538](../../../apps/web/src/pages/communications.tsx#L538)) — accepts input, default value sensible, persists after refresh
- [ ] **Entity ID (PE)** (`TextInput`, [line 545](../../../apps/web/src/pages/communications.tsx#L545)) — accepts input, default value sensible, persists after refresh
- [ ] **Event Scope** (`TextInput`, [line 552](../../../apps/web/src/pages/communications.tsx#L552)) — accepts input, default value sensible, persists after refresh
- [ ] **Body Pattern** (`Textarea`, [line 559](../../../apps/web/src/pages/communications.tsx#L559)) — accepts input, default value sensible, persists after refresh
- [ ] **Variable count** (`NumberInput`, [line 567](../../../apps/web/src/pages/communications.tsx#L567)) — accepts input, default value sensible, persists after refresh
- [ ] **Registered on** (`TextInput`, [line 575](../../../apps/web/src/pages/communications.tsx#L575)) — accepts input, default value sensible, persists after refresh
- [ ] **Expires on** (`TextInput`, [line 581](../../../apps/web/src/pages/communications.tsx#L581)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 588](../../../apps/web/src/pages/communications.tsx#L588)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 13, `<ActionIcon>`: 5, `<Menu.Item>`: 0)

- [ ] **<button @ line 71>** ([line 71](../../../apps/web/src/pages/communications.tsx#L71)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 71>** ([line 71](../../../apps/web/src/pages/communications.tsx#L71)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 81>** ([line 81](../../../apps/web/src/pages/communications.tsx#L81)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 81>** ([line 81](../../../apps/web/src/pages/communications.tsx#L81)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 129>** ([line 129](../../../apps/web/src/pages/communications.tsx#L129)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 129>** ([line 129](../../../apps/web/src/pages/communications.tsx#L129)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 140>** ([line 140](../../../apps/web/src/pages/communications.tsx#L140)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 140>** ([line 140](../../../apps/web/src/pages/communications.tsx#L140)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 250>** ([line 250](../../../apps/web/src/pages/communications.tsx#L250)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 250>** ([line 250](../../../apps/web/src/pages/communications.tsx#L250)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 264>** ([line 264](../../../apps/web/src/pages/communications.tsx#L264)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 264>** ([line 264](../../../apps/web/src/pages/communications.tsx#L264)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 315>** ([line 315](../../../apps/web/src/pages/communications.tsx#L315)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 315>** ([line 315](../../../apps/web/src/pages/communications.tsx#L315)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 329>** ([line 329](../../../apps/web/src/pages/communications.tsx#L329)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 329>** ([line 329](../../../apps/web/src/pages/communications.tsx#L329)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 365>** ([line 365](../../../apps/web/src/pages/communications.tsx#L365)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 365>** ([line 365](../../../apps/web/src/pages/communications.tsx#L365)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 376>** ([line 376](../../../apps/web/src/pages/communications.tsx#L376)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 376>** ([line 376](../../../apps/web/src/pages/communications.tsx#L376)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 488>** ([line 488](../../../apps/web/src/pages/communications.tsx#L488)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 488>** ([line 488](../../../apps/web/src/pages/communications.tsx#L488)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 594](../../../apps/web/src/pages/communications.tsx#L594)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 594](../../../apps/web/src/pages/communications.tsx#L594)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 595>** ([line 595](../../../apps/web/src/pages/communications.tsx#L595)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 595>** ([line 595](../../../apps/web/src/pages/communications.tsx#L595)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 121>** ([line 121](../../../apps/web/src/pages/communications.tsx#L121)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 182>** ([line 182](../../../apps/web/src/pages/communications.tsx#L182)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 183>** ([line 183](../../../apps/web/src/pages/communications.tsx#L183)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 242>** ([line 242](../../../apps/web/src/pages/communications.tsx#L242)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 471>** ([line 471](../../../apps/web/src/pages/communications.tsx#L471)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (20)

- [ ] `api.acknowledgeClinicalMessage` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.acknowledgeCommAlert` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createClinicalMessage` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCommFeedback` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCommMessage` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCommTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createComplaint` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createDltTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteDltTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getCommFeedbackStats` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listClinicalMessages` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCommAlerts` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCommFeedback` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCommMessages` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCommTemplates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listComplaints` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDltTemplates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.resolveCommAlert` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.resolveComplaint` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateDltTemplate` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._