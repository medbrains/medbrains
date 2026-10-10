import { describe, expect, it } from "vitest";
import { optionForReport, rowsOption } from "./chart-options";
import type { ReportDefinition, ReportRuntimeData } from "./types";

const empty: ReportRuntimeData = { opdFootfall: [], bedOccupancy: [], noShows: [] };
const report = (id: string) =>
  ({ id, dataEndpoint: `/api/reports/${id}/data` }) as ReportDefinition;

describe("report charts", () => {
  it("draws nothing when a report has no rows — never a sample", () => {
    expect(optionForReport(report("lab-tat"), empty, [])).toBeNull();
    expect(optionForReport(report("opd-registration-arrivals"), empty, undefined)).toBeNull();
  });

  it("charts a report's own rows: dates as a line, numbers as series", () => {
    const option = rowsOption([
      { date: "2026-10-01", department_id: "x", tat_minutes: 42, samples: 10 },
      { date: "2026-10-02", department_id: "y", tat_minutes: 38, samples: 12 },
    ]) as { xAxis: { data: string[] }; series: { name: string; type: string; data: number[] }[] };
    expect(option.xAxis.data).toEqual(["2026-10-01", "2026-10-02"]);
    expect(option.series.map((s) => [s.name, s.type])).toEqual([
      ["Tat minutes", "line"],
      ["Samples", "line"],
    ]);
    expect(option.series[0]?.data).toEqual([42, 38]);
  });

  it("charts categories as bars, and holds nothing to draw without a number", () => {
    const bars = rowsOption([{ ward: "A", occupied: 3 }]) as { series: { type: string }[] };
    expect(bars.series[0]?.type).toBe("bar");
    expect(rowsOption([{ name: "Dr A", status: "expired" }])).toBeNull();
  });
});
