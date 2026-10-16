import { ApiError } from "@medbrains/api";
import { describe, expect, it } from "vitest";
import { recalibrationRequest } from "../bme/recalibrate-drawer";
import { describeMatchError } from "./mother-baby-match-panel";

describe("describeMatchError", () => {
  it("a 409 is a refusal: do not hand over, in the server's words", () => {
    const r = describeMatchError(new ApiError("Band mismatch — do not hand this baby over.", 409));
    expect(r.title).toMatch(/do not match/);
    expect(r.message).toBe("Band mismatch — do not hand this baby over.");
  });

  it("an outage is never shown as a match", () => {
    const r = describeMatchError(new ApiError("Service unavailable", 503));
    expect(r.title).toBe("The match could not be checked");
    expect(r.message).toMatch(/not a match/);
  });
});

describe("recalibrationRequest", () => {
  const base = {
    last_calibrated_date: "2026-10-12",
    next_due_date: "2027-10-12",
    certificate_number: "CAL-1",
    calibrated_by: "",
  };

  it("a passing result is recorded as calibrated — the only status that lifts a lock", () => {
    const body = recalibrationRequest({ ...base, is_in_tolerance: true });
    expect(body.calibration_status).toBe("calibrated");
    expect(body.calibrated_by).toBeUndefined();
  });

  it("an out-of-tolerance result keeps the lock", () => {
    const body = recalibrationRequest({ ...base, is_in_tolerance: false });
    expect(body.calibration_status).toBe("out_of_tolerance");
    expect(body.is_in_tolerance).toBe(false);
  });
});
