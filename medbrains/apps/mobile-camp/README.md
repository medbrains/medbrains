# MedBrains Camp

> **Outgoing — reference only.** This React Native app is being replaced by the native apps in [`apps/ios`](../ios) (SwiftUI) and [`apps/android`](../android) (Jetpack Compose), per [`RFCs/RFC-NATIVE-MOBILE.md`](../../../RFCs/RFC-NATIVE-MOBILE.md). Do not add features here; it is deleted once the native apps reach parity (see [`docs/NATIVE-PARITY.md`](../../docs/NATIVE-PARITY.md)).

Dedicated mobile app for rural and outreach health camps.

The app intentionally exposes only Camp Mode workflows:

- camp selection and packet download
- offline patient search and patient chart
- registration, screening/vitals, lab sample capture, prescription, referral
- inbound sync through the existing camp API

Run through the root Makefile:

```bash
make camp-mobile
make camp-mobile-ios
make camp-mobile-android
make mobile-camp-typecheck
```
