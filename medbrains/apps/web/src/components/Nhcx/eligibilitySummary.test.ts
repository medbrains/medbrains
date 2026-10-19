import type { NhcxEligibilityCheck } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  formatBenefitValue,
  formatMinutes,
  summariseEligibility,
  summariseSla,
} from "./eligibilitySummary";

const check = (over: Partial<NhcxEligibilityCheck>): NhcxEligibilityCheck => ({
  id: "c1",
  patient_id: "p1",
  trigger_point: "front_office",
  status: "pending",
  payer_name: "Payer",
  nhcx_recipient_code: "payer@sbx",
  nhcx_status: "sent",
  nhcx_disposition: null,
  nhcx_result: null,
  coverage_start: null,
  coverage_end: null,
  error_message: null,
  created_at: "2026-10-19T10:00:00Z",
  nhcx_submitted_at: null,
  nhcx_response_at: null,
  ...over,
});

describe("summariseEligibility", () => {
  it("never reads a pending check as not covered", () => {
    const s = summariseEligibility(check({ status: "pending" }));
    expect(s.isWaiting).toBe(true);
    expect(s.label).not.toMatch(/not in force|not covered/i);
  });

  it("names a refused send as the payer not reachable", () => {
    expect(summariseEligibility(check({ nhcx_status: "send_failed" })).label).toMatch(
      /could not be reached/,
    );
  });

  it("tells in force from not in force from silence", () => {
    expect(summariseEligibility(check({ status: "active" })).tone).toBe("success");
    expect(summariseEligibility(check({ status: "inactive" })).label).toBe("Policy not in force");
    expect(summariseEligibility(check({ status: "unknown" })).tone).toBe("warning");
  });
});

describe("formatting", () => {
  it("formats money, units and words", () => {
    expect(formatBenefitValue(500000, "INR")).toBe("₹5,00,000");
    expect(formatBenefitValue(30, null)).toBe("30");
    expect(formatBenefitValue("As per policy", null)).toBe("As per policy");
    expect(formatBenefitValue(null, "INR")).toBe("—");
  });

  it("formats minutes", () => {
    expect(formatMinutes(42)).toBe("42 min");
    expect(formatMinutes(65)).toBe("1 h 5 min");
    expect(formatMinutes(180)).toBe("3 h");
  });
});

describe("summariseSla", () => {
  it("says a breach in words, not only in colour", () => {
    const s = summariseSla({ limit_minutes: 60, elapsed_minutes: 85, state: "breached" });
    expect(s.isBreached).toBe(true);
    expect(s.label).toBe("Over the 1 h limit by 25 min");
  });

  it("shows a running clock against its limit", () => {
    expect(summariseSla({ limit_minutes: 180, elapsed_minutes: 30, state: "running" }).label).toBe(
      "30 min of 3 h — waiting",
    );
    expect(
      summariseSla({ limit_minutes: 60, elapsed_minutes: null, state: "not_started" }).label,
    ).toBe("Not sent yet");
  });
});
