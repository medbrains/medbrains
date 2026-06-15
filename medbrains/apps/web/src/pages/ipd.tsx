import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Alert,
  Box,
  Card,
  Checkbox,
  Drawer,
  Grid,
  Group,
  Menu,
  Modal,
  NumberInput,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  IpdAdmissionFormInput,
  IpdAttenderFormInput,
  IpdClinicalAssessmentFormInput,
  IpdNursingTaskFormInput,
  IpdProgressNoteFormInput,
} from "@medbrains/schemas";
import {
  ipdAdmissionFormSchema,
  ipdAttenderFormSchema,
  ipdClinicalAssessmentFormSchema,
  ipdNursingTaskFormSchema,
  ipdProgressNoteFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdmissionAttender,
  AdmissionChecklist,
  AdmissionDetailResponse,
  AdmissionPrintData,
  AdmissionRow,
  AnesthesiaComplicationEntry,
  BedDashboardRow,
  BedDashboardSummary,
  BedTransferRequest,
  BedTransferResponse,
  BedTurnaroundLog,
  BillingSummaryResponse,
  CensusWardRow,
  ClinicalJourneyActionId,
  ClinicalJourneyContext,
  CreateAdmissionResponse,
  CreateBirthRecordRequest,
  CreateClinicalDocRequest,
  CreateDeathSummaryRequest,
  CreateDischargeSummaryRequest,
  CreateNursingTaskRequest,
  CreateRestraintCheckRequest,
  CreateTransferRequest,
  CreateWardRequest,
  DeathCertFormType,
  DietOrder,
  DischargeSummary as DischargeSummaryGenerated,
  DischargeType,
  EstimatedCostResponse,
  ExpectedDischargeRow,
  FieldAccessLevel,
  InvestigationsResponse,
  IpdBirthRecord,
  IpdCarePlan,
  IpdClinicalAssessment,
  IpdClinicalDocType,
  IpdClinicalDocumentation,
  IpdDeathSummary,
  IpdDischargeChecklist,
  IpdDischargeSummary,
  IpdDischargeTatLog,
  IpdHandoverReport,
  IpdIntakeOutput,
  IpdMedicationAdministration,
  IpdProgressNote,
  IpdTransferLog,
  IpTypeConfiguration,
  MlcCase,
  MrdCaseSheetPacket,
  NursingTask,
  PrescriptionWithItems,
  PriorAuthRequestRow,
  ProcedureConsent,
  Receipt,
  RestraintCheckStatus,
  RestraintMonitoringLog,
  SurgeonCaseloadEntry,
  TransferType,
  UpdateDischargeSummaryRequest,
  UpdateWardRequest,
  WardBedRow,
  WardListRow,
} from "@medbrains/types";
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
import { fieldAccessText } from "@medbrains/utils";
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
  IconLink,
  IconPencil,
  IconPill,
  IconPlus,
  IconPrinter,
  IconTrash,
  IconUserOff,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
  PrescriptionViews,
  StatusDot,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import { BedSelect } from "@/components/BedSelect";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { DamaModal } from "@/components/Ipd/DamaModal";
import { DischargeWorkflowWizard } from "@/components/Ipd/DischargeWorkflowWizard";
import { MarkDeathModal } from "@/components/Ipd/MarkDeathModal";
import { TransferOutModal } from "@/components/Ipd/TransferOutModal";
import { WristbandPrintModal } from "@/components/Ipd/WristbandPrintModal";
import {
  type OrderBasketTab,
  OrderBasketWorkspace,
} from "@/components/OrderBasket/OrderBasketWorkspace";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, type ButtonTone } from "@/components/ui";
import { WardSelect } from "@/components/WardSelect";
import { ALL_TEMPLATES, type ChecklistTemplate } from "@/data/checklist-templates";
import {
  bradenRiskLevel,
  calculateBradenTotal,
  DEFAULT_IPD_ADMISSION_VALUES,
  DEFAULT_IPD_ATTENDER_VALUES,
  DEFAULT_IPD_CLINICAL_ASSESSMENT_VALUES,
  DEFAULT_IPD_NURSING_TASK_VALUES,
  DEFAULT_IPD_PROGRESS_NOTE_VALUES,
  IPD_ADMISSION_SOURCE_OPTIONS,
  IPD_ASSESSMENT_TYPE_OPTIONS,
  IPD_BRADEN_INJURY_ACQUIRED_OPTIONS,
  IPD_BRADEN_INJURY_STAGE_OPTIONS,
  IPD_ID_PROOF_TYPE_OPTIONS,
  IPD_RISK_LEVEL_OPTIONS,
  ipdOptionalText,
  normalizeIpdAdmissionSource,
  normalizeIpdAssessmentType,
  nursingTaskTypeOptions,
  progressNoteTypeOptions,
  toCreateAdmissionRequest,
  toCreateAssessmentRequest,
  toCreateAttenderRequest,
  toCreateProgressNoteRequest,
} from "@/forms/ipd.form";
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
  { value: "nursing", label: "Nursing", section: "Command" },
  { value: "attenders", label: "Attenders", section: "Care Context" },
  { value: "clinical-docs", label: "Clinical Docs", section: "Care Context" },
  { value: "checklist", label: "Checklist", section: "Care Context" },
  { value: "transfer", label: "Transfer", section: "Care Context" },
  { value: "investigations", label: "Investigations", section: "Care Context" },
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

function protectedIpdPatientName(
  patientName: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, patientName, "name");
  return displayValue === "—" ? "Patient" : displayValue;
}

function protectedIpdPatientIdentifier(
  identifier: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, identifier, "identifier");
  return displayValue === "—" ? "No UHID" : displayValue;
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
          <ActionIcon
            variant="subtle"
            onClick={() => navigate(`/ipd/admissions/${row.id}`)}
            aria-label={`Open admission ${row.id}`}
          >
            <IconEye size={16} />
          </ActionIcon>
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

interface AdmissionFormProps {
  initialPatientId?: string;
  onCancel?: () => void;
  onCreated?: (result: CreateAdmissionResponse) => void;
}

function AdmissionForm({ initialPatientId = "", onCancel, onCreated }: AdmissionFormProps) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<IpdAdmissionFormInput>({
    resolver: zodResolver(ipdAdmissionFormSchema),
    defaultValues: {
      ...DEFAULT_IPD_ADMISSION_VALUES,
      patient_id: initialPatientId,
    },
  });
  const admissionSource = watch("admission_source");
  const wardId = watch("ward_id");

  const resetAdmissionForm = () =>
    reset({
      ...DEFAULT_IPD_ADMISSION_VALUES,
      patient_id: initialPatientId,
    });

  const createMutation = useMutation({
    mutationFn: (values: IpdAdmissionFormInput) =>
      ipdService.createAdmission(toCreateAdmissionRequest(values)),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      notifications.show({
        title: "Admitted",
        message: "Patient admitted successfully",
        color: "success",
      });
      emit("ipd.admission.created", {
        admission_id: result.admission.id,
        patient_id: variables.patient_id,
        department_id: variables.department_id,
        bed_id: result.admission.bed_id,
        encounter_id: result.admission.encounter_id,
        source_record_id: result.admission.id,
      });
      if (result.admission.bed_id) {
        emit("bed.assigned", {
          admission_id: result.admission.id,
          patient_id: variables.patient_id,
          department_id: variables.department_id,
          bed_id: result.admission.bed_id,
          encounter_id: result.admission.encounter_id,
          source_record_id: result.admission.id,
        });
      }
      resetAdmissionForm();
      onCreated?.(result);
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to create admission",
        color: "danger",
      });
    },
  });

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
      <Controller
        control={control}
        name="patient_id"
        render={({ field }) => (
          <PatientSearchSelect
            value={field.value}
            onChange={field.onChange}
            error={errors.patient_id?.message}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="department_id"
        render={({ field }) => (
          <DepartmentSelect
            departmentType="clinical"
            value={field.value}
            onChange={field.onChange}
            error={errors.department_id?.message}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="doctor_id"
        render={({ field }) => <DoctorSearchSelect value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={control}
        name="ward_id"
        render={({ field }) => <WardSelect value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={control}
        name="bed_id"
        render={({ field }) => (
          <BedSelect value={field.value} onChange={field.onChange} wardId={wardId || undefined} />
        )}
      />
      <Controller
        control={control}
        name="admission_source"
        render={({ field }) => (
          <Select
            label="Admission Source"
            data={IPD_ADMISSION_SOURCE_OPTIONS}
            value={field.value}
            onChange={(value) => field.onChange(normalizeIpdAdmissionSource(value))}
            error={errors.admission_source?.message}
            clearable
          />
        )}
      />
      {admissionSource === "referral" && (
        <>
          <Controller
            control={control}
            name="referral_from"
            render={({ field }) => <TextInput label="Referral From" {...field} />}
          />
          <Controller
            control={control}
            name="referral_doctor"
            render={({ field }) => <TextInput label="Referral Doctor" {...field} />}
          />
          <Controller
            control={control}
            name="referral_notes"
            render={({ field }) => <Textarea label="Referral Notes" {...field} />}
          />
        </>
      )}
      <Group grow>
        <Controller
          control={control}
          name="admission_weight_kg"
          render={({ field }) => (
            <NumberInput
              label="Weight (kg)"
              value={field.value}
              onChange={field.onChange}
              error={errors.admission_weight_kg?.message}
              min={0}
              max={500}
              decimalScale={2}
            />
          )}
        />
        <Controller
          control={control}
          name="admission_height_cm"
          render={({ field }) => (
            <NumberInput
              label="Height (cm)"
              value={field.value}
              onChange={field.onChange}
              error={errors.admission_height_cm?.message}
              min={0}
              max={300}
              decimalScale={2}
            />
          )}
        />
      </Group>
      <Controller
        control={control}
        name="expected_discharge_date"
        render={({ field }) => <TextInput label="Expected Discharge Date" type="date" {...field} />}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <Textarea label="Notes" {...field} />}
      />
      <Group justify="flex-end">
        {onCancel && (
          <Button tone="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button tone="primary" type="submit" loading={createMutation.isPending}>
          Admit Patient
        </Button>
      </Group>
    </Stack>
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
          <Alert color="danger" icon={<IconAlertTriangle size={16} />}>
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
      notifications.show({
        title: t("notifications.mrdHandoffSent.title"),
        message: t("notifications.mrdHandoffSent.message", {
          packetNumber: packet.packet_number,
        }),
        color: "success",
      });
    },
    onError: () => {
      notifications.show({
        title: t("notifications.mrdHandoffFailed.title"),
        message: t("notifications.mrdHandoffFailed.message"),
        color: "danger",
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
          <PatientContextBanner patientId={adm.patient_id} />
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
        <Alert color="gray" variant="light">
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

function OverviewTab({
  admissionId,
  tasks,
  canCreate,
}: {
  admissionId: string;
  tasks: NursingTask[];
  canCreate: boolean;
}) {
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<IpdNursingTaskFormInput>({
    resolver: zodResolver(ipdNursingTaskFormSchema),
    defaultValues: DEFAULT_IPD_NURSING_TASK_VALUES,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateNursingTaskRequest) => ipdService.createNursingTask(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      formHandlers.close();
      reset(DEFAULT_IPD_NURSING_TASK_VALUES);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      ipdService.updateNursingTask(admissionId, taskId, { is_completed: completed }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] }),
  });

  const handleCreateTask = (values: IpdNursingTaskFormInput) => {
    createMutation.mutate({
      task_type: values.task_type,
      description: values.description.trim(),
      assigned_to: ipdOptionalText(values.assigned_to),
      notes: ipdOptionalText(values.notes),
    });
  };

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.toggle}
          >
            Add Task
          </Button>
        </Group>
      )}
      {formOpened && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateTask)}>
          <Controller
            control={control}
            name="task_type"
            render={({ field }) => (
              <Select
                label="Task Type"
                required
                data={nursingTaskTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "vitals")}
                error={errors.task_type?.message}
                searchable
              />
            )}
          />
          <TextInput
            label="Description"
            required
            error={errors.description?.message}
            {...register("description")}
          />
          <TextInput
            label="Assigned To (User ID)"
            error={errors.assigned_to?.message}
            {...register("assigned_to")}
          />
          <TextInput label="Notes" error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Task
          </Button>
        </Stack>
      )}
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Done</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Due</Table.Th>
            <Table.Th>Notes</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tasks.map((t) => (
            <Table.Tr key={t.id}>
              <Table.Td>
                <Checkbox
                  checked={t.is_completed}
                  onChange={() =>
                    toggleMutation.mutate({ taskId: t.id, completed: !t.is_completed })
                  }
                  disabled={!canCreate}
                />
              </Table.Td>
              <Table.Td>{t.task_type}</Table.Td>
              <Table.Td>{t.description}</Table.Td>
              <Table.Td>{t.due_at ? new Date(t.due_at).toLocaleString() : "—"}</Table.Td>
              <Table.Td>{t.notes ?? "—"}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

// ── Progress Notes ─────────────────────────────────────

function ProgressNotesTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.PROGRESS_NOTES_CREATE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IpdProgressNoteFormInput>({
    resolver: zodResolver(ipdProgressNoteFormSchema),
    defaultValues: DEFAULT_IPD_PROGRESS_NOTE_VALUES,
    mode: "onTouched",
  });

  const { data: notes = [] } = useQuery<IpdProgressNote[]>({
    queryKey: ["ipd-progress-notes", admissionId],
    queryFn: () => ipdService.listProgressNotes(admissionId),
  });

  const mutation = useMutation({
    mutationFn: (values: IpdProgressNoteFormInput) =>
      ipdService.createProgressNote(admissionId, toCreateProgressNoteRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-progress-notes", admissionId] });
      formHandlers.close();
      reset(DEFAULT_IPD_PROGRESS_NOTE_VALUES);
    },
  });

  const handleCreate = handleSubmit((values) => mutation.mutate(values));
  const closeForm = () => {
    formHandlers.close();
    reset(DEFAULT_IPD_PROGRESS_NOTE_VALUES);
  };

  return (
    <Stack>
      {canCreate && (
        <Button
          tone="primary"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={formHandlers.toggle}
        >
          Add Note
        </Button>
      )}
      {formOpened && (
        <Stack component="form" gap="xs" onSubmit={handleCreate}>
          <Controller
            control={control}
            name="note_type"
            render={({ field }) => (
              <Select
                label="Note Type"
                data={progressNoteTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "doctor_round")}
                error={errors.note_type?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="subjective"
            render={({ field }) => <Textarea label="Subjective" {...field} />}
          />
          <Controller
            control={control}
            name="objective"
            render={({ field }) => <Textarea label="Objective" {...field} />}
          />
          <Controller
            control={control}
            name="assessment"
            render={({ field }) => <Textarea label="Assessment" {...field} />}
          />
          <Controller
            control={control}
            name="plan"
            render={({ field }) => <Textarea label="Plan" {...field} />}
          />
          <Group>
            <Button tone="primary" size="xs" type="submit" loading={mutation.isPending}>
              Save
            </Button>
            <Button tone="ghost" size="xs" onClick={closeForm}>
              Cancel
            </Button>
          </Group>
        </Stack>
      )}
      {(() => {
        const groups = new Map<string, IpdProgressNote[]>();
        for (const n of notes) {
          const key = n.note_date ?? n.created_at.slice(0, 10);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)?.push(n);
        }
        const sortedDates = [...groups.keys()].sort((a, b) => b.localeCompare(a));
        return sortedDates.map((date) => {
          const dayNotes =
            groups.get(date)?.sort((a, b) => b.created_at.localeCompare(a.created_at)) ?? [];
          const dateLabel = new Date(date).toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          return (
            <Stack key={date} gap="xs">
              <Group gap="xs" align="baseline">
                <Text fw={700} size="sm" c="dark.7">
                  {dateLabel}
                </Text>
                <Text size="xs" c="dimmed" ff="monospace">
                  {dayNotes.length} {dayNotes.length === 1 ? "entry" : "entries"}
                </Text>
              </Group>
              {dayNotes.map((n) => (
                <Stack
                  key={n.id}
                  gap={4}
                  p="xs"
                  style={{
                    borderLeft: "3px solid var(--fc-brand, #5B4BC4)",
                    background: "var(--fc-panel, #f7f8f6)",
                    borderRadius: 4,
                  }}
                >
                  <Group justify="space-between" gap="xs">
                    <Group gap="xs">
                      <Badge size="xs">{n.note_type}</Badge>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {new Date(n.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </Group>
                    {n.is_addendum && (
                      <Badge size="xs" tone="warning">
                        addendum
                      </Badge>
                    )}
                  </Group>
                  {n.subjective && (
                    <Text size="sm">
                      <b>S:</b> {n.subjective}
                    </Text>
                  )}
                  {n.objective && (
                    <Text size="sm">
                      <b>O:</b> {n.objective}
                    </Text>
                  )}
                  {n.assessment && (
                    <Text size="sm">
                      <b>A:</b> {n.assessment}
                    </Text>
                  )}
                  {n.plan && (
                    <Text size="sm">
                      <b>P:</b> {n.plan}
                    </Text>
                  )}
                </Stack>
              ))}
            </Stack>
          );
        });
      })()}
      {notes.length === 0 && (
        <Text c="dimmed" size="sm">
          No progress notes yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Clinical Assessments ───────────────────────────────

function AssessmentsTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.ASSESSMENTS_CREATE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<IpdClinicalAssessmentFormInput>({
    resolver: zodResolver(ipdClinicalAssessmentFormSchema),
    defaultValues: DEFAULT_IPD_CLINICAL_ASSESSMENT_VALUES,
  });
  const assessmentValues = watch();
  const assessmentType = assessmentValues.assessment_type;
  const injuryPresent = assessmentValues.injury_present;

  const { data: assessments = [] } = useQuery<IpdClinicalAssessment[]>({
    queryKey: ["ipd-assessments", admissionId],
    queryFn: () => ipdService.listAssessments(admissionId),
  });

  const bradenTotal = calculateBradenTotal(assessmentValues);
  const bradenRisk = bradenRiskLevel(bradenTotal);

  const mutation = useMutation({
    mutationFn: (values: IpdClinicalAssessmentFormInput) =>
      ipdService.createAssessment(admissionId, toCreateAssessmentRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-assessments", admissionId] });
      formHandlers.close();
      reset(DEFAULT_IPD_CLINICAL_ASSESSMENT_VALUES);
    },
  });

  const riskColors: Record<string, BadgeTone> = {
    "no risk": "success",
    low: "success",
    mild: "success",
    moderate: "warning",
    high: "warning",
    severe: "danger",
    critical: "danger",
  };

  return (
    <Stack>
      {canCreate && (
        <Button
          tone="primary"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => formHandlers.toggle()}
        >
          Add Assessment
        </Button>
      )}
      {formOpened && (
        <Stack
          component="form"
          gap="xs"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <Controller
            control={control}
            name="assessment_type"
            render={({ field }) => (
              <Select
                label="Assessment Type"
                data={IPD_ASSESSMENT_TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(normalizeIpdAssessmentType(value))}
                error={errors.assessment_type?.message}
              />
            )}
          />
          {assessmentType === "braden_scale" ? (
            <>
              <Alert
                color="orange"
                variant="light"
                icon={<IconAlertTriangle size={16} />}
                title="Pressure injury prevention evidence"
              >
                Braden entries are mirrored automatically into the NABH pressure-ulcer evidence
                register. Record all six subscores and any observed injury here.
              </Alert>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                <Controller
                  control={control}
                  name="sensory_perception"
                  render={({ field }) => (
                    <NumberInput label="Sensory perception" min={1} max={4} {...field} />
                  )}
                />
                <Controller
                  control={control}
                  name="moisture"
                  render={({ field }) => (
                    <NumberInput label="Moisture" min={1} max={4} {...field} />
                  )}
                />
                <Controller
                  control={control}
                  name="activity"
                  render={({ field }) => (
                    <NumberInput label="Activity" min={1} max={4} {...field} />
                  )}
                />
                <Controller
                  control={control}
                  name="mobility"
                  render={({ field }) => (
                    <NumberInput label="Mobility" min={1} max={4} {...field} />
                  )}
                />
                <Controller
                  control={control}
                  name="nutrition"
                  render={({ field }) => (
                    <NumberInput label="Nutrition" min={1} max={4} {...field} />
                  )}
                />
                <Controller
                  control={control}
                  name="friction_shear"
                  render={({ field }) => (
                    <NumberInput label="Friction / shear" min={1} max={3} {...field} />
                  )}
                />
              </SimpleGrid>
              <Group>
                <Badge tone={riskColors[bradenRisk] ?? "neutral"} size="lg">
                  Braden {bradenTotal} · {bradenRisk}
                </Badge>
                <Text size="xs" c="dimmed">
                  Lower score means higher pressure-injury risk.
                </Text>
              </Group>
              <Controller
                control={control}
                name="injury_present"
                render={({ field }) => (
                  <Checkbox
                    label="Pressure injury observed during this assessment"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              {injuryPresent && (
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <Controller
                    control={control}
                    name="injury_stage"
                    render={({ field }) => (
                      <Select
                        label="Injury stage"
                        data={IPD_BRADEN_INJURY_STAGE_OPTIONS}
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? "")}
                        clearable
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="injury_location"
                    render={({ field }) => <TextInput label="Injury location" {...field} />}
                  />
                  <Controller
                    control={control}
                    name="injury_acquired"
                    render={({ field }) => (
                      <Select
                        label="Acquired"
                        data={IPD_BRADEN_INJURY_ACQUIRED_OPTIONS}
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? "")}
                        clearable
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="repositioning_plan"
                    render={({ field }) => <TextInput label="Repositioning plan" {...field} />}
                  />
                  <Controller
                    control={control}
                    name="nutritional_plan"
                    render={({ field }) => <TextInput label="Nutritional plan" {...field} />}
                  />
                  <Controller
                    control={control}
                    name="skin_care_plan"
                    render={({ field }) => <TextInput label="Skin care plan" {...field} />}
                  />
                </SimpleGrid>
              )}
              <Controller
                control={control}
                name="notes"
                render={({ field }) => <Textarea label="Assessment notes" minRows={2} {...field} />}
              />
            </>
          ) : (
            <>
              {assessmentType === "morse_fall_scale" && (
                <Alert
                  color="yellow"
                  variant="light"
                  icon={<IconAlertTriangle size={16} />}
                  title="Fall prevention source data"
                >
                  Morse scores are used when a fall incident is reported to show whether risk
                  assessment was completed before the fall.
                </Alert>
              )}
              <Controller
                control={control}
                name="score_value"
                render={({ field }) => (
                  <TextInput label="Score" error={errors.score_value?.message} {...field} />
                )}
              />
              <Controller
                control={control}
                name="risk_level"
                render={({ field }) => (
                  <Select
                    label="Risk Level"
                    data={IPD_RISK_LEVEL_OPTIONS}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "")}
                    clearable
                  />
                )}
              />
            </>
          )}
          <Button tone="primary" size="xs" type="submit" loading={mutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Type</Table.Th>
            <Table.Th>Score</Table.Th>
            <Table.Th>Risk</Table.Th>
            <Table.Th>Date</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {assessments.map((a) => (
            <Table.Tr key={a.id}>
              <Table.Td>
                <Badge size="sm">{a.assessment_type}</Badge>
              </Table.Td>
              <Table.Td>{a.score_value ?? "—"}</Table.Td>
              <Table.Td>
                {a.risk_level ? (
                  <Badge tone={riskColors[a.risk_level] ?? "neutral"} size="sm">
                    {a.risk_level}
                  </Badge>
                ) : (
                  "—"
                )}
              </Table.Td>
              <Table.Td>
                <Text size="xs">{new Date(a.assessed_at).toLocaleString()}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

// ── MAR ────────────────────────────────────────────────

function MarTab({ admissionId }: { admissionId: string }) {
  const { data } = useQuery({
    queryKey: ["ipd-mar", admissionId],
    queryFn: () => ipdService.listMar(admissionId),
  });

  const marStatusColors: Record<string, BadgeTone> = {
    scheduled: "primary",
    given: "success",
    held: "warning",
    refused: "warning",
    missed: "danger",
    self_administered: "success",
  };

  const rows = (data ?? []) as IpdMedicationAdministration[];

  return (
    <Stack>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Drug</Table.Th>
            <Table.Th>Dose</Table.Th>
            <Table.Th>Route</Table.Th>
            <Table.Th>Scheduled</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Double-Check</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((m) => (
            <Table.Tr key={m.id} bg={m.is_high_alert ? "red.0" : undefined}>
              <Table.Td>
                <Group gap={4}>
                  <Text size="sm" fw={500}>
                    {m.drug_name}
                  </Text>
                  {m.is_high_alert && (
                    <Tooltip label="High-Alert Medication — requires double-check">
                      <Badge tone="danger" size="xs" leftSection={<IconAlertTriangle size={10} />}>
                        HIGH ALERT
                      </Badge>
                    </Tooltip>
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{m.dose}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{m.route}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs">{new Date(m.scheduled_at).toLocaleString()}</Text>
              </Table.Td>
              <Table.Td>
                <Badge tone={marStatusColors[m.status] ?? "neutral"} size="sm">
                  {m.status}
                </Badge>
                {m.is_high_alert && m.status === "given" && !m.double_checked_by && (
                  <Badge tone="warning" size="xs" ml={4}>
                    Needs witness
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                {m.double_checked_by ? (
                  <Badge tone="success" size="xs">
                    Verified
                  </Badge>
                ) : m.is_high_alert ? (
                  <Badge tone="neutral" size="xs">
                    Pending
                  </Badge>
                ) : null}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {rows.length === 0 && (
        <Text c="dimmed" size="sm">
          No medication records yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Admission Prescriptions ──────────────────────────────

function AdmissionPrescriptionsTab({
  encounterId,
  patientId,
}: {
  encounterId: string;
  patientId: string;
}) {
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const { data: prescriptions = [] } = useQuery<PrescriptionWithItems[]>({
    queryKey: ["encounter-prescriptions", encounterId],
    queryFn: () => ipdService.listPrescriptions(encounterId),
  });

  const { data: patient } = useQuery({
    queryKey: ["patient-detail", patientId],
    queryFn: () => ipdService.getPatient(patientId),
  });

  if (prescriptions.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No prescriptions for this admission.
      </Text>
    );
  }

  const fullName = patient
    ? `${patient.first_name} ${patient.middle_name ?? ""} ${patient.last_name}`.trim()
    : patientId.slice(0, 8);
  const uhid = patient?.uhid ?? patientId.slice(0, 8);
  const patientName = protectedIpdPatientName(fullName, patientNameAccess);
  const patientUhid = protectedIpdPatientIdentifier(uhid, uhidAccess);

  return (
    <PrescriptionViews
      prescriptions={prescriptions}
      patientName={patientName}
      uhid={patientUhid}
      allergies={[]}
    />
  );
}

// ── I/O Chart ──────────────────────────────────────────

function IoChartTab({ admissionId }: { admissionId: string }) {
  const { data: ioData } = useQuery({
    queryKey: ["ipd-io", admissionId],
    queryFn: () => ipdService.listIntakeOutput(admissionId),
  });
  const { data: balance } = useQuery({
    queryKey: ["ipd-io-balance", admissionId],
    queryFn: () => ipdService.getIoBalance(admissionId),
  });

  const rows = (ioData ?? []) as IpdIntakeOutput[];

  return (
    <Stack>
      {balance && (
        <Group gap="lg">
          <Badge tone="primary" size="lg">
            Intake: {balance.total_intake_ml} ml
          </Badge>
          <Badge tone="warning" size="lg">
            Output: {balance.total_output_ml} ml
          </Badge>
          <Badge tone={Number(balance.balance_ml) >= 0 ? "success" : "danger"} size="lg">
            Balance: {balance.balance_ml} ml
          </Badge>
        </Group>
      )}
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Type</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Volume (ml)</Table.Th>
            <Table.Th>Shift</Table.Th>
            <Table.Th>Time</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>
                <Badge tone={r.is_intake ? "primary" : "warning"} size="sm">
                  {r.is_intake ? "Intake" : "Output"}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.category}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.volume_ml}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.shift}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs">{new Date(r.recorded_at).toLocaleString()}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {rows.length === 0 && (
        <Text c="dimmed" size="sm">
          No intake/output records yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Nursing Tab (care plans + handovers) ───────────────

function NursingTab({ admissionId }: { admissionId: string }) {
  const { data: carePlans } = useQuery({
    queryKey: ["ipd-care-plans", admissionId],
    queryFn: () => ipdService.listCarePlans(admissionId),
  });
  const { data: handovers } = useQuery({
    queryKey: ["ipd-handovers", admissionId],
    queryFn: () => ipdService.listHandovers(admissionId),
  });

  const plans = (carePlans ?? []) as IpdCarePlan[];
  const reports = (handovers ?? []) as IpdHandoverReport[];

  return (
    <Stack>
      <Group justify="flex-end">
        <Button
          tone="secondary"
          size="xs"
          leftSection={<IconAlertTriangle size={14} />}
          component="a"
          href="/quality"
          target="_blank"
        >
          Report Incident
        </Button>
      </Group>

      <Text fw={600} size="sm">
        Care Plans
      </Text>
      {plans.map((cp) => (
        <Stack
          key={cp.id}
          gap={4}
          p="xs"
          style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}
        >
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              {cp.nursing_diagnosis}
            </Text>
            <Badge
              size="xs"
              tone={
                cp.status === "active" ? "success" : cp.status === "resolved" ? "neutral" : "danger"
              }
            >
              {cp.status}
            </Badge>
          </Group>
          {cp.goals && <Text size="xs">Goals: {cp.goals}</Text>}
          {cp.evaluation && <Text size="xs">Eval: {cp.evaluation}</Text>}
        </Stack>
      ))}
      {plans.length === 0 && (
        <Text c="dimmed" size="sm">
          No care plans yet.
        </Text>
      )}

      <Text fw={600} size="sm" mt="md">
        Handover Reports (ISBAR)
      </Text>
      {reports.map((h) => (
        <Stack
          key={h.id}
          gap={4}
          p="xs"
          style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}
        >
          <Group justify="space-between">
            <Badge size="xs">{h.shift} shift</Badge>
            <Text size="xs" c="dimmed">
              {h.handover_date}
            </Text>
            {h.acknowledged_at && (
              <Badge size="xs" tone="success">
                Acknowledged
              </Badge>
            )}
          </Group>
          {h.situation && (
            <Text size="xs">
              <b>S:</b> {h.situation}
            </Text>
          )}
          {h.background && (
            <Text size="xs">
              <b>B:</b> {h.background}
            </Text>
          )}
          {h.assessment && (
            <Text size="xs">
              <b>A:</b> {h.assessment}
            </Text>
          )}
          {h.recommendation && (
            <Text size="xs">
              <b>R:</b> {h.recommendation}
            </Text>
          )}
        </Stack>
      ))}
      {reports.length === 0 && (
        <Text c="dimmed" size="sm">
          No handover reports yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Attenders ──────────────────────────────────────────

function AttendersTab({ admissionId, canCreate }: { admissionId: string; canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IpdAttenderFormInput>({
    resolver: zodResolver(ipdAttenderFormSchema),
    defaultValues: DEFAULT_IPD_ATTENDER_VALUES,
  });

  const { data: attenders = [] } = useQuery<AdmissionAttender[]>({
    queryKey: ["ipd-attenders", admissionId],
    queryFn: () => ipdService.listAttenders(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: (values: IpdAttenderFormInput) =>
      ipdService.createAttender(admissionId, toCreateAttenderRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-attenders", admissionId] });
      formHandlers.close();
      reset(DEFAULT_IPD_ATTENDER_VALUES);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attenderId: string) => ipdService.deleteAttender(admissionId, attenderId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["ipd-attenders", admissionId] }),
  });

  return (
    <Stack>
      {canCreate && (
        <Button
          tone="primary"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => formHandlers.toggle()}
        >
          Add Attender
        </Button>
      )}
      {formOpened && (
        <Stack
          component="form"
          gap="xs"
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <TextInput label="Name" required error={errors.name?.message} {...field} />
            )}
          />
          <Controller
            control={control}
            name="relationship"
            render={({ field }) => (
              <TextInput
                label="Relationship"
                required
                error={errors.relationship?.message}
                {...field}
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => <TextInput label="Phone" {...field} />}
            />
            <Controller
              control={control}
              name="alt_phone"
              render={({ field }) => <TextInput label="Alt Phone" {...field} />}
            />
          </Group>
          <Controller
            control={control}
            name="address"
            render={({ field }) => <Textarea label="Address" {...field} />}
          />
          <Group grow>
            <Controller
              control={control}
              name="id_proof_type"
              render={({ field }) => (
                <Select
                  label="ID Proof Type"
                  data={IPD_ID_PROOF_TYPE_OPTIONS}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  clearable
                  searchable
                />
              )}
            />
            <Controller
              control={control}
              name="id_proof_number"
              render={({ field }) => <TextInput label="ID Proof Number" {...field} />}
            />
          </Group>
          <Controller
            control={control}
            name="is_primary"
            render={({ field }) => (
              <Checkbox
                label="Primary attender"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Relationship</Table.Th>
            <Table.Th>Phone</Table.Th>
            <Table.Th>Primary</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {attenders.map((a) => (
            <Table.Tr key={a.id}>
              <Table.Td>
                <Text size="sm">{a.name}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{a.relationship}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{a.phone ?? "—"}</Text>
              </Table.Td>
              <Table.Td>
                {a.is_primary && (
                  <Badge size="xs" tone="primary">
                    Primary
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                {canCreate && (
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    onClick={() =>
                      confirmDestructive({
                        title: "Delete attender",
                        message: `Remove attender "${a.name}" from this admission?`,
                        confirmLabel: "Delete attender",
                        onConfirm: () => deleteMutation.mutate(a.id),
                      })
                    }
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {attenders.length === 0 && (
        <Text c="dimmed" size="sm">
          No attenders recorded yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Discharge Summary ─────────────────────────────────

function DischargeSummaryTab({
  admissionId,
  canCreate,
  patientId,
}: {
  admissionId: string;
  canCreate: boolean;
  patientId: string;
}) {
  const emit = useClinicalEmit();
  const canFinalize = useHasPermission(P.IPD.DISCHARGE_SUMMARY_FINALIZE);
  const queryClient = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["ipd-discharge-summary", admissionId],
    queryFn: () => ipdService.getDischargeSummary(admissionId).catch(() => null),
  });

  const [finalDiagnosis, setFinalDiagnosis] = useState("");
  const [conditionAtDischarge, setConditionAtDischarge] = useState("");
  const [courseInHospital, setCourseInHospital] = useState("");
  const [treatmentGiven, setTreatmentGiven] = useState("");
  const [investigationSummary, setInvestigationSummary] = useState("");
  const [followUpInstructions, setFollowUpInstructions] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [dietaryAdvice, setDietaryAdvice] = useState("");
  const [activityRestrictions, setActivityRestrictions] = useState("");
  const [warningSigns, setWarningSigns] = useState("");
  const [editing, setEditing] = useState(false);

  const summary = existing as IpdDischargeSummary | null;

  const createMutation = useMutation({
    mutationFn: (d: CreateDischargeSummaryRequest) =>
      ipdService.createDischargeSummary(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-summary", admissionId] });
      setEditing(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (d: UpdateDischargeSummaryRequest) =>
      ipdService.updateDischargeSummary(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-summary", admissionId] });
      setEditing(false);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => ipdService.finalizeDischargeSummary(admissionId),
    onSuccess: (summary) => {
      emit("ipd.discharge.finalized", {
        admission_id: summary.admission_id,
        finalized_at: summary.finalized_at,
        patient_id: patientId,
        source_record_id: summary.id,
        status: summary.status,
        summary_id: summary.id,
      });
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-summary", admissionId] });
      notifications.show({
        title: "Finalized",
        message: "Discharge summary finalized",
        color: "success",
      });
    },
  });

  if (summary && !editing) {
    return (
      <Stack>
        <Group justify="space-between">
          <Badge size="lg" tone={summary.status === "finalized" ? "success" : "warning"}>
            {summary.status}
          </Badge>
          <Group>
            {summary.status === "draft" && canCreate && (
              <Button
                tone="secondary"
                size="xs"
                leftSection={<IconPencil size={14} />}
                onClick={() => {
                  setFinalDiagnosis(summary.final_diagnosis ?? "");
                  setConditionAtDischarge(summary.condition_at_discharge ?? "");
                  setCourseInHospital(summary.course_in_hospital ?? "");
                  setTreatmentGiven(summary.treatment_given ?? "");
                  setInvestigationSummary(summary.investigation_summary ?? "");
                  setFollowUpInstructions(summary.follow_up_instructions ?? "");
                  setFollowUpDate(summary.follow_up_date ?? "");
                  setDietaryAdvice(summary.dietary_advice ?? "");
                  setActivityRestrictions(summary.activity_restrictions ?? "");
                  setWarningSigns(summary.warning_signs ?? "");
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            )}
            {summary.status === "draft" && canFinalize && (
              <Button
                tone="primary"
                size="xs"
                onClick={() => finalizeMutation.mutate()}
                loading={finalizeMutation.isPending}
              >
                Finalize
              </Button>
            )}
          </Group>
        </Group>
        {summary.final_diagnosis && (
          <Text size="sm">
            <b>Diagnosis:</b> {summary.final_diagnosis}
          </Text>
        )}
        {summary.condition_at_discharge && (
          <Text size="sm">
            <b>Condition:</b> {summary.condition_at_discharge}
          </Text>
        )}
        {summary.course_in_hospital && (
          <Text size="sm">
            <b>Course:</b> {summary.course_in_hospital}
          </Text>
        )}
        {summary.treatment_given && (
          <Text size="sm">
            <b>Treatment:</b> {summary.treatment_given}
          </Text>
        )}
        {summary.investigation_summary && (
          <Text size="sm">
            <b>Investigations:</b> {summary.investigation_summary}
          </Text>
        )}
        {summary.follow_up_instructions && (
          <Text size="sm">
            <b>Follow-up:</b> {summary.follow_up_instructions}
          </Text>
        )}
        {summary.follow_up_date && (
          <Text size="sm">
            <b>Follow-up Date:</b> {summary.follow_up_date}
          </Text>
        )}
        {summary.dietary_advice && (
          <Text size="sm">
            <b>Diet:</b> {summary.dietary_advice}
          </Text>
        )}
        {summary.activity_restrictions && (
          <Text size="sm">
            <b>Activity:</b> {summary.activity_restrictions}
          </Text>
        )}
        {summary.warning_signs && (
          <Text size="sm">
            <b>Warning Signs:</b> {summary.warning_signs}
          </Text>
        )}
        {summary.finalized_at && (
          <Text size="xs" c="dimmed">
            Finalized: {new Date(summary.finalized_at).toLocaleString()}
          </Text>
        )}
      </Stack>
    );
  }

  if (!canCreate) {
    return (
      <Text c="dimmed" size="sm">
        No discharge summary. You do not have permission to create one.
      </Text>
    );
  }

  const handleSave = () => {
    const payload = {
      final_diagnosis: finalDiagnosis || undefined,
      condition_at_discharge: conditionAtDischarge || undefined,
      course_in_hospital: courseInHospital || undefined,
      treatment_given: treatmentGiven || undefined,
      investigation_summary: investigationSummary || undefined,
      follow_up_instructions: followUpInstructions || undefined,
      follow_up_date: followUpDate || undefined,
      dietary_advice: dietaryAdvice || undefined,
      activity_restrictions: activityRestrictions || undefined,
      warning_signs: warningSigns || undefined,
    };
    if (summary) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Stack>
      <Text fw={600} size="sm">
        {summary ? "Edit Discharge Summary" : "Create Discharge Summary"}
      </Text>
      <Textarea
        label="Final Diagnosis"
        value={finalDiagnosis}
        onChange={(e) => setFinalDiagnosis(e.currentTarget.value)}
        autosize
        minRows={2}
      />
      <Textarea
        label="Condition at Discharge"
        value={conditionAtDischarge}
        onChange={(e) => setConditionAtDischarge(e.currentTarget.value)}
      />
      <Textarea
        label="Course in Hospital"
        value={courseInHospital}
        onChange={(e) => setCourseInHospital(e.currentTarget.value)}
        autosize
        minRows={3}
      />
      <Textarea
        label="Treatment Given"
        value={treatmentGiven}
        onChange={(e) => setTreatmentGiven(e.currentTarget.value)}
        autosize
        minRows={2}
      />
      <Textarea
        label="Investigation Summary"
        value={investigationSummary}
        onChange={(e) => setInvestigationSummary(e.currentTarget.value)}
      />
      <Textarea
        label="Follow-up Instructions"
        value={followUpInstructions}
        onChange={(e) => setFollowUpInstructions(e.currentTarget.value)}
      />
      <TextInput
        label="Follow-up Date"
        type="date"
        value={followUpDate}
        onChange={(e) => setFollowUpDate(e.currentTarget.value)}
      />
      <Textarea
        label="Dietary Advice"
        value={dietaryAdvice}
        onChange={(e) => setDietaryAdvice(e.currentTarget.value)}
      />
      <Textarea
        label="Activity Restrictions"
        value={activityRestrictions}
        onChange={(e) => setActivityRestrictions(e.currentTarget.value)}
      />
      <Textarea
        label="Warning Signs"
        value={warningSigns}
        onChange={(e) => setWarningSigns(e.currentTarget.value)}
      />
      <Group>
        <Button
          tone="primary"
          onClick={handleSave}
          loading={createMutation.isPending || updateMutation.isPending}
        >
          Save
        </Button>
        {editing && (
          <Button tone="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </Group>
    </Stack>
  );
}

// ── Transfer ───────────────────────────────────────────

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
      notifications.show({
        title: t("notify.transferred"),
        message: t("notify.bedTransferRecorded"),
        color: "success",
      });
      emitIpdBedMovementEvent(emit, response, patientId, notes.trim());
      setBedId("");
      setNotes("");
    },
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
      notifications.show({ title: "Discharged", message: "Patient discharged", color: "success" });
      emit("ipd.discharge.completed", {
        admission_id: admissionId,
        discharge_type: result.discharge_type ?? dischargeType,
        patient_id: result.patient_id ?? patientId,
      });
    },
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
            <ActionIcon variant="subtle" onClick={() => setSelectedWardId(row.id)}>
              <IconEye size={14} />
            </ActionIcon>
          </Tooltip>
          {canManage && (
            <Tooltip label="Edit">
              <ActionIcon variant="subtle" onClick={() => setEditWard(row)}>
                <IconPencil size={14} />
              </ActionIcon>
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
                      <ActionIcon
                        variant="subtle"
                        color="danger"
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
                      </ActionIcon>
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

function IpTypeConfigSection() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editThreshold, setEditThreshold] = useState<number | string>("");
  const [editAutoBilling, setEditAutoBilling] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ipd-ip-types"],
    queryFn: () => ipdService.listIpTypes(),
    enabled: expanded,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...rest
    }: {
      id: string;
      billing_alert_threshold?: number;
      auto_billing_enabled?: boolean;
    }) => ipdService.updateIpType(id, rest),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-ip-types"] });
      notifications.show({
        title: "Updated",
        message: "IP type configuration updated",
        color: "success",
      });
      setEditingId(null);
    },
  });

  const configs = (data ?? []) as IpTypeConfiguration[];

  return (
    <Card withBorder mt="md">
      <Group
        justify="space-between"
        p="sm"
        style={{ cursor: "pointer" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Text fw={600}>IP Type Configurations</Text>
        <Badge>{expanded ? "Hide" : "Show"}</Badge>
      </Group>
      {expanded && (
        <Stack p="sm" pt={0}>
          {isLoading ? (
            <Text c="dimmed">Loading...</Text>
          ) : configs.length === 0 ? (
            <Text c="dimmed" size="sm">
              No IP type configurations found.
            </Text>
          ) : (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>IP Type</Table.Th>
                  <Table.Th>Label</Table.Th>
                  <Table.Th>Daily Rate</Table.Th>
                  <Table.Th>Nursing Charge</Table.Th>
                  <Table.Th>Deposit</Table.Th>
                  <Table.Th>Billing Threshold</Table.Th>
                  <Table.Th>Auto-Billing</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {configs.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>
                      <Badge size="sm">{c.ip_type}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{c.label}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{c.daily_rate}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{c.nursing_charge}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{c.deposit_required}</Text>
                    </Table.Td>
                    <Table.Td>
                      {editingId === c.id ? (
                        <NumberInput
                          size="xs"
                          value={editThreshold}
                          onChange={setEditThreshold}
                          w={120}
                        />
                      ) : (
                        <Text size="sm">{c.billing_alert_threshold ?? "—"}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {editingId === c.id ? (
                        <Checkbox
                          size="xs"
                          checked={editAutoBilling}
                          onChange={(e) => setEditAutoBilling(e.currentTarget.checked)}
                        />
                      ) : (
                        <Badge size="xs" tone={c.auto_billing_enabled ? "success" : "neutral"}>
                          {c.auto_billing_enabled ? "On" : "Off"}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {editingId === c.id ? (
                        <Group gap={4}>
                          <Button
                            tone="primary"
                            size="xs"
                            onClick={() =>
                              updateMutation.mutate({
                                id: c.id,
                                billing_alert_threshold: editThreshold
                                  ? Number(editThreshold)
                                  : undefined,
                                auto_billing_enabled: editAutoBilling,
                              })
                            }
                            loading={updateMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button tone="ghost" size="xs" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </Group>
                      ) : (
                        <ActionIcon
                          variant="subtle"
                          onClick={() => {
                            setEditingId(c.id);
                            setEditThreshold(c.billing_alert_threshold ?? "");
                            setEditAutoBilling(c.auto_billing_enabled);
                          }}
                        >
                          <IconPencil size={14} />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Bed Dashboard Tab ────────────────────────────────────
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

function CensusReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-census"],
    queryFn: () => ipdService.reportCensus(),
  });

  const rows = (data ?? []) as CensusWardRow[];

  return (
    <Table striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Ward</Table.Th>
          <Table.Th>Total Beds</Table.Th>
          <Table.Th>Occupied</Table.Th>
          <Table.Th>Vacant</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {isLoading ? (
          <Table.Tr>
            <Table.Td colSpan={4}>
              <Text c="dimmed">Loading...</Text>
            </Table.Td>
          </Table.Tr>
        ) : (
          rows.map((r, i) => (
            <Table.Tr key={r.ward_id ?? `unassigned-${i}`}>
              <Table.Td>
                <Text size="sm">{r.ward_name ?? "Unassigned"}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.total_beds}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.occupied}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.vacant}</Text>
              </Table.Td>
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  );
}

function OccupancyReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-occupancy", from, to],
    queryFn: () => ipdService.reportOccupancy({ from, to }),
    enabled: !!from && !!to,
  });

  if (!from || !to)
    return (
      <Text c="dimmed" size="sm">
        Select a date range to view occupancy.
      </Text>
    );

  const rows = (data ?? []) as Array<{
    ward_id: string | null;
    ward_name: string | null;
    total_beds: number;
    occupied_bed_days: number;
    total_bed_days: number;
    occupancy_pct: number;
  }>;

  return (
    <Stack>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : (
        rows.map((r, i) => (
          <Card key={r.ward_id ?? `unassigned-${i}`} withBorder p="sm">
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>
                {r.ward_name ?? "Unassigned"}
              </Text>
              <Text size="sm" fw={700}>
                {r.occupancy_pct.toFixed(1)}%
              </Text>
            </Group>
            <Progress
              value={r.occupancy_pct}
              size="lg"
              color={r.occupancy_pct > 90 ? "danger" : r.occupancy_pct > 70 ? "warning" : "success"}
            />
            <Text size="xs" c="dimmed" mt={4}>
              {r.occupied_bed_days} bed-days / {r.total_bed_days} total
            </Text>
          </Card>
        ))
      )}
    </Stack>
  );
}

function AlosReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-alos", from, to],
    queryFn: () => ipdService.reportAlos({ from, to }),
    enabled: !!from && !!to,
  });

  if (!from || !to)
    return (
      <Text c="dimmed" size="sm">
        Select a date range to view ALOS.
      </Text>
    );

  const rows = (data ?? []) as Array<{
    department_name: string | null;
    discharge_type: string;
    avg_los_days: number;
    count: number;
  }>;

  return (
    <Table striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Department</Table.Th>
          <Table.Th>Discharge Type</Table.Th>
          <Table.Th>Avg LOS (days)</Table.Th>
          <Table.Th>Count</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {isLoading ? (
          <Table.Tr>
            <Table.Td colSpan={4}>
              <Text c="dimmed">Loading...</Text>
            </Table.Td>
          </Table.Tr>
        ) : (
          rows.map((r) => (
            <Table.Tr
              key={`${r.department_name ?? "unknown"}-${r.discharge_type}-${r.count}-${r.avg_los_days}`}
            >
              <Table.Td>
                <Text size="sm">{r.department_name ?? "—"}</Text>
              </Table.Td>
              <Table.Td>
                <Badge size="sm">{r.discharge_type}</Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {r.avg_los_days.toFixed(1)}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.count}</Text>
              </Table.Td>
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  );
}

function DischargeStatsReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-discharge-stats", from, to],
    queryFn: () => ipdService.reportDischargeStats({ from, to }),
    enabled: !!from && !!to,
  });

  if (!from || !to)
    return (
      <Text c="dimmed" size="sm">
        Select a date range to view discharge statistics.
      </Text>
    );

  const rows = (data ?? []) as Array<{ discharge_type: string; count: number }>;
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Stack>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : (
        rows.map((r) => (
          <Group
            key={r.discharge_type}
            justify="space-between"
            p="xs"
            style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}
          >
            <Group>
              <Badge size="lg">{r.discharge_type}</Badge>
              <Text size="sm">{r.count} discharges</Text>
            </Group>
            <Text size="sm" c="dimmed">
              {total > 0 ? ((r.count / total) * 100).toFixed(1) : 0}%
            </Text>
          </Group>
        ))
      )}
      {rows.length === 0 && (
        <Text c="dimmed" size="sm">
          No discharges in this period.
        </Text>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  IPD Phase 2b — Clinical Docs
// ══════════════════════════════════════════════════════════

const DOC_TYPE_OPTIONS: { value: IpdClinicalDocType; label: string }[] = [
  { value: "wound_care", label: "Wound Care" },
  { value: "central_line", label: "Central Line" },
  { value: "catheter", label: "Catheter" },
  { value: "drain", label: "Drain" },
  { value: "restraint", label: "Restraint" },
  { value: "transfusion", label: "Transfusion" },
  { value: "blood_transfusion_checklist", label: "Blood Transfusion Checklist" },
  { value: "elopement_risk", label: "Elopement Risk Assessment" },
  { value: "dialysis", label: "Dialysis Nursing" },
  { value: "endoscopy", label: "Endoscopy Nursing" },
  { value: "chemotherapy", label: "Chemotherapy Administration" },
  { value: "clinical_pathway", label: "Clinical Pathway" },
  { value: "other", label: "Other" },
];

const RESTRAINT_STATUS_OPTIONS: { value: RestraintCheckStatus; label: string }[] = [
  { value: "circulation_ok", label: "Circulation OK" },
  { value: "skin_intact", label: "Skin Intact" },
  { value: "repositioned", label: "Repositioned" },
  { value: "released", label: "Released" },
  { value: "escalated", label: "Escalated" },
];

function ClinicalDocsTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.CLINICAL_DOCS_CREATE);
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string | null>(null);
  const [formOpened, formHandlers] = useDisclosure(false);
  const [docType, setDocType] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [restraintDocId, setRestraintDocId] = useState<string | null>(null);
  const [restraintStatus, setRestraintStatus] = useState<string | null>(null);
  const [restraintNotes, setRestraintNotes] = useState("");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["ipd-clinical-docs", admissionId, filterType],
    queryFn: () =>
      ipdService.listClinicalDocs(admissionId, filterType ? { doc_type: filterType } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateClinicalDocRequest) => ipdService.createClinicalDoc(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-clinical-docs", admissionId] });
      notifications.show({
        title: "Created",
        message: "Clinical documentation saved",
        color: "success",
      });
      formHandlers.close();
      setDocType(null);
      setTitle("");
      setNotes("");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (docId: string) => ipdService.resolveClinicalDoc(admissionId, docId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-clinical-docs", admissionId] });
      notifications.show({
        title: "Resolved",
        message: "Documentation marked as resolved",
        color: "success",
      });
    },
  });

  const restraintMutation = useMutation({
    mutationFn: (data: CreateRestraintCheckRequest) =>
      ipdService.createRestraintCheck(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-clinical-docs", admissionId] });
      notifications.show({
        title: "Recorded",
        message: "Restraint check logged",
        color: "success",
      });
      setRestraintDocId(null);
      setRestraintStatus(null);
      setRestraintNotes("");
    },
  });

  const rows = docs ?? [];

  return (
    <Stack>
      <Group justify="space-between">
        <Select
          placeholder="Filter by type"
          data={DOC_TYPE_OPTIONS}
          value={filterType}
          onChange={setFilterType}
          clearable
          w={200}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            size="sm"
            onClick={() => formHandlers.open()}
          >
            Add Documentation
          </Button>
        )}
      </Group>

      {formOpened && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <Select
              label="Type"
              data={DOC_TYPE_OPTIONS}
              value={docType}
              onChange={setDocType}
              required
            />
            <TextInput
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              required
            />
            {docType === "central_line" && (
              <Text size="xs" c="dimmed">
                Structured: insertion site (subclavian/jugular/femoral), line type, daily assessment
                — stored in body JSONB
              </Text>
            )}
            {docType === "catheter" && (
              <Text size="xs" c="dimmed">
                Structured: catheter type (Foley/suprapubic/condom), size, daily assessment — stored
                in body JSONB
              </Text>
            )}
            {docType === "transfusion" && (
              <Text size="xs" c="dimmed">
                Structured: blood product type, unit number, donation ID, pre-transfusion vitals,
                reaction monitoring — stored in body JSONB
              </Text>
            )}
            {docType === "restraint" && (
              <Text size="xs" c="dimmed">
                Structured: restraint type, reason, physician order. 30-min monitoring checks logged
                separately.
              </Text>
            )}
            {docType === "blood_transfusion_checklist" && (
              <Card withBorder p="xs" bg="blue.0">
                <Text size="xs" fw={500} mb={4}>
                  Blood Transfusion Checklist (WHO Protocol)
                </Text>
                <Text size="xs" c="dimmed">
                  Pre-transfusion: patient ID (2 identifiers), consent verified, blood group
                  crossmatch, vitals (temp/BP/HR/RR/SpO2).
                </Text>
                <Text size="xs" c="dimmed">
                  Interval checks: 15-min, 30-min, 60-min, 120-min — vitals + reaction monitoring at
                  each.
                </Text>
                <Text size="xs" c="dimmed">
                  Reaction types: febrile, allergic, hemolytic, TRALI, TACO, other. Severity +
                  action taken logged.
                </Text>
              </Card>
            )}
            {docType === "elopement_risk" && (
              <Card withBorder p="xs" bg="orange.0">
                <Text size="xs" fw={500} mb={4}>
                  Elopement Risk Assessment
                </Text>
                <Text size="xs" c="dimmed">
                  Risk factors: psychiatric diagnosis, MLC patient, confused state, dementia,
                  substance withdrawal, previous elopement, suicidal ideation.
                </Text>
                <Text size="xs" c="dimmed">
                  Auto-scores risk (low/medium/high/critical). Precautions: 1:1 watch, door alarms,
                  colored wristband, family notification.
                </Text>
              </Card>
            )}
            {docType === "dialysis" && (
              <Card withBorder p="xs" bg="teal.0">
                <Text size="xs" fw={500} mb={4}>
                  Dialysis Nursing (Pre/Intra/Post)
                </Text>
                <Text size="xs" c="dimmed">
                  Pre: dry weight, access type/site, machine params (blood flow, dialysate flow, UF
                  goal).
                </Text>
                <Text size="xs" c="dimmed">
                  Intra: hourly vitals, UF removed, machine alarms, interventions.
                </Text>
                <Text size="xs" c="dimmed">
                  Post: post-weight, fluid removed, access site check, complications.
                </Text>
              </Card>
            )}
            {docType === "endoscopy" && (
              <Card withBorder p="xs" bg="grape.0">
                <Text size="xs" fw={500} mb={4}>
                  Endoscopy Nursing (Aldrete Score)
                </Text>
                <Text size="xs" c="dimmed">
                  Sedation: drugs (name, dose, time), sedation level. Monitoring: vitals at 5-min
                  intervals.
                </Text>
                <Text size="xs" c="dimmed">
                  Modified Aldrete: activity (0-2), respiration (0-2), circulation (0-2),
                  consciousness (0-2), SpO2 (0-2).
                </Text>
                <Text size="xs" c="dimmed">
                  Score 9+ = discharge ready. Complications: perforation, bleeding, aspiration,
                  cardiopulmonary.
                </Text>
              </Card>
            )}
            {docType === "chemotherapy" && (
              <Card withBorder p="xs" bg="red.0">
                <Text size="xs" fw={500} mb={4}>
                  Chemotherapy Administration (CTCAE Grading)
                </Text>
                <Text size="xs" c="dimmed">
                  Protocol, cycle number, drug list, doses, infusion rates. Pre-medications
                  administered.
                </Text>
                <Text size="xs" c="dimmed">
                  Vitals: baseline + q15min x4 + q30min. Adverse reactions (CTCAE grade 1-5),
                  extravasation check.
                </Text>
                <Badge size="xs" tone="danger" mt={4}>
                  Requires chemo certification verification
                </Badge>
              </Card>
            )}
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
            <Group>
              <Button
                tone="primary"
                size="sm"
                onClick={() =>
                  createMutation.mutate({
                    doc_type: docType as IpdClinicalDocType,
                    title,
                    notes: notes || undefined,
                  })
                }
                loading={createMutation.isPending}
                disabled={!docType || !title}
              >
                Save
              </Button>
              <Button tone="ghost" size="sm" onClick={() => formHandlers.close()}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No clinical documentation recorded yet.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Title</Table.Th>
              <Table.Th>Recorded</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((doc: IpdClinicalDocumentation) => (
              <Table.Tr key={doc.id}>
                <Table.Td>
                  <Badge size="sm">{doc.doc_type.replace(/_/g, " ")}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{doc.title}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{new Date(doc.recorded_at).toLocaleString()}</Text>
                </Table.Td>
                <Table.Td>
                  {doc.is_resolved ? (
                    <Badge tone="success" size="sm">
                      Resolved
                    </Badge>
                  ) : (
                    <Badge tone="warning" size="sm">
                      Active
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {!doc.is_resolved && canCreate && (
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="success"
                        onClick={() => resolveMutation.mutate(doc.id)}
                      >
                        <IconCheck size={14} />
                      </ActionIcon>
                    )}
                    {doc.doc_type === "restraint" && !doc.is_resolved && (
                      <>
                        <Button
                          tone="secondary"
                          size="xs"
                          onClick={() => setRestraintDocId(doc.id)}
                        >
                          Log Check
                        </Button>
                        <RestraintChecksSummary admissionId={admissionId} docId={doc.id} />
                      </>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {restraintDocId && (
        <Card withBorder p="sm">
          <Text fw={500} size="sm" mb="xs">
            30-Minute Restraint Check
          </Text>
          <Stack gap="xs">
            <Select
              label="Status"
              data={RESTRAINT_STATUS_OPTIONS}
              value={restraintStatus}
              onChange={setRestraintStatus}
              required
            />
            <Textarea
              label="Notes"
              value={restraintNotes}
              onChange={(e) => setRestraintNotes(e.currentTarget.value)}
            />
            <Group>
              <Button
                tone="primary"
                size="sm"
                onClick={() =>
                  restraintMutation.mutate({
                    clinical_doc_id: restraintDocId,
                    status: restraintStatus as RestraintCheckStatus,
                    notes: restraintNotes || undefined,
                  })
                }
                loading={restraintMutation.isPending}
                disabled={!restraintStatus}
              >
                Record Check
              </Button>
              <Button tone="ghost" size="sm" onClick={() => setRestraintDocId(null)}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  IPD Phase 2b — Admission Checklist
// ══════════════════════════════════════════════════════════

function ChecklistTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.CLINICAL_DOCS_CREATE);
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["ipd-checklist", admissionId],
    queryFn: () => ipdService.listAdmissionChecklist(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      ipdService.createAdmissionChecklist(admissionId, {
        items: [{ item_label: newLabel, category: newCategory || undefined }],
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-checklist", admissionId] });
      notifications.show({ title: "Added", message: "Checklist item added", color: "success" });
      setNewLabel("");
      setNewCategory("");
    },
  });

  const seedTemplateMutation = useMutation({
    mutationFn: (template: ChecklistTemplate) =>
      ipdService.createAdmissionChecklist(admissionId, { items: template.items }),
    onSuccess: (_data, template) => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-checklist", admissionId] });
      notifications.show({
        title: "Template loaded",
        message: `${template.title} — ${template.items.length} items added`,
        color: "success",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      ipdService.toggleChecklistItem(admissionId, itemId, { is_completed: completed }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-checklist", admissionId] });
    },
  });

  const rows = items ?? [];
  const completed = rows.filter((r: AdmissionChecklist) => r.is_completed).length;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={500}>
          Checklist ({completed}/{rows.length} completed)
        </Text>
        {rows.length > 0 && (
          <Progress
            value={rows.length > 0 ? (completed / rows.length) * 100 : 0}
            size="lg"
            w={200}
          />
        )}
      </Group>

      {canCreate && (
        <Stack gap="xs">
          <Group>
            <TextInput
              placeholder="Item label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <TextInput
              placeholder="Category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.currentTarget.value)}
              w={150}
            />
            <Button
              tone="primary"
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!newLabel}
              loading={createMutation.isPending}
            >
              Add
            </Button>
            <Menu shadow="md" position="bottom-end">
              <Menu.Target>
                <Button
                  tone="secondary"
                  size="sm"
                  loading={seedTemplateMutation.isPending}
                  leftSection={<IconPlus size={14} />}
                >
                  Load template
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Seed standard checklist</Menu.Label>
                {ALL_TEMPLATES.map((template) => (
                  <Menu.Item
                    key={template.key}
                    onClick={() => seedTemplateMutation.mutate(template)}
                  >
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>
                        {template.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {template.description}
                      </Text>
                    </Stack>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Stack>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No checklist items yet. Add items to track admission readiness.
        </Text>
      ) : (
        <Stack gap="xs">
          {rows.map((item: AdmissionChecklist) => (
            <Group
              key={item.id}
              p="xs"
              style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}
            >
              <Checkbox
                checked={item.is_completed}
                onChange={(e) =>
                  toggleMutation.mutate({ itemId: item.id, completed: e.currentTarget.checked })
                }
              />
              <div style={{ flex: 1 }}>
                <Text size="sm" td={item.is_completed ? "line-through" : undefined}>
                  {item.item_label}
                </Text>
                {item.category && (
                  <Text size="xs" c="dimmed">
                    {item.category}
                  </Text>
                )}
              </div>
              {item.completed_at && (
                <Text size="xs" c="dimmed">
                  {new Date(item.completed_at).toLocaleString()}
                </Text>
              )}
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  IPD Phase 2b — Transfer Log (history)
// ══════════════════════════════════════════════════════════

const TRANSFER_TYPE_OPTIONS: { value: TransferType; label: string }[] = [
  { value: "inter_ward", label: "Inter-Ward" },
  { value: "inter_department", label: "Inter-Department" },
  { value: "inter_hospital", label: "Inter-Hospital" },
];

function isTransferType(value: string | null): value is TransferType {
  return TRANSFER_TYPE_OPTIONS.some((option) => option.value === value);
}

function TransferLogTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.TRANSFERS_CREATE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [transferType, setTransferType] = useState<TransferType | null>(null);
  const [reason, setReason] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");

  const { data: transfers, isLoading } = useQuery({
    queryKey: ["ipd-transfers", admissionId],
    queryFn: () => ipdService.listTransfers(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTransferRequest) => ipdService.createTransfer(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-transfers", admissionId] });
      notifications.show({ title: "Recorded", message: "Transfer logged", color: "success" });
      formHandlers.close();
      setTransferType(null);
      setReason("");
      setClinicalSummary("");
    },
  });

  const rows = transfers ?? [];

  return (
    <Stack mt="md">
      <Group justify="space-between">
        <Text fw={500}>Transfer History</Text>
        {canCreate && (
          <Button
            tone="primary"
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() => formHandlers.open()}
          >
            Log Transfer
          </Button>
        )}
      </Group>

      {formOpened && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <Select
              label="Transfer Type"
              data={TRANSFER_TYPE_OPTIONS}
              value={transferType}
              onChange={(value) => setTransferType(isTransferType(value) ? value : null)}
              required
            />
            <Textarea
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
            />
            <Textarea
              label="Clinical Summary"
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.currentTarget.value)}
            />
            <Group>
              <Button
                tone="primary"
                size="sm"
                onClick={() => {
                  if (!transferType || !reason.trim()) return;
                  createMutation.mutate({
                    transfer_type: transferType,
                    reason: reason.trim(),
                    clinical_summary: clinicalSummary.trim() || undefined,
                  });
                }}
                loading={createMutation.isPending}
                disabled={!transferType || !reason.trim()}
              >
                Save
              </Button>
              <Button tone="ghost" size="sm" onClick={() => formHandlers.close()}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No transfers recorded.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Transferred At</Table.Th>
              <Table.Th>Reason</Table.Th>
              <Table.Th>Clinical Summary</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((t: IpdTransferLog) => (
              <Table.Tr key={t.id}>
                <Table.Td>
                  <Badge size="sm">{t.transfer_type.replace(/_/g, " ")}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{new Date(t.transferred_at).toLocaleString()}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{t.reason ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={2}>
                    {t.clinical_summary ?? "—"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  IPD Phase 2b — Discharge TAT Tracking
// ══════════════════════════════════════════════════════════

function DischargeTatTab({ admissionId }: { admissionId: string }) {
  const canView = useHasPermission(P.IPD.DISCHARGE_TAT_VIEW);
  const queryClient = useQueryClient();

  const { data: tat, isLoading } = useQuery({
    queryKey: ["ipd-discharge-tat", admissionId],
    queryFn: () => ipdService.getDischargeTat(admissionId),
    enabled: canView,
  });

  const initMutation = useMutation({
    mutationFn: () => ipdService.initiateDischargeTat(admissionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-tat", admissionId] });
      notifications.show({
        title: "Initiated",
        message: "Discharge TAT tracking started",
        color: "success",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) => ipdService.updateDischargeTat(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-tat", admissionId] });
      notifications.show({
        title: "Updated",
        message: "Discharge milestone recorded",
        color: "success",
      });
    },
  });

  if (!canView)
    return (
      <Text c="dimmed" size="sm">
        No permission to view discharge TAT.
      </Text>
    );
  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const log = tat as IpdDischargeTatLog | null;

  if (!log) {
    return (
      <Stack>
        <Text c="dimmed" size="sm">
          Discharge TAT tracking has not been initiated for this admission.
        </Text>
        <Button
          tone="primary"
          size="sm"
          onClick={() => initMutation.mutate()}
          loading={initMutation.isPending}
        >
          Start Discharge TAT Tracking
        </Button>
      </Stack>
    );
  }

  const milestones = [
    {
      key: "discharge_initiated_at",
      label: "Discharge Initiated",
      value: log.discharge_initiated_at,
    },
    { key: "billing_cleared_at", label: "Billing Cleared", value: log.billing_cleared_at },
    { key: "pharmacy_cleared_at", label: "Pharmacy Cleared", value: log.pharmacy_cleared_at },
    { key: "nursing_cleared_at", label: "Nursing Cleared", value: log.nursing_cleared_at },
    { key: "doctor_cleared_at", label: "Doctor Cleared", value: log.doctor_cleared_at },
    {
      key: "discharge_completed_at",
      label: "Discharge Completed",
      value: log.discharge_completed_at,
    },
  ];

  return (
    <Stack>
      <Text fw={500}>Discharge TAT Timeline</Text>
      {log.total_tat_minutes != null && (
        <Badge size="lg" tone="primary">
          Total TAT: {log.total_tat_minutes} minutes
        </Badge>
      )}
      <Stack gap="xs">
        {milestones.map((m) => (
          <Group
            key={m.key}
            p="xs"
            style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}
            justify="space-between"
          >
            <Group>
              {m.value ? (
                <Badge tone="success" size="sm" variant="dot">
                  Done
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm" variant="dot">
                  Pending
                </Badge>
              )}
              <Text size="sm">{m.label}</Text>
            </Group>
            {m.value ? (
              <Text size="xs" c="dimmed">
                {new Date(m.value).toLocaleString()}
              </Text>
            ) : (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => updateMutation.mutate({ [m.key]: new Date().toISOString() })}
                loading={updateMutation.isPending}
              >
                Mark Complete
              </Button>
            )}
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 3a — New Sub-Tabs
// ══════════════════════════════════════════════════════════

function InvestigationsTab({
  admissionId,
  canOrder,
  onOrderLab,
  onOrderRadiology,
}: {
  admissionId: string;
  canOrder: boolean;
  onOrderLab: () => void;
  onOrderRadiology: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-investigations", admissionId],
    queryFn: () => ipdService.getAdmissionInvestigations(admissionId),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const inv = data as InvestigationsResponse | undefined;
  if (!inv) return <Text c="dimmed">No data.</Text>;

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Text fw={600}>Lab Orders ({inv.lab_orders.length})</Text>
        {canOrder && (
          <Group gap="xs">
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconFlask size={14} />}
              onClick={onOrderLab}
            >
              Order lab
            </Button>
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconEye size={14} />}
              onClick={onOrderRadiology}
            >
              Order imaging
            </Button>
          </Group>
        )}
      </Group>
      {inv.lab_orders.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Test</Table.Th>
              <Table.Th>Ordered</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Results</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {inv.lab_orders.map((lo) => {
              const results = inv.lab_results.filter((r) => r.order_id === lo.id);
              return (
                <Table.Tr key={lo.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {lo.test_name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{new Date(lo.ordered_at).toLocaleDateString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm">{lo.status}</Badge>
                  </Table.Td>
                  <Table.Td>
                    {results.length > 0 ? (
                      <Stack gap={2}>
                        {results.map((r) => (
                          <Group key={r.id} gap={4}>
                            <Text
                              size="xs"
                              c={r.is_abnormal ? "danger" : undefined}
                              fw={r.is_abnormal ? 600 : undefined}
                            >
                              {r.parameter_name}: {r.value ?? "—"} {r.unit ?? ""}
                            </Text>
                            {r.reference_range && (
                              <Text size="xs" c="dimmed">
                                ({r.reference_range})
                              </Text>
                            )}
                            {r.is_abnormal && (
                              <Badge tone="danger" size="xs">
                                Abnormal
                              </Badge>
                            )}
                          </Group>
                        ))}
                      </Stack>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Pending
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No lab orders during admission.
        </Text>
      )}

      <Text fw={600} mt="md">
        Radiology Orders ({inv.radiology_orders.length})
      </Text>
      {inv.radiology_orders.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Modality</Table.Th>
              <Table.Th>Body Part</Table.Th>
              <Table.Th>Ordered</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Findings</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {inv.radiology_orders.map((ro) => (
              <Table.Tr key={ro.id}>
                <Table.Td>
                  <Text size="sm">{ro.modality}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{ro.body_part ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{new Date(ro.ordered_at).toLocaleDateString()}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{ro.status}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{ro.findings ?? "Pending"}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No radiology orders during admission.
        </Text>
      )}
    </Stack>
  );
}

function BillingTab({ admissionId }: { admissionId: string }) {
  const { data: costData } = useQuery({
    queryKey: ["ipd-estimated-cost", admissionId],
    queryFn: () => ipdService.getEstimatedCost(admissionId),
  });
  const { data: summaryData } = useQuery({
    queryKey: ["ipd-billing-summary", admissionId],
    queryFn: () => ipdService.getAdmissionBillingSummary(admissionId),
  });
  const { data: advances } = useQuery({
    queryKey: ["ipd-advances", admissionId],
    queryFn: () => ipdService.getAdmissionAdvances(admissionId),
  });
  const { data: ipTypes } = useQuery({
    queryKey: ["ipd-ip-types"],
    queryFn: () => ipdService.listIpTypes(),
  });

  const cost = costData as EstimatedCostResponse | undefined;
  const billing = summaryData as BillingSummaryResponse | undefined;
  const ipTypeConfigs = (ipTypes ?? []) as IpTypeConfiguration[];
  const configWithThreshold = ipTypeConfigs.find(
    (c) => c.billing_alert_threshold != null && c.billing_alert_threshold > 0,
  );
  const alertThreshold = configWithThreshold?.billing_alert_threshold;
  const thresholdExceeded =
    billing && alertThreshold != null ? billing.total_charges > alertThreshold : false;

  return (
    <Stack>
      {thresholdExceeded && configWithThreshold && (
        <Card withBorder p="sm" bg="red.0" style={{ borderColor: "var(--mantine-color-red-4)" }}>
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
            <Text size="sm" fw={600} c="red.8">
              Billing Alert: Total charges ({billing?.total_charges}) exceed threshold (
              {configWithThreshold.billing_alert_threshold})
            </Text>
          </Group>
        </Card>
      )}

      {cost && (
        <Card withBorder p="sm">
          <Text fw={600} mb="xs">
            Estimated Cost
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <div>
              <Text size="xs" c="dimmed">
                Daily Rate
              </Text>
              <Text fw={500}>{cost.daily_rate}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Nursing/day
              </Text>
              <Text fw={500}>{cost.nursing_charge}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Est. Days
              </Text>
              <Text fw={500}>{cost.estimated_days}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Deposit Required
              </Text>
              <Text fw={500}>{cost.deposit_required}</Text>
            </div>
          </SimpleGrid>
          <Group mt="xs">
            <Badge size="lg" tone="primary">
              Room: {cost.room_total}
            </Badge>
            <Badge size="lg" tone="success">
              Nursing: {cost.nursing_total}
            </Badge>
            <Badge size="lg" tone="primary" variant="filled">
              Total Est.: {cost.total_estimated}
            </Badge>
          </Group>
        </Card>
      )}

      {billing && (
        <Card withBorder p="sm">
          <Text fw={600} mb="xs">
            Charges Summary
          </Text>
          {billing.charges_by_dept.length > 0 ? (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Category</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {billing.charges_by_dept.map((d) => (
                  <Table.Tr key={d.department_name}>
                    <Table.Td>
                      <Text size="sm">{d.department_name}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Text size="sm">{d.total}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="sm" c="dimmed">
              No charges recorded yet.
            </Text>
          )}
          <Group mt="sm">
            <Badge size="lg">Charges: {billing.total_charges}</Badge>
            <Badge size="lg" tone="success">
              Payments: {billing.total_payments}
            </Badge>
            <Badge
              size="lg"
              tone={billing.outstanding_balance > 0 ? "danger" : "success"}
              variant="filled"
            >
              Outstanding: {billing.outstanding_balance}
            </Badge>
          </Group>
        </Card>
      )}

      <Card withBorder p="sm">
        <Text fw={600} mb="xs">
          Advance Payments
        </Text>
        {(advances ?? []).length > 0 ? (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Receipt #</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Date</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(advances ?? []).map((r: Receipt) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Text size="sm">{r.receipt_number}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{String(r.amount)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{new Date(r.receipt_date).toLocaleDateString()}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed">
            No advance payments recorded.
          </Text>
        )}
      </Card>
    </Stack>
  );
}

function InsurancePaTab({ admissionId }: { admissionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-prior-auth", admissionId],
    queryFn: () => ipdService.getAdmissionPriorAuth(admissionId),
  });

  const paStatusColors: Record<string, BadgeTone> = {
    draft: "neutral",
    submitted: "primary",
    approved: "success",
    partially_approved: "warning",
    denied: "danger",
    cancelled: "neutral",
    expired: "warning",
  };

  const rows = data ?? [];

  return (
    <Stack>
      <Text fw={600}>Prior Authorization Requests</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>PA Number</Table.Th>
              <Table.Th>Service</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Urgency</Table.Th>
              <Table.Th>Submitted</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((pa: PriorAuthRequestRow) => (
              <Table.Tr key={pa.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {pa.pa_number}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{pa.service_type}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge tone={paStatusColors[pa.status] ?? "neutral"} size="sm">
                    {pa.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{pa.urgency}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {pa.submitted_at ? new Date(pa.submitted_at).toLocaleDateString() : "—"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No prior authorization requests for this admission.
        </Text>
      )}
    </Stack>
  );
}

function MlcTab({ admissionId, canCreate }: { admissionId: string; canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [mlcIdInput, setMlcIdInput] = useState("");

  const { data: mlcData, isLoading } = useQuery({
    queryKey: ["ipd-mlc", admissionId],
    queryFn: () => ipdService.getAdmissionMlc(admissionId),
  });

  const linkMutation = useMutation({
    mutationFn: (mlcCaseId: string) => ipdService.linkMlc(admissionId, { mlc_case_id: mlcCaseId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-mlc", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      notifications.show({
        title: "Linked",
        message: "MLC case linked to admission",
        color: "success",
      });
      setMlcIdInput("");
    },
  });

  const mlc = mlcData as MlcCase | null | undefined;

  return (
    <Stack>
      <Text fw={600}>Medico-Legal Case</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : mlc ? (
        <Card withBorder p="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <div>
              <Text size="xs" c="dimmed">
                MLC Number
              </Text>
              <Text fw={500}>{mlc.mlc_number}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Status
              </Text>
              <Badge size="sm">{mlc.status}</Badge>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Case Type
              </Text>
              <Text size="sm">{mlc.case_type ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                FIR Number
              </Text>
              <Text size="sm">{mlc.fir_number ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Police Station
              </Text>
              <Text size="sm">{mlc.police_station ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Brought By
              </Text>
              <Text size="sm">{mlc.brought_by ?? "—"}</Text>
            </div>
          </SimpleGrid>
          {mlc.history_of_incident && (
            <div>
              <Text size="xs" c="dimmed" mt="xs">
                History of Incident
              </Text>
              <Text size="sm">{mlc.history_of_incident}</Text>
            </div>
          )}
        </Card>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            No MLC case linked to this admission.
          </Text>
          {canCreate && (
            <Group>
              <TextInput
                placeholder="MLC Case ID"
                value={mlcIdInput}
                onChange={(e) => setMlcIdInput(e.currentTarget.value)}
                w={300}
              />
              <Button
                tone="primary"
                size="sm"
                leftSection={<IconLink size={16} />}
                onClick={() => linkMutation.mutate(mlcIdInput)}
                loading={linkMutation.isPending}
                disabled={!mlcIdInput}
              >
                Link MLC Case
              </Button>
            </Group>
          )}
        </>
      )}
    </Stack>
  );
}

function DietTab({ admissionId }: { admissionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-diet-orders", admissionId],
    queryFn: () => ipdService.getAdmissionDietOrders(admissionId),
  });

  const rows = (data ?? []) as DietOrder[];
  const dietTypeColors: Record<string, BadgeTone> = {
    regular: "primary",
    soft: "success",
    liquid: "info",
    npo: "danger",
    diabetic: "warning",
    renal: "accent",
    cardiac: "danger",
    custom: "neutral",
  };

  return (
    <Stack>
      <Text fw={600}>Diet Orders</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Diet Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>NPO</Table.Th>
              <Table.Th>Special Instructions</Table.Th>
              <Table.Th>Start Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td>
                  <Badge tone={dietTypeColors[d.diet_type] ?? "neutral"} size="sm">
                    {d.diet_type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{d.status}</Badge>
                </Table.Td>
                <Table.Td>
                  {d.is_npo ? (
                    <Badge tone="danger" size="xs">
                      NPO
                    </Badge>
                  ) : (
                    "—"
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{d.special_instructions ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{d.start_date}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No diet orders for this admission.
        </Text>
      )}
    </Stack>
  );
}

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

function BedTurnaroundView() {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-bed-turnaround-recent"],
    queryFn: () => ipdService.listBedTurnaround(),
  });

  const rows = (data ?? []) as BedTurnaroundLog[];
  const avgTat =
    rows.length > 0
      ? Math.round(
          rows
            .filter((r) => r.turnaround_minutes != null)
            .reduce((sum, r) => sum + (r.turnaround_minutes ?? 0), 0) /
            Math.max(rows.filter((r) => r.turnaround_minutes != null).length, 1),
        )
      : 0;

  return (
    <Card withBorder p="sm">
      <Group justify="space-between" mb="xs">
        <Text fw={600}>Bed Turnaround Log</Text>
        {avgTat > 0 && (
          <Badge size="lg" tone="primary">
            Avg TAT: {avgTat} min
          </Badge>
        )}
      </Group>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Bed</Table.Th>
              <Table.Th>Vacated</Table.Th>
              <Table.Th>Cleaning Started</Table.Th>
              <Table.Th>Completed</Table.Th>
              <Table.Th>TAT (min)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.slice(0, 20).map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <Text size="sm">{r.bed_id.slice(0, 8)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {r.vacated_at ? new Date(r.vacated_at).toLocaleString() : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {r.cleaning_started_at ? new Date(r.cleaning_started_at).toLocaleString() : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {r.cleaning_completed_at
                      ? new Date(r.cleaning_completed_at).toLocaleString()
                      : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {r.turnaround_minutes != null ? (
                    <Badge tone={r.turnaround_minutes <= 60 ? "success" : "warning"} size="sm">
                      {r.turnaround_minutes}
                    </Badge>
                  ) : (
                    <Badge tone="warning" size="sm">
                      In progress
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No turnaround records.
        </Text>
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 3b — Restraint Checks Summary (inline)
// ══════════════════════════════════════════════════════════

function RestraintChecksSummary({ admissionId, docId }: { admissionId: string; docId: string }) {
  const { data } = useQuery({
    queryKey: ["restraint-checks", admissionId, docId],
    queryFn: () => ipdService.listRestraintChecks(admissionId, docId),
    refetchInterval: 60_000,
  });

  const checks = (data ?? []) as RestraintMonitoringLog[];
  const lastCheck = checks.length > 0 ? checks[checks.length - 1] : null;
  const isOverdue = lastCheck
    ? Date.now() - new Date(lastCheck.check_time).getTime() > 30 * 60 * 1000
    : true;

  return (
    <Group gap={4}>
      <Badge size="xs">{checks.length} checks</Badge>
      {lastCheck && (
        <Tooltip
          label={`Last: ${new Date(lastCheck.check_time).toLocaleString()} — ${lastCheck.status.replace(/_/g, " ")}`}
        >
          <Badge size="xs" tone={isOverdue ? "danger" : "success"} variant="filled">
            {isOverdue ? "OVERDUE" : "OK"}
          </Badge>
        </Tooltip>
      )}
      {!lastCheck && (
        <Badge size="xs" tone="danger" variant="filled">
          No checks
        </Badge>
      )}
    </Group>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 3b — Death Summary Tab
// ══════════════════════════════════════════════════════════

function DeathSummaryTab({
  admissionId,
  patientId,
  status,
}: {
  admissionId: string;
  patientId: string;
  status: string;
}) {
  const canCreate = useHasPermission(P.IPD.CLINICAL_DOCS_CREATE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [timeOfDeath, setTimeOfDeath] = useState("");
  const [causePrimary, setCausePrimary] = useState("");
  const [causeSecondary, setCauseSecondary] = useState("");
  const [causeUnderlying, setCauseUnderlying] = useState("");
  const [mannerOfDeath, setMannerOfDeath] = useState("");
  const [formType, setFormType] = useState<string | null>("form_4");
  const [autopsyRequested, setAutopsyRequested] = useState(false);
  const [isMedicoLegal, setIsMedicoLegal] = useState(false);
  const [witnessName, setWitnessName] = useState("");
  const [dsNotes, setDsNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ipd-death-summary", admissionId],
    queryFn: () => ipdService.getDeathSummary(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateDeathSummaryRequest) => ipdService.createDeathSummary(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-death-summary", admissionId] });
      notifications.show({ title: "Created", message: "Death summary recorded", color: "success" });
      formHandlers.close();
    },
  });

  const summary = data as IpdDeathSummary | null | undefined;

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  if (summary) {
    return (
      <Stack>
        <Text fw={600}>Death Summary</Text>
        <Card withBorder p="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <div>
              <Text size="xs" c="dimmed">
                Date of Death
              </Text>
              <Text fw={500}>{summary.date_of_death}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Time of Death
              </Text>
              <Text fw={500}>{summary.time_of_death}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Primary Cause
              </Text>
              <Text size="sm">{summary.cause_of_death_primary ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Secondary Cause
              </Text>
              <Text size="sm">{summary.cause_of_death_secondary ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Underlying Cause
              </Text>
              <Text size="sm">{summary.cause_of_death_underlying ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Manner of Death
              </Text>
              <Text size="sm">{summary.manner_of_death ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Form Type
              </Text>
              <Badge size="sm">
                {summary.form_type === "form_4"
                  ? "Form 4 (Institutional)"
                  : "Form 4a (Non-Institutional)"}
              </Badge>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Flags
              </Text>
              <Group gap={4}>
                {summary.autopsy_requested && (
                  <Badge size="xs" tone="warning">
                    Autopsy Requested
                  </Badge>
                )}
                {summary.is_medico_legal && (
                  <Badge size="xs" tone="danger">
                    Medico-Legal
                  </Badge>
                )}
              </Group>
            </div>
          </SimpleGrid>
          {summary.notes && (
            <div>
              <Text size="xs" c="dimmed" mt="xs">
                Notes
              </Text>
              <Text size="sm">{summary.notes}</Text>
            </div>
          )}
        </Card>
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Death Summary</Text>
        {canCreate && status === "deceased" && !formOpened && (
          <Button
            tone="primary"
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() => formHandlers.open()}
          >
            Create Death Summary
          </Button>
        )}
      </Group>

      {status !== "deceased" && (
        <Text size="sm" c="dimmed">
          Death summary is only applicable for deceased patients.
        </Text>
      )}

      {formOpened && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Date of Death"
                type="date"
                value={dateOfDeath}
                onChange={(e) => setDateOfDeath(e.currentTarget.value)}
                required
              />
              <TextInput
                label="Time of Death"
                type="time"
                value={timeOfDeath}
                onChange={(e) => setTimeOfDeath(e.currentTarget.value)}
                required
              />
            </SimpleGrid>
            <TextInput
              label="Primary Cause of Death (ICD)"
              value={causePrimary}
              onChange={(e) => setCausePrimary(e.currentTarget.value)}
              required
            />
            <TextInput
              label="Secondary Cause"
              value={causeSecondary}
              onChange={(e) => setCauseSecondary(e.currentTarget.value)}
            />
            <TextInput
              label="Underlying Cause"
              value={causeUnderlying}
              onChange={(e) => setCauseUnderlying(e.currentTarget.value)}
            />
            <TextInput
              label="Manner of Death"
              value={mannerOfDeath}
              onChange={(e) => setMannerOfDeath(e.currentTarget.value)}
              placeholder="Natural / Accident / Suicide / Homicide / Undetermined"
            />
            <Select
              label="Certificate Form"
              data={[
                { value: "form_4", label: "Form 4 (Institutional)" },
                { value: "form_4a", label: "Form 4a (Non-Institutional)" },
              ]}
              value={formType}
              onChange={setFormType}
            />
            <Group>
              <Checkbox
                label="Autopsy Requested"
                checked={autopsyRequested}
                onChange={(e) => setAutopsyRequested(e.currentTarget.checked)}
              />
              <Checkbox
                label="Medico-Legal Case"
                checked={isMedicoLegal}
                onChange={(e) => setIsMedicoLegal(e.currentTarget.checked)}
              />
            </Group>
            <TextInput
              label="Witness Name"
              value={witnessName}
              onChange={(e) => setWitnessName(e.currentTarget.value)}
            />
            <Textarea
              label="Notes"
              value={dsNotes}
              onChange={(e) => setDsNotes(e.currentTarget.value)}
            />
            <Group>
              <Button
                tone="primary"
                size="sm"
                onClick={() =>
                  createMutation.mutate({
                    patient_id: patientId,
                    date_of_death: dateOfDeath,
                    time_of_death: timeOfDeath,
                    cause_of_death_primary: causePrimary || undefined,
                    cause_of_death_secondary: causeSecondary || undefined,
                    cause_of_death_underlying: causeUnderlying || undefined,
                    manner_of_death: mannerOfDeath || undefined,
                    form_type: (formType as DeathCertFormType) || undefined,
                    autopsy_requested: autopsyRequested,
                    is_medico_legal: isMedicoLegal,
                    witness_name: witnessName || undefined,
                    notes: dsNotes || undefined,
                  })
                }
                loading={createMutation.isPending}
                disabled={!dateOfDeath || !timeOfDeath}
              >
                Save Death Summary
              </Button>
              <Button tone="ghost" size="sm" onClick={() => formHandlers.close()}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 3b — Birth Records Tab
// ══════════════════════════════════════════════════════════

function BirthRecordsTab({
  admissionId,
  motherPatientId,
}: {
  admissionId: string;
  motherPatientId: string;
}) {
  const canCreate = useHasPermission(P.IPD.CLINICAL_DOCS_CREATE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [weightGrams, setWeightGrams] = useState<number | string>("");
  const [lengthCm, setLengthCm] = useState<number | string>("");
  const [headCirc, setHeadCirc] = useState<number | string>("");
  const [apgar1, setApgar1] = useState<number | string>("");
  const [apgar5, setApgar5] = useState<number | string>("");
  const [deliveryType, setDeliveryType] = useState<string | null>(null);
  const [isLiveBirth, setIsLiveBirth] = useState(true);
  const [certNumber, setCertNumber] = useState("");
  const [complications, setComplications] = useState("");
  const [brNotes, setBrNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ipd-birth-records", admissionId],
    queryFn: () => ipdService.listBirthRecords(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateBirthRecordRequest) => ipdService.createBirthRecord(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-birth-records", admissionId] });
      notifications.show({ title: "Created", message: "Birth record saved", color: "success" });
      formHandlers.close();
      setDob("");
      setTob("");
      setGender(null);
      setWeightGrams("");
      setLengthCm("");
      setHeadCirc("");
      setApgar1("");
      setApgar5("");
      setDeliveryType(null);
      setCertNumber("");
      setComplications("");
      setBrNotes("");
    },
  });

  const records = (data ?? []) as IpdBirthRecord[];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Birth Records</Text>
        {canCreate && (
          <Button
            tone="primary"
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() => formHandlers.open()}
          >
            Add Birth Record
          </Button>
        )}
      </Group>

      {formOpened && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Date of Birth"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.currentTarget.value)}
                required
              />
              <TextInput
                label="Time of Birth"
                type="time"
                value={tob}
                onChange={(e) => setTob(e.currentTarget.value)}
                required
              />
              <Select
                label="Gender"
                data={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "indeterminate", label: "Indeterminate" },
                ]}
                value={gender}
                onChange={setGender}
              />
              <Select
                label="Delivery Type"
                data={[
                  { value: "vaginal", label: "Normal Vaginal" },
                  { value: "lscs", label: "LSCS (C-Section)" },
                  { value: "assisted", label: "Assisted (Forceps/Vacuum)" },
                  { value: "breech", label: "Breech" },
                ]}
                value={deliveryType}
                onChange={setDeliveryType}
              />
              <NumberInput
                label="Weight (grams)"
                value={weightGrams}
                onChange={setWeightGrams}
                min={0}
              />
              <NumberInput label="Length (cm)" value={lengthCm} onChange={setLengthCm} min={0} />
              <NumberInput
                label="Head Circumference (cm)"
                value={headCirc}
                onChange={setHeadCirc}
                min={0}
              />
              <Group>
                <NumberInput
                  label="Apgar 1 min"
                  value={apgar1}
                  onChange={setApgar1}
                  min={0}
                  max={10}
                  w={100}
                />
                <NumberInput
                  label="Apgar 5 min"
                  value={apgar5}
                  onChange={setApgar5}
                  min={0}
                  max={10}
                  w={100}
                />
              </Group>
            </SimpleGrid>
            <Checkbox
              label="Live Birth"
              checked={isLiveBirth}
              onChange={(e) => setIsLiveBirth(e.currentTarget.checked)}
            />
            <TextInput
              label="Birth Certificate Number"
              value={certNumber}
              onChange={(e) => setCertNumber(e.currentTarget.value)}
            />
            <Textarea
              label="Complications"
              value={complications}
              onChange={(e) => setComplications(e.currentTarget.value)}
            />
            <Textarea
              label="Notes"
              value={brNotes}
              onChange={(e) => setBrNotes(e.currentTarget.value)}
            />
            <Group>
              <Button
                tone="primary"
                size="sm"
                onClick={() =>
                  createMutation.mutate({
                    mother_patient_id: motherPatientId,
                    date_of_birth: dob,
                    time_of_birth: tob,
                    gender: gender ?? undefined,
                    weight_grams: weightGrams ? Number(weightGrams) : undefined,
                    length_cm: lengthCm ? Number(lengthCm) : undefined,
                    head_circumference_cm: headCirc ? Number(headCirc) : undefined,
                    apgar_1min: apgar1 ? Number(apgar1) : undefined,
                    apgar_5min: apgar5 ? Number(apgar5) : undefined,
                    delivery_type: deliveryType ?? undefined,
                    is_live_birth: isLiveBirth,
                    birth_certificate_number: certNumber || undefined,
                    complications: complications || undefined,
                    notes: brNotes || undefined,
                  })
                }
                loading={createMutation.isPending}
                disabled={!dob || !tob}
              >
                Save
              </Button>
              <Button tone="ghost" size="sm" onClick={() => formHandlers.close()}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : records.length === 0 ? (
        <Text c="dimmed" size="sm">
          No birth records for this admission.
        </Text>
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date/Time</Table.Th>
              <Table.Th>Gender</Table.Th>
              <Table.Th>Weight (g)</Table.Th>
              <Table.Th>Delivery</Table.Th>
              <Table.Th>Apgar</Table.Th>
              <Table.Th>Live Birth</Table.Th>
              <Table.Th>Cert #</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {records.map((r: IpdBirthRecord) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <Text size="sm">
                    {r.date_of_birth} {r.time_of_birth}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    size="sm"
                    tone={
                      r.gender === "male" ? "primary" : r.gender === "female" ? "danger" : "neutral"
                    }
                  >
                    {r.gender ?? "—"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.weight_grams ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.delivery_type ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {r.apgar_1min != null ? `${r.apgar_1min}/${r.apgar_5min}` : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {r.is_live_birth ? (
                    <Badge tone="success" size="xs">
                      Yes
                    </Badge>
                  ) : (
                    <Badge tone="danger" size="xs">
                      No
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.birth_certificate_number ?? "—"}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 3b — OT Analytics Reports
// ══════════════════════════════════════════════════════════

function SurgeonCaseloadReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ot-surgeon-caseload", from, to],
    queryFn: () => ipdService.getSurgeonCaseload({ from: from || undefined, to: to || undefined }),
  });

  const rows = (data ?? []) as SurgeonCaseloadEntry[];

  return (
    <Stack>
      <Text fw={500}>Surgeon Caseload Analysis</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No OT case records in this period.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Surgeon</Table.Th>
              <Table.Th>Total Cases</Table.Th>
              <Table.Th>Avg Duration (min)</Table.Th>
              <Table.Th>Complications</Table.Th>
              <Table.Th>Cancellations</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.surgeon_id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {r.surgeon_name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.total_cases}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {r.avg_duration_minutes != null ? Math.round(r.avg_duration_minutes) : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {r.complication_count > 0 ? (
                    <Badge tone="danger" size="sm">
                      {r.complication_count}
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm">
                      0
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  {r.cancellation_count > 0 ? (
                    <Badge tone="warning" size="sm">
                      {r.cancellation_count}
                    </Badge>
                  ) : (
                    <Text size="sm">0</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Generate Discharge Summary Modal ──────────────────────
// ═══════════════════════════════════════════════════════════

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
      notifications.show({
        title: "Generated",
        message: "Discharge summary generated",
        color: "success",
      });
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to generate discharge summary",
        color: "danger",
      });
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
      notifications.show({
        title: t("notify.transferred"),
        message: t("notify.bedTransferCompleted"),
        color: "success",
      });
      emitIpdBedMovementEvent(emit, response, patientId, notes.trim());
      onClose();
      setToBedId("");
      setReason("");
      setNotes("");
    },
    onError: () => {
      notifications.show({
        title: t("notify.error"),
        message: t("notify.bedTransferFailed"),
        color: "danger",
      });
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

function ExpectedDischargesTab() {
  const [hours, setHours] = useState<number | string>(48);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["expected-discharges", hours],
    queryFn: () => ipdService.expectedDischarges({ hours: typeof hours === "number" ? hours : 48 }),
  });

  const columns = [
    {
      key: "patient_name",
      label: "Patient",
      fieldAccessKeys: PATIENT_NAME_FIELD_ACCESS_KEYS,
      accessor: (row: ExpectedDischargeRow) => row.patient_name,
      fieldKind: "name",
      hiddenLabel: "Patient restricted",
      render: (row: ExpectedDischargeRow) => (
        <Text size="sm" fw={500}>
          {row.patient_name}
        </Text>
      ),
    },
    {
      key: "ward",
      label: "Ward",
      render: (row: ExpectedDischargeRow) => <Text size="sm">{row.ward}</Text>,
    },
    {
      key: "bed_number",
      label: "Bed",
      render: (row: ExpectedDischargeRow) => <Text size="sm">{row.bed_number}</Text>,
    },
    {
      key: "expected_discharge_date",
      label: "Expected Discharge",
      render: (row: ExpectedDischargeRow) => (
        <Text size="sm">{new Date(row.expected_discharge_date).toLocaleString()}</Text>
      ),
    },
    {
      key: "attending_doctor",
      label: "Attending Doctor",
      render: (row: ExpectedDischargeRow) => <Text size="sm">{row.attending_doctor}</Text>,
    },
    {
      key: "days_admitted",
      label: "Days Admitted",
      render: (row: ExpectedDischargeRow) => (
        <Badge
          tone={row.days_admitted > 14 ? "danger" : row.days_admitted > 7 ? "warning" : "primary"}
          size="sm"
        >
          {row.days_admitted} days
        </Badge>
      ),
    },
  ] satisfies Column<ExpectedDischargeRow>[];

  return (
    <Stack>
      <Group>
        <NumberInput
          label="Within next (hours)"
          value={hours}
          onChange={setHours}
          min={1}
          max={168}
          w={180}
        />
      </Group>
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(row) => row.admission_id}
      />
      {!isLoading && rows.length === 0 && (
        <Text size="sm" c="dimmed" ta="center">
          No expected discharges within the next {typeof hours === "number" ? hours : 48} hours.
        </Text>
      )}
    </Stack>
  );
}

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
