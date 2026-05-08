# `order-sets.tsx` walkthrough

_Source: [`apps/web/src/pages/order-sets.tsx`](../../../apps/web/src/pages/order-sets.tsx) (865 lines). Guard: `P.ORDER_SETS.TEMPLATES_LIST`. API methods: 11. useForm: 0. Tables: 3. Modals: 3._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.ORDER_SETS.TEMPLATES_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Templates** (`templates`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Templates** (`templates`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Templates** (`templates`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Builder** (`builder`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Builder** (`builder`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Builder** (`builder`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Activations** (`activations`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Activations** (`activations`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Activations** (`activations`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Analytics** (`analytics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Analytics** (`analytics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Analytics** (`analytics`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (15)
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Context** (`context`) renders without `undefined` / `[object Object]`
- [ ] Column **Version** (`version`) renders without `undefined` / `[object Object]`
- [ ] Column **Approved** (`approved`) renders without `undefined` / `[object Object]`
- [ ] Column **#** (`sort_order`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`item_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Description** (`description`) renders without `undefined` / `[object Object]`
- [ ] Column **Mandatory** (`mandatory`) renders without `undefined` / `[object Object]`
- [ ] Column **Default** (`default`) renders without `undefined` / `[object Object]`
- [ ] Column **Template** (`template_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Version** (`version`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Items** (`items`) renders without `undefined` / `[object Object]`
- [ ] Column **Diagnosis** (`diagnosis`) renders without `undefined` / `[object Object]`
- [ ] Column **Activated** (`created_at`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _Create Order Set Template_ @ [line 331](../../../apps/web/src/pages/order-sets.tsx#L331)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Item to Order Set_ @ [line 550](../../../apps/web/src/pages/order-sets.tsx#L550)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Activation Details_ @ [line 774](../../../apps/web/src/pages/order-sets.tsx#L774)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (26)

- [ ] **<TextInput @ line 300>** (`TextInput`, [line 300](../../../apps/web/src/pages/order-sets.tsx#L300)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 307>** (`Select`, [line 307](../../../apps/web/src/pages/order-sets.tsx#L307)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 333](../../../apps/web/src/pages/order-sets.tsx#L333)) — accepts input, default value sensible, persists after refresh
- [ ] **Code (mnemonic)** (`TextInput`, [line 339](../../../apps/web/src/pages/order-sets.tsx#L339)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 345](../../../apps/web/src/pages/order-sets.tsx#L345)) — accepts input, default value sensible, persists after refresh
- [ ] **Context** (`Select`, [line 350](../../../apps/web/src/pages/order-sets.tsx#L350)) — accepts input, default value sensible, persists after refresh
- [ ] **Surgery Type** (`TextInput`, [line 357](../../../apps/web/src/pages/order-sets.tsx#L357)) — accepts input, default value sensible, persists after refresh
- [ ] **Trigger Diagnoses (ICD-10 codes, comma-separated)** (`TextInput`, [line 363](../../../apps/web/src/pages/order-sets.tsx#L363)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 506>** (`Select`, [line 506](../../../apps/web/src/pages/order-sets.tsx#L506)) — accepts input, default value sensible, persists after refresh
- [ ] **Item Type** (`Select`, [line 552](../../../apps/web/src/pages/order-sets.tsx#L552)) — accepts input, default value sensible, persists after refresh
- [ ] **Sort Order** (`NumberInput`, [line 561](../../../apps/web/src/pages/order-sets.tsx#L561)) — accepts input, default value sensible, persists after refresh
- [ ] **Mandatory (cannot be deselected)** (`Switch`, [line 566](../../../apps/web/src/pages/order-sets.tsx#L566)) — accepts input, default value sensible, persists after refresh
- [ ] **Selected by default** (`Switch`, [line 571](../../../apps/web/src/pages/order-sets.tsx#L571)) — accepts input, default value sensible, persists after refresh
- [ ] **Lab Priority** (`TextInput`, [line 580](../../../apps/web/src/pages/order-sets.tsx#L580)) — accepts input, default value sensible, persists after refresh
- [ ] **Lab Notes** (`Textarea`, [line 586](../../../apps/web/src/pages/order-sets.tsx#L586)) — accepts input, default value sensible, persists after refresh
- [ ] **Drug Name** (`TextInput`, [line 596](../../../apps/web/src/pages/order-sets.tsx#L596)) — accepts input, default value sensible, persists after refresh
- [ ] **Dosage** (`TextInput`, [line 601](../../../apps/web/src/pages/order-sets.tsx#L601)) — accepts input, default value sensible, persists after refresh
- [ ] **Frequency** (`TextInput`, [line 607](../../../apps/web/src/pages/order-sets.tsx#L607)) — accepts input, default value sensible, persists after refresh
- [ ] **Duration** (`TextInput`, [line 613](../../../apps/web/src/pages/order-sets.tsx#L613)) — accepts input, default value sensible, persists after refresh
- [ ] **Route** (`TextInput`, [line 619](../../../apps/web/src/pages/order-sets.tsx#L619)) — accepts input, default value sensible, persists after refresh
- [ ] **Instructions** (`Textarea`, [line 625](../../../apps/web/src/pages/order-sets.tsx#L625)) — accepts input, default value sensible, persists after refresh
- [ ] **Task Type** (`TextInput`, [line 637](../../../apps/web/src/pages/order-sets.tsx#L637)) — accepts input, default value sensible, persists after refresh
- [ ] **Task Description** (`Textarea`, [line 643](../../../apps/web/src/pages/order-sets.tsx#L643)) — accepts input, default value sensible, persists after refresh
- [ ] **Frequency** (`TextInput`, [line 650](../../../apps/web/src/pages/order-sets.tsx#L650)) — accepts input, default value sensible, persists after refresh
- [ ] **Diet Type** (`TextInput`, [line 663](../../../apps/web/src/pages/order-sets.tsx#L663)) — accepts input, default value sensible, persists after refresh
- [ ] **Diet Instructions** (`Textarea`, [line 669](../../../apps/web/src/pages/order-sets.tsx#L669)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 4, `<ActionIcon>`: 5, `<Menu.Item>`: 0)

- [ ] **<button @ line 318>** ([line 318](../../../apps/web/src/pages/order-sets.tsx#L318)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 318>** ([line 318](../../../apps/web/src/pages/order-sets.tsx#L318)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 376>** ([line 376](../../../apps/web/src/pages/order-sets.tsx#L376)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 376>** ([line 376](../../../apps/web/src/pages/order-sets.tsx#L376)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 516>** ([line 516](../../../apps/web/src/pages/order-sets.tsx#L516)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 516>** ([line 516](../../../apps/web/src/pages/order-sets.tsx#L516)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 679>** ([line 679](../../../apps/web/src/pages/order-sets.tsx#L679)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 679>** ([line 679](../../../apps/web/src/pages/order-sets.tsx#L679)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 254>** ([line 254](../../../apps/web/src/pages/order-sets.tsx#L254)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 267>** ([line 267](../../../apps/web/src/pages/order-sets.tsx#L267)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 280>** ([line 280](../../../apps/web/src/pages/order-sets.tsx#L280)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 489>** ([line 489](../../../apps/web/src/pages/order-sets.tsx#L489)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 749>** ([line 749](../../../apps/web/src/pages/order-sets.tsx#L749)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (11)

- [ ] `api.addOrderSetItem` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.approveOrderSetTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createOrderSetTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createOrderSetVersion` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteOrderSetItem` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteOrderSetTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getOrderSetActivation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getOrderSetAnalytics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getOrderSetTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOrderSetActivations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOrderSetTemplates` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._