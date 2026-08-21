/**
 * The bedside administration decisions, in plain functions.
 *
 * These mirror rules the server already enforces
 * (`crates/medbrains-ipd/src/lib.rs`). The client copy exists so a nurse is
 * stopped *before* the tap rather than handed a refusal after it — never as the
 * only guard. If any of these drift, the server still refuses; what breaks is
 * the explanation, which at a bedside is most of the value.
 */

import type { BarcodeVerifyResult, WardOnDutyRow } from "../../api/ipd.js";

/**
 * Who may witness this dose.
 *
 * Never the nurse giving it. The server rejects `witnessed_by == actor`, so
 * offering their own name would produce a refusal after the nurse has already
 * decided — and a second check performed by the same pair of eyes is not a
 * second check.
 */
export function eligibleWitnesses(
  onDuty: readonly WardOnDutyRow[],
  actorId: string,
): WardOnDutyRow[] {
  return onDuty.filter((nurse) => nurse.nurse_user_id !== actorId);
}

/**
 * Whether "Give now" may be pressed.
 *
 * A high-alert drug without a named witness is the case this exists for. It is
 * deliberately not the only guard — the server refuses the same write — but a
 * disabled button explains itself and a 400 does not.
 */
export function canRecordGiven(input: { isHighAlert: boolean; witnessId: string | null }): boolean {
  return !input.isHighAlert || input.witnessId !== null;
}

/**
 * The one-line summary under the server's reason.
 *
 * Both rights are named every time, including the one that passed. "Wristband
 * matched, drug did not" tells a nurse to put the pack down and keep the
 * patient; "wristband did not match" tells them to stop and check the bed.
 * Reporting only the failure leaves them re-deriving which is which.
 */
export function scanRightsSummary(result: BarcodeVerifyResult): string {
  const patient = result.right_patient ? "Wristband matched." : "Wristband did not match.";
  const drug = result.right_drug ? "Drug matched." : "Drug did not match.";
  return `${patient} ${drug}`;
}
