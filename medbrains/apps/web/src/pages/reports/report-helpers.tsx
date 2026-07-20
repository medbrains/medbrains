// Reports data-formatting + domain-insight helpers — split from reports.tsx (pure move).

import type {
  ReportDefinition as ApiReportDefinition,
  ReportCatalogResponse,
  ReportDataResponse,
} from "@medbrains/types";
import { IconFileAnalytics } from "@tabler/icons-react";
import type { BadgeTone } from "@/components/ui";
import { templateForReport } from "./chart-options";
import { REPORT_DOMAIN_BRIEFS, type ReportDomain } from "./domain-briefs";
import { REPORT_FAMILIES } from "./report-catalog";
import type {
  ReportDefinition,
  ReportExport,
  ReportFamily,
  ReportLoadingState,
  ReportPriority,
  ReportReadiness,
  VisualKind,
} from "./types";

export const READINESS_META: Record<ReportReadiness, { label: string; color: string }> = {
  live_api: { label: "Live API", color: "green" },
  query_buildable: { label: "Query buildable", color: "blue" },
  derived_view: { label: "Derived view", color: "teal" },
  predictive: { label: "Predictive", color: "grape" },
  capture_needed: { label: "Capture needed", color: "orange" },
};

export const PRIORITY_META: Record<ReportPriority, { label: string; color: string }> = {
  P1: { label: "P1 daily", color: "red" },
  P2: { label: "P2 operating", color: "orange" },
  P3: { label: "P3 specialty", color: "gray" },
};

const VISUAL_KINDS = new Set<VisualKind>([
  "command",
  "line",
  "heatmap",
  "boxplot",
  "funnel",
  "sankey",
  "map",
  "graph",
  "radar",
  "gauge",
  "treemap",
  "matrix",
  "body",
  "forecast",
]);

function normalizePriority(priority: ApiReportDefinition["priority"] | string): ReportPriority {
  if (priority.toLowerCase() === "p2") return "P2";
  if (priority.toLowerCase() === "p3") return "P3";
  return "P1";
}

function normalizeExport(format: ApiReportDefinition["exports"][number] | string): ReportExport {
  const normalized = format.toLowerCase();
  if (normalized === "excel") return "Excel";
  if (normalized === "csv") return "CSV";
  if (normalized === "png") return "PNG";
  return "PDF";
}

function normalizeVisualKind(value: string): VisualKind {
  return VISUAL_KINDS.has(value as VisualKind) ? (value as VisualKind) : "line";
}

function apiReportToUi(report: ApiReportDefinition): ReportDefinition {
  return {
    id: report.id,
    title: report.title,
    purpose: report.purpose,
    sourceTables: report.source_tables,
    sourceEvents: report.source_events,
    eventPayloadKeys: report.event_payload_keys,
    indicatorTargets: report.indicator_targets,
    permissions: report.permissions,
    priority: normalizePriority(report.priority),
    readiness: report.readiness,
    chartTypes: report.chart_types,
    echartsTemplate: report.echarts_template,
    visualKind: normalizeVisualKind(report.visual_kind),
    refresh: report.refresh,
    exports: report.exports.map(normalizeExport),
    exportMode: report.export_mode,
    drilldowns: report.drilldowns,
    dataEndpoint: report.data_endpoint,
  };
}

export function catalogToReportFamilies(catalog?: ReportCatalogResponse): ReportFamily[] {
  if (!catalog?.families.length) return [...REPORT_FAMILIES];

  const presentationByFamily = new Map(
    REPORT_FAMILIES.map((family) => [
      family.id,
      {
        icon: family.icon,
        accent: family.accent,
      },
    ]),
  );

  return catalog.families.map((family) => {
    const presentation = presentationByFamily.get(family.id);
    return {
      id: family.id,
      title: family.title,
      eyebrow: family.eyebrow,
      description: family.description,
      icon: presentation?.icon ?? IconFileAnalytics,
      accent: presentation?.accent ?? "blue",
      reports: family.reports.map(apiReportToUi),
    };
  });
}

export function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function colorToBadgeTone(color: string): BadgeTone {
  const map: Record<string, BadgeTone> = {
    gray: "neutral",
    slate: "neutral",
    dark: "neutral",
    green: "success",
    teal: "success",
    lime: "success",
    yellow: "warning",
    orange: "warning",
    red: "danger",
    blue: "info",
    cyan: "info",
    indigo: "primary",
    primary: "primary",
    violet: "accent",
    grape: "accent",
    pink: "accent",
    copper: "accent",
  };
  return map[color] ?? "neutral";
}

export function reportSourceLabel(report: ReportDefinition): string {
  return report.sourceTables.slice(0, 4).join(", ");
}

export function reportStatusLabel(report: ReportDefinition): string {
  const wiring = report.dataEndpoint === null ? " · Source not wired" : "";
  return `${PRIORITY_META[report.priority].label} · ${READINESS_META[report.readiness].label}${wiring}`;
}

