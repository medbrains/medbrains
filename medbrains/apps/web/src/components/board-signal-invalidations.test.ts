import { describe, expect, it } from "vitest";
import { boardSignalQueryKeys } from "./board-signal-invalidations";

describe("boardSignalQueryKeys", () => {
  it("refreshes every queue surface when the queue moves", () => {
    // A called token has to leave the OPD list, the TV token board and the
    // per-department state panel together, or the screens disagree about who
    // is next.
    expect(boardSignalQueryKeys("opd.queue.changed")).toEqual([
      "opd-queue",
      "queue-tokens",
      "queue-state",
    ]);
  });

  it("keeps a vitals signal off the token boards", () => {
    // Vitals change who is waiting at the counter, not whose token is called.
    expect(boardSignalQueryKeys("opd.vitals.recorded")).toEqual(["opd-queue"]);
  });

  it("refreshes the critical-alert list when a result is posted", () => {
    // A posted result can be a critical value. A board that has not shown one
    // yet is the single case where staleness matters clinically, so the alert
    // list refreshes with the order list rather than waiting for its own poll.
    expect(boardSignalQueryKeys("lab.result.posted")).toContain("lab-critical-alerts");
    expect(boardSignalQueryKeys("lab.result.verified")).toContain("lab-critical-alerts");
  });

  it("ignores a kind it does not know", () => {
    // The server may emit events this client predates; an unmapped kind must be
    // inert rather than throwing inside the socket handler.
    expect(boardSignalQueryKeys("radiology.order.completed")).toEqual([]);
    expect(boardSignalQueryKeys("")).toEqual([]);
  });
});
