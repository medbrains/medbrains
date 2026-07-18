import { Box, Card, Checkbox, Drawer, Grid, Group, Modal, Select, SimpleGrid, Stack, Tabs, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { AdmissionDetailResponse, AdmissionPrintData, AdmissionRow, AnesthesiaComplicationEntry, BedDashboardRow, BedDashboardSummary, BedTransferRequest, BedTransferResponse, ClinicalJourneyActionId, ClinicalJourneyContext, CreateWardRequest, DischargeSummary as DischargeSummaryGenerated, DischargeType, InvestigationsResponse, IpdDischargeChecklist, IpdDischargeSummary, MrdCaseSheetPacket, PrescriptionWithItems, ProcedureConsent, UpdateWardRequest, WardBedRow, WardListRow } from "@medbrains/types";
import {
  BED_BOARD_MUTABLE_STATUS_VALUES,
  BED_BOARD_STATUS_VALUES,
  bedBoardSignalLabel,
  bedBoardSignalLabelKey,
  bedBoardStatusLabel,
  bedBoardStatusLabelKey,
  bedBoardStatusSignal,
  journeyActionSignalLabel,
  P,
  PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
} from "@medbrains/types";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconArrowsTransferDown,
  IconBed,
  IconBuildingHospital,
  IconCalendarTime,
  IconChartBar,
  IconCheck,
  IconClipboardList,
  IconCross,
  IconDoor,
  IconEye,
  IconFileDescription,
  IconFlask,
  IconLayoutGrid,
  IconPencil,
  IconPill,
  IconPlus,
  IconPrinter,
  IconTrash,
  IconUserOff,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  type Column,
  DataTable,
  DocumentActions,
  FormModal,
  OperationalSignal,
  type OperationalSignalShape,
  type OperationalSignalTone,
  PageHeader,
  StatusDot,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import { BedSelect } from "@/components/BedSelect";
import { PatientConsumablesPanel } from "@/components/Clinical";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { DamaModal } from "@/components/Ipd/DamaModal";
import { DischargeWorkflowWizard } from "@/components/Ipd/DischargeWorkflowWizard";
import { MarkDeathModal } from "@/components/Ipd/MarkDeathModal";
import { TransferOutModal } from "@/components/Ipd/TransferOutModal";
import { WristbandPrintModal } from "@/components/Ipd/WristbandPrintModal";
import { InfusionsPanel } from "@/components/Nurse/InfusionsPanel";
import {
  type OrderBasketTab,
  OrderBasketWorkspace,
} from "@/components/OrderBasket/OrderBasketWorkspace";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import {
  Alert,
  Badge,
  type BadgeTone,
  Button,
  type ButtonTone,
  IconButton,
  Table,
  toast,
} from "@/components/ui";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { statusColor } from "@/lib/status-colors";
import { billingService } from "@/services/billing.service";
import { ipdService } from "@/services/ipd.service";
import { mrdService } from "@/services/mrd.service";
import { pharmacyService } from "@/services/pharmacy.service";
import {
  buildCopyPrintHtml,
  copyPrintStyles,
  PRINT_COPY_PACKETS,
  printCopyRouteLabel,
} from "@/utils/printCopies";
import { AdmissionForm } from "./ipd/admission-form";
import { AdmissionPrescriptionsTab } from "./ipd/admission-prescriptions";
import { AssessmentsTab } from "./ipd/assessments";
import { AttendersTab } from "./ipd/attenders";
import { BedTurnaroundView } from "./ipd/bed-turnaround";
import { BillingTab } from "./ipd/billing";
import { BirthRecordsTab } from "./ipd/birth-records";
import { ChecklistTab } from "./ipd/checklist";
import { ClinicalDocsTab } from "./ipd/clinical-docs";
import { DeathSummaryTab } from "./ipd/death-summary";
import { DietTab } from "./ipd/diet";
import { DischargeSummaryTab } from "./ipd/discharge-summary";
import { DischargeTatTab } from "./ipd/discharge-tat";
import { ExpectedDischargesTab } from "./ipd/expected-discharges";
import { InsurancePaTab } from "./ipd/insurance-pa";
import { InvestigationsTab } from "./ipd/investigations";
import { IoChartTab } from "./ipd/io-chart";
import { MarTab } from "./ipd/mar";
import { MlcTab } from "./ipd/mlc";
import { NursingTab } from "./ipd/nursing";
import { ProgressNotesTab } from "./ipd/progress-notes";
import {
  AlosReport,
  CensusReport,
  DischargeStatsReport,
  OccupancyReport,
  SurgeonCaseloadReport,
} from "./ipd/reports";
import { protectedIpdPatientIdentifier, protectedIpdPatientName } from "./ipd/shared";
import { IpTypeConfigSection } from "./ipd/ip-type-config";
import { OverviewTab } from "./ipd/overview";
import { TransferLogTab } from "./ipd/transfer-log";
import classes from "./ipd.module.scss";
import {
  activeIpdInvoiceIdForJourney,
  activeIpdPharmacyOrderIdForJourney,
  activeIpdPharmacyRxQueueIdForJourney,
  deriveIpdJourneyCompletedEvents,
  type IpdActionRailSection,
  type IpdActionRailSectionSummary,
  type IpdWorkspaceTabReadinessSummary,
  ipdActionRailAction,
  ipdActionRailSectionsForTab,
  ipdAdmissionOrderBasketRoute,
  ipdAdmissionWorkspaceTabRoute,
  ipdOrderBasketTabFromSearchParams,
  ipdWorkspaceTabForOrderBasket,
  type ResolvedIpdActionRailAction,
  resolveIpdActionRailActions,
  summarizeIpdActionRailSections,
  summarizeIpdWorkspaceTabReadiness,
} from "./ipd-workspace";

const bedStatusColors: Record<string, string> = {
  vacant_clean: "success",
  vacant_dirty: "warning",
  occupied: "primary",
  occupied_transfer_pending: "orange",
  reserved: "orange",
  maintenance: "slate",
  blocked: "danger",
};

const bedStatusBadgeTones: Record<string, BadgeTone> = {
  vacant_clean: "success",
  vacant_dirty: "warning",
  occupied: "primary",
  occupied_transfer_pending: "warning",
  reserved: "warning",
  maintenance: "neutral",
  blocked: "danger",
};

type IpdTranslate = ReturnType<typeof useTranslation>["t"];

function translatedBedDashboardLabel(
  t: IpdTranslate,
  key: string | null,
  fallback: string,
): string {
  return key ? t(key, { defaultValue: fallback }) : fallback;
}

function bedDashboardStatusLabel(t: IpdTranslate, status: string): string {
  return translatedBedDashboardLabel(
    t,
    bedBoardStatusLabelKey(status),
    bedBoardStatusLabel(status),
  );
}

function bedDashboardSignalLabel(t: IpdTranslate, status: string): string {
  return translatedBedDashboardLabel(
    t,
    bedBoardSignalLabelKey(status),
    bedBoardSignalLabel(status),
  );
}

function bedDashboardStatusTone(status: string): OperationalSignalTone {
  return bedBoardStatusSignal(status).tone;
}

function bedDashboardStatusShape(status: string): OperationalSignalShape {
  return bedBoardStatusSignal(status).shape;
}

function bedDashboardStatusIcon(status: string) {
  switch (status) {
    case "vacant_clean":
      return IconCheck;
    case "vacant_dirty":
      return IconDoor;
    case "occupied":
      return IconBed;
    case "occupied_transfer_pending":
      return IconArrowRight;
    case "reserved":
      return IconCalendarTime;
    case "maintenance":
      return IconAlertTriangle;
    case "blocked":
      return IconUserOff;
    default:
      return undefined;
  }
}

const IPD_WORKSPACE_TABS = [
  { value: "overview", label: "Overview", section: "Command" },
  { value: "notes", label: "Progress Notes", section: "Command" },
  { value: "assessments", label: "Clinical", section: "Command" },
  { value: "mar", label: "MAR", section: "Command" },
  { value: "prescriptions", label: "Prescriptions", section: "Command" },
  { value: "io", label: "I/O Chart", section: "Command" },
  { value: "infusions", label: "Infusions", section: "Command" },
  { value: "nursing", label: "Nursing", section: "Command" },
  { value: "attenders", label: "Attenders", section: "Care Context" },
  { value: "clinical-docs", label: "Clinical Docs", section: "Care Context" },
  { value: "checklist", label: "Checklist", section: "Care Context" },
  { value: "transfer", label: "Transfer", section: "Care Context" },
  { value: "investigations", label: "Investigations", section: "Care Context" },
  { value: "consumables", label: "Consumables", section: "Care Context" },
  { value: "billing-tab", label: "Billing", section: "Finance & Admin" },
  { value: "insurance-pa", label: "Insurance/PA", section: "Finance & Admin" },
  { value: "mlc-tab", label: "MLC", section: "Finance & Admin" },
  { value: "diet-tab", label: "Diet", section: "Finance & Admin" },
  { value: "consents-tab", label: "Consents", section: "Finance & Admin" },
  { value: "death-summary", label: "Death Summary", section: "Finance & Admin" },
  { value: "birth-records", label: "Birth Records", section: "Finance & Admin" },
  { value: "discharge-summary", label: "Discharge Summary", section: "Discharge" },
  { value: "discharge", label: "Discharge", section: "Discharge" },
  { value: "discharge-tat", label: "Discharge TAT", section: "Discharge" },
] as const;

const IPD_WORKSPACE_TAB_VALUES = IPD_WORKSPACE_TABS.map((tab) => tab.value);
const IPD_WORKSPACE_SECTIONS = ["Command", "Care Context", "Finance & Admin", "Discharge"] as const;
const IPD_LANDING_DEFAULT_TAB = "admissions";

const IPD_ACTION_RAIL_LOCAL_ACTION_IDS = [
  "patient.edit",
  "patient.share",
  "patient.print_card",
  "opd.open_visit",
  "orders.medication",
  "orders.lab",
  "orders.radiology",
  "ipd.open_admission",
  "ipd.admit",
  "emergency.open_visit",
  "mrd.open_case_sheet",
] satisfies ClinicalJourneyActionId[];

const DISCHARGE_TYPE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "lama", label: "LAMA" },
  { value: "dama", label: "DAMA" },
  { value: "absconded", label: "Absconded" },
  { value: "referred", label: "Referred" },
  { value: "deceased", label: "Deceased" },
] satisfies { value: DischargeType; label: string }[];

function normalizeDischargeType(value: string | null): DischargeType {
  return DISCHARGE_TYPE_OPTIONS.find((option) => option.value === value)?.value ?? "normal";
}

function emitIpdBedMovementEvent(
  emit: ReturnType<typeof useClinicalEmit>,
  response: BedTransferResponse,
  patientId: string,
  notes?: string,
) {
  if (response.from_bed_id) {
    emit("bed.transferred", {
      admission_id: response.admission_id,
      from_bed_id: response.from_bed_id,
      notes,
      patient_id: patientId,
      reason: response.reason,
      source_record_id: response.transfer_id,
      to_bed_id: response.to_bed_id,
      transfer_id: response.transfer_id,
      transfer_type: response.transfer_type,
    });
    return;
  }

  emit("bed.assigned", {
    admission_id: response.admission_id,
    bed_id: response.to_bed_id,
    notes,
    patient_id: patientId,
    reason: response.reason,
    source_record_id: response.transfer_id,
    transfer_id: response.transfer_id,
  });
}

