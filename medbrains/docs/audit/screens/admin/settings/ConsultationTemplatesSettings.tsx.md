# `admin/settings/ConsultationTemplatesSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx`](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx) (302 lines). Guard: `—`. API methods: 4. useForm: 0. Tables: 1. Modals: 1._

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

### `<Table>` @ line 157
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Specialty** column shows correct value for at least one row
  - [ ] Header **Department** column shows correct value for at least one row
  - [ ] Header **Shared** column shows correct value for at least one row
  - [ ] Header **Complaints** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 223>_ @ [line 223](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L223)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (8)

- [ ] **Template Name** (`TextInput`, [line 230](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L230)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 237](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L237)) — accepts input, default value sensible, persists after refresh
- [ ] **Specialty** (`TextInput`, [line 245](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L245)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`Select`, [line 251](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L251)) — accepts input, default value sensible, persists after refresh
- [ ] **Share with all doctors** (`Switch`, [line 261](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L261)) — accepts input, default value sensible, persists after refresh
- [ ] **Chief Complaints (comma-separated)** (`TextInput`, [line 266](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L266)) — accepts input, default value sensible, persists after refresh
- [ ] **Default Plan** (`Textarea`, [line 272](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L272)) — accepts input, default value sensible, persists after refresh
- [ ] **Common Diagnoses (comma-separated)** (`TextInput`, [line 279](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L279)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 3, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 137>** ([line 137](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L137)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 137>** ([line 137](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L137)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setModalOpen(false)}>               Cancel** ([line 286](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L286)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setModalOpen(false)}>               Cancel** ([line 286](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L286)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Create Template** ([line 289](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L289)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Create Template** ([line 289](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L289)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **Delete** ([line 205](../../../apps/web/src/pages/admin/settings/ConsultationTemplatesSettings.tsx#L205)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (4)

- [ ] `api.createConsultationTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteConsultationTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listConsultationTemplates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDepartments` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._