/** What the doctor writes about refills and expiry on a prescription. */
export interface RefillTerms {
  refills: number;
  intervalDays: number;
  /** YYYY-MM-DD as chosen; null keeps the default, which follows the refills. */
  validUntil: string | null;
}

export const NO_REFILLS: RefillTerms = { refills: 0, intervalDays: 30, validUntil: null };

/** A prescription stays valid this long unless the doctor says otherwise. */
const DEFAULT_VALID_DAYS = 30;

function addDays(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The earliest expiry that still covers every refill. */
export function minValidUntil(terms: RefillTerms, today: string): string {
  return addDays(today, terms.refills * terms.intervalDays);
}

/** The expiry shown when the doctor hasn't picked one: a month, or long enough for the refills. */
export function defaultValidUntil(terms: RefillTerms, today: string): string {
  return addDays(today, Math.max(DEFAULT_VALID_DAYS, terms.refills * terms.intervalDays));
}

/** The request fields for these terms. The server checks them again. */
export function refillRequest(terms: RefillTerms, today: string) {
  return {
    repeats_allowed: terms.refills,
    ...(terms.refills > 0 ? { repeat_interval_days: terms.intervalDays } : {}),
    valid_until: terms.validUntil ?? defaultValidUntil(terms, today),
  };
}
