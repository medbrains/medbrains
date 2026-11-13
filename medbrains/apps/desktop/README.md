# MedBrains Desktop

The MedBrains desktop client for Windows and Mac PCs: Tauri 2, app ID
`in.medbrains.desktop`. It ships no hospital's address. At first launch it asks
which hospital server to open, then opens that server's own web app in its own
window, with signed auto-updates. Silent printing is not wired yet: the
`medbrains-printing` crate is kept for it, and the command comes back with the
web app code that calls it.

## Which server it opens

1. First launch shows the setup screen (bundled with the app, `apps/web`
   `components/desktop/DesktopSetup.tsx`). The person types the server address,
   or scans the hospital QR from the appliance screen with the desk's QR scanner
   (or pastes it). The QR is the same `medbrains://bind?t=<JWS>` code the phone
   apps scan; the desktop reads the hospital name and server address from it.
   The code is not signature-checked, so the screen asks the person to confirm
   the address and shows the name only as "not verified". Its expiry is not
   checked either.
2. The address must be `https://`, with a plain hostname (letters, digits,
   hyphens, dots, after punycode) or an IP address. Release builds refuse plain
   `http://` entirely. Debug builds accept it for this computer only:
   `localhost`, `127.0.0.1`, `[::1]` and `*.localhost`.
3. The desktop asks the server's `/api/health` before it leaves the setup
   screen, keeps the origin in the Tauri store (`desktop.json` in the app data
   directory), and opens it.
4. To change it: **Change server** on the sign-in page, or the **Server →
   Change hospital server…** menu (works even when the server does not answer).
   Both forget the server and restart into setup.

## Security

- **Navigation lock.** The window may navigate only to the bundled setup screen
  and the chosen server's origin (`src/commands/server.rs`, `may_navigate`).
- **IPC.** `withGlobalTauri` is off. The setup screen may call only the two
  setup commands (`capabilities/main.json`). The chosen server gets only
  notifications and "forget server", through a capability added at runtime for
  its origin only; a static config cannot name a server chosen after install.
  No printing, keychain, file-system or shell-open permission exists.
- **CSP.** The CSP in `tauri.conf.json` covers only the bundled setup screen,
  with no remote or dev origins. Dev origins (Vite's websocket) are in
  `tauri.dev.conf.json`. The hospital server's pages run under the CSP that
  server sends, not this one.

## Develop

```sh
make dev                # terminal 1: backend + web + local Pingora proxy
make desktop-dev        # terminal 2: desktop window on https://medbrains.localhost
make desktop-setup-dev  # the first-launch setup screen instead (starts Vite)
ROUTE=/reports make desktop-dev
```

Debug builds only: `MEDBRAINS_DESKTOP_SERVER` opens that server instead of the
stored one, and `MEDBRAINS_DESKTOP_START_ROUTE` opens a route on it.

## Build

```sh
pnpm build:macos      # .dmg (macOS host)
pnpm build:windows    # .msi / .exe (Windows host)
pnpm tauri build --debug --bundles app   # quick unsigned local build
```

## Releases and auto-update

`release.yml` calls `desktop.yml` on every `v*` tag. The macOS, Windows and
Linux installers, their updater signatures and `latest.json` are uploaded to the
same GitHub release as the server. The app checks
`https://github.com/medbrains/medbrains/releases/latest/download/latest.json`
at launch and offers to install and restart. The updater refuses any package
not signed by the key whose public half is `plugins.updater.pubkey` in
`tauri.conf.json`.

Signing key:

```sh
pnpm tauri signer generate -w ~/.tauri/medbrains-desktop.key
```

Put the public key (`~/.tauri/medbrains-desktop.key.pub`, one line) in
`plugins.updater.pubkey`. The private key goes in a GitHub environment, not the
repository's secrets:

1. Settings → Environments → New environment `release`.
2. Deployment branches and tags → Selected → add a tag rule `v*`.
3. Add the environment secrets `TAURI_SIGNING_PRIVATE_KEY` (the private key
   file's contents) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, plus the Apple
   and Windows code-signing secrets `desktop.yml` names, and delete any copies
   at repository level.

The desktop job joins `release` only when it has a release to upload to, so
manual runs build unsigned. Without the key, CI still builds the installers,
with no updater artifacts and no `latest.json` (`tauri.updater.conf.json` turns
them on only when the key is present).

The release sets the app version from the tag (`v3.33.0` → `3.33.0`) before
building, and fails on a tag that is not semver, because the updater compares
that version with `latest.json`. The release's one `SHA256SUMS` covers the
installers too: the release workflow's last job adds them after this one uploads.

Operating-system code signing is separate from the updater signature. macOS is
signed and notarized only with `APPLE_CERTIFICATE` (a Developer ID Application
certificate) and either the App Store Connect API key (`APPLE_API_KEY_ID`,
`APPLE_API_ISSUER_ID`, `APPLE_API_KEY_P8`) or `APPLE_ID` + `APPLE_PASSWORD`.
Windows is signed only with `WINDOWS_CERTIFICATE` (a base64 PFX) and its
password. A release without them uploads that platform's installers with
`-unsigned` in the name; Gatekeeper and SmartScreen warn before opening them.

Clients that hold an old public key cannot update past a key rotation; they
need a manual reinstall.

## Data left by earlier builds

Earlier builds used a different app identifier, so this app does not see their
data and does not remove it. On a PC that had one, the old data directory (the
store, WebView cache and cookies) stays until deleted: under
`~/Library/Application Support/`, `~/Library/Caches/` and `~/Library/WebKit/` on
macOS, `%APPDATA%` and `%LOCALAPPDATA%` on Windows, and `~/.local/share/`,
`~/.config/` and `~/.cache/` on Linux, in a folder named after the old
identifier. Builds that had the keychain commands may also have left entries
under the service `in.medbrains.desktop` in the macOS Keychain or Windows
Credential Manager. Nothing reads them any more, so deleting them is safe.

## Linux and the `glib` advisory

Tauri 2 on Linux uses the GTK 3 bindings (`gtk` 0.18, `glib` 0.18.5).
GHSA-wrw7-89jp-8q8g is fixed in `glib` 0.20, which no Tauri 2 release (nor the
3.0 alphas) can use. It affects only the Linux build; Windows and macOS do not
compile `glib`.
