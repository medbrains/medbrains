# MedBrains Patient

Public-store patient app generated from the **patient** template.

## Distribution

- EAS Build profile: `production` → store distribution (App Store +
  Play Store)
- Listing files: `apps/mobile-patient/store/` (you'll add metadata + screenshots)
- ABDM compliance markers in `app.json` for PHR consumer checks
- ABHA login flow stubbed in `src/auth/abha-login.ts` —
  wire the consumer endpoint registered with NHA


## Pre-wired

- `Shell` variant `patient` with biometric **recommended** (skippable
  for accessibility, App Store review compliance)
- `expo-secure-store` for JWT + (optionally) ABHA token
- DPDP-aligned consent revocation flow scaffold

## Modules generated

- `appointments` — Appointments — book, view, reschedule
- `lab-reports` — Lab reports — own results, share via family link
- `prescriptions` — Prescriptions — view, request renewal, locator
- `bills` — Bills — view, pay (Razorpay)
- `consent` — Consent — DPDP-aligned revocation
- `family-share` — Family share — link, share PHR per-relation


## Next steps

1. Run `pnpm install` from the workspace root.
2. `pnpm --filter @medbrains/mobile-patient typecheck`
3. `pnpm --filter @medbrains/mobile-patient prebuild`
4. `pnpm --filter @medbrains/mobile-patient start` to run on the Expo Go dev
   client (or `build:dev:ios` for a custom build with secure store).
5. Submit to TestFlight + Play Console internal track via `eas submit`.
