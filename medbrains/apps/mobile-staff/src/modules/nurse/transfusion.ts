/**
 * What the bedside transfusion chart owes next, as plain functions.
 *
 * The schedule is the clinical content of this screen: a transfusion is not
 * "running" or "done", it is a sequence of observations at fixed points, and
 * the one at fifteen minutes is the one that catches an acute haemolytic
 * reaction while there is still something to do about it. Deciding what is due
 * belongs somewhere it can be tested, not inside a render.
 */

import type {
  BedsideTransfusion,
  TransfusionObservation,
  TransfusionPhase,
} from "../../api/transfusion.js";

/** Minutes after the start each phase falls due. */
const PHASE_DUE_MINUTES: Record<TransfusionPhase, number> = {
  baseline: 0,
  fifteen_min: 15,
  periodic: 60,
  completion: 0,
};

export interface PhaseState {
  phase: TransfusionPhase;
  recorded: boolean;
  /** Past its time and not recorded — the state worth colouring. */
  overdue: boolean;
}

/**
 * Whether the unit is still running.
 *
 * An end time is the only thing that closes it. A completed observation does
 * not: the last set of vitals can be charted before the bag finishes.
 */
export function isRunning(transfusion: BedsideTransfusion): boolean {
  return transfusion.transfusion_start_time !== null && transfusion.transfusion_end_time === null;
}

/**
 * The chart, phase by phase.
 *
 * `periodic` may be recorded any number of times — hourly for as long as the
 * unit runs — so it counts as recorded once and never as overdue afterwards.
 * The other three are once each.
 */
export function phaseStates(
  transfusion: BedsideTransfusion,
  observations: readonly TransfusionObservation[],
  nowMs: number,
): PhaseState[] {
  const recorded = new Set(observations.map((observation) => observation.phase));
  const startedMs = transfusion.transfusion_start_time
    ? Date.parse(transfusion.transfusion_start_time)
    : Number.NaN;
  const elapsedMinutes = Number.isNaN(startedMs) ? 0 : (nowMs - startedMs) / 60_000;

  return (Object.keys(PHASE_DUE_MINUTES) as TransfusionPhase[]).map((phase) => {
    const done = recorded.has(phase);
    // Completion is due when the nurse ends the unit, not on a clock, so it is
    // never overdue — flagging it would put a red mark on every transfusion
    // that is simply still running.
    const overdue =
      !done &&
      phase !== "completion" &&
      isRunning(transfusion) &&
      elapsedMinutes >= PHASE_DUE_MINUTES[phase];
    return { overdue, phase, recorded: done };
  });
}

/**
 * Whether anything charted so far has the server worried.
 *
 * `reaction_suspected` is set server-side from the temperature and the signs
 * the nurse ticked. Recomputing the threshold here would be a second opinion
 * that can disagree with the record, so the flag is only ever read.
 */
export function hasSuspectedReaction(observations: readonly TransfusionObservation[]): boolean {
  return observations.some((observation) => observation.reaction_suspected);
}

/** A bag with no number is not identifiable, and identity is the whole check. */
export function canStartTransfusion(input: {
  bagNumber: string;
  bloodGroup: string;
  consentOnFile: boolean;
  crossmatchCompatible: boolean;
  expiryDate: string;
  productType: string;
  secondNurseId: string | null;
}): boolean {
  return (
    input.bagNumber.trim().length > 0 &&
    input.bloodGroup.trim().length > 0 &&
    input.productType.trim().length > 0 &&
    input.expiryDate.trim().length > 0 &&
    input.consentOnFile &&
    input.crossmatchCompatible &&
    input.secondNurseId !== null
  );
}
