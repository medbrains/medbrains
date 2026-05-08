# `documents.tsx` walkthrough

_Source: [`apps/web/src/pages/documents.tsx`](../../../apps/web/src/pages/documents.tsx) (1084 lines). Guard: `P.DOCUMENTS.TEMPLATES_LIST`. API methods: 10. useForm: 0. Tables: 3. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.DOCUMENTS.TEMPLATES_LIST` redirects unauthorised user to /dashboard
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
            Generated Documents** (`outputs`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Generated Documents** (`outputs`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Generated Documents** (`outputs`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Review Schedule** (`review`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Review Schedule** (`review`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Review Schedule** (`review`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Print Queue** (`queue`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Print Queue** (`queue`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Print Queue** (`queue`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Printers** (`printers`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Printers** (`printers`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Printers** (`printers`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (19)
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Format** (`print_format`) renders without `undefined` / `[object Object]`
- [ ] Column **Version** (`version`) renders without `undefined` / `[object Object]`
- [ ] Column **Default** (`is_default`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Doc #** (`document_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Title** (`title`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Prints** (`print_count`) renders without `undefined` / `[object Object]`
- [ ] Column **Module** (`module_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Generated** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Template** (`template_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Cycle** (`review_cycle_months`) renders without `undefined` / `[object Object]`
- [ ] Column **Last Reviewed** (`last_reviewed_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Next Due** (`next_review_due`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`review_status`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _<drawer @ line 470>_ @ [line 470](../../../apps/web/src/pages/documents.tsx#L470)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Review Schedule_ @ [line 943](../../../apps/web/src/pages/documents.tsx#L943)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (32)

- [ ] **<TextInput @ line 440>** (`TextInput`, [line 440](../../../apps/web/src/pages/documents.tsx#L440)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 447>** (`Select`, [line 447](../../../apps/web/src/pages/documents.tsx#L447)) — accepts input, default value sensible, persists after refresh
- [ ] **Template Code** (`TextInput`, [line 479](../../../apps/web/src/pages/documents.tsx#L479)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 487](../../../apps/web/src/pages/documents.tsx#L487)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 494](../../../apps/web/src/pages/documents.tsx#L494)) — accepts input, default value sensible, persists after refresh
- [ ] **Module Code** (`TextInput`, [line 500](../../../apps/web/src/pages/documents.tsx#L500)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 507](../../../apps/web/src/pages/documents.tsx#L507)) — accepts input, default value sensible, persists after refresh
- [ ] **Print Format** (`Select`, [line 516](../../../apps/web/src/pages/documents.tsx#L516)) — accepts input, default value sensible, persists after refresh
- [ ] **Default Watermark** (`Select`, [line 522](../../../apps/web/src/pages/documents.tsx#L522)) — accepts input, default value sensible, persists after refresh
- [ ] **Font Family** (`TextInput`, [line 530](../../../apps/web/src/pages/documents.tsx#L530)) — accepts input, default value sensible, persists after refresh
- [ ] **Font Size (pt)** (`NumberInput`, [line 535](../../../apps/web/src/pages/documents.tsx#L535)) — accepts input, default value sensible, persists after refresh
- [ ] **Top** (`NumberInput`, [line 546](../../../apps/web/src/pages/documents.tsx#L546)) — accepts input, default value sensible, persists after refresh
- [ ] **Bottom** (`NumberInput`, [line 547](../../../apps/web/src/pages/documents.tsx#L547)) — accepts input, default value sensible, persists after refresh
- [ ] **Left** (`NumberInput`, [line 548](../../../apps/web/src/pages/documents.tsx#L548)) — accepts input, default value sensible, persists after refresh
- [ ] **Right** (`NumberInput`, [line 549](../../../apps/web/src/pages/documents.tsx#L549)) — accepts input, default value sensible, persists after refresh
- [ ] **Show Logo** (`Checkbox`, [line 554](../../../apps/web/src/pages/documents.tsx#L554)) — accepts input, default value sensible, persists after refresh
- [ ] **Hospital Name** (`Checkbox`, [line 555](../../../apps/web/src/pages/documents.tsx#L555)) — accepts input, default value sensible, persists after refresh
- [ ] **Address** (`Checkbox`, [line 556](../../../apps/web/src/pages/documents.tsx#L556)) — accepts input, default value sensible, persists after refresh
- [ ] **Page Numbers** (`Checkbox`, [line 559](../../../apps/web/src/pages/documents.tsx#L559)) — accepts input, default value sensible, persists after refresh
- [ ] **QR Code** (`Checkbox`, [line 560](../../../apps/web/src/pages/documents.tsx#L560)) — accepts input, default value sensible, persists after refresh
- [ ] **Print Metadata** (`Checkbox`, [line 561](../../../apps/web/src/pages/documents.tsx#L561)) — accepts input, default value sensible, persists after refresh
- [ ] **Header Layout** (`JsonInput`, [line 565](../../../apps/web/src/pages/documents.tsx#L565)) — accepts input, default value sensible, persists after refresh
- [ ] **Body Layout** (`JsonInput`, [line 574](../../../apps/web/src/pages/documents.tsx#L574)) — accepts input, default value sensible, persists after refresh
- [ ] **Footer Layout** (`JsonInput`, [line 583](../../../apps/web/src/pages/documents.tsx#L583)) — accepts input, default value sensible, persists after refresh
- [ ] **Signature Blocks** (`JsonInput`, [line 592](../../../apps/web/src/pages/documents.tsx#L592)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 750>** (`TextInput`, [line 750](../../../apps/web/src/pages/documents.tsx#L750)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 757>** (`Select`, [line 757](../../../apps/web/src/pages/documents.tsx#L757)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 765>** (`Select`, [line 765](../../../apps/web/src/pages/documents.tsx#L765)) — accepts input, default value sensible, persists after refresh
- [ ] **Template** (`Select`, [line 951](../../../apps/web/src/pages/documents.tsx#L951)) — accepts input, default value sensible, persists after refresh
- [ ] **Review Cycle (months)** (`NumberInput`, [line 959](../../../apps/web/src/pages/documents.tsx#L959)) — accepts input, default value sensible, persists after refresh
- [ ] **Next Review Due** (`TextInput`, [line 966](../../../apps/web/src/pages/documents.tsx#L966)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 972](../../../apps/web/src/pages/documents.tsx#L972)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 8, `<ActionIcon>`: 4, `<Menu.Item>`: 0)

- [ ] **<button @ line 388>** ([line 388](../../../apps/web/src/pages/documents.tsx#L388)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 388>** ([line 388](../../../apps/web/src/pages/documents.tsx#L388)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 456>** ([line 456](../../../apps/web/src/pages/documents.tsx#L456)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 456>** ([line 456](../../../apps/web/src/pages/documents.tsx#L456)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 603](../../../apps/web/src/pages/documents.tsx#L603)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 603](../../../apps/web/src/pages/documents.tsx#L603)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 606>** ([line 606](../../../apps/web/src/pages/documents.tsx#L606)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 606>** ([line 606](../../../apps/web/src/pages/documents.tsx#L606)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 907>** ([line 907](../../../apps/web/src/pages/documents.tsx#L907)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 907>** ([line 907](../../../apps/web/src/pages/documents.tsx#L907)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 929>** ([line 929](../../../apps/web/src/pages/documents.tsx#L929)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 929>** ([line 929](../../../apps/web/src/pages/documents.tsx#L929)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 979](../../../apps/web/src/pages/documents.tsx#L979)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 979](../../../apps/web/src/pages/documents.tsx#L979)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 980>** ([line 980](../../../apps/web/src/pages/documents.tsx#L980)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 980>** ([line 980](../../../apps/web/src/pages/documents.tsx#L980)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 416>** ([line 416](../../../apps/web/src/pages/documents.tsx#L416)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 421>** ([line 421](../../../apps/web/src/pages/documents.tsx#L421)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 721>** ([line 721](../../../apps/web/src/pages/documents.tsx#L721)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 730>** ([line 730](../../../apps/web/src/pages/documents.tsx#L730)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (10)

- [ ] `api.createDocumentTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createReviewSchedule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteDocumentTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDocumentOutputs` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDocumentTemplates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listReviewSchedule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.markReviewed` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.setDefaultTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateDocumentTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.voidDocumentOutput` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._