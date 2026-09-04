import type { PortalAppointment, PortalInvoice, PortalLabReport } from "@medbrains/types";

/**
 * What, if anything, is waiting for this patient.
 *
 * The portal opens on a list, which asks somebody frightened to search before
 * it tells them anything. This derives the answer from the records they can
 * already see — no new endpoint — so the first thing on screen is whether
 * anything needs them.
 */
export interface PortalWaiting {
  /** Results released in the last week, newest first. */
  newResults: PortalLabReport[];
  /** The next appointment that has not passed. */
  nextAppointment: PortalAppointment | null;
  /** Total still owed across unsettled invoices. */
  amountOwed: number;
  /** True when nothing at all needs the patient — said out loud, not implied. */
  nothingWaiting: boolean;
}

const RECENT_DAYS = 7;

function isRecent(iso: string, now: number): boolean {
  const at = new Date(iso).getTime();
  return Number.isFinite(at) && now - at <= RECENT_DAYS * 86_400_000 && at <= now;
}

export function portalWaiting(
  input: {
    reports: readonly PortalLabReport[];
    appointments: readonly PortalAppointment[];
    bills: readonly PortalInvoice[];
  },
  now: number,
): PortalWaiting {
  const newResults = [...input.reports]
    .filter((r) => isRecent(r.reported_at, now))
    .sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());

  // The next one that has not happened. A cancelled appointment is not
  // something waiting for them.
  const nextAppointment =
    [...input.appointments]
      .filter(
        (a) =>
          a.status?.toLowerCase() !== "cancelled" && new Date(a.appointment_date).getTime() >= now,
      )
      .sort(
        (a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime(),
      )[0] ?? null;

  const amountOwed = input.bills.reduce((total, bill) => {
    const due = Number.parseFloat(bill.balance_due);
    return total + (Number.isFinite(due) && due > 0 ? due : 0);
  }, 0);

  return {
    newResults,
    nextAppointment,
    amountOwed,
    nothingWaiting: newResults.length === 0 && nextAppointment === null && amountOwed <= 0,
  };
}
