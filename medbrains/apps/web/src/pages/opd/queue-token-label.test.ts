import { describe, expect, it } from "vitest";
import { queueTokenLabel } from "./shared";

/**
 * One patient, two numbering schemes.
 *
 * `opd_queues.token_number` comes from `sequences.OPD_TOKEN`, which is
 * per-tenant and never resets by date; in the seeded database it stood at 434
 * while the boards were calling T-001. `tokens.number` is what the console,
 * the boards and the patient's slip all show. Rendering the integer meant the
 * desk read one number and the waiting room heard another.
 */
describe("queueTokenLabel", () => {
  it("shows the token the patient was actually called by", () => {
    expect(queueTokenLabel({ token_code: "T-001", token_number: 434 })).toBe("T-001");
  });

  it("keeps registration's number when the visit carries one through", () => {
    // number_for_visit hands the first token's number to every later module,
    // so a patient registered as R-007 stays R-007 in OPD. The queue must not
    // relabel them on arrival.
    expect(queueTokenLabel({ token_code: "R-007", token_number: 512 })).toBe("R-007");
  });

  it("marks a queue row that has no token at all", () => {
    // This is a real row in the seeded data: queue entry 435 exists with no
    // token, so that patient is waiting in OPD and appears on no board. It has
    // to look wrong, because it is.
    expect(queueTokenLabel({ token_code: null, token_number: 435 })).toBe("T435 (no token)");
  });

  it("treats an absent field the same as an explicit null", () => {
    // Older cached responses predate the column; they must not render
    // "undefined" into a column a clinician reads.
    expect(queueTokenLabel({ token_number: 7 })).toBe("T007 (no token)");
  });

  it("never silently passes the legacy integer off as a token", () => {
    // The failure this guards: dropping the marker makes a tokenless row
    // indistinguishable from a healthy one, and the defect stops being visible.
    const label = queueTokenLabel({ token_code: null, token_number: 434 });
    expect(label).not.toBe("T434");
    expect(label).toContain("no token");
  });
});
