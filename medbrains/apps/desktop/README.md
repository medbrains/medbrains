# MedBrains Desktop

Native desktop shell for the MedBrains HMS — Tauri 2 wrapping the
existing React SPA at `apps/web/`. Same UI, native installers.

## Why Tauri (vs Electron)

- ~10MB binary vs ~100-200MB Electron
- ~50MB RAM vs ~250MB
- Same Rust toolchain as the backend
- Capability-based security (deny-by-default)
- Built-in signed auto-updater
- macOS / Windows / Linux from one codebase

## Targets

| OS | Format | Signing |
|---|---|---|
| macOS | `.dmg`, `.app` | Apple Developer ID + Notarization |
| Windows | `.msi`, `.exe` | Authenticode (EV preferred) |
| Linux | `.AppImage`, `.deb`, `.rpm` | GPG-signed |

## Develop

```sh
make dev                  # terminal 1: backend + web + local Pingora proxy
make desktop-dev          # terminal 2: Tauri window at https://medbrains-desktop.localhost
make desktop-reports-dev  # optional: open directly at /reports
```

`pnpm dev` runs `tauri dev` which:
- Starts `cd ../web && pnpm dev` in parallel
- Opens a webview pointing at the dev server
- Hot-reloads on SPA changes

For normal local desktop testing, keep `make dev` running and use the
Pingora local domain:

- browser web: `https://medbrains.localhost`
- desktop webview: `https://medbrains-desktop.localhost`
- shared API: `https://medbrains.localhost/api`

Useful runtime switches:

```sh
ROUTE=/reports make desktop-dev
MEDBRAINS_DESKTOP_DEV_URL=https://medbrains-desktop.localhost ROUTE=/reports make desktop-dev
MEDBRAINS_DESKTOP_API_BASE=https://medbrains.localhost/api make desktop-dev
```

Desktop can take API configuration from either runtime or build-time env:

- `MEDBRAINS_DESKTOP_API_BASE` — runtime desktop API base injected by Tauri into the webview.
- `VITE_DESKTOP_API_BASE` — build-time fallback for packaged desktop web assets.
- Default desktop API is `https://medbrains.localhost/api`, the same backend origin used by web.

## Build

```sh
pnpm build:macos      # produces .dmg
pnpm build:windows    # produces .msi (requires Windows host)
pnpm build:linux      # produces .deb + .AppImage + .rpm (requires Linux host)
```

CI matrix in `.github/workflows/desktop.yml` builds all three on push to a release tag.

## Architecture

```
┌────────────────────────────────────┐
│ Tauri 2 shell (Rust, this crate)   │
│ • Plugins: fs, dialog, shell,      │
│   notification, updater, deep-link │
│ • Commands: system_info, printer   │
│ ↓                                  │
│ Webview (system: WKWebView /       │
│ WebView2 / WebKitGTK)              │
│ ↓                                  │
│ React SPA (apps/web/dist)          │
│ ↓                                  │
│ HTTP/WebSocket → medbrains-server  │
└────────────────────────────────────┘
```

The desktop is intentionally **thin** — all business logic stays in
`crates/medbrains-server`. Native commands are limited to:

- `system_info()` — OS / arch / locale
- `open_settings_dir()` — open app-data folder in OS file manager
- `list_printers()` / `print_pdf()` — Phase A2 (hardware bridge)

## Capabilities

`src-tauri/capabilities/main.json` is the deny-by-default ACL:
- File system scoped to `$APPDATA/medbrains/`, `$DOCUMENT/MedBrains/`
- Shell open allow-listed: `hims.amh.org.in`, `medbrains.dev`, `*.razorpay.com`
- Remote dev webviews allow-listed: `localhost:5173/*`, `127.0.0.1:5173/*`, `medbrains.localhost/*`, `medbrains-desktop.localhost/*`
- Updater plugin pinned to our Ed25519 public key

## Auto-update

`tauri-plugin-updater` is enabled and pinned to the public key in `tauri.conf.json`. Local debug builds do not create updater artifacts. Release CI should set the private key through `TAURI_SIGNING_PRIVATE_KEY` or `TAURI_SIGNING_PRIVATE_KEY_PATH`, then publish signed release JSON to `https://hims.amh.org.in/.well-known/medbrains-desktop-updates/...`. The installer refuses unsigned updates.

To rotate the signing key:
1. `tauri signer generate -w ~/.tauri/medbrains-desktop.key`
2. Replace `pubkey` in `tauri.conf.json` with new public key
3. Add private key to CI secrets (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`)
4. Bump app version + push release

Old clients with the old pubkey CAN'T update past the rotation — they need a manual reinstall.

## Phase status (from master plan, Track 2B)

- ✅ Phase A — shell + capabilities + auto-update
- ⏳ Phase A2 — hardware bridge (USB serial, label printers, DICOMweb)
- ⏳ Phase E — all-in-one clinic edition (bundle medbrains-server + portable postgres)
