import type { DashboardWidget } from "@medbrains/types";
import { isKpiReading, type KpiBaseline } from "./kpi-reading";
import { field, rows } from "./widget-data";

/** The most points of a series handed to the assistant. */
const MAX_POINTS = 30;

/**
 * What the assistant is told about a widget: its figures, never its rows of
 * people. A KPI or a chart is an aggregate — counts by day or category — and
 * goes as it is. A table can hold patients' names, so it goes as its columns
 * and its size only.
 */
export function widgetAiContext(widget: DashboardWidget, data: unknown, compare: KpiBaseline) {
  const base = { surface: "dashboard_widget", widget: widget.title, subtitle: widget.subtitle };
  if (isKpiReading(data)) {
    return {
      ...base,
      value: data.value,
      unit: data.unit,
      as_of: data.as_of,
      so_far_today: data.so_far,
      compared_with: compare,
      baselines: data.baselines,
      daily: data.series.slice(-MAX_POINTS),
    };
  }
  if (widget.widget_type === "chart") {
    return {
      ...base,
      x: field(widget.config, "x_axis"),
      y: field(widget.config, "y_axis"),
      points: rows(data).slice(-MAX_POINTS),
    };
  }
  if (widget.widget_type === "stat_card") return { ...base, value: field(data, "value") };
  const items = rows(data);
  return { ...base, row_count: items.length, columns: Object.keys(items[0] ?? {}) };
}
