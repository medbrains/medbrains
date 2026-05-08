# `billing.tsx` walkthrough

_Source: [`apps/web/src/pages/billing.tsx`](../../../apps/web/src/pages/billing.tsx) (6328 lines). Guard: `P.BILLING.INVOICES_LIST`. API methods: 96. useForm: 0. Tables: 35. Modals: 12._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.BILLING.INVOICES_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
              Concessions** (`concessions`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Concessions** (`concessions`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Concessions** (`concessions`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (146)
- [ ] Column **Invoice #** (`invoice_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Total** (`total_amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Paid** (`paid_amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Balance** (`balance`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Price** (`base_price`) renders without `undefined` / `[object Object]`
- [ ] Column **HSN/SAC** (`hsn_sac_code`) renders without `undefined` / `[object Object]`
- [ ] Column **GST Cat.** (`gst_category`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Price** (`total_price`) renders without `undefined` / `[object Object]`
- [ ] Column **Discount** (`discount_percent`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`patient_category`) renders without `undefined` / `[object Object]`
- [ ] Column **Default** (`is_default`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **WO #** (`write_off_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Amount** (`amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Reason** (`reason`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Refund #** (`refund_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Amount** (`amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Reason** (`reason`) renders without `undefined` / `[object Object]`
- [ ] Column **Mode** (`mode`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`refunded_at`) renders without `undefined` / `[object Object]`
- [ ] Column **CN #** (`credit_note_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Amount** (`amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Reason** (`reason`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **TPA Name** (`tpa_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Provider** (`insurance_provider`) renders without `undefined` / `[object Object]`
- [ ] Column **Scheme** (`scheme_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Valid From** (`valid_from`) renders without `undefined` / `[object Object]`
- [ ] Column **Valid To** (`valid_to`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **Provider** (`insurance_provider`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`claim_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Pre-Auth** (`pre_auth_amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Approved** (`approved_amount`) renders without `undefined` / `[object Object]`
- [ ] Column **Settled** (`settled_amount`) renders without `undefined` / `[object Object]`
- [ ] Column **OPD Consultation** (`auto_charge_opd`) renders without `undefined` / `[object Object]`
- [ ] Column **Lab Tests** (`auto_charge_lab`) renders without `undefined` / `[object Object]`
- [ ] _… 96 more columns — review remaining_

### `<Table>` @ line 834
  - [ ] Header **Description** column shows correct value for at least one row
  - [ ] Header **Qty** column shows correct value for at least one row
  - [ ] Header **Price** column shows correct value for at least one row
  - [ ] Header **Tax** column shows correct value for at least one row
  - [ ] Header **Total** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Header **Amount** column shows correct value for at least one row
  - [ ] Header **Mode** column shows correct value for at least one row
  - [ ] Header **Reference** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 943
  - [ ] Header **Amount** column shows correct value for at least one row
  - [ ] Header **Mode** column shows correct value for at least one row
  - [ ] Header **Reference** column shows correct value for at least one row
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Value** column shows correct value for at least one row
  - [ ] Header **Reason** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1049
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Value** column shows correct value for at least one row
  - [ ] Header **Reason** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2753
  - [ ] Header **When** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Sender** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

_… 25 more tables — list capped to keep checklist usable_
## Modals / Drawers

### Drawer — _Invoice Detail_ @ [line 570](../../../apps/web/src/pages/billing.tsx#L570)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Invoice_ @ [line 614](../../../apps/web/src/pages/billing.tsx#L614)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _ER Fast Invoice_ @ [line 1425](../../../apps/web/src/pages/billing.tsx#L1425)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 2621>_ @ [line 2621](../../../apps/web/src/pages/billing.tsx#L2621)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 3122>_ @ [line 3122](../../../apps/web/src/pages/billing.tsx#L3122)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 3160>_ @ [line 3160](../../../apps/web/src/pages/billing.tsx#L3160)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Corporate Client Detail_ @ [line 3388](../../../apps/web/src/pages/billing.tsx#L3388)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 4563>_ @ [line 4563](../../../apps/web/src/pages/billing.tsx#L4563)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Generate GSTR Summary_ @ [line 4771](../../../apps/web/src/pages/billing.tsx#L4771)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Record TDS Deduction_ @ [line 4978](../../../apps/web/src/pages/billing.tsx#L4978)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Create Journal Entry_ @ [line 5361](../../../apps/web/src/pages/billing.tsx#L5361)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Import Bank Transactions_ @ [line 5708](../../../apps/web/src/pages/billing.tsx#L5708)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (147)

- [ ] **<Select @ line 452>** (`Select`, [line 452](../../../apps/web/src/pages/billing.tsx#L452)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient ID** (`TextInput`, [line 616](../../../apps/web/src/pages/billing.tsx#L616)) — accepts input, default value sensible, persists after refresh
- [ ] **Encounter ID** (`TextInput`, [line 623](../../../apps/web/src/pages/billing.tsx#L623)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 628](../../../apps/web/src/pages/billing.tsx#L628)) — accepts input, default value sensible, persists after refresh
- [ ] **Charge Code** (`TextInput`, [line 882](../../../apps/web/src/pages/billing.tsx#L882)) — accepts input, default value sensible, persists after refresh
- [ ] **Source** (`Select`, [line 887](../../../apps/web/src/pages/billing.tsx#L887)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`TextInput`, [line 902](../../../apps/web/src/pages/billing.tsx#L902)) — accepts input, default value sensible, persists after refresh
- [ ] **Qty** (`NumberInput`, [line 908](../../../apps/web/src/pages/billing.tsx#L908)) — accepts input, default value sensible, persists after refresh
- [ ] **Unit Price** (`NumberInput`, [line 914](../../../apps/web/src/pages/billing.tsx#L914)) — accepts input, default value sensible, persists after refresh
- [ ] **Tax %** (`NumberInput`, [line 920](../../../apps/web/src/pages/billing.tsx#L920)) — accepts input, default value sensible, persists after refresh
- [ ] **Amount** (`NumberInput`, [line 996](../../../apps/web/src/pages/billing.tsx#L996)) — accepts input, default value sensible, persists after refresh
- [ ] **Mode** (`Select`, [line 1003](../../../apps/web/src/pages/billing.tsx#L1003)) — accepts input, default value sensible, persists after refresh
- [ ] **Reference #** (`TextInput`, [line 1017](../../../apps/web/src/pages/billing.tsx#L1017)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 1105](../../../apps/web/src/pages/billing.tsx#L1105)) — accepts input, default value sensible, persists after refresh
- [ ] **Value** (`NumberInput`, [line 1115](../../../apps/web/src/pages/billing.tsx#L1115)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`TextInput`, [line 1123](../../../apps/web/src/pages/billing.tsx#L1123)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 1239](../../../apps/web/src/pages/billing.tsx#L1239)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 1244](../../../apps/web/src/pages/billing.tsx#L1244)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 1250](../../../apps/web/src/pages/billing.tsx#L1250)) — accepts input, default value sensible, persists after refresh
- [ ] **Base Price** (`NumberInput`, [line 1258](../../../apps/web/src/pages/billing.tsx#L1258)) — accepts input, default value sensible, persists after refresh
- [ ] **Tax %** (`NumberInput`, [line 1265](../../../apps/web/src/pages/billing.tsx#L1265)) — accepts input, default value sensible, persists after refresh
- [ ] **HSN/SAC Code** (`TextInput`, [line 1274](../../../apps/web/src/pages/billing.tsx#L1274)) — accepts input, default value sensible, persists after refresh
- [ ] **GST Category** (`Select`, [line 1281](../../../apps/web/src/pages/billing.tsx#L1281)) — accepts input, default value sensible, persists after refresh
- [ ] **Emergency Visit ID** (`TextInput`, [line 1433](../../../apps/web/src/pages/billing.tsx#L1433)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 1556](../../../apps/web/src/pages/billing.tsx#L1556)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 1561](../../../apps/web/src/pages/billing.tsx#L1561)) — accepts input, default value sensible, persists after refresh
- [ ] **Total Price** (`NumberInput`, [line 1568](../../../apps/web/src/pages/billing.tsx#L1568)) — accepts input, default value sensible, persists after refresh
- [ ] **Discount %** (`NumberInput`, [line 1575](../../../apps/web/src/pages/billing.tsx#L1575)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 1583](../../../apps/web/src/pages/billing.tsx#L1583)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1596>** (`TextInput`, [line 1596](../../../apps/web/src/pages/billing.tsx#L1596)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1602>** (`TextInput`, [line 1602](../../../apps/web/src/pages/billing.tsx#L1602)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 1608>** (`NumberInput`, [line 1608](../../../apps/web/src/pages/billing.tsx#L1608)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 1615>** (`NumberInput`, [line 1615](../../../apps/web/src/pages/billing.tsx#L1615)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 1742](../../../apps/web/src/pages/billing.tsx#L1742)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient Category** (`Select`, [line 1748](../../../apps/web/src/pages/billing.tsx#L1748)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 1761](../../../apps/web/src/pages/billing.tsx#L1761)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1775>** (`TextInput`, [line 1775](../../../apps/web/src/pages/billing.tsx#L1775)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 1781>** (`NumberInput`, [line 1781](../../../apps/web/src/pages/billing.tsx#L1781)) — accepts input, default value sensible, persists after refresh
- [ ] **Invoice ID** (`TextInput`, [line 2036](../../../apps/web/src/pages/billing.tsx#L2036)) — accepts input, default value sensible, persists after refresh
- [ ] **Amount** (`NumberInput`, [line 2043](../../../apps/web/src/pages/billing.tsx#L2043)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`TextInput`, [line 2051](../../../apps/web/src/pages/billing.tsx#L2051)) — accepts input, default value sensible, persists after refresh
- [ ] **Mode** (`Select`, [line 2056](../../../apps/web/src/pages/billing.tsx#L2056)) — accepts input, default value sensible, persists after refresh
- [ ] **Invoice ID** (`TextInput`, [line 2089](../../../apps/web/src/pages/billing.tsx#L2089)) — accepts input, default value sensible, persists after refresh
- [ ] **Amount** (`NumberInput`, [line 2096](../../../apps/web/src/pages/billing.tsx#L2096)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`TextInput`, [line 2103](../../../apps/web/src/pages/billing.tsx#L2103)) — accepts input, default value sensible, persists after refresh
- [ ] **Invoice ID** (`TextInput`, [line 2135](../../../apps/web/src/pages/billing.tsx#L2135)) — accepts input, default value sensible, persists after refresh
- [ ] **Amount** (`NumberInput`, [line 2142](../../../apps/web/src/pages/billing.tsx#L2142)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`TextInput`, [line 2149](../../../apps/web/src/pages/billing.tsx#L2149)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 2156](../../../apps/web/src/pages/billing.tsx#L2156)) — accepts input, default value sensible, persists after refresh
- [ ] **Invoice ID** (`TextInput`, [line 2376](../../../apps/web/src/pages/billing.tsx#L2376)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient ID** (`TextInput`, [line 2381](../../../apps/web/src/pages/billing.tsx#L2381)) — accepts input, default value sensible, persists after refresh
- [ ] **Insurance Provider** (`TextInput`, [line 2388](../../../apps/web/src/pages/billing.tsx#L2388)) — accepts input, default value sensible, persists after refresh
- [ ] **Policy Number** (`TextInput`, [line 2393](../../../apps/web/src/pages/billing.tsx#L2393)) — accepts input, default value sensible, persists after refresh
- [ ] **Claim Type** (`Select`, [line 2401](../../../apps/web/src/pages/billing.tsx#L2401)) — accepts input, default value sensible, persists after refresh
- [ ] **Pre-Auth Amount** (`NumberInput`, [line 2410](../../../apps/web/src/pages/billing.tsx#L2410)) — accepts input, default value sensible, persists after refresh
- [ ] **Scheme Type** (`Select`, [line 2418](../../../apps/web/src/pages/billing.tsx#L2418)) — accepts input, default value sensible, persists after refresh
- [ ] **TPA Name** (`TextInput`, [line 2431](../../../apps/web/src/pages/billing.tsx#L2431)) — accepts input, default value sensible, persists after refresh
- [ ] **Co-Pay %** (`NumberInput`, [line 2439](../../../apps/web/src/pages/billing.tsx#L2439)) — accepts input, default value sensible, persists after refresh
- [ ] **Deductible Amount** (`NumberInput`, [line 2446](../../../apps/web/src/pages/billing.tsx#L2446)) — accepts input, default value sensible, persists after refresh
- [ ] **Member ID** (`TextInput`, [line 2454](../../../apps/web/src/pages/billing.tsx#L2454)) — accepts input, default value sensible, persists after refresh
- [ ] **Scheme Card Number** (`TextInput`, [line 2460](../../../apps/web/src/pages/billing.tsx#L2460)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 2467](../../../apps/web/src/pages/billing.tsx#L2467)) — accepts input, default value sensible, persists after refresh
- [ ] **TPA Name** (`TextInput`, [line 2511](../../../apps/web/src/pages/billing.tsx#L2511)) — accepts input, default value sensible, persists after refresh
- [ ] **Insurance Provider** (`TextInput`, [line 2516](../../../apps/web/src/pages/billing.tsx#L2516)) — accepts input, default value sensible, persists after refresh
- [ ] **Scheme Type** (`Select`, [line 2525](../../../apps/web/src/pages/billing.tsx#L2525)) — accepts input, default value sensible, persists after refresh
- [ ] **Rate Plan ID** (`TextInput`, [line 2532](../../../apps/web/src/pages/billing.tsx#L2532)) — accepts input, default value sensible, persists after refresh
- [ ] **Valid From** (`TextInput`, [line 2540](../../../apps/web/src/pages/billing.tsx#L2540)) — accepts input, default value sensible, persists after refresh
- [ ] **Valid To** (`TextInput`, [line 2547](../../../apps/web/src/pages/billing.tsx#L2547)) — accepts input, default value sensible, persists after refresh
- [ ] **GSTIN** (`TextInput`, [line 2837](../../../apps/web/src/pages/billing.tsx#L2837)) — accepts input, default value sensible, persists after refresh
- [ ] **State Code** (`TextInput`, [line 2843](../../../apps/web/src/pages/billing.tsx#L2843)) — accepts input, default value sensible, persists after refresh
- [ ] **Default GST Type** (`Select`, [line 2849](../../../apps/web/src/pages/billing.tsx#L2849)) — accepts input, default value sensible, persists after refresh
- [ ] **Auto-adjust advance on invoice payment** (`Switch`, [line 2866](../../../apps/web/src/pages/billing.tsx#L2866)) — accepts input, default value sensible, persists after refresh
- [ ] **<Switch @ line 2882>** (`Switch`, [line 2882](../../../apps/web/src/pages/billing.tsx#L2882)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient ID** (`TextInput`, [line 3060](../../../apps/web/src/pages/billing.tsx#L3060)) — accepts input, default value sensible, persists after refresh
- [ ] **Encounter ID** (`TextInput`, [line 3065](../../../apps/web/src/pages/billing.tsx#L3065)) — accepts input, default value sensible, persists after refresh
- [ ] **Amount** (`NumberInput`, [line 3073](../../../apps/web/src/pages/billing.tsx#L3073)) — accepts input, default value sensible, persists after refresh
- [ ] **Payment Mode** (`Select`, [line 3080](../../../apps/web/src/pages/billing.tsx#L3080)) — accepts input, default value sensible, persists after refresh
- [ ] **Purpose** (`Select`, [line 3088](../../../apps/web/src/pages/billing.tsx#L3088)) — accepts input, default value sensible, persists after refresh
- [ ] **Reference #** (`TextInput`, [line 3099](../../../apps/web/src/pages/billing.tsx#L3099)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 3106](../../../apps/web/src/pages/billing.tsx#L3106)) — accepts input, default value sensible, persists after refresh
- [ ] **Invoice ID** (`TextInput`, [line 3130](../../../apps/web/src/pages/billing.tsx#L3130)) — accepts input, default value sensible, persists after refresh
- [ ] **Amount** (`NumberInput`, [line 3135](../../../apps/web/src/pages/billing.tsx#L3135)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 3142](../../../apps/web/src/pages/billing.tsx#L3142)) — accepts input, default value sensible, persists after refresh
- [ ] **Refund Amount** (`NumberInput`, [line 3168](../../../apps/web/src/pages/billing.tsx#L3168)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`TextInput`, [line 3175](../../../apps/web/src/pages/billing.tsx#L3175)) — accepts input, default value sensible, persists after refresh
- [ ] **Refund Mode** (`Select`, [line 3180](../../../apps/web/src/pages/billing.tsx#L3180)) — accepts input, default value sensible, persists after refresh
- [ ] **Reference #** (`TextInput`, [line 3186](../../../apps/web/src/pages/billing.tsx#L3186)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 3319](../../../apps/web/src/pages/billing.tsx#L3319)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 3325](../../../apps/web/src/pages/billing.tsx#L3325)) — accepts input, default value sensible, persists after refresh
- [ ] **GST Number** (`TextInput`, [line 3332](../../../apps/web/src/pages/billing.tsx#L3332)) — accepts input, default value sensible, persists after refresh
- [ ] **Contact Email** (`TextInput`, [line 3336](../../../apps/web/src/pages/billing.tsx#L3336)) — accepts input, default value sensible, persists after refresh
- [ ] **Contact Phone** (`TextInput`, [line 3342](../../../apps/web/src/pages/billing.tsx#L3342)) — accepts input, default value sensible, persists after refresh
- [ ] **Billing Address** (`Textarea`, [line 3349](../../../apps/web/src/pages/billing.tsx#L3349)) — accepts input, default value sensible, persists after refresh
- [ ] **Credit Limit (₹)** (`NumberInput`, [line 3356](../../../apps/web/src/pages/billing.tsx#L3356)) — accepts input, default value sensible, persists after refresh
- [ ] **Credit Days** (`NumberInput`, [line 3362](../../../apps/web/src/pages/billing.tsx#L3362)) — accepts input, default value sensible, persists after refresh
- [ ] **Agreed Discount %** (`NumberInput`, [line 3368](../../../apps/web/src/pages/billing.tsx#L3368)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 3479](../../../apps/web/src/pages/billing.tsx#L3479)) — accepts input, default value sensible, persists after refresh
- [ ] **Credit Limit** (`NumberInput`, [line 3484](../../../apps/web/src/pages/billing.tsx#L3484)) — accepts input, default value sensible, persists after refresh
- [ ] **Credit Days** (`NumberInput`, [line 3492](../../../apps/web/src/pages/billing.tsx#L3492)) — accepts input, default value sensible, persists after refresh
- [ ] **Discount %** (`NumberInput`, [line 3497](../../../apps/web/src/pages/billing.tsx#L3497)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`TextInput`, [line 3574](../../../apps/web/src/pages/billing.tsx#L3574)) — accepts input, default value sensible, persists after refresh
- [ ] **From** (`TextInput`, [line 3691](../../../apps/web/src/pages/billing.tsx#L3691)) — accepts input, default value sensible, persists after refresh
- [ ] **To** (`TextInput`, [line 3697](../../../apps/web/src/pages/billing.tsx#L3697)) — accepts input, default value sensible, persists after refresh
- [ ] **Date** (`TextInput`, [line 3931](../../../apps/web/src/pages/billing.tsx#L3931)) — accepts input, default value sensible, persists after refresh
- [ ] **Close Date** (`TextInput`, [line 4163](../../../apps/web/src/pages/billing.tsx#L4163)) — accepts input, default value sensible, persists after refresh
- [ ] **Actual Cash** (`NumberInput`, [line 4169](../../../apps/web/src/pages/billing.tsx#L4169)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 4177](../../../apps/web/src/pages/billing.tsx#L4177)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 4270>** (`Select`, [line 4270](../../../apps/web/src/pages/billing.tsx#L4270)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 4510>** (`Select`, [line 4510](../../../apps/web/src/pages/billing.tsx#L4510)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient ID** (`TextInput`, [line 4572](../../../apps/web/src/pages/billing.tsx#L4572)) — accepts input, default value sensible, persists after refresh
- [ ] **Credit Limit (₹)** (`NumberInput`, [line 4579](../../../apps/web/src/pages/billing.tsx#L4579)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 4586](../../../apps/web/src/pages/billing.tsx#L4586)) — accepts input, default value sensible, persists after refresh
- [ ] **Status** (`Select`, [line 4592](../../../apps/web/src/pages/billing.tsx#L4592)) — accepts input, default value sensible, persists after refresh
- [ ] **Return Type** (`Select`, [line 4779](../../../apps/web/src/pages/billing.tsx#L4779)) — accepts input, default value sensible, persists after refresh
- [ ] **Period (e.g. 2026-03)** (`TextInput`, [line 4785](../../../apps/web/src/pages/billing.tsx#L4785)) — accepts input, default value sensible, persists after refresh
- [ ] **Invoice ID** (`TextInput`, [line 4986](../../../apps/web/src/pages/billing.tsx#L4986)) — accepts input, default value sensible, persists after refresh
- [ ] **Deductee Name** (`TextInput`, [line 4992](../../../apps/web/src/pages/billing.tsx#L4992)) — accepts input, default value sensible, persists after refresh
- [ ] **PAN** (`TextInput`, [line 4998](../../../apps/web/src/pages/billing.tsx#L4998)) — accepts input, default value sensible, persists after refresh
- [ ] **Section** (`Select`, [line 5007](../../../apps/web/src/pages/billing.tsx#L5007)) — accepts input, default value sensible, persists after refresh
- [ ] **TDS Rate %** (`NumberInput`, [line 5016](../../../apps/web/src/pages/billing.tsx#L5016)) — accepts input, default value sensible, persists after refresh
- [ ] **Base Amount** (`NumberInput`, [line 5023](../../../apps/web/src/pages/billing.tsx#L5023)) — accepts input, default value sensible, persists after refresh
- [ ] **Deducted Date** (`TextInput`, [line 5032](../../../apps/web/src/pages/billing.tsx#L5032)) — accepts input, default value sensible, persists after refresh
- [ ] **Financial Year** (`Select`, [line 5039](../../../apps/web/src/pages/billing.tsx#L5039)) — accepts input, default value sensible, persists after refresh
- [ ] **Quarter** (`Select`, [line 5045](../../../apps/web/src/pages/billing.tsx#L5045)) — accepts input, default value sensible, persists after refresh
- [ ] **Period (YYYY-MM)** (`TextInput`, [line 5117](../../../apps/web/src/pages/billing.tsx#L5117)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 5337>** (`Select`, [line 5337](../../../apps/web/src/pages/billing.tsx#L5337)) — accepts input, default value sensible, persists after refresh
- [ ] **Entry Date** (`TextInput`, [line 5369](../../../apps/web/src/pages/billing.tsx#L5369)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 5376](../../../apps/web/src/pages/billing.tsx#L5376)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 5396>** (`Select`, [line 5396](../../../apps/web/src/pages/billing.tsx#L5396)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 5404>** (`NumberInput`, [line 5404](../../../apps/web/src/pages/billing.tsx#L5404)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 5411>** (`NumberInput`, [line 5411](../../../apps/web/src/pages/billing.tsx#L5411)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 5620>** (`Select`, [line 5620](../../../apps/web/src/pages/billing.tsx#L5620)) — accepts input, default value sensible, persists after refresh
- [ ] **Bank Name** (`TextInput`, [line 5716](../../../apps/web/src/pages/billing.tsx#L5716)) — accepts input, default value sensible, persists after refresh
- [ ] **Account Number** (`TextInput`, [line 5722](../../../apps/web/src/pages/billing.tsx#L5722)) — accepts input, default value sensible, persists after refresh
- [ ] **Date** (`TextInput`, [line 5734](../../../apps/web/src/pages/billing.tsx#L5734)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`TextInput`, [line 5742](../../../apps/web/src/pages/billing.tsx#L5742)) — accepts input, default value sensible, persists after refresh
- [ ] **Debit** (`NumberInput`, [line 5748](../../../apps/web/src/pages/billing.tsx#L5748)) — accepts input, default value sensible, persists after refresh
- [ ] **Credit** (`NumberInput`, [line 5754](../../../apps/web/src/pages/billing.tsx#L5754)) — accepts input, default value sensible, persists after refresh
- [ ] **Reference #** (`TextInput`, [line 5761](../../../apps/web/src/pages/billing.tsx#L5761)) — accepts input, default value sensible, persists after refresh
- [ ] **From** (`TextInput`, [line 5861](../../../apps/web/src/pages/billing.tsx#L5861)) — accepts input, default value sensible, persists after refresh
- [ ] **To** (`TextInput`, [line 5867](../../../apps/web/src/pages/billing.tsx#L5867)) — accepts input, default value sensible, persists after refresh
- [ ] **Target System** (`Select`, [line 6051](../../../apps/web/src/pages/billing.tsx#L6051)) — accepts input, default value sensible, persists after refresh
- [ ] **Export Type** (`Select`, [line 6063](../../../apps/web/src/pages/billing.tsx#L6063)) — accepts input, default value sensible, persists after refresh
- [ ] **From** (`TextInput`, [line 6075](../../../apps/web/src/pages/billing.tsx#L6075)) — accepts input, default value sensible, persists after refresh
- [ ] **To** (`TextInput`, [line 6082](../../../apps/web/src/pages/billing.tsx#L6082)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 6278>** (`Select`, [line 6278](../../../apps/web/src/pages/billing.tsx#L6278)) — accepts input, default value sensible, persists after refresh
- [ ] **<Textarea @ line 6313>** (`Textarea`, [line 6313](../../../apps/web/src/pages/billing.tsx#L6313)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 68, `<ActionIcon>`: 21, `<Menu.Item>`: 0)

- [ ] **<button @ line 357>** ([line 357](../../../apps/web/src/pages/billing.tsx#L357)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 357>** ([line 357](../../../apps/web/src/pages/billing.tsx#L357)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 360>** ([line 360](../../../apps/web/src/pages/billing.tsx#L360)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 360>** ([line 360](../../../apps/web/src/pages/billing.tsx#L360)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 629>** ([line 629](../../../apps/web/src/pages/billing.tsx#L629)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 629>** ([line 629](../../../apps/web/src/pages/billing.tsx#L629)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **issueMutation.mutate()}>             Issue Invoice** ([line 809](../../../apps/web/src/pages/billing.tsx#L809)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **issueMutation.mutate()}>             Issue Invoice** ([line 809](../../../apps/web/src/pages/billing.tsx#L809)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **cancelMutation.mutate()}>             Cancel** ([line 812](../../../apps/web/src/pages/billing.tsx#L812)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **cancelMutation.mutate()}>             Cancel** ([line 812](../../../apps/web/src/pages/billing.tsx#L812)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 819>** ([line 819](../../../apps/web/src/pages/billing.tsx#L819)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 819>** ([line 819](../../../apps/web/src/pages/billing.tsx#L819)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 871>** ([line 871](../../../apps/web/src/pages/billing.tsx#L871)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 871>** ([line 871](../../../apps/web/src/pages/billing.tsx#L871)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 928>** ([line 928](../../../apps/web/src/pages/billing.tsx#L928)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 928>** ([line 928](../../../apps/web/src/pages/billing.tsx#L928)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 978>** ([line 978](../../../apps/web/src/pages/billing.tsx#L978)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 978>** ([line 978](../../../apps/web/src/pages/billing.tsx#L978)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 985>** ([line 985](../../../apps/web/src/pages/billing.tsx#L985)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 985>** ([line 985](../../../apps/web/src/pages/billing.tsx#L985)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1023>** ([line 1023](../../../apps/web/src/pages/billing.tsx#L1023)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1023>** ([line 1023](../../../apps/web/src/pages/billing.tsx#L1023)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1094>** ([line 1094](../../../apps/web/src/pages/billing.tsx#L1094)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1094>** ([line 1094](../../../apps/web/src/pages/billing.tsx#L1094)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1129>** ([line 1129](../../../apps/web/src/pages/billing.tsx#L1129)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1129>** ([line 1129](../../../apps/web/src/pages/billing.tsx#L1129)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1227>** ([line 1227](../../../apps/web/src/pages/billing.tsx#L1227)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1227>** ([line 1227](../../../apps/web/src/pages/billing.tsx#L1227)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1294>** ([line 1294](../../../apps/web/src/pages/billing.tsx#L1294)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1294>** ([line 1294](../../../apps/web/src/pages/billing.tsx#L1294)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1329>** ([line 1329](../../../apps/web/src/pages/billing.tsx#L1329)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1329>** ([line 1329](../../../apps/web/src/pages/billing.tsx#L1329)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1440>** ([line 1440](../../../apps/web/src/pages/billing.tsx#L1440)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1440>** ([line 1440](../../../apps/web/src/pages/billing.tsx#L1440)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1544>** ([line 1544](../../../apps/web/src/pages/billing.tsx#L1544)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1544>** ([line 1544](../../../apps/web/src/pages/billing.tsx#L1544)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **+ Item** ([line 1623](../../../apps/web/src/pages/billing.tsx#L1623)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **+ Item** ([line 1623](../../../apps/web/src/pages/billing.tsx#L1623)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1627>** ([line 1627](../../../apps/web/src/pages/billing.tsx#L1627)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1627>** ([line 1627](../../../apps/web/src/pages/billing.tsx#L1627)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1730>** ([line 1730](../../../apps/web/src/pages/billing.tsx#L1730)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1730>** ([line 1730](../../../apps/web/src/pages/billing.tsx#L1730)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **+ Override** ([line 1789](../../../apps/web/src/pages/billing.tsx#L1789)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **+ Override** ([line 1789](../../../apps/web/src/pages/billing.tsx#L1789)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1793>** ([line 1793](../../../apps/web/src/pages/billing.tsx#L1793)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1793>** ([line 1793](../../../apps/web/src/pages/billing.tsx#L1793)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2007>** ([line 2007](../../../apps/web/src/pages/billing.tsx#L2007)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2007>** ([line 2007](../../../apps/web/src/pages/billing.tsx#L2007)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2026>** ([line 2026](../../../apps/web/src/pages/billing.tsx#L2026)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2026>** ([line 2026](../../../apps/web/src/pages/billing.tsx#L2026)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2062>** ([line 2062](../../../apps/web/src/pages/billing.tsx#L2062)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2062>** ([line 2062](../../../apps/web/src/pages/billing.tsx#L2062)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2080>** ([line 2080](../../../apps/web/src/pages/billing.tsx#L2080)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2080>** ([line 2080](../../../apps/web/src/pages/billing.tsx#L2080)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2108>** ([line 2108](../../../apps/web/src/pages/billing.tsx#L2108)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2108>** ([line 2108](../../../apps/web/src/pages/billing.tsx#L2108)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2126>** ([line 2126](../../../apps/web/src/pages/billing.tsx#L2126)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2126>** ([line 2126](../../../apps/web/src/pages/billing.tsx#L2126)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2162>** ([line 2162](../../../apps/web/src/pages/billing.tsx#L2162)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2162>** ([line 2162](../../../apps/web/src/pages/billing.tsx#L2162)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2351>** ([line 2351](../../../apps/web/src/pages/billing.tsx#L2351)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2351>** ([line 2351](../../../apps/web/src/pages/billing.tsx#L2351)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2366>** ([line 2366](../../../apps/web/src/pages/billing.tsx#L2366)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2366>** ([line 2366](../../../apps/web/src/pages/billing.tsx#L2366)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2471>** ([line 2471](../../../apps/web/src/pages/billing.tsx#L2471)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2471>** ([line 2471](../../../apps/web/src/pages/billing.tsx#L2471)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2501>** ([line 2501](../../../apps/web/src/pages/billing.tsx#L2501)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2501>** ([line 2501](../../../apps/web/src/pages/billing.tsx#L2501)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2555>** ([line 2555](../../../apps/web/src/pages/billing.tsx#L2555)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2555>** ([line 2555](../../../apps/web/src/pages/billing.tsx#L2555)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setAdjustId(row.id)}>                 Adjust** ([line 3024](../../../apps/web/src/pages/billing.tsx#L3024)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setAdjustId(row.id)}>                 Adjust** ([line 3024](../../../apps/web/src/pages/billing.tsx#L3024)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setRefundId(row.id)}               >                 Refund** ([line 3029](../../../apps/web/src/pages/billing.tsx#L3029)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setRefundId(row.id)}               >                 Refund** ([line 3029](../../../apps/web/src/pages/billing.tsx#L3029)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3048>** ([line 3048](../../../apps/web/src/pages/billing.tsx#L3048)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3048>** ([line 3048](../../../apps/web/src/pages/billing.tsx#L3048)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3110>** ([line 3110](../../../apps/web/src/pages/billing.tsx#L3110)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3110>** ([line 3110](../../../apps/web/src/pages/billing.tsx#L3110)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3148>** ([line 3148](../../../apps/web/src/pages/billing.tsx#L3148)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3148>** ([line 3148](../../../apps/web/src/pages/billing.tsx#L3148)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3192>** ([line 3192](../../../apps/web/src/pages/billing.tsx#L3192)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3192>** ([line 3192](../../../apps/web/src/pages/billing.tsx#L3192)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3307>** ([line 3307](../../../apps/web/src/pages/billing.tsx#L3307)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3307>** ([line 3307](../../../apps/web/src/pages/billing.tsx#L3307)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3376>** ([line 3376](../../../apps/web/src/pages/billing.tsx#L3376)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3376>** ([line 3376](../../../apps/web/src/pages/billing.tsx#L3376)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3473>** ([line 3473](../../../apps/web/src/pages/billing.tsx#L3473)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3473>** ([line 3473](../../../apps/web/src/pages/billing.tsx#L3473)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3504>** ([line 3504](../../../apps/web/src/pages/billing.tsx#L3504)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3504>** ([line 3504](../../../apps/web/src/pages/billing.tsx#L3504)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3554>** ([line 3554](../../../apps/web/src/pages/billing.tsx#L3554)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3554>** ([line 3554](../../../apps/web/src/pages/billing.tsx#L3554)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3581>** ([line 3581](../../../apps/web/src/pages/billing.tsx#L3581)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3581>** ([line 3581](../../../apps/web/src/pages/billing.tsx#L3581)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4142>** ([line 4142](../../../apps/web/src/pages/billing.tsx#L4142)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4142>** ([line 4142](../../../apps/web/src/pages/billing.tsx#L4142)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4157>** ([line 4157](../../../apps/web/src/pages/billing.tsx#L4157)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4157>** ([line 4157](../../../apps/web/src/pages/billing.tsx#L4157)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4181>** ([line 4181](../../../apps/web/src/pages/billing.tsx#L4181)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4181>** ([line 4181](../../../apps/web/src/pages/billing.tsx#L4181)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4518>** ([line 4518](../../../apps/web/src/pages/billing.tsx#L4518)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4518>** ([line 4518](../../../apps/web/src/pages/billing.tsx#L4518)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4523>** ([line 4523](../../../apps/web/src/pages/billing.tsx#L4523)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4523>** ([line 4523](../../../apps/web/src/pages/billing.tsx#L4523)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4601>** ([line 4601](../../../apps/web/src/pages/billing.tsx#L4601)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4601>** ([line 4601](../../../apps/web/src/pages/billing.tsx#L4601)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **fileMut.mutate(r.id)}>                   File** ([line 4740](../../../apps/web/src/pages/billing.tsx#L4740)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **fileMut.mutate(r.id)}>                   File** ([line 4740](../../../apps/web/src/pages/billing.tsx#L4740)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4756>** ([line 4756](../../../apps/web/src/pages/billing.tsx#L4756)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4756>** ([line 4756](../../../apps/web/src/pages/billing.tsx#L4756)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4791>** ([line 4791](../../../apps/web/src/pages/billing.tsx#L4791)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4791>** ([line 4791](../../../apps/web/src/pages/billing.tsx#L4791)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 4963>** ([line 4963](../../../apps/web/src/pages/billing.tsx#L4963)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 4963>** ([line 4963](../../../apps/web/src/pages/billing.tsx#L4963)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5051>** ([line 5051](../../../apps/web/src/pages/billing.tsx#L5051)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5051>** ([line 5051](../../../apps/web/src/pages/billing.tsx#L5051)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5346>** ([line 5346](../../../apps/web/src/pages/billing.tsx#L5346)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5346>** ([line 5346](../../../apps/web/src/pages/billing.tsx#L5346)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Add Line** ([line 5384](../../../apps/web/src/pages/billing.tsx#L5384)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Add Line** ([line 5384](../../../apps/web/src/pages/billing.tsx#L5384)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5437>** ([line 5437](../../../apps/web/src/pages/billing.tsx#L5437)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5437>** ([line 5437](../../../apps/web/src/pages/billing.tsx#L5437)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5635>** ([line 5635](../../../apps/web/src/pages/billing.tsx#L5635)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5635>** ([line 5635](../../../apps/web/src/pages/billing.tsx#L5635)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5643>** ([line 5643](../../../apps/web/src/pages/billing.tsx#L5643)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5643>** ([line 5643](../../../apps/web/src/pages/billing.tsx#L5643)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5652>** ([line 5652](../../../apps/web/src/pages/billing.tsx#L5652)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5652>** ([line 5652](../../../apps/web/src/pages/billing.tsx#L5652)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Add to Batch** ([line 5768](../../../apps/web/src/pages/billing.tsx#L5768)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Add to Batch** ([line 5768](../../../apps/web/src/pages/billing.tsx#L5768)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 5778>** ([line 5778](../../../apps/web/src/pages/billing.tsx#L5778)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 5778>** ([line 5778](../../../apps/web/src/pages/billing.tsx#L5778)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 6089>** ([line 6089](../../../apps/web/src/pages/billing.tsx#L6089)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 6089>** ([line 6089](../../../apps/web/src/pages/billing.tsx#L6089)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 6320>** ([line 6320](../../../apps/web/src/pages/billing.tsx#L6320)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 6320>** ([line 6320](../../../apps/web/src/pages/billing.tsx#L6320)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 320>** ([line 320](../../../apps/web/src/pages/billing.tsx#L320)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 332>** ([line 332](../../../apps/web/src/pages/billing.tsx#L332)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 855>** ([line 855](../../../apps/web/src/pages/billing.tsx#L855)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 961>** ([line 961](../../../apps/web/src/pages/billing.tsx#L961)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1072>** ([line 1072](../../../apps/web/src/pages/billing.tsx#L1072)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1216>** ([line 1216](../../../apps/web/src/pages/billing.tsx#L1216)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1533>** ([line 1533](../../../apps/web/src/pages/billing.tsx#L1533)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1719>** ([line 1719](../../../apps/web/src/pages/billing.tsx#L1719)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1916>** ([line 1916](../../../apps/web/src/pages/billing.tsx#L1916)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1928>** ([line 1928](../../../apps/web/src/pages/billing.tsx#L1928)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2280>** ([line 2280](../../../apps/web/src/pages/billing.tsx#L2280)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 3289>** ([line 3289](../../../apps/web/src/pages/billing.tsx#L3289)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 3538>** ([line 3538](../../../apps/web/src/pages/billing.tsx#L3538)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 4422>** ([line 4422](../../../apps/web/src/pages/billing.tsx#L4422)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 4931>** ([line 4931](../../../apps/web/src/pages/billing.tsx#L4931)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 4942>** ([line 4942](../../../apps/web/src/pages/billing.tsx#L4942)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 5307>** ([line 5307](../../../apps/web/src/pages/billing.tsx#L5307)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 5318>** ([line 5318](../../../apps/web/src/pages/billing.tsx#L5318)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 5419>** ([line 5419](../../../apps/web/src/pages/billing.tsx#L5419)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 6249>** ([line 6249](../../../apps/web/src/pages/billing.tsx#L6249)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 6254>** ([line 6254](../../../apps/web/src/pages/billing.tsx#L6254)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (96)

- [ ] `api.addDiscount` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.addInvoiceItem` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adjustAdvance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.applyCreditNote` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.approveConcession` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.approveWriteOff` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.autoMatchBankTransactions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.autoReconcile` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.billingReportAging` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.billingReportCollectionEfficiency` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.billingReportDaily` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.billingReportDepartmentRevenue` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.billingReportDoctorRevenue` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.billingReportInsurancePanel` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.billingReportReconciliation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.billingReportSummary` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.calculateCopay` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.cancelInvoice` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.cloneInvoice` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAdvance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createChargeMaster` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCorporate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCorporateEnrollment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCreditNote` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCreditPatient` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createDayClose` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createInsuranceClaim` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createInvoice` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createJournalEntry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPackage` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRatePlan` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRefund` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createTdsDeduction` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createTpaRateCard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createWriteOff` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteChargeMaster` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteCorporateEnrollment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deletePackage` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteRatePlan` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteTpaRateCard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] _… 56 more methods_

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._