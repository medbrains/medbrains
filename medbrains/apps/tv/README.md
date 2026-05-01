# MedBrains TV

Android TV kiosk display generated from the **tv** template.

## Distribution

- Single APK side-loaded onto Fire TV stick / Android TV box / Mi Box
- EAS Build profile: `production` → APK artifact (no Play TV required)
- Auto-launch on boot via `MAIN`/`LEANBACK_LAUNCHER` intent (configured
  in `app.json` via `@react-native-tvos/config-tv`)

## Pre-wired

- `Shell` variant `tv` — focus-based navigation (D-pad), no touch
- `@react-native-tvos/config-tv` plugin
- Read-only modules — no clinical writes from a TV display
- Per-display deep-link router — open the device with
  `medbrains://tv/{moduleId}?department=cardiology` to set its boot
  screen

## Modules generated

- `queue` — Queue — OPD queue boards
- `bed-status` — Bed status — ward occupancy
- `lab-status` — Lab status — running tests, ETAs
- `emergency-triage` — Emergency triage — code activations
- `pharmacy-queue` — Pharmacy queue — dispensing queue
- `digital-signage` — Digital signage — announcements


## Next steps

1. Run `pnpm install` from the workspace root.
2. `pnpm --filter @medbrains/tv prebuild`
3. `pnpm --filter @medbrains/tv build:dev:android`
4. Install the APK on the target TV box.
5. Wire each module's WebSocket data feed against the staging backend.
