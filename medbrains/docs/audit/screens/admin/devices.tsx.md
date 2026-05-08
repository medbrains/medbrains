# `admin/devices.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/devices.tsx`](../../../apps/web/src/pages/admin/devices.tsx) (816 lines). Guard: `"devices.list"`. API methods: 9. useForm: 0. Tables: 3. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `"devices.list"` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Connected Devices** (`devices`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Connected Devices** (`devices`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Connected Devices** (`devices`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Adapter Catalog** (`catalog`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Adapter Catalog** (`catalog`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Adapter Catalog** (`catalog`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Routing Rules** (`routing`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Routing Rules** (`routing`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Routing Rules** (`routing`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Bridge Agents** (`agents`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Bridge Agents** (`agents`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Bridge Agents** (`agents`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### `<Table>` @ line 126
  - [ ] Header **Device** column shows correct value for at least one row
  - [ ] Header **Adapter** column shows correct value for at least one row
  - [ ] Header **Protocol** column shows correct value for at least one row
  - [ ] Header **Host** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Messages (24h)** column shows correct value for at least one row
  - [ ] Header **AI Confidence** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 361
  - [ ] Header **Agent** column shows correct value for at least one row
  - [ ] Header **Mode** column shows correct value for at least one row
  - [ ] Header **Capabilities** column shows correct value for at least one row
  - [ ] Header **Devices** column shows correct value for at least one row
  - [ ] Header **Buffer** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Last Heartbeat** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 477
  - [ ] Header **Rule** column shows correct value for at least one row
  - [ ] Header **Adapter** column shows correct value for at least one row
  - [ ] Header **Target** column shows correct value for at least one row
  - [ ] Header **Match** column shows correct value for at least one row
  - [ ] Header **Field** column shows correct value for at least one row
  - [ ] Header **Auto-verify** column shows correct value for at least one row
  - [ ] Header **Alerts** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 581>_ @ [line 581](../../../apps/web/src/pages/admin/devices.tsx#L581)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 690>_ @ [line 690](../../../apps/web/src/pages/admin/devices.tsx#L690)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (16)

- [ ] **<TextInput @ line 240>** (`TextInput`, [line 240](../../../apps/web/src/pages/admin/devices.tsx#L240)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 247>** (`Select`, [line 247](../../../apps/web/src/pages/admin/devices.tsx#L247)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 255>** (`Select`, [line 255](../../../apps/web/src/pages/admin/devices.tsx#L255)) — accepts input, default value sensible, persists after refresh
- [ ] **Rule name** (`TextInput`, [line 583](../../../apps/web/src/pages/admin/devices.tsx#L583)) — accepts input, default value sensible, persists after refresh
- [ ] **Adapter code** (`TextInput`, [line 585](../../../apps/web/src/pages/admin/devices.tsx#L585)) — accepts input, default value sensible, persists after refresh
- [ ] **Target module** (`Select`, [line 588](../../../apps/web/src/pages/admin/devices.tsx#L588)) — accepts input, default value sensible, persists after refresh
- [ ] **Match strategy** (`Select`, [line 594](../../../apps/web/src/pages/admin/devices.tsx#L594)) — accepts input, default value sensible, persists after refresh
- [ ] **Match field path** (`TextInput`, [line 600](../../../apps/web/src/pages/admin/devices.tsx#L600)) — accepts input, default value sensible, persists after refresh
- [ ] **Target entity** (`TextInput`, [line 602](../../../apps/web/src/pages/admin/devices.tsx#L602)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 706>** (`TextInput`, [line 706](../../../apps/web/src/pages/admin/devices.tsx#L706)) — accepts input, default value sensible, persists after refresh
- [ ] **Device name** (`TextInput`, [line 789](../../../apps/web/src/pages/admin/devices.tsx#L789)) — accepts input, default value sensible, persists after refresh
- [ ] **Device code** (`TextInput`, [line 790](../../../apps/web/src/pages/admin/devices.tsx#L790)) — accepts input, default value sensible, persists after refresh
- [ ] **Hostname / IP** (`TextInput`, [line 794](../../../apps/web/src/pages/admin/devices.tsx#L794)) — accepts input, default value sensible, persists after refresh
- [ ] **Port** (`TextInput`, [line 796](../../../apps/web/src/pages/admin/devices.tsx#L796)) — accepts input, default value sensible, persists after refresh
- [ ] **Serial number** (`TextInput`, [line 799](../../../apps/web/src/pages/admin/devices.tsx#L799)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 801](../../../apps/web/src/pages/admin/devices.tsx#L801)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 8, `<ActionIcon>`: 0, `<Menu.Item>`: 0)

- [ ] **<button @ line 74>** ([line 74](../../../apps/web/src/pages/admin/devices.tsx#L74)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 74>** ([line 74](../../../apps/web/src/pages/admin/devices.tsx#L74)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 460>** ([line 460](../../../apps/web/src/pages/admin/devices.tsx#L460)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 460>** ([line 460](../../../apps/web/src/pages/admin/devices.tsx#L460)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 526>** ([line 526](../../../apps/web/src/pages/admin/devices.tsx#L526)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 526>** ([line 526](../../../apps/web/src/pages/admin/devices.tsx#L526)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 604>** ([line 604](../../../apps/web/src/pages/admin/devices.tsx#L604)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 604>** ([line 604](../../../apps/web/src/pages/admin/devices.tsx#L604)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setStep(0)}>Back** ([line 780](../../../apps/web/src/pages/admin/devices.tsx#L780)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setStep(0)}>Back** ([line 780](../../../apps/web/src/pages/admin/devices.tsx#L780)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setStep(3)}>Continue** ([line 781](../../../apps/web/src/pages/admin/devices.tsx#L781)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setStep(3)}>Continue** ([line 781](../../../apps/web/src/pages/admin/devices.tsx#L781)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setStep(2)}>Back** ([line 805](../../../apps/web/src/pages/admin/devices.tsx#L805)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setStep(2)}>Back** ([line 805](../../../apps/web/src/pages/admin/devices.tsx#L805)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **}>               Save Device** ([line 806](../../../apps/web/src/pages/admin/devices.tsx#L806)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **}>               Save Device** ([line 806](../../../apps/web/src/pages/admin/devices.tsx#L806)) — failure path works: validation/server error is shown clearly and does not leave stale loading state

## API methods used (9)

- [ ] `api.createDeviceInstance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRoutingRule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteRoutingRule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAdapterCatalog` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBridgeAgents` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDeviceInstances` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listManufacturers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRoutingRules` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.previewAdapterConfig` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._