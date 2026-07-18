import {
  Box,
  Card,
  Checkbox,
  Drawer,
  Grid,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdmissionDetailResponse,
  AdmissionPrintData,
  ClinicalJourneyActionId,
  ClinicalJourneyContext,
  DischargeType,
  InvestigationsResponse,
  IpdDischargeChecklist,
  IpdDischargeSummary,
  MrdCaseSheetPacket,
  PrescriptionWithItems,
} from "@medbrains/types";
import {
  journeyActionSignalLabel,
  P,
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
  IconClipboardList,
  IconCross,
  IconDoor,
  IconEye,
  IconFileDescription,
  IconFlask,
  IconLayoutGrid,
  IconPill,
  IconPrinter,
  IconUserOff,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  DocumentActions,
  OperationalSignal,
  PageHeader,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import { PatientConsumablesPanel } from "@/components/Clinical";
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
import { Alert, Badge, Button, type ButtonTone, toast } from "@/components/ui";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
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
import { BedDashboardTab } from "./ipd/bed-dashboard";
import { BedTransferModal } from "./ipd/bed-transfer-modal";
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
import { protectedIpdPatientIdentifier, protectedIpdPatientName } from "./ipd/shared";
import { TransferTab } from "./ipd/transfer";
import { WardsTab } from "./ipd/wards";

type IpdTranslate = ReturnType<typeof useTranslation>["t"];

import { AdmissionsTab } from "./ipd/admissions";
import { ConsentsTab } from "./ipd/consents";
import { GenerateDischargeSummaryModal } from "./ipd/generate-discharge-summary-modal";
import { OverviewTab } from "./ipd/overview";
import { ReportsTab } from "./ipd/reports-tab";
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
