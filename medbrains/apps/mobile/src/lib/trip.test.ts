import { describe, expect, it } from "vitest";
import { checkTripClose, isPending } from "./trip.js";

const c = (id: string, status: string) => ({ id, status });

describe("isPending", () => {
  it("counts every stage before the visit has happened", () => {
    for (const status of ["scheduled", "assigned", "in_transit", "arrived"]) {
      expect(isPending(c("x", status))).toBe(true);
    }
  });

  it("does not count a resolved collection", () => {
    for (const status of ["collected", "returned_to_lab", "cancelled"]) {
      expect(isPending(c("x", status))).toBe(false);
    }
  });

  it("treats an unrecognised status as resolved rather than blocking forever", () => {
    // A status this build does not know about must not make the trip
    // impossible to close — that would strand the phlebotomist.
    expect(isPending(c("x", "some_future_status"))).toBe(false);
  });
});

describe("checkTripClose", () => {
  it("allows closing when everything is resolved", () => {
    const check = checkTripClose([c("1", "collected"), c("2", "cancelled")]);
    expect(check.canEnd).toBe(true);
    expect(check.outstanding).toHaveLength(0);
  });

  it("blocks closing while a visit is still pending", () => {
    // Those patients are expecting a phlebotomist who is no longer coming, and
    // nothing else in the system would say so.
    const check = checkTripClose([c("1", "collected"), c("2", "assigned")]);
    expect(check.canEnd).toBe(false);
    expect(check.outstanding.map((o) => o.id)).toEqual(["2"]);
  });

  it("names every outstanding collection, not just the first", () => {
    const check = checkTripClose([c("1", "scheduled"), c("2", "arrived"), c("3", "collected")]);
    expect(check.outstanding.map((o) => o.id)).toEqual(["1", "2"]);
  });

  it("allows closing an empty trip", () => {
    // Nothing was assigned; there is nothing to strand.
    expect(checkTripClose([]).canEnd).toBe(true);
  });
});
