// Reports ECharts option builders — one function per visual template, dispatched by
// optionForReport. Pure move from reports.tsx.

import type { EChartsTemplate } from "@medbrains/types";
import type { EChartsCoreOption } from "@/components/Reports/ReportChart";
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

function commandOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#12b886", "#f59f00", "#e03131"],
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 30, bottom: 54 },
    xAxis: { type: "category", data: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"] },
    yAxis: { type: "value" },
    series: [
      { name: "OPD", type: "line", smooth: true, data: [90, 240, 330, 280, 210, 160] },
      { name: "Beds", type: "line", smooth: true, data: [72, 76, 81, 84, 83, 80] },
      { name: "Lab breach", type: "bar", data: [3, 8, 11, 9, 5, 4] },
      { name: "Red flags", type: "bar", data: [1, 4, 6, 3, 2, 2] },
    ],
  };
}

function lineOption(report: ReportDefinition, runtimeData: ReportRuntimeData): EChartsCoreOption {
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
  return {
    color: ["#1c7ed6", "#12b886", "#f08c00"],
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 28, bottom: 54 },
    xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
    yAxis: { type: "value" },
    series: [
      { name: "Current", type: "line", smooth: true, data: [42, 51, 56, 61, 58, 49, 45] },
      { name: "Baseline", type: "line", smooth: true, data: [38, 42, 45, 47, 46, 43, 40] },
      { name: "Exceptions", type: "bar", data: [3, 5, 4, 7, 6, 4, 2] },
    ],
  };
}

function heatmapOption(
  report: ReportDefinition,
  runtimeData: ReportRuntimeData,
): EChartsCoreOption {
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
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = ["08", "10", "12", "14", "16", "18"];
  const data = days.flatMap((_, dayIndex) =>
    hours.map((_, hourIndex) => [hourIndex, dayIndex, (dayIndex + 2) * (hourIndex + 1)]),
  );
  return {
    tooltip: { position: "top" },
    grid: { left: 54, right: 16, top: 20, bottom: 54 },
    xAxis: { type: "category", data: hours },
    yAxis: { type: "category", data: days },
    visualMap: {
      min: 0,
      max: 42,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: ["#e7f5ff", "#74c0fc", "#f59f00", "#e03131"] },
    },
    series: [{ name: report.title, type: "heatmap", data }],
  };
}

function boxplotOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "item" },
    grid: { left: 46, right: 18, top: 24, bottom: 42 },
    xAxis: { type: "category", data: ["OPD", "IPD", "Lab", "Radio", "Pharm"] },
    yAxis: { type: "value" },
    series: [
      {
        name: "Distribution",
        type: "boxplot",
        data: [
          [12, 22, 28, 35, 54],
          [18, 30, 42, 58, 91],
          [10, 24, 31, 46, 88],
          [22, 45, 64, 78, 130],
          [8, 16, 22, 29, 47],
        ],
      },
    ],
  };
}

function funnelOption(): EChartsCoreOption {
  return {
    color: ["#228be6", "#12b886", "#fab005", "#fd7e14", "#e03131"],
    tooltip: { trigger: "item", formatter: "{b}: {c}" },
    series: [
      {
        type: "funnel",
        top: 18,
        bottom: 18,
        left: "8%",
        width: "84%",
        label: { formatter: "{b}: {c}" },
        data: [
          { value: 920, name: "Created" },
          { value: 810, name: "Started" },
          { value: 690, name: "Completed" },
          { value: 540, name: "Cleared" },
          { value: 430, name: "Closed" },
        ],
      },
    ],
  };
}

function sankeyOption(): EChartsCoreOption {
  const nodes = ["Gross", "Concession", "Refund", "Net", "Collected", "Outstanding"].map(
    (name) => ({
      name,
    }),
  );
  return {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "sankey",
        emphasis: { focus: "adjacency" },
        data: nodes,
        links: [
          { source: "Gross", target: "Concession", value: 18 },
          { source: "Gross", target: "Refund", value: 4 },
          { source: "Gross", target: "Net", value: 166 },
          { source: "Net", target: "Collected", value: 141 },
          { source: "Net", target: "Outstanding", value: 25 },
        ],
      },
    ],
  };
}

function mapOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "item" },
    grid: { left: 36, right: 24, top: 24, bottom: 36 },
    xAxis: { type: "value", min: 0, max: 100, splitLine: { show: false } },
    yAxis: { type: "value", min: 0, max: 100, splitLine: { show: false } },
    visualMap: {
      min: 0,
      max: 100,
      right: 8,
      top: 24,
      inRange: { color: ["#74c0fc", "#ffd43b", "#fa5252"] },
    },
    series: [
      {
        name: "Locality risk",
        type: "effectScatter",
        symbolSize: (value: number[]) => Math.max(10, (value[2] ?? 0) / 2),
        data: [
          [18, 42, 31, "Village A"],
          [32, 68, 64, "Village B"],
          [48, 51, 42, "Village C"],
          [66, 74, 88, "Village D"],
          [82, 38, 53, "Village E"],
        ],
        encode: { tooltip: [3, 2] },
      },
    ],
  };
}

function graphOption(): EChartsCoreOption {
  return {
    tooltip: {},
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        label: { show: true },
        force: { repulsion: 130, edgeLength: 70 },
        data: [
          { name: "Patient" },
          { name: "Family" },
          { name: "Village" },
          { name: "Doctor" },
          { name: "Referral" },
          { name: "Record" },
        ],
        links: [
          { source: "Patient", target: "Family" },
          { source: "Patient", target: "Village" },
          { source: "Patient", target: "Doctor" },
          { source: "Doctor", target: "Referral" },
          { source: "Patient", target: "Record" },
        ],
      },
    ],
  };
}

function radarOption(): EChartsCoreOption {
  return {
    legend: { bottom: 0 },
    radar: {
      indicator: [
        { name: "Safety", max: 100 },
        { name: "Access", max: 100 },
        { name: "TAT", max: 100 },
        { name: "Finance", max: 100 },
        { name: "Quality", max: 100 },
        { name: "Experience", max: 100 },
      ],
    },
    series: [
      {
        type: "radar",
        areaStyle: {},
        data: [
          { value: [84, 78, 71, 89, 76, 68], name: "Current" },
          { value: [92, 86, 82, 91, 88, 80], name: "Target" },
        ],
      },
    ],
  };
}

function gaugeOption(): EChartsCoreOption {
  return {
    series: [
      {
        type: "gauge",
        progress: { show: true },
        axisLine: { lineStyle: { width: 12 } },
        detail: { valueAnimation: true, formatter: "{value}%" },
        data: [{ value: 82, name: "Readiness" }],
      },
    ],
  };
}

function treemapOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "treemap",
        roam: false,
        data: [
          { name: "Medicine", value: 42 },
          { name: "Diagnostics", value: 36 },
          { name: "IPD", value: 30 },
          { name: "OPD", value: 28 },
          { name: "Surgery", value: 22 },
          { name: "Other", value: 14 },
        ],
      },
    ],
  };
}

function matrixOption(): EChartsCoreOption {
  const rows = ["NABH", "Safety", "Clinical", "Finance", "Security"];
  const cols = ["Open", "Due", "Risk", "Done"];
  return {
    tooltip: { position: "top" },
    grid: { left: 58, right: 18, top: 24, bottom: 44 },
    xAxis: { type: "category", data: cols },
    yAxis: { type: "category", data: rows },
    visualMap: {
      min: 0,
      max: 20,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: ["#e7f5ff", "#74c0fc", "#e03131"] },
    },
    series: [
      {
        type: "heatmap",
        data: rows.flatMap((_, row) => cols.map((_, col) => [col, row, (row + 1) * (col + 2)])),
        label: { show: true },
      },
    ],
  };
}

function bodyOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "item" },
    xAxis: { type: "value", min: 0, max: 100, show: false },
    yAxis: { type: "value", min: 0, max: 100, show: false },
    series: [
      {
        type: "scatter",
        symbolSize: (value: number[]) => Math.max(14, value[2] ?? 12),
        data: [
          [50, 84, 18, "Head/eye"],
          [50, 64, 30, "Chest"],
          [42, 52, 22, "Left arm"],
          [58, 52, 19, "Right arm"],
          [50, 38, 26, "Abdomen"],
          [44, 18, 20, "Left leg"],
          [56, 18, 24, "Right leg"],
        ],
        encode: { tooltip: [3, 2] },
      },
    ],
    graphic: [
      {
        type: "text",
        left: "center",
        top: "middle",
        style: { text: "Clinical body map", fill: "#868e96", fontSize: 14 },
      },
    ],
  };
}

function forecastOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#f08c00", "#12b886"],
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 28, bottom: 54 },
    xAxis: { type: "category", data: ["Today", "+1", "+2", "+3", "+4", "+5", "+6"] },
    yAxis: { type: "value" },
    series: [
      {
        name: "Forecast",
        type: "line",
        smooth: true,
        data: [82, 88, 94, 98, 101, 96, 90],
        markArea: {
          itemStyle: { color: "rgba(255, 212, 59, 0.18)" },
          data: [[{ name: "confidence band", yAxis: 86 }, { yAxis: 104 }]],
        },
      },
      { name: "Baseline", type: "line", smooth: true, data: [76, 79, 82, 84, 83, 80, 78] },
      { name: "Risk flags", type: "bar", data: [2, 3, 5, 6, 7, 4, 3] },
    ],
  };
}

function lineGradientOption(report: ReportDefinition): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#12b886"],
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 28, bottom: 54 },
    xAxis: { type: "category", data: ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "Today"] },
    yAxis: { type: "value" },
    series: [
      {
        name: report.title,
        type: "line",
        smooth: true,
        symbolSize: 8,
        areaStyle: { opacity: 0.16 },
        data: [44, 52, 58, 61, 73, 69, 82],
        markPoint: { data: [{ type: "max", name: "Peak" }] },
      },
      {
        name: "Baseline",
        type: "line",
        smooth: true,
        lineStyle: { type: "dashed" },
        data: [40, 43, 45, 48, 51, 53, 55],
      },
    ],
  };
}

function areaStackOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#12b886", "#fab005", "#f76707"],
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 28, bottom: 54 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    yAxis: { type: "value" },
    series: [
      {
        name: "New",
        type: "line",
        stack: "total",
        areaStyle: {},
        smooth: true,
        data: [120, 132, 141, 154, 150, 138],
      },
      {
        name: "Repeat",
        type: "line",
        stack: "total",
        areaStyle: {},
        smooth: true,
        data: [90, 102, 118, 121, 130, 124],
      },
      {
        name: "Camp",
        type: "line",
        stack: "total",
        areaStyle: {},
        smooth: true,
        data: [24, 36, 30, 42, 45, 38],
      },
    ],
  };
}

function barStackOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#12b886", "#f59f00", "#e03131"],
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 28, bottom: 54 },
    xAxis: { type: "category", data: ["OPD", "IPD", "Lab", "Radio", "Pharm", "OT"] },
    yAxis: { type: "value" },
    series: [
      { name: "Completed", type: "bar", stack: "status", data: [320, 88, 420, 145, 260, 42] },
      { name: "Pending", type: "bar", stack: "status", data: [44, 21, 80, 37, 52, 11] },
      { name: "Breach", type: "bar", stack: "status", data: [8, 6, 18, 9, 12, 3] },
    ],
  };
}

function barRaceOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6"],
    tooltip: { trigger: "axis" },
    grid: { left: 112, right: 24, top: 24, bottom: 28 },
    xAxis: { type: "value" },
    yAxis: {
      type: "category",
      inverse: true,
      data: ["Medicine", "General Surgery", "OBG", "Orthopedics", "Pediatrics"],
    },
    series: [
      {
        type: "bar",
        realtimeSort: true,
        label: { show: true, position: "right" },
        data: [1860, 1490, 1320, 1180, 1040],
      },
    ],
  };
}

function waterfallOption(): EChartsCoreOption {
  return {
    color: ["#adb5bd", "#12b886", "#e03131", "#1c7ed6"],
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0 },
    grid: { left: 48, right: 20, top: 28, bottom: 54 },
    xAxis: {
      type: "category",
      data: ["Gross", "Concession", "Refund", "Denial", "Net", "Collected"],
    },
    yAxis: { type: "value" },
    series: [
      {
        name: "Offset",
        type: "bar",
        stack: "total",
        itemStyle: { color: "transparent" },
        data: [0, 166, 162, 150, 0, 0],
      },
      { name: "Movement", type: "bar", stack: "total", data: [184, 18, 4, 12, 150, 128] },
    ],
  };
}

function calendarHeatmapOption(): EChartsCoreOption {
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (41 - index));
    return [date.toISOString().slice(0, 10), Math.round(20 + Math.sin(index / 3) * 12 + index / 2)];
  });
  return {
    tooltip: { position: "top" },
    visualMap: {
      min: 0,
      max: 60,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: ["#e7f5ff", "#74c0fc", "#f59f00", "#e03131"] },
    },
    calendar: {
      top: 24,
      left: 28,
      right: 28,
      cellSize: ["auto", 22],
      range: [days[0]?.[0], days.at(-1)?.[0]],
      itemStyle: { borderWidth: 0.5 },
    },
    series: [{ type: "heatmap", coordinateSystem: "calendar", data: days }],
  };
}

function sunburstOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "sunburst",
        radius: [0, "88%"],
        label: { rotate: "radial" },
        data: [
          {
            name: "Clinical",
            children: [
              { name: "OPD", value: 38 },
              { name: "IPD", value: 28 },
              { name: "OT", value: 16 },
            ],
          },
          {
            name: "Diagnostics",
            children: [
              { name: "Lab", value: 34 },
              { name: "Radiology", value: 22 },
            ],
          },
          {
            name: "Pharmacy",
            children: [
              { name: "OP", value: 26 },
              { name: "IP", value: 18 },
            ],
          },
        ],
      },
    ],
  };
}

function pictorialBarOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#12b886", "#f59f00"],
    tooltip: { trigger: "axis" },
    grid: { left: 44, right: 18, top: 28, bottom: 42 },
    xAxis: { type: "category", data: ["Beds", "Nurses", "Vent.", "OT", "Stock"] },
    yAxis: { type: "value" },
    series: [
      {
        type: "pictorialBar",
        symbol: "rect",
        symbolRepeat: true,
        symbolSize: [18, 6],
        data: [84, 76, 68, 55, 72],
      },
    ],
  };
}

function timelineOption(): EChartsCoreOption {
  return {
    baseOption: {
      timeline: {
        bottom: 0,
        autoPlay: false,
        data: ["Arrival", "Consult", "Order", "Result", "Discharge"],
      },
      tooltip: { trigger: "axis" },
      grid: { left: 44, right: 18, top: 24, bottom: 72 },
      xAxis: { type: "category", data: ["0h", "2h", "4h", "8h", "24h"] },
      yAxis: { type: "value" },
    },
    options: [
      { series: [{ name: "Patients", type: "line", smooth: true, data: [80, 92, 88, 76, 60] }] },
      { series: [{ name: "Consults", type: "line", smooth: true, data: [20, 64, 96, 88, 44] }] },
      { series: [{ name: "Orders", type: "line", smooth: true, data: [8, 42, 90, 96, 48] }] },
      { series: [{ name: "Results", type: "line", smooth: true, data: [0, 12, 44, 82, 76] }] },
      { series: [{ name: "Closed", type: "line", smooth: true, data: [0, 4, 18, 56, 84] }] },
    ],
  } as unknown as EChartsCoreOption;
}

