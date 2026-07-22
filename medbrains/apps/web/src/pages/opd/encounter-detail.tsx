import { nullOn404 } from "@medbrains/api";
// OPD EncounterDetail — split from opd.tsx (pure move).

import { Card, Group, Menu, Modal, Stack, Tabs, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  Consultation,
  Diagnosis,
  LabTestCatalog,
  PatientAllergy,
  PatientDiagnosisRow,
  PrescriptionWithItems,
  Vital,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCalendarPlus,
  IconCertificate,
  IconChartLine,
  IconChevronDown,
  IconClipboardList,
  IconDotsVertical,
  IconEye,
  IconFileCheck,
  IconFlask,
  IconHeartbeat,
  IconHistory,
  IconMedicalCross,
  IconMessage,
  IconNotebook,
  IconPill,
  IconPrinter,
  IconShieldCheck,
  IconStar,
  IconStethoscope,
  IconTimeline,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useClinicalEmit, VisitSummaryPrint } from "@/components";
import { PatientBillingModal } from "@/components/Billing/PatientBillingModal";
import { CampRegistrationModal } from "@/components/Camp/CampRegistrationModal";
import { EmergencyVisitModal } from "@/components/Emergency/EmergencyVisitModal";
import { OrderBasketChip } from "@/components/OrderBasket/OrderBasketChip";
import type { OrderBasketTab } from "@/components/OrderBasket/OrderBasketWorkspace";
import { OrderBasketWorkspace } from "@/components/OrderBasket/OrderBasketWorkspace";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientContextSummary } from "@/components/Patient/PatientContextSummary";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { Badge, Button, toast } from "@/components/ui";
import { useHashTabs } from "@/hooks/useHashTabs";
import { mrdService } from "@/services/mrd.service";
import { opdService } from "@/services/opd.service";
import railStyles from "../opd-encounter.module.scss";
import {
  activeOpdPharmacyOrderIdForJourney,
  activeOpdPharmacyRxQueueIdForJourney,
  deriveOpdJourneyCompletedEvents,
  isOpdEncounterTabValue,
  OPD_ENCOUNTER_TAB_VALUES,
  opdEncounterOrderBasketRoute,
  opdEncounterTabForOrderBasket,
  opdEncounterWorkspaceTabRoute,
  opdOrderBasketTabFromSearchParams,
} from "../opd-workspace";
import { AdmitToIpdButton } from "./admit-to-ipd-button";
import { ConsultationTab } from "./consultation";
import { DiagnosesTab } from "./diagnoses";
import { HistoryTab, PhysicalExamTab, ROSTab } from "./documentation-tabs";
import { FollowUpTab } from "./follow-up";
import { GroupAppointmentModal } from "./group-appointment-modal";
import { InvestigationsTab } from "./investigations";
import { PharmacyDispatchTab } from "./pharmacy-dispatch";
import { PrescriptionsTab } from "./prescriptions";
import { VitalsTab } from "./vitals";
import {
  CertificatesTab,
  ChartsTab,
  ConsentsTab,
  DocketTab,
  FeedbackTab,
  PreAuthTab,
  ProceduresTab,
  ReferralsTab,
  RemindersTab,
  RxHistoryTab,
  TimelineTab,
} from "./workflow-tabs";

