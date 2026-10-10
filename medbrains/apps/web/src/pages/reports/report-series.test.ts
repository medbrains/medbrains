import { describe, expect, it } from "vitest";
import { reportSeries } from "./report-series";

describe("a report's rows as series", () => {
  it("splits a date repeated per department into a series each", () => {
    const s = reportSeries([
      { date: "2026-10-02", department: "Medicine", visits: 4 },
      { date: "2026-10-01", department: "Medicine", visits: 3 },
      { date: "2026-10-01", department: "Surgery", visits: 2 },
    ]);
    expect(s?.x).toEqual(["2026-10-01", "2026-10-02"]);
    expect(s?.isTrend).toBe(true);
    expect(s?.series).toEqual([
      { name: "Medicine", values: [3, 4] },
      { name: "Surgery", values: [2, null] },
    ]);
  });

  it("adds counts but averages durations when rows share a point", () => {
    const s = reportSeries([
      { date: "2026-10-01", samples: 10, tat_minutes: 30 },
      { date: "2026-10-01", samples: 5, tat_minutes: 40 },
    ]);
    expect(s?.x).toEqual(["2026-10-01"]);
    expect(s?.series).toEqual([
      { name: "Samples", values: [15] },
      { name: "Tat minutes", values: [35] },
    ]);
  });

  it("leaves distinct points as they are, and holds nothing without a number", () => {
    expect(
      reportSeries([
        { ward: "A", occupied: 3 },
        { ward: "B", occupied: 5 },
      ])?.series,
    ).toEqual([{ name: "Occupied", values: [3, 5] }]);
    expect(reportSeries([{ name: "Dr A", status: "expired" }])).toBeNull();
  });
});
