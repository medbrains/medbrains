# `utilization-review.tsx` walkthrough

_Source: [`apps/web/src/pages/utilization-review.tsx`](../../../apps/web/src/pages/utilization-review.tsx) (926 lines). Guard: `P.UR.REVIEWS_LIST`. API methods: 10. useForm: 0. Tables: 0. Modals: 3._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.UR.REVIEWS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
          Reviews** (`reviews`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Reviews** (`reviews`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Reviews** (`reviews`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          LOS Monitoring** (`los`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          LOS Monitoring** (`los`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          LOS Monitoring** (`los`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Payer Log** (`payer`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Payer Log** (`payer`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Payer Log** (`payer`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Status Tracking** (`status`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Status Tracking** (`status`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Status Tracking** (`status`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (29)
- [ ] Column **Admission ID** (`admission_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Review Type** (`review_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Review Date** (`review_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Decision** (`decision`) renders without `undefined` / `[object Object]`
- [ ] Column **Expected LOS** (`expected_los_days`) renders without `undefined` / `[object Object]`
- [ ] Column **Actual LOS** (`actual_los_days`) renders without `undefined` / `[object Object]`
- [ ] Column **Outlier** (`is_outlier`) renders without `undefined` / `[object Object]`
- [ ] Column **Next Review** (`next_review_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Admission ID** (`admission_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Review Type** (`review_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Decision** (`decision`) renders without `undefined` / `[object Object]`
- [ ] Column **Expected LOS** (`expected_los_days`) renders without `undefined` / `[object Object]`
- [ ] Column **Actual LOS** (`actual_los_days`) renders without `undefined` / `[object Object]`
- [ ] Column **Review Date** (`review_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Reviews** (`review_count`) renders without `undefined` / `[object Object]`
- [ ] Column **Avg Expected LOS** (`avg_expected_los`) renders without `undefined` / `[object Object]`
- [ ] Column **Avg Actual LOS** (`avg_actual_los`) renders without `undefined` / `[object Object]`
- [ ] Column **Review ID** (`review_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`communication_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Payer** (`payer_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Reference #** (`reference_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`communicated_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Summary** (`summary`) renders without `undefined` / `[object Object]`
- [ ] Column **Admission ID** (`admission_id`) renders without `undefined` / `[object Object]`
- [ ] Column **From Status** (`from_status`) renders without `undefined` / `[object Object]`
- [ ] Column **To Status** (`to_status`) renders without `undefined` / `[object Object]`
- [ ] Column **Conversion Date** (`conversion_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Reason** (`reason`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _Create Utilization Review_ @ [line 360](../../../apps/web/src/pages/utilization-review.tsx#L360)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Log Payer Communication_ @ [line 751](../../../apps/web/src/pages/utilization-review.tsx#L751)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Status Conversion_ @ [line 883](../../../apps/web/src/pages/utilization-review.tsx#L883)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (19)

- [ ] **<Select @ line 279>** (`Select`, [line 279](../../../apps/web/src/pages/utilization-review.tsx#L279)) — accepts input, default value sensible, persists after refresh
- [ ] **Admission ID** (`TextInput`, [line 362](../../../apps/web/src/pages/utilization-review.tsx#L362)) — accepts input, default value sensible, persists after refresh
- [ ] **Review Type** (`Select`, [line 369](../../../apps/web/src/pages/utilization-review.tsx#L369)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient Status** (`Select`, [line 386](../../../apps/web/src/pages/utilization-review.tsx#L386)) — accepts input, default value sensible, persists after refresh
- [ ] **Criteria Source** (`TextInput`, [line 395](../../../apps/web/src/pages/utilization-review.tsx#L395)) — accepts input, default value sensible, persists after refresh
- [ ] **Clinical Summary** (`Textarea`, [line 400](../../../apps/web/src/pages/utilization-review.tsx#L400)) — accepts input, default value sensible, persists after refresh
- [ ] **Expected LOS (days)** (`NumberInput`, [line 407](../../../apps/web/src/pages/utilization-review.tsx#L407)) — accepts input, default value sensible, persists after refresh
- [ ] **Approved Days** (`NumberInput`, [line 413](../../../apps/web/src/pages/utilization-review.tsx#L413)) — accepts input, default value sensible, persists after refresh
- [ ] **Next Review Date** (`DateInput`, [line 419](../../../apps/web/src/pages/utilization-review.tsx#L419)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 736>** (`TextInput`, [line 736](../../../apps/web/src/pages/utilization-review.tsx#L736)) — accepts input, default value sensible, persists after refresh
- [ ] **Review ID** (`TextInput`, [line 753](../../../apps/web/src/pages/utilization-review.tsx#L753)) — accepts input, default value sensible, persists after refresh
- [ ] **Communication Type** (`Select`, [line 759](../../../apps/web/src/pages/utilization-review.tsx#L759)) — accepts input, default value sensible, persists after refresh
- [ ] **Payer Name** (`TextInput`, [line 773](../../../apps/web/src/pages/utilization-review.tsx#L773)) — accepts input, default value sensible, persists after refresh
- [ ] **Reference Number** (`TextInput`, [line 779](../../../apps/web/src/pages/utilization-review.tsx#L779)) — accepts input, default value sensible, persists after refresh
- [ ] **Summary** (`Textarea`, [line 784](../../../apps/web/src/pages/utilization-review.tsx#L784)) — accepts input, default value sensible, persists after refresh
- [ ] **Admission ID** (`TextInput`, [line 885](../../../apps/web/src/pages/utilization-review.tsx#L885)) — accepts input, default value sensible, persists after refresh
- [ ] **From Status** (`Select`, [line 891](../../../apps/web/src/pages/utilization-review.tsx#L891)) — accepts input, default value sensible, persists after refresh
- [ ] **To Status** (`Select`, [line 901](../../../apps/web/src/pages/utilization-review.tsx#L901)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`Textarea`, [line 911](../../../apps/web/src/pages/utilization-review.tsx#L911)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 6, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 262>** ([line 262](../../../apps/web/src/pages/utilization-review.tsx#L262)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 262>** ([line 262](../../../apps/web/src/pages/utilization-review.tsx#L262)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>             Create Review** ([line 427](../../../apps/web/src/pages/utilization-review.tsx#L427)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>             Create Review** ([line 427](../../../apps/web/src/pages/utilization-review.tsx#L427)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 728>** ([line 728](../../../apps/web/src/pages/utilization-review.tsx#L728)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 728>** ([line 728](../../../apps/web/src/pages/utilization-review.tsx#L728)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>             Log Communication** ([line 791](../../../apps/web/src/pages/utilization-review.tsx#L791)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>             Log Communication** ([line 791](../../../apps/web/src/pages/utilization-review.tsx#L791)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 869>** ([line 869](../../../apps/web/src/pages/utilization-review.tsx#L869)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 869>** ([line 869](../../../apps/web/src/pages/utilization-review.tsx#L869)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>             Create Conversion** ([line 918](../../../apps/web/src/pages/utilization-review.tsx#L918)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>             Create Conversion** ([line 918](../../../apps/web/src/pages/utilization-review.tsx#L918)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 223>** ([line 223](../../../apps/web/src/pages/utilization-review.tsx#L223)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (10)

- [ ] `api.aiExtractStub` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createUrCommunication` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createUrConversion` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createUrReview` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listUrCommunications` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listUrConversions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listUrOutliers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listUrReviews` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.urAnalyticsSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.urLosComparison` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._