import type { DashboardWidget } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { widgetAiContext } from "./widget-ai-context";

const widget = (widget_type: string, config: Record<string, unknown> = {}) =>
  ({
    id: "w",
    title: "Recent Admissions",
    subtitle: null,
    widget_type,
    config,
  }) as unknown as DashboardWidget;

describe("what the assistant is told about a widget", () => {
  it("gets a table's shape, never its rows of people", () => {
    const data = { items: [{ patient_name: "Asha Rao", department: "Medicine" }] };
    const ctx = widgetAiContext(widget("data_table"), data, "weekday");
    expect(ctx).toMatchObject({ row_count: 1, columns: ["patient_name", "department"] });
    expect(JSON.stringify(ctx)).not.toContain("Asha Rao");
  });

  it("gets a KPI's figures and what it is set against", () => {
    const reading = {
      value: 3,
      unit: "visits",
      better: "neutral",
      as_of: "2026-10-10",
      so_far: true,
      baselines: { weekday: 5, yesterday: 4, week: 6 },
      series: [{ date: "2026-10-10", value: 3 }],
    };
    const ctx = widgetAiContext(widget("stat_card"), reading, "week");
    expect(ctx).toMatchObject({ value: 3, compared_with: "week", baselines: { week: 6 } });
  });

  it("gets a report widget's chart, not its rows", () => {
    const w = {
      ...widget("chart"),
      data_source: { type: "report", report_id: "credential-expiry" },
    } as unknown as DashboardWidget;
    const ctx = widgetAiContext(w, { report_id: "credential-expiry" }, "weekday", {
      x: ["2026-10-01"],
      series: [{ name: "Expiring", values: [2] }],
      isTrend: true,
    });
    expect(ctx).toMatchObject({ report_id: "credential-expiry", x: ["2026-10-01"] });
    expect(ctx).not.toHaveProperty("rows");
  });
});
