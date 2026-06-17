# Mobile Apps — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 77 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## ABDM

### ABDM health locker — share records with other hospitals
> As a **mobile app user**, I want **abdm health locker — share records with other hospitals**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can aBDM health locker — share records with other hospitals from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Alerts

### Push notifications — critical lab values, patient deterioration
> As a **mobile app user**, I want **push notifications — critical lab values, patient deterioration**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can push notifications — critical lab values, patient deterioration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Appointments

### ✅ Appointment booking with doctor/slot selection
> As a **mobile app user**, I want **appointment booking with doctor/slot selection**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can appointment booking with doctor/slot selection from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Appointment history and upcoming reminders
> As a **mobile app user**, I want **appointment history and upcoming reminders**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can appointment history and upcoming reminders from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Auth

### ✅ Login & biometric authentication (Face ID / fingerprint)
> As a **mobile app user**, I want **login & biometric authentication (face id / fingerprint)**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can login & biometric authentication (Face ID / fingerprint) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Barcode

### Barcode/QR scanning for sample tube labeling
> As a **mobile app user**, I want **barcode/qr scanning for sample tube labeling**.

`Partial · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can barcode/QR scanning for sample tube labeling from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Billing

### ✅ Bill viewing, payment (UPI/card/wallet), receipt download
> As a **mobile app user**, I want **bill viewing, payment (upi/card/wallet), receipt download**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can bill viewing, payment (UPI/card/wallet), receipt download from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Collection

### ✅ Sample collection confirmation with timestamp + photo
> As a **mobile app user**, I want **sample collection confirmation with timestamp + photo**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can sample collection confirmation with timestamp + photo from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Consult

### ✅ Write consultation notes (voice-to-text supported)
> As a **mobile app user**, I want **write consultation notes (voice-to-text supported)**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can write consultation notes (voice-to-text supported) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Discharge

### Discharge summary review and approval
> As a **mobile app user**, I want **discharge summary review and approval**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can discharge summary review and approval from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## EMR

### ✅ View patient history, allergies, vitals
> As a **mobile app user**, I want **view patient history, allergies, vitals**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can view patient history, allergies, vitals from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Family

### Family member linking (view dependents' records)
> As a **mobile app user**, I want **family member linking (view dependents' records)**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can family member linking (view dependents' records) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Feedback

### Feedback/rating submission after visit
> As a **mobile app user**, I want **feedback/rating submission after visit**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can feedback/rating submission after visit from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## General

### Wellness goals setup — configure targets for weight, steps, BP, blood sugar, medication, appointments
> As a **mobile app user**, I want **wellness goals setup — configure targets for weight, steps, bp, blood sugar, medication, appointments**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can wellness goals setup — configure targets for weight, steps, BP, blood sugar, medication, appointments from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Manual health metric logging — daily entry for weight, BP, sugar, steps, sleep, water intake
> As a **mobile app user**, I want **manual health metric logging — daily entry for weight, bp, sugar, steps, sleep, water intake**.

`P2 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can manual health metric logging — daily entry for weight, BP, sugar, steps, sleep, water intake from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Wearable device integration — sync data from Apple Health, Google Fit, Fitbit, Garmin APIs
> As a **mobile app user**, I want **wearable device integration — sync data from apple health, google fit, fitbit, garmin apis**.

`P2 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can wearable device integration — sync data from Apple Health, Google Fit, Fitbit, Garmin APIs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Medication adherence tracking — mark doses as taken, configurable reminders, missed dose tracking
> As a **mobile app user**, I want **medication adherence tracking — mark doses as taken, configurable reminders, missed dose tracking**.

`P2 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can medication adherence tracking — mark doses as taken, configurable reminders, missed dose tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Appointment compliance tracking — kept vs missed appointments, follow-up adherence percentage
> As a **mobile app user**, I want **appointment compliance tracking — kept vs missed appointments, follow-up adherence percentage**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can appointment compliance tracking — kept vs missed appointments, follow-up adherence percentage from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Progress dashboard — charts for goal progress, weekly/monthly trends, averages with color coding
> As a **mobile app user**, I want **progress dashboard — charts for goal progress, weekly/monthly trends, averages with color coding**.

`P2 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can progress dashboard — charts for goal progress, weekly/monthly trends, averages with color coding from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Points system — earn points for medication adherence, appointment attendance, monthly health milestones
> As a **mobile app user**, I want **points system — earn points for medication adherence, appointment attendance, monthly health milestones**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can points system — earn points for medication adherence, appointment attendance, monthly health milestones from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Achievement badges — unlock badges for milestones (7-day streak, 30-day streak, all goals met, steps target)
> As a **mobile app user**, I want **achievement badges — unlock badges for milestones (7-day streak, 30-day streak, all goals met, steps target)**.

`P2 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can achievement badges — unlock badges for milestones (7-day streak, 30-day streak, all goals met, steps target) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Leaderboard (friends & family) — opt-in friendly competition on wellness points with privacy controls
> As a **mobile app user**, I want **leaderboard (friends & family) — opt-in friendly competition on wellness points with privacy controls**.

`P2 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can leaderboard (friends & family) — opt-in friendly competition on wellness points with privacy controls from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Weekly/monthly challenges — hospital-created wellness challenges with bonus point rewards
> As a **mobile app user**, I want **weekly/monthly challenges — hospital-created wellness challenges with bonus point rewards**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can weekly/monthly challenges — hospital-created wellness challenges with bonus point rewards from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Reward redemption — redeem accumulated points for discounts, free checkups, pharmacy vouchers
> As a **mobile app user**, I want **reward redemption — redeem accumulated points for discounts, free checkups, pharmacy vouchers**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can reward redemption — redeem accumulated points for discounts, free checkups, pharmacy vouchers from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Streak tracking — track consecutive days of goal completion with visual streak badges & recovery grace
> As a **mobile app user**, I want **streak tracking — track consecutive days of goal completion with visual streak badges & recovery grace**.

`P2 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can streak tracking — track consecutive days of goal completion with visual streak badges & recovery grace from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Level system — Bronze / Silver / Gold / Platinum tiers based on total lifetime points
> As a **mobile app user**, I want **level system — bronze / silver / gold / platinum tiers based on total lifetime points**.

`P2 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can level system — Bronze / Silver / Gold / Platinum tiers based on total lifetime points from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Challenge invitations — invite friends & family members to join wellness challenges via link/SMS
> As a **mobile app user**, I want **challenge invitations — invite friends & family members to join wellness challenges via link/sms**.

`P2 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can challenge invitations — invite friends & family members to join wellness challenges via link/SMS from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Challenge group chat — private messaging within challenge groups for encouragement & tips
> As a **mobile app user**, I want **challenge group chat — private messaging within challenge groups for encouragement & tips**.

`P2 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can challenge group chat — private messaging within challenge groups for encouragement & tips from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Public challenge feed — opt-in display of anonymized achievements & milestones
> As a **mobile app user**, I want **public challenge feed — opt-in display of anonymized achievements & milestones**.

`P2 · Pending · Platforms: Mobile, TV · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can public challenge feed — opt-in display of anonymized achievements & milestones from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor/hospital-led challenges — staff-created public wellness challenges with enrollment tracking
> As a **mobile app user**, I want **doctor/hospital-led challenges — staff-created public wellness challenges with enrollment tracking**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can doctor/hospital-led challenges — staff-created public wellness challenges with enrollment tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Wellness analytics dashboard (admin) — engagement metrics, participation rates, drop-off tracking
> As a **mobile app user**, I want **wellness analytics dashboard (admin) — engagement metrics, participation rates, drop-off tracking**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can wellness analytics dashboard (admin) — engagement metrics, participation rates, drop-off tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Privacy controls — granular sharing settings, default-private, explicit opt-in for social features
> As a **mobile app user**, I want **privacy controls — granular sharing settings, default-private, explicit opt-in for social features**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The mobile app user can privacy controls — granular sharing settings, default-private, explicit opt-in for social features from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Biometric app login — Face ID / fingerprint authentication for quick app unlock
> As a **mobile app user**, I want **biometric app login — face id / fingerprint authentication for quick app unlock**.

`P1 · Done · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The mobile app user can biometric app login — Face ID / fingerprint authentication for quick app unlock from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### PIN fallback — 6-digit PIN when biometric unavailable
> As a **mobile app user**, I want **pin fallback — 6-digit pin when biometric unavailable**.

`P1 · Partial · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The mobile app user can pIN fallback — 6-digit PIN when biometric unavailable from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-lock timeout — configurable auto-lock after inactivity (1/5/15 min)
> As a **mobile app user**, I want **auto-lock timeout — configurable auto-lock after inactivity (1/5/15 min)**.

`P1 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The mobile app user can auto-lock timeout — configurable auto-lock after inactivity (1/5/15 min) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Secure clipboard — auto-clear copied patient data after 60 seconds
> As a **mobile app user**, I want **secure clipboard — auto-clear copied patient data after 60 seconds**.

`P1 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The mobile app user can secure clipboard — auto-clear copied patient data after 60 seconds from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Universal barcode/QR scanner — scan patient wristband, equipment tag, drug barcode from any screen
> As a **mobile app user**, I want **universal barcode/qr scanner — scan patient wristband, equipment tag, drug barcode from any screen**.

