/**
 * Canonical UUIDs shared by Vitest fixtures + MSW handlers + smoke tests.
 *
 * These mirror `apps/web/e2e/helpers/canonical-seed.ts` so a single
 * UUID space is used across:
 *   - smoke (Playwright) — tests against live backend with seeded rows
 *   - vitest (jsdom) — tests UI rendering against MSW-mocked responses
 *
 * Drift between this file and `canonical-seed.ts` should be loud.
 * If a key is added there, mirror it here when needed for MSW.
 */

const u = (suffix: string): string => `10000000-0000-4000-8000-${suffix}`;

export const SEED = {
  tenant: u("000000000001"),
  admin_user: u("000000000002"),
  doctor_user: u("000000000003"),

  patient: u("000000000010"),

  encounter: u("000000000020"),
  appointment: u("000000000021"),

  lab_order: u("000000000030"),
  lab_test: u("000000000031"),

  pharmacy_order: u("000000000070"),
  prescription: u("000000000071"),

  invoice: u("000000000060"),
  payment: u("000000000061"),

  admission: u("000000000040"),

  department: u("000000000160"),
  doctor: u("000000000168"),
} as const;
