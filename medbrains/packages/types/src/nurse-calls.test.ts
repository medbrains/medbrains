import { describe, expect, it } from "vitest";
import {
  isOpenNurseCall,
  nurseCallWaitParts,
  openNurseCalls,
  overdueNurseCalls,
} from "./nurse-calls.js";

describe("what counts as an open call", () => {
  it("keeps an acknowledged call open", () => {
    // "Seen" is a nurse taking the call, not answering it. If this ever
    // returns false the wall board goes quiet the moment somebody looks at it
    // — which is the exact moment it should stay loud.
    expect(isOpenNurseCall("acknowledged")).toBe(true);
  });

  it("closes a call that was completed or cancelled", () => {
    expect(isOpenNurseCall("completed")).toBe(false);
    expect(isOpenNurseCall("cancelled")).toBe(false);
  });

  it("treats an unknown status as closed rather than guessing", () => {
    // A status this build has never heard of belongs to a newer server. Showing
    // it as open would park an unremovable card on the ward wall.
    expect(isOpenNurseCall("escalated_to_rapid_response")).toBe(false);
  });

  it("filters a mixed list down to what is still owed a visit", () => {
    const calls = [
      { status: "pending" },
      { status: "completed" },
      { status: "acknowledged" },
      { status: "cancelled" },
    ];
    expect(openNurseCalls(calls)).toEqual([{ status: "pending" }, { status: "acknowledged" }]);
  });
});

describe("overdue counting", () => {
  it("counts everything the server escalated, not just the worst", () => {
    const calls = [
      { escalation: "normal" as const },
      { escalation: "charge_nurse" as const },
      { escalation: "supervisor" as const },
    ];
    expect(overdueNurseCalls(calls)).toHaveLength(2);
  });
});

describe("wait formatting", () => {
  it("pads seconds so a column on a wall does not jitter", () => {
    expect(nurseCallWaitParts(67)).toEqual({ minutes: 1, seconds: "07" });
  });

  it("clamps a device clock that runs ahead of the server", () => {
    expect(nurseCallWaitParts(-5)).toEqual({ minutes: 0, seconds: "00" });
  });
});
