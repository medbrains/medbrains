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
import { P, type ReportDataResponse } from "@medbrains/types";
import { IconFileAnalytics, IconSearch, IconX } from "@tabler/icons-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { NabhIndicatorMatrix } from "@/components/Reports/NabhIndicatorMatrix";
import { ReportChart } from "@/components/Reports/ReportChart";
import { ReportDetailPanel } from "@/components/Reports/ReportDetailPanel";
import { Badge, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { reportsService } from "@/services/reports.service";
import { optionForReport } from "./reports/chart-options";
import {
  catalogToReportFamilies,
  colorToBadgeTone,
  daysAgoIso,
  detailInsights,
  formatGeneratedAt,
  formatReportDataStatus,
  loadingForReport,
  PRIORITY_META,
  READINESS_META,
  reportMatchesSearch,
  reportSourceLabel,
  reportStatusLabel,
} from "./reports/report-helpers";
import type {
  ReportDataById,
  ReportDefinition,
  ReportFamily,
  ReportLoadingState,
  ReportPriority,
  ReportReadiness,
  ReportRuntimeData,
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
