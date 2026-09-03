/**
 * Spotting someone already on today's camp roll.
 *
 * A camp re-registers the same person constantly: sent off for a test, sent
 * back to the desk, written down again. A second registration splits one
 * person's readings across two records, and the clinician reviewing them sees
 * half a picture without knowing it.
 *
 * Phone is the only field volunteers enter consistently enough to match on.
 * Names are transliterated differently by each volunteer; ages are estimated.
 */

/** Every digit, discarding spaces, brackets and dashes. */
export function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * The subscriber number, however it was written down.
 *
 * The same person is stored as "9840412345" by one volunteer and
 * "+91 98404 12345" by the next. Matching on the whole digit string makes
 * those two different people, which is the opposite of what this is for.
 * The last ten digits are the subscriber number in every Indian form —
 * bare, 0-prefixed, or +91.
 */
export function subscriberNumber(value: string): string {
  const digits = digitsOf(value);
  return digits.length >= 10 ? digits.slice(-10) : "";
}

export interface RollEntry {
  person_name: string;
  phone: string | null;
}

/**
 * Index a roll by phone number, once.
 *
 * The first registration wins: if a number really is shared — a family on one
 * handset — the warning should name whoever was written down first, because
 * that is the record the volunteer would be duplicating.
 */
export function indexRegisteredPhones(roll: readonly RollEntry[]): Map<string, string> {
  const seen = new Map<string, string>();
  for (const row of roll) {
    const digits = row.phone ? subscriberNumber(row.phone) : "";
    // Partial numbers are not matches. Warning on a half-typed number would
    // train volunteers to dismiss the warning.
    if (digits && !seen.has(digits)) {
      seen.set(digits, row.person_name);
    }
  }
  return seen;
}

/** Who this phone number was already registered as, if anyone. */
export function duplicateOnRoll(
  index: ReadonlyMap<string, string>,
  phone: string,
): string | undefined {
  const digits = subscriberNumber(phone);
  return digits ? index.get(digits) : undefined;
}
