/**
 * The ward call board's shared vocabulary.
 *
 * Three surfaces render this: the nursing-station TV, the nurse's phone, and
 * the patient's own bedside tablet. What counts as an *open* call has to be one
 * definition — a tablet that thinks a completed call is still open leaves the
 * patient staring at "Sent to the ward" forever, and a phone that disagrees
 * with the wall is worse than either alone.
 *
 * Wire shape mirrors `crates/medbrains-care-mgmt/src/nurse_calls.rs`.
 */

/** How long an unanswered call has waited, judged against the tenant's own thresholds. */
export type NurseCallEscalation = "normal" | "charge_nurse" | "supervisor";

/**
 * One open call on the ward board.
 *
 * No patient name, by design: a bed number is what answers a call, and a
 * nursing-station screen is visible to more people than the nurse at it.
 */
export interface ActiveNurseCall {
  id: string;
  admission_id: string;
  ward_id: string | null;
  ward_name: string | null;
  bed_number: string | null;
  request_type: string;
  status: string;
  /** What the patient typed. The phone shows it; the wall does not. */
  notes: string | null;
  created_at: string;
  acknowledged_at: string | null;
  waiting_seconds: number;
  escalation: NurseCallEscalation;
}

/**
 * The thresholds travel with the rows so a screen colours calls the same way
 * the server judged them, rather than hard-coding two numbers a hospital is
 * entitled to change.
 */
export interface NurseCallBoard {
  calls: ActiveNurseCall[];
  escalate_secs: number;
  supervisor_secs: number;
}

/**
 * A call still owed a visit.
 *
 * `acknowledged` is open. A nurse pressing "Seen" has taken the call, not
 * answered it, and a board that drops it at that point goes quiet in exactly
 * the situation it exists to make loud.
 */
export function isOpenNurseCall(status: string): boolean {
  return status === "pending" || status === "acknowledged";
}

export function openNurseCalls<T extends { status: string }>(calls: readonly T[]): T[] {
  return calls.filter((call) => isOpenNurseCall(call.status));
}

/** Calls the server has already escalated past `normal`. */
export function overdueNurseCalls<T extends { escalation: NurseCallEscalation }>(
  calls: readonly T[],
): T[] {
  return calls.filter((call) => call.escalation !== "normal");
}

/**
 * `4m 07s`, zero-padded so a column of them does not jitter on a wall.
 *
 * Negative input is clamped: a device whose clock runs ahead of the server
 * must show `0m 00s`, not a wait that reads as counting backwards.
 */
export function nurseCallWaitParts(waitingSeconds: number): {
  minutes: number;
  seconds: string;
} {
  const safe = Math.max(0, Math.floor(waitingSeconds));
  return {
    minutes: Math.floor(safe / 60),
    seconds: String(safe % 60).padStart(2, "0"),
  };
}
