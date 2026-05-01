# Mobile + TV CRDT Integration

Phase 12 of the hybrid roadmap. Same Rust core that powers
`medbrains-edge` (server) and the web's `@medbrains/crdt` package now
compiles for iOS / Android via [`medbrains-edge-rn`](../crates/medbrains-edge-rn).
This document covers the mobile / TV side of the integration —
what's shipped, what's deferred, and how to wire it into the apps.

## What's shipped (this PR)

- Rust crate `medbrains-edge-rn` with UniFFI bindings:
  - `DocHandle::new(doc_id)` — open or create a Loro document
  - `apply_update(bytes) -> vv` — merge an update from the server / peer
  - `export_since(their_vv) -> bytes` — produce delta to push upstream
  - `append_to_list(container, item)` — T2 append-only writes
  - `set_text(container, text)` / `read_text(container)` — T3 text writes
  - `version_vector()` — current VV for use as `since` in pulls
- 6 unit tests covering doc lifecycle + cross-device merge
- `crate-type = ["staticlib", "cdylib", "rlib"]` so iOS gets a
  `.a` archive and Android gets a `.so` per ABI
- `build.rs` invokes `uniffi::generate_scaffolding` against
  `src/edge_rn.udl`

## What's deferred (mobile/TV app PRs)

### React Native binding generation

The TS / Kotlin / Swift bindings come from
[`uniffi-bindgen-react-native`](https://github.com/jhugman/uniffi-bindgen-react-native).
Steps once the iOS/Android dev env is set up:

1. Install the bindgen: `cargo install uniffi-bindgen-react-native`
2. Generate the JS bridge:
   ```bash
   uniffi-bindgen-react-native \
       --library target/debug/libmedbrains_edge_rn.a \
       --out-dir apps/mobile/native/edge-rn
   ```
3. Add a Metro module resolver entry pointing at the generated dir.
4. Import `DocHandle` from the generated TS — same surface as the
   web package's `@medbrains/crdt`.

### Build-system wiring

#### iOS

Add to `apps/mobile/ios/Podfile`:

```ruby
pod 'medbrains_edge_rn', :path => '../../../medbrains/crates/medbrains-edge-rn'
```

A matching `.podspec` ships in a follow-up PR.

#### Android

Add to `apps/mobile/android/app/build.gradle`:

```groovy
android {
    sourceSets {
        main.jniLibs.srcDirs += ['../../../medbrains/target/aarch64-linux-android/release']
    }
}
```

Cross-compile via `cargo ndk -t arm64-v8a -t armeabi-v7a -- build --release`.

#### TV (Android TV)

TV reuses the same WSS protocol the web uses (`medbrains-edge`'s
`SyncServer`). No UniFFI bridge needed for TV-side reads — TV is
read-mostly (queue boards, dashboards). For TV-side writes (a rare
case — e.g. nurse actions on a kiosk display), the same RN binding
that ships for mobile applies.

### App screens

Mobile screens that mirror the web hooks land in
`apps/mobile/src/screens/`:

- `Vitals/VitalsScreen.tsx` — uses `useVitalsSourceMobile` (the RN
  analog of web's `useVitalsSource`)
- `Handoff/HandoffScreen.tsx`
- `Notes/NotesScreen.tsx`
- `Triage/TriageScreen.tsx`

Each screen uses React Native Paper v5 components per the APPROVED
RFC. The RN hook implementation is one wrapper file per domain
(~80 LOC each) calling into the UniFFI-generated `DocHandle`.

## Why the deferred work isn't blocking

The mobile + TV apps already exist as skeleton React Native projects
(`apps/mobile/`, `apps/tv/`). Without a hospital pilot demanding
offline mobile, the value of cross-compiling, wiring CocoaPods, and
testing on a real iPhone is low — the Rust core is the load-bearing
piece, and it lands today.

When a pilot demands offline mobile (typical signal: home-visit
nurses, ambulance EMTs, rural OPD camps), the work above is
mechanical. Plan for ~2 weeks across iOS + Android + TV smoke. The
Rust API surface in `edge_rn.udl` is stable enough that the bindings
won't change underneath the app layer.

## Tests

- `cargo test -p medbrains-edge-rn` — 6 passing
- The cross-device merge test (`export_apply_roundtrip_between_handles`)
  is the one that proves the protocol works without a server: two
  `DocHandle` instances exchange updates directly, like two devices
  on the same LAN with no edge node between them.

## Cross-references

- Rust core: `crates/medbrains-edge-rn/src/lib.rs`
- UDL: `crates/medbrains-edge-rn/src/edge_rn.udl`
- Web counterpart: `packages/crdt/`
- Server counterpart: `crates/medbrains-edge/`
- Web hooks (the surface the mobile bindings should mirror):
  `apps/web/src/hooks/useVitalsSource.ts` (and siblings)
