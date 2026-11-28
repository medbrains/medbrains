import type { ContrastScreeningResult } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { contrastScreeningTitle, contrastScreeningTone } from "./contrast-screening-title";

/** A screening result with `clearance` and no eGFR. */
function screen(clearance: string, egfr: number | null = null): ContrastScreeningResult {
  return {
    egfr,
    egfr_measured_on: egfr == null ? null : "2026-11-20",
    cin_risk: egfr == null ? "not_checked" : "low",
    reaction_risk: "none",
    metformin_action: "not_applicable",
    clearance,
    flags: [],
  };
}

describe("the pre-contrast screening alert", () => {
  it("asks for a creatinine/eGFR when none qualifies, in danger", () => {
    const s = screen("egfr_required");
    expect(contrastScreeningTitle(s)).toMatch(/creatinine\/eGFR needed before contrast/);
    expect(contrastScreeningTone(s)).toBe("danger");
  });

  it("shows only a clean proceed as success, and anything unknown as danger", () => {
    expect(contrastScreeningTone(screen("proceed", 90))).toBe("success");
    expect(contrastScreeningTone(screen("proceed_with_caution", 40))).toBe("warning");
    expect(contrastScreeningTone(screen("hold_review", 25))).toBe("danger");
    expect(contrastScreeningTone(screen("something_new"))).toBe("danger");
  });

  it("names the eGFR and the day it was taken", () => {
    expect(contrastScreeningTitle(screen("proceed", 90))).toBe(
      "Pre-contrast screening — proceed · eGFR 90 on 2026-11-20",
    );
  });
});
