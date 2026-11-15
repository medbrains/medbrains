// @vitest-environment node

import { useLocaleStore } from "@medbrains/stores";
import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./shared";

describe("patient detail formatters", () => {
  it("show a bad date as it came instead of taking the tab down", () => {
    useLocaleStore.setState({ profile: null, profileStatus: "failed" });
    expect(formatDate("not-a-date")).toBe("not-a-date");
    expect(formatDate("2026-13-45")).toBe("2026-13-45");
    expect(formatDate(null)).toBe("-");
  });

  it("format with the hospital's profile once it loads", () => {
    useLocaleStore.getState().setProfile({
      pack: "in",
      values: { locale: "en-IN", currency: "INR", timezone: "Asia/Kolkata" },
      sources: {},
      missing: [],
      units: {},
      date_format: null,
    });
    expect(formatDate("1990-03-05")).toBe("5 Mar 1990");
    expect(formatMoney("1234567.5")).toBe("₹12,34,567.50");
  });
});
