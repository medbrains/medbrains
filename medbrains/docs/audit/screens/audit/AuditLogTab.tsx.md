# `audit/AuditLogTab.tsx` walkthrough

_Source: [`apps/web/src/pages/audit/AuditLogTab.tsx`](../../../apps/web/src/pages/audit/AuditLogTab.tsx) (424 lines). Guard: `—`. API methods: 6. useForm: 0. Tables: 1. Modals: 1._

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

### DataTable columns (7)
- [ ] Column **Time** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **User** (`user_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Action** (`action`) renders without `undefined` / `[object Object]`
- [ ] Column **Module** (`module`) renders without `undefined` / `[object Object]`
- [ ] Column **Entity Type** (`entity_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Entity ID** (`entity_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Description** (`description`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _Audit Entry Detail_ @ [line 336](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L336)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (6)

- [ ] **<Select @ line 206>** (`Select`, [line 206](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L206)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 215>** (`Select`, [line 215](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L215)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 224>** (`Select`, [line 224](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L224)) — accepts input, default value sensible, persists after refresh
- [ ] **<DateInput @ line 233>** (`DateInput`, [line 233](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L233)) — accepts input, default value sensible, persists after refresh
- [ ] **<DateInput @ line 241>** (`DateInput`, [line 241](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L241)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 249>** (`TextInput`, [line 249](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L249)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 3, `<ActionIcon>`: 0, `<Menu.Item>`: 0)

- [ ] **Clear** ([line 257](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L257)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Clear** ([line 257](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L257)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 261>** ([line 261](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L261)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 261>** ([line 261](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L261)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 270>** ([line 270](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L270)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 270>** ([line 270](../../../apps/web/src/pages/audit/AuditLogTab.tsx#L270)) — failure path works: validation/server error is shown clearly and does not leave stale loading state

## API methods used (6)

- [ ] `api.exportAuditLogUrl` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getAuditEntry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAuditEntityTypes` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAuditLog` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAuditModules` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.verifyAuditIntegrity` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._