function firstIpdWorkspaceTabForSection(section: (typeof IPD_WORKSPACE_SECTIONS)[number]) {
  return IPD_WORKSPACE_TABS.find((tab) => tab.section === section)?.value ?? "overview";
}

function ipdWorkspaceSectionLabel(t: IpdTranslate, section: string): string {
  return t(`workspace.sections.${section}`, { defaultValue: section });
}

function ipdWorkspaceTabLabel(t: IpdTranslate, tab: (typeof IPD_WORKSPACE_TABS)[number]): string {
  return t(`workspace.tabs.${tab.value}`, { defaultValue: tab.label });
}

function actionRailSectionLabel(t: IpdTranslate, section: IpdActionRailSection): string {
  return t(`actionRail.sections.${section}`, { defaultValue: section });
}

function actionRailActionLabel(t: IpdTranslate, action: ResolvedIpdActionRailAction): string {
  return t(`actionRail.actions.${action.id}`, { defaultValue: action.label });
}

function actionRailDisabledReason(
  t: IpdTranslate,
  action: ResolvedIpdActionRailAction,
): string | null {
  if (!action.disabledReasonKey || !action.disabledReasonText) {
    return null;
  }

  return t(action.disabledReasonKey, {
    ...action.disabledReasonValues,
    action: actionRailActionLabel(t, action),
    defaultValue: action.disabledReasonText,
  });
}

function actionRailStatusLabel(t: IpdTranslate, action: ResolvedIpdActionRailAction): string {
  if (action.signal.phase === "blocked_by_state") {
    return journeyActionSignalLabel(t, "blocked_by_context");
  }

  return journeyActionSignalLabel(t, action.signal.phase);
}

function workspaceReadinessBlockedReason(
  t: IpdTranslate,
  readiness: IpdWorkspaceTabReadinessSummary | undefined,
  actions: readonly ResolvedIpdActionRailAction[],
): string | null {
  if (!readiness?.primaryBlockedReason) {
    return null;
  }

  const blockedAction = actions.find(
    (action) =>
      readiness.actionSections.includes(action.section) &&
      !action.enabled &&
      action.disabledReasonText === readiness.primaryBlockedReason,
  );

  return blockedAction
    ? actionRailDisabledReason(t, blockedAction)
    : readiness.primaryBlockedReason;
}

function actionRailReadinessLabel(
  summary: Pick<IpdActionRailSectionSummary, "enabledActions" | "totalActions"> | undefined,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (!summary || summary.totalActions === 0) {
    return null;
  }

  return t("actionRail.readySummary", {
    enabled: summary.enabledActions,
    total: summary.totalActions,
  });
}

function actionRailReadinessBadge(
  summary:
    | Pick<IpdActionRailSectionSummary, "blockedActions" | "enabledActions" | "totalActions">
    | undefined,
  t: ReturnType<typeof useTranslation>["t"],
) {
  const readiness = actionRailReadinessLabel(summary, t);
  if (!readiness) {
    return null;
  }

  return (
    <OperationalSignal
      label={readiness}
      shape={summary?.blockedActions ? "diamond" : "pill"}
      size="xs"
      tone={summary?.blockedActions ? "blocked" : "ready"}
    />
  );
}

function ActionRailActionButton({
  action,
  children,
  color,
  leftSection,
  loading,
  onClick,
  variant = "light",
}: {
  action: ResolvedIpdActionRailAction;
  children?: ReactNode;
  color?: string;
  leftSection?: ReactNode;
  loading?: boolean;
  onClick: () => void;
  variant?: "filled" | "light" | "subtle";
}) {
  const { t } = useTranslation("ipd");
  const disabledReason = actionRailDisabledReason(t, action);
  const statusLabel = actionRailStatusLabel(t, action);
  const tooltipLabel = disabledReason ?? actionRailActionLabel(t, action);
  const isDanger = color === "danger";
  const tone: ButtonTone =
    variant === "subtle"
      ? "ghost"
      : variant === "filled"
        ? isDanger
          ? "danger"
          : "primary"
        : isDanger
          ? "subtle-danger"
          : "secondary";

  return (
    <Stack gap={3}>
      <Tooltip label={tooltipLabel}>
        <span className={classes.actionRailButtonTarget}>
          <Button
            tone={tone}
            size="xs"
            leftSection={leftSection}
            disabled={!action.enabled}
            loading={loading}
            onClick={onClick}
            fullWidth
          >
            {children ?? actionRailActionLabel(t, action)}
          </Button>
        </span>
      </Tooltip>
      <Group gap={4} wrap="nowrap">
        <OperationalSignal
          label={statusLabel}
          shape={action.signal.shape}
          size="xs"
          tone={action.signal.tone}
        />
        {!action.enabled && disabledReason && (
          <Text size="10px" c="dimmed" lineClamp={2}>
            {disabledReason}
          </Text>
        )}
      </Group>
    </Stack>
  );
}

function ActionRailSectionHeading({
  summary,
  title,
}: {
  summary: IpdActionRailSectionSummary | undefined;
  title: string;
}) {
  const { t } = useTranslation("ipd");
  const readiness = actionRailReadinessLabel(summary, t);

  return (
    <Group justify="space-between" gap="xs" align="center" wrap="nowrap">
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
        {title}
      </Text>
      <Group gap={4} wrap="nowrap">
        {summary?.focused && (
          <OperationalSignal label={t("actionRail.focus")} shape="token" size="xs" tone="active" />
        )}
        {readiness && actionRailReadinessBadge(summary, t)}
      </Group>
    </Group>
  );
}

export function IpdPage() {
  useRequirePermission(P.IPD.ADMISSIONS_LIST);

  return (
    <ClinicalEventProvider moduleCode="ipd" contextCode="ipd-admissions">
      <IpdPageInner />
    </ClinicalEventProvider>
  );
}

