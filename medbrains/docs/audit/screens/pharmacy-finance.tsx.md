# `pharmacy-finance.tsx` walkthrough

_Source: [`apps/web/src/pages/pharmacy-finance.tsx`](../../../apps/web/src/pages/pharmacy-finance.tsx) (389 lines). Guard: `P.PHARMACY_FINANCE.CASH_DRAWER_VIEW`. API methods: 7. useForm: 0. Tables: 0. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.PHARMACY_FINANCE.CASH_DRAWER_VIEW` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Cash Drawer** (`cash-drawer`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Cash Drawer** (`cash-drawer`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Cash Drawer** (`cash-drawer`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Petty Cash** (`petty-cash`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Petty Cash** (`petty-cash`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Petty Cash** (`petty-cash`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Supplier Payments** (`supplier-payments`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Supplier Payments** (`supplier-payments`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Supplier Payments** (`supplier-payments`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Free Dispensing** (`free-dispensing`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Free Dispensing** (`free-dispensing`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Free Dispensing** (`free-dispensing`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Margins** (`margins`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Margins** (`margins`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Margins** (`margins`) — leaving and returning preserves or intentionally resets state

## Modals / Drawers

### Modal — _Open cash drawer_ @ [line 210](../../../apps/web/src/pages/pharmacy-finance.tsx#L210)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Close cash drawer_ @ [line 270](../../../apps/web/src/pages/pharmacy-finance.tsx#L270)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (5)

- [ ] **Pharmacy location ID** (`TextInput`, [line 212](../../../apps/web/src/pages/pharmacy-finance.tsx#L212)) — accepts input, default value sensible, persists after refresh
- [ ] **Opening float (₹)** (`NumberInput`, [line 219](../../../apps/web/src/pages/pharmacy-finance.tsx#L219)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 226](../../../apps/web/src/pages/pharmacy-finance.tsx#L226)) — accepts input, default value sensible, persists after refresh
- [ ] **Actual cash counted (₹)** (`NumberInput`, [line 275](../../../apps/web/src/pages/pharmacy-finance.tsx#L275)) — accepts input, default value sensible, persists after refresh
- [ ] **Variance reason (optional)** (`Textarea`, [line 282](../../../apps/web/src/pages/pharmacy-finance.tsx#L282)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 7, `<ActionIcon>`: 0, `<Menu.Item>`: 0)

- [ ] **setCloseFor(active)}>               Close drawer** ([line 130](../../../apps/web/src/pages/pharmacy-finance.tsx#L130)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setCloseFor(active)}>               Close drawer** ([line 130](../../../apps/web/src/pages/pharmacy-finance.tsx#L130)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setOpenModal(true)}>Open drawer** ([line 139](../../../apps/web/src/pages/pharmacy-finance.tsx#L139)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setOpenModal(true)}>Open drawer** ([line 139](../../../apps/web/src/pages/pharmacy-finance.tsx#L139)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 228>** ([line 228](../../../apps/web/src/pages/pharmacy-finance.tsx#L228)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 228>** ([line 228](../../../apps/web/src/pages/pharmacy-finance.tsx#L228)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 289>** ([line 289](../../../apps/web/src/pages/pharmacy-finance.tsx#L289)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 289>** ([line 289](../../../apps/web/src/pages/pharmacy-finance.tsx#L289)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 327>** ([line 327](../../../apps/web/src/pages/pharmacy-finance.tsx#L327)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 327>** ([line 327](../../../apps/web/src/pages/pharmacy-finance.tsx#L327)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 330>** ([line 330](../../../apps/web/src/pages/pharmacy-finance.tsx#L330)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 330>** ([line 330](../../../apps/web/src/pages/pharmacy-finance.tsx#L330)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setOverdueOnly((v) => !v)}         >           Overdue only** ([line 357](../../../apps/web/src/pages/pharmacy-finance.tsx#L357)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setOverdueOnly((v) => !v)}         >           Overdue only** ([line 357](../../../apps/web/src/pages/pharmacy-finance.tsx#L357)) — failure path works: validation/server error is shown clearly and does not leave stale loading state

## API methods used (7)

- [ ] `api.closeCashDrawer` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.decidePettyCash` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getMyActiveCashDrawer` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCashDrawers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPettyCash` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPharmacySupplierPayments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.openCashDrawer` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._