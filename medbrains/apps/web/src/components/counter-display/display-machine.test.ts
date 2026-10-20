import type { CounterDisplayState } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import {
  announcePayment,
  backoffMs,
  countdown,
  INITIAL_MODEL,
  PAID_HOLD_MS,
  reduceDisplay,
  shouldAnnounce,
  viewOf,
} from "./display-machine";

const IDLE: CounterDisplayState = {
  seq: 0,
  session: null,
  phase: "idle",
  patient: null,
  lines: [],
  total_due_paise: 0,
  tender: null,
  amount_paise: 0,
  qr: null,
  card_status: null,
  change_paise: null,
};

const snap = (over: Partial<CounterDisplayState>): CounterDisplayState => ({
  ...IDLE,
  session: "s1",
  ...over,
});

describe("customer display state machine", () => {
  it("walks session → QR → paid → idle as the cashier works", () => {
    let m = reduceDisplay(INITIAL_MODEL, snap({ seq: 1, phase: "session" }), 0);
    expect(viewOf(m, "live", 0)).toBe("session");
    m = reduceDisplay(m, snap({ seq: 2, phase: "qr", qr: qrOf() }), 10);
    expect(viewOf(m, "live", 10)).toBe("qr");
    m = reduceDisplay(m, snap({ seq: 3, phase: "paid", amount_paise: 60_000 }), 1_000);
    expect(viewOf(m, "live", 1_000)).toBe("paid");
    expect(viewOf(m, "live", 1_000 + PAID_HOLD_MS - 1)).toBe("paid");
    // Returns to idle on its own: the next patient never sees the last "Paid".
    expect(viewOf(m, "live", 1_000 + PAID_HOLD_MS)).toBe("idle");
  });

  it("keeps Paid up when the drawer closes, but not over the next patient", () => {
    let m = reduceDisplay(INITIAL_MODEL, snap({ seq: 3, phase: "paid", amount_paise: 100 }), 0);
    m = reduceDisplay(m, { ...IDLE, seq: 4 }, 500);
    expect(viewOf(m, "live", 600)).toBe("paid");
    expect(m.paid?.amount_paise).toBe(100);
    m = reduceDisplay(m, snap({ seq: 5, session: "s2", phase: "session" }), 700);
    expect(viewOf(m, "live", 800)).toBe("session");
  });

  it("shows the card prompt while the cashier is on the card tender", () => {
    const m = reduceDisplay(INITIAL_MODEL, snap({ seq: 1, phase: "session", tender: "card" }), 0);
    expect(viewOf(m, "live", 0)).toBe("card");
  });

  it("announces a payment once, not on every heartbeat or reconnect", () => {
    const paid = snap({ seq: 5, phase: "paid", amount_paise: 100 });
    const first = reduceDisplay(INITIAL_MODEL, paid, 0);
    expect(shouldAnnounce(INITIAL_MODEL, first)).toBe(true);
    const heartbeat = reduceDisplay(first, paid, 20_000);
    expect(heartbeat).toBe(first);
    expect(shouldAnnounce(first, heartbeat)).toBe(false);
    const next = reduceDisplay(first, snap({ seq: 9, session: "s2", phase: "paid" }), 30_000);
    expect(shouldAnnounce(first, next)).toBe(true);
  });

  it("says Reconnecting and never a stale Paid while the hospital is unreachable", () => {
    const m = reduceDisplay(INITIAL_MODEL, snap({ seq: 3, phase: "paid" }), 0);
    expect(viewOf(m, "down", 1)).toBe("reconnecting");
    // Polling keeps the screen honest while the socket is down.
    expect(viewOf(m, "polling", 1)).toBe("paid");
    // Back after the hold: the old payment is not shown again.
    expect(viewOf(m, "live", PAID_HOLD_MS + 1)).toBe("idle");
  });

  it("backs off reconnects up to 30 seconds", () => {
    expect([0, 1, 2, 5, 10].map(backoffMs)).toEqual([1_000, 2_000, 4_000, 30_000, 30_000]);
  });

  it("counts down to the QR's close", () => {
    expect(countdown(1_000, 1_000_000 - 245_000)).toBe("4:05");
    expect(countdown(1_000, 1_000_000)).toBeNull();
    expect(countdown(null, 0)).toBeNull();
  });
});

describe("payment announcement", () => {
  it("plays the chime first, then speaks — never over each other", async () => {
    const order: string[] = [];
    let endChime: () => void = () => undefined;
    const chime = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          order.push("chime");
          endChime = resolve;
        }),
    );
    const speak = vi.fn((rupees: number) => order.push(`speak ${rupees}`));
    const done = announcePayment(60_000, { chime, speak });
    await Promise.resolve();
    expect(speak).not.toHaveBeenCalled();
    endChime();
    await done;
    expect(order).toEqual(["chime", "speak 600"]);
  });

  it("still speaks when the browser refuses the chime", async () => {
    const speak = vi.fn();
    await announcePayment(100, { chime: () => Promise.reject(new Error("blocked")), speak });
    expect(speak).toHaveBeenCalledWith(1);
  });
});

function qrOf() {
  return { upi_uri: "upi://pay?pa=x@y", image_url: null, close_by: null };
}
