# `admin/settings/ClinicalConfigSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx`](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx) (520 lines). Guard: `—`. API methods: 2. useForm: 0. Tables: 0. Modals: 0._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `(none)` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

### ⚠ Static analysis flags
- `no useRequirePermission guard`

## Tables / lists

### DataTable columns (20)
- [ ] Column **Temperature** (`temperature`) renders without `undefined` / `[object Object]`
- [ ] Column **Pulse** (`pulse`) renders without `undefined` / `[object Object]`
- [ ] Column **SpO2** (`spo2`) renders without `undefined` / `[object Object]`
- [ ] Column **Respiratory Rate** (`respiratory_rate`) renders without `undefined` / `[object Object]`
- [ ] Column **Systolic BP** (`systolic_bp`) renders without `undefined` / `[object Object]`
- [ ] Column **Diastolic BP** (`diastolic_bp`) renders without `undefined` / `[object Object]`
- [ ] Column **Weight** (`weight`) renders without `undefined` / `[object Object]`
- [ ] Column **Height** (`height`) renders without `undefined` / `[object Object]`
- [ ] Column **Pain Score** (`pain_score`) renders without `undefined` / `[object Object]`
- [ ] Column **GCS** (`gcs`) renders without `undefined` / `[object Object]`
- [ ] Column **Blood Glucose** (`blood_glucose`) renders without `undefined` / `[object Object]`
- [ ] Column **Chief Complaint** (`chief_complaint`) renders without `undefined` / `[object Object]`
- [ ] Column **History of Present Illness** (`hpi`) renders without `undefined` / `[object Object]`
- [ ] Column **Past Medical History** (`past_medical`) renders without `undefined` / `[object Object]`
- [ ] Column **Past Surgical History** (`past_surgical`) renders without `undefined` / `[object Object]`
- [ ] Column **Family History** (`family`) renders without `undefined` / `[object Object]`
- [ ] Column **Social History** (`social`) renders without `undefined` / `[object Object]`
- [ ] Column **Review of Systems** (`ros`) renders without `undefined` / `[object Object]`
- [ ] Column **Physical Examination** (`physical_exam`) renders without `undefined` / `[object Object]`
- [ ] Column **Plan** (`plan`) renders without `undefined` / `[object Object]`

## Form inputs (7)

- [ ] **<Switch @ line 115>** (`Switch`, [line 115](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L115)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 172>** (`TextInput`, [line 172](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L172)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 179>** (`TextInput`, [line 179](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L179)) — accepts input, default value sensible, persists after refresh
- [ ] **<Switch @ line 230>** (`Switch`, [line 230](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L230)) — accepts input, default value sensible, persists after refresh
- [ ] **Required** (`TextInput`, [line 316](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L316)) — accepts input, default value sensible, persists after refresh
- [ ] **Required** (`Switch`, [line 323](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L323)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 373>** (`Select`, [line 373](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L373)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 6, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 160>** ([line 160](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L160)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 160>** ([line 160](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L160)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 202>** ([line 202](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L202)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 202>** ([line 202](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L202)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 254>** ([line 254](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L254)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 254>** ([line 254](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L254)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 304>** ([line 304](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L304)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 304>** ([line 304](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L304)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 345>** ([line 345](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L345)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 345>** ([line 345](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L345)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 381>** ([line 381](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L381)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 381>** ([line 381](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L381)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 186>** ([line 186](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L186)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 329>** ([line 329](../../../apps/web/src/pages/admin/settings/ClinicalConfigSettings.tsx#L329)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (2)

- [ ] `api.getTenantSettings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateTenantSetting` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._