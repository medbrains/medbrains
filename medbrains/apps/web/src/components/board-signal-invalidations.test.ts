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

  it("ignores a kind it does not know", () => {
    // The server may emit events this client predates; an unmapped kind must be
    // inert rather than throwing inside the socket handler.
    expect(boardSignalQueryKeys("lab.result.posted")).toEqual([]);
    expect(boardSignalQueryKeys("")).toEqual([]);
  });
});
