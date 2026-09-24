# RFC-NATIVE-MOBILE — Device apps move from React Native to native

Status: **APPROVED** (owner decision, 2026-09-13). Supersedes the mobile and TV rows of
RFC-HMS-2026-003 TechStack (React Native CLI + Paper v5; React Native for Android TV).

## Decision

Every MedBrains device app is rewritten natively, screen for screen, in lockstep per module:

| Surface family | Platform stack | Design system |
|---|---|---|
| `Mobile-*` on iPhone/iPad | Swift 6, SwiftUI, iOS 17+ (built with the iOS 26 SDK) | Apple Human Interface Guidelines, including *Designing for iPhone Duo*; Liquid Glass through system components |
| `Mobile-*` on Android | Kotlin, Jetpack Compose, `androidx.compose.material3` 1.4 | Material 3 Expressive (`MaterialExpressiveTheme`, `MotionScheme.expressive()`) |
| `TV-*` on Android TV / Google TV | Kotlin, Compose for TV (`androidx.tv.material3`) | 10-foot UI, D-pad focus, overscan |

Carbon stays the brand: colour, type and spacing come from `packages/design-system` tokens,
generated into a Swift `enum Carbon` and a Kotlin `object Carbon`. The layout system is the
platform's, never the web 2x grid.

## Why

- **Speed and control for clinical work.** HealthKit / Health Connect, camera and barcode,
  background sessions, biometrics and secure storage are first-class natively; every one of
  them crossed a bridge before.
- **The Rust core was already native.** `crates/medbrains-edge-rn` (UniFFI 0.31) generates
  Swift and Kotlin bindings today; the React Native binding was the extra layer.
- **The platforms have moved.** iPhone Duo's dual displays and vertical bars, Liquid Glass, and
  Material 3 Expressive are delivered through the platforms' own components; standard SwiftUI
  and Compose containers get them free, a cross-platform kit gets them late or never.

## What does not change

- **The backend.** Native clients send `X-MedBrains-Client: mobile-<variant>` (or `tv-…`),
  which switches login to body tokens (`crates/medbrains-auth/src/lib.rs`), and authenticate
  with a bearer token, which bypasses CSRF. `permissions` are read from the login response
  body, never from the JWT. Paired devices keep `paired_device_id` and are re-checked on every
  request. The pairing flows under `/api/device-pairing/*` are unchanged.
- **Offline authorisation** is a safety property and stays in Rust: `AuthzCacheHandle`,
  `RevocationCacheHandle`, `is_action_offline_required`, `verify_jwt`. Native code calls them;
  it never re-implements them.
- **Module gating**: `requiredPermissions` (all of), `requiredAnyPermissions` (any of), the
  `super_admin`/`hospital_admin` bypass, `appCodes` per surface, and module order (which
  decides where a role lands on launch).
- **Secrets**: Keychain `WhenUnlockedThisDeviceOnly` / Android Keystore; the node sync secret
  is never logged.
- **The LAW docs' substance**: 44pt / 48dp targets, virtualised lists, teardown of every timer
  and socket, an error boundary per screen and last-good render, ≤200 MB and ≤2.5 s cold start
  on mobile (≤120 MB / 4 s on TV), WCAG 2.2 AA, the ten form/keyboard rules, and the fixed
  emergency-code colours with the 1 Hz flash cap.
- **The acceptance suite**: `packages/e2e-mobile/src/journeys.ts` remains the catalogue; each
  journey is re-implemented as an XCUITest and a Compose UI test as its module converts, with
  `automationStatus` kept honest.

## Structure

```
apps/ios/            XcodeGen workspace: MedBrainsCore (UniFFI Swift + xcframework),
                     MedBrainsKit (auth, permissions, offline, pairing, notifications,
                     biometrics, scanner, forms), MedBrainsUI (tokens, HIG components),
                     app targets MedBrainsStaff, MedBrainsPatient, MedBrainsCamp, MedBrainsVendor
apps/android/        Gradle: :core (UniFFI Kotlin + .so via cargo-ndk), :kit, :ui,
                     :app-staff, :app-patient, :app-camp, :app-vendor, :app-tv
crates/medbrains-clinical-core/   UniFFI crate for the framework-free clinical logic that
                     lived in TypeScript (bcma, transfusion, queue-order, lab-qc, …), ported
                     with its tests — shared, never copied
scripts/generate_native_tokens.py  design-system tokens → Swift + Kotlin
```

Request and response models are hand-written per screen from `packages/types`; the
`check-types` contract is extended to both native trees. `docs/openapi.json` supplies paths
and required permissions only.

## Platform rules

**iOS.** System containers only, so the iPhone Duo layout is inherited: `TabView`,
`NavigationStack` and `NavigationSplitView` for list-and-detail, `ToolbarItemGroup` with a
`Label(title, systemImage:)` on every item and visibility priorities, no fixed widths, safe
areas everywhere, size-class-driven layout, Dynamic Type, accessibility labels on every
icon-only control, reduced motion honoured. Xcode 26.6 ships no iPhone Duo simulator;
adaptivity is verified on iPad split view and large-phone landscape until one exists.

**Android.** `MaterialExpressiveTheme` fed from the tokens, `NavigationSuiteScaffold` and
`WindowSizeClass` for foldables, edge-to-edge with IME insets on forms, 48dp targets,
expressive components (button groups, FAB menu, loading indicator) where Paper equivalents
were used.

**TV.** Compose for TV, an obvious focus state, 48dp overscan, WebSocket-driven boards with a
last-good render, never a blank board.

## Order of conversion

0. This RFC, the LAW-doc amendments, tooling (Android Studio, JDK 17, cargo-ndk, Rust cross
   targets, uniffi-bindgen), the Rust core built as an xcframework and Android `.so`s.
1. The two shells, proven by signing in as the e2e nurse and seeing exactly the nurse's
   modules, offline included.
2. Mobile-Nurse. 3. Mobile-Doctor. 4. Mobile-Patient. 5. Pharmacist, LabTech and the remaining
   staff modules, with the four phlebotomy screens salvaged from `apps/mobile`. 6. Mobile-Camp.
7. TV. 8. Decommission: `apps/mobile` first, then each React Native app as its native pair
   reaches parity on the journey catalogue, then `packages/mobile-shell`, `packages/ui-mobile`
   and `packages/uniffi-rn-plugin`.

Parity is tracked screen by screen in `medbrains/docs/NATIVE-PARITY.md` (118 screens and
boards surveyed from the code on 2026-09-13, each with its endpoints and an iOS/Android
status). A React Native app is deleted only when every one of its rows is converted on both
platforms; the ledger is updated in the PR that converts the screen, never afterwards.

Each phase lands as one focused PR after the full gate, verified on simulator and emulator
with screenshots of every screen.
