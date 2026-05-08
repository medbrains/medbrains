# `admin/settings/DeviceIntegrationsSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/DeviceIntegrationsSettings.tsx`](../../../apps/web/src/pages/admin/settings/DeviceIntegrationsSettings.tsx) (568 lines). Guard: `—`. API methods: 2. useForm: 0. Tables: 0. Modals: 0._

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

### DataTable columns (30)
- [ ] Column **Enabled** (`enabled`) renders without `undefined` / `[object Object]`
- [ ] Column **PACS Host** (`host`) renders without `undefined` / `[object Object]`
- [ ] Column **Port** (`port`) renders without `undefined` / `[object Object]`
- [ ] Column **Local AE Title** (`local_ae_title`) renders without `undefined` / `[object Object]`
- [ ] Column **Remote AE Title** (`remote_ae_title`) renders without `undefined` / `[object Object]`
- [ ] Column **Username** (`username`) renders without `undefined` / `[object Object]`
- [ ] Column **Password / Secret** (`password`) renders without `undefined` / `[object Object]`
- [ ] Column **Modality Worklist** (`worklist_enabled`) renders without `undefined` / `[object Object]`
- [ ] Column **Enabled** (`enabled`) renders without `undefined` / `[object Object]`
- [ ] Column **Protocol** (`protocol`) renders without `undefined` / `[object Object]`
- [ ] Column **Gateway Host** (`host`) renders without `undefined` / `[object Object]`
- [ ] Column **Port** (`port`) renders without `undefined` / `[object Object]`
- [ ] Column **Analyzer Code** (`analyzer_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Username** (`username`) renders without `undefined` / `[object Object]`
- [ ] Column **Password / Secret** (`password`) renders without `undefined` / `[object Object]`
- [ ] Column **Enabled** (`enabled`) renders without `undefined` / `[object Object]`
- [ ] Column **Vendor** (`vendor`) renders without `undefined` / `[object Object]`
- [ ] Column **Service URL** (`service_url`) renders without `undefined` / `[object Object]`
- [ ] Column **Device ID** (`device_id`) renders without `undefined` / `[object Object]`
- [ ] Column **API Key / Secret** (`api_key`) renders without `undefined` / `[object Object]`
- [ ] Column **Enabled** (`enabled`) renders without `undefined` / `[object Object]`
- [ ] Column **Print Agent URL** (`agent_url`) renders without `undefined` / `[object Object]`
- [ ] Column **Default Printer** (`default_printer`) renders without `undefined` / `[object Object]`
- [ ] Column **Label / Wristband Printer** (`label_printer`) renders without `undefined` / `[object Object]`
- [ ] Column **API Key / Secret** (`api_key`) renders without `undefined` / `[object Object]`
- [ ] Column **Enabled** (`enabled`) renders without `undefined` / `[object Object]`
- [ ] Column **Display Client URL** (`display_client_url`) renders without `undefined` / `[object Object]`
- [ ] Column **Location Code** (`location_code`) renders without `undefined` / `[object Object]`
- [ ] Column **WebSocket Channel** (`websocket_channel`) renders without `undefined` / `[object Object]`
- [ ] Column **API Key / Secret** (`api_key`) renders without `undefined` / `[object Object]`

## Form inputs (5)

- [ ] **<Switch @ line 474>** (`Switch`, [line 474](../../../apps/web/src/pages/admin/settings/DeviceIntegrationsSettings.tsx#L474)) — accepts input, default value sensible, persists after refresh
- [ ] **<NumberInput @ line 487>** (`NumberInput`, [line 487](../../../apps/web/src/pages/admin/settings/DeviceIntegrationsSettings.tsx#L487)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 508>** (`Select`, [line 508](../../../apps/web/src/pages/admin/settings/DeviceIntegrationsSettings.tsx#L508)) — accepts input, default value sensible, persists after refresh
- [ ] **<PasswordInput @ line 522>** (`PasswordInput`, [line 522](../../../apps/web/src/pages/admin/settings/DeviceIntegrationsSettings.tsx#L522)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 536>** (`TextInput`, [line 536](../../../apps/web/src/pages/admin/settings/DeviceIntegrationsSettings.tsx#L536)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 1, `<ActionIcon>`: 0, `<Menu.Item>`: 0)

- [ ] **<button @ line 551>** ([line 551](../../../apps/web/src/pages/admin/settings/DeviceIntegrationsSettings.tsx#L551)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 551>** ([line 551](../../../apps/web/src/pages/admin/settings/DeviceIntegrationsSettings.tsx#L551)) — failure path works: validation/server error is shown clearly and does not leave stale loading state

## API methods used (2)

- [ ] `api.getSecureDeviceSettings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateSecureDeviceSetting` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._