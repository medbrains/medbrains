import { describe, expect, it } from "vitest";
import { fireStatus, inspectionProblem, isBlocking } from "./fire-check.js";

const TODAY = "2026-08-08";

describe("fireStatus", () => {
  it("reports expired when the expiry date has passed", () => {
    expect(fireStatus({ expiry_date: "2026-01-01" }, TODAY)).toBe("expired");
  });

  it("treats today as already due, not still valid", () => {
    // A cylinder expiring today is not one to sign off on the round.
    expect(fireStatus({ expiry_date: TODAY }, TODAY)).toBe("expired");
  });

  it("prefers expired over refill_due when both have passed", () => {
    // Reporting the lesser problem would let someone sign off a dead cylinder.
    const status = fireStatus({ expiry_date: "2025-01-01", next_refill_date: "2025-06-01" }, TODAY);
    expect(status).toBe("expired");
  });

  it("reports refill_due when only the refill date has passed", () => {
    const status = fireStatus({ expiry_date: "2030-01-01", next_refill_date: "2026-07-01" }, TODAY);
    expect(status).toBe("refill_due");
  });

  it("is ok when both dates are ahead", () => {
    expect(fireStatus({ expiry_date: "2030-01-01", next_refill_date: "2027-01-01" }, TODAY)).toBe(
      "ok",
    );
  });

  it("is unknown, not ok, when no dates are recorded", () => {
    // Unproven is not the same as good — this is the mistake the screen exists
    // to prevent.
    expect(fireStatus({}, TODAY)).toBe("unknown");
    expect(fireStatus({ expiry_date: null, next_refill_date: "" }, TODAY)).toBe("unknown");
  });
});

describe("isBlocking", () => {
  it("blocks on expired, refill due and unknown", () => {
    expect(isBlocking("expired")).toBe(true);
    expect(isBlocking("refill_due")).toBe(true);
    expect(isBlocking("unknown")).toBe(true);
  });

  it("does not block on ok", () => {
    expect(isBlocking("ok")).toBe(false);
  });
});

describe("inspectionProblem", () => {
  it("requires findings on a failed check", () => {
    expect(inspectionProblem({ is_functional: false, findings: "" })).toBeTruthy();
  });

  it("accepts a failed check that says what is wrong", () => {
    expect(
      inspectionProblem({ is_functional: false, findings: "Gauge in red, seal broken" }),
    ).toBeNull();
  });

  it("does not demand findings on a passed check", () => {
    expect(inspectionProblem({ is_functional: true, findings: "" })).toBeNull();
  });
});
