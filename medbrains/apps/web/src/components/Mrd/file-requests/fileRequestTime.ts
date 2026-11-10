import type { MrdFileRequest, MrdFileRequestStatus, MrdVisitFileStatus } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

const MINUTE_MS = 60_000;

/** How long is left on a request, or how late it is, in whole minutes. */
export function dueLabel(dueAt: string, now: number): { text: string; isLate: boolean } {
  const minutes = Math.round((new Date(dueAt).getTime() - now) / MINUTE_MS);
  if (minutes < 0) return { text: `${-minutes} min late`, isLate: true };
  if (minutes === 0) return { text: "Due now", isLate: false };
  return { text: `${minutes} min left`, isLate: false };
}

export const STATUS_LABEL: Record<MrdFileRequestStatus, string> = {
  requested: "Requested",
  picked: "On the way",
  delivered: "Arrived",
  not_found: "Not found",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<MrdFileRequestStatus, BadgeTone> = {
  requested: "info",
  picked: "primary",
  delivered: "success",
  not_found: "danger",
  cancelled: "neutral",
};

/**
 * The consultation's file chip. `null` when the patient has no paper file:
 * the digital record is the whole record. A paper file with no request says
 * so rather than reading as "no file".
 */
export function visitChip(status: MrdVisitFileStatus): { label: string; tone: BadgeTone } | null {
  if (status.request && status.request.status !== "cancelled") {
    const s = status.request.status;
    return { label: `File: ${STATUS_LABEL[s].toLowerCase()}`, tone: STATUS_TONE[s] };
  }
  if (!isFileRequestable(status)) return null;
  return { label: "File: not requested", tone: "warning" };
}

/**
 * The patient has a paper file and the visit has no live request for it:
 * the chip reads "not requested" and the file can be asked for by hand.
 */
export function isFileRequestable(status: MrdVisitFileStatus): boolean {
  return status.has_physical_file && (!status.request || status.request.status === "cancelled");
}

/** Where the file is now, when someone other than the shelf holds it. */
export function holderText(row: MrdFileRequest): string | null {
  const who = [row.holder_user, row.holder_department].filter(Boolean).join(", ");
  return who ? `Out with ${who}` : null;
}

/** The pull list, grouped by doctor in the order the server sorted it. */
export function groupByDoctor(rows: MrdFileRequest[]): Array<[string, MrdFileRequest[]]> {
  const groups = new Map<string, MrdFileRequest[]>();
  for (const row of rows) {
    const key = row.doctor_name ?? "No doctor named";
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups];
}

/** Tomorrow's date as `YYYY-MM-DD`, on this device's clock. */
export function tomorrowIso(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