function IpdPageInner() {
  const { t } = useTranslation("ipd");
  const canViewBedDashboard = useHasPermission(P.IPD.BED_DASHBOARD_VIEW);
  const canManageWards = useHasPermission(P.IPD.WARDS_MANAGE);
  const canViewReports = useHasPermission(P.IPD.REPORTS_VIEW);
  const canViewWards = canManageWards || canViewBedDashboard;
  const landingTabValues = useMemo(
    () => [
      IPD_LANDING_DEFAULT_TAB,
      ...(canViewWards ? ["wards"] : []),
      ...(canViewBedDashboard ? ["bed-dashboard"] : []),
      ...(canViewReports ? ["reports"] : []),
      "expected-discharges",
    ],
    [canViewBedDashboard, canViewReports, canViewWards],
  );
  const [activeLandingTab, setActiveLandingTab] = useHashTabs(
    IPD_LANDING_DEFAULT_TAB,
    landingTabValues,
  );
  const safeActiveLandingTab = landingTabValues.includes(activeLandingTab)
    ? activeLandingTab
    : IPD_LANDING_DEFAULT_TAB;

  return (
    <div>
      <PageHeader
        title={t("title.ipd")}
        subtitle={t("subtitle.inpatientDepartment")}
        icon={<IconBed size={20} stroke={1.5} />}
        color="primary"
      />

      <Tabs value={safeActiveLandingTab} onChange={setActiveLandingTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="admissions" leftSection={<IconBed size={16} />}>
            {t("admissions")}
          </Tabs.Tab>
          {canViewWards && (
            <Tabs.Tab value="wards" leftSection={<IconBuildingHospital size={16} />}>
              {t("wards")}
            </Tabs.Tab>
          )}
          {canViewBedDashboard && (
            <Tabs.Tab value="bed-dashboard" leftSection={<IconLayoutGrid size={16} />}>
              {t("bedDashboard")}
            </Tabs.Tab>
          )}
          {canViewReports && (
            <Tabs.Tab value="reports" leftSection={<IconChartBar size={16} />}>
              {t("reports")}
            </Tabs.Tab>
          )}
          <Tabs.Tab value="expected-discharges" leftSection={<IconCalendarTime size={16} />}>
            {t("expectedDischarges")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="admissions">
          <AdmissionsTab />
        </Tabs.Panel>
        {canViewWards && (
          <Tabs.Panel value="wards">
            <WardsTab />
          </Tabs.Panel>
        )}
        {canViewBedDashboard && (
          <Tabs.Panel value="bed-dashboard">
            <BedDashboardTab />
          </Tabs.Panel>
        )}
        {canViewReports && (
          <Tabs.Panel value="reports">
            <ReportsTab />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="expected-discharges">
          <ExpectedDischargesTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Admissions Tab ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function AdmissionsTab() {
  const canCreate = useHasPermission(P.IPD.ADMISSIONS_CREATE);
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;

  const { data, isLoading } = useQuery({
    queryKey: ["admissions", params],
    queryFn: () => ipdService.listAdmissions(params),
  });

  const columns = [
    {
      key: "patient_name",
      label: "Patient",
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: AdmissionRow) => row.patient_name,
      fieldKind: "name",
      hiddenLabel: "Patient restricted",
      render: (row: AdmissionRow) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.patient_name}
          </Text>
          <Text size="xs" c="dimmed">
            {row.uhid}
          </Text>
        </Stack>
      ),
    },
    {
      key: "ward_name",
      label: "Ward",
      render: (row: AdmissionRow) => <Text size="sm">{row.ward_name ?? "—"}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: AdmissionRow) => (
        <StatusDot color={statusColor(row.status) ?? "slate"} label={row.status} />
      ),
    },
    {
      key: "admitted_at",
      label: "Admitted",
      render: (row: AdmissionRow) => (
        <Text size="sm">{new Date(row.admitted_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      requiredPermissions: [P.IPD.ADMISSIONS_VIEW],
      render: (row: AdmissionRow) => (
        <Tooltip label="View details">
          <IconButton
            onClick={() => navigate(`/ipd/admissions/${row.id}`)}
            aria-label={`Open admission ${row.id}`}
          >
            <IconEye size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ] satisfies Column<AdmissionRow>[];

  return (
    <>
      <Group mb="md" justify="space-between">
        <Select
          placeholder="Status"
          data={[
            { value: "admitted", label: "Admitted" },
            { value: "transferred", label: "Transferred" },
            { value: "discharged", label: "Discharged" },
            { value: "absconded", label: "Absconded" },
            { value: "deceased", label: "Deceased" },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
          clearable
          w={180}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate("/ipd/new")}
          >
            New Admission
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={data?.admissions ?? []}
        loading={isLoading}
        page={page}
        totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        virtualized="auto"
        virtualizeAt={40}
        virtualRowHeight={58}
        tableMaxHeight="calc(100vh - 360px)"
      />
    </>
  );
}

export function IpdNewAdmissionPage() {
  useRequirePermission(P.IPD.ADMISSIONS_CREATE);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patient_id") ?? "";

  return (
    <ClinicalEventProvider moduleCode="ipd" contextCode="ipd-new-admission">
      <Stack>
        <PageHeader
          title="New IPD admission"
          subtitle="Admit a registered patient into an inpatient bed and care team."
          icon={<IconBed size={20} stroke={1.5} />}
          color="primary"
          actions={
            <Button tone="ghost" onClick={() => navigate("/ipd")}>
              Back to IPD
            </Button>
          }
        />
        {initialPatientId && <PatientContextBanner patientId={initialPatientId} />}
        <Card withBorder radius="md" p="md">
          <AdmissionForm
            key={initialPatientId}
            initialPatientId={initialPatientId}
            onCancel={() => navigate("/ipd")}
            onCreated={(result) => navigate(`/ipd/admissions/${result.admission.id}`)}
          />
        </Card>
      </Stack>
    </ClinicalEventProvider>
  );
}

export function IpdAdmissionDetailPage() {
  useRequirePermission(P.IPD.ADMISSIONS_VIEW);

  const navigate = useNavigate();
  const { admissionId } = useParams<{ admissionId: string }>();
  const canCreate = useHasPermission(P.IPD.ADMISSIONS_CREATE);
  const canManageBeds = useHasPermission(P.IPD.BEDS_MANAGE);
  const canDischarge = useHasPermission(P.IPD.DISCHARGE_CREATE);

  if (!admissionId) {
    return (
      <ClinicalEventProvider moduleCode="ipd" contextCode="ipd-admission-detail">
        <Stack>
          <PageHeader
            title="IPD admission"
            subtitle="Admission route is missing an admission identifier."
            icon={<IconBed size={20} stroke={1.5} />}
            color="primary"
            actions={
              <Button tone="ghost" onClick={() => navigate("/ipd")}>
                Back to IPD
              </Button>
            }
          />
          <Alert tone="danger" icon={<IconAlertTriangle size={16} />}>
            Unable to open this IPD admission because the route does not include an admission ID.
          </Alert>
        </Stack>
      </ClinicalEventProvider>
    );
  }

  return (
    <ClinicalEventProvider moduleCode="ipd" contextCode="ipd-admission-detail">
      <Stack>
        <PageHeader
          title="IPD admission"
          subtitle="Patient, orders, nursing, discharge, billing, and documentation workspace."
          icon={<IconBed size={20} stroke={1.5} />}
          color="primary"
          actions={
            <Button tone="ghost" onClick={() => navigate("/ipd")}>
              Back to IPD
            </Button>
          }
        />
        <AdmissionDetail
          admissionId={admissionId}
          canCreate={canCreate}
          canManageBeds={canManageBeds}
          canDischarge={canDischarge}
        />
      </Stack>
    </ClinicalEventProvider>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Admission Detail ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function AdmissionDetail({
  admissionId,
  canCreate,
  canManageBeds,
  canDischarge,
}: {
  admissionId: string;
  canCreate: boolean;
  canManageBeds: boolean;
  canDischarge: boolean;
}) {
  const { t } = useTranslation("ipd");
  const canCreateDischargeSummary = useHasPermission(P.IPD.DISCHARGE_SUMMARY_CREATE);
  const canGenerateMrdCaseSheet = useHasPermission(P.MRD.CASE_SHEETS_GENERATE);
  const canViewMrdCaseSheets = useHasPermission(P.MRD.CASE_SHEETS_VIEW);
  const canOrder = useHasPermission(P.ORDER_BASKET.SIGN);
  const canPrintWristband = useHasPermission(P.IPD.WRISTBAND_PRINT);
  const canViewBillingLedger = useHasPermission(P.BILLING.INVOICES_LIST);
  const canViewDischargeTat = useHasPermission(P.IPD.DISCHARGE_TAT_VIEW);
  const canViewPharmacyOrders = useHasPermission(P.PHARMACY.PRESCRIPTIONS_LIST);
  const canCreateTransfer = useHasPermission(P.IPD.TRANSFERS_CREATE);
  const canManageDeathRecords = useHasPermission(P.IPD.DEATH_RECORDS_MANAGE);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const emit = useClinicalEmit();
  const orderBasketDeepLinkTab = ipdOrderBasketTabFromSearchParams(searchParams);
  const [dischargeSummaryOpened, { open: openDischargeSummary, close: closeDischargeSummary }] =
    useDisclosure(false);
  const [bedTransferOpened, { open: openBedTransfer, close: closeBedTransfer }] =
    useDisclosure(false);
  const [damaOpened, { open: openDama, close: closeDama }] = useDisclosure(false);
  const [deathOpened, { open: openDeath, close: closeDeath }] = useDisclosure(false);
  const [wristbandOpened, { open: openWristband, close: closeWristband }] = useDisclosure(false);
  const [transferOutOpened, { open: openTransferOut, close: closeTransferOut }] =
    useDisclosure(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useHashTabs(
    "overview",
    IPD_WORKSPACE_TAB_VALUES,
  );
  const basketOpened = orderBasketDeepLinkTab !== null;
  const basketTab = orderBasketDeepLinkTab ?? "drug";

  function openOrderBasket(tab: OrderBasketTab = "drug") {
    const workspaceTab = ipdWorkspaceTabForOrderBasket(tab);
    setActiveWorkspaceTab(workspaceTab);
    navigate(ipdAdmissionOrderBasketRoute(admissionId, tab));
  }

  function changeOrderBasketTab(tab: OrderBasketTab) {
    setActiveWorkspaceTab(ipdWorkspaceTabForOrderBasket(tab));
    navigate(ipdAdmissionOrderBasketRoute(admissionId, tab), { replace: true });
  }

  function closeOrderBasket() {
    navigate(ipdAdmissionWorkspaceTabRoute(admissionId, activeWorkspaceTab), { replace: true });
  }

  const { data } = useQuery({
    queryKey: ["admission-detail", admissionId],
    queryFn: () => ipdService.getAdmission(admissionId),
  });
  const { data: mrdCaseSheetPackets = [] } = useQuery<MrdCaseSheetPacket[]>({
    queryKey: ["mrd-case-sheets", "ipd", admissionId],
    queryFn: () =>
      mrdService.listMrdCaseSheetPackets({
        admission_id: admissionId,
        packet_type: "ipd",
      }),
    enabled: canViewMrdCaseSheets,
    staleTime: 60_000,
  });
  const admissionDetail = data as AdmissionDetailResponse | undefined;
  const admission = admissionDetail?.admission;
  const admissionPatientId = admission?.patient_id;
  const admissionEncounterId = admission?.encounter_id;
  const { data: admissionPrescriptions = [] } = useQuery<PrescriptionWithItems[]>({
    queryKey: ["encounter-prescriptions", admissionEncounterId],
    queryFn: () =>
      admissionEncounterId
        ? ipdService.listPrescriptions(admissionEncounterId)
        : Promise.resolve([]),
    enabled: Boolean(admissionEncounterId),
  });
  const { data: admissionInvestigations } = useQuery<InvestigationsResponse>({
    queryKey: ["ipd-investigations", admissionId],
    queryFn: () => ipdService.getAdmissionInvestigations(admissionId),
  });
  const { data: dischargeSummary = null } = useQuery<IpdDischargeSummary | null>({
    queryKey: ["ipd-discharge-summary", admissionId],
    queryFn: () => ipdService.getDischargeSummary(admissionId).catch(() => null),
  });
  const { data: patientInvoiceList } = useQuery({
    queryKey: ["invoices", "ipd-handoff", admissionPatientId],
    queryFn: () =>
      billingService.listInvoices({
        page: "1",
        patient_id: admissionPatientId ?? "",
        per_page: "20",
      }),
    enabled: canViewBillingLedger && Boolean(admissionPatientId),
  });
  const { data: patientPharmacyOrderList } = useQuery({
    queryKey: ["pharmacy-orders", "ipd-handoff", admissionPatientId],
    queryFn: () =>
      pharmacyService.listPharmacyOrders({
        page: "1",
        patient_id: admissionPatientId ?? "",
        per_page: "20",
      }),
    enabled: canViewPharmacyOrders && Boolean(admissionPatientId),
  });
  const generateMrdCaseSheetMutation = useMutation({
    mutationFn: () => mrdService.generateIpdCaseSheetPacket(admissionId),
    onSuccess: (packet) => {
      emit("mrd.case_sheet.generated", {
        packet_id: packet.id,
        packet_number: packet.packet_number,
        packet_type: packet.packet_type,
        patient_id: packet.patient_id,
        admission_id: packet.admission_id,
        source_record_id: packet.id,
      });
      void queryClient.invalidateQueries({ queryKey: ["mrd-case-sheets"] });
      toast.success(
        t("notifications.mrdHandoffSent.message", {
          packetNumber: packet.packet_number,
        }),
        { title: t("notifications.mrdHandoffSent.title") },
      );
    },
    onError: () => {
      toast.error(t("notifications.mrdHandoffFailed.message"), {
        title: t("notifications.mrdHandoffFailed.title"),
      });
    },
  });
  const journeyCompletedEvents = deriveIpdJourneyCompletedEvents({
    admission,
    dischargeSummary,
    invoices: patientInvoiceList?.invoices ?? [],
    investigations: admissionInvestigations,
    mrdCaseSheetPackets,
    pharmacyOrders: patientPharmacyOrderList?.orders ?? [],
    prescriptions: admissionPrescriptions,
  });

  if (!data) return <Text c="dimmed">{t("loading...")}</Text>;

  const detail = data as AdmissionDetailResponse;
  const adm = detail.admission;
  const latestMrdCaseSheet = mrdCaseSheetPackets[0];
  const activeInvoiceId = activeIpdInvoiceIdForJourney(patientInvoiceList?.invoices ?? []);
  const activePharmacyOrderId = activeIpdPharmacyOrderIdForJourney({
    pharmacyOrders: patientPharmacyOrderList?.orders ?? [],
    prescriptions: admissionPrescriptions,
  });
  const activePharmacyRxQueueId = activeIpdPharmacyRxQueueIdForJourney(admissionPrescriptions);
  const admissionIsActive = adm.status === "admitted";
  const admissionHasAssignedBed = Boolean(adm.bed_id);
  const activeWorkspaceSection =
    IPD_WORKSPACE_TABS.find((tab) => tab.value === activeWorkspaceTab)?.section ?? "Command";
  const activeWorkspaceSectionLabel = ipdWorkspaceSectionLabel(t, activeWorkspaceSection);
  const focusedActionRailSections = ipdActionRailSectionsForTab(activeWorkspaceTab);
  const actionRailSectionFocused = (section: IpdActionRailSection) =>
    focusedActionRailSections.includes(section);
  const actionRailActions = resolveIpdActionRailActions({
    admissionHasAssignedBed,
    admissionIsActive,
    canCreateDischargeSummary,
    canCreateTransfer,
    canDischarge,
    canGenerateMrdCaseSheet,
    canManageDeathRecords,
    canOrder,
    canPrintWristband,
    canViewBillingLedger,
    canViewDischargeTat,
    canViewMrdCaseSheets,
    completedEvents: journeyCompletedEvents,
    hasMrdCaseSheet: Boolean(latestMrdCaseSheet),
  });
  const actionRailSectionSummaries = summarizeIpdActionRailSections(
    actionRailActions,
    focusedActionRailSections,
  );
  const workspaceTabReadinessSummaries = summarizeIpdWorkspaceTabReadiness(
    IPD_WORKSPACE_TABS,
    actionRailSectionSummaries,
    actionRailActions,
  );
  const actionRailSummaryBySection = new Map(
    actionRailSectionSummaries.map((summary) => [summary.section, summary]),
  );
  const workspaceTabReadinessByTab = new Map(
    workspaceTabReadinessSummaries.map((summary) => [summary.tab, summary]),
  );
  const actionRailSectionSummary = (section: IpdActionRailSection) =>
    actionRailSummaryBySection.get(section);
  const focusedModeledActions = actionRailSectionSummaries
    .filter((summary) => summary.focused)
    .reduce((sum, summary) => sum + summary.totalActions, 0);
  const focusedReadyActions = actionRailSectionSummaries
    .filter((summary) => summary.focused)
    .reduce((sum, summary) => sum + summary.enabledActions, 0);
  const focusedBlockedActions = actionRailSectionSummaries
    .filter((summary) => summary.focused)
    .reduce((sum, summary) => sum + summary.blockedActions, 0);
  const orderMedicinesAction = ipdActionRailAction(actionRailActions, "order_medicines");
  const orderLabAction = ipdActionRailAction(actionRailActions, "order_lab");
  const orderImagingAction = ipdActionRailAction(actionRailActions, "order_imaging");
  const patientLedgerAction = ipdActionRailAction(actionRailActions, "open_patient_ledger");
  const generateMrdCaseSheetAction = ipdActionRailAction(
    actionRailActions,
    "generate_mrd_case_sheet",
  );
  const openMrdPacketAction = ipdActionRailAction(actionRailActions, "open_mrd_packet");
  const printWristbandAction = ipdActionRailAction(actionRailActions, "print_wristband");
  const referOutAction = ipdActionRailAction(actionRailActions, "refer_out");
  const damaAction = ipdActionRailAction(actionRailActions, "dama_lama");
  const markDeathAction = ipdActionRailAction(actionRailActions, "mark_death");
  const viewDischargeTatAction = ipdActionRailAction(actionRailActions, "view_discharge_tat");
  const journeyContext: ClinicalJourneyContext = {
    patientId: adm.patient_id,
    activeEncounterId: adm.encounter_id,
    activeAdmissionId: adm.id,
    activeAdmissionStatus: adm.status,
    activeBedId: adm.bed_id,
    activeInvoiceId,
    activePharmacyOrderId,
    activePharmacyRxQueueId,
    activeOrderContext: "ipd",
    completedEvents: journeyCompletedEvents,
  };

  return (
    <Stack className={classes.admissionWorkspace}>
      <Box className={classes.commandBar}>
        <Stack gap="xs">
          <PatientContextBanner patientId={adm.patient_id} surface="detail" />
          <PatientFlowNavigator
            patientId={adm.patient_id}
            active="ipd"
            activeEncounterId={adm.encounter_id}
            activeAdmissionId={adm.id}
            activeAdmissionStatus={adm.status}
            activeBedId={adm.bed_id}
            activeInvoiceId={activeInvoiceId}
            activeOrderContext="ipd"
            activePharmacyOrderId={activePharmacyOrderId}
            activePharmacyRxQueueId={activePharmacyRxQueueId}
            completedEvents={journeyCompletedEvents}
            compact
          />
          <Group justify="space-between" align="flex-start" gap="sm">
            <Stack gap={4}>
              <Group gap="xs">
                <Text fw={700}>{t("admissionContext.shortId", { id: adm.id.slice(0, 8) })}</Text>
                {adm.is_critical && (
                  <OperationalSignal label={t("critical")} shape="diamond" size="xs" tone="risk" />
                )}
                {adm.mlc_case_id && (
                  <OperationalSignal label={t("mlc")} shape="diamond" size="xs" tone="blocked" />
                )}
                <OperationalSignal
                  label={t(`admissionSignals.status.${adm.status}`, {
                    defaultValue: adm.status,
                  })}
                  shape="pill"
                  tone={adm.status === "admitted" ? "active" : "neutral"}
                />
                <OperationalSignal
                  icon={IconBed}
                  label={
                    admissionHasAssignedBed
                      ? t("admissionSignals.bedAssigned")
                      : t("admissionSignals.bedNotAssigned")
                  }
                  shape="bed"
                  tone={admissionHasAssignedBed ? "ready" : "blocked"}
                />
              </Group>
              <Group gap="xs">
                <Badge tone="neutral">
                  {t("admissionContext.admittedAt", {
                    date: new Date(adm.admitted_at).toLocaleDateString(),
                  })}
                </Badge>
                {adm.admission_source && (
                  <Badge tone="neutral">
                    {t("admissionContext.source", { source: adm.admission_source })}
                  </Badge>
                )}
                {adm.provisional_diagnosis && (
                  <Badge tone="primary">{t("admissionContext.diagnosisLinked")}</Badge>
                )}
              </Group>
            </Stack>
            <Group gap="xs" justify="flex-end">
              <PatientJourneyActions
                context={journeyContext}
                localOrderContext="ipd"
                hiddenActionIds={["ipd.open_admission", "ipd.admit"]}
                size="xs"
                onOpenOrderBasket={openOrderBasket}
              />
              <PrintAdmissionButton admissionId={admissionId} />
              {canCreateDischargeSummary && admissionIsActive && (
                <Tooltip label={t("label.generateDischargeSummary")}>
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconFileDescription size={14} />}
                    onClick={openDischargeSummary}
                  >
                    {t("label.dischargeSummary")}
                  </Button>
                </Tooltip>
              )}
              {canManageBeds && admissionIsActive && (
                <Tooltip label={t("label.transferBed")}>
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconArrowsTransferDown size={14} />}
                    onClick={openBedTransfer}
                  >
                    {t("label.transferBed")}
                  </Button>
                </Tooltip>
              )}
            </Group>
          </Group>
        </Stack>
      </Box>

      <GenerateDischargeSummaryModal
        admissionId={admissionId}
        opened={dischargeSummaryOpened}
        onClose={closeDischargeSummary}
      />
      <BedTransferModal
        admissionId={admissionId}
        opened={bedTransferOpened}
        onClose={closeBedTransfer}
        patientId={adm.patient_id}
      />
      <DamaModal admissionId={admissionId} opened={damaOpened} onClose={closeDama} />
      <MarkDeathModal admissionId={admissionId} opened={deathOpened} onClose={closeDeath} />
      <WristbandPrintModal
        admissionId={admissionId}
        opened={wristbandOpened}
        onClose={closeWristband}
        canReprint
      />
      <TransferOutModal
        admissionId={admissionId}
        opened={transferOutOpened}
        onClose={closeTransferOut}
      />
      <OrderBasketWorkspace
        opened={basketOpened}
        onClose={closeOrderBasket}
        encounterId={adm.encounter_id}
        patientId={adm.patient_id}
        activeTab={basketTab}
        onActiveTabChange={changeOrderBasketTab}
        onSigned={() => {
          void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
          void queryClient.invalidateQueries({
            queryKey: ["encounter-prescriptions", adm.encounter_id],
          });
          void queryClient.invalidateQueries({ queryKey: ["ipd-investigations", admissionId] });
          void queryClient.invalidateQueries({ queryKey: ["ipd-estimated-cost", admissionId] });
          void queryClient.invalidateQueries({ queryKey: ["ipd-billing-summary", admissionId] });
          void queryClient.invalidateQueries({ queryKey: ["patient-invoices", adm.patient_id] });
        }}
      />
      {adm.discharged_at && (
        <Alert tone="neutral">
          {t("admissionContext.dischargedAt", {
            date: new Date(adm.discharged_at).toLocaleString(),
          })}
        </Alert>
      )}
      {adm.provisional_diagnosis && (
        <Text size="sm" c="dimmed">
          {t("admissionContext.diagnosis", { diagnosis: adm.provisional_diagnosis })}
        </Text>
      )}

      <Box className={classes.sectionSwitch}>
        <Group justify="space-between" align="center" gap="sm">
          <Stack gap={2}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              {t("workspace.title")}
            </Text>
            <Text size="sm" fw={600}>
              {activeWorkspaceSectionLabel}
            </Text>
            {focusedModeledActions > 0 && (
              <Group gap={4}>
                <Badge size="xs" tone="success">
                  {t("actionRail.readyCount", { count: focusedReadyActions })}
                </Badge>
                {focusedBlockedActions > 0 && (
                  <Badge size="xs" tone="warning">
                    {t("actionRail.blockedCount", { count: focusedBlockedActions })}
                  </Badge>
                )}
              </Group>
            )}
          </Stack>
          <Group gap="xs">
            {IPD_WORKSPACE_SECTIONS.map((section) => (
              <Button
                key={section}
                tone={activeWorkspaceSection === section ? "primary" : "secondary"}
                size="xs"
                onClick={() => setActiveWorkspaceTab(firstIpdWorkspaceTabForSection(section))}
              >
                {ipdWorkspaceSectionLabel(t, section)}
              </Button>
            ))}
          </Group>
        </Group>
      </Box>

      <Tabs value={activeWorkspaceTab} onChange={setActiveWorkspaceTab} keepMounted={false}>
        <Grid align="flex-start" className={classes.workspaceGrid}>
          <Grid.Col span={{ base: 12, md: 3, lg: 2 }}>
            <Box className={classes.workspaceRail}>
              <Stack gap="sm">
                {IPD_WORKSPACE_SECTIONS.map((section) => (
                  <Stack key={section} gap={4}>
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                      {ipdWorkspaceSectionLabel(t, section)}
                    </Text>
                    {IPD_WORKSPACE_TABS.filter((tab) => tab.section === section).map((tab) => {
                      const readiness = workspaceTabReadinessByTab.get(tab.value);
                      const tabLabel = ipdWorkspaceTabLabel(t, tab);
                      const blockedReason = workspaceReadinessBlockedReason(
                        t,
                        readiness,
                        actionRailActions,
                      );
                      const tooltipLabel =
                        blockedReason ??
                        (readiness?.totalActions
                          ? t("actionRail.actionsReady", {
                              enabled: readiness.enabledActions,
                              total: readiness.totalActions,
                            })
                          : t("actionRail.workspace", { tab: tabLabel }));

                      return (
                        <Tooltip key={tab.value} label={tooltipLabel} position="right">
                          <Button
                            tone={activeWorkspaceTab === tab.value ? "secondary" : "ghost"}
                            size="xs"
                            onClick={() => setActiveWorkspaceTab(tab.value)}
                            rightSection={actionRailReadinessBadge(readiness, t)}
                            fullWidth
                          >
                            <Stack gap={0} className={classes.workspaceRailLabel}>
                              <Text size="xs" fw={600}>
                                {tabLabel}
                              </Text>
                              {blockedReason && (
                                <Text size="10px" c="orange" truncate>
                                  {blockedReason}
                                </Text>
                              )}
                            </Stack>
                          </Button>
                        </Tooltip>
                      );
                    })}
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 9, lg: 7 }} className={classes.workspaceMain}>
            <Tabs.Panel value="overview" pt="md">
              <OverviewTab admissionId={admissionId} tasks={detail.tasks} canCreate={canCreate} />
            </Tabs.Panel>
            <Tabs.Panel value="notes" pt="md">
              <ProgressNotesTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="assessments" pt="md">
              <AssessmentsTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="mar" pt="md">
              <MarTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="prescriptions" pt="md">
              <AdmissionPrescriptionsTab
                encounterId={detail.encounter.id}
                patientId={adm.patient_id}
              />
            </Tabs.Panel>
            <Tabs.Panel value="io" pt="md">
              <IoChartTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="infusions" pt="md">
              <InfusionsPanel admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="nursing" pt="md">
              <NursingTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="attenders" pt="md">
              <AttendersTab admissionId={admissionId} canCreate={canCreate} />
            </Tabs.Panel>
            <Tabs.Panel value="clinical-docs" pt="md">
              <ClinicalDocsTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="checklist" pt="md">
              <ChecklistTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="transfer" pt="md">
              <TransferTab
                admissionId={admissionId}
                canManage={canManageBeds}
                patientId={adm.patient_id}
                status={adm.status}
              />
              <TransferLogTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="investigations" pt="md">
              <InvestigationsTab
                admissionId={admissionId}
                canOrder={orderLabAction.enabled || orderImagingAction.enabled}
                onOrderLab={() => openOrderBasket("lab")}
                onOrderRadiology={() => openOrderBasket("radiology")}
              />
            </Tabs.Panel>
            <Tabs.Panel value="consumables" pt="md">
              <PatientConsumablesPanel
                patientId={adm.patient_id}
                encounterId={adm.encounter_id}
                admissionId={adm.id}
              />
            </Tabs.Panel>
            <Tabs.Panel value="billing-tab" pt="md">
              <BillingTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="insurance-pa" pt="md">
              <InsurancePaTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="mlc-tab" pt="md">
              <MlcTab admissionId={admissionId} canCreate={canCreate} />
            </Tabs.Panel>
            <Tabs.Panel value="diet-tab" pt="md">
              <DietTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="consents-tab" pt="md">
              <ConsentsTab admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="death-summary" pt="md">
              <DeathSummaryTab
                admissionId={admissionId}
                patientId={adm.patient_id}
                status={adm.status}
              />
            </Tabs.Panel>
            <Tabs.Panel value="birth-records" pt="md">
              <BirthRecordsTab admissionId={admissionId} motherPatientId={adm.patient_id} />
            </Tabs.Panel>
            <Tabs.Panel value="discharge-summary" pt="md">
              <DischargeSummaryTab
                admissionId={admissionId}
                canCreate={canCreateDischargeSummary}
                patientId={adm.patient_id}
              />
            </Tabs.Panel>
            <Tabs.Panel value="discharge" pt="md">
              <DischargeTab
                admissionId={admissionId}
                canDischarge={canDischarge}
                patientId={adm.patient_id}
                status={adm.status}
              />
              <DischargeWorkflowWizard admissionId={admissionId} />
            </Tabs.Panel>
            <Tabs.Panel value="discharge-tat" pt="md">
              <DischargeTatTab admissionId={admissionId} />
            </Tabs.Panel>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 3 }}>
            <Box className={classes.actionRail}>
              <Stack gap="sm">
                <Stack gap={2}>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    {t("actionRail.title")}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t("actionRail.description")}
                  </Text>
                  <Group gap={4} mt={4}>
                    {focusedActionRailSections.map((section) => (
                      <Badge key={section} size="xs" tone="primary">
                        {actionRailSectionLabel(t, section)}
                      </Badge>
                    ))}
                    {focusedModeledActions > 0 && (
                      <>
                        <Badge size="xs" tone="success">
                          {t("actionRail.readyCount", { count: focusedReadyActions })}
                        </Badge>
                        {focusedBlockedActions > 0 && (
                          <Badge size="xs" tone="warning">
                            {t("actionRail.blockedCount", { count: focusedBlockedActions })}
                          </Badge>
                        )}
                      </>
                    )}
                  </Group>
                </Stack>
                <Stack
                  gap="xs"
                  className={classes.actionRailSection}
                  data-focused={actionRailSectionFocused("handoffs") || undefined}
                >
                  <ActionRailSectionHeading
                    title={actionRailSectionLabel(t, "handoffs")}
                    summary={actionRailSectionSummary("handoffs")}
                  />
                  <Text size="xs" c="dimmed">
                    {t("actionRail.sectionDescription.handoffs")}
                  </Text>
                  <Box className={classes.handoffActions}>
                    <PatientJourneyActions
                      context={journeyContext}
                      localOrderContext="ipd"
                      hiddenActionIds={IPD_ACTION_RAIL_LOCAL_ACTION_IDS}
                      size="xs"
                      layout="rail"
                      emptyLabel={t("actionRail.emptyHandoffs")}
                    />
                  </Box>
                </Stack>
                <Stack
                  gap="xs"
                  className={classes.actionRailSection}
                  data-focused={actionRailSectionFocused("orders") || undefined}
                >
                  <ActionRailSectionHeading
                    title={actionRailSectionLabel(t, "orders")}
                    summary={actionRailSectionSummary("orders")}
                  />
                  <ActionRailActionButton
                    action={orderMedicinesAction}
                    color="teal"
                    leftSection={<IconPill size={14} />}
                    onClick={() => openOrderBasket("drug")}
                  />
                  <ActionRailActionButton
                    action={orderLabAction}
                    color="teal"
                    leftSection={<IconFlask size={14} />}
                    onClick={() => openOrderBasket("lab")}
                  />
                  <ActionRailActionButton
                    action={orderImagingAction}
                    color="teal"
                    leftSection={<IconEye size={14} />}
                    onClick={() => openOrderBasket("radiology")}
                  />
                </Stack>
                <Stack
                  gap="xs"
                  className={classes.actionRailSection}
                  data-focused={actionRailSectionFocused("finance") || undefined}
                >
                  <ActionRailSectionHeading
                    title={actionRailSectionLabel(t, "finance")}
                    summary={actionRailSectionSummary("finance")}
                  />
                  <Button
                    tone={activeWorkspaceTab === "billing-tab" ? "primary" : "secondary"}
                    size="xs"
                    leftSection={<IconArrowRight size={14} />}
                    onClick={() => setActiveWorkspaceTab("billing-tab")}
                    fullWidth
                  >
                    {t("actionRail.nav.ipdBillingTab")}
                  </Button>
                  <ActionRailActionButton
                    action={patientLedgerAction}
                    color="orange"
                    leftSection={<IconArrowRight size={14} />}
                    onClick={() =>
                      navigate(
                        `/billing?tab=invoices&patient_id=${adm.patient_id}&source=ipd_admission`,
                      )
                    }
                  />
                  <Button
                    tone={activeWorkspaceTab === "insurance-pa" ? "primary" : "ghost"}
                    size="xs"
                    leftSection={<IconArrowRight size={14} />}
                    onClick={() => setActiveWorkspaceTab("insurance-pa")}
                    fullWidth
                  >
                    {t("actionRail.nav.insurancePa")}
                  </Button>
                </Stack>
                <Stack
                  gap="xs"
                  className={classes.actionRailSection}
                  data-focused={actionRailSectionFocused("mrd") || undefined}
                >
                  <ActionRailSectionHeading
                    title={actionRailSectionLabel(t, "mrd")}
                    summary={actionRailSectionSummary("mrd")}
                  />
                  <ActionRailActionButton
                    action={generateMrdCaseSheetAction}
                    color="violet"
                    leftSection={<IconClipboardList size={14} />}
                    loading={generateMrdCaseSheetMutation.isPending}
                    onClick={() => generateMrdCaseSheetMutation.mutate()}
                    variant={latestMrdCaseSheet ? "subtle" : "light"}
                  >
                    {latestMrdCaseSheet
                      ? t("actionRail.nav.updateCaseSheet")
                      : t("actionRail.nav.sendCaseSheet")}
                  </ActionRailActionButton>
                  <ActionRailActionButton
                    action={openMrdPacketAction}
                    leftSection={<IconArrowRight size={12} />}
                    onClick={() =>
                      navigate(`/mrd?packet_type=ipd&admission_id=${admissionId}#case-sheets`)
                    }
                    variant="subtle"
                  />
                </Stack>
                <Stack
                  gap="xs"
                  className={classes.actionRailSection}
                  data-focused={actionRailSectionFocused("admission") || undefined}
                >
                  <ActionRailSectionHeading
                    title={actionRailSectionLabel(t, "admission")}
                    summary={actionRailSectionSummary("admission")}
                  />
                  <ActionRailActionButton
                    action={printWristbandAction}
                    color="slate"
                    leftSection={<IconPrinter size={14} />}
                    onClick={openWristband}
                  />
                  <Group gap="xs">
                    <DocumentActions templateCode="patient_wristband" sourceId={admissionId} />
                    <DocumentActions templateCode="discharge_summary" sourceId={admissionId} />
                  </Group>
                  <ActionRailActionButton
                    action={referOutAction}
                    color="primary"
                    leftSection={<IconArrowsTransferDown size={14} />}
                    onClick={openTransferOut}
                  />
                  <ActionRailActionButton
                    action={damaAction}
                    color="warning"
                    leftSection={<IconUserOff size={14} />}
                    onClick={openDama}
                  />
                  <ActionRailActionButton
                    action={markDeathAction}
                    color="danger"
                    leftSection={<IconCross size={14} />}
                    onClick={openDeath}
                  />
                </Stack>
                <Stack
                  gap="xs"
                  className={classes.actionRailSection}
                  data-focused={actionRailSectionFocused("discharge") || undefined}
                >
                  <ActionRailSectionHeading
                    title={actionRailSectionLabel(t, "discharge")}
                    summary={actionRailSectionSummary("discharge")}
                  />
                  <Button
                    tone={activeWorkspaceTab === "discharge-summary" ? "primary" : "secondary"}
                    size="xs"
                    leftSection={<IconFileDescription size={14} />}
                    onClick={() => setActiveWorkspaceTab("discharge-summary")}
                    fullWidth
                  >
                    {t("actionRail.nav.summaryTab")}
                  </Button>
                  <Button
                    tone={activeWorkspaceTab === "discharge" ? "primary" : "secondary"}
                    size="xs"
                    leftSection={<IconClipboardList size={14} />}
                    onClick={() => setActiveWorkspaceTab("discharge")}
                    fullWidth
                  >
                    {t("actionRail.nav.checklist")}
                  </Button>
                  <ActionRailActionButton
                    action={viewDischargeTatAction}
                    color="teal"
                    leftSection={<IconCalendarTime size={14} />}
                    onClick={() => setActiveWorkspaceTab("discharge-tat")}
                    variant={activeWorkspaceTab === "discharge-tat" ? "filled" : "subtle"}
                  />
                </Stack>
              </Stack>
            </Box>
          </Grid.Col>
        </Grid>
      </Tabs>
    </Stack>
  );
}

// ── Overview (tasks) ───────────────────────────────────


function TransferTab({
  admissionId,
  canManage,
  patientId,
  status,
}: {
  admissionId: string;
  canManage: boolean;
  patientId: string;
  status: string;
}) {
  const { t } = useTranslation("ipd");
  const queryClient = useQueryClient();
  const [bedId, setBedId] = useState("");
  const [notes, setNotes] = useState("");
  const emit = useClinicalEmit();

  const transferMutation = useMutation({
    mutationFn: () =>
      ipdService.bedTransfer(admissionId, {
        notes: notes.trim(),
        reason: notes.trim(),
        to_bed_id: bedId,
      }),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      void queryClient.invalidateQueries({ queryKey: ["bed-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-transfers", admissionId] });
      toast.success(t("notify.bedTransferRecorded"), { title: t("notify.transferred") });
      emitIpdBedMovementEvent(emit, response, patientId, notes.trim());
      setBedId("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Transfer blocked" }),
  });

  if (status !== "admitted") {
    return (
      <Text c="dimmed" size="sm">
        {t("transferIsOnlyAvailableForAdmittedPatients.")}
      </Text>
    );
  }

  return (
    <Stack>
      {canManage ? (
        <>
          <BedSelect
            label={t("label.newBed")}
            value={bedId}
            onChange={(id) => setBedId(id)}
            required
          />
          <Textarea
            label={t("label.transferNotes")}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
          <Button
            tone="primary"
            leftSection={<IconBed size={16} />}
            onClick={() => transferMutation.mutate()}
            loading={transferMutation.isPending}
            disabled={!bedId || !notes.trim()}
          >
            {t("label.transferBed")}
          </Button>
        </>
      ) : (
        <Text c="dimmed" size="sm">
          {t("youDoNotHavePermissionToTransferBeds.")}
        </Text>
      )}
    </Stack>
  );
}

// ── Discharge ──────────────────────────────────────────

function DischargeTab({
  admissionId,
  canDischarge,
  patientId,
  status,
}: {
  admissionId: string;
  canDischarge: boolean;
  patientId: string;
  status: string;
}) {
  const queryClient = useQueryClient();
  const [dischargeType, setDischargeType] = useState<DischargeType>("normal");
  const [summary, setSummary] = useState("");
  const emit = useClinicalEmit();

  const { data: checklist } = useQuery({
    queryKey: ["ipd-discharge-checklist", admissionId],
    queryFn: () => ipdService.listDischargeChecklist(admissionId),
  });

  const dischargeMutation = useMutation({
    mutationFn: () =>
      ipdService.dischargePatient(admissionId, {
        discharge_type: dischargeType,
        discharge_summary: summary || undefined,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      toast.success("Patient discharged", { title: "Discharged" });
      emit("ipd.discharge.completed", {
        admission_id: admissionId,
        discharge_type: result.discharge_type ?? dischargeType,
        patient_id: result.patient_id ?? patientId,
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Discharge blocked" }),
  });

  if (status === "discharged" || status === "absconded" || status === "deceased") {
    return (
      <Text c="dimmed" size="sm">
        This patient has already been discharged.
      </Text>
    );
  }

  const items = (checklist ?? []) as IpdDischargeChecklist[];

  return (
    <Stack>
      {items.length > 0 && (
        <>
          <Text fw={600} size="sm">
            Discharge Checklist
          </Text>
          {items.map((it) => (
            <Group key={it.id} gap="xs">
              <Checkbox checked={it.status === "completed"} readOnly size="xs" />
              <Text size="sm">{it.item_label}</Text>
              <Badge
                size="xs"
                tone={
                  it.status === "completed"
                    ? "success"
                    : it.status === "not_applicable"
                      ? "neutral"
                      : "warning"
                }
              >
                {it.status}
              </Badge>
            </Group>
          ))}
        </>
      )}

      {canDischarge ? (
        <>
          <Select
            label="Discharge Type"
            data={DISCHARGE_TYPE_OPTIONS}
            value={dischargeType}
            onChange={(v) => setDischargeType(normalizeDischargeType(v))}
          />
          <Textarea
            label="Discharge Summary"
            value={summary}
            onChange={(e) => setSummary(e.currentTarget.value)}
            autosize
            minRows={3}
          />
          <Button
            tone="danger"
            leftSection={<IconDoor size={16} />}
            onClick={() => dischargeMutation.mutate()}
            loading={dischargeMutation.isPending}
          >
            Discharge Patient
          </Button>
        </>
      ) : (
        <Text c="dimmed" size="sm">
          You do not have permission to discharge patients.
        </Text>
      )}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Wards Tab ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function WardsTab() {
  const canManage = useHasPermission(P.IPD.WARDS_MANAGE);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editWard, setEditWard] = useState<WardListRow | null>(null);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ipd-wards"],
    queryFn: () => ipdService.listWards(),
  });

  const wards = (data ?? []) as WardListRow[];

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: WardListRow) => (
        <Text size="sm" fw={500}>
          {row.code}
        </Text>
      ),
    },
    { key: "name", label: "Name", render: (row: WardListRow) => <Text size="sm">{row.name}</Text> },
    {
      key: "department_name",
      label: "Department",
      render: (row: WardListRow) => <Text size="sm">{row.department_name ?? "—"}</Text>,
    },
    {
      key: "ward_type",
      label: "Type",
      render: (row: WardListRow) => <Badge size="sm">{row.ward_type}</Badge>,
    },
    {
      key: "beds",
      label: "Beds",
      render: (row: WardListRow) => (
        <Text size="sm">
          {row.vacant_beds}/{row.total_beds} available
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: WardListRow) => (
        <Badge size="xs" tone={row.is_active ? "success" : "neutral"}>
          {row.is_active ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: WardListRow) => (
        <Group gap={4}>
          <Tooltip label="View beds">
            <IconButton aria-label="View beds" onClick={() => setSelectedWardId(row.id)}>
              <IconEye size={14} />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Tooltip label="Edit">
              <IconButton aria-label="Edit" onClick={() => setEditWard(row)}>
                <IconPencil size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group justify="flex-end">
          <Button
            tone="primary"
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={openCreate}
          >
            New Ward
          </Button>
        </Group>
      )}

      <DataTable columns={columns} data={wards} loading={isLoading} rowKey={(row) => row.id} />

      <CreateWardDrawer opened={createOpened} onClose={closeCreate} />
      <EditWardDrawer ward={editWard} onClose={() => setEditWard(null)} />

      <Drawer
        opened={!!selectedWardId}
        onClose={() => setSelectedWardId(null)}
        title="Ward Beds"
        position="right"
        size="lg"
      >
        {selectedWardId && <WardBedsPanel wardId={selectedWardId} canManage={canManage} />}
      </Drawer>

      {canManage && <IpTypeConfigSection />}
    </Stack>
  );
}

function CreateWardDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [wardType, setWardType] = useState("general");
  const [genderRestriction, setGenderRestriction] = useState("any");

  const mutation = useMutation({
    mutationFn: (d: CreateWardRequest) => ipdService.createWard(d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
      onClose();
      setCode("");
      setName("");
      setDepartmentId("");
      setWardType("general");
      setGenderRestriction("any");
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="New Ward" position="right" size="xl">
      <Stack>
        <TextInput
          label="Code"
          required
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
        />
        <TextInput
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <DepartmentSelect value={departmentId} onChange={(id) => setDepartmentId(id)} />
        <Select
          label="Ward Type"
          data={["general", "icu", "nicu", "picu", "isolation", "hdu", "private", "semi_private"]}
          value={wardType}
          onChange={(v) => setWardType(v ?? "general")}
        />
        <Select
          label="Gender Restriction"
          data={[
            { value: "any", label: "Any" },
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
          value={genderRestriction}
          onChange={(v) => setGenderRestriction(v ?? "any")}
        />
        <Button
          tone="primary"
          onClick={() =>
            mutation.mutate({
              code,
              name,
              department_id: departmentId || undefined,
              ward_type: wardType,
              gender_restriction: genderRestriction,
            })
          }
          loading={mutation.isPending}
        >
          Create Ward
        </Button>
      </Stack>
    </Drawer>
  );
}

function EditWardDrawer({ ward, onClose }: { ward: WardListRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(ward?.name ?? "");
  const [wardType, setWardType] = useState(ward?.ward_type ?? "general");
  const [genderRestriction, setGenderRestriction] = useState(ward?.gender_restriction ?? "any");
  const [isActive, setIsActive] = useState(ward?.is_active ?? true);

  const mutation = useMutation({
    mutationFn: (d: UpdateWardRequest) => ipdService.updateWard(ward?.id ?? "", d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
      onClose();
    },
  });

  if (!ward) return null;

  return (
    <Drawer
      opened={!!ward}
      onClose={onClose}
      title={`Edit Ward: ${ward.code}`}
      position="right"
      size="xl"
    >
      <Stack>
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Select
          label="Ward Type"
          data={["general", "icu", "nicu", "picu", "isolation", "hdu", "private", "semi_private"]}
          value={wardType}
          onChange={(v) => setWardType(v ?? "general")}
        />
        <Select
          label="Gender Restriction"
          data={[
            { value: "any", label: "Any" },
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
          value={genderRestriction}
          onChange={(v) => setGenderRestriction(v ?? "any")}
        />
        <Checkbox
          label="Active"
          checked={isActive}
          onChange={(e) => setIsActive(e.currentTarget.checked)}
        />
        <Button
          tone="primary"
          onClick={() =>
            mutation.mutate({
              name: name || undefined,
              ward_type: wardType || undefined,
              gender_restriction: genderRestriction || undefined,
              is_active: isActive,
            })
          }
          loading={mutation.isPending}
        >
          Save Changes
        </Button>
      </Stack>
    </Drawer>
  );
}

function WardBedsPanel({ wardId, canManage }: { wardId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const [bedLocationId, setBedLocationId] = useState("");
  const [bedTypeId, setBedTypeId] = useState("");

  const { data } = useQuery({
    queryKey: ["ipd-ward-beds", wardId],
    queryFn: () => ipdService.listWardBeds(wardId),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      ipdService.assignBedToWard(wardId, {
        bed_location_id: bedLocationId,
        bed_type_id: bedTypeId || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-ward-beds", wardId] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
      setBedLocationId("");
      setBedTypeId("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (mappingId: string) => ipdService.removeBedFromWard(wardId, mappingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-ward-beds", wardId] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
    },
  });

  const beds = (data ?? []) as WardBedRow[];

  return (
    <Stack>
      {canManage && (
        <Group>
          <TextInput
            placeholder="Bed Location ID"
            value={bedLocationId}
            onChange={(e) => setBedLocationId(e.currentTarget.value)}
          />
          <TextInput
            placeholder="Bed Type ID"
            value={bedTypeId}
            onChange={(e) => setBedTypeId(e.currentTarget.value)}
          />
          <Button
            tone="primary"
            size="sm"
            onClick={() => assignMutation.mutate()}
            loading={assignMutation.isPending}
          >
            Assign Bed
          </Button>
        </Group>
      )}
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Bed</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Patient</Table.Th>
            {canManage && <Table.Th>Actions</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {beds.map((b) => {
            const patientName = protectedIpdPatientName(b.patient_name, patientNameAccess);
            const patientUhid = protectedIpdPatientIdentifier(b.patient_uhid, uhidAccess);

            return (
              <Table.Tr key={b.mapping_id}>
                <Table.Td>
                  <Text size="sm">{b.bed_name}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{b.bed_type_name ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" tone={bedStatusBadgeTones[b.status] ?? "neutral"}>
                    {b.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {b.patient_name ? (
                    <Stack gap={0}>
                      <Text size="xs">{patientName}</Text>
                      <Text size="xs" c="dimmed">
                        {patientUhid}
                      </Text>
                    </Stack>
                  ) : (
                    "—"
                  )}
                </Table.Td>
                {canManage && (
                  <Table.Td>
                    <Tooltip label="Remove from ward">
                      <IconButton
                        tone="danger"
                        aria-label="Remove from ward"
                        onClick={() =>
                          confirmDestructive({
                            title: "Remove bed",
                            message: `Remove bed ${b.bed_name} from this ward?`,
                            confirmLabel: "Remove bed",
                            onConfirm: () => removeMutation.mutate(b.mapping_id),
                          })
                        }
                        disabled={b.status === "occupied"}
                      >
                        <IconTrash size={14} />
                      </IconButton>
                    </Tooltip>
                  </Table.Td>
                )}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      {beds.length === 0 && (
        <Text c="dimmed" size="sm">
          No beds assigned to this ward.
        </Text>
      )}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════
// ── IP Type Configuration Section ────────────────────────
// ═══════════════════════════════════════════════════════════


function BedDashboardTab() {
  const { t } = useTranslation("ipd");
  const canManageBeds = useHasPermission(P.IPD.BEDS_MANAGE);
  const canViewAdmissions = useHasPermission(P.IPD.ADMISSIONS_VIEW);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filterWard, setFilterWard] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [showTurnaround, setShowTurnaround] = useState(false);
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);

  const { data: summaryData } = useQuery({
    queryKey: ["ipd-bed-dashboard-summary"],
    queryFn: () => ipdService.bedDashboardSummary(),
  });

  const bedParams: Record<string, string> = {};
  if (filterWard) bedParams.ward_id = filterWard;
  if (filterStatus) bedParams.status = filterStatus;

  const { data: bedsData, isLoading } = useQuery({
    queryKey: ["ipd-bed-dashboard-beds", bedParams],
    queryFn: () =>
      ipdService.bedDashboardBeds(Object.keys(bedParams).length > 0 ? bedParams : undefined),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      ipdService.updateBedStatus(bedId, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-bed-dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-bed-dashboard-beds"] });
    },
  });

  const summaryRows = (summaryData ?? []) as BedDashboardSummary[];
  const beds = (bedsData ?? []) as BedDashboardRow[];

  // Aggregate totals across all wards
  const totals = summaryRows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      vacant_clean: acc.vacant_clean + r.vacant_clean,
      vacant_dirty: acc.vacant_dirty + r.vacant_dirty,
      occupied: acc.occupied + r.occupied,
      reserved: acc.reserved + r.reserved,
      maintenance: acc.maintenance + r.maintenance,
      blocked: acc.blocked + r.blocked,
    }),
    {
      total: 0,
      vacant_clean: 0,
      vacant_dirty: 0,
      occupied: 0,
      reserved: 0,
      maintenance: 0,
      blocked: 0,
    },
  );

  const wardOptions = summaryRows.flatMap((row) =>
    row.ward_id
      ? [{ value: row.ward_id, label: row.ward_name ?? t("bedDashboard.unknownWard") }]
      : [],
  );
  const statusOptions = BED_BOARD_STATUS_VALUES.map((status) => ({
    value: status,
    label: bedDashboardStatusLabel(t, status),
  }));

  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, sm: 4, md: 7 }}>
        <Card withBorder p="xs">
          <OperationalSignal
            label={t("bedDashboard.summary.total")}
            shape="pill"
            size="xs"
            tone="neutral"
            value={totals.total}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("vacant_clean")}
            label={bedDashboardSignalLabel(t, "vacant_clean")}
            shape={bedDashboardStatusShape("vacant_clean")}
            size="xs"
            tone={bedDashboardStatusTone("vacant_clean")}
            value={totals.vacant_clean}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("vacant_dirty")}
            label={bedDashboardSignalLabel(t, "vacant_dirty")}
            shape={bedDashboardStatusShape("vacant_dirty")}
            size="xs"
            tone={bedDashboardStatusTone("vacant_dirty")}
            value={totals.vacant_dirty}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("occupied")}
            label={bedDashboardSignalLabel(t, "occupied")}
            shape={bedDashboardStatusShape("occupied")}
            size="xs"
            tone={bedDashboardStatusTone("occupied")}
            value={totals.occupied}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("reserved")}
            label={bedDashboardSignalLabel(t, "reserved")}
            shape={bedDashboardStatusShape("reserved")}
            size="xs"
            tone={bedDashboardStatusTone("reserved")}
            value={totals.reserved}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("maintenance")}
            label={bedDashboardSignalLabel(t, "maintenance")}
            shape={bedDashboardStatusShape("maintenance")}
            size="xs"
            tone={bedDashboardStatusTone("maintenance")}
            value={totals.maintenance}
          />
        </Card>
        <Card withBorder p="xs">
          <OperationalSignal
            icon={bedDashboardStatusIcon("blocked")}
            label={bedDashboardSignalLabel(t, "blocked")}
            shape={bedDashboardStatusShape("blocked")}
            size="xs"
            tone={bedDashboardStatusTone("blocked")}
            value={totals.blocked}
          />
        </Card>
      </SimpleGrid>

      <Group>
        <Select
          placeholder={t("placeholder.filterByWard")}
          data={wardOptions}
          value={filterWard}
          onChange={setFilterWard}
          clearable
          w={200}
        />
        <Select
          placeholder={t("placeholder.filterByStatus")}
          data={statusOptions}
          value={filterStatus}
          onChange={setFilterStatus}
          clearable
          w={200}
        />
        <Button
          tone={showTurnaround ? "primary" : "secondary"}
          size="sm"
          onClick={() => setShowTurnaround((v) => !v)}
        >
          {t("bedDashboard.actions.turnaround")}
        </Button>
      </Group>

      {showTurnaround && <BedTurnaroundView />}

      {isLoading ? (
        <Text c="dimmed">{t("bedDashboard.loadingBeds")}</Text>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }}>
          {beds.map((bed) => {
            const bedStatus = bed.bed_status;
            const admissionId = bed.admission_id;
            const patientName = protectedIpdPatientName(bed.patient_name, patientNameAccess);
            const patientUhid = protectedIpdPatientIdentifier(bed.patient_uhid, uhidAccess);

            return (
              <Card
                key={bed.bed_state_id}
                withBorder
                p="xs"
                style={{
                  borderLeft: `4px solid var(--mantine-color-${bedStatusColors[bedStatus] ?? "slate"}-5)`,
                }}
              >
                <Text size="sm" fw={600}>
                  {bed.bed_name}
                </Text>
                <Text size="xs" c="dimmed">
                  {bed.ward_name ?? t("bedDashboard.unassignedWard")}
                </Text>
                <Group gap={4} mt={6} wrap="wrap">
                  <OperationalSignal
                    icon={bedDashboardStatusIcon(bedStatus)}
                    label={bedDashboardSignalLabel(t, bedStatus)}
                    shape={bedDashboardStatusShape(bedStatus)}
                    size="xs"
                    tone={bedDashboardStatusTone(bedStatus)}
                    value={bedDashboardStatusLabel(t, bedStatus)}
                  />
                  {admissionId && (
                    <OperationalSignal
                      icon={IconBuildingHospital}
                      label={t("bedDashboard.patient.activeAdmission")}
                      shape="token"
                      size="xs"
                      tone="active"
                    />
                  )}
                </Group>
                {admissionId ? (
                  <Stack gap={0} mt={4}>
                    <Text size="xs">{patientName}</Text>
                    <Text size="xs" c="dimmed">
                      {patientUhid}
                    </Text>
                  </Stack>
                ) : (
                  <Text size="xs" c="dimmed" mt={4}>
                    {t("bedDashboard.patient.noActiveAdmission")}
                  </Text>
                )}
                {canViewAdmissions && admissionId && (
                  <Button
                    tone="ghost"
                    size="compact-xs"
                    mt={6}
                    leftSection={<IconEye size={12} />}
                    onClick={() => navigate(ipdAdmissionWorkspaceTabRoute(admissionId, "overview"))}
                  >
                    {t("bedDashboard.actions.openAdmission")}
                  </Button>
                )}
                {canManageBeds && bedStatus !== "occupied" && (
                  <Select
                    size="xs"
                    mt={4}
                    placeholder={t("placeholder.changeStatus")}
                    data={BED_BOARD_MUTABLE_STATUS_VALUES.filter(
                      (statusOption) => statusOption !== bedStatus,
                    ).map((statusOption) => ({
                      value: statusOption,
                      label: bedDashboardStatusLabel(t, statusOption),
                    }))}
                    onChange={(value) => {
                      if (value) {
                        updateStatusMutation.mutate({
                          bedId: bed.bed_location_id,
                          status: value,
                        });
                      }
                    }}
                    clearable
                  />
                )}
              </Card>
            );
          })}
        </SimpleGrid>
      )}
      {beds.length === 0 && !isLoading && (
        <Text c="dimmed" size="sm">
          {t("bedDashboard.noBedsFound")}
        </Text>
      )}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Reports Tab ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function ReportsTab() {
  const [reportType, setReportType] = useState("census");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  return (
    <Stack>
      <Group>
        <Select
          label="Report"
          data={[
            { value: "census", label: "Current Census" },
            { value: "occupancy", label: "Occupancy Rate" },
            { value: "alos", label: "Average Length of Stay" },
            { value: "discharge-stats", label: "Discharge Statistics" },
            { value: "surgeon-caseload", label: "Surgeon Caseload (OT)" },
            { value: "anesthesia-complications", label: "Anesthesia Complications (OT)" },
          ]}
          value={reportType}
          onChange={(v) => setReportType(v ?? "census")}
          w={250}
        />
        {reportType !== "census" && (
          <>
            <TextInput
              label="From"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.currentTarget.value)}
            />
            <TextInput
              label="To"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.currentTarget.value)}
            />
          </>
        )}
      </Group>

      {reportType === "census" && <CensusReport />}
      {reportType === "occupancy" && <OccupancyReport from={fromDate} to={toDate} />}
      {reportType === "alos" && <AlosReport from={fromDate} to={toDate} />}
      {reportType === "discharge-stats" && <DischargeStatsReport from={fromDate} to={toDate} />}
      {reportType === "surgeon-caseload" && <SurgeonCaseloadReport from={fromDate} to={toDate} />}
      {reportType === "anesthesia-complications" && (
        <AnesthesiaComplicationsReport from={fromDate} to={toDate} />
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  IPD Phase 2b — Clinical Docs
// ══════════════════════════════════════════════════════════

function ConsentsTab({ admissionId }: { admissionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-consents", admissionId],
    queryFn: () => ipdService.getAdmissionConsents(admissionId),
  });

  const rows = (data ?? []) as ProcedureConsent[];
  const consentStatusColors: Record<string, BadgeTone> = {
    pending: "warning",
    signed: "success",
    refused: "danger",
    withdrawn: "warning",
    expired: "neutral",
  };

  return (
    <Stack>
      <Text fw={600}>Procedure Consents</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Procedure</Table.Th>
              <Table.Th>Consent Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Signed</Table.Th>
              <Table.Th>Consented By</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {c.procedure_name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{c.consent_type}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge tone={consentStatusColors[c.status] ?? "neutral"} size="sm">
                    {c.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {c.signed_at ? new Date(c.signed_at).toLocaleDateString() : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{c.consented_by_name ?? "—"}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No procedure consents for this encounter.
        </Text>
      )}
    </Stack>
  );
}

// ── Admission Print ────────────────────────────────────

const IPD_ADMISSION_PRINT_COPIES = PRINT_COPY_PACKETS.ipdAdmission;

function PrintAdmissionButton({ admissionId }: { admissionId: string }) {
  const printRef = useRef<HTMLDivElement | null>(null);
  const [printing, setPrinting] = useState(false);
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const { data } = useQuery({
    queryKey: ["ipd-print", admissionId],
    queryFn: () => ipdService.getAdmissionPrintData(admissionId),
    enabled: printing,
  });

  const printData = data as AdmissionPrintData | undefined;
  const printablePatientName = printData
    ? protectedIpdPatientName(printData.patient_name, patientNameAccess)
    : "Patient";
  const printableUhid = printData
    ? protectedIpdPatientIdentifier(printData.uhid, uhidAccess)
    : "No UHID";

  const handlePrint = () => {
    if (!printRef.current || !printData) return;
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Admission Slip - ${printableUhid}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111; font-size: 13px; }
            .admission-slip { border: 1px solid #ccc; border-radius: 4px; padding: 16px; }
            .title { text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 16px; text-transform: uppercase; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; }
            .label { color: #555; font-size: 11px; text-transform: uppercase; }
            .value { font-weight: 600; margin-top: 2px; }
            .diagnosis { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 12px; }
            ${copyPrintStyles()}
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${buildCopyPrintHtml(printRef.current.innerHTML, IPD_ADMISSION_PRINT_COPIES)}
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!printing) {
    return (
      <Button
        tone="secondary"
        size="xs"
        leftSection={<IconPrinter size={14} />}
        onClick={() => setPrinting(true)}
      >
        Print Slip
      </Button>
    );
  }

  if (!printData)
    return (
      <Text size="xs" c="dimmed">
        Loading print data...
      </Text>
    );

  return (
    <Drawer opened onClose={() => setPrinting(false)} title="Admission Slip" size="md">
      <Stack p="md">
        <Group gap={6}>
          {IPD_ADMISSION_PRINT_COPIES.map((copy) => (
            <Badge key={copy.label} tone="accent">
              {printCopyRouteLabel(copy)}
            </Badge>
          ))}
        </Group>
        <Stack ref={printRef} className="admission-slip" p="md" id="admission-slip-print">
          <Text ta="center" fw={700} size="lg" className="title">
            Admission Slip
          </Text>
          <SimpleGrid cols={2} className="grid">
            <div>
              <Text size="xs" c="dimmed" className="label">
                Patient Name
              </Text>
              <Text fw={500} className="value">
                {printablePatientName}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                UHID
              </Text>
              <Text fw={500} className="value">
                {printableUhid}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Age
              </Text>
              <Text className="value">{printData.age ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Gender
              </Text>
              <Text className="value">{printData.gender ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Admission Date
              </Text>
              <Text className="value">{new Date(printData.admission_date).toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Ward
              </Text>
              <Text className="value">{printData.ward_name ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Bed
              </Text>
              <Text className="value">{printData.bed_number ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Department
              </Text>
              <Text className="value">{printData.department_name ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                Attending Doctor
              </Text>
              <Text className="value">{printData.doctor_name ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" className="label">
                IP Type
              </Text>
              <Text className="value">{printData.ip_type ?? "—"}</Text>
            </div>
          </SimpleGrid>
          {printData.provisional_diagnosis && (
            <div className="diagnosis">
              <Text size="xs" c="dimmed" className="label">
                Provisional Diagnosis
              </Text>
              <Text className="value">{printData.provisional_diagnosis}</Text>
            </div>
          )}
        </Stack>
        <Button
          tone="primary"
          mt="md"
          leftSection={<IconPrinter size={16} />}
          onClick={handlePrint}
        >
          Print admission packet
        </Button>
      </Stack>
    </Drawer>
  );
}

// ── Bed Turnaround View ────────────────────────────────

// ══════════════════════════════════════════════════════════
//  Phase 3b — Death Summary Tab
// ══════════════════════════════════════════════════════════

function GenerateDischargeSummaryModal({
  admissionId,
  opened,
  onClose,
}: {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
}) {
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["generated-discharge-summary", admissionId],
    queryFn: () => ipdService.generateDischargeSummary(admissionId),
    enabled: false,
  });

  const generateMutation = useMutation({
    mutationFn: () => ipdService.generateDischargeSummary(admissionId),
    onSuccess: () => {
      refetch();
      toast.success("Discharge summary generated", { title: "Generated" });
    },
    onError: () => {
      toast.error("Failed to generate discharge summary", { title: "Error" });
    },
  });

  const summary = data as DischargeSummaryGenerated | undefined;
  const patientName = summary
    ? protectedIpdPatientName(summary.patient_name, patientNameAccess)
    : "Patient";

  return (
    <Modal opened={opened} onClose={onClose} title="Discharge Summary" size="lg">
      <Stack>
        {!summary && !isLoading && (
          <Button
            tone="primary"
            onClick={() => generateMutation.mutate()}
            loading={generateMutation.isPending}
          >
            Generate Discharge Summary
          </Button>
        )}
        {(isLoading || generateMutation.isPending) && <Text c="dimmed">Generating...</Text>}
        {summary && (
          <Stack gap="sm">
            <Group>
              <Text fw={600}>Patient:</Text>
              <Text>{patientName}</Text>
            </Group>
            <Group>
              <Text fw={600}>Admission Date:</Text>
              <Text>{new Date(summary.admission_date).toLocaleDateString()}</Text>
            </Group>
            {summary.discharge_date && (
              <Group>
                <Text fw={600}>Discharge Date:</Text>
                <Text>{new Date(summary.discharge_date).toLocaleDateString()}</Text>
              </Group>
            )}
            {summary.diagnoses.length > 0 && (
              <Stack gap={2}>
                <Text fw={600}>Diagnoses:</Text>
                {summary.diagnoses.map((d) => (
                  <Badge key={d} size="sm">
                    {d}
                  </Badge>
                ))}
              </Stack>
            )}
            {summary.procedures.length > 0 && (
              <Stack gap={2}>
                <Text fw={600}>Procedures:</Text>
                {summary.procedures.map((p) => (
                  <Badge key={p} tone="primary" size="sm">
                    {p}
                  </Badge>
                ))}
              </Stack>
            )}
            {summary.medications.length > 0 && (
              <Stack gap={2}>
                <Text fw={600}>Medications at Discharge:</Text>
                {summary.medications.map((m) => (
                  <Badge key={m} tone="success" size="sm">
                    {m}
                  </Badge>
                ))}
              </Stack>
            )}
            {summary.instructions && (
              <Stack gap={2}>
                <Text fw={600}>Instructions:</Text>
                <Text size="sm">{summary.instructions}</Text>
              </Stack>
            )}
            {summary.follow_up && (
              <Stack gap={2}>
                <Text fw={600}>Follow-up:</Text>
                <Text size="sm">{summary.follow_up}</Text>
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Bed Transfer Modal ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function BedTransferModal({
  admissionId,
  opened,
  onClose,
  patientId,
}: {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
  patientId: string;
}) {
  const { t } = useTranslation("ipd");
  const queryClient = useQueryClient();
  const emit = useClinicalEmit();
  const [toBedId, setToBedId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const transferMutation = useMutation({
    mutationFn: (data: BedTransferRequest) => ipdService.bedTransfer(admissionId, data),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      void queryClient.invalidateQueries({ queryKey: ["bed-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-transfers", admissionId] });
      toast.success(t("notify.bedTransferCompleted"), { title: t("notify.transferred") });
      emitIpdBedMovementEvent(emit, response, patientId, notes.trim());
      onClose();
      setToBedId("");
      setReason("");
      setNotes("");
    },
    onError: () => {
      toast.error(t("notify.bedTransferFailed"), { title: t("notify.error") });
    },
  });

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={t("title.bedTransfer")}
      size="md"
      onSubmit={(e) => {
        e.preventDefault();
        transferMutation.mutate({ to_bed_id: toBedId, reason, notes: notes || undefined });
      }}
      submitLabel={t("transfer")}
      submitting={transferMutation.isPending}
      submitDisabled={!toBedId.trim() || !reason.trim()}
    >
      <BedSelect
        label={t("label.targetBed")}
        value={toBedId}
        onChange={(id) => setToBedId(id)}
        required
      />
      <TextInput
        label={t("label.reason")}
        placeholder={t("placeholder.reasonForTransfer")}
        value={reason}
        onChange={(e) => setReason(e.currentTarget.value)}
        required
      />
      <Textarea
        label={t("label.notes")}
        placeholder={t("placeholder.optionalTransferNotes")}
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
    </FormModal>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Expected Discharges Tab ───────────────────────────────
// ═══════════════════════════════════════════════════════════

function AnesthesiaComplicationsReport({ from, to }: { from: string; to: string }) {
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const { data, isLoading } = useQuery({
    queryKey: ["ot-anesthesia-complications", from, to],
    queryFn: () =>
      ipdService.listAnesthesiaComplications({ from: from || undefined, to: to || undefined }),
  });

  const rows = (data ?? []) as AnesthesiaComplicationEntry[];

  return (
    <Stack>
      <Text fw={500}>Anesthesia Complications</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No anesthesia complications recorded in this period.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Patient</Table.Th>
              <Table.Th>Procedure</Table.Th>
              <Table.Th>Anesthesia Type</Table.Th>
              <Table.Th>Complications</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => {
              const patientName = protectedIpdPatientName(r.patient_name, patientNameAccess);

              return (
                <Table.Tr key={r.case_id}>
                  <Table.Td>
                    <Text size="sm">{r.case_date}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {patientName}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{r.procedure_name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm">{r.anesthesia_type}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="danger" lineClamp={2}>
                      {r.complications ?? "—"}
                    </Text>
                    {r.adverse_events != null && typeof r.adverse_events === "object" ? (
                      <Badge size="xs" tone="danger" mt={2}>
                        Has adverse events
                      </Badge>
                    ) : null}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
