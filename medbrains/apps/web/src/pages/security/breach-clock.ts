// The reporting clocks on a security incident, read for the screen. The server
// computes the deadlines (`cert_in_due_at`, `board_due_at`) from when the incident
// was noticed; this only turns a deadline and a filing time into words and a tone.

import type { SecurityIncident } from "@medbrains/types";

export type ClockTone = "success" | "warning" | "danger";

export interface ClockState {
  label: string;
  text: string;
  tone: ClockTone;
}

const MINUTE_MS = 60_000;
/** Under this much time left, the clock turns red before it expires. */
const URGENT_MINUTES = 60;

function span(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** One clock: filed, running or overdue. `null` when the clock does not apply. */
export function clockState(
  label: string,
  dueAt: string | null,
  filedAt: string | null,
  now: number,
): ClockState | null {
  if (!dueAt) return null;
  const due = Date.parse(dueAt);
  if (filedAt) {
    const late = Math.round((Date.parse(filedAt) - due) / MINUTE_MS);
    return late > 0
      ? { label, text: `filed ${span(late)} late`, tone: "warning" }
      : { label, text: "filed", tone: "success" };
  }
  const left = Math.round((due - now) / MINUTE_MS);
  if (left <= 0) return { label, text: `overdue by ${span(-left)}`, tone: "danger" };
  return {
    label,
    text: `${span(left)} left`,
    tone: left <= URGENT_MINUTES ? "danger" : "warning",
  };
}

/** Both statutory clocks for an incident, in the order they fall due. */
export function incidentClocks(incident: SecurityIncident, now: number): ClockState[] {
  return [
    clockState("CERT-In", incident.cert_in_due_at, incident.cert_in_report_date, now),
    clockState("Board report", incident.board_due_at, incident.board_report_sent_at, now),
  ].filter((c): c is ClockState => c !== null);
}