`P1 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The mobile app user can universal barcode/QR scanner — scan patient wristband, equipment tag, drug barcode from any screen from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Camera document capture — photograph prescriptions, wounds, documents with auto-attach to patient
> As a **mobile app user**, I want **camera document capture — photograph prescriptions, wounds, documents with auto-attach to patient**.

`P1 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The mobile app user can camera document capture — photograph prescriptions, wounds, documents with auto-attach to patient from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Voice-to-text input — dictate into any text field using device speech recognition
> As a **mobile app user**, I want **voice-to-text input — dictate into any text field using device speech recognition**.

`P1 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The mobile app user can voice-to-text input — dictate into any text field using device speech recognition from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Swipe gesture actions — swipe in lists for quick approve/reject/mark done
> As a **mobile app user**, I want **swipe gesture actions — swipe in lists for quick approve/reject/mark done**.

`P1 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The mobile app user can swipe gesture actions — swipe in lists for quick approve/reject/mark done from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Offline patient cache — cache frequently accessed patient records for offline viewing
> As a **mobile app user**, I want **offline patient cache — cache frequently accessed patient records for offline viewing**.

`P1 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The mobile app user can offline patient cache — cache frequently accessed patient records for offline viewing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Offline form submission — complete clinical forms offline, queue for sync when connected
> As a **mobile app user**, I want **offline form submission — complete clinical forms offline, queue for sync when connected**.

`P1 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The mobile app user can offline form submission — complete clinical forms offline, queue for sync when connected from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Sync conflict resolution — handle concurrent edits with merge/overwrite UI
> As a **mobile app user**, I want **sync conflict resolution — handle concurrent edits with merge/overwrite ui**.

`P1 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The mobile app user can sync conflict resolution — handle concurrent edits with merge/overwrite UI from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Background data prefetch — pre-download today's patients/appointments on app launch
> As a **mobile app user**, I want **background data prefetch — pre-download today's patients/appointments on app launch**.

`P1 · Pending · Platforms: Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The mobile app user can background data prefetch — pre-download today's patients/appointments on app launch from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Handover

### ✅ Sample handover to lab with chain-of-custody log
> As a **mobile app user**, I want **sample handover to lab with chain-of-custody log**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can sample handover to lab with chain-of-custody log from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## IPD

### IPD patient list with bed location
> As a **mobile app user**, I want **ipd patient list with bed location**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can iPD patient list with bed location from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Progress note entry (SOAP format)
> As a **mobile app user**, I want **progress note entry (soap format)**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can progress note entry (SOAP format) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Incentive

### Incentive statement and earnings view
> As a **mobile app user**, I want **incentive statement and earnings view**.

`Pending · Platforms: Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The mobile app user can incentive statement and earnings view from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Insurance

### Insurance card upload and pre-auth status tracking
> As a **mobile app user**, I want **insurance card upload and pre-auth status tracking**.

`Pending · Platforms: Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The mobile app user can insurance card upload and pre-auth status tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Lab

### ✅ Lab order placement and result viewing
> As a **mobile app user**, I want **lab order placement and result viewing**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can lab order placement and result viewing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Lab report viewing & PDF download
> As a **mobile app user**, I want **lab report viewing & pdf download**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can lab report viewing & PDF download from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Mobile i18n

### Shared locales package (@medbrains/locales) for mobile
> As a **mobile app user**, I want **shared locales package (@medbrains/locales) for mobile**.

`P2 · Pending · Platforms: Mobile · Source: RFC-003`

**Acceptance criteria**
- [ ] The mobile app user can shared locales package (@medbrains/locales) for mobile from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### react-i18next setup for React Native
> As a **mobile app user**, I want **react-i18next setup for react native**.

`P2 · Pending · Platforms: Mobile · Source: RFC-003`

**Acceptance criteria**
- [ ] The mobile app user can react-i18next setup for React Native from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### RTL layout support for Arabic/Urdu on mobile
> As a **mobile app user**, I want **rtl layout support for arabic/urdu on mobile**.

`P3 · Pending · Platforms: Mobile · Source: RFC-003`

**Acceptance criteria**
- [ ] The mobile app user can rTL layout support for Arabic/Urdu on mobile from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Offline locale file bundling (no HTTP backend)
> As a **mobile app user**, I want **offline locale file bundling (no http backend)**.

