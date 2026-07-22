import { nullOn404 } from "@medbrains/api";
// Ipd AdmissionDetail — split from ipd.tsx (pure move).

import { Box, Grid, Group, Stack, Tabs, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdmissionDetailResponse,
  ClinicalJourneyContext,
  InvestigationsResponse,
  IpdDischargeSummary,
  MrdCaseSheetPacket,
  PrescriptionWithItems,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconArrowRight,
  IconArrowsTransferDown,
  IconBed,
  IconCalendarTime,
  IconClipboardList,
  IconCross,
  IconEye,
  IconFileDescription,
  IconFlask,
  IconPill,
  IconPrinter,
  IconUserOff,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { DocumentActions, OperationalSignal, useClinicalEmit } from "@/components";
import { PatientConsumablesPanel } from "@/components/Clinical";
import { DamaModal } from "@/components/Ipd/DamaModal";
import { DischargeWorkflowWizard } from "@/components/Ipd/DischargeWorkflowWizard";
import { MarkDeathModal } from "@/components/Ipd/MarkDeathModal";
import { TransferOutModal } from "@/components/Ipd/TransferOutModal";
import { WristbandPrintModal } from "@/components/Ipd/WristbandPrintModal";
import { InfusionsPanel } from "@/components/Nurse/InfusionsPanel";
import type { OrderBasketTab } from "@/components/OrderBasket/OrderBasketWorkspace";
import { OrderBasketWorkspace } from "@/components/OrderBasket/OrderBasketWorkspace";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { useHashTabs } from "@/hooks/useHashTabs";
import { billingService } from "@/services/billing.service";
import { ipdService } from "@/services/ipd.service";
import { mrdService } from "@/services/mrd.service";
import { pharmacyService } from "@/services/pharmacy.service";
import classes from "../ipd.module.scss";
import type { IpdActionRailSection } from "../ipd-workspace";
import {
  activeIpdInvoiceIdForJourney,
  activeIpdPharmacyOrderIdForJourney,
  activeIpdPharmacyRxQueueIdForJourney,
  deriveIpdJourneyCompletedEvents,
  ipdActionRailAction,
  ipdActionRailSectionsForTab,
  ipdAdmissionOrderBasketRoute,
  ipdAdmissionWorkspaceTabRoute,
  ipdOrderBasketTabFromSearchParams,
  ipdWorkspaceTabForOrderBasket,
  resolveIpdActionRailActions,
  summarizeIpdActionRailSections,
  summarizeIpdWorkspaceTabReadiness,
} from "../ipd-workspace";
import {
  ActionRailActionButton,
  ActionRailSectionHeading,
  actionRailReadinessBadge,
  actionRailSectionLabel,
  firstIpdWorkspaceTabForSection,
  IPD_ACTION_RAIL_LOCAL_ACTION_IDS,
  IPD_WORKSPACE_SECTIONS,
  IPD_WORKSPACE_TAB_VALUES,
  IPD_WORKSPACE_TABS,
  ipdWorkspaceSectionLabel,
  ipdWorkspaceTabLabel,
  workspaceReadinessBlockedReason,
} from "./action-rail";
import { AdmissionPrescriptionsTab } from "./admission-prescriptions";
import { AssessmentsTab } from "./assessments";
import { AttendersTab } from "./attenders";
import { BedTransferModal } from "./bed-transfer-modal";
import { BillingTab } from "./billing";
import { BirthRecordsTab } from "./birth-records";
import { ChecklistTab } from "./checklist";
import { ClinicalDocsTab } from "./clinical-docs";
import { ConsentsTab } from "./consents";
import { DeathSummaryTab } from "./death-summary";
import { DietTab } from "./diet";
import { DischargeSummaryTab } from "./discharge-summary";
import { DischargeTab } from "./discharge-tab";
import { DischargeTatTab } from "./discharge-tat";
import { GenerateDischargeSummaryModal } from "./generate-discharge-summary-modal";
import { InsurancePaTab } from "./insurance-pa";
import { InvestigationsTab } from "./investigations";
import { IoChartTab } from "./io-chart";
import { MarTab } from "./mar";
import { MlcTab } from "./mlc";
import { NursingTab } from "./nursing";
import { OverviewTab } from "./overview";
import { PrintAdmissionButton } from "./print-admission-button";
import { ProgressNotesTab } from "./progress-notes";
import { TransferTab } from "./transfer";
import { TransferLogTab } from "./transfer-log";

export function AdmissionDetail({
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
    queryFn: () => ipdService.getDischargeSummary(admissionId).catch(nullOn404),
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
