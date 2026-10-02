import { describe, expect, it } from "vitest";
import { compareKpi, formatKpi, type KpiReading } from "./kpi-reading";

function reading(over: Partial<KpiReading>): KpiReading {
  return {
    value: 40,
    unit: "visits",
    better: "neutral",
    as_of: "2026-10-02", // a Friday
    so_far: false,
    baselines: { weekday: 22, yesterday: 40, week: 35.4 },
    series: [],
    ...over,
  };
}

describe("management KPI wording", () => {
  it("says how far a day is from a usual same weekday", () => {
    expect(compareKpi(reading({}), "weekday")).toEqual({
      text: "18 more than a usual Friday",
      tone: "neutral",
      direction: "up",
    });
  });

  it("compares today with earlier days at the same time of day", () => {
    expect(compareKpi(reading({ so_far: true }), "yesterday")?.text).toBe(
      "Same as yesterday by this time",
    );
  });

  it("colours by the KPI's sense of better, not by the arrow", () => {
    const wait = reading({
      unit: "min",
      better: "lower",
      value: 16.4,
      baselines: { weekday: 12.2, yesterday: 20, week: 16.4 },
    });
    expect(compareKpi(wait, "weekday")).toMatchObject({
      text: "4.2 min longer than a usual Friday",
      tone: "bad",
    });
    expect(compareKpi(wait, "yesterday")).toMatchObject({
      text: "3.6 min shorter than yesterday",
      tone: "good",
    });
  });

  it("speaks of a rate in points", () => {
    const noShow = reading({
      unit: "%",
      better: "lower",
      value: 11.3,
      baselines: { weekday: 8.2, yesterday: null, week: null },
    });
    expect(compareKpi(noShow, "weekday")?.text).toBe("3.1 pts higher than a usual Friday");
  });

  it("makes no comparison when either side is unknown, and shows the unknown as a dash", () => {
    expect(compareKpi(reading({ value: null }), "weekday")).toBeNull();
    expect(
      compareKpi(reading({ baselines: { weekday: null, yesterday: 1, week: 1 } }), "weekday"),
    ).toBeNull();
    expect(formatKpi(null, "min")).toBe("—");
    expect(formatKpi(12.46, "min")).toBe("12.5 min");
    expect(formatKpi(8.25, "%")).toBe("8.3%");
  });
});
