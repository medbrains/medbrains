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
import { REPORT_DOMAIN_BRIEFS, type ReportDomain } from "./reports/domain-briefs";
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
