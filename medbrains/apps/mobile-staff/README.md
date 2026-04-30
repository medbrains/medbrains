# MedBrains Staff

MDM-distributed clinical app generated from the **staff** template.

## Distribution

- EAS Build profile: `production` → internal-only IPA/APK
- Provisioning: hospital MDM (Jamf, Intune, Workspace ONE) pushes the
  signed binary to managed devices
- Pairing: admin generates a one-time QR via the web admin console;
  the device exchanges it for a JWT + device cert via mTLS

## Pre-wired

- `Shell` variant `staff` with biometric **required** unlock
- `expo-secure-store` for JWT / device cert / private key
- `expo-local-authentication` for biometric unlock
- `expo-camera` for QR pairing
- `@medbrains/uniffi-rn-plugin` runs on prebuild — Rust core
  (`medbrains-edge-rn`) compiles into iOS staticlib + Android jniLibs;
  TS bindings auto-imported as `@medbrains/edge-rn-bindings`

## Modules generated

- `doctor` — Doctor — consultation, prescriptions, notes
- `nurse` — Nurse — MAR, vitals, handoff, I/O
- `pharmacy` — Pharmacy — dispensing, NDPS, stock
- `lab` — Lab — orders, results, QC
- `billing` — Billing — invoices, payments
- `bme` — BME — equipment, calibrations, AMC
- `facilities` — Facilities — work orders, maintenance
- `housekeeping` — Housekeeping — linen, sanitation
- `security` — Security — incident logs, visitor passes
- `hr` — HR — attendance, leave, roster
- `reception` — Reception — registration, queue, appointments


## Next steps

1. Run `pnpm install` from the workspace root.
2. `pnpm --filter @medbrains/mobile-staff typecheck`
3. `pnpm --filter @medbrains/mobile-staff prebuild` to materialize the
   native projects.
4. `pnpm --filter @medbrains/mobile-staff build:dev:ios` (or `:android`).
5. Wire each module's screens against the staging backend.
