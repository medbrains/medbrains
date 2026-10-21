# MedBrains Vendor (skeleton)

> **Outgoing — reference only.** This React Native app is being replaced by the native apps in [`apps/ios`](../ios) (SwiftUI) and [`apps/android`](../android) (Jetpack Compose), per [`RFCs/RFC-NATIVE-MOBILE.md`](../../../RFCs/RFC-NATIVE-MOBILE.md). Do not add features here; it is deleted once the native apps reach parity (see [`docs/NATIVE-PARITY.md`](../../docs/NATIVE-PARITY.md)).

3rd-party service contractor app generated from the **vendor**
template. **DRAFT — not signed for distribution. Not in CI release
pipeline.**

This template documents the pattern for an additional app pool. Use
it when a hospital pilot has a clear vendor self-service requirement
(e.g. BME AMC contractor logging service visits) — graduate from
skeleton to ship-ready by:

1. Filling in the sample module's real screens
2. Adding distribution metadata + EAS Build profile config
3. Removing the `draft` marker in `package.json`
4. Adding to the CI release pipeline

## Modules generated

- `bme-amc` — BME AMC — work orders, service visits, certs

