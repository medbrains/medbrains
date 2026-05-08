# `procurement.tsx` walkthrough

_Source: [`apps/web/src/pages/procurement.tsx`](../../../apps/web/src/pages/procurement.tsx) (2097 lines). Guard: `P.PROCUREMENT.VENDORS_LIST`. API methods: 22. useForm: 0. Tables: 13. Modals: 10._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.PROCUREMENT.VENDORS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Vendors** (`vendors`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Vendors** (`vendors`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Vendors** (`vendors`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Purchase Orders** (`purchase-orders`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Purchase Orders** (`purchase-orders`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Purchase Orders** (`purchase-orders`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            GRN** (`grn`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            GRN** (`grn`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            GRN** (`grn`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Rate Contracts** (`rate-contracts`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Rate Contracts** (`rate-contracts`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Rate Contracts** (`rate-contracts`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Batch Stock** (`batch-stock`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Batch Stock** (`batch-stock`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Batch Stock** (`batch-stock`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Store Locations** (`store-locations`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Store Locations** (`store-locations`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Store Locations** (`store-locations`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Vendor Performance** (`vendor-performance`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Vendor Performance** (`vendor-performance`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Vendor Performance** (`vendor-performance`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Supplier Payments** (`supplier-payments`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Supplier Payments** (`supplier-payments`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Supplier Payments** (`supplier-payments`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (52)
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`vendor_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Contact** (`contact_person`) renders without `undefined` / `[object Object]`
- [ ] Column **Phone** (`phone`) renders without `undefined` / `[object Object]`
- [ ] Column **City** (`city`) renders without `undefined` / `[object Object]`
- [ ] Column **GST** (`gst_number`) renders without `undefined` / `[object Object]`
- [ ] Column **PO #** (`po_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Amount** (`total_amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`order_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Expected** (`expected_delivery`) renders without `undefined` / `[object Object]`
- [ ] Column **GRN #** (`grn_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Amount** (`total_amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Receipt Date** (`receipt_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Invoice** (`invoice_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Contract #** (`contract_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Start** (`start_date`) renders without `undefined` / `[object Object]`
- [ ] Column **End** (`end_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Notes** (`notes`) renders without `undefined` / `[object Object]`
- [ ] Column **Batch** (`batch_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Serial #** (`serial_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Qty** (`quantity`) renders without `undefined` / `[object Object]`
- [ ] Column **Cost** (`unit_cost`) renders without `undefined` / `[object Object]`
- [ ] Column **Expiry** (`expiry_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Consignment** (`is_consignment`) renders without `undefined` / `[object Object]`
- [ ] Column **Received** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`location_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Address** (`address`) renders without `undefined` / `[object Object]`
- [ ] Column **Vendor** (`vendor_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Orders** (`total_orders`) renders without `undefined` / `[object Object]`
- [ ] Column **On-Time %** (`on_time_pct`) renders without `undefined` / `[object Object]`
- [ ] Column **Rejection Rate** (`rejection_rate`) renders without `undefined` / `[object Object]`
- [ ] Column **Avg Delivery (days)** (`avg_delivery_days`) renders without `undefined` / `[object Object]`
- [ ] Column **Vendor** (`vendor_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Item** (`item_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Unit Price** (`unit_price`) renders without `undefined` / `[object Object]`
- [ ] Column **Delivery (days)** (`delivery_days`) renders without `undefined` / `[object Object]`
- [ ] Column **Rejection Rate** (`rejection_rate`) renders without `undefined` / `[object Object]`
- [ ] Column **Payment #** (`payment_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Invoice** (`invoice_amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Paid** (`paid_amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Balance** (`balance_amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] _… 2 more columns — review remaining_

### `<Table>` @ line 654
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Qty** column shows correct value for at least one row
  - [ ] Header **Received** column shows correct value for at least one row
  - [ ] Header **Price** column shows correct value for at least one row
  - [ ] Header **Total** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 745
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Qty** column shows correct value for at least one row
  - [ ] Header **Received** column shows correct value for at least one row
  - [ ] Header **Price** column shows correct value for at least one row
  - [ ] Header **Total** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 916
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Catalog** column shows correct value for at least one row
  - [ ] Header **Qty** column shows correct value for at least one row
  - [ ] Header **Price** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1089
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Received** column shows correct value for at least one row
  - [ ] Header **Accepted** column shows correct value for at least one row
  - [ ] Header **Rejected** column shows correct value for at least one row
  - [ ] Header **Batch** column shows correct value for at least one row
  - [ ] Header **Expiry** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1150
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Received** column shows correct value for at least one row
  - [ ] Header **Accepted** column shows correct value for at least one row
  - [ ] Header **Rejected** column shows correct value for at least one row
  - [ ] Header **Batch** column shows correct value for at least one row
  - [ ] Header **Expiry** column shows correct value for at least one row
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Received** column shows correct value for at least one row
  - [ ] Header **Accepted** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1270
  - [ ] Header **Item** column shows correct value for at least one row
  - [ ] Header **Received** column shows correct value for at least one row
  - [ ] Header **Accepted** column shows correct value for at least one row
  - [ ] Header **Batch** column shows correct value for at least one row
  - [ ] Header **Expiry** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _Compare Vendors by Item_ @ [line 1784](../../../apps/web/src/pages/procurement.tsx#L1784)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _Register New Vendor_ @ [line 336](../../../apps/web/src/pages/procurement.tsx#L336)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Vendor Details_ @ [line 351](../../../apps/web/src/pages/procurement.tsx#L351)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Purchase Order_ @ [line 665](../../../apps/web/src/pages/procurement.tsx#L665)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Purchase Order Details_ @ [line 680](../../../apps/web/src/pages/procurement.tsx#L680)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create GRN_ @ [line 1100](../../../apps/web/src/pages/procurement.tsx#L1100)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _GRN Details_ @ [line 1116](../../../apps/web/src/pages/procurement.tsx#L1116)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Rate Contract_ @ [line 1386](../../../apps/web/src/pages/procurement.tsx#L1386)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Store Location_ @ [line 1628](../../../apps/web/src/pages/procurement.tsx#L1628)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record Payment_ @ [line 1965](../../../apps/web/src/pages/procurement.tsx#L1965)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (43)

- [ ] **Vendor Code** (`TextInput`, [line 449](../../../apps/web/src/pages/procurement.tsx#L449)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 455](../../../apps/web/src/pages/procurement.tsx#L455)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 461](../../../apps/web/src/pages/procurement.tsx#L461)) — accepts input, default value sensible, persists after refresh
- [ ] **Contact Person** (`TextInput`, [line 472](../../../apps/web/src/pages/procurement.tsx#L472)) — accepts input, default value sensible, persists after refresh
- [ ] **Phone** (`TextInput`, [line 477](../../../apps/web/src/pages/procurement.tsx#L477)) — accepts input, default value sensible, persists after refresh
- [ ] **Email** (`TextInput`, [line 478](../../../apps/web/src/pages/procurement.tsx#L478)) — accepts input, default value sensible, persists after refresh
- [ ] **City** (`TextInput`, [line 479](../../../apps/web/src/pages/procurement.tsx#L479)) — accepts input, default value sensible, persists after refresh
- [ ] **GST Number** (`TextInput`, [line 480](../../../apps/web/src/pages/procurement.tsx#L480)) — accepts input, default value sensible, persists after refresh
- [ ] **Payment Terms** (`Select`, [line 485](../../../apps/web/src/pages/procurement.tsx#L485)) — accepts input, default value sensible, persists after refresh
- [ ] **Supply Categories** (`MultiSelect`, [line 497](../../../apps/web/src/pages/procurement.tsx#L497)) — accepts input, default value sensible, persists after refresh
- [ ] **Drug License Number** (`TextInput`, [line 507](../../../apps/web/src/pages/procurement.tsx#L507)) — accepts input, default value sensible, persists after refresh
- [ ] **Pharmacy Vendor** (`Switch`, [line 514](../../../apps/web/src/pages/procurement.tsx#L514)) — accepts input, default value sensible, persists after refresh
- [ ] **Product Lines** (`TextInput`, [line 520](../../../apps/web/src/pages/procurement.tsx#L520)) — accepts input, default value sensible, persists after refresh
- [ ] **Linked Indent** (`Select`, [line 891](../../../apps/web/src/pages/procurement.tsx#L891)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 913](../../../apps/web/src/pages/procurement.tsx#L913)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 930>** (`TextInput`, [line 930](../../../apps/web/src/pages/procurement.tsx#L930)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 938>** (`Select`, [line 938](../../../apps/web/src/pages/procurement.tsx#L938)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 959>** (`NumberInput`, [line 959](../../../apps/web/src/pages/procurement.tsx#L959)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 968>** (`NumberInput`, [line 968](../../../apps/web/src/pages/procurement.tsx#L968)) — accepts input, default value sensible, persists after refresh
- [ ] **Purchase Order** (`Select`, [line 1250](../../../apps/web/src/pages/procurement.tsx#L1250)) — accepts input, default value sensible, persists after refresh
- [ ] **Invoice Number** (`TextInput`, [line 1262](../../../apps/web/src/pages/procurement.tsx#L1262)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1267](../../../apps/web/src/pages/procurement.tsx#L1267)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 1287>** (`NumberInput`, [line 1287](../../../apps/web/src/pages/procurement.tsx#L1287)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 1296>** (`NumberInput`, [line 1296](../../../apps/web/src/pages/procurement.tsx#L1296)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1306>** (`TextInput`, [line 1306](../../../apps/web/src/pages/procurement.tsx#L1306)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1315>** (`TextInput`, [line 1315](../../../apps/web/src/pages/procurement.tsx#L1315)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Date** (`TextInput`, [line 1437](../../../apps/web/src/pages/procurement.tsx#L1437)) — accepts input, default value sensible, persists after refresh
- [ ] **End Date** (`TextInput`, [line 1444](../../../apps/web/src/pages/procurement.tsx#L1444)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 1451](../../../apps/web/src/pages/procurement.tsx#L1451)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1456>** (`Select`, [line 1456](../../../apps/web/src/pages/procurement.tsx#L1456)) — accepts input, default value sensible, persists after refresh
- [ ] **Price** (`NumberInput`, [line 1469](../../../apps/web/src/pages/procurement.tsx#L1469)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 1671](../../../apps/web/src/pages/procurement.tsx#L1671)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 1677](../../../apps/web/src/pages/procurement.tsx#L1677)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 1683](../../../apps/web/src/pages/procurement.tsx#L1683)) — accepts input, default value sensible, persists after refresh
- [ ] **Address** (`Textarea`, [line 1695](../../../apps/web/src/pages/procurement.tsx#L1695)) — accepts input, default value sensible, persists after refresh
- [ ] **Select Catalog Item** (`Select`, [line 1853](../../../apps/web/src/pages/procurement.tsx#L1853)) — accepts input, default value sensible, persists after refresh
- [ ] **Purchase Order (optional)** (`Select`, [line 2032](../../../apps/web/src/pages/procurement.tsx#L2032)) — accepts input, default value sensible, persists after refresh
- [ ] **Invoice Amount** (`NumberInput`, [line 2045](../../../apps/web/src/pages/procurement.tsx#L2045)) — accepts input, default value sensible, persists after refresh
- [ ] **Paid Amount** (`NumberInput`, [line 2053](../../../apps/web/src/pages/procurement.tsx#L2053)) — accepts input, default value sensible, persists after refresh
- [ ] **Due Date** (`TextInput`, [line 2060](../../../apps/web/src/pages/procurement.tsx#L2060)) — accepts input, default value sensible, persists after refresh
- [ ] **Payment Method** (`Select`, [line 2066](../../../apps/web/src/pages/procurement.tsx#L2066)) — accepts input, default value sensible, persists after refresh
- [ ] **Reference Number** (`TextInput`, [line 2080](../../../apps/web/src/pages/procurement.tsx#L2080)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 2086](../../../apps/web/src/pages/procurement.tsx#L2086)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 17, `<ActionIcon>`: 4, `<Menu.Item>`: 0)

- [ ] **<button @ line 322>** ([line 322](../../../apps/web/src/pages/procurement.tsx#L322)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 322>** ([line 322](../../../apps/web/src/pages/procurement.tsx#L322)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 526>** ([line 526](../../../apps/web/src/pages/procurement.tsx#L526)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 526>** ([line 526](../../../apps/web/src/pages/procurement.tsx#L526)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 618>** ([line 618](../../../apps/web/src/pages/procurement.tsx#L618)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 618>** ([line 618](../../../apps/web/src/pages/procurement.tsx#L618)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 629>** ([line 629](../../../apps/web/src/pages/procurement.tsx#L629)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 629>** ([line 629](../../../apps/web/src/pages/procurement.tsx#L629)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 648>** ([line 648](../../../apps/web/src/pages/procurement.tsx#L648)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 648>** ([line 648](../../../apps/web/src/pages/procurement.tsx#L648)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 992>** ([line 992](../../../apps/web/src/pages/procurement.tsx#L992)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 992>** ([line 992](../../../apps/web/src/pages/procurement.tsx#L992)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1002>** ([line 1002](../../../apps/web/src/pages/procurement.tsx#L1002)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1002>** ([line 1002](../../../apps/web/src/pages/procurement.tsx#L1002)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1083>** ([line 1083](../../../apps/web/src/pages/procurement.tsx#L1083)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1083>** ([line 1083](../../../apps/web/src/pages/procurement.tsx#L1083)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1328>** ([line 1328](../../../apps/web/src/pages/procurement.tsx#L1328)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1328>** ([line 1328](../../../apps/web/src/pages/procurement.tsx#L1328)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1372>** ([line 1372](../../../apps/web/src/pages/procurement.tsx#L1372)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1372>** ([line 1372](../../../apps/web/src/pages/procurement.tsx#L1372)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1484>** ([line 1484](../../../apps/web/src/pages/procurement.tsx#L1484)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1484>** ([line 1484](../../../apps/web/src/pages/procurement.tsx#L1484)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1493>** ([line 1493](../../../apps/web/src/pages/procurement.tsx#L1493)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1493>** ([line 1493](../../../apps/web/src/pages/procurement.tsx#L1493)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1615>** ([line 1615](../../../apps/web/src/pages/procurement.tsx#L1615)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1615>** ([line 1615](../../../apps/web/src/pages/procurement.tsx#L1615)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1700>** ([line 1700](../../../apps/web/src/pages/procurement.tsx#L1700)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1700>** ([line 1700](../../../apps/web/src/pages/procurement.tsx#L1700)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1771>** ([line 1771](../../../apps/web/src/pages/procurement.tsx#L1771)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1771>** ([line 1771](../../../apps/web/src/pages/procurement.tsx#L1771)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1951>** ([line 1951](../../../apps/web/src/pages/procurement.tsx#L1951)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1951>** ([line 1951](../../../apps/web/src/pages/procurement.tsx#L1951)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2087>** ([line 2087](../../../apps/web/src/pages/procurement.tsx#L2087)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2087>** ([line 2087](../../../apps/web/src/pages/procurement.tsx#L2087)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 303>** ([line 303](../../../apps/web/src/pages/procurement.tsx#L303)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 606>** ([line 606](../../../apps/web/src/pages/procurement.tsx#L606)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 978>** ([line 978](../../../apps/web/src/pages/procurement.tsx#L978)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1064>** ([line 1064](../../../apps/web/src/pages/procurement.tsx#L1064)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (22)

- [ ] `api.approvePurchaseOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createGrn` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPurchaseOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRateContract` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createStoreLocation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSupplierPayment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createVendor` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getGrn` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getIndentRequisition` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getPurchaseOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getVendorComparison` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getVendorPerformance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBatchStock` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listGrns` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIndentRequisitions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPurchaseOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRateContracts` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listStoreCatalog` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listStoreLocations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSupplierPayments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listVendors` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.sendPurchaseOrder` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._