export function reportMatchesSearch(
  report: ReportDefinition,
  family: ReportFamily,
  query: string,
): boolean {
  if (!query) return true;
  return [
    family.title,
    family.eyebrow,
    family.description,
    report.id,
    report.title,
    report.purpose,
    report.priority,
    report.readiness,
    report.refresh,
    report.echartsTemplate ?? "",
    report.sourceTables.join(" "),
    report.permissions.join(" "),
    report.chartTypes.join(" "),
    report.drilldowns.join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function loadingForReport(
  report: ReportDefinition,
  loadingState: ReportLoadingState,
): boolean {
  if (report.id === "opd-registration-arrivals") return loadingState.opdFootfall;
  if (report.id === "ipd-census-bed-occupancy") return loadingState.bedOccupancy;
  if (report.id === "opd-no-show-revisit") return loadingState.noShows;
  return false;
}

function liveSummary(report: ReportDefinition, reportData?: ReportDataResponse<unknown>): string {
  if (!report.dataEndpoint) {
    return `Source query is not live yet. Management should treat this as a governed report definition until ${report.sourceTables
      .slice(0, 3)
      .join(", ")} is wired and validated.`;
  }
  if (!reportData) {
    return "Live endpoint exists, but the current data version has not loaded yet. Do not use this chart for management action until the source rows and summary metadata arrive.";
  }
  const generatedAt = new Date(reportData.generated_at).toLocaleString();
  const fields = firstRowFields(reportData);
  const sourceWarning = reportData.summary.warning
    ? ` Source warning: ${reportData.summary.warning}.`
    : "";
  const fieldSummary =
    fields.length > 0 ? ` Visible fields: ${fields.join(", ")}.` : " No row fields available.";
  return `Live data version returned ${reportData.summary.row_count} row(s) from ${reportData.summary.source}; generated ${generatedAt}.${sourceWarning}${fieldSummary}`;
}

function firstRowFields(reportData: ReportDataResponse<unknown>): string[] {
  const first = reportData.rows[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) {
    return [];
  }
  return Object.keys(first as Record<string, unknown>).slice(0, 8);
}

export function formatReportDataStatus(reportData?: ReportDataResponse<unknown>): string {
  if (!reportData) return "Pending live response";
  if (reportData.summary.status === "live") return "Live source";
  return "Not wired";
}

export function formatGeneratedAt(reportData?: ReportDataResponse<unknown>): string {
  if (!reportData) return "Pending";
  return new Date(reportData.generated_at).toLocaleString();
}

function domainForReport(report: ReportDefinition): ReportDomain {
  const id = report.id;
  if (id.startsWith("opd-")) return "opd";
  if (id.startsWith("ipd-")) return "ipd";
  if (id.startsWith("lab-")) return "lab";
  if (id.startsWith("radiology-")) return "radiology";
  if (id.startsWith("pharmacy-")) return "pharmacy";
  if (id.startsWith("billing-") || id.startsWith("revenue-")) return "finance";
  if (id.startsWith("camp-")) return "camp";
  if (id.startsWith("nabh-") || id.startsWith("quality-")) return "quality";
  if (id.startsWith("geo-")) return "community";
  if (id.startsWith("body-")) return "body";
  if (id.startsWith("security-") || id.startsWith("data-quality-")) return "security";
  if (id.startsWith("predict-")) return "predictive";
  if (id.startsWith("nmc-")) return "nmc";
  return "executive";
}

function listOrFallback(items: string[], fallback: string): string {
  return items.length > 0 ? items.join(", ") : fallback;
}

function visualManagementReading(report: ReportDefinition): string {
  if (report.visualKind === "forecast") {
    return "Management reading: compare current trajectory, baseline, and confidence band before changing staffing, stock, or capacity.";
  }

  switch (templateForReport(report)) {
    case "heatmap_cartesian":
    case "heatmap_calendar":
      return "Management reading: act on the hottest time, place, unit, or owner first, then compare against the same slot in the baseline period.";
    case "boxplot":
      return "Management reading: do not trust the average alone; the long tail and outliers show where patients or records are getting delayed.";
    case "funnel":
      return "Management reading: every step drop is an accountable leakage point, so assign the first large fall-off to an owner.";
    case "sankey":
      return "Management reading: follow the largest flow or loss path to decide whether the intervention is operational, financial, or clinical.";
    case "graph_network":
      return "Management reading: dense or unusual relationships need identity, referral, access, or outbreak review depending on the report domain.";
    case "radar":
      return "Management reading: weakest axes become the department improvement plan; do not average away one failing dimension.";
    case "treemap":
    case "sunburst":
      return "Management reading: the largest blocks show concentration risk, case mix, or money/stock dependency.";
    case "geo_map":
    case "effect_scatter_map":
      return "Management reading: locality signals need privacy suppression first, then outreach, referral, or public-health action.";
    case "custom_svg":
      return "Management reading: anatomy-level clustering should trigger specialty workflow review and patient follow-up checks.";
    case "line_gradient":
      return "Management reading: compare current trajectory, baseline, and confidence band before changing staffing, stock, or capacity.";
    case "bar_waterfall":
      return "Management reading: the largest negative bridge explains the leakage or delay bucket that needs correction.";
    case "parallel_coordinates":
      return "Management reading: high-risk lines are multi-factor cases where load, cost, quality, and delay worsen together.";
    case "theme_river":
      return "Management reading: seasonality shifts show when a disease, demand, or operational theme is gaining share.";
    case "candlestick_ohlc":
      return "Management reading: volatility matters; wide daily spread means the average is hiding unstable operations.";
    case "bar_race":
      return "Management reading: changing rank shows departments, doctors, services, or SKUs gaining operational weight.";
    default:
      return "Management reading: compare current period, baseline, exception count, and owner backlog before assigning action.";
  }
}

function predictiveSummary(report: ReportDefinition): string[] {
  const brief = REPORT_DOMAIN_BRIEFS[domainForReport(report)];
  const drilldowns = listOrFallback(report.drilldowns.slice(0, 3), "defined drilldowns");
  const predictiveNote =
    report.readiness === "predictive" || report.visualKind === "forecast"
      ? "This chart should show confidence, drift state, and reviewer status before management accepts the forecast."
      : "Use this as a leading signal now; the next version can add baseline variance and confidence bands.";

  return [
    `${brief.prediction}.`,
    `Use ${drilldowns} to find the cohort or owner most likely to drive tomorrow's exception load.`,
    predictiveNote,
  ];
}

export function detailInsights(report: ReportDefinition, reportData?: ReportDataResponse<unknown>) {
  const brief = REPORT_DOMAIN_BRIEFS[domainForReport(report)];
  const drilldownTargets = report.drilldowns.slice(0, 4);
  const sourceTargets = report.sourceTables.slice(0, 4);
  const drilldownText = listOrFallback(drilldownTargets, "the configured drilldown");
  const sourceText = listOrFallback(sourceTargets, "the configured HMS source");
  const statusText = `${READINESS_META[report.readiness].label}; ${PRIORITY_META[report.priority].label}; cadence ${report.refresh}.`;
  return {
    summary: `${brief.label}: ${report.purpose}`,
    executiveSummary: [
      `${brief.audience} use this to ${brief.managementUse}.`,
      `What this chart is deciding: ${report.purpose}`,
      liveSummary(report, reportData),
      statusText,
    ],
    predictions: predictiveSummary(report),
    anticipated: [
      `Anticipate the next review queue from ${brief.leadingSignals}.`,
      `Watch for stale data: newest source event must be inside ${report.refresh}.`,
      report.exportMode === "governed"
        ? "Anticipate PHI/export approval when drilling into patient-identifiable rows."
        : "Anticipate standard export needs with user, timestamp, and filter audit.",
      "If cohort or geography output becomes small-cell identifiable, suppress it or require elevated permission.",
    ],
    aiInteractions: [
      `Ask: "What changed in ${report.title} since the previous period, split by ${drilldownText}?"`,
      `Ask: "Which ${drilldownTargets[0] ?? "owner"} needs action first, and what evidence supports that?"`,
      `Ask: "Draft a management note for ${brief.audience} with red flags, likely drivers, and owner actions."`,
      "AI must use this summary report version plus the current data version, not raw unrestricted database access.",
      "Allowed responses can explain variance, find likely drivers, draft action lists, and prepare committee notes with links back to source rows.",
      "Every AI answer must show data version, summary version, filters, user, timestamp, and whether PHI was included.",
      "Clinical, regulatory, finance, and security conclusions must remain review-required; AI cannot auto-sign, auto-diagnose, or auto-escalate.",
    ],
    detailNotes: [
      visualManagementReading(report),
      `Primary drilldowns: ${drilldownText}.`,
      `Primary source tables: ${sourceText}.`,
      `Export/audit mode: ${report.exportMode}; outputs ${report.exports.join(", ")}.`,
    ],
    redFlags: [
      brief.redFlag,
      `Newest source event must be within ${report.refresh}.`,
      report.exportMode === "governed"
        ? "Patient-identifiable drilldown requires governed export and audit."
        : "Standard export still records user, timestamp, and filter context.",
      "Small-cell geography or cohort output must be suppressed unless explicitly authorized.",
    ],
    appreciation: [
      brief.goodSignal,
      reportData
        ? `Data version is explicit: ${reportData.summary.status} from ${reportData.summary.source}.`
        : "The report clearly shows whether the live source is pending or not wired.",
      "Priority, readiness, source, drilldowns, and export mode are visible before management acts.",
    ],
    actions: [
      `Open drilldown by ${drilldownText}.`,
      report.dataEndpoint
        ? `Review live rows from ${sourceText} and assign the first variance owner.`
        : `Wire query from ${sourceText} before marking this report as operationally usable.`,
      `Validate export mode: ${report.exportMode}.`,
    ],
  };
}
