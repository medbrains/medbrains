# `specialty/pmr.tsx` walkthrough

_Source: [`apps/web/src/pages/specialty/pmr.tsx`](../../../apps/web/src/pages/specialty/pmr.tsx) (108 lines). Guard: `P.SPECIALTY.PMR.PLANS_LIST`. API methods: 4. useForm: 0. Tables: 3. Modals: 1._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.SPECIALTY.PMR.PLANS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Rehab Plans** (`plans`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Rehab Plans** (`plans`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Rehab Plans** (`plans`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Sessions** (`sessions`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Sessions** (`sessions`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Sessions** (`sessions`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Audiology** (`audiology`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Audiology** (`audiology`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Audiology** (`audiology`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (16)
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Discipline** (`discipline`) renders without `undefined` / `[object Object]`
- [ ] Column **FIM (Initial)** (`fim_initial`) renders without `undefined` / `[object Object]`
- [ ] Column **Barthel (Initial)** (`barthel_initial`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Session #** (`session`) renders without `undefined` / `[object Object]`
- [ ] Column **Therapist** (`therapist`) renders without `undefined` / `[object Object]`
- [ ] Column **Pain** (`pain`) renders without `undefined` / `[object Object]`
- [ ] Column **FIM** (`fim`) renders without `undefined` / `[object Object]`
- [ ] Column **Barthel** (`barthel`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Test** (`test_type`) renders without `undefined` / `[object Object]`
- [ ] Column **NHSP** (`nhsp`) renders without `undefined` / `[object Object]`
- [ ] Column **Referral Needed** (`referral`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _New Rehabilitation Plan_ @ [line 95](../../../apps/web/src/pages/specialty/pmr.tsx#L95)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (5)

- [ ] **Patient ID** (`TextInput`, [line 97](../../../apps/web/src/pages/specialty/pmr.tsx#L97)) — accepts input, default value sensible, persists after refresh
- [ ] **Discipline** (`Select`, [line 98](../../../apps/web/src/pages/specialty/pmr.tsx#L98)) — accepts input, default value sensible, persists after refresh
- [ ] **Goals** (`Textarea`, [line 99](../../../apps/web/src/pages/specialty/pmr.tsx#L99)) — accepts input, default value sensible, persists after refresh
- [ ] **FIM Score (Initial)** (`NumberInput`, [line 100](../../../apps/web/src/pages/specialty/pmr.tsx#L100)) — accepts input, default value sensible, persists after refresh
- [ ] **Barthel Score (Initial)** (`NumberInput`, [line 101](../../../apps/web/src/pages/specialty/pmr.tsx#L101)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 2, `<ActionIcon>`: 0, `<Menu.Item>`: 0)

- [ ] **<button @ line 77>** ([line 77](../../../apps/web/src/pages/specialty/pmr.tsx#L77)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 77>** ([line 77](../../../apps/web/src/pages/specialty/pmr.tsx#L77)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 102>** ([line 102](../../../apps/web/src/pages/specialty/pmr.tsx#L102)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 102>** ([line 102](../../../apps/web/src/pages/specialty/pmr.tsx#L102)) — failure path works: validation/server error is shown clearly and does not leave stale loading state

## API methods used (4)

- [ ] `api.createRehabPlan` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAudiologyTests` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRehabPlans` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRehabSessions` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._