function parallelCoordinatesOption(): EChartsCoreOption {
  return {
    parallelAxis: [
      { dim: 0, name: "Load" },
      { dim: 1, name: "TAT" },
      { dim: 2, name: "Cost" },
      { dim: 3, name: "Risk" },
      { dim: 4, name: "Quality" },
    ],
    parallel: { left: 42, right: 28, top: 28, bottom: 28 },
    series: [
      {
        type: "parallel",
        lineStyle: { width: 2, opacity: 0.45 },
        data: [
          [82, 61, 44, 28, 86],
          [68, 72, 59, 41, 74],
          [91, 84, 70, 66, 62],
          [54, 38, 32, 18, 91],
        ],
      },
    ],
  };
}

function themeRiverOption(): EChartsCoreOption {
  const dates = ["2026/05/01", "2026/05/02", "2026/05/03", "2026/05/04", "2026/05/05"];
  return {
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    singleAxis: {
      top: 36,
      bottom: 64,
      type: "time",
      axisPointer: { animation: true },
    },
    series: [
      {
        type: "themeRiver",
        data: dates.flatMap((date, index) => [
          [date, 12 + index * 4, "Fever"],
          [date, 8 + index * 3, "Diabetes"],
          [date, 18 - index, "Hypertension"],
        ]),
      },
    ],
  };
}

function candlestickOhlcOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 44, right: 18, top: 28, bottom: 42 },
    xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    yAxis: { type: "value" },
    series: [
      {
        type: "candlestick",
        data: [
          [72, 84, 68, 91],
          [84, 79, 74, 88],
          [79, 96, 75, 101],
          [96, 92, 86, 105],
          [92, 88, 82, 100],
          [88, 94, 80, 98],
        ],
      },
    ],
  };
}

export function optionForReport(
  report: ReportDefinition,
  runtimeData: ReportRuntimeData,
): EChartsCoreOption {
  switch (templateForReport(report)) {
    case "line_stack":
      return lineOption(report, runtimeData);
    case "line_gradient":
      return lineGradientOption(report);
    case "area_stack":
      return areaStackOption();
    case "bar_stack":
      return barStackOption();
    case "bar_race":
      return barRaceOption();
    case "bar_waterfall":
      return waterfallOption();
    case "heatmap_cartesian":
      return heatmapOption(report, runtimeData);
    case "heatmap_calendar":
      return calendarHeatmapOption();
    case "boxplot":
      return boxplotOption();
    case "sankey":
      return sankeyOption();
    case "graph_network":
      return graphOption();
    case "radar":
      return radarOption();
    case "treemap":
      return treemapOption();
    case "sunburst":
      return sunburstOption();
    case "funnel":
      return funnelOption();
    case "gauge":
      return gaugeOption();
    case "geo_map":
    case "effect_scatter_map":
      return mapOption();
    case "pictorial_bar":
      return pictorialBarOption();
    case "custom_svg":
      return bodyOption();
    case "timeline":
      return timelineOption();
    case "parallel_coordinates":
      return parallelCoordinatesOption();
    case "theme_river":
      return themeRiverOption();
    case "candlestick_ohlc":
      return candlestickOhlcOption();
  }
  switch (report.visualKind) {
    case "command":
      return commandOption();
    case "line":
      return lineOption(report, runtimeData);
    case "heatmap":
      return heatmapOption(report, runtimeData);
    case "boxplot":
      return boxplotOption();
    case "funnel":
      return funnelOption();
    case "sankey":
      return sankeyOption();
    case "map":
      return mapOption();
    case "graph":
      return graphOption();
    case "radar":
      return radarOption();
    case "gauge":
      return gaugeOption();
    case "treemap":
      return treemapOption();
    case "matrix":
      return matrixOption();
    case "body":
      return bodyOption();
    case "forecast":
      return forecastOption();
  }
}
