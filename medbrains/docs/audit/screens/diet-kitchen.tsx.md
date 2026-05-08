# `diet-kitchen.tsx` walkthrough

_Source: [`apps/web/src/pages/diet-kitchen.tsx`](../../../apps/web/src/pages/diet-kitchen.tsx) (649 lines). Guard: `P.DIET.ORDERS_LIST`. API methods: 14. useForm: 0. Tables: 7. Modals: 6._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.DIET.ORDERS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Diet Orders** (`orders`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Diet Orders** (`orders`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Diet Orders** (`orders`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Templates** (`templates`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Templates** (`templates`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Templates** (`templates`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Kitchen** (`kitchen`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Kitchen** (`kitchen`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Kitchen** (`kitchen`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Inventory** (`inventory`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Inventory** (`inventory`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Inventory** (`inventory`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>FSSAI Audits** (`audits`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>FSSAI Audits** (`audits`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>FSSAI Audits** (`audits`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (45)
- [ ] Column **Diet Type** (`diet_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **NPO** (`is_npo`) renders without `undefined` / `[object Object]`
- [ ] Column **Start** (`start_date`) renders without `undefined` / `[object Object]`
- [ ] Column **End** (`end_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Cal Target** (`calories_target`) renders without `undefined` / `[object Object]`
- [ ] Column **Instructions** (`special_instructions`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`diet_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Nutritional Profile** (`nutrition`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Menu Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Week** (`week_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Season** (`season`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Valid From** (`valid_from`) renders without `undefined` / `[object Object]`
- [ ] Column **Valid Until** (`valid_until`) renders without `undefined` / `[object Object]`
- [ ] Column **Meal** (`meal_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`meal_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Ward** (`delivered_to_ward`) renders without `undefined` / `[object Object]`
- [ ] Column **Rating** (`feedback_rating`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`count_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Meal** (`meal_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Ward** (`ward`) renders without `undefined` / `[object Object]`
- [ ] Column **Occupied** (`occupied`) renders without `undefined` / `[object Object]`
- [ ] Column **NPO** (`npo_count`) renders without `undefined` / `[object Object]`
- [ ] Column **Regular** (`regular_count`) renders without `undefined` / `[object Object]`
- [ ] Column **Special** (`special_count`) renders without `undefined` / `[object Object]`
- [ ] Column **Item** (`item_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Stock** (`current_stock`) renders without `undefined` / `[object Object]`
- [ ] Column **Reorder Level** (`reorder_level`) renders without `undefined` / `[object Object]`
- [ ] Column **Supplier** (`supplier`) renders without `undefined` / `[object Object]`
- [ ] Column **Expiry** (`expiry_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`audit_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Auditor** (`auditor_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`audit_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Hygiene Score** (`hygiene_score`) renders without `undefined` / `[object Object]`
- [ ] Column **Compliant** (`is_compliant`) renders without `undefined` / `[object Object]`
- [ ] Column **Findings** (`findings`) renders without `undefined` / `[object Object]`
- [ ] Column **Next Audit** (`next_audit_date`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _New Diet Order_ @ [line 148](../../../apps/web/src/pages/diet-kitchen.tsx#L148)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Diet Template_ @ [line 244](../../../apps/web/src/pages/diet-kitchen.tsx#L244)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Kitchen Menu_ @ [line 463](../../../apps/web/src/pages/diet-kitchen.tsx#L463)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Meal Preparation_ @ [line 474](../../../apps/web/src/pages/diet-kitchen.tsx#L474)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Inventory Item_ @ [line 536](../../../apps/web/src/pages/diet-kitchen.tsx#L536)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record FSSAI Audit_ @ [line 603](../../../apps/web/src/pages/diet-kitchen.tsx#L603)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (28)

- [ ] **Admission ID** (`TextInput`, [line 151](../../../apps/web/src/pages/diet-kitchen.tsx#L151)) — accepts input, default value sensible, persists after refresh
- [ ] **Template** (`Select`, [line 152](../../../apps/web/src/pages/diet-kitchen.tsx#L152)) — accepts input, default value sensible, persists after refresh
- [ ] **Diet Type** (`Select`, [line 153](../../../apps/web/src/pages/diet-kitchen.tsx#L153)) — accepts input, default value sensible, persists after refresh
- [ ] **Special Instructions** (`Textarea`, [line 154](../../../apps/web/src/pages/diet-kitchen.tsx#L154)) — accepts input, default value sensible, persists after refresh
- [ ] **Calories Target** (`NumberInput`, [line 155](../../../apps/web/src/pages/diet-kitchen.tsx#L155)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 246](../../../apps/web/src/pages/diet-kitchen.tsx#L246)) — accepts input, default value sensible, persists after refresh
- [ ] **Diet Type** (`Select`, [line 247](../../../apps/web/src/pages/diet-kitchen.tsx#L247)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 248](../../../apps/web/src/pages/diet-kitchen.tsx#L248)) — accepts input, default value sensible, persists after refresh
- [ ] **Calories Target** (`NumberInput`, [line 249](../../../apps/web/src/pages/diet-kitchen.tsx#L249)) — accepts input, default value sensible, persists after refresh
- [ ] **Protein (g)** (`NumberInput`, [line 251](../../../apps/web/src/pages/diet-kitchen.tsx#L251)) — accepts input, default value sensible, persists after refresh
- [ ] **Carbs (g)** (`NumberInput`, [line 252](../../../apps/web/src/pages/diet-kitchen.tsx#L252)) — accepts input, default value sensible, persists after refresh
- [ ] **Fat (g)** (`NumberInput`, [line 253](../../../apps/web/src/pages/diet-kitchen.tsx#L253)) — accepts input, default value sensible, persists after refresh
- [ ] **Menu Name** (`TextInput`, [line 465](../../../apps/web/src/pages/diet-kitchen.tsx#L465)) — accepts input, default value sensible, persists after refresh
- [ ] **Week Number** (`NumberInput`, [line 466](../../../apps/web/src/pages/diet-kitchen.tsx#L466)) — accepts input, default value sensible, persists after refresh
- [ ] **Season** (`TextInput`, [line 467](../../../apps/web/src/pages/diet-kitchen.tsx#L467)) — accepts input, default value sensible, persists after refresh
- [ ] **Diet Order ID** (`TextInput`, [line 476](../../../apps/web/src/pages/diet-kitchen.tsx#L476)) — accepts input, default value sensible, persists after refresh
- [ ] **Meal Type** (`Select`, [line 477](../../../apps/web/src/pages/diet-kitchen.tsx#L477)) — accepts input, default value sensible, persists after refresh
- [ ] **Item Name** (`TextInput`, [line 538](../../../apps/web/src/pages/diet-kitchen.tsx#L538)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`TextInput`, [line 539](../../../apps/web/src/pages/diet-kitchen.tsx#L539)) — accepts input, default value sensible, persists after refresh
- [ ] **Unit** (`TextInput`, [line 540](../../../apps/web/src/pages/diet-kitchen.tsx#L540)) — accepts input, default value sensible, persists after refresh
- [ ] **Current Stock** (`NumberInput`, [line 541](../../../apps/web/src/pages/diet-kitchen.tsx#L541)) — accepts input, default value sensible, persists after refresh
- [ ] **Reorder Level** (`NumberInput`, [line 542](../../../apps/web/src/pages/diet-kitchen.tsx#L542)) — accepts input, default value sensible, persists after refresh
- [ ] **Supplier** (`TextInput`, [line 543](../../../apps/web/src/pages/diet-kitchen.tsx#L543)) — accepts input, default value sensible, persists after refresh
- [ ] **Auditor Name** (`TextInput`, [line 605](../../../apps/web/src/pages/diet-kitchen.tsx#L605)) — accepts input, default value sensible, persists after refresh
- [ ] **Audit Type** (`Select`, [line 606](../../../apps/web/src/pages/diet-kitchen.tsx#L606)) — accepts input, default value sensible, persists after refresh
- [ ] **Hygiene Score (0-100)** (`NumberInput`, [line 607](../../../apps/web/src/pages/diet-kitchen.tsx#L607)) — accepts input, default value sensible, persists after refresh
- [ ] **Findings** (`Textarea`, [line 608](../../../apps/web/src/pages/diet-kitchen.tsx#L608)) — accepts input, default value sensible, persists after refresh
- [ ] **Corrective Actions** (`Textarea`, [line 609](../../../apps/web/src/pages/diet-kitchen.tsx#L609)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 16, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 142>** ([line 142](../../../apps/web/src/pages/diet-kitchen.tsx#L142)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 142>** ([line 142](../../../apps/web/src/pages/diet-kitchen.tsx#L142)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 156>** ([line 156](../../../apps/web/src/pages/diet-kitchen.tsx#L156)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 156>** ([line 156](../../../apps/web/src/pages/diet-kitchen.tsx#L156)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 238>** ([line 238](../../../apps/web/src/pages/diet-kitchen.tsx#L238)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 238>** ([line 238](../../../apps/web/src/pages/diet-kitchen.tsx#L238)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 255>** ([line 255](../../../apps/web/src/pages/diet-kitchen.tsx#L255)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 255>** ([line 255](../../../apps/web/src/pages/diet-kitchen.tsx#L255)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setSub("menus")}>Menus** ([line 397](../../../apps/web/src/pages/diet-kitchen.tsx#L397)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setSub("menus")}>Menus** ([line 397](../../../apps/web/src/pages/diet-kitchen.tsx#L397)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setSub("preps")}>Meal Prep** ([line 398](../../../apps/web/src/pages/diet-kitchen.tsx#L398)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setSub("preps")}>Meal Prep** ([line 398](../../../apps/web/src/pages/diet-kitchen.tsx#L398)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setSub("counts")}>Meal Counts** ([line 399](../../../apps/web/src/pages/diet-kitchen.tsx#L399)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setSub("counts")}>Meal Counts** ([line 399](../../../apps/web/src/pages/diet-kitchen.tsx#L399)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setSub("summary")}>Summary** ([line 400](../../../apps/web/src/pages/diet-kitchen.tsx#L400)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setSub("summary")}>Summary** ([line 400](../../../apps/web/src/pages/diet-kitchen.tsx#L400)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 402>** ([line 402](../../../apps/web/src/pages/diet-kitchen.tsx#L402)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 402>** ([line 402](../../../apps/web/src/pages/diet-kitchen.tsx#L402)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 403>** ([line 403](../../../apps/web/src/pages/diet-kitchen.tsx#L403)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 403>** ([line 403](../../../apps/web/src/pages/diet-kitchen.tsx#L403)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 468>** ([line 468](../../../apps/web/src/pages/diet-kitchen.tsx#L468)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 468>** ([line 468](../../../apps/web/src/pages/diet-kitchen.tsx#L468)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 478>** ([line 478](../../../apps/web/src/pages/diet-kitchen.tsx#L478)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 478>** ([line 478](../../../apps/web/src/pages/diet-kitchen.tsx#L478)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 530>** ([line 530](../../../apps/web/src/pages/diet-kitchen.tsx#L530)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 530>** ([line 530](../../../apps/web/src/pages/diet-kitchen.tsx#L530)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 544>** ([line 544](../../../apps/web/src/pages/diet-kitchen.tsx#L544)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 544>** ([line 544](../../../apps/web/src/pages/diet-kitchen.tsx#L544)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 597>** ([line 597](../../../apps/web/src/pages/diet-kitchen.tsx#L597)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 597>** ([line 597](../../../apps/web/src/pages/diet-kitchen.tsx#L597)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 610>** ([line 610](../../../apps/web/src/pages/diet-kitchen.tsx#L610)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 610>** ([line 610](../../../apps/web/src/pages/diet-kitchen.tsx#L610)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 350>** ([line 350](../../../apps/web/src/pages/diet-kitchen.tsx#L350)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (14)

- [ ] `api.createDietOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createDietTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createKitchenAudit` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createKitchenInventoryItem` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createKitchenMenu` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createMealPrep` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDietOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDietTemplates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listKitchenAudits` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listKitchenInventory` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listKitchenMenus` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMealCounts` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMealPreps` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateMealPrepStatus` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._