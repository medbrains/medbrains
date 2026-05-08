# `specialty/maternity.tsx` walkthrough

_Source: [`apps/web/src/pages/specialty/maternity.tsx`](../../../apps/web/src/pages/specialty/maternity.tsx) (167 lines). Guard: `P.SPECIALTY.MATERNITY.REGISTRATIONS_LIST`. API methods: 6. useForm: 0. Tables: 5. Modals: 1._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.SPECIALTY.MATERNITY.REGISTRATIONS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Registrations** (`registrations`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Registrations** (`registrations`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Registrations** (`registrations`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **ANC Visits** (`anc`) — clicking activates the panel + loads its data without console error
- [ ] Tab **ANC Visits** (`anc`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **ANC Visits** (`anc`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Labor & Delivery** (`labor`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Labor & Delivery** (`labor`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Labor & Delivery** (`labor`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Newborn & Postnatal** (`newborn`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Newborn & Postnatal** (`newborn`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Newborn & Postnatal** (`newborn`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (31)
- [ ] Column **Reg #** (`reg_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **EDD** (`edd`) renders without `undefined` / `[object Object]`
- [ ] Column **G/P/A/L** (`gravida`) renders without `undefined` / `[object Object]`
- [ ] Column **Risk** (`risk`) renders without `undefined` / `[object Object]`
- [ ] Column **High Risk** (`high_risk`) renders without `undefined` / `[object Object]`
- [ ] Column **Blood Group** (`blood`) renders without `undefined` / `[object Object]`
- [ ] Column **Visit #** (`visit`) renders without `undefined` / `[object Object]`
- [ ] Column **Weeks** (`weeks`) renders without `undefined` / `[object Object]`
- [ ] Column **Weight (kg)** (`weight`) renders without `undefined` / `[object Object]`
- [ ] Column **BP** (`bp`) renders without `undefined` / `[object Object]`
- [ ] Column **FHR** (`fhr`) renders without `undefined` / `[object Object]`
- [ ] Column **Hb** (`hb`) renders without `undefined` / `[object Object]`
- [ ] Column **PCPNDT Form F** (`pcpndt`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Stage** (`stage`) renders without `undefined` / `[object Object]`
- [ ] Column **Delivery** (`delivery`) renders without `undefined` / `[object Object]`
- [ ] Column **Apgar 1m** (`apgar1`) renders without `undefined` / `[object Object]`
- [ ] Column **Apgar 5m** (`apgar5`) renders without `undefined` / `[object Object]`
- [ ] Column **Baby (g)** (`baby_weight`) renders without `undefined` / `[object Object]`
- [ ] Column **Onset** (`onset`) renders without `undefined` / `[object Object]`
- [ ] Column **Birth Date** (`birth_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Gender** (`gender`) renders without `undefined` / `[object Object]`
- [ ] Column **Weight (g)** (`weight`) renders without `undefined` / `[object Object]`
- [ ] Column **Apgar 1m** (`apgar1`) renders without `undefined` / `[object Object]`
- [ ] Column **Apgar 5m** (`apgar5`) renders without `undefined` / `[object Object]`
- [ ] Column **NICU** (`nicu`) renders without `undefined` / `[object Object]`
- [ ] Column **Birth Cert #** (`cert`) renders without `undefined` / `[object Object]`
- [ ] Column **Day PP** (`day`) renders without `undefined` / `[object Object]`
- [ ] Column **Baby Weight (g)** (`baby_weight`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _New Maternity Registration_ @ [line 147](../../../apps/web/src/pages/specialty/maternity.tsx#L147)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (10)

- [ ] **Patient ID** (`TextInput`, [line 149](../../../apps/web/src/pages/specialty/maternity.tsx#L149)) — accepts input, default value sensible, persists after refresh
- [ ] **Registration Number** (`TextInput`, [line 150](../../../apps/web/src/pages/specialty/maternity.tsx#L150)) — accepts input, default value sensible, persists after refresh
- [ ] **LMP Date** (`TextInput`, [line 151](../../../apps/web/src/pages/specialty/maternity.tsx#L151)) — accepts input, default value sensible, persists after refresh
- [ ] **EDD Date** (`TextInput`, [line 152](../../../apps/web/src/pages/specialty/maternity.tsx#L152)) — accepts input, default value sensible, persists after refresh
- [ ] **Gravida** (`NumberInput`, [line 154](../../../apps/web/src/pages/specialty/maternity.tsx#L154)) — accepts input, default value sensible, persists after refresh
- [ ] **Para** (`NumberInput`, [line 155](../../../apps/web/src/pages/specialty/maternity.tsx#L155)) — accepts input, default value sensible, persists after refresh
- [ ] **Abortion** (`NumberInput`, [line 156](../../../apps/web/src/pages/specialty/maternity.tsx#L156)) — accepts input, default value sensible, persists after refresh
- [ ] **Living** (`NumberInput`, [line 157](../../../apps/web/src/pages/specialty/maternity.tsx#L157)) — accepts input, default value sensible, persists after refresh
- [ ] **Risk Category** (`Select`, [line 159](../../../apps/web/src/pages/specialty/maternity.tsx#L159)) — accepts input, default value sensible, persists after refresh
- [ ] **Blood Group** (`TextInput`, [line 160](../../../apps/web/src/pages/specialty/maternity.tsx#L160)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 2, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 106>** ([line 106](../../../apps/web/src/pages/specialty/maternity.tsx#L106)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 106>** ([line 106](../../../apps/web/src/pages/specialty/maternity.tsx#L106)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 161>** ([line 161](../../../apps/web/src/pages/specialty/maternity.tsx#L161)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 161>** ([line 161](../../../apps/web/src/pages/specialty/maternity.tsx#L161)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 57>** ([line 57](../../../apps/web/src/pages/specialty/maternity.tsx#L57)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 84>** ([line 84](../../../apps/web/src/pages/specialty/maternity.tsx#L84)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (6)

- [ ] `api.createMaternityRegistration` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAncVisits` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listLaborRecords` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMaternityRegistrations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listNewborns` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPostnatalRecords` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._