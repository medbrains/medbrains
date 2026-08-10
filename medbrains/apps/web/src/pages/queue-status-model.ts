/**
 * What a queue token's server status means to the patient holding it.
 *
 * Kept apart from the page so the mapping can be tested. The failure that
 * matters is not a layout bug — it is telling somebody to sit down when they
 * are being called, or leaving them waiting on a token that is finished.
 */

export type QueueStage = "waiting" | "called" | "in_consultation" | "finished" | "missed";

/**
 * Map `queue_status` to what the patient is told.
 *
 * An unrecognised status is treated as **waiting**, deliberately. A status
 * added to the enum later and not taught to this page would otherwise read as
 * "finished" and send somebody home mid-visit; being told to keep waiting is
 * wrong in a way a person notices and can correct at the desk.
 */
export function queueStage(status: string): QueueStage {
  switch (status) {
    case "called":
      return "called";
    case "in_consultation":
      return "in_consultation";
    case "completed":
      return "finished";
    case "no_show":
      return "missed";
    default:
      return "waiting";
  }
}

/**
 * The wait line under the count.
 *
 * The server sends no estimate when it has no basis for one — a department
 * with no history, or a queue too short to average. Inventing "about 0 minutes"
 * from a missing number would be a promise the hospital did not make, so the
 * absence is stated instead.
 */
export function queueWaitLabel(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0) {
    return "We cannot estimate the wait right now";
  }
  if (minutes < 60) {
    return `About ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourPart = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return rest === 0 ? `About ${hourPart}` : `About ${hourPart} ${rest} min`;
}
