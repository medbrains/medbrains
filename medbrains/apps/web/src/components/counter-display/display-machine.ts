import type { CounterDisplayState } from "@medbrains/types";

/**
 * The customer display's state machine (#4883). The server sends whole
 * snapshots; this decides what the screen shows from the last one, how it is
 * connected, and the clock — and when to announce a payment.
 *
 * Two rules it exists to keep: a "Paid" is announced once per payment, and a
 * screen that has lost the hospital never shows a "Paid" it cannot vouch for.
 */

/** How long "Paid" stays up before the screen returns to idle. */
export const PAID_HOLD_MS = 8_000;

/** `live`: socket open. `polling`: socket down, polling answers. `down`: neither. */
export type DisplayLink = "live" | "polling" | "down";

export type DisplayView = "idle" | "session" | "qr" | "card" | "paid" | "reconnecting";

export interface DisplayModel {
  snapshot: CounterDisplayState | null;
  /** The last payment, held on screen for `PAID_HOLD_MS` even if the drawer closes. */
  paid: CounterDisplayState | null;
  /** When it arrived (client clock). */
  paidAt: number | null;
  /** The last snapshot `seq` whose "Paid" was announced. */
  announcedSeq: number | null;
}

export const INITIAL_MODEL: DisplayModel = {
  snapshot: null,
  paid: null,
  paidAt: null,
  announcedSeq: null,
};

/** Fold a snapshot from the socket or a poll into the model. */
export function reduceDisplay(
  model: DisplayModel,
  state: CounterDisplayState,
  now: number,
): DisplayModel {
  // A heartbeat re-sends the same snapshot: nothing changes, nothing re-announces.
  if (model.snapshot?.seq === state.seq && model.snapshot.session === state.session) {
    return model;
  }
  const isNewPaid = state.phase === "paid" && model.announcedSeq !== state.seq;
  if (!isNewPaid) return { ...model, snapshot: state };
  return { snapshot: state, paid: state, paidAt: now, announcedSeq: state.seq };
}

/** Whether this step is the one that should say "Payment received". */
export function shouldAnnounce(before: DisplayModel, after: DisplayModel): boolean {
  return after.announcedSeq !== null && after.announcedSeq !== before.announcedSeq;
}

/** What the screen shows now. */
export function viewOf(model: DisplayModel, link: DisplayLink, now: number): DisplayView {
  if (link === "down") return "reconnecting";
  const snap = model.snapshot;
  const holding = model.paidAt !== null && now - model.paidAt < PAID_HOLD_MS;
  // The cashier closing the drawer does not cut the patient's "Paid" short;
  // the next patient's session does.
  const sameVisit = !snap || snap.phase === "idle" || snap.session === model.paid?.session;
  if (holding && sameVisit) return "paid";
  const phase = snap?.phase ?? "idle";
  if (phase === "paid") return "idle";
  if (phase === "session" && snap?.tender === "card") return "card";
  return phase;
}

/** Chime first, then the voice: the two never overlap. A blocked chime still speaks. */
export async function announcePayment(
  amountPaise: number,
  deps: { chime: () => Promise<unknown>; speak: (rupees: number) => void },
): Promise<void> {
  await deps.chime().catch(() => undefined);
  deps.speak(amountPaise / 100);
}

/** Reconnect delay after `attempt` failures: 1 s, 2 s, 4 s … capped at 30 s. */
export function backoffMs(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt));
}

/** "4:05" until a QR closes, or null when it has no deadline or has closed. */
export function countdown(closeBy: number | null, nowMs: number): string | null {
  if (closeBy === null) return null;
  const left = Math.floor(closeBy - nowMs / 1000);
  if (left <= 0) return null;
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/** ₹600.00 from paise. */
export function rupeesFromPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
