# RFC — Per-surface auth-token storage hardening

**Status:** Accepted (direction) · **Date:** 2026-06-23

## Principle

A world-class medical product hardens the session credential to the **strongest
mechanism each surface offers** — never a lowest-common-denominator. The session
token (and any SSO refresh token) is the keys to PHI; where it lives must match
the platform's best secure store. One token model, many storage backends.

Shared rule: **the token is never in JS-readable web storage** (`localStorage`/
`sessionStorage`) on any surface — XSS reads those. Each surface uses an
OS/browser-enforced store instead.

## Policy by surface

| Surface | Runtime | Storage mechanism | Why |
|---|---|---|---|
| **Web** (browser) | React SPA | **HttpOnly + Secure + SameSite cookie**, server-set | JS cannot read it (XSS-safe); CSRF cookie + double-submit. Already live (`middleware::cookies`). |
| **Desktop** | Tauri 2 (Rust shell) | **OS keyring** — macOS Keychain · Windows Credential Manager · Linux Secret Service | OS-encrypted, per-user, hardware-backed where available. Built #3403 (`secureStore` + `keyring_*`). |
| **Mobile** | React Native (×5 apps) | **iOS Keychain / Android Keystore** (Secure Enclave / TEE-backed) via `expo-secure-store` / `react-native-keychain` | Hardware-backed keystore; biometric-gated unlock optional. |
| **Edge / Kiosk / DeviceBridge** | Rust (`apps/edge`) | **OS keyring (Linux Secret Service) or TPM-backed**, short-lived **device-bound** tokens | Shared/unattended hardware → minimise blast radius: device token + per-shift user token, not a long-lived personal token. |
| **TV / Queue display** | RN (Android TV) | **Ephemeral, no user secret** | Shared public display shows non-PHI queue data only; a read-only display token, rotated, never a clinician session. |

## How the surface is chosen

The shared web bundle detects its host and picks the strategy:

- `window.__TAURI__` present → **desktop keyring** (`secureStore`, #3403).
- React Native runtime → **mobile secure storage** (the RN app provides the impl).
- plain browser → **cookie** (server-managed; client storage is a no-op).

`apps/web/src/lib/secureStore.ts` already encodes the web↔desktop split
(`isDesktop()`); mobile/edge provide their own `secureStore` impl behind the same
interface (`set`/`get`/`remove`), so feature code is surface-agnostic.

## Token shape per surface

- **Web/desktop-webview:** cookie session (access 15 min + refresh 7 d + CSRF) —
  works in the Tauri webview cookie jar too; the keyring is the *hardening* layer
  for the refresh token at rest.
- **Mobile/edge (native API clients):** Bearer access token + refresh, stored in
  Keychain/Keystore/keyring; sent as `Authorization: Bearer`. The server already
  supports `AuthMethod::Bearer`.

## SSO interaction

The OIDC/SAML callback mints the **same session** regardless of surface (#3404).
Web/desktop ride the cookie; native clients exchange for a Bearer token they place
in the platform secure store. AD-group → role/access-group mapping is identical.

## Rollout

- ✅ Web cookie · ✅ Desktop keyring (#3403) · ✅ unified `secureStore` interface.
- **Next:** mobile `expo-secure-store` impl behind `secureStore`; wire the desktop
  Bearer-from-keyring path; edge device-bound short-lived tokens.
- Each is a focused PR; feature code never changes (it calls `secureStore`).

## Out of scope

Hardware attestation (device posture / MDM), biometric step-up policy, and TPM
sealing are future hardening layers, tracked separately.
