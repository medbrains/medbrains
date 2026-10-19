import type { AbdmDashboardMonth } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  formatPercent,
  monthOptions,
  percentOf,
  thresholdProgress,
  trendRows,
} from "./abdm-dashboard";

function month(): AbdmDashboardMonth {
  return {
    month: "2026-10-01",
    opd_visits: 0,
    opd_with_abha: 0,
    abha_patients: 0,
    kyc_patients: 0,
    abhas_created: 0,
    shares: 0,
    shares_completed: 0,
    shares_expired: 0,
    hip_consents_granted: 0,
    hip_consents_denied: 0,
    hip_consents_revoked: 0,
    hiu_consents_granted: 0,
    hiu_consents_denied: 0,
    hiu_consents_revoked: 0,
    dhis: {
      month: "2026-10-01",
      linked_category_1: 2,
      linked_category_2: 3,
      eligible_category_1: 1,
      eligible_category_2: 3,
      hiu_eligible_consents: 1,
    },
    estimate: {
      threshold: 100,
      eligible_links: 4,
      threshold_met: false,
      hip_inr: 30,
      hiu_inr: 10,
      payable_inr: 0,
    },
  };
}

describe("ABDM dashboard model", () => {
  it("shows no percent, not 0%, when nothing was measured", () => {
    expect(percentOf(0, 0)).toBeNull();
    expect(formatPercent(percentOf(0, 0))).toBe("—");
    expect(formatPercent(percentOf(0, 4))).toBe("0%");
    expect(percentOf(3, 4)).toBe(75);
  });

  it("caps the threshold bar at full once DHIS is passed", () => {
    expect(thresholdProgress(5, 100)).toBe(5);
    expect(thresholdProgress(250, 100)).toBe(100);
  });

  it("lists months newest first across a year boundary", () => {
    const months = monthOptions(new Date(2026, 0, 15), 3).map((m) => m.value);
    expect(months).toEqual(["2026-01", "2025-12", "2025-11"]);
  });

  it("adds both link categories and both incentives for a trend month", () => {
    const [row] = trendRows([month()]);
    expect(row).toMatchObject({
      linked: 5,
      eligible: 4,
      estimateInr: 40,
      opdWithAbhaPercent: null,
    });
  });
});
