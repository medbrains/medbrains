// Report charts, drawn only from the report's own rows. A chart with no data
// behind it is not drawn: a sample picture on a report page reads as the
// hospital's figures, and an empty month must look empty.

import type { EChartsTemplate } from "@medbrains/types";
import type { EChartsCoreOption } from "@/components/Reports/ReportChart";
import { reportSeries } from "./report-series";
import type { ReportDefinition, ReportRuntimeData } from "./types";

export function templateForReport(report: ReportDefinition): EChartsTemplate {
  if (report.echartsTemplate) return report.echartsTemplate;

  const grammar = report.chartTypes.join(" ").toLowerCase();
  if (grammar.includes("bar race")) return "bar_race";
  if (grammar.includes("waterfall")) return "bar_waterfall";
  if (grammar.includes("calendar")) return "heatmap_calendar";
  if (grammar.includes("boxplot")) return "boxplot";
  if (grammar.includes("sankey")) return "sankey";
  if (grammar.includes("graph") || grammar.includes("network")) return "graph_network";
  if (grammar.includes("radar") || report.visualKind === "radar") return "radar";
  if (grammar.includes("sunburst")) return "sunburst";
  if (grammar.includes("treemap") || report.visualKind === "treemap") return "treemap";
  if (grammar.includes("funnel") || report.visualKind === "funnel") return "funnel";
  if (grammar.includes("gauge") || report.visualKind === "gauge") return "gauge";
  if (grammar.includes("geo scatter") || grammar.includes("effect scatter")) {
    return "effect_scatter_map";
  }
  if (grammar.includes("map") || report.visualKind === "map") return "geo_map";
  if (grammar.includes("pictorial")) return "pictorial_bar";
  if (grammar.includes("custom svg") || report.visualKind === "body") return "custom_svg";
  if (grammar.includes("timeline")) return "timeline";
  if (grammar.includes("parallel")) return "parallel_coordinates";
  if (grammar.includes("theme")) return "theme_river";
  if (grammar.includes("candlestick") || grammar.includes("ohlc")) return "candlestick_ohlc";
  if (grammar.includes("area")) return "area_stack";
  if (grammar.includes("stacked bar")) return "bar_stack";
  if (grammar.includes("gradient") || report.visualKind === "forecast") return "line_gradient";
  if (report.visualKind === "heatmap" || report.visualKind === "matrix") return "heatmap_cartesian";
  return "line_stack";
}

/** The three reports with a chart drawn for their own columns. */
function bespokeOption(
  report: ReportDefinition,
  runtimeData: ReportRuntimeData,
): EChartsCoreOption | null {
  if (report.id === "opd-registration-arrivals" && runtimeData.opdFootfall.length > 0) {
    const rows = runtimeData.opdFootfall;
    return {
      color: ["#1c7ed6", "#12b886", "#7950f2"],
      tooltip: { trigger: "axis" },
      legend: { bottom: 0 },
      grid: { left: 44, right: 18, top: 28, bottom: 54 },
      xAxis: { type: "category", data: rows.map((row) => row.date.slice(5)) },
      yAxis: { type: "value", minInterval: 1 },
      series: [
        { name: "Visits", type: "line", smooth: true, data: rows.map((row) => row.visit_count) },
        { name: "New", type: "bar", stack: "patients", data: rows.map((row) => row.new_patients) },
        {
          name: "Follow-up",
          type: "bar",
          stack: "patients",
          data: rows.map((row) => row.follow_ups),
        },
      ],
    };
  }
  if (report.id === "ipd-census-bed-occupancy" && runtimeData.bedOccupancy.length > 0) {
    const rows = runtimeData.bedOccupancy;
    return {
      color: ["#fa5252", "#12b886", "#1c7ed6"],
      tooltip: { trigger: "axis" },
      legend: { bottom: 0 },
      grid: { left: 44, right: 18, top: 28, bottom: 62 },
      xAxis: {
        type: "category",
        data: rows.map((row) => row.ward_name),
        axisLabel: { interval: 0, rotate: rows.length > 5 ? 24 : 0 },
      },
      yAxis: { type: "value" },
      series: [
        { name: "Occupied", type: "bar", stack: "beds", data: rows.map((row) => row.occupied) },
        { name: "Vacant", type: "bar", stack: "beds", data: rows.map((row) => row.vacant) },
        { name: "Occupancy %", type: "line", data: rows.map((row) => row.occupancy_pct) },
      ],
    };
  }
  if (report.id === "opd-no-show-revisit" && runtimeData.noShows.length > 0) {
    const rows = runtimeData.noShows.slice(0, 8);
    return {
      color: ["#f76707"],
      tooltip: { trigger: "axis" },
      grid: { left: 44, right: 18, top: 24, bottom: 42 },
      xAxis: {
        type: "category",
        data: rows.map((row, index) => row.department_id ?? row.doctor_id ?? `Group ${index + 1}`),
      },
      yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
      series: [
        {
          name: "No-show %",
          type: "bar",
          data: rows.map((row) => Math.round((row.noshow_rate ?? 0) * 1000) / 10),
        },
      ],
    };
  }
  return null;
}

/**
 * A chart of any report's rows (see `reportSeries`): dates make a line,
 * categories bars, the axis from zero; `stacked` draws each period's groups
 * as one stacked bar. Null when the rows hold no number.
 */
export function rowsOption(
  rows: Record<string, unknown>[],
  stacked = false,
): EChartsCoreOption | null {
  const shape = reportSeries(rows);
  if (!shape) return null;
  return {
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 48, right: 18, top: 24, bottom: 54 },
    xAxis: { type: "category", data: shape.x, axisLabel: { hideOverlap: true } },
    yAxis: { type: "value", min: 0 },
    series: shape.series.map((s) => ({
      name: s.name,
      type: shape.isTrend && !stacked ? "line" : "bar",
      ...(stacked ? { stack: "total" } : {}),
      connectNulls: true,
      data: s.values,
    })),
  };
}

/** The report's chart from its data, or null when there is nothing real to draw. */
export function optionForReport(
  report: ReportDefinition,
  runtimeData: ReportRuntimeData,
  rows: unknown[] | undefined,
): EChartsCoreOption | null {
  const bespoke = bespokeOption(report, runtimeData);
  if (bespoke) return bespoke;
  if (!rows || rows.length === 0) return null;
  return rowsOption(rows as Record<string, unknown>[], templateForReport(report) === "bar_stack");
}
