import {
  Card,
  Group,
  Modal,
  NavLink,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { usePermissionStore } from "@medbrains/stores";
import {
  type ReportDefinition as ApiReportDefinition,
  P,
  type ReportCatalogResponse,
  type ReportDataResponse,
} from "@medbrains/types";
import { IconFileAnalytics, IconSearch, IconX } from "@tabler/icons-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { NabhIndicatorMatrix } from "@/components/Reports/NabhIndicatorMatrix";
import { ReportChart } from "@/components/Reports/ReportChart";
import { ReportDetailPanel } from "@/components/Reports/ReportDetailPanel";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { reportsService } from "@/services/reports.service";
import { optionForReport, templateForReport } from "./reports/chart-options";
import { REPORT_FAMILIES } from "./reports/report-catalog";
import type {
  ReportDataById,
  ReportDefinition,
  ReportExport,
  ReportFamily,
  ReportLoadingState,
  ReportPriority,
  ReportReadiness,
  ReportRuntimeData,
  VisualKind,
} from "./reports/types";
import styles from "./reports.module.scss";

const REPORT_PRIORITY_FILTERS = ["all", "P1", "P2", "P3"] as const;
const REPORT_READINESS_FILTERS = [
  "all",
  "live_api",
  "query_buildable",
  "derived_view",
  "predictive",
  "capture_needed",
] as const;

function isReportPriorityFilter(
  value: string | null,
): value is (typeof REPORT_PRIORITY_FILTERS)[number] {
  return REPORT_PRIORITY_FILTERS.some((filter) => filter === value);
}

function isReportReadinessFilter(
  value: string | null,
): value is (typeof REPORT_READINESS_FILTERS)[number] {
  return REPORT_READINESS_FILTERS.some((filter) => filter === value);
}

function reportPriorityFilter(value: string | null): ReportPriority | "all" {
  return isReportPriorityFilter(value) ? value : "all";
}

function reportReadinessFilter(value: string | null): ReportReadiness | "all" {
  return isReportReadinessFilter(value) ? value : "all";
}

const READINESS_META: Record<ReportReadiness, { label: string; color: string }> = {
  live_api: { label: "Live API", color: "green" },
  query_buildable: { label: "Query buildable", color: "blue" },
  derived_view: { label: "Derived view", color: "teal" },
  predictive: { label: "Predictive", color: "grape" },
  capture_needed: { label: "Capture needed", color: "orange" },
};

const PRIORITY_META: Record<ReportPriority, { label: string; color: string }> = {
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

function catalogToReportFamilies(catalog?: ReportCatalogResponse): ReportFamily[] {
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

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function colorToBadgeTone(color: string): BadgeTone {
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

function reportSourceLabel(report: ReportDefinition): string {
  return report.sourceTables.slice(0, 4).join(", ");
}

function reportStatusLabel(report: ReportDefinition): string {
  const wiring = report.dataEndpoint === null ? " · Source not wired" : "";
  return `${PRIORITY_META[report.priority].label} · ${READINESS_META[report.readiness].label}${wiring}`;
}

function reportMatchesSearch(
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

function loadingForReport(report: ReportDefinition, loadingState: ReportLoadingState): boolean {
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

function formatReportDataStatus(reportData?: ReportDataResponse<unknown>): string {
  if (!reportData) return "Pending live response";
  if (reportData.summary.status === "live") return "Live source";
  return "Not wired";
}

function formatGeneratedAt(reportData?: ReportDataResponse<unknown>): string {
  if (!reportData) return "Pending";
  return new Date(reportData.generated_at).toLocaleString();
}

type ReportDomain =
  | "executive"
  | "opd"
  | "ipd"
  | "lab"
  | "radiology"
  | "pharmacy"
  | "finance"
  | "camp"
  | "quality"
  | "community"
  | "body"
  | "security"
  | "predictive"
  | "nmc";

interface ReportDomainBrief {
  label: string;
  audience: string;
  managementUse: string;
  leadingSignals: string;
  prediction: string;
  redFlag: string;
  goodSignal: string;
}

const REPORT_DOMAIN_BRIEFS: Record<ReportDomain, ReportDomainBrief> = {
  executive: {
    label: "Executive command",
    audience: "CEO, medical superintendent, COO, and hospital administrator",
    managementUse: "see the daily operating pressure before department meetings start",
    leadingSignals:
      "capacity pressure, collections movement, service delays, and unresolved safety events",
    prediction:
      "anticipate the next operational choke point by combining queue velocity, bed pressure, cash lag, and safety exceptions",
    redFlag:
      "multiple departments breaching together means this is a hospital-level escalation, not a local dashboard issue",
    goodSignal:
      "the same board links capacity, money, safety, and delay signals before managers act",
  },
  opd: {
    label: "OPD management",
    audience: "OPD manager, reception lead, consultants, and duty administrator",
    managementUse:
      "balance front-desk load, consultant slots, walk-ins, no-shows, and repeat visits",
    leadingSignals:
      "arrival pattern, queue age, consultant utilization, and revisit or no-show cohorts",
    prediction:
      "anticipate clinic crowding and appointment leakage from arrival velocity, slot utilization, and prior no-show behavior",
    redFlag:
      "high wait time with idle consultant slots usually indicates registration, token, or routing failure",
    goodSignal:
      "registration, queue, consultation, and follow-up data can be drilled into the same operating flow",
  },
  ipd: {
    label: "IPD management",
    audience: "nursing superintendent, ward in-charge, bed manager, and treating units",
    managementUse:
      "control bed availability, discharge friction, long stay, transfers, and ward throughput",
    leadingSignals:
      "occupancy, bed class pressure, discharge barriers, housekeeping lag, and readmission watch",
    prediction:
      "anticipate next-shift bed shortage from active census, expected discharges, blocked beds, and admission pipeline",
    redFlag:
      "high occupancy with delayed discharge and slow bed turnaround requires immediate bed-management review",
    goodSignal:
      "bed, admission, discharge, and ward drilldowns are explicit before any occupancy chart becomes live",
  },
  lab: {
    label: "Lab operations",
    audience: "lab director, pathologist, lab manager, quality officer, and clinical units",
    managementUse:
      "reduce diagnostic delay, critical-value miss, sample rejection, QC failure, and outsourcing dependence",
    leadingSignals:
      "sample age, validation age, critical alert acknowledgement, rejection reasons, and analyzer section load",
    prediction:
      "anticipate TAT breach from pending queue age, priority mix, analyzer load, collection backlog, and verification delay",
    redFlag:
      "critical values without acknowledgement are clinical-risk events and need escalation, not just a report note",
    goodSignal:
      "the report separates collection, processing, validation, and notification so action ownership is clear",
  },
  radiology: {
    label: "Radiology operations",
    audience: "radiology head, modality supervisor, reporting radiologist, and operations lead",
    managementUse:
      "control modality load, RIS/PACS backlog, reporting delay, dose safety, and critical finding communication",
    leadingSignals:
      "order age, scan completion, report verification, modality queue, repeat scans, and critical-finding acknowledgement",
    prediction:
      "anticipate imaging backlog from modality utilization, aged orders, reporting queue, machine downtime, and priority mix",
    redFlag:
      "critical findings without documented communication are patient-safety and medicolegal exceptions",
    goodSignal:
      "DICOM/RIS/reporting sources are separated so workflow delay and storage delay are not mixed",
  },
  pharmacy: {
    label: "Pharmacy management",
    audience: "pharmacy manager, clinical pharmacist, purchase lead, and finance controller",
    managementUse:
      "control fulfillment, stock risk, expiry loss, controlled drugs, ADRs, returns, and margin leakage",
    leadingSignals:
      "partial fills, stock days, batch age, reorder pressure, NDPS balance, return volume, and ADR trend",
    prediction:
      "anticipate stockout or expiry loss from consumption velocity, batch age, reorder level, and vendor lead time",
    redFlag: "controlled-drug issue, return, and witness events must balance by shift and register",
    goodSignal:
      "the report links medication safety, inventory, and money leakage rather than treating pharmacy as sales only",
  },
  finance: {
    label: "Finance control",
    audience: "CFO, finance controller, billing lead, cashier lead, and hospital administrator",
    managementUse:
      "track gross-to-net revenue, collections, settlement variance, A/R, DNFB, refunds, denials, and concessions",
    leadingSignals:
      "collection lag, unpaid discharge, payer aging, concession growth, refund reason, denial reason, and settlement variance",
    prediction:
      "anticipate day-close cash gap and revenue leakage from billing mix, concessions, refunds, payer lag, and unbilled services",
    redFlag:
      "revenue growth with worsening collections or DNFB means cash is not converting, even if billing looks healthy",
    goodSignal:
      "finance reports declare payer, department, cashier, counter, and approval drilldowns for accountability",
  },
  camp: {
    label: "Camp and outreach",
    audience: "camp coordinator, outreach lead, medical officer, and hospital operations team",
    managementUse:
      "measure field turnout, screening yield, referral conversion, offline sync health, supplies, and field incidents",
    leadingSignals:
      "village turnout, positive screens, referral arrival, sync lag, device failures, and supply consumption",
    prediction:
      "anticipate referral leakage and locality clusters by comparing positive screens with hospital arrival and follow-up windows",
    redFlag:
      "downloaded camp packets with stale sync or expired data must not drive clinical decisions",
    goodSignal:
      "camp reports connect field work back to hospital conversion, follow-up, and data safety",
  },
  quality: {
    label: "NABH and quality",
    audience: "quality head, committee chairs, medical superintendent, and department owners",
    managementUse:
      "track indicator evidence, incidents, sentinel events, CAPA aging, audit closure, feedback, and complaints",
    leadingSignals:
      "indicator breach, overdue CAPA, repeated incident type, complaint aging, committee delay, and evidence gap",
    prediction:
      "anticipate accreditation risk from unresolved evidence gaps, repeat incidents, overdue CAPA, and weak owner closure",
    redFlag: "repeat incidents without CAPA closure indicate system failure, not isolated variance",
    goodSignal:
      "NABH evidence, quality events, audit actions, and patient voice sit in the same management loop",
  },
  community: {
    label: "Community intelligence",
    audience: "hospital strategy team, outreach lead, public-health lead, and service-line heads",
    managementUse:
      "understand catchment, disease burden, referral flow, follow-up loss, and underserved geography",
    leadingSignals:
      "village/pincode origin, disease density, referral source, travel burden, service penetration, and follow-up completion",
    prediction:
      "anticipate disease clusters or access gaps by comparing locality signal density with moving baseline and camp coverage",
    redFlag:
      "small-cell locality reports can identify patients and must be suppressed unless permitted",
    goodSignal: "geo reports are designed around catchment decisions, not decorative maps",
  },
  body: {
    label: "Clinical body maps",
    audience:
      "specialty clinicians, nursing quality teams, wound-care teams, and clinical auditors",
    managementUse:
      "spot anatomical burden, wound progression, dental needs, pain movement, and specialty-region patterns",
    leadingSignals:
      "body region, laterality, severity, stage, follow-up change, and treatment burden",
    prediction:
      "anticipate deterioration or follow-up need from persistent region severity, stage progression, and missed reassessment",
    redFlag:
      "clinical body-map output is patient-identifiable and must remain under governed clinical access",
    goodSignal: "anatomy-aware reports can show clinical burden that normal tables hide",
  },
  security: {
    label: "Security and data quality",
    audience: "CISO, data protection lead, MRD lead, quality officer, and administrator",
    managementUse:
      "monitor identity quality, ABHA linkage, duplicates, unsigned records, amendments, exports, and access anomalies",
    leadingSignals:
      "missing identifiers, duplicate confidence, unsigned age, amendment frequency, after-hours access, and break-glass usage",
    prediction:
      "anticipate investigation workload from abnormal access clusters, old unsigned records, and duplicate identity risk",
    redFlag:
      "privileged export or after-hours cross-location access needs immediate review and audit context",
    goodSignal:
      "trust reports combine data completeness, legal signature state, and access behavior",
  },
  predictive: {
    label: "Predictive workbench",
    audience: "operations leadership, quality team, finance, pharmacy, and department owners",
    managementUse:
      "convert historical HMS signals into reviewed forecasts, anomaly bands, and action queues",
    leadingSignals: "trend, seasonality, baseline variance, confidence, drift, and owner backlog",
    prediction:
      "produce a review-required forecast with confidence band and explanation, never an automatic decision",
    redFlag:
      "prediction without source freshness, model version, confidence, and reviewer status should be hidden",
    goodSignal:
      "forecast reports are separated from live descriptive reports so governance is explicit",
  },
  nmc: {
    label: "NMC teaching overlay",
    audience: "dean, medical superintendent, academic coordinator, MRD head, and department heads",
    managementUse:
      "track teaching-hospital evidence for specialty occupancy, OPD attendance, clinical material, procedures, and MRD readiness",
    leadingSignals:
      "specialty census, OPD volume, faculty unit, procedure breadth, record completeness, and audit availability",
    prediction:
      "anticipate inspection gaps where clinical material, occupancy, or records fall below the expected teaching threshold",
    redFlag:
      "NMC evidence must match validated hospital records, not manual spreadsheet-only counts",
    goodSignal:
      "clinical activity and MRD availability are linked before teaching evidence is shown",
  },
};

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

function detailInsights(report: ReportDefinition, reportData?: ReportDataResponse<unknown>) {
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

function ReportTile({
  report,
  runtimeData,
  loadingState,
  reportData,
  isReportLoading,
  onDetails,
}: {
  report: ReportDefinition;
  runtimeData: ReportRuntimeData;
  loadingState: ReportLoadingState;
  reportData?: ReportDataResponse<unknown>;
  isReportLoading?: boolean;
  onDetails: (report: ReportDefinition) => void;
}) {
  const canView = usePermissionStore((state) =>
    report.permissions.some((permission) => state.hasPermission(permission)),
  );
  const readiness = READINESS_META[report.readiness];
  const priority = PRIORITY_META[report.priority];

  if (report.id === "nabh-evidence-matrix") {
    return (
      <Card withBorder radius="md" padding="md" h="100%">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={3}>
              <Group gap={6}>
                <Badge tone={colorToBadgeTone(priority.color)}>{priority.label}</Badge>
                <Badge tone={colorToBadgeTone(readiness.color)}>{readiness.label}</Badge>
              </Group>
              <Text fw={800}>{report.title}</Text>
              <Text size="sm" c="dimmed">
                {report.purpose}
              </Text>
            </Stack>
          </Group>
          {canView ? (
            <div style={{ position: "relative" }}>
              <Button
                tone="primary"
                size="xs"
                leftSection={<IconFileAnalytics size={14} />}
                onClick={() => onDetails(report)}
                style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
              >
                View details
              </Button>
              <NabhIndicatorMatrix />
            </div>
          ) : (
            <Text size="sm" c="dimmed">
              Restricted by permission: {report.permissions.join(", ")}
            </Text>
          )}
        </Stack>
      </Card>
    );
  }

  return (
    <ReportChart
      title={report.title}
      description={report.purpose}
      permission={report.permissions[0] ?? P.ANALYTICS.VIEW}
      option={optionForReport(report, runtimeData)}
      status={`${reportStatusLabel(report)}${
        reportData ? ` · ${reportData.summary.row_count} rows` : ""
      }`}
      isLoading={loadingForReport(report, loadingState) || isReportLoading}
      disabledActions={report.dataEndpoint === null}
      sourceHref={undefined}
      onViewDetails={() => onDetails(report)}
    />
  );
}

function ReportFamilyPanel({
  family,
  reports,
  runtimeData,
  loadingState,
  reportDataById,
  loadingByReportId,
  onDetails,
}: {
  family: ReportFamily;
  reports: ReportDefinition[];
  runtimeData: ReportRuntimeData;
  loadingState: ReportLoadingState;
  reportDataById: ReportDataById;
  loadingByReportId: Record<string, boolean>;
  onDetails: (report: ReportDefinition) => void;
}) {
  const FamilyIcon = family.icon;
  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Group align="flex-start">
            <ThemeIcon color={family.accent} size={44} radius="md">
              <FamilyIcon size={24} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                {family.eyebrow}
              </Text>
              <Title order={3}>{family.title}</Title>
              <Text c="dimmed">{family.description}</Text>
            </Stack>
          </Group>
          <Group gap="xs">
            <Badge tone={colorToBadgeTone(family.accent)} size="lg">
              {reports.length} charts
            </Badge>
            <Badge tone="danger">
              {reports.filter((report) => report.priority === "P1").length} P1
            </Badge>
          </Group>
        </Group>
        <SimpleGrid cols={{ base: 1, xl: 2 }}>
          {reports.map((report) => (
            <div
              key={report.id}
              className={report.id === "nabh-evidence-matrix" ? styles.fullWidth : undefined}
            >
              <ReportTile
                report={report}
                runtimeData={runtimeData}
                loadingState={loadingState}
                reportData={reportDataById[report.id]}
                isReportLoading={loadingByReportId[report.id]}
                onDetails={onDetails}
              />
            </div>
          ))}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}

export function ReportsPage() {
  useRequirePermission(P.ANALYTICS.VIEW);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);
  const [detailOpened, { open: openDetails, close: closeDetails }] = useDisclosure(false);
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const selectedFamilyId = searchParams.get("family");
  const search = searchParams.get("q") ?? "";
  const priorityFilter = reportPriorityFilter(searchParams.get("priority"));
  const readinessFilter = reportReadinessFilter(searchParams.get("readiness"));
  const normalizedSearch = search.trim().toLowerCase();
  const setReportParam = (key: string, value: string | null, defaultValue?: string) => {
    const next = new URLSearchParams(searchParams);
    const normalizedValue = value?.trim() ?? "";
    if (!normalizedValue || normalizedValue === defaultValue) {
      next.delete(key);
    } else {
      next.set(key, normalizedValue);
    }
    setSearchParams(next, { replace: true });
  };

  const { data: reportCatalog } = useQuery({
    queryKey: ["reports", "catalog"],
    queryFn: () => reportsService.getReportCatalog(),
    enabled: hasPermission(P.ANALYTICS.VIEW),
  });
  const reportFamilies = useMemo(() => catalogToReportFamilies(reportCatalog), [reportCatalog]);
  const activeFamily =
    reportFamilies.find((family) => family.id === selectedFamilyId) ?? reportFamilies[0];
  const visibleFamilies = useMemo(() => {
    const sourceFamilies = normalizedSearch ? reportFamilies : activeFamily ? [activeFamily] : [];
    return sourceFamilies
      .map((family) => ({
        family,
        reports: family.reports.filter((report) => {
          const matchesPriority = priorityFilter === "all" || report.priority === priorityFilter;
          const matchesReadiness =
            readinessFilter === "all" || report.readiness === readinessFilter;
          return (
            matchesPriority &&
            matchesReadiness &&
            reportMatchesSearch(report, family, normalizedSearch)
          );
        }),
      }))
      .filter(({ reports }) => reports.length > 0);
  }, [activeFamily, normalizedSearch, priorityFilter, readinessFilter, reportFamilies]);
  const visibleReportList = useMemo(
    () => visibleFamilies.flatMap(({ reports }) => reports),
    [visibleFamilies],
  );
  const liveReportList = useMemo(
    () => visibleReportList.filter((report) => report.dataEndpoint),
    [visibleReportList],
  );
  const defaultFrom = daysAgoIso(30);
  const liveReportQueries = useQueries({
    queries: liveReportList.map((report) => ({
      queryKey: ["reports", "data", report.id, defaultFrom],
      queryFn: () => reportsService.getReportData(report.id, { from: defaultFrom }),
      enabled: report.permissions.some((permission) => hasPermission(permission)),
      staleTime: 30_000,
    })),
  });
  const reportDataById = useMemo<ReportDataById>(() => {
    const entries = liveReportList.flatMap((report, index) => {
      const data = liveReportQueries[index]?.data;
      return data ? ([[report.id, data]] as const) : [];
    });
    return Object.fromEntries(entries);
  }, [liveReportList, liveReportQueries]);
  const loadingByReportId = useMemo<Record<string, boolean>>(() => {
    const entries = liveReportList.map(
      (report, index) => [report.id, liveReportQueries[index]?.isLoading ?? false] as const,
    );
    return Object.fromEntries(entries);
  }, [liveReportList, liveReportQueries]);
  const runtimeData = useMemo<ReportRuntimeData>(
    () => ({
      opdFootfall: (reportDataById["opd-registration-arrivals"]?.rows ??
        []) as ReportRuntimeData["opdFootfall"],
      bedOccupancy: (reportDataById["ipd-census-bed-occupancy"]?.rows ??
        []) as ReportRuntimeData["bedOccupancy"],
      noShows: (reportDataById["opd-no-show-revisit"]?.rows ?? []) as ReportRuntimeData["noShows"],
    }),
    [reportDataById],
  );
  const loadingState: ReportLoadingState = {
    opdFootfall: loadingByReportId["opd-registration-arrivals"] ?? false,
    bedOccupancy: loadingByReportId["ipd-census-bed-occupancy"] ?? false,
    noShows: loadingByReportId["opd-no-show-revisit"] ?? false,
  };
  const allReports = reportFamilies.flatMap((family) => family.reports);
  const registeredReportCount =
    reportCatalog?.families.reduce((count, family) => count + family.reports.length, 0) ??
    allReports.length;
  const visibleChartCount = visibleFamilies.reduce(
    (count, family) => count + family.reports.length,
    0,
  );

  const showDetails = (report: ReportDefinition) => {
    setSelectedReport(report);
    openDetails();
  };

  return (
    <Stack gap="md">
      <PageHeader
        title="Reporting Command Center"
        subtitle="Native MedBrains reports for hospital operations, NABH evidence, finance, outreach, security, body maps, and predictive workbenches"
        icon={<IconFileAnalytics size={28} />}
      />

      <Card withBorder radius="md" padding="md" className={styles.searchPanel}>
        <Stack gap="sm">
          <Group align="flex-start" justify="space-between">
            <TextInput
              value={search}
              onChange={(event) => setReportParam("q", event.currentTarget.value)}
              placeholder="Search chart, module, source table, KPI, NABH, ABHA, NDPS, DICOM, camp, village..."
              leftSection={<IconSearch size={16} />}
              rightSection={
                search ? (
                  <IconButton
                    size="sm"
                    aria-label="Clear report search"
                    onClick={() => setReportParam("q", null)}
                  >
                    <IconX size={14} />
                  </IconButton>
                ) : undefined
              }
              className={styles.searchInput}
            />
            <Group gap="xs">
              {REPORT_PRIORITY_FILTERS.map((priority) => (
                <Button
                  key={priority}
                  tone={priorityFilter === priority ? "primary" : "secondary"}
                  size="xs"
                  radius="xl"
                  onClick={() => setReportParam("priority", priority, "all")}
                >
                  {priority === "all" ? "All priority" : priority}
                </Button>
              ))}
            </Group>
          </Group>
          <Group gap="xs">
            {REPORT_READINESS_FILTERS.map((readiness) => (
              <Button
                key={readiness}
                tone={readinessFilter === readiness ? "primary" : "secondary"}
                size="xs"
                radius="xl"
                onClick={() => setReportParam("readiness", readiness, "all")}
              >
                {readiness === "all" ? "All readiness" : READINESS_META[readiness].label}
              </Button>
            ))}
          </Group>
          <Text size="xs" c="dimmed">
            Showing {visibleChartCount} of {allReports.length} report surfaces. Backend registry
            returned {registeredReportCount} permission-visible reports with source tables,
            drilldowns, export mode, and readiness.
          </Text>
        </Stack>
      </Card>

      <div className={styles.layout}>
        <Card withBorder radius="md" padding="sm" className={`${styles.sidebar} ${styles.navCard}`}>
          <Stack gap="xs">
            {reportFamilies.map((family) => {
              const Icon = family.icon;
              const isActive = family.id === activeFamily?.id;
              return (
                <NavLink
                  key={family.id}
                  label={family.title}
                  description={`${family.eyebrow} · ${family.reports.length} charts`}
                  leftSection={
                    <ThemeIcon color={family.accent} variant={isActive ? "filled" : "light"}>
                      <Icon size={18} />
                    </ThemeIcon>
                  }
                  active={isActive}
                  onClick={() => setReportParam("family", family.id, reportFamilies[0]?.id)}
                  className={`${styles.familyButton} ${isActive ? styles.familyButtonActive : ""}`}
                />
              );
            })}
          </Stack>
        </Card>

        <Stack gap="md">
          {visibleFamilies.length > 0 ? (
            visibleFamilies.map(({ family, reports }) => (
              <ReportFamilyPanel
                key={family.id}
                family={family}
                reports={reports}
                runtimeData={runtimeData}
                loadingState={loadingState}
                reportDataById={reportDataById}
                loadingByReportId={loadingByReportId}
                onDetails={showDetails}
              />
            ))
          ) : (
            <Card withBorder radius="md" padding="lg">
              <Text fw={700}>No matching reports</Text>
              <Text c="dimmed" size="sm">
                Try another chart, table, module, priority, or readiness filter.
              </Text>
            </Card>
          )}
        </Stack>
      </div>

      <Modal
        opened={detailOpened}
        onClose={closeDetails}
        size="xl"
        title={selectedReport?.title ?? "Report details"}
      >
        {selectedReport && (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 4 }}>
              <Card withBorder radius="md" padding="md">
                <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                  Data version
                </Text>
                <Text size="sm">{formatReportDataStatus(reportDataById[selectedReport.id])}</Text>
              </Card>
              <Card withBorder radius="md" padding="md">
                <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                  Summary report version
                </Text>
                <Text size="sm">
                  {READINESS_META[selectedReport.readiness].label} ·{" "}
                  {PRIORITY_META[selectedReport.priority].label}
                </Text>
              </Card>
              <Card withBorder radius="md" padding="md">
                <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                  Source version
                </Text>
                <Text size="sm">
                  {reportDataById[selectedReport.id]?.summary.source ??
                    reportSourceLabel(selectedReport)}
                </Text>
              </Card>
              <Card withBorder radius="md" padding="md">
                <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                  Generated
                </Text>
                <Text size="sm">{formatGeneratedAt(reportDataById[selectedReport.id])}</Text>
              </Card>
            </SimpleGrid>
            <ReportDetailPanel
              report={{
                id: selectedReport.id,
                title: selectedReport.title,
                description: selectedReport.purpose,
                permission: selectedReport.permissions.join(", "),
                cadence: selectedReport.refresh,
                source: selectedReport.sourceTables.join(", "),
                sourceEvents: selectedReport.sourceEvents ?? [],
                eventPayloadKeys: selectedReport.eventPayloadKeys ?? [],
                indicatorTargets: selectedReport.indicatorTargets ?? [],
                outputs: selectedReport.exports,
                status: READINESS_META[selectedReport.readiness].label,
                dataStatus: formatReportDataStatus(reportDataById[selectedReport.id]),
                dataSource:
                  reportDataById[selectedReport.id]?.summary.source ??
                  selectedReport.sourceTables.join(", "),
                generatedAt: formatGeneratedAt(reportDataById[selectedReport.id]),
                rowCount: reportDataById[selectedReport.id]?.summary.row_count ?? null,
                warning: reportDataById[selectedReport.id]?.summary.warning ?? null,
              }}
              insights={detailInsights(selectedReport, reportDataById[selectedReport.id])}
            />
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
