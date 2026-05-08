# `quality.tsx` walkthrough

_Source: [`apps/web/src/pages/quality.tsx`](../../../apps/web/src/pages/quality.tsx) (3848 lines). Guard: `P.QUALITY.INDICATORS_LIST`. API methods: 38. useForm: 0. Tables: 19. Modals: 17._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.QUALITY.INDICATORS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Indicators** (`indicators`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Indicators** (`indicators`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Indicators** (`indicators`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Documents** (`documents`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Documents** (`documents`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Documents** (`documents`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Incidents** (`incidents`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Incidents** (`incidents`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Incidents** (`incidents`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Committees** (`committees`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Committees** (`committees`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Committees** (`committees`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Accreditation** (`accreditation`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Accreditation** (`accreditation`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Accreditation** (`accreditation`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Audits** (`audits`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Audits** (`audits`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Audits** (`audits`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Analytics & Reviews** (`analytics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Analytics & Reviews** (`analytics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Analytics & Reviews** (`analytics`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### `<Table>` @ line 417
  - [ ] Header **Indicator** column shows correct value for at least one row
  - [ ] Header **Current Value** column shows correct value for at least one row
  - [ ] Header **Target Value** column shows correct value for at least one row
  - [ ] Header **Variance** column shows correct value for at least one row
  - [ ] Header **Progress** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 436
  - [ ] Header **Indicator** column shows correct value for at least one row
  - [ ] Header **Current Value** column shows correct value for at least one row
  - [ ] Header **Target Value** column shows correct value for at least one row
  - [ ] Header **Variance** column shows correct value for at least one row
  - [ ] Header **Progress** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 959
  - [ ] Header **User ID** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1044
  - [ ] Header **User ID** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Version** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Created** column shows correct value for at least one row
  - [ ] Header **Changes** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1082
  - [ ] Header **Version** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Created** column shows correct value for at least one row
  - [ ] Header **Changes** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 1560
  - [ ] Header **CAPA #** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Due** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2125
  - [ ] Header **Meeting #** column shows correct value for at least one row
  - [ ] Header **Scheduled** column shows correct value for at least one row
  - [ ] Header **Actual** column shows correct value for at least one row
  - [ ] Header **Venue** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Source** column shows correct value for at least one row
  - [ ] Header **Description** column shows correct value for at least one row
  - [ ] Header **Due Date** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2140
  - [ ] Header **Meeting #** column shows correct value for at least one row
  - [ ] Header **Scheduled** column shows correct value for at least one row
  - [ ] Header **Actual** column shows correct value for at least one row
  - [ ] Header **Venue** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Source** column shows correct value for at least one row
  - [ ] Header **Description** column shows correct value for at least one row
  - [ ] Header **Due Date** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2180
  - [ ] Header **Source** column shows correct value for at least one row
  - [ ] Header **Description** column shows correct value for at least one row
  - [ ] Header **Due Date** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 2863
  - [ ] Header **#** column shows correct value for at least one row
  - [ ] Header **Details** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

_… 9 more tables — list capped to keep checklist usable_
## Modals / Drawers

### Modal — _<modal @ line 1026>_ @ [line 1026](../../../apps/web/src/pages/quality.tsx#L1026)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 1064>_ @ [line 1064](../../../apps/web/src/pages/quality.tsx#L1064)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 2803>_ @ [line 2803](../../../apps/web/src/pages/quality.tsx#L2803)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _New Quality Indicator_ @ [line 556](../../../apps/web/src/pages/quality.tsx#L556)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 666>_ @ [line 666](../../../apps/web/src/pages/quality.tsx#L666)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Controlled Document_ @ [line 972](../../../apps/web/src/pages/quality.tsx#L972)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Report Incident_ @ [line 1381](../../../apps/web/src/pages/quality.tsx#L1381)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 1482>_ @ [line 1482](../../../apps/web/src/pages/quality.tsx#L1482)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Mortality Review_ @ [line 1788](../../../apps/web/src/pages/quality.tsx#L1788)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Committee_ @ [line 2216](../../../apps/web/src/pages/quality.tsx#L2216)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 2328>_ @ [line 2328](../../../apps/web/src/pages/quality.tsx#L2328)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Accreditation Standard_ @ [line 2660](../../../apps/web/src/pages/quality.tsx#L2660)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 2720>_ @ [line 2720](../../../apps/web/src/pages/quality.tsx#L2720)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 3101>_ @ [line 3101](../../../apps/web/src/pages/quality.tsx#L3101)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 3145>_ @ [line 3145](../../../apps/web/src/pages/quality.tsx#L3145)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Schedule Audits_ @ [line 3297](../../../apps/web/src/pages/quality.tsx#L3297)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 3347>_ @ [line 3347](../../../apps/web/src/pages/quality.tsx#L3347)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (88)

- [ ] **<Select @ line 396>** (`Select`, [line 396](../../../apps/web/src/pages/quality.tsx#L396)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 564](../../../apps/web/src/pages/quality.tsx#L564)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 570](../../../apps/web/src/pages/quality.tsx#L570)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 576](../../../apps/web/src/pages/quality.tsx#L576)) — accepts input, default value sensible, persists after refresh
- [ ] **Sub-Category** (`Select`, [line 584](../../../apps/web/src/pages/quality.tsx#L584)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 592](../../../apps/web/src/pages/quality.tsx#L592)) — accepts input, default value sensible, persists after refresh
- [ ] **Numerator Description** (`TextInput`, [line 597](../../../apps/web/src/pages/quality.tsx#L597)) — accepts input, default value sensible, persists after refresh
- [ ] **Denominator Description** (`TextInput`, [line 604](../../../apps/web/src/pages/quality.tsx#L604)) — accepts input, default value sensible, persists after refresh
- [ ] **Unit** (`TextInput`, [line 611](../../../apps/web/src/pages/quality.tsx#L611)) — accepts input, default value sensible, persists after refresh
- [ ] **Frequency** (`Select`, [line 616](../../../apps/web/src/pages/quality.tsx#L616)) — accepts input, default value sensible, persists after refresh
- [ ] **Target Value** (`NumberInput`, [line 633](../../../apps/web/src/pages/quality.tsx#L633)) — accepts input, default value sensible, persists after refresh
- [ ] **Warning Threshold** (`NumberInput`, [line 639](../../../apps/web/src/pages/quality.tsx#L639)) — accepts input, default value sensible, persists after refresh
- [ ] **Critical Threshold** (`NumberInput`, [line 647](../../../apps/web/src/pages/quality.tsx#L647)) — accepts input, default value sensible, persists after refresh
- [ ] **Auto-calculated** (`Switch`, [line 655](../../../apps/web/src/pages/quality.tsx#L655)) — accepts input, default value sensible, persists after refresh
- [ ] **Period Start** (`TextInput`, [line 674](../../../apps/web/src/pages/quality.tsx#L674)) — accepts input, default value sensible, persists after refresh
- [ ] **Period End** (`TextInput`, [line 681](../../../apps/web/src/pages/quality.tsx#L681)) — accepts input, default value sensible, persists after refresh
- [ ] **Numerator** (`NumberInput`, [line 688](../../../apps/web/src/pages/quality.tsx#L688)) — accepts input, default value sensible, persists after refresh
- [ ] **Denominator** (`NumberInput`, [line 696](../../../apps/web/src/pages/quality.tsx#L696)) — accepts input, default value sensible, persists after refresh
- [ ] **Calculated Value** (`NumberInput`, [line 704](../../../apps/web/src/pages/quality.tsx#L704)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 712](../../../apps/web/src/pages/quality.tsx#L712)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 917>** (`Select`, [line 917](../../../apps/web/src/pages/quality.tsx#L917)) — accepts input, default value sensible, persists after refresh
- [ ] **Training Required Only** (`Select`, [line 925](../../../apps/web/src/pages/quality.tsx#L925)) — accepts input, default value sensible, persists after refresh
- [ ] **Training Required Only** (`Switch`, [line 933](../../../apps/web/src/pages/quality.tsx#L933)) — accepts input, default value sensible, persists after refresh
- [ ] **Document Number** (`TextInput`, [line 980](../../../apps/web/src/pages/quality.tsx#L980)) — accepts input, default value sensible, persists after refresh
- [ ] **Title** (`TextInput`, [line 986](../../../apps/web/src/pages/quality.tsx#L986)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 992](../../../apps/web/src/pages/quality.tsx#L992)) — accepts input, default value sensible, persists after refresh
- [ ] **Content** (`Textarea`, [line 999](../../../apps/web/src/pages/quality.tsx#L999)) — accepts input, default value sensible, persists after refresh
- [ ] **Summary** (`Textarea`, [line 1005](../../../apps/web/src/pages/quality.tsx#L1005)) — accepts input, default value sensible, persists after refresh
- [ ] **Reviewer ID** (`TextInput`, [line 1010](../../../apps/web/src/pages/quality.tsx#L1010)) — accepts input, default value sensible, persists after refresh
- [ ] **Training Required** (`Checkbox`, [line 1015](../../../apps/web/src/pages/quality.tsx#L1015)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1318>** (`Select`, [line 1318](../../../apps/web/src/pages/quality.tsx#L1318)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 1335>** (`Select`, [line 1335](../../../apps/web/src/pages/quality.tsx#L1335)) — accepts input, default value sensible, persists after refresh
- [ ] **Title** (`TextInput`, [line 1389](../../../apps/web/src/pages/quality.tsx#L1389)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 1395](../../../apps/web/src/pages/quality.tsx#L1395)) — accepts input, default value sensible, persists after refresh
- [ ] **Incident Type** (`Select`, [line 1400](../../../apps/web/src/pages/quality.tsx#L1400)) — accepts input, default value sensible, persists after refresh
- [ ] **Severity** (`Select`, [line 1427](../../../apps/web/src/pages/quality.tsx#L1427)) — accepts input, default value sensible, persists after refresh
- [ ] **Location** (`TextInput`, [line 1446](../../../apps/web/src/pages/quality.tsx#L1446)) — accepts input, default value sensible, persists after refresh
- [ ] **Incident Date** (`TextInput`, [line 1451](../../../apps/web/src/pages/quality.tsx#L1451)) — accepts input, default value sensible, persists after refresh
- [ ] **Immediate Action Taken** (`Textarea`, [line 1463](../../../apps/web/src/pages/quality.tsx#L1463)) — accepts input, default value sensible, persists after refresh
- [ ] **Report Anonymously** (`Switch`, [line 1470](../../../apps/web/src/pages/quality.tsx#L1470)) — accepts input, default value sensible, persists after refresh
- [ ] **Root Cause** (`Textarea`, [line 1529](../../../apps/web/src/pages/quality.tsx#L1529)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 1739](../../../apps/web/src/pages/quality.tsx#L1739)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 1745](../../../apps/web/src/pages/quality.tsx#L1745)) — accepts input, default value sensible, persists after refresh
- [ ] **Action Plan** (`Textarea`, [line 1752](../../../apps/web/src/pages/quality.tsx#L1752)) — accepts input, default value sensible, persists after refresh
- [ ] **Assigned To (User ID)** (`TextInput`, [line 1759](../../../apps/web/src/pages/quality.tsx#L1759)) — accepts input, default value sensible, persists after refresh
- [ ] **Due Date** (`TextInput`, [line 1765](../../../apps/web/src/pages/quality.tsx#L1765)) — accepts input, default value sensible, persists after refresh
- [ ] **Death Date** (`TextInput`, [line 1801](../../../apps/web/src/pages/quality.tsx#L1801)) — accepts input, default value sensible, persists after refresh
- [ ] **Primary Diagnosis** (`TextInput`, [line 1810](../../../apps/web/src/pages/quality.tsx#L1810)) — accepts input, default value sensible, persists after refresh
- [ ] **Review Findings** (`Textarea`, [line 1818](../../../apps/web/src/pages/quality.tsx#L1818)) — accepts input, default value sensible, persists after refresh
- [ ] **Preventability** (`Select`, [line 1828](../../../apps/web/src/pages/quality.tsx#L1828)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 2224](../../../apps/web/src/pages/quality.tsx#L2224)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 2230](../../../apps/web/src/pages/quality.tsx#L2230)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 2236](../../../apps/web/src/pages/quality.tsx#L2236)) — accepts input, default value sensible, persists after refresh
- [ ] **Committee Type** (`Select`, [line 2246](../../../apps/web/src/pages/quality.tsx#L2246)) — accepts input, default value sensible, persists after refresh
- [ ] **Chairperson ID** (`TextInput`, [line 2262](../../../apps/web/src/pages/quality.tsx#L2262)) — accepts input, default value sensible, persists after refresh
- [ ] **Secretary ID** (`TextInput`, [line 2272](../../../apps/web/src/pages/quality.tsx#L2272)) — accepts input, default value sensible, persists after refresh
- [ ] **Meeting Frequency** (`Select`, [line 2282](../../../apps/web/src/pages/quality.tsx#L2282)) — accepts input, default value sensible, persists after refresh
- [ ] **Charter** (`Textarea`, [line 2304](../../../apps/web/src/pages/quality.tsx#L2304)) — accepts input, default value sensible, persists after refresh
- [ ] **Mandatory Committee** (`Checkbox`, [line 2311](../../../apps/web/src/pages/quality.tsx#L2311)) — accepts input, default value sensible, persists after refresh
- [ ] **Scheduled Date** (`TextInput`, [line 2336](../../../apps/web/src/pages/quality.tsx#L2336)) — accepts input, default value sensible, persists after refresh
- [ ] **Venue** (`TextInput`, [line 2345](../../../apps/web/src/pages/quality.tsx#L2345)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 2610>** (`Select`, [line 2610](../../../apps/web/src/pages/quality.tsx#L2610)) — accepts input, default value sensible, persists after refresh
- [ ] **Accreditation Body** (`Select`, [line 2668](../../../apps/web/src/pages/quality.tsx#L2668)) — accepts input, default value sensible, persists after refresh
- [ ] **Standard Code** (`TextInput`, [line 2680](../../../apps/web/src/pages/quality.tsx#L2680)) — accepts input, default value sensible, persists after refresh
- [ ] **Standard Name** (`TextInput`, [line 2688](../../../apps/web/src/pages/quality.tsx#L2688)) — accepts input, default value sensible, persists after refresh
- [ ] **Chapter** (`TextInput`, [line 2696](../../../apps/web/src/pages/quality.tsx#L2696)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 2703](../../../apps/web/src/pages/quality.tsx#L2703)) — accepts input, default value sensible, persists after refresh
- [ ] **Compliance Status** (`Select`, [line 2728](../../../apps/web/src/pages/quality.tsx#L2728)) — accepts input, default value sensible, persists after refresh
- [ ] **Evidence Summary** (`Textarea`, [line 2742](../../../apps/web/src/pages/quality.tsx#L2742)) — accepts input, default value sensible, persists after refresh
- [ ] **Gap Description** (`Textarea`, [line 2752](../../../apps/web/src/pages/quality.tsx#L2752)) — accepts input, default value sensible, persists after refresh
- [ ] **Action Plan** (`Textarea`, [line 2762](../../../apps/web/src/pages/quality.tsx#L2762)) — accepts input, default value sensible, persists after refresh
- [ ] **Responsible Person ID** (`TextInput`, [line 2772](../../../apps/web/src/pages/quality.tsx#L2772)) — accepts input, default value sensible, persists after refresh
- [ ] **Target Date** (`TextInput`, [line 2782](../../../apps/web/src/pages/quality.tsx#L2782)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 3055>** (`Select`, [line 3055](../../../apps/web/src/pages/quality.tsx#L3055)) — accepts input, default value sensible, persists after refresh
- [ ] **Title** (`TextInput`, [line 3109](../../../apps/web/src/pages/quality.tsx#L3109)) — accepts input, default value sensible, persists after refresh
- [ ] **Audit Type** (`Select`, [line 3115](../../../apps/web/src/pages/quality.tsx#L3115)) — accepts input, default value sensible, persists after refresh
- [ ] **Scope** (`Textarea`, [line 3122](../../../apps/web/src/pages/quality.tsx#L3122)) — accepts input, default value sensible, persists after refresh
- [ ] **Audit Date** (`TextInput`, [line 3131](../../../apps/web/src/pages/quality.tsx#L3131)) — accepts input, default value sensible, persists after refresh
- [ ] **Departments** (`MultiSelect`, [line 3305](../../../apps/web/src/pages/quality.tsx#L3305)) — accepts input, default value sensible, persists after refresh
- [ ] **Frequency** (`Select`, [line 3314](../../../apps/web/src/pages/quality.tsx#L3314)) — accepts input, default value sensible, persists after refresh
- [ ] **Start Date** (`TextInput`, [line 3321](../../../apps/web/src/pages/quality.tsx#L3321)) — accepts input, default value sensible, persists after refresh
- [ ] **End Date** (`TextInput`, [line 3330](../../../apps/web/src/pages/quality.tsx#L3330)) — accepts input, default value sensible, persists after refresh
- [ ] **Finding Type** (`Select`, [line 3355](../../../apps/web/src/pages/quality.tsx#L3355)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 3364](../../../apps/web/src/pages/quality.tsx#L3364)) — accepts input, default value sensible, persists after refresh
- [ ] **Severity** (`Select`, [line 3371](../../../apps/web/src/pages/quality.tsx#L3371)) — accepts input, default value sensible, persists after refresh
- [ ] **Recommendation** (`Textarea`, [line 3378](../../../apps/web/src/pages/quality.tsx#L3378)) — accepts input, default value sensible, persists after refresh
- [ ] **<DateInput @ line 3647>** (`DateInput`, [line 3647](../../../apps/web/src/pages/quality.tsx#L3647)) — accepts input, default value sensible, persists after refresh
- [ ] **<DateInput @ line 3654>** (`DateInput`, [line 3654](../../../apps/web/src/pages/quality.tsx#L3654)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 31, `<ActionIcon>`: 12, `<Menu.Item>`: 0)

- [ ] **<button @ line 410>** ([line 410](../../../apps/web/src/pages/quality.tsx#L410)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 410>** ([line 410](../../../apps/web/src/pages/quality.tsx#L410)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 505>** ([line 505](../../../apps/web/src/pages/quality.tsx#L505)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 505>** ([line 505](../../../apps/web/src/pages/quality.tsx#L505)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>             Save** ([line 660](../../../apps/web/src/pages/quality.tsx#L660)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>             Save** ([line 660](../../../apps/web/src/pages/quality.tsx#L660)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **recordMut.mutate()}>             Record** ([line 717](../../../apps/web/src/pages/quality.tsx#L717)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **recordMut.mutate()}>             Record** ([line 717](../../../apps/web/src/pages/quality.tsx#L717)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 856>** ([line 856](../../../apps/web/src/pages/quality.tsx#L856)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 856>** ([line 856](../../../apps/web/src/pages/quality.tsx#L856)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 944>** ([line 944](../../../apps/web/src/pages/quality.tsx#L944)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 944>** ([line 944](../../../apps/web/src/pages/quality.tsx#L944)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 952>** ([line 952](../../../apps/web/src/pages/quality.tsx#L952)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 952>** ([line 952](../../../apps/web/src/pages/quality.tsx#L952)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>             Save** ([line 1020](../../../apps/web/src/pages/quality.tsx#L1020)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>             Save** ([line 1020](../../../apps/web/src/pages/quality.tsx#L1020)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1349>** ([line 1349](../../../apps/web/src/pages/quality.tsx#L1349)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1349>** ([line 1349](../../../apps/web/src/pages/quality.tsx#L1349)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1357>** ([line 1357](../../../apps/web/src/pages/quality.tsx#L1357)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1357>** ([line 1357](../../../apps/web/src/pages/quality.tsx#L1357)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1365>** ([line 1365](../../../apps/web/src/pages/quality.tsx#L1365)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1365>** ([line 1365](../../../apps/web/src/pages/quality.tsx#L1365)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>             Submit Report** ([line 1475](../../../apps/web/src/pages/quality.tsx#L1475)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>             Submit Report** ([line 1475](../../../apps/web/src/pages/quality.tsx#L1475)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1539>** ([line 1539](../../../apps/web/src/pages/quality.tsx#L1539)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1539>** ([line 1539](../../../apps/web/src/pages/quality.tsx#L1539)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1616>** ([line 1616](../../../apps/web/src/pages/quality.tsx#L1616)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1616>** ([line 1616](../../../apps/web/src/pages/quality.tsx#L1616)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1772>** ([line 1772](../../../apps/web/src/pages/quality.tsx#L1772)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1772>** ([line 1772](../../../apps/web/src/pages/quality.tsx#L1772)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1840>** ([line 1840](../../../apps/web/src/pages/quality.tsx#L1840)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1840>** ([line 1840](../../../apps/web/src/pages/quality.tsx#L1840)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2063>** ([line 2063](../../../apps/web/src/pages/quality.tsx#L2063)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2063>** ([line 2063](../../../apps/web/src/pages/quality.tsx#L2063)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2073>** ([line 2073](../../../apps/web/src/pages/quality.tsx#L2073)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2073>** ([line 2073](../../../apps/web/src/pages/quality.tsx#L2073)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2318>** ([line 2318](../../../apps/web/src/pages/quality.tsx#L2318)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2318>** ([line 2318](../../../apps/web/src/pages/quality.tsx#L2318)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2352>** ([line 2352](../../../apps/web/src/pages/quality.tsx#L2352)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2352>** ([line 2352](../../../apps/web/src/pages/quality.tsx#L2352)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2633>** ([line 2633](../../../apps/web/src/pages/quality.tsx#L2633)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2633>** ([line 2633](../../../apps/web/src/pages/quality.tsx#L2633)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2638>** ([line 2638](../../../apps/web/src/pages/quality.tsx#L2638)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2638>** ([line 2638](../../../apps/web/src/pages/quality.tsx#L2638)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2710>** ([line 2710](../../../apps/web/src/pages/quality.tsx#L2710)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2710>** ([line 2710](../../../apps/web/src/pages/quality.tsx#L2710)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 2793>** ([line 2793](../../../apps/web/src/pages/quality.tsx#L2793)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 2793>** ([line 2793](../../../apps/web/src/pages/quality.tsx#L2793)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3069>** ([line 3069](../../../apps/web/src/pages/quality.tsx#L3069)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3069>** ([line 3069](../../../apps/web/src/pages/quality.tsx#L3069)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3077>** ([line 3077](../../../apps/web/src/pages/quality.tsx#L3077)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3077>** ([line 3077](../../../apps/web/src/pages/quality.tsx#L3077)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3085>** ([line 3085](../../../apps/web/src/pages/quality.tsx#L3085)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3085>** ([line 3085](../../../apps/web/src/pages/quality.tsx#L3085)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **createMut.mutate(form)}>             Save** ([line 3138](../../../apps/web/src/pages/quality.tsx#L3138)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **createMut.mutate(form)}>             Save** ([line 3138](../../../apps/web/src/pages/quality.tsx#L3138)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3227>** ([line 3227](../../../apps/web/src/pages/quality.tsx#L3227)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3227>** ([line 3227](../../../apps/web/src/pages/quality.tsx#L3227)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3337>** ([line 3337](../../../apps/web/src/pages/quality.tsx#L3337)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3337>** ([line 3337](../../../apps/web/src/pages/quality.tsx#L3337)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 3385>** ([line 3385](../../../apps/web/src/pages/quality.tsx#L3385)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 3385>** ([line 3385](../../../apps/web/src/pages/quality.tsx#L3385)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 341>** ([line 341](../../../apps/web/src/pages/quality.tsx#L341)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 352>** ([line 352](../../../apps/web/src/pages/quality.tsx#L352)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 365>** ([line 365](../../../apps/web/src/pages/quality.tsx#L365)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 870>** ([line 870](../../../apps/web/src/pages/quality.tsx#L870)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 894>** ([line 894](../../../apps/web/src/pages/quality.tsx#L894)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1297>** ([line 1297](../../../apps/web/src/pages/quality.tsx#L1297)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1594>** ([line 1594](../../../apps/web/src/pages/quality.tsx#L1594)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2011>** ([line 2011](../../../apps/web/src/pages/quality.tsx#L2011)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2024>** ([line 2024](../../../apps/web/src/pages/quality.tsx#L2024)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2040>** ([line 2040](../../../apps/web/src/pages/quality.tsx#L2040)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 2526>** ([line 2526](../../../apps/web/src/pages/quality.tsx#L2526)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 3034>** ([line 3034](../../../apps/web/src/pages/quality.tsx#L3034)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (38)

- [ ] `api.acknowledgeDocument` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.autoScheduleMeetings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.calculateIndicator` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.committeeDashboard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.compileEvidence` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAccreditationStandard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAuditFinding` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCapa` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createCommitteeMeeting` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createMortalityReview` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createQualityAudit` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createQualityCommittee` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createQualityDocument` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createQualityIncident` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createQualityIndicator` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.departmentScorecard` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAccreditationCompliance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAccreditationStandards` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listActionItems` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAuditFindings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCapa` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCommitteeMeetings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDepartments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIndicatorValues` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listOverdueCapas` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPendingAcks` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listQualityAudits` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listQualityCommittees` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listQualityDocuments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listQualityIncidents` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listQualityIndicators` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSentinelEvents` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.patientSafetyIndicators` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.recordIndicatorValue` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.scheduleAudits` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateAccreditationCompliance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateDocumentStatus` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateQualityIncident` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._