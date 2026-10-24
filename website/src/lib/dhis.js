// Digital Health Incentive Scheme estimate under Corrigendum 7 (9 April 2026,
// April–September 2026): ₹10 per discharge summary or diagnostic report linked
// to a KYC-verified ABHA, ₹5 per other linked record, ₹10 per consent request
// a hospital makes and ₹5 per record set it supplies. The first 100 eligible
// transactions of the month are deducted, lowest value first.
export const THRESHOLD = 100;

/**
 * @param {{ major: number, other: number, requested: number, supplied: number }} n
 *   monthly counts of eligible transactions (per-ABHA limits already applied)
 * @returns {{ gross: number, deducted: number, payable: number, transactions: number }}
 */
export function estimateDhis({ major, other, requested, supplied }) {
  const tens = Math.max(0, major) + Math.max(0, requested);
  const fives = Math.max(0, other) + Math.max(0, supplied);
  const transactions = tens + fives;
  const gross = 10 * tens + 5 * fives;
  const fivesDeducted = Math.min(fives, THRESHOLD);
  const tensDeducted = Math.min(tens, THRESHOLD - fivesDeducted);
  const deducted = 5 * fivesDeducted + 10 * tensDeducted;
  return { gross, deducted, payable: gross - deducted, transactions };
}