`P2 · Pending · Platforms: Mobile · Source: RFC-003`

**Acceptance criteria**
- [ ] The mobile app user can offline locale file bundling (no HTTP backend) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Language switcher in mobile app settings
> As a **mobile app user**, I want **language switcher in mobile app settings**.

`P2 · Pending · Platforms: Mobile · Source: RFC-003`

**Acceptance criteria**
- [ ] The mobile app user can language switcher in mobile app settings from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Tamil, Hindi, Arabic translation for mobile screens
> As a **mobile app user**, I want **tamil, hindi, arabic translation for mobile screens**.

`P3 · Pending · Platforms: Mobile · Source: RFC-003`

**Acceptance criteria**
- [ ] The mobile app user can tamil, Hindi, Arabic translation for mobile screens from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Navigation

### Indoor navigation / wayfinding (department directions)
> As a **mobile app user**, I want **indoor navigation / wayfinding (department directions)**.

`Pending · Platforms: Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The mobile app user can indoor navigation / wayfinding (department directions) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Route/navigation to patient location (Google Maps)
> As a **mobile app user**, I want **route/navigation to patient location (google maps)**.

`Partial · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can route/navigation to patient location (Google Maps) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Notifications

### Push notifications (appointment reminders, lab ready, bill due)
> As a **mobile app user**, I want **push notifications (appointment reminders, lab ready, bill due)**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can push notifications (appointment reminders, lab ready, bill due) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## OPD

### ✅ OPD patient queue with real-time updates
> As a **mobile app user**, I want **opd patient queue with real-time updates**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can oPD patient queue with real-time updates from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## OT

### OT schedule and surgical notes
> As a **mobile app user**, I want **ot schedule and surgical notes**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can oT schedule and surgical notes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Offline

### Offline mode with WatermelonDB sync
> As a **mobile app user**, I want **offline mode with watermelondb sync**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can offline mode with WatermelonDB sync from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Offline mode — queue orders when no connectivity
> As a **mobile app user**, I want **offline mode — queue orders when no connectivity**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can offline mode — queue orders when no connectivity from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Orders

### ✅ Home collection order list with patient details
> As a **mobile app user**, I want **home collection order list with patient details**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can home collection order list with patient details from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Payment

### On-site payment collection (cash/UPI)
> As a **mobile app user**, I want **on-site payment collection (cash/upi)**.

`Pending · Platforms: Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The mobile app user can on-site payment collection (cash/UPI) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Pharmacy

### ✅ Prescription history and refill requests
> As a **mobile app user**, I want **prescription history and refill requests**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can prescription history and refill requests from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Queue

### ✅ Live queue position tracking (estimated wait time)
> As a **mobile app user**, I want **live queue position tracking (estimated wait time)**.

`Done · Platforms: Mobile · Source: MocDoc+RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can live queue position tracking (estimated wait time) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Radiology

### Radiology order and report viewing (DICOM thumbnail)
> As a **mobile app user**, I want **radiology order and report viewing (dicom thumbnail)**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can radiology order and report viewing (DICOM thumbnail) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Records

### Health records timeline (visits, diagnoses, procedures)
> As a **mobile app user**, I want **health records timeline (visits, diagnoses, procedures)**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can health records timeline (visits, diagnoses, procedures) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Registration

### ✅ Registration & profile management
> As a **mobile app user**, I want **registration & profile management**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can registration & profile management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Rx

### ✅ E-prescription with drug interaction alerts
> As a **mobile app user**, I want **e-prescription with drug interaction alerts**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can e-prescription with drug interaction alerts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Schedule

### On-call schedule view and swap requests
> As a **mobile app user**, I want **on-call schedule view and swap requests**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can on-call schedule view and swap requests from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Search

### ✅ Patient search (name, UHID, phone)
> As a **mobile app user**, I want **patient search (name, uhid, phone)**.

`Done · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [x] The mobile app user can patient search (name, UHID, phone) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Telemedicine

### Video consultation launch from app
> As a **mobile app user**, I want **video consultation launch from app**.

`Pending · Platforms: Mobile · Source: MocDoc+RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can video consultation launch from app from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Video consultation join from app
> As a **mobile app user**, I want **video consultation join from app**.

`Pending · Platforms: Mobile · Source: MocDoc+RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can video consultation join from app from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Tracking

### Trip completion tracking with distance/time logging
> As a **mobile app user**, I want **trip completion tracking with distance/time logging**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §Mobile`

**Acceptance criteria**
- [ ] The mobile app user can trip completion tracking with distance/time logging from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Offline-safe PHI handling, device auth, and sync conflict resolution.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