export function EncounterDetail({
  encounterId,
  patientId,
  patientName,
  uhid,
  doctorId,
  departmentId,
  canUpdate,
}: {
  encounterId: string;
  patientId: string;
  patientName: string;
  uhid: string;
  doctorId: string | null;
  departmentId: string;
  canUpdate: boolean;
}) {
  const canOrder = useHasPermission(P.ORDER_BASKET.SIGN);
  const canGenerateMrdCaseSheet = useHasPermission(P.MRD.CASE_SHEETS_GENERATE);
  const canViewMrdCaseSheets = useHasPermission(P.MRD.CASE_SHEETS_VIEW);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const emit = useClinicalEmit();
  const orderBasketDeepLinkTab = opdOrderBasketTabFromSearchParams(searchParams);
  const [summaryOpened, { open: openSummary, close: closeSummary }] = useDisclosure(false);
  // Controlled so the Patient Flow "IPD" chip can open the same Admit modal.
  const admitControl = useDisclosure(false);
  const billingControl = useDisclosure(false);
  const emergencyControl = useDisclosure(false);
  const campControl = useDisclosure(false);
  const [patientPeekOpened, patientPeek] = useDisclosure(false);
  const [activeEncounterTab, setActiveEncounterTab] = useHashTabs(
    "consultation",
    OPD_ENCOUNTER_TAB_VALUES,
  );
  const activeWorkspaceTab = isOpdEncounterTabValue(activeEncounterTab)
    ? activeEncounterTab
    : "consultation";
  const basketOpened = orderBasketDeepLinkTab !== null;
  const basketTab = orderBasketDeepLinkTab ?? "drug";

  function openOrderBasket(tab: OrderBasketTab = "drug") {
    setActiveEncounterTab(opdEncounterTabForOrderBasket(tab));
    navigate(opdEncounterOrderBasketRoute(encounterId, tab));
  }

  function changeOrderBasketTab(tab: OrderBasketTab) {
    setActiveEncounterTab(opdEncounterTabForOrderBasket(tab));
    navigate(opdEncounterOrderBasketRoute(encounterId, tab), { replace: true });
  }

  function closeOrderBasket() {
    navigate(opdEncounterWorkspaceTabRoute(encounterId, activeWorkspaceTab), { replace: true });
  }

  // Fetch all data for visit summary print
  const { data: vitals = [] } = useQuery({
    queryKey: ["vitals", encounterId],
    queryFn: () => opdService.listVitals(encounterId),
  });
  const { data: consultation } = useQuery<Consultation | null>({
    queryKey: ["consultation", encounterId],
    queryFn: () => opdService.getConsultation(encounterId).catch(nullOn404),
  });
  const { data: diagnoses = [] } = useQuery({
    queryKey: ["diagnoses", encounterId],
    queryFn: () => opdService.listDiagnoses(encounterId),
  });
  const { data: prescriptions = [] } = useQuery<PrescriptionWithItems[]>({
    queryKey: ["prescriptions", encounterId],
    queryFn: () => opdService.listPrescriptions(encounterId),
  });
  const { data: labOrdersResponse } = useQuery({
    queryKey: ["lab-orders", encounterId],
    queryFn: () => opdService.listLabOrders({ encounter_id: encounterId }),
  });
  const { data: labCatalog = [] } = useQuery({
    queryKey: ["lab-catalog"],
    queryFn: () => opdService.listLabCatalog(),
  });
  const { data: hospitalSettings = [] } = useQuery({
    queryKey: ["tenant-settings", "general"],
    queryFn: () => opdService.getTenantSettings("general"),
    staleTime: 600_000,
  });
  const { data: mrdCaseSheetPackets = [] } = useQuery({
    queryKey: ["mrd-case-sheets", "opd", encounterId],
    queryFn: () =>
      mrdService.listMrdCaseSheetPackets({
        encounter_id: encounterId,
        packet_type: "opd",
      }),
    enabled: canViewMrdCaseSheets,
    staleTime: 60_000,
  });
  const latestMrdCaseSheet = mrdCaseSheetPackets[0];
  const encounterLabOrders = useMemo(() => labOrdersResponse?.orders ?? [], [labOrdersResponse]);
  const journeyCompletedEvents = useMemo(
    () => deriveOpdJourneyCompletedEvents(prescriptions, encounterLabOrders, mrdCaseSheetPackets),
    [encounterLabOrders, mrdCaseSheetPackets, prescriptions],
  );
  const activePharmacyOrderId = activeOpdPharmacyOrderIdForJourney(prescriptions);
  const activePharmacyRxQueueId = activeOpdPharmacyRxQueueIdForJourney(prescriptions);

  const generateMrdCaseSheetMutation = useMutation({
    mutationFn: () => mrdService.generateOpdCaseSheetPacket(encounterId),
    onSuccess: (packet) => {
      emit("mrd.case_sheet.generated", {
        packet_id: packet.id,
        packet_number: packet.packet_number,
        packet_type: packet.packet_type,
        patient_id: packet.patient_id,
        encounter_id: packet.encounter_id,
        source_record_id: packet.id,
      });
      void queryClient.invalidateQueries({ queryKey: ["mrd-case-sheets"] });
      toast.success(`${packet.packet_number} is available in MRD case sheets`, {
        title: "Sent to MRD",
      });
    },
    onError: () => {
      toast.error("Unable to generate the OPD case-sheet packet", {
        title: "MRD handoff failed",
      });
    },
  });

  // Allergy data
  const { data: allergies = [] } = useQuery({
    queryKey: ["patient-allergies", patientId],
    queryFn: () => opdService.listPatientAllergies(patientId),
  });
  const activeAllergies = (allergies as PatientAllergy[]).filter((a) => a.is_active);

  // Chronic conditions (unresolved diagnoses from past encounters)
  const { data: patientDiagnoses = [] } = useQuery({
    queryKey: ["patient-diagnoses", patientId],
    queryFn: () => opdService.listPatientDiagnoses(patientId),
    staleTime: 120_000,
  });
  const chronicConditions = useMemo(() => {
    const dx = patientDiagnoses as PatientDiagnosisRow[];
    // Show unresolved diagnoses from previous encounters
    return dx.filter((d) => !d.resolved_date && d.encounter_id !== encounterId);
  }, [patientDiagnoses, encounterId]);
  const getSetting = (key: string) => {
    const row = hospitalSettings.find((s) => s.key === key);
    return row ? String(row.value) : undefined;
  };

  return (
    <>
      {summaryOpened && (
        <VisitSummaryPrint
          opened={summaryOpened}
          onClose={closeSummary}
          patientName={patientName}
          uhid={uhid}
          visitDate={new Date().toISOString()}
          hospitalName={getSetting("hospital_name")}
          hospitalAddress={getSetting("hospital_address")}
          hospitalPhone={getSetting("hospital_phone")}
          vitals={vitals as Vital[]}
          consultation={consultation as Consultation | null}
          diagnoses={diagnoses as Diagnosis[]}
          prescriptions={prescriptions}
          labOrders={encounterLabOrders}
          labCatalog={labCatalog as LabTestCatalog[]}
        />
      )}

      <PatientContextBanner patientId={patientId} hideLoadingState surface="detail" />
      <PatientFlowNavigator
        patientId={patientId}
        active="opd"
        activeEncounterId={encounterId}
        activePharmacyOrderId={activePharmacyOrderId}
        activePharmacyRxQueueId={activePharmacyRxQueueId}
        completedEvents={journeyCompletedEvents}
        compact
        onStageAction={(stage) => {
          // Reuse the encounter's own modals/drawers instead of navigating away.
          if (stage === "pharmacy" && canOrder) {
            openOrderBasket("drug");
            return true;
          }
          if (stage === "ipd") {
            admitControl[1].open();
            return true;
          }
          if (stage === "billing") {
            billingControl[1].open();
            return true;
          }
          if (stage === "patient") {
            patientPeek.open();
            return true;
          }
          if (stage === "emergency") {
            emergencyControl[1].open();
            return true;
          }
          if (stage === "camp") {
            campControl[1].open();
            return true;
          }
          return false;
        }}
        actions={
          <>
            {canOrder && <OrderBasketChip onClick={() => openOrderBasket("drug")} />}
            {canOrder && (
              <Button
                tone="secondary"
                size="xs"
                leftSection={<IconFlask size={14} />}
                onClick={() => openOrderBasket("lab")}
              >
                Lab
              </Button>
            )}
            {canOrder && (
              <Button
                tone="secondary"
                size="xs"
                leftSection={<IconEye size={14} />}
                onClick={() => openOrderBasket("radiology")}
              >
                Imaging
              </Button>
            )}
            <Menu shadow="md" width={224} position="bottom-start" keepMounted>
              <Menu.Target>
                <Button
                  tone="secondary"
                  size="xs"
                  rightSection={<IconChevronDown size={14} />}
                  leftSection={<IconDotsVertical size={14} />}
                >
                  Actions
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <AdmitToIpdButton
                  encounterId={encounterId}
                  patientName={patientName}
                  asMenuItem
                  control={admitControl}
                />
                <GroupAppointmentModal patientId={patientId} asMenuItem />
                <Menu.Item leftSection={<IconPrinter size={14} />} onClick={openSummary}>
                  Print
                </Menu.Item>
                {canGenerateMrdCaseSheet && (
                  <Menu.Item
                    leftSection={<IconClipboardList size={14} />}
                    onClick={() => generateMrdCaseSheetMutation.mutate()}
                    disabled={generateMrdCaseSheetMutation.isPending}
                  >
                    {latestMrdCaseSheet ? "Update MRD" : "Send to MRD"}
                  </Menu.Item>
                )}
                {canViewMrdCaseSheets && latestMrdCaseSheet && (
                  <Menu.Item
                    leftSection={<IconArrowRight size={14} />}
                    onClick={() =>
                      navigate(`/mrd?packet_type=opd&encounter_id=${encounterId}#case-sheets`)
                    }
                  >
                    MRD Packet
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          </>
        }
      />
      <PatientBillingModal
        patientId={patientId}
        encounterId={encounterId}
        control={billingControl}
      />
      <EmergencyVisitModal patientId={patientId} control={emergencyControl} />
      <CampRegistrationModal
        patientId={patientId}
        patientName={patientName}
        control={campControl}
      />
      <Modal opened={patientPeekOpened} onClose={patientPeek.close} title="Patient" size="lg">
        <Stack gap="sm">
          <PatientContextSummary patientId={patientId} />
          <Button
            tone="primary"
            size="xs"
            onClick={() => {
              patientPeek.close();
              navigate(`/patients/${patientId}`);
            }}
          >
            Open full patient record
          </Button>
        </Stack>
      </Modal>

      <Tabs
        value={activeEncounterTab}
        onChange={setActiveEncounterTab}
        keepMounted={false}
        orientation="vertical"
        classNames={{
          tab: railStyles.railTab,
          tabSection: railStyles.railTabSection,
          tabLabel: railStyles.railTabLabel,
        }}
        style={{ display: "flex", height: "100%", width: "100%", minWidth: 0, minHeight: 0 }}
      >
        {/* ── Left Sidebar: Patient + Nav ── */}
        <div
          style={{
            width: 240,
            flexShrink: 0,
            minHeight: 0,
            overflowY: "auto",
            borderRight: "1px solid var(--mb-border-subtle)",
            padding: "10px 10px 28px",
            background: "var(--mb-bg-subtle)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Allergies */}
          {activeAllergies.length > 0 && (
            <Card padding="xs" mb="xs" radius="sm" style={{ background: "var(--mb-danger-bg)" }}>
              <Group gap={4} mb={4}>
                <IconAlertTriangle size={14} color="var(--mb-danger-fg)" />
                <Text size="xs" fw={700} c="danger">
                  Allergies
                </Text>
              </Group>
              <Group gap={4} wrap="wrap">
                {activeAllergies.map((a) => (
                  <Badge key={a.id} tone="danger" variant="filled" size="xs">
                    {a.allergen_name}
                  </Badge>
                ))}
              </Group>
            </Card>
          )}

          {/* Chronic Conditions */}
          {chronicConditions.length > 0 && (
            <Card padding="xs" mb="xs" radius="sm" style={{ background: "#fff" }}>
              <Group gap={4} mb={4}>
                <IconHeartbeat size={14} />
                <Text size="xs" fw={700} c="orange">
                  Conditions
                </Text>
              </Group>
              <Stack gap={2}>
                {chronicConditions.slice(0, 5).map((d) => (
                  <Text key={d.id} size="xs" c="dimmed">
                    {d.description}
                  </Text>
                ))}
              </Stack>
            </Card>
          )}

          {/* Clinical tabs — grouped for doctor workflow without hiding HMS modules */}
          <div
            style={{
              borderTop: "1px solid var(--mb-border-subtle)",
              paddingTop: 8,
              flex: 1,
              overflowY: "auto",
            }}
          >
            {[
              {
                label: "Clinical workup",
                tabs: [
                  { value: "vitals", icon: <IconHeartbeat size={14} />, label: "Vitals" },
                  {
                    value: "consultation",
                    icon: <IconNotebook size={14} />,
                    label: "Consultation",
                  },
                  { value: "history", icon: <IconHistory size={14} />, label: "History" },
                  { value: "ros", icon: <IconClipboardList size={14} />, label: "ROS" },
                  {
                    value: "physical-exam",
                    icon: <IconStethoscope size={14} />,
                    label: "Physical Exam",
                  },
                ],
              },
              {
                label: "Assessment & orders",
                tabs: [
                  { value: "diagnoses", icon: <IconStar size={14} />, label: "Diagnoses" },
                  {
                    value: "investigations",
                    icon: <IconFlask size={14} />,
                    label: "Investigations",
                  },
                  {
                    value: "procedures",
                    icon: <IconMedicalCross size={14} />,
                    label: "Procedures",
                  },
                  { value: "prescriptions", icon: <IconPill size={14} />, label: "Prescriptions" },
                  { value: "referrals", icon: <IconArrowRight size={14} />, label: "Referrals" },
                ],
              },
              {
                label: "Patient context",
                tabs: [
                  {
                    value: "rx-history",
                    icon: <IconClipboardList size={14} />,
                    label: "Rx History",
                  },
                  { value: "charts", icon: <IconChartLine size={14} />, label: "Charts" },
                  { value: "timeline", icon: <IconTimeline size={14} />, label: "Timeline" },
                ],
              },
              {
                label: "Closure",
                tabs: [
                  {
                    value: "certificates",
                    icon: <IconCertificate size={14} />,
                    label: "Certificates",
                  },
                  { value: "followup", icon: <IconCalendarPlus size={14} />, label: "Follow-up" },
                  { value: "reminders", icon: <IconNotebook size={14} />, label: "Reminders" },
                  { value: "consents", icon: <IconFileCheck size={14} />, label: "Consents" },
                ],
              },
              {
                label: "Support / admin",
                tabs: [
                  { value: "pre-auth", icon: <IconShieldCheck size={14} />, label: "Pre-Auth" },
                  { value: "docket", icon: <IconStar size={14} />, label: "Docket" },
                  {
                    value: "pharmacy-dispatch",
                    icon: <IconPill size={14} />,
                    label: "Pharmacy Dispatch",
                  },
                  { value: "feedback", icon: <IconMessage size={14} />, label: "Feedback" },
                ],
              },
            ].map((section) => (
              <div key={section.label} style={{ marginBottom: 6 }}>
                <Text
                  fw={700}
                  c="dimmed"
                  tt="uppercase"
                  mb={2}
                  px={4}
                  style={{ fontSize: 10, letterSpacing: "0.06em" }}
                >
                  {section.label}
                </Text>
                <Tabs.List
                  style={{ border: "none", display: "flex", flexDirection: "column", gap: 2 }}
                >
                  {section.tabs.map((tab) => (
                    <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
                      {tab.label}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Content panels ── */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "16px 24px",
          }}
        >
          <Tabs.Panel value="vitals">
            <VitalsTab encounterId={encounterId} patientId={patientId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="consultation">
            <ConsultationTab
              encounterId={encounterId}
              patientId={patientId}
              canUpdate={canUpdate}
            />
          </Tabs.Panel>
          <Tabs.Panel value="history">
            <HistoryTab encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="ros">
            <ROSTab encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="physical-exam">
            <PhysicalExamTab encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="diagnoses">
            <DiagnosesTab encounterId={encounterId} patientId={patientId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="investigations">
            <InvestigationsTab
              encounterId={encounterId}
              patientId={patientId}
              canUpdate={canUpdate}
            />
          </Tabs.Panel>
          <Tabs.Panel value="procedures">
            <ProceduresTab encounterId={encounterId} patientId={patientId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="prescriptions">
            <PrescriptionsTab
              encounterId={encounterId}
              patientId={patientId}
              patientName={patientName}
              uhid={uhid}
              canUpdate={canUpdate}
              allergies={activeAllergies.map((a) => a.allergen_name)}
            />
          </Tabs.Panel>
          <Tabs.Panel value="referrals">
            <ReferralsTab
              patientId={patientId}
              encounterId={encounterId}
              departmentId={departmentId}
              canUpdate={canUpdate}
            />
          </Tabs.Panel>
          <Tabs.Panel value="rx-history">
            <RxHistoryTab patientId={patientId} />
          </Tabs.Panel>
          <Tabs.Panel value="charts">
            <ChartsTab patientId={patientId} />
          </Tabs.Panel>
          <Tabs.Panel value="timeline">
            <TimelineTab patientId={patientId} />
          </Tabs.Panel>
          <Tabs.Panel value="certificates">
            <CertificatesTab
              patientId={patientId}
              encounterId={encounterId}
              canUpdate={canUpdate}
            />
          </Tabs.Panel>
          <Tabs.Panel value="followup">
            <FollowUpTab
              patientId={patientId}
              doctorId={doctorId}
              departmentId={departmentId}
              canUpdate={canUpdate}
            />
          </Tabs.Panel>
          <Tabs.Panel value="reminders">
            <RemindersTab patientId={patientId} encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="feedback">
            <FeedbackTab patientId={patientId} encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="consents">
            <ConsentsTab patientId={patientId} encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="pre-auth">
            <PreAuthTab patientId={patientId} encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="docket">
            <DocketTab />
          </Tabs.Panel>
          <Tabs.Panel value="pharmacy-dispatch">
            <PharmacyDispatchTab encounterId={encounterId} />
          </Tabs.Panel>
        </div>
      </Tabs>
      <OrderBasketWorkspace
        opened={basketOpened}
        onClose={closeOrderBasket}
        encounterId={encounterId}
        patientId={patientId}
        activeTab={basketTab}
        onActiveTabChange={changeOrderBasketTab}
        onSigned={() => {
          void queryClient.invalidateQueries({ queryKey: ["lab-orders", encounterId] });
          void queryClient.invalidateQueries({ queryKey: ["prescriptions", encounterId] });
          void queryClient.invalidateQueries({ queryKey: ["opd-pharmacy-dispatch", encounterId] });
          void queryClient.invalidateQueries({ queryKey: ["patient-invoices", patientId] });
          void queryClient.invalidateQueries({ queryKey: ["patient-dicom-studies", patientId] });
        }}
      />
    </>
  );
}
