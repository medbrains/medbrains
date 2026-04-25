import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Timeline,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { LineChart } from "@mantine/charts";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCalendarPlus,
  IconCertificate,
  IconChartLine,
  IconCheck,
  IconClipboardList,
  IconEye,
  IconFileCheck,
  IconFlask,
  IconHeartbeat,
  IconHistory,
  IconMedicalCross,
  IconMessage,
  IconNotebook,
  IconPhone,
  IconPill,
  IconPlayerPlay,
  IconPlus,
  IconPrinter,
  IconStar,
  IconStethoscope,
  IconTimeline,
  IconTransferIn,
  IconCalendarStats,
  IconUser,
  IconUserOff,
  IconShieldCheck,
  IconTrash,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type {
  AdmitFromOpdRequest,
  AvailableBed,
  AvailableSlot,
  BookAppointmentGroupRequest,
  BookAppointmentRequest,
  CertificateType,
  ConsultationTemplate,
  ProcedureConsentType,
  Consultation,
  CreateConsultationRequest,
  CreateConsentRequest,
  CreateDiagnosisRequest,
  CreateEncounterRequest,
  DepartmentRow,
  CreateFeedbackRequest,
  CreateLabOrderRequest,
  CreateMedicalCertificateRequest,
  CreatePrescriptionRequest,
  CreateProcedureOrderRequest,
  CreateReferralRequest,
  CreateReminderRequest,
  CreateVitalRequest,
  Diagnosis,
  DoctorDocket,
  DuplicateOrderInfo,
  FamilyHistoryEntry,
  LabOrder,
  LabTestCatalog,
  MedicalCertificate,
  PastMedicalEntry,
  PastSurgicalEntry,
  PatientAllergy,
  PatientDiagnosisRow,
  PatientFeedback,
  PatientReminder,
  PatientVisitRow,
  PhysicalExamination,
  PrescriptionHistoryItem,
  PrescriptionWithItems,
  ProcedureCatalog,
  ProcedureConsent,
  ProcedureOrderWithName,
  QueueEntry,
  ReferralWithNames,
  ReminderType,
  ReviewOfSystems as ROSType,
  SocialHistory,
  UpdateConsultationRequest,
  Vital,
  VitalHistoryPoint,
  PreAuthorizationRequest as PreAuthReqType,
  CreatePreAuthRequest,
  PharmacyDispatchStatus as PharmacyDispatchStatusRow,
  ReferralTrackingRow,
  FollowupComplianceRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  ClinicalEventProvider,
  DataTable,
  DiagnosisPanel,
  PageHeader,
  PhysicalExamPanel,
  PrescriptionPrint,
  PrescriptionViews,
  PrescriptionWriter,
  ReviewOfSystems,
  SOAPNotes,
  StatusDot,
  StructuredHistory,
  VisitSummaryPrint,
  VitalsRecorder,
  useClinicalEmit,
  PatientSearchSelect,
  DoctorSearchSelect,
} from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

const statusColors: Record<string, string> = {
  waiting: "primary",
  called: "warning",
  in_consultation: "orange",
  completed: "success",
  no_show: "danger",
};

export function OpdPage() {
  useRequirePermission(P.OPD.QUEUE_LIST);

  return (
    <ClinicalEventProvider moduleCode="opd" contextCode="opd-queue">
      <OpdPageInner />
    </ClinicalEventProvider>
  );
}

function OpdPageInner() {
  const emit = useClinicalEmit();
  const canCreate = useHasPermission(P.OPD.VISIT_CREATE);
  const canManageToken = useHasPermission(P.OPD.TOKEN_MANAGE);
  const canUpdate = useHasPermission(P.OPD.VISIT_UPDATE);
  const currentUser = useAuthStore((s) => s.user);

  const queryClient = useQueryClient();
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterDeptId, setFilterDeptId] = useState<string | null>(null);
  const [myPatientsOnly, setMyPatientsOnly] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] =
    useDisclosure(false);
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);

  // Departments for filter dropdown
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.listDepartments(),
    staleTime: 600_000,
  });
  const deptOptions = (departments as DepartmentRow[])
    .filter((d) => d.department_type === "clinical" || d.department_type === "para_clinical")
    .map((d) => ({ value: d.id, label: d.name }));

  // Create encounter form state
  const [newPatientId, setNewPatientId] = useState("");
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newDoctorId, setNewDoctorId] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newVisitType, setNewVisitType] = useState<string | null>("walk_in");

  const queueParams: Record<string, string> = {};
  if (filterDate) {
    queueParams.date = filterDate;
  }
  if (filterStatus) {
    queueParams.status = filterStatus;
  }
  if (filterDeptId) {
    queueParams.department_id = filterDeptId;
  }
  if (myPatientsOnly && currentUser) {
    queueParams.doctor_id = currentUser.id;
  }

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["opd-queue", queueParams],
    queryFn: () => api.listQueue(queueParams),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateEncounterRequest) => api.createEncounter(data),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      notifications.show({ title: "Visit created", message: "Patient added to queue", color: "success" });
      emit("encounter.created", { patient_id: variables.patient_id, department_id: variables.department_id });
      closeCreate();
      setNewPatientId("");
      setNewDepartmentId("");
      setNewDoctorId("");
      setNewNotes("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create visit", color: "danger" });
    },
  });

  const callMutation = useMutation({
    mutationFn: (id: string) => api.callQueueEntry(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      emit("patient.called", { queue_entry_id: id });
    },
  });
  const startMutation = useMutation({
    mutationFn: (id: string) => api.startConsultation(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      emit("consultation.started", { queue_entry_id: id });
    },
  });
  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeQueueEntry(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      emit("encounter.completed", { queue_entry_id: id });
    },
  });
  const noShowMutation = useMutation({
    mutationFn: (id: string) => api.markNoShow(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["opd-queue"] }),
  });

  const columns = [
    {
      key: "token_number",
      label: "Token",
      render: (row: QueueEntry) => <Text fw={700}>T{String(row.token_number).padStart(3, "0")}</Text>,
    },
    {
      key: "patient_name",
      label: "Patient",
      render: (row: QueueEntry) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>{row.patient_name}</Text>
          <Text size="xs" c="dimmed">{row.uhid}</Text>
        </Stack>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: QueueEntry) => (
        <StatusDot color={statusColors[row.status] ?? "slate"} label={row.status.replace(/_/g, " ")} />
      ),
    },
    {
      key: "queue_date",
      label: "Date",
      render: (row: QueueEntry) => <Text size="sm">{row.queue_date}</Text>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: QueueEntry) => (
        <Group gap="xs">
          <Tooltip label="View details">
            <ActionIcon
              variant="subtle"
              onClick={() => {
                setSelectedEntry(row);
                openDetail();
              }}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {canManageToken && row.status === "waiting" && (
            <Tooltip label="Call patient">
              <ActionIcon variant="subtle" color="warning" onClick={() => callMutation.mutate(row.id)}>
                <IconPhone size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canManageToken && row.status === "called" && (
            <Tooltip label="Start consultation">
              <ActionIcon variant="subtle" color="orange" onClick={() => startMutation.mutate(row.id)}>
                <IconPlayerPlay size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canManageToken && row.status === "in_consultation" && (
            <Tooltip label="Complete">
              <ActionIcon variant="subtle" color="success" onClick={() => completeMutation.mutate(row.id)}>
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canManageToken && (row.status === "waiting" || row.status === "called") && (
            <Tooltip label="No show">
              <ActionIcon variant="subtle" color="danger" onClick={() => noShowMutation.mutate(row.id)}>
                <IconUserOff size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="OPD"
        subtitle="Outpatient department queue"
        icon={<IconStethoscope size={20} stroke={1.5} />}
        color="primary"
        actions={
          canCreate ? (
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              New Visit
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="queue">
        <Tabs.List mb="md">
          <Tabs.Tab value="queue" leftSection={<IconUsers size={16} />}>Queue</Tabs.Tab>
          <Tabs.Tab value="referral-tracking" leftSection={<IconTransferIn size={16} />}>Referral Tracking</Tabs.Tab>
          <Tabs.Tab value="followup-compliance" leftSection={<IconCalendarStats size={16} />}>Follow-up Compliance</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="queue">
          <Group mb="md">
            <TextInput
              placeholder="Date"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.currentTarget.value)}
              w={170}
            />
            <Select
              placeholder="Status"
              data={[
                { value: "waiting", label: "Waiting" },
                { value: "called", label: "Called" },
                { value: "in_consultation", label: "In Consultation" },
                { value: "completed", label: "Completed" },
                { value: "no_show", label: "No Show" },
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              clearable
              w={170}
            />
            <Select
              placeholder="Department"
              data={deptOptions}
              value={filterDeptId}
              onChange={setFilterDeptId}
              clearable
              searchable
              w={200}
            />
            <Switch
              label="My Patients"
              checked={myPatientsOnly}
              onChange={(e) => setMyPatientsOnly(e.currentTarget.checked)}
            />
            <WaitTimeBadge departmentId={filterDeptId ?? undefined} doctorId={myPatientsOnly && currentUser ? currentUser.id : undefined} />
          </Group>
          <DataTable columns={columns} data={queue} loading={isLoading} rowKey={(row) => row.id} />
        </Tabs.Panel>

        <Tabs.Panel value="referral-tracking">
          <ReferralTrackingTab />
        </Tabs.Panel>

        <Tabs.Panel value="followup-compliance">
          <FollowupComplianceTab />
        </Tabs.Panel>
      </Tabs>

      {/* Create encounter drawer */}
      <Drawer opened={createOpened} onClose={closeCreate} title="New OPD Visit" position="right" size="xl">
        <Stack>
          <Select
            label="Visit Type"
            data={[
              { value: "walk_in", label: "Walk-in" },
              { value: "booked", label: "Booked Appointment" },
              { value: "follow_up", label: "Follow-up" },
            ]}
            value={newVisitType}
            onChange={setNewVisitType}
            required
          />
          <PatientSearchSelect
            value={newPatientId}
            onChange={setNewPatientId}
            required
          />
          <Select
            label="Department"
            placeholder="Select department"
            data={deptOptions}
            value={newDepartmentId}
            onChange={(v) => setNewDepartmentId(v ?? "")}
            searchable
            required
          />
          <DoctorSearchSelect
            value={newDoctorId}
            onChange={setNewDoctorId}
          />
          <Textarea
            label="Notes"
            placeholder="Visit notes"
            value={newNotes}
            onChange={(e) => setNewNotes(e.currentTarget.value)}
          />
          <Button
            onClick={() =>
              createMutation.mutate({
                patient_id: newPatientId,
                department_id: newDepartmentId,
                doctor_id: newDoctorId || undefined,
                notes: newNotes || undefined,
                visit_type: newVisitType ?? undefined,
              })
            }
            loading={createMutation.isPending}
            disabled={!newPatientId.trim() || !newDepartmentId}
          >
            Create Visit
          </Button>
        </Stack>
      </Drawer>

      {/* Detail — full-width overlay */}
      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        position="right"
        size="100%"
        withCloseButton
        title={<Button variant="subtle" size="xs" onClick={closeDetail} leftSection={<IconArrowRight size={14} style={{ transform: "rotate(180deg)" }} />}>Back to Queue</Button>}
        styles={{ header: { padding: "6px 12px", minHeight: 36, borderBottom: "1px solid var(--fc-rule, #e7ebe8)" }, body: { padding: 0, height: "calc(100vh - 36px)", overflow: "hidden" } }}
      >
        {selectedEntry && (
          <EncounterDetail
            encounterId={selectedEntry.encounter_id}
            patientId={selectedEntry.patient_id}
            patientName={selectedEntry.patient_name}
            uhid={selectedEntry.uhid}
            doctorId={selectedEntry.doctor_id}
            departmentId={selectedEntry.department_id}
            canUpdate={canUpdate}
          />
        )}
      </Drawer>
    </div>
  );
}

// ── Encounter detail tabs ────────────────────────────────

function EncounterDetail({
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
  const [showSummary, setShowSummary] = useState(false);

  // Fetch all data for visit summary print
  const { data: vitals = [] } = useQuery({
    queryKey: ["vitals", encounterId],
    queryFn: () => api.listVitals(encounterId),
  });
  const { data: consultation } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => api.getConsultation(encounterId).catch(() => null),
  });
  const { data: diagnoses = [] } = useQuery({
    queryKey: ["diagnoses", encounterId],
    queryFn: () => api.listDiagnoses(encounterId),
  });
  const { data: prescriptions = [] } = useQuery({
    queryKey: ["prescriptions", encounterId],
    queryFn: () => api.listPrescriptions(encounterId),
  });
  const { data: labOrdersResponse } = useQuery({
    queryKey: ["lab-orders", encounterId],
    queryFn: () => api.listLabOrders({ encounter_id: encounterId }),
  });
  const { data: labCatalog = [] } = useQuery({
    queryKey: ["lab-catalog"],
    queryFn: () => api.listLabCatalog(),
  });
  const { data: hospitalSettings = [] } = useQuery({
    queryKey: ["tenant-settings", "general"],
    queryFn: () => api.getTenantSettings("general"),
    staleTime: 600_000,
  });

  // Allergy data
  const { data: allergies = [] } = useQuery({
    queryKey: ["patient-allergies", patientId],
    queryFn: () => api.listPatientAllergies(patientId),
  });
  const activeAllergies = (allergies as PatientAllergy[]).filter((a) => a.is_active);

  // Current medications (from most recent prescription)
  const { data: rxHistory = [] } = useQuery({
    queryKey: ["patient-rx-history", patientId],
    queryFn: () => api.listPatientPrescriptions(patientId),
    staleTime: 120_000,
  });
  const currentMeds = useMemo(() => {
    const history = rxHistory as PrescriptionHistoryItem[];
    const latest = history[0];
    if (!latest) return [];
    return latest.items;
  }, [rxHistory]);

  // Chronic conditions (unresolved diagnoses from past encounters)
  const { data: patientDiagnoses = [] } = useQuery({
    queryKey: ["patient-diagnoses", patientId],
    queryFn: () => api.listPatientDiagnoses(patientId),
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
      {showSummary && (
        <VisitSummaryPrint
          opened={showSummary}
          onClose={() => setShowSummary(false)}
          patientName={patientName}
          uhid={uhid}
          visitDate={new Date().toISOString()}
          hospitalName={getSetting("hospital_name")}
          hospitalAddress={getSetting("hospital_address")}
          hospitalPhone={getSetting("hospital_phone")}
          vitals={vitals as Vital[]}
          consultation={consultation as Consultation | null}
          diagnoses={diagnoses as Diagnosis[]}
          prescriptions={prescriptions as PrescriptionWithItems[]}
          labOrders={labOrdersResponse?.orders ?? []}
          labCatalog={labCatalog as LabTestCatalog[]}
        />
      )}

      <Tabs defaultValue="vitals" orientation="vertical" style={{ display: "flex", height: "100%" }}>
        {/* ── Left Sidebar: Patient + Nav ── */}
        <div style={{ width: 240, flexShrink: 0, overflowY: "auto", borderRight: "1px solid var(--fc-rule, #e7ebe8)", padding: "12px", background: "var(--fc-panel, #f7f8f6)", display: "flex", flexDirection: "column" }}>
          {/* Patient card */}
          <Card padding="sm" mb="xs" bg="var(--fc-canvas, #fff)" withBorder>
            <Group gap="sm">
              <ThemeIcon size="lg" radius="xl" color="primary" variant="light">
                <IconUser size={18} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={700}>{patientName}</Text>
                <Text size="xs" c="dimmed" ff="var(--font-mono, monospace)">{uhid}</Text>
              </div>
            </Group>
          </Card>

          {/* Allergies */}
          {activeAllergies.length > 0 && (
            <Card padding="xs" mb="xs" bg="var(--mb-danger-bg, #fff1f2)" withBorder style={{ borderColor: "var(--mb-danger-accent, #f43f5e)" }}>
              <Group gap={4} mb={4}>
                <IconAlertTriangle size={14} color="var(--mb-danger-accent, #f43f5e)" />
                <Text size="xs" fw={700} c="danger">Allergies</Text>
              </Group>
              <Group gap={4} wrap="wrap">
                {activeAllergies.map((a) => (
                  <Badge key={a.id} color="danger" variant="filled" size="xs">{a.allergen_name}</Badge>
                ))}
              </Group>
            </Card>
          )}

          {/* Current Medications */}
          {currentMeds.length > 0 && (
            <Card padding="xs" mb="xs" withBorder>
              <Group gap={4} mb={4}>
                <IconPill size={14} />
                <Text size="xs" fw={700} c="primary">Medications</Text>
              </Group>
              <Stack gap={2}>
                {currentMeds.slice(0, 6).map((m) => (
                  <Text key={m.id} size="xs" c="dimmed">{m.drug_name} — {m.dosage}</Text>
                ))}
              </Stack>
            </Card>
          )}

          {/* Quick Actions */}
          <Stack gap={4} mb="xs">
            <Button variant="light" size="xs" fullWidth leftSection={<IconPrinter size={14} />} onClick={() => setShowSummary(true)}>Print Summary</Button>
            <AdmitToIpdButton encounterId={encounterId} patientName={patientName} />
            <GroupAppointmentModal patientId={patientId} />
          </Stack>

          {/* Chronic Conditions */}
          {chronicConditions.length > 0 && (
            <Card padding="xs" mb="xs" withBorder>
              <Group gap={4} mb={4}>
                <IconHeartbeat size={14} />
                <Text size="xs" fw={700} c="orange">Conditions</Text>
              </Group>
              <Stack gap={2}>
                {chronicConditions.slice(0, 5).map((d) => (
                  <Text key={d.id} size="xs" c="dimmed">{d.description}</Text>
                ))}
              </Stack>
            </Card>
          )}

          {/* Clinical tabs — vertical nav */}
          <div style={{ borderTop: "1px solid var(--fc-rule, #e7ebe8)", paddingTop: 8, flex: 1, overflowY: "auto" }}>
          <Tabs.List style={{ border: "none" }}>
        <Tabs.Tab value="vitals" leftSection={<IconHeartbeat size={14} />}>Vitals</Tabs.Tab>
        <Tabs.Tab value="consultation" leftSection={<IconNotebook size={14} />}>Consultation</Tabs.Tab>
        <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>History</Tabs.Tab>
        <Tabs.Tab value="ros" leftSection={<IconClipboardList size={14} />}>ROS</Tabs.Tab>
        <Tabs.Tab value="physical-exam" leftSection={<IconStethoscope size={14} />}>Physical Exam</Tabs.Tab>
        <Tabs.Tab value="diagnoses" leftSection={<IconStar size={14} />}>Diagnoses</Tabs.Tab>
        <Tabs.Tab value="investigations" leftSection={<IconFlask size={14} />}>Investigations</Tabs.Tab>
        <Tabs.Tab value="procedures" leftSection={<IconMedicalCross size={14} />}>Procedures</Tabs.Tab>
        <Tabs.Tab value="prescriptions" leftSection={<IconPill size={14} />}>Prescriptions</Tabs.Tab>
        <Tabs.Tab value="referrals" leftSection={<IconArrowRight size={14} />}>
          Referrals
        </Tabs.Tab>
        <Tabs.Tab value="rx-history" leftSection={<IconClipboardList size={14} />}>
          Rx History
        </Tabs.Tab>
        <Tabs.Tab value="charts" leftSection={<IconChartLine size={14} />}>
          Charts
        </Tabs.Tab>
        <Tabs.Tab value="timeline" leftSection={<IconTimeline size={14} />}>
          Timeline
        </Tabs.Tab>
        <Tabs.Tab value="certificates" leftSection={<IconCertificate size={14} />}>
          Certificates
        </Tabs.Tab>
        <Tabs.Tab value="followup" leftSection={<IconCalendarPlus size={14} />}>
          Follow-up
        </Tabs.Tab>
        <Tabs.Tab value="reminders" leftSection={<IconNotebook size={14} />}>
          Reminders
        </Tabs.Tab>
        <Tabs.Tab value="feedback" leftSection={<IconMessage size={14} />}>
          Feedback
        </Tabs.Tab>
        <Tabs.Tab value="consents" leftSection={<IconFileCheck size={14} />}>
          Consents
        </Tabs.Tab>
        <Tabs.Tab value="pre-auth" leftSection={<IconShieldCheck size={14} />}>
          Pre-Auth
        </Tabs.Tab>
        <Tabs.Tab value="docket" leftSection={<IconStar size={14} />}>
          Docket
        </Tabs.Tab>
        <Tabs.Tab value="pharmacy-dispatch" leftSection={<IconPill size={14} />}>
          Pharmacy Dispatch
        </Tabs.Tab>
      </Tabs.List>
          </div>
        </div>

        {/* ── Right: Content panels ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
      <Tabs.Panel value="vitals">
        <VitalsTab encounterId={encounterId} canUpdate={canUpdate} />
      </Tabs.Panel>
      <Tabs.Panel value="consultation">
        <ConsultationTab encounterId={encounterId} canUpdate={canUpdate} />
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
        <DiagnosesTab encounterId={encounterId} canUpdate={canUpdate} />
      </Tabs.Panel>
      <Tabs.Panel value="investigations">
        <InvestigationsTab encounterId={encounterId} patientId={patientId} canUpdate={canUpdate} />
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
        <ReferralsTab patientId={patientId} encounterId={encounterId} departmentId={departmentId} canUpdate={canUpdate} />
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
        <CertificatesTab patientId={patientId} encounterId={encounterId} canUpdate={canUpdate} />
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
    </>
  );
}

// ── Pharmacy Dispatch Status ──────────────────────────────

function PharmacyDispatchTab({ encounterId }: { encounterId: string }) {
  const { data: dispatch = [], isLoading } = useQuery({
    queryKey: ["opd-pharmacy-dispatch", encounterId],
    queryFn: () => api.opdPharmacyDispatchStatus(encounterId),
  });

  const dispatchStatusColors: Record<string, string> = {
    pending: "slate",
    partial: "warning",
    dispensed: "success",
    cancelled: "danger",
  };

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      render: (row: PharmacyDispatchStatusRow) => <Text size="sm" fw={500}>{row.drug_name}</Text>,
    },
    {
      key: "quantity_ordered",
      label: "Ordered",
      render: (row: PharmacyDispatchStatusRow) => <Text size="sm">{row.quantity_ordered}</Text>,
    },
    {
      key: "quantity_dispensed",
      label: "Dispensed",
      render: (row: PharmacyDispatchStatusRow) => <Text size="sm">{row.quantity_dispensed}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyDispatchStatusRow) => (
        <Badge color={dispatchStatusColors[row.status] ?? "slate"} variant="filled" size="sm">
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Text fw={600} size="sm">Pharmacy dispatch status for this visit</Text>
      <DataTable
        columns={columns}
        data={dispatch}
        loading={isLoading}
        rowKey={(row) => `${row.prescription_id}-${row.drug_name}`}
      />
      {!isLoading && dispatch.length === 0 && (
        <Text size="sm" c="dimmed">No prescriptions dispatched for this visit.</Text>
      )}
    </Stack>
  );
}

// ── Vitals ───────────────────────────────────────────────

function VitalsTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: vitals = [] } = useQuery({
    queryKey: ["vitals", encounterId],
    queryFn: () => api.listVitals(encounterId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateVitalRequest) => api.createVital(encounterId, data),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["vitals", encounterId] });
      emit("vitals.recorded", { encounter_id: encounterId, ...variables });
      setShowForm(false);
    },
  });

  return (
    <Stack>
      {canUpdate && !showForm && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(true)}>
            Record Vitals
          </Button>
        </Group>
      )}
      {showForm && (
        <VitalsRecorder
          onSubmit={(data) => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
          onCancel={() => setShowForm(false)}
        />
      )}
      {vitals.length > 0 && (
        <Timeline active={0} bulletSize={20} lineWidth={2} color="primary" styles={{ itemBody: { paddingTop: 0 }, item: { marginBottom: 4 } }}>
          {vitals.map((v: Vital, idx: number) => {
            const prev = vitals[idx + 1] as Vital | undefined;
            const trend = (curr: number | null, prevVal: number | null) => {
              if (!curr || !prevVal) return "";
              if (curr > prevVal) return " ↑";
              if (curr < prevVal) return " ↓";
              return " →";
            };
            return (
              <Timeline.Item
                key={v.id}
                bullet={<IconHeartbeat size={10} />}
                title={
                  <Group gap="xs">
                    <Text size="xs" fw={600}>{new Date(v.created_at).toLocaleString()}</Text>
                    {idx === 0 && <Badge size="xs" color="success" variant="light">Latest</Badge>}
                  </Group>
                }
              >
                <Group gap="md" mt={4} wrap="wrap">
                  {v.temperature != null && (
                    <Badge variant="light" color={Number(v.temperature) > 37.5 ? "danger" : "primary"} size="sm">
                      🌡 {v.temperature}°C{trend(Number(v.temperature), prev?.temperature ? Number(prev.temperature) : null)}
                    </Badge>
                  )}
                  {v.pulse != null && (
                    <Badge variant="light" color={Number(v.pulse) > 100 ? "danger" : Number(v.pulse) < 60 ? "warning" : "primary"} size="sm">
                      ❤ {v.pulse} bpm{trend(Number(v.pulse), prev?.pulse ? Number(prev.pulse) : null)}
                    </Badge>
                  )}
                  {v.systolic_bp != null && v.diastolic_bp != null && (
                    <Badge variant="light" color={Number(v.systolic_bp) > 140 ? "danger" : Number(v.systolic_bp) < 90 ? "warning" : "primary"} size="sm">
                      🩸 {v.systolic_bp}/{v.diastolic_bp} mmHg
                    </Badge>
                  )}
                  {v.spo2 != null && (
                    <Badge variant="light" color={Number(v.spo2) < 94 ? "danger" : "primary"} size="sm">
                      💨 SpO₂ {v.spo2}%
                    </Badge>
                  )}
                  {v.respiratory_rate != null && (
                    <Badge variant="light" size="sm">
                      🫁 RR {v.respiratory_rate}
                    </Badge>
                  )}
                  {v.weight_kg != null && (
                    <Badge variant="outline" size="sm">⚖ {v.weight_kg} kg</Badge>
                  )}
                  {v.bmi != null && (
                    <Badge variant="outline" size="sm">BMI {v.bmi}</Badge>
                  )}
                </Group>
              </Timeline.Item>
            );
          })}
        </Timeline>
      )}
    </Stack>
  );
}

// ── Consultation ─────────────────────────────────────────

function ConsultationTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [templateId, setTemplateId] = useState<string | null>(null);

  const { data: consultation } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => api.getConsultation(encounterId).catch(() => null),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["consultation-templates"],
    queryFn: () => api.listConsultationTemplates(),
    staleTime: 300_000,
  });

  const templateOptions = (templates as ConsultationTemplate[]).map((t) => ({
    value: t.id,
    label: `${t.name}${t.specialty ? ` (${t.specialty})` : ""}`,
  }));

  const selectedTemplate = useMemo(() => {
    if (!templateId) return null;
    return (templates as ConsultationTemplate[]).find((t) => t.id === templateId) ?? null;
  }, [templates, templateId]);

  const templateDefaults = useMemo((): Partial<Consultation> | undefined => {
    if (!selectedTemplate || consultation) return undefined;
    return {
      chief_complaint: selectedTemplate.chief_complaints.join(", ") || null,
      plan: selectedTemplate.default_plan ?? null,
    };
  }, [selectedTemplate, consultation]);

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationRequest) => api.createConsultation(encounterId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] });
      emit("consultation.saved", { encounter_id: encounterId });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateConsultationRequest) =>
      api.updateConsultation(encounterId, (consultation as Consultation).id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] });
      emit("consultation.saved", { encounter_id: encounterId });
    },
  });

  const handleSubmit = (data: CreateConsultationRequest | UpdateConsultationRequest) => {
    if (consultation) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data as CreateConsultationRequest);
    }
  };

  if (!canUpdate && !consultation) {
    return <Text c="dimmed" size="sm">No consultation recorded yet.</Text>;
  }

  return (
    <Stack gap="sm">
      {!consultation && canUpdate && templateOptions.length > 0 && (
        <Select
          label="Load from template"
          placeholder="Select a consultation template..."
          data={templateOptions}
          value={templateId}
          onChange={setTemplateId}
          clearable
          searchable
          size="xs"
          maw={400}
        />
      )}
      <SOAPNotes
        key={templateId ?? "default"}
        onSubmit={handleSubmit}
        defaultValues={consultation ? (consultation as Consultation) : templateDefaults}
        submitLabel={consultation ? "Update Notes" : "Save Notes"}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </Stack>
  );
}

// ── Structured History ───────────────────────────────────

function HistoryTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const queryClient = useQueryClient();

  const { data: consultation } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => api.getConsultation(encounterId).catch(() => null),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationRequest) => api.createConsultation(encounterId, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateConsultationRequest) =>
      api.updateConsultation(encounterId, (consultation as Consultation).id, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const handleUpdate = (data: Partial<UpdateConsultationRequest>) => {
    if (consultation) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data as CreateConsultationRequest);
    }
  };

  const c = consultation as Consultation | null;

  return (
    <StructuredHistory
      hpi={c?.hpi ?? ""}
      pastMedical={(c?.past_medical_history as PastMedicalEntry[] | null) ?? []}
      pastSurgical={(c?.past_surgical_history as PastSurgicalEntry[] | null) ?? []}
      familyHistory={(c?.family_history as FamilyHistoryEntry[] | null) ?? []}
      socialHistory={(c?.social_history as SocialHistory | null) ?? {}}
      canUpdate={canUpdate}
      onUpdate={handleUpdate}
    />
  );
}

// ── Review of Systems ────────────────────────────────────

function ROSTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const [localRos, setLocalRos] = useState<ROSType>({});
  const [dirty, setDirty] = useState(false);

  const { data: consultation } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => api.getConsultation(encounterId).catch(() => null),
  });

  // Sync server data to local state when loaded
  const c = consultation as Consultation | null;
  const serverRos = (c?.review_of_systems as ROSType | null) ?? {};

  // Initialize local state from server (only when not dirty)
  useState(() => { if (!dirty) setLocalRos(serverRos); });

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationRequest) => api.createConsultation(encounterId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] });
      setDirty(false);
      notifications.show({ title: "Saved", message: "Review of Systems saved", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to save ROS", color: "danger" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateConsultationRequest) =>
      api.updateConsultation(encounterId, (consultation as Consultation).id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] });
      setDirty(false);
      notifications.show({ title: "Saved", message: "Review of Systems updated", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to update ROS", color: "danger" }),
  });

  const handleChange = (ros: ROSType) => {
    setLocalRos(ros);
    setDirty(true);
  };

  const handleSave = () => {
    if (consultation) {
      updateMutation.mutate({ review_of_systems: localRos });
    } else {
      createMutation.mutate({ review_of_systems: localRos });
    }
  };

  return (
    <Stack>
      <ReviewOfSystems
        data={dirty ? localRos : serverRos}
        canUpdate={canUpdate}
        onUpdate={handleChange}
      />
      {canUpdate && (
        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!dirty}
          >
            Save Review of Systems
          </Button>
        </Group>
      )}
    </Stack>
  );
}

// ── Physical Examination ─────────────────────────────────

function PhysicalExamTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const queryClient = useQueryClient();

  const { data: consultation } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => api.getConsultation(encounterId).catch(() => null),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationRequest) => api.createConsultation(encounterId, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateConsultationRequest) =>
      api.updateConsultation(encounterId, (consultation as Consultation).id, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const handleUpdate = (exam: PhysicalExamination, generalAppearance?: string) => {
    const data: UpdateConsultationRequest = { physical_examination: exam };
    if (generalAppearance !== undefined) data.general_appearance = generalAppearance;
    if (consultation) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data as CreateConsultationRequest);
    }
  };

  const c = consultation as Consultation | null;

  return (
    <PhysicalExamPanel
      data={(c?.physical_examination as PhysicalExamination | null) ?? {}}
      generalAppearance={c?.general_appearance ?? ""}
      canUpdate={canUpdate}
      onUpdate={handleUpdate}
    />
  );
}

// ── Diagnoses ────────────────────────────────────────────

function DiagnosesTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const queryClient = useQueryClient();

  const { data: diagnoses = [] } = useQuery({
    queryKey: ["diagnoses", encounterId],
    queryFn: () => api.listDiagnoses(encounterId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDiagnosisRequest) => api.createDiagnosis(encounterId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["diagnoses", encounterId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDiagnosis(encounterId, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["diagnoses", encounterId] }),
  });

  return (
    <DiagnosisPanel
      encounterId={encounterId}
      diagnoses={diagnoses as Diagnosis[]}
      canUpdate={canUpdate}
      onAdd={(data) => createMutation.mutate(data)}
      onDelete={(id) => deleteMutation.mutate(id)}
      isAdding={createMutation.isPending}
    />
  );
}

// ── Investigations ───────────────────────────────────────

const LAB_STATUS_COLORS: Record<string, string> = {
  ordered: "primary",
  sample_collected: "info",
  processing: "orange",
  completed: "success",
  verified: "teal",
  cancelled: "danger",
};

const LAB_PRIORITY_COLORS: Record<string, string> = {
  routine: "slate",
  urgent: "orange",
  stat: "danger",
};

function InvestigationsTab({
  encounterId,
  patientId,
  canUpdate,
}: {
  encounterId: string;
  patientId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>("routine");
  const [notes, setNotes] = useState("");
  const [labDupeWarning, setLabDupeWarning] = useState<DuplicateOrderInfo[]>([]);

  const { data: catalog = [] } = useQuery({
    queryKey: ["lab-catalog"],
    queryFn: () => api.listLabCatalog(),
  });

  const { data: ordersResponse } = useQuery({
    queryKey: ["lab-orders", encounterId],
    queryFn: () => api.listLabOrders({ encounter_id: encounterId }),
  });
  const orders = ordersResponse?.orders ?? [];

  const testOptions = catalog
    .filter((t: LabTestCatalog) => t.is_active)
    .map((t: LabTestCatalog) => ({
      value: t.id,
      label: `${t.code} — ${t.name}${t.sample_type ? ` (${t.sample_type})` : ""}`,
    }));

  const createMutation = useMutation({
    mutationFn: (data: CreateLabOrderRequest) => api.createLabOrder(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders", encounterId] });
      notifications.show({ title: "Investigation ordered", message: "Lab order placed successfully", color: "success" });
      emit("lab.ordered", { encounter_id: encounterId, patient_id: patientId });
      setSelectedTestId(null);
      setPriority("routine");
      setNotes("");
      setLabDupeWarning([]);
      setShowForm(false);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to place lab order", color: "danger" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelLabOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders", encounterId] });
      notifications.show({ title: "Order cancelled", message: "Lab order has been cancelled", color: "warning" });
    },
  });

  const handleOrder = () => {
    if (!selectedTestId) return;
    createMutation.mutate({
      patient_id: patientId,
      encounter_id: encounterId,
      test_id: selectedTestId,
      priority: (priority as CreateLabOrderRequest["priority"]) ?? undefined,
      notes: notes.trim() || undefined,
    });
  };

  const getTestName = (testId: string) => {
    const test = catalog.find((t: LabTestCatalog) => t.id === testId);
    return test ? `${test.code} — ${test.name}` : testId;
  };

  return (
    <Stack>
      {canUpdate && !showForm && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(true)}>
            Order Investigation
          </Button>
        </Group>
      )}

      {showForm && (
        <Card padding="sm" radius="md" withBorder>
          <Stack gap="xs">
            <Select
              label="Lab Test"
              placeholder="Search tests..."
              data={testOptions}
              value={selectedTestId}
              onChange={async (testId) => {
                setSelectedTestId(testId);
                setLabDupeWarning([]);
                if (testId) {
                  try {
                    const dupes = await api.checkDuplicateOrders({ patient_id: patientId, test_id: testId });
                    if (dupes.length > 0) setLabDupeWarning(dupes);
                  } catch { /* ignore */ }
                }
              }}
              searchable
              nothingFoundMessage="No tests found"
              required
            />
            {labDupeWarning.length > 0 && (
              <Alert icon={<IconAlertTriangle size={14} />} color="warning" variant="light" title="Duplicate Warning">
                <Text size="xs">
                  This test was already ordered {labDupeWarning.length} time(s) in the last 24 hours.
                  ({labDupeWarning.map((d) => d.status).join(", ")})
                </Text>
              </Alert>
            )}
            <Group gap="xs" grow>
              <Select
                label="Priority"
                data={[
                  { value: "routine", label: "Routine" },
                  { value: "urgent", label: "Urgent" },
                  { value: "stat", label: "STAT" },
                ]}
                value={priority}
                onChange={setPriority}
              />
            </Group>
            <Textarea
              label="Clinical Notes"
              placeholder="Reason for investigation, clinical context..."
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={4}
            />
            <Group justify="flex-end" gap="xs">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setSelectedTestId(null);
                  setNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                leftSection={<IconFlask size={14} />}
                onClick={handleOrder}
                loading={createMutation.isPending}
                disabled={!selectedTestId}
              >
                Place Order
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {orders.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Test</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ordered</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orders.map((order: LabOrder) => (
              <Table.Tr key={order.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>{getTestName(order.test_id)}</Text>
                  {order.notes && (
                    <Text size="xs" c="dimmed">{order.notes}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" color={LAB_PRIORITY_COLORS[order.priority] ?? "slate"}>
                    {order.priority.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light" color={LAB_STATUS_COLORS[order.status] ?? "slate"}>
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">{new Date(order.created_at).toLocaleString()}</Text>
                </Table.Td>
                <Table.Td>
                  {canUpdate && (order.status === "ordered" || order.status === "sample_collected") && (
                    <Tooltip label="Cancel order">
                      <ActionIcon
                        variant="subtle"
                        color="danger"
                        size="xs"
                        onClick={() => cancelMutation.mutate(order.id)}
                        loading={cancelMutation.isPending}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {!showForm && orders.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No investigations ordered yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Follow-up Scheduling ─────────────────────────────────

function FollowUpTab({
  patientId,
  doctorId,
  departmentId,
  canUpdate,
}: {
  patientId: string;
  doctorId: string | null;
  departmentId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [booked, setBooked] = useState(false);

  // Get available slots when date is set and doctor is known
  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ["available-slots", doctorId, selectedDate],
    queryFn: () => api.getAvailableSlots(doctorId as string, selectedDate),
    enabled: Boolean(doctorId) && Boolean(selectedDate),
  });

  const availableSlots = slots.filter((s: AvailableSlot) => s.is_available);
  const slotOptions = availableSlots.map((s: AvailableSlot) => ({
    value: `${s.start_time}|${s.end_time}`,
    label: `${s.start_time} – ${s.end_time} (${s.max_patients - s.booked_count} available)`,
  }));

  const bookMutation = useMutation({
    mutationFn: (data: BookAppointmentRequest) => api.bookAppointment(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      notifications.show({
        title: "Follow-up scheduled",
        message: `Appointment booked for ${selectedDate}`,
        color: "success",
      });
      emit("followup.scheduled", { patient_id: patientId, date: selectedDate });
      setBooked(true);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to book follow-up", color: "danger" });
    },
  });

  const handleBook = () => {
    if (!doctorId || !selectedSlot || !selectedDate) return;
    const parts = selectedSlot.split("|");
    bookMutation.mutate({
      patient_id: patientId,
      doctor_id: doctorId,
      department_id: departmentId,
      appointment_date: selectedDate,
      slot_start: parts[0] ?? "",
      slot_end: parts[1] ?? "",
      appointment_type: "follow_up",
      reason: reason.trim() || undefined,
    });
  };

  // Calculate min date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  if (!doctorId) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No doctor assigned to this encounter. Assign a doctor to enable follow-up scheduling.
      </Text>
    );
  }

  if (booked) {
    return (
      <Card padding="md" radius="md" withBorder>
        <Stack align="center" gap="sm" py="md">
          <IconCheck size={40} color="var(--mantine-color-green-6)" />
          <Text fw={600} size="lg">Follow-up Scheduled</Text>
          <Text size="sm" c="dimmed">
            Appointment booked for {selectedDate}
          </Text>
          <Button variant="subtle" size="sm" onClick={() => setBooked(false)}>
            Schedule Another
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack>
      {canUpdate ? (
        <Card padding="sm" radius="md" withBorder>
          <Stack gap="sm">
            <Text size="sm" fw={600}>Schedule Follow-up Appointment</Text>
            <TextInput
              label="Follow-up Date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.currentTarget.value);
                setSelectedSlot(null);
              }}
              min={minDate}
              required
            />
            {selectedDate && (
              loadingSlots ? (
                <Text size="sm" c="dimmed">Loading available slots...</Text>
              ) : slotOptions.length > 0 ? (
                <Select
                  label="Available Slot"
                  placeholder="Select a time slot"
                  data={slotOptions}
                  value={selectedSlot}
                  onChange={setSelectedSlot}
                  required
                />
              ) : (
                <Text size="sm" c="orange">
                  No available slots on this date. Try a different date.
                </Text>
              )
            )}
            <Textarea
              label="Reason for Follow-up"
              placeholder="Post-op review, lab result review, medication adjustment..."
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={3}
            />
            <Group justify="flex-end">
              <Button
                size="sm"
                leftSection={<IconCalendarPlus size={14} />}
                onClick={handleBook}
                loading={bookMutation.isPending}
                disabled={!selectedDate || !selectedSlot}
              >
                Book Follow-up
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : (
        <Text size="sm" c="dimmed" ta="center" py="md">
          You do not have permission to schedule follow-up appointments.
        </Text>
      )}
    </Stack>
  );
}

// ── Prescriptions ────────────────────────────────────────

function PrescriptionsTab({
  encounterId,
  patientId,
  patientName,
  uhid,
  canUpdate,
  allergies = [],
}: {
  encounterId: string;
  patientId: string;
  patientName: string;
  uhid: string;
  canUpdate: boolean;
  allergies?: string[];
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [printRx, setPrintRx] = useState<PrescriptionWithItems | null>(null);

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["prescriptions", encounterId],
    queryFn: () => api.listPrescriptions(encounterId),
  });

  const { data: hospitalSettings = [] } = useQuery({
    queryKey: ["tenant-settings", "general"],
    queryFn: () => api.getTenantSettings("general"),
    staleTime: 600_000,
  });

  const getSetting = (key: string) => {
    const row = hospitalSettings.find((s) => s.key === key);
    return row ? String(row.value) : undefined;
  };

  const createMutation = useMutation({
    mutationFn: (data: CreatePrescriptionRequest) => api.createPrescription(encounterId, data),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["prescriptions", encounterId] });
      emit("prescription.created", { encounter_id: encounterId, item_count: variables.items.length });
    },
  });

  const handleSendToPharmacy = (rxId: string) => {
    emit("prescription.sent_to_pharmacy", { prescription_id: rxId, patient_id: patientId });
    notifications.show({
      title: "Sent to Pharmacy",
      message: "Prescription dispatched to pharmacy queue",
      color: "teal",
    });
  };

  return (
    <>
      <PrescriptionWriter
        encounterId={encounterId}
        patientId={patientId}
        prescriptions={prescriptions as PrescriptionWithItems[]}
        canUpdate={canUpdate}
        onSave={(data) => createMutation.mutate(data)}
        isSaving={createMutation.isPending}
        onPrint={(rx) => setPrintRx(rx)}
        onSendToPharmacy={handleSendToPharmacy}
      />
      {/* 4-view prescription display — Prose, Timeline, Dose Calc, Rules */}
      {(prescriptions as PrescriptionWithItems[]).length > 0 && (
        <PrescriptionViews
          prescriptions={prescriptions as PrescriptionWithItems[]}
          patientName={patientName}
          uhid={uhid}
          allergies={allergies}
        />
      )}
      {printRx && (
        <PrescriptionPrint
          opened={Boolean(printRx)}
          onClose={() => setPrintRx(null)}
          prescription={printRx}
          patientName={patientName}
          uhid={uhid}
          hospitalName={getSetting("hospital_name")}
          hospitalAddress={getSetting("hospital_address")}
          hospitalPhone={getSetting("hospital_phone")}
        />
      )}
    </>
  );
}

// ── Rx History ──────────────────────────────────────────

function RxHistoryTab({ patientId }: { patientId: string }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: () => api.listPatientPrescriptions(patientId),
  });

  if (isLoading) {
    return <Text size="sm" c="dimmed">Loading prescription history...</Text>;
  }

  if (history.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No previous prescriptions found for this patient.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {(history as PrescriptionHistoryItem[]).map((h) => (
        <Card key={h.prescription.id} padding="sm" radius="md" withBorder>
          <Group gap={8} mb="xs">
            <Badge size="xs" variant="light">
              {new Date(h.encounter_date).toLocaleDateString()}
            </Badge>
            {h.doctor_name && (
              <Text size="xs" c="dimmed">Dr. {h.doctor_name}</Text>
            )}
            {h.prescription.notes && (
              <Text size="xs" c="dimmed" fs="italic">— {h.prescription.notes}</Text>
            )}
          </Group>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Drug</Table.Th>
                <Table.Th>Dosage</Table.Th>
                <Table.Th>Freq</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Route</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {h.items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td><Text size="sm" fw={500}>{item.drug_name}</Text></Table.Td>
                  <Table.Td>{item.dosage}</Table.Td>
                  <Table.Td><Badge size="xs" variant="light">{item.frequency}</Badge></Table.Td>
                  <Table.Td>{item.duration}</Table.Td>
                  <Table.Td>{item.route ?? "—"}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      ))}
    </Stack>
  );
}

// ── Medical Certificates ────────────────────────────────

const CERTIFICATE_TYPES: { value: CertificateType; label: string }[] = [
  { value: "medical", label: "Medical Certificate" },
  { value: "fitness", label: "Fitness Certificate" },
  { value: "sick_leave", label: "Sick Leave Certificate" },
  { value: "disability", label: "Disability Certificate" },
  { value: "death", label: "Death Certificate" },
  { value: "birth", label: "Birth Certificate" },
  { value: "custom", label: "Custom Certificate" },
];

function CertificatesTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [certType, setCertType] = useState<string | null>(null);
  const [issuedDate, setIssuedDate] = useState(() => new Date().toISOString().split("T")[0] ?? "");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [remarks, setRemarks] = useState("");

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["patient-certificates", patientId],
    queryFn: () => api.listCertificates(patientId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateMedicalCertificateRequest) => api.createCertificate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-certificates", patientId] });
      notifications.show({ title: "Certificate created", message: "Medical certificate generated", color: "success" });
      closeCreate();
      resetForm();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create certificate", color: "danger" });
    },
  });

  const resetForm = () => {
    setCertType(null);
    setIssuedDate(new Date().toISOString().split("T")[0] ?? "");
    setValidFrom("");
    setValidTo("");
    setDiagnosis("");
    setRemarks("");
  };

  const handleCreate = () => {
    if (!certType) return;
    createMutation.mutate({
      patient_id: patientId,
      encounter_id: encounterId,
      certificate_type: certType as CertificateType,
      issued_date: issuedDate || undefined,
      valid_from: validFrom || undefined,
      valid_to: validTo || undefined,
      diagnosis: diagnosis.trim() || undefined,
      remarks: remarks.trim() || undefined,
      body: {},
    });
  };

  if (isLoading) {
    return <Text size="sm" c="dimmed">Loading certificates...</Text>;
  }

  return (
    <Stack gap="sm">
      {canUpdate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            New Certificate
          </Button>
        </Group>
      )}

      {(certificates as MedicalCertificate[]).map((cert) => (
        <Card key={cert.id} padding="sm" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Group gap={8}>
              <IconCertificate size={16} color="var(--mantine-color-blue-5)" />
              <Badge size="sm" variant="light">
                {cert.certificate_type.replace(/_/g, " ")}
              </Badge>
              {cert.certificate_number && (
                <Text size="xs" c="dimmed" ff="monospace">{cert.certificate_number}</Text>
              )}
            </Group>
            <Text size="xs" c="dimmed">{new Date(cert.issued_date).toLocaleDateString()}</Text>
          </Group>
          {cert.diagnosis && <Text size="sm"><Text span fw={500}>Diagnosis:</Text> {cert.diagnosis}</Text>}
          {(cert.valid_from || cert.valid_to) && (
            <Text size="xs" c="dimmed">
              {cert.valid_from ? `From: ${new Date(cert.valid_from).toLocaleDateString()}` : ""}
              {cert.valid_from && cert.valid_to ? " — " : ""}
              {cert.valid_to ? `To: ${new Date(cert.valid_to).toLocaleDateString()}` : ""}
            </Text>
          )}
          {cert.remarks && <Text size="xs" c="dimmed" fs="italic" mt={4}>{cert.remarks}</Text>}
        </Card>
      ))}

      {certificates.length === 0 && !createOpen && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No certificates issued for this patient.
        </Text>
      )}

      {/* Create certificate modal */}
      <Modal opened={createOpen} onClose={closeCreate} title="New Medical Certificate" size="md">
        <Stack gap="sm">
          <Select
            label="Certificate Type"
            placeholder="Select type"
            data={CERTIFICATE_TYPES}
            value={certType}
            onChange={setCertType}
            required
          />
          <TextInput
            label="Issued Date"
            type="date"
            value={issuedDate}
            onChange={(e) => setIssuedDate(e.currentTarget.value)}
          />
          <Group grow>
            <TextInput
              label="Valid From"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.currentTarget.value)}
            />
            <TextInput
              label="Valid To"
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.currentTarget.value)}
            />
          </Group>
          <Textarea
            label="Diagnosis"
            placeholder="Primary diagnosis for certificate"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Textarea
            label="Remarks"
            placeholder="Additional remarks or instructions"
            value={remarks}
            onChange={(e) => setRemarks(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeCreate}>Cancel</Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!certType}
              leftSection={<IconCertificate size={14} />}
            >
              Create Certificate
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Vitals/Lab Trend Charts ─────────────────────────────

function ChartsTab({ patientId }: { patientId: string }) {
  const [metric, setMetric] = useState<string | null>("bp");

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["patient-vitals-history", patientId],
    queryFn: () => api.listPatientVitalsHistory(patientId),
  });

  const chartData = useMemo(() => {
    return (history as VitalHistoryPoint[]).map((p) => ({
      date: new Date(p.recorded_at).toLocaleDateString(),
      "Systolic": p.systolic_bp,
      "Diastolic": p.diastolic_bp,
      "Pulse": p.pulse,
      "Temp": p.temperature ? Number(p.temperature) : null,
      "SpO2": p.spo2,
      "RR": p.respiratory_rate,
      "Weight": p.weight_kg ? Number(p.weight_kg) : null,
      "BMI": p.bmi ? Number(p.bmi) : null,
    }));
  }, [history]);

  if (isLoading) {
    return <Text size="sm" c="dimmed">Loading vitals history...</Text>;
  }

  if (chartData.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No vitals history available for trend charts.
      </Text>
    );
  }

  const bpSeries = [
    { name: "Systolic", color: "red.6" },
    { name: "Diastolic", color: "blue.6" },
  ];
  const pulseSeries = [{ name: "Pulse", color: "pink.6" }];
  const tempSeries = [{ name: "Temp", color: "orange.6" }];
  const spo2Series = [{ name: "SpO2", color: "teal.6" }];
  const weightSeries = [
    { name: "Weight", color: "primary.4" },
    { name: "BMI", color: "violet.6" },
  ];

  const seriesMap: Record<string, { name: string; color: string }[]> = {
    bp: bpSeries,
    pulse: pulseSeries,
    temp: tempSeries,
    spo2: spo2Series,
    weight: weightSeries,
  };

  const activeSeries = seriesMap[metric ?? "bp"] ?? bpSeries;

  return (
    <Stack gap="sm">
      <Group>
        <Select
          value={metric}
          onChange={setMetric}
          data={[
            { value: "bp", label: "Blood Pressure" },
            { value: "pulse", label: "Pulse" },
            { value: "temp", label: "Temperature" },
            { value: "spo2", label: "SpO2" },
            { value: "weight", label: "Weight & BMI" },
          ]}
          w={200}
          size="sm"
        />
      </Group>
      <LineChart
        h={300}
        data={chartData}
        dataKey="date"
        series={activeSeries}
        curveType="monotone"
        connectNulls
        withLegend
        withTooltip
        tooltipAnimationDuration={200}
      />
    </Stack>
  );
}

// ── Patient Timeline ────────────────────────────────────

function TimelineTab({ patientId }: { patientId: string }) {
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const { data: visits = [], isLoading: loadingVisits } = useQuery({
    queryKey: ["patient-visits", patientId],
    queryFn: () => api.listPatientVisits(patientId),
  });
  const { data: rxHistory = [] } = useQuery({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: () => api.listPatientPrescriptions(patientId),
  });
  const { data: labOrders = [] } = useQuery({
    queryKey: ["patient-lab-orders", patientId],
    queryFn: () => api.listPatientLabOrders(patientId),
  });
  const { data: certificates = [] } = useQuery({
    queryKey: ["patient-certificates", patientId],
    queryFn: () => api.listCertificates(patientId),
  });

  // Merge into unified timeline
  const timelineItems = useMemo(() => {
    const items: { date: string; type: string; title: string; detail: string; color: string; icon: React.ReactNode; counts?: string }[] = [];

    for (const v of visits as PatientVisitRow[]) {
      const counts = [
        v.diagnosis_count ? `${v.diagnosis_count} dx` : null,
        v.prescription_count ? `${v.prescription_count} rx` : null,
        v.lab_order_count ? `${v.lab_order_count} labs` : null,
      ].filter(Boolean).join(", ");
      items.push({
        date: v.encounter_date ?? v.created_at,
        type: "visit",
        title: `${v.encounter_type.toUpperCase()} visit — ${v.status}`,
        detail: [
          v.department_name,
          v.doctor_name ? `Dr. ${v.doctor_name}` : null,
          v.chief_complaint,
        ].filter(Boolean).join(" · "),
        counts: counts || undefined,
        color: "primary",
        icon: <IconStethoscope size={12} />,
      });
    }

    for (const rx of rxHistory as PrescriptionHistoryItem[]) {
      items.push({
        date: rx.encounter_date ?? rx.prescription.created_at,
        type: "prescription",
        title: `Prescription (${rx.items.length} items)`,
        detail: rx.items.map((i) => `${i.drug_name} ${i.dosage} ${i.frequency}`).join(" | "),
        color: "success",
        icon: <IconPill size={12} />,
      });
    }

    for (const lo of labOrders) {
      items.push({
        date: lo.created_at,
        type: "lab",
        title: `Lab: ${lo.test_name ?? "Test"}`,
        detail: `${lo.status} · ${lo.priority}`,
        color: "info",
        icon: <IconFlask size={12} />,
      });
    }

    for (const cert of certificates as MedicalCertificate[]) {
      items.push({
        date: cert.created_at,
        type: "certificate",
        title: `${cert.certificate_type.replace(/_/g, " ")} certificate`,
        detail: cert.certificate_number ?? "",
        color: "violet",
        icon: <IconCertificate size={12} />,
      });
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [visits, rxHistory, labOrders, certificates]);

  const filteredItems = useMemo(
    () => (typeFilter ? timelineItems.filter((i) => i.type === typeFilter) : timelineItems).slice(0, 50),
    [timelineItems, typeFilter],
  );

  if (loadingVisits) {
    return <Text size="sm" c="dimmed">Loading timeline...</Text>;
  }

  if (timelineItems.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No clinical history found for this patient.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Select
          placeholder="Filter by type"
          data={[
            { value: "visit", label: "Visits" },
            { value: "prescription", label: "Prescriptions" },
            { value: "lab", label: "Lab Orders" },
            { value: "certificate", label: "Certificates" },
          ]}
          value={typeFilter}
          onChange={setTypeFilter}
          clearable
          size="xs"
          w={180}
        />
        <Text size="xs" c="dimmed">
          {filteredItems.length} of {timelineItems.length} items
        </Text>
      </Group>
      <Timeline active={-1} bulletSize={24} lineWidth={2}>
        {filteredItems.map((item, idx) => (
          <Timeline.Item
            key={idx}
            bullet={item.icon}
            color={item.color}
            title={
              <Group gap={8}>
                <Text size="sm" fw={500}>{item.title}</Text>
                <Text size="xs" c="dimmed">{new Date(item.date).toLocaleDateString()}</Text>
              </Group>
            }
          >
            <Text size="xs" c="dimmed">{item.detail}</Text>
            {item.counts && (
              <Group gap={4} mt={2}>
                {item.counts.split(", ").map((c) => (
                  <Badge key={c} size="xs" variant="dot" color="primary">{c}</Badge>
                ))}
              </Group>
            )}
          </Timeline.Item>
        ))}
      </Timeline>
    </Stack>
  );
}

// ── Procedures Tab ──────────────────────────────────────

const PROC_STATUS_COLORS: Record<string, string> = {
  ordered: "primary",
  scheduled: "info",
  in_progress: "orange",
  completed: "success",
  cancelled: "danger",
};

function ProceduresTab({
  encounterId,
  patientId,
  canUpdate,
}: {
  encounterId: string;
  patientId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedProcId, setSelectedProcId] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>("routine");
  const [notes, setNotes] = useState("");
  const [dupeWarning, setDupeWarning] = useState<DuplicateOrderInfo[]>([]);

  const { data: catalog = [] } = useQuery({
    queryKey: ["procedure-catalog"],
    queryFn: () => api.listProcedureCatalog(),
    staleTime: 300_000,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["procedure-orders", encounterId],
    queryFn: () => api.listProcedureOrders(encounterId),
  });

  const procOptions = (catalog as ProcedureCatalog[])
    .map((p) => ({
      value: p.id,
      label: `${p.code} — ${p.name}${p.category ? ` (${p.category})` : ""}`,
    }));

  // Duplicate check on procedure selection
  const handleProcSelect = async (procId: string | null) => {
    setSelectedProcId(procId);
    setDupeWarning([]);
    if (procId) {
      try {
        const dupes = await api.checkDuplicateOrders({ patient_id: patientId, procedure_id: procId });
        if (dupes.length > 0) setDupeWarning(dupes);
      } catch { /* ignore check failure */ }
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateProcedureOrderRequest) => api.createProcedureOrder(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["procedure-orders", encounterId] });
      notifications.show({ title: "Procedure ordered", message: "Procedure order placed", color: "success" });
      emit("procedure.ordered", { encounter_id: encounterId, patient_id: patientId });
      setSelectedProcId(null);
      setPriority("routine");
      setNotes("");
      setDupeWarning([]);
      setShowForm(false);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to order procedure", color: "danger" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelProcedureOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["procedure-orders", encounterId] });
      notifications.show({ title: "Cancelled", message: "Procedure order cancelled", color: "warning" });
    },
  });

  const handleOrder = () => {
    if (!selectedProcId) return;
    createMutation.mutate({
      patient_id: patientId,
      encounter_id: encounterId,
      procedure_id: selectedProcId,
      priority: priority ?? undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Stack>
      {canUpdate && !showForm && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(true)}>
            Order Procedure
          </Button>
        </Group>
      )}

      {showForm && (
        <Card padding="sm" radius="md" withBorder>
          <Stack gap="xs">
            <Select
              label="Procedure"
              placeholder="Search procedures..."
              data={procOptions}
              value={selectedProcId}
              onChange={handleProcSelect}
              searchable
              nothingFoundMessage="No procedures found"
              required
            />
            {dupeWarning.length > 0 && (
              <Alert icon={<IconAlertTriangle size={14} />} color="warning" variant="light" title="Duplicate Warning">
                <Text size="xs">
                  This procedure was already ordered {dupeWarning.length} time(s) in the last 24 hours.
                  ({dupeWarning.map((d) => d.status).join(", ")})
                </Text>
              </Alert>
            )}
            <Select
              label="Priority"
              data={[
                { value: "routine", label: "Routine" },
                { value: "urgent", label: "Urgent" },
                { value: "stat", label: "STAT" },
              ]}
              value={priority}
              onChange={setPriority}
            />
            <Textarea
              label="Notes"
              placeholder="Clinical notes for procedure..."
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              autosize
              minRows={2}
            />
            <Group justify="flex-end" gap="xs">
              <Button variant="subtle" size="sm" onClick={() => { setShowForm(false); setDupeWarning([]); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                leftSection={<IconMedicalCross size={14} />}
                onClick={handleOrder}
                loading={createMutation.isPending}
                disabled={!selectedProcId}
              >
                Place Order
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {(orders as ProcedureOrderWithName[]).length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Procedure</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ordered</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(orders as ProcedureOrderWithName[]).map((order) => (
              <Table.Tr key={order.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>{order.procedure_name ?? order.procedure_code}</Text>
                  {order.notes && <Text size="xs" c="dimmed">{order.notes}</Text>}
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" color={LAB_PRIORITY_COLORS[order.priority] ?? "slate"}>
                    {order.priority.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light" color={PROC_STATUS_COLORS[order.status] ?? "slate"}>
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">{new Date(order.created_at).toLocaleString()}</Text>
                </Table.Td>
                <Table.Td>
                  {canUpdate && (order.status === "ordered" || order.status === "scheduled") && (
                    <Tooltip label="Cancel">
                      <ActionIcon variant="subtle" color="danger" size="xs" onClick={() => cancelMutation.mutate(order.id)}>
                        <IconX size={12} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {!showForm && (orders as ProcedureOrderWithName[]).length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No procedures ordered yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Referrals Tab ───────────────────────────────────────

const URGENCY_COLORS: Record<string, string> = {
  routine: "primary",
  urgent: "orange",
  emergency: "danger",
};

const REFERRAL_STATUS_COLORS: Record<string, string> = {
  pending: "warning",
  accepted: "success",
  declined: "danger",
  completed: "teal",
  cancelled: "slate",
};

function ReferralsTab({
  patientId,
  encounterId,
  departmentId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  departmentId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [toDeptId, setToDeptId] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<string | null>("routine");
  const [reason, setReason] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["patient-referrals", patientId],
    queryFn: () => api.listPatientReferrals(patientId),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.listDepartments(),
    staleTime: 600_000,
  });

  const deptOptions = (departments as DepartmentRow[])
    .filter((d) => d.id !== departmentId && (d.department_type === "clinical" || d.department_type === "para_clinical"))
    .map((d) => ({ value: d.id, label: d.name }));

  const createMutation = useMutation({
    mutationFn: (data: CreateReferralRequest) => api.createReferral(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-referrals", patientId] });
      notifications.show({ title: "Referral created", message: "Patient referred successfully", color: "success" });
      closeCreate();
      setToDeptId(null);
      setUrgency("routine");
      setReason("");
      setClinicalNotes("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create referral", color: "danger" });
    },
  });

  const handleCreate = () => {
    if (!toDeptId || !reason.trim()) return;
    createMutation.mutate({
      patient_id: patientId,
      encounter_id: encounterId,
      to_department_id: toDeptId,
      urgency: (urgency as CreateReferralRequest["urgency"]) ?? undefined,
      reason: reason.trim(),
      clinical_notes: clinicalNotes.trim() || undefined,
    });
  };

  if (isLoading) {
    return <Text size="sm" c="dimmed">Loading referrals...</Text>;
  }

  return (
    <Stack gap="sm">
      {canUpdate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            New Referral
          </Button>
        </Group>
      )}

      {(referrals as ReferralWithNames[]).map((ref) => (
        <Card key={ref.id} padding="sm" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Group gap={8}>
              <IconArrowRight size={16} color="var(--mantine-color-blue-5)" />
              <Text size="sm" fw={500}>
                {ref.from_department_name ?? "—"} → {ref.to_department_name ?? "—"}
              </Text>
              <Badge size="xs" color={URGENCY_COLORS[ref.urgency] ?? "slate"}>
                {ref.urgency}
              </Badge>
              <Badge size="xs" variant="light" color={REFERRAL_STATUS_COLORS[ref.status] ?? "slate"}>
                {ref.status}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">{new Date(ref.created_at).toLocaleDateString()}</Text>
          </Group>
          <Text size="sm"><Text span fw={500}>Reason:</Text> {ref.reason}</Text>
          {ref.from_doctor_name && <Text size="xs" c="dimmed">From: Dr. {ref.from_doctor_name}</Text>}
          {ref.to_doctor_name && <Text size="xs" c="dimmed">To: Dr. {ref.to_doctor_name}</Text>}
          {ref.clinical_notes && <Text size="xs" c="dimmed" mt={4}>{ref.clinical_notes}</Text>}
          {ref.response_notes && (
            <Alert color="success" variant="light" mt="xs" title="Response">
              <Text size="xs">{ref.response_notes}</Text>
            </Alert>
          )}
        </Card>
      ))}

      {referrals.length === 0 && !createOpen && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No referrals for this patient.
        </Text>
      )}

      {/* Create referral modal */}
      <Modal opened={createOpen} onClose={closeCreate} title="New Referral" size="md">
        <Stack gap="sm">
          <Select
            label="Refer to Department"
            placeholder="Select department"
            data={deptOptions}
            value={toDeptId}
            onChange={setToDeptId}
            searchable
            required
          />
          <Select
            label="Urgency"
            data={[
              { value: "routine", label: "Routine" },
              { value: "urgent", label: "Urgent" },
              { value: "emergency", label: "Emergency" },
            ]}
            value={urgency}
            onChange={setUrgency}
          />
          <Textarea
            label="Reason for Referral"
            placeholder="Clinical reason for referring this patient"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            autosize
            minRows={2}
            required
          />
          <Textarea
            label="Clinical Notes"
            placeholder="Additional clinical context, findings, suspected diagnosis..."
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeCreate}>Cancel</Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!toDeptId || !reason.trim()}
              leftSection={<IconArrowRight size={14} />}
            >
              Create Referral
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Reminders ─────────────────────────────────────────────

const REMINDER_TYPES: { value: ReminderType; label: string }[] = [
  { value: "follow_up", label: "Follow-up" },
  { value: "lab_review", label: "Lab Review" },
  { value: "medication_review", label: "Medication Review" },
  { value: "vaccination", label: "Vaccination" },
  { value: "screening", label: "Screening" },
  { value: "custom", label: "Custom" },
];

function RemindersTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [reminderType, setReminderType] = useState<string | null>("follow_up");
  const [reminderDate, setReminderDate] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string | null>("normal");

  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders", patientId],
    queryFn: () => api.listReminders({ patient_id: patientId }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateReminderRequest) => api.createReminder(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reminders", patientId] });
      notifications.show({ title: "Reminder created", message: title, color: "success" });
      setShowForm(false);
      setTitle("");
      setDescription("");
      setReminderDate("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create reminder", color: "danger" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeReminder(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reminders", patientId] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelReminder(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reminders", patientId] }),
  });

  const handleCreate = () => {
    if (!title.trim() || !reminderDate || !reminderType) return;
    createMutation.mutate({
      patient_id: patientId,
      encounter_id: encounterId,
      reminder_type: reminderType as ReminderType,
      reminder_date: reminderDate,
      title: title.trim(),
      description: description.trim() || undefined,
      priority: (priority as CreateReminderRequest["priority"]) ?? undefined,
    });
  };

  const priorityColors: Record<string, string> = {
    low: "slate",
    normal: "primary",
    high: "orange",
    urgent: "danger",
  };

  const statusColors: Record<string, string> = {
    pending: "primary",
    sent: "info",
    acknowledged: "teal",
    completed: "success",
    cancelled: "slate",
    overdue: "danger",
  };

  return (
    <Stack>
      {canUpdate && (
        <Group justify="flex-end">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(true)}>
            Add Reminder
          </Button>
        </Group>
      )}

      {(reminders as PatientReminder[]).length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">No reminders yet.</Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(reminders as PatientReminder[]).map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{r.title}</Table.Td>
                <Table.Td><Badge variant="light" size="sm">{r.reminder_type.replace(/_/g, " ")}</Badge></Table.Td>
                <Table.Td>{r.reminder_date}</Table.Td>
                <Table.Td><Badge color={priorityColors[r.priority] ?? "primary"} size="sm">{r.priority}</Badge></Table.Td>
                <Table.Td><Badge color={statusColors[r.status] ?? "slate"} size="sm">{r.status}</Badge></Table.Td>
                <Table.Td>
                  {r.status === "pending" && canUpdate && (
                    <Group gap={4}>
                      <Tooltip label="Complete">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="success"
                          onClick={() => completeMutation.mutate(r.id)}
                        >
                          <IconCheck size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Cancel">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="danger"
                          onClick={() => cancelMutation.mutate(r.id)}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={showForm} onClose={() => setShowForm(false)} title="New Reminder" size="md">
        <Stack gap="sm">
          <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
          <Select
            label="Type"
            data={REMINDER_TYPES}
            value={reminderType}
            onChange={setReminderType}
            required
          />
          <TextInput
            label="Reminder Date"
            type="date"
            value={reminderDate}
            onChange={(e) => setReminderDate(e.currentTarget.value)}
            required
          />
          <Select
            label="Priority"
            data={[
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
              { value: "urgent", label: "Urgent" },
            ]}
            value={priority}
            onChange={setPriority}
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!title.trim() || !reminderDate || !reminderType}
            >
              Create Reminder
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Feedback ──────────────────────────────────────────────

function FeedbackTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState<string | null>(null);
  const [waitTimeRating, setWaitTimeRating] = useState<string | null>(null);
  const [staffRating, setStaffRating] = useState<string | null>(null);
  const [cleanlinessRating, setCleanlinessRating] = useState<string | null>(null);
  const [experience, setExperience] = useState("");
  const [suggestions, setSuggestions] = useState("");

  const { data: feedback = [] } = useQuery({
    queryKey: ["feedback", patientId],
    queryFn: () => api.listPatientFeedback(patientId),
  });

  const ratingOptions = [
    { value: "1", label: "1 - Poor" },
    { value: "2", label: "2 - Fair" },
    { value: "3", label: "3 - Good" },
    { value: "4", label: "4 - Very Good" },
    { value: "5", label: "5 - Excellent" },
  ];

  const createMutation = useMutation({
    mutationFn: (data: CreateFeedbackRequest) => api.createFeedback(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feedback", patientId] });
      notifications.show({ title: "Feedback recorded", message: "Thank you for the feedback", color: "success" });
      setShowForm(false);
      setRating(null);
      setWaitTimeRating(null);
      setStaffRating(null);
      setCleanlinessRating(null);
      setExperience("");
      setSuggestions("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to submit feedback", color: "danger" });
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      patient_id: patientId,
      encounter_id: encounterId,
      rating: rating ? Number(rating) : undefined,
      wait_time_rating: waitTimeRating ? Number(waitTimeRating) : undefined,
      staff_rating: staffRating ? Number(staffRating) : undefined,
      cleanliness_rating: cleanlinessRating ? Number(cleanlinessRating) : undefined,
      overall_experience: experience.trim() || undefined,
      suggestions: suggestions.trim() || undefined,
    });
  };

  const ratingColor = (val: number | null) => {
    if (!val) return "gray";
    if (val >= 4) return "success";
    if (val >= 3) return "warning";
    return "danger";
  };

  return (
    <Stack>
      {canUpdate && (
        <Group justify="flex-end">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(true)}>
            Collect Feedback
          </Button>
        </Group>
      )}

      {(feedback as PatientFeedback[]).length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">No feedback collected yet.</Text>
      ) : (
        <Stack gap="sm">
          {(feedback as PatientFeedback[]).map((fb) => (
            <Card key={fb.id} padding="sm" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">{new Date(fb.submitted_at).toLocaleDateString()}</Text>
                {fb.is_anonymous && <Badge size="xs" variant="light">Anonymous</Badge>}
              </Group>
              <Group gap="md" mb="xs">
                {fb.rating != null && (
                  <Badge color={ratingColor(fb.rating)} size="sm" leftSection={<IconStar size={10} />}>
                    Overall: {fb.rating}/5
                  </Badge>
                )}
                {fb.wait_time_rating != null && (
                  <Badge color={ratingColor(fb.wait_time_rating)} variant="light" size="sm">
                    Wait: {fb.wait_time_rating}/5
                  </Badge>
                )}
                {fb.staff_rating != null && (
                  <Badge color={ratingColor(fb.staff_rating)} variant="light" size="sm">
                    Staff: {fb.staff_rating}/5
                  </Badge>
                )}
                {fb.cleanliness_rating != null && (
                  <Badge color={ratingColor(fb.cleanliness_rating)} variant="light" size="sm">
                    Clean: {fb.cleanliness_rating}/5
                  </Badge>
                )}
              </Group>
              {fb.overall_experience && <Text size="sm">{fb.overall_experience}</Text>}
              {fb.suggestions && <Text size="sm" c="dimmed" fs="italic">Suggestion: {fb.suggestions}</Text>}
            </Card>
          ))}
        </Stack>
      )}

      <Modal opened={showForm} onClose={() => setShowForm(false)} title="Collect Patient Feedback" size="md">
        <Stack gap="sm">
          <Select label="Overall Rating" data={ratingOptions} value={rating} onChange={setRating} />
          <Select label="Wait Time" data={ratingOptions} value={waitTimeRating} onChange={setWaitTimeRating} />
          <Select label="Staff Courtesy" data={ratingOptions} value={staffRating} onChange={setStaffRating} />
          <Select label="Cleanliness" data={ratingOptions} value={cleanlinessRating} onChange={setCleanlinessRating} />
          <Textarea
            label="Overall Experience"
            value={experience}
            onChange={(e) => setExperience(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Textarea
            label="Suggestions"
            value={suggestions}
            onChange={(e) => setSuggestions(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMutation.isPending}>
              Submit Feedback
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Consents ──────────────────────────────────────────────

const CONSENT_TYPES: { value: ProcedureConsentType; label: string }[] = [
  { value: "procedure", label: "Procedure" },
  { value: "anesthesia", label: "Anesthesia" },
  { value: "blood_transfusion", label: "Blood Transfusion" },
  { value: "surgery", label: "Surgery" },
  { value: "investigation", label: "Investigation" },
  { value: "general", label: "General" },
];

function ConsentsTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [procedureName, setProcedureName] = useState("");
  const [consentType, setConsentType] = useState<string | null>("procedure");
  const [risks, setRisks] = useState("");
  const [alternatives, setAlternatives] = useState("");
  const [benefits, setBenefits] = useState("");
  const [consentedByName, setConsentedByName] = useState("");
  const [consentedByRelation, setConsentedByRelation] = useState("");
  const [witnessName, setWitnessName] = useState("");

  const { data: consents = [] } = useQuery({
    queryKey: ["consents", patientId],
    queryFn: () => api.listProcedureConsents(patientId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateConsentRequest) => api.createProcedureConsent(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consents", patientId] });
      notifications.show({ title: "Consent created", message: procedureName, color: "success" });
      setShowForm(false);
      setProcedureName("");
      setRisks("");
      setAlternatives("");
      setBenefits("");
      setConsentedByName("");
      setConsentedByRelation("");
      setWitnessName("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create consent", color: "danger" });
    },
  });

  const signMutation = useMutation({
    mutationFn: (id: string) => api.signProcedureConsent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consents", patientId] });
      notifications.show({ title: "Consent signed", message: "Consent has been signed", color: "success" });
    },
  });

  const handleCreate = () => {
    if (!procedureName.trim()) return;
    createMutation.mutate({
      patient_id: patientId,
      encounter_id: encounterId,
      procedure_name: procedureName.trim(),
      consent_type: (consentType as ProcedureConsentType) ?? undefined,
      risks_explained: risks.trim() || undefined,
      alternatives_explained: alternatives.trim() || undefined,
      benefits_explained: benefits.trim() || undefined,
      consented_by_name: consentedByName.trim() || undefined,
      consented_by_relation: consentedByRelation.trim() || undefined,
      witness_name: witnessName.trim() || undefined,
    });
  };

  const consentStatusColors: Record<string, string> = {
    pending: "warning",
    signed: "success",
    refused: "danger",
    withdrawn: "slate",
    expired: "orange",
  };

  return (
    <Stack>
      {canUpdate && (
        <Group justify="flex-end">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(true)}>
            New Consent
          </Button>
        </Group>
      )}

      {(consents as ProcedureConsent[]).length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">No consents recorded.</Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Procedure</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Consented By</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(consents as ProcedureConsent[]).map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.procedure_name}</Table.Td>
                <Table.Td><Badge variant="light" size="sm">{c.consent_type.replace(/_/g, " ")}</Badge></Table.Td>
                <Table.Td>
                  <Badge color={consentStatusColors[c.status] ?? "slate"} size="sm">
                    {c.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{c.consented_by_name ?? "—"}</Table.Td>
                <Table.Td>{new Date(c.created_at).toLocaleDateString()}</Table.Td>
                <Table.Td>
                  {c.status === "pending" && canUpdate && (
                    <Tooltip label="Sign Consent">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="success"
                        onClick={() => signMutation.mutate(c.id)}
                      >
                        <IconFileCheck size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={showForm} onClose={() => setShowForm(false)} title="New Procedure Consent" size="lg">
        <Stack gap="sm">
          <TextInput
            label="Procedure Name"
            value={procedureName}
            onChange={(e) => setProcedureName(e.currentTarget.value)}
            required
          />
          <Select
            label="Consent Type"
            data={CONSENT_TYPES}
            value={consentType}
            onChange={setConsentType}
          />
          <Textarea
            label="Risks Explained"
            value={risks}
            onChange={(e) => setRisks(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Textarea
            label="Alternatives Explained"
            value={alternatives}
            onChange={(e) => setAlternatives(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Textarea
            label="Benefits Explained"
            value={benefits}
            onChange={(e) => setBenefits(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group grow>
            <TextInput
              label="Consented By (Name)"
              value={consentedByName}
              onChange={(e) => setConsentedByName(e.currentTarget.value)}
            />
            <TextInput
              label="Relation to Patient"
              value={consentedByRelation}
              onChange={(e) => setConsentedByRelation(e.currentTarget.value)}
            />
          </Group>
          <TextInput
            label="Witness Name"
            value={witnessName}
            onChange={(e) => setWitnessName(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!procedureName.trim()}
              leftSection={<IconFileCheck size={14} />}
            >
              Create Consent
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Doctor Docket ─────────────────────────────────────────

function DocketTab() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0] ?? "");

  const { data: docket, isLoading } = useQuery({
    queryKey: ["docket", selectedDate],
    queryFn: () => api.getDoctorDocket(selectedDate || undefined),
    enabled: Boolean(selectedDate),
  });

  const generateMutation = useMutation({
    mutationFn: (date?: string) => api.generateDoctorDocket(date),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["docket", selectedDate] });
      notifications.show({ title: "Docket generated", message: `Summary for ${selectedDate}`, color: "success" });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to generate docket", color: "danger" });
    },
  });

  const d = docket as DoctorDocket | null | undefined;

  return (
    <Stack>
      <Group>
        <TextInput
          label="Date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.currentTarget.value)}
          style={{ width: 200 }}
        />
        <Button
          mt={24}
          size="sm"
          variant="light"
          onClick={() => generateMutation.mutate(selectedDate || undefined)}
          loading={generateMutation.isPending}
        >
          Generate / Refresh
        </Button>
      </Group>

      {isLoading ? (
        <Text size="sm" c="dimmed">Loading...</Text>
      ) : d ? (
        <Card padding="md" radius="md" withBorder>
          <Text size="lg" fw={600} mb="sm">
            Daily Docket — {d.docket_date}
          </Text>
          <Table withTableBorder>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={500}>Total Patients</Table.Td>
                <Table.Td><Badge size="lg">{d.total_patients}</Badge></Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>New Patients</Table.Td>
                <Table.Td><Badge color="primary" size="lg">{d.new_patients}</Badge></Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Follow-ups</Table.Td>
                <Table.Td><Badge color="teal" size="lg">{d.follow_ups}</Badge></Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Referrals Made</Table.Td>
                <Table.Td><Badge color="orange" size="lg">{d.referrals_made}</Badge></Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Procedures Done</Table.Td>
                <Table.Td><Badge color="violet" size="lg">{d.procedures_done}</Badge></Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed" mt="sm">
            Generated at: {new Date(d.generated_at).toLocaleString()}
          </Text>
        </Card>
      ) : (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No docket for this date. Click &quot;Generate / Refresh&quot; to create one.
        </Text>
      )}
    </Stack>
  );
}

// ── Pre-Authorization Tab ───────────────────────────────

function PreAuthTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [insurer, setInsurer] = useState("");
  const [policyNo, setPolicyNo] = useState("");
  const [procCodes, setProcCodes] = useState("");
  const [diagCodes, setDiagCodes] = useState("");
  const [estCost, setEstCost] = useState("");
  const [notes, setNotes] = useState("");

  const { data: requests = [] } = useQuery({
    queryKey: ["pre-auth", patientId],
    queryFn: () => api.listPreAuthRequests(patientId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePreAuthRequest) => api.createPreAuthRequest(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pre-auth", patientId] });
      notifications.show({ title: "Submitted", message: "Pre-authorization request submitted", color: "success" });
      close();
      setInsurer("");
      setPolicyNo("");
      setProcCodes("");
      setDiagCodes("");
      setEstCost("");
      setNotes("");
    },
  });

  const handleCreate = () => {
    if (!insurer.trim()) return;
    createMutation.mutate({
      patient_id: patientId,
      encounter_id: encounterId,
      insurance_provider: insurer.trim(),
      policy_number: policyNo.trim() || undefined,
      procedure_codes: procCodes.trim() ? procCodes.split(",").map((s) => s.trim()) : undefined,
      diagnosis_codes: diagCodes.trim() ? diagCodes.split(",").map((s) => s.trim()) : undefined,
      estimated_cost: estCost ? Number(estCost) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": return "success";
      case "denied": return "danger";
      case "submitted": return "primary";
      case "expired": return "gray";
      default: return "warning";
    }
  };

  return (
    <Stack gap="sm">
      {canUpdate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={open}>
            New Pre-Auth Request
          </Button>
        </Group>
      )}

      {requests.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Insurance</Table.Th>
              <Table.Th>Policy #</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Auth #</Table.Th>
              <Table.Th>Approved Amt</Table.Th>
              <Table.Th>Valid Until</Table.Th>
              <Table.Th>Created</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(requests as PreAuthReqType[]).map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td><Text size="sm" fw={500}>{r.insurance_provider}</Text></Table.Td>
                <Table.Td><Text size="sm">{r.policy_number ?? "—"}</Text></Table.Td>
                <Table.Td><Badge color={statusColor(r.status)} size="sm">{r.status}</Badge></Table.Td>
                <Table.Td><Text size="sm">{r.auth_number ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="sm">{r.approved_amount ? `₹${r.approved_amount}` : "—"}</Text></Table.Td>
                <Table.Td><Text size="sm">{r.valid_until ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="xs" c="dimmed">{new Date(r.created_at).toLocaleDateString()}</Text></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No pre-authorization requests for this patient
        </Text>
      )}

      <Modal opened={opened} onClose={close} title="New Pre-Authorization Request" size="md">
        <Stack gap="sm">
          <TextInput label="Insurance Provider" placeholder="e.g. Star Health" value={insurer} onChange={(e) => setInsurer(e.currentTarget.value)} required />
          <TextInput label="Policy Number" placeholder="Optional" value={policyNo} onChange={(e) => setPolicyNo(e.currentTarget.value)} />
          <TextInput label="Procedure Codes" placeholder="Comma-separated" value={procCodes} onChange={(e) => setProcCodes(e.currentTarget.value)} />
          <TextInput label="Diagnosis Codes" placeholder="Comma-separated ICD-10 codes" value={diagCodes} onChange={(e) => setDiagCodes(e.currentTarget.value)} />
          <TextInput label="Estimated Cost (₹)" placeholder="Optional" value={estCost} onChange={(e) => setEstCost(e.currentTarget.value)} />
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} autosize minRows={2} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={close}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMutation.isPending} disabled={!insurer.trim()}>
              Submit Request
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Wait Time Badge (queue estimate)
// ══════════════════════════════════════════════════════════

// ── Referral Tracking Sub-View ─────────────────────────

function ReferralTrackingTab() {
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["opd-referral-tracking", filterStatus],
    queryFn: () => api.opdReferralTracking(filterStatus ? { status: filterStatus } : undefined),
  });

  const refStatusColors: Record<string, string> = {
    pending: "warning",
    acknowledged: "primary",
    in_progress: "orange",
    completed: "success",
    cancelled: "danger",
  };

  const columns = [
    {
      key: "patient_name",
      label: "Patient",
      render: (row: ReferralTrackingRow) => <Text size="sm" fw={500}>{row.patient_name}</Text>,
    },
    {
      key: "from_department",
      label: "From Dept",
      render: (row: ReferralTrackingRow) => <Text size="sm">{row.from_department}</Text>,
    },
    {
      key: "to_department",
      label: "To Dept",
      render: (row: ReferralTrackingRow) => <Text size="sm">{row.to_department}</Text>,
    },
    {
      key: "referral_date",
      label: "Date",
      render: (row: ReferralTrackingRow) => <Text size="sm">{new Date(row.referral_date).toLocaleDateString()}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: ReferralTrackingRow) => (
        <Badge color={refStatusColors[row.status] ?? "slate"} variant="filled" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "acknowledged_at",
      label: "Acknowledged",
      render: (row: ReferralTrackingRow) => (
        <Text size="sm">{row.acknowledged_at ? new Date(row.acknowledged_at).toLocaleString() : "---"}</Text>
      ),
    },
    {
      key: "completed_at",
      label: "Completed",
      render: (row: ReferralTrackingRow) => (
        <Text size="sm">{row.completed_at ? new Date(row.completed_at).toLocaleString() : "---"}</Text>
      ),
    },
  ];

  return (
    <Stack>
      <Group mb="md">
        <Select
          placeholder="Filter by status"
          data={[
            { value: "pending", label: "Pending" },
            { value: "acknowledged", label: "Acknowledged" },
            { value: "in_progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
          clearable
          w={180}
        />
      </Group>
      <DataTable
        columns={columns}
        data={referrals}
        loading={isLoading}
        rowKey={(row) => row.referral_id}
      />
    </Stack>
  );
}

// ── Follow-up Compliance Sub-View ──────────────────────

function FollowupComplianceTab() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["opd-followup-compliance"],
    queryFn: () => api.opdFollowupCompliance(),
  });

  const columns = [
    {
      key: "patient_name",
      label: "Patient",
      render: (row: FollowupComplianceRow) => <Text size="sm" fw={500}>{row.patient_name}</Text>,
    },
    {
      key: "department",
      label: "Department",
      render: (row: FollowupComplianceRow) => <Text size="sm">{row.department}</Text>,
    },
    {
      key: "last_visit_date",
      label: "Last Visit",
      render: (row: FollowupComplianceRow) => <Text size="sm">{new Date(row.last_visit_date).toLocaleDateString()}</Text>,
    },
    {
      key: "follow_up_date",
      label: "Scheduled Follow-up",
      render: (row: FollowupComplianceRow) => <Text size="sm">{new Date(row.follow_up_date).toLocaleDateString()}</Text>,
    },
    {
      key: "days_overdue",
      label: "Days Overdue",
      render: (row: FollowupComplianceRow) => (
        <Badge color={row.days_overdue > 14 ? "danger" : row.days_overdue > 7 ? "orange" : "warning"} variant="filled" size="sm">
          {row.days_overdue} days
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Text size="sm" c="dimmed">Patients with overdue follow-up appointments</Text>
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(row) => `${row.patient_id}-${row.follow_up_date}`}
      />
    </Stack>
  );
}

function WaitTimeBadge({ departmentId, doctorId }: { departmentId?: string; doctorId?: string }) {
  const { data: estimate } = useQuery({
    queryKey: ["wait-estimate", departmentId, doctorId],
    queryFn: () => api.getWaitEstimate({ department_id: departmentId, doctor_id: doctorId }),
    refetchInterval: 60_000,
  });

  if (!estimate || estimate.queue_position === 0) return null;

  return (
    <Badge size="lg" variant="light" color="orange" radius="sm">
      ~{estimate.estimated_minutes} min wait ({estimate.queue_position} in queue)
    </Badge>
  );
}

// ══════════════════════════════════════════════════════════
//  Admit to IPD Modal
// ══════════════════════════════════════════════════════════

function AdmitToIpdButton({ encounterId, patientName }: { encounterId: string; patientName: string }) {
  const [opened, { open, close }] = useDisclosure(false);
  const queryClient = useQueryClient();
  const [deptId, setDeptId] = useState<string | null>(null);
  const [wardId, setWardId] = useState<string | null>(null);
  const [bedId, setBedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.listDepartments(),
  });

  const { data: beds = [] } = useQuery({
    queryKey: ["available-beds", wardId],
    queryFn: () => api.listAvailableBeds(wardId ? { ward_id: wardId } : undefined),
    enabled: opened,
  });

  const { data: wards = [] } = useQuery({
    queryKey: ["ipd-wards"],
    queryFn: () => api.listWards(),
    enabled: opened,
  });

  const deptOptions = departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name }));
  const wardOptions = (wards as Array<{ id: string; name: string }>).map((w) => ({ value: w.id, label: w.name }));
  const bedOptions = (beds as AvailableBed[]).map((b) => ({
    value: b.bed_id,
    label: `${b.bed_number}${b.ward_name ? ` (${b.ward_name})` : ""}${b.is_isolation ? " [Isolation]" : ""}`,
  }));

  const admitMutation = useMutation({
    mutationFn: (data: AdmitFromOpdRequest) => api.admitFromOpd(encounterId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      notifications.show({
        title: "Patient admitted to IPD",
        message: `${patientName} admitted. ${result.vitals_copied} vitals, ${result.diagnoses_copied} diagnoses, ${result.prescriptions_copied} prescriptions copied.`,
        color: "success",
      });
      close();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to admit patient", color: "danger" });
    },
  });

  const handleAdmit = () => {
    if (!deptId) return;
    admitMutation.mutate({
      department_id: deptId,
      ward_id: wardId ?? undefined,
      bed_id: bedId ?? undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <>
      <Button variant="light" color="teal" size="xs" leftSection={<IconMedicalCross size={14} />} onClick={open}>
        Admit to IPD
      </Button>
      <Modal opened={opened} onClose={close} title={`Admit ${patientName} to IPD`} size="md">
        <Stack gap="sm">
          <Select
            label="Department"
            placeholder="Select department"
            data={deptOptions}
            value={deptId}
            onChange={setDeptId}
            searchable
            required
          />
          <Select
            label="Ward"
            placeholder="Select ward (optional)"
            data={wardOptions}
            value={wardId}
            onChange={(val) => { setWardId(val); setBedId(null); }}
            searchable
            clearable
          />
          <Select
            label="Bed"
            placeholder="Select available bed"
            data={bedOptions}
            value={bedId}
            onChange={setBedId}
            searchable
            clearable
            description={`${bedOptions.length} bed(s) available`}
          />
          <Textarea
            label="Notes"
            placeholder="Admission notes"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={close}>Cancel</Button>
            <Button color="teal" onClick={handleAdmit} loading={admitMutation.isPending} disabled={!deptId}>
              Admit Patient
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

interface GroupSlotRow {
  doctorId: string;
  departmentId: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  notes: string;
}

function GroupAppointmentModal({ patientId }: { patientId: string }) {
  const [opened, { open, close }] = useDisclosure(false);
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<GroupSlotRow[]>([
    { doctorId: "", departmentId: "", date: "", slotStart: "", slotEnd: "", notes: "" },
    { doctorId: "", departmentId: "", date: "", slotStart: "", slotEnd: "", notes: "" },
  ]);

  const { data: allDoctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => api.listDoctors(),
    staleTime: 600_000,
    enabled: opened,
  });

  const { data: groupDepts = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.listDepartments(),
    staleTime: 600_000,
  });

  const doctorOptions = useMemo(
    () =>
      allDoctors.map((u) => ({ value: u.id, label: `${u.full_name}${u.specialization ? ` (${u.specialization})` : ""}` })),
    [allDoctors],
  );

  const groupDeptOptions = useMemo(
    () => (groupDepts as DepartmentRow[]).map((d) => ({ value: d.id, label: d.name })),
    [groupDepts],
  );

  const updateRow = (idx: number, field: keyof GroupSlotRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { doctorId: "", departmentId: "", date: "", slotStart: "", slotEnd: "", notes: "" }]);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const bookGroupMutation = useMutation({
    mutationFn: (data: BookAppointmentGroupRequest) => api.bookAppointmentGroup(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      notifications.show({
        title: "Group appointment booked",
        message: `${(result as unknown[]).length} appointments created`,
        color: "success",
      });
      close();
      setRows([
        { doctorId: "", departmentId: "", date: "", slotStart: "", slotEnd: "", notes: "" },
        { doctorId: "", departmentId: "", date: "", slotStart: "", slotEnd: "", notes: "" },
      ]);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to book group appointment", color: "danger" });
    },
  });

  const canSubmit = rows.every((r) => r.doctorId && r.departmentId && r.date && r.slotStart && r.slotEnd);

  const handleSubmit = () => {
    if (!canSubmit) return;
    bookGroupMutation.mutate({
      patient_id: patientId,
      slot_requests: rows.map((r) => ({
        doctor_id: r.doctorId,
        department_id: r.departmentId,
        appointment_date: r.date,
        slot_start: r.slotStart,
        slot_end: r.slotEnd,
        appointment_type: "consultation" as const,
        notes: r.notes.trim() || undefined,
      })),
    });
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <>
      <Button variant="light" size="xs" leftSection={<IconUsers size={14} />} onClick={open}>
        Group Appointment
      </Button>
      <Modal opened={opened} onClose={close} title="Book Multi-Doctor Appointment" size="lg">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Book appointments with multiple doctors in a single group. The patient will see all listed doctors.
          </Text>
          {rows.map((row, idx) => (
            <Card key={idx} padding="xs" radius="sm" withBorder>
              <Group gap="xs" align="flex-end" wrap="nowrap">
                <Select
                  label={`Doctor ${idx + 1}`}
                  placeholder="Select doctor"
                  data={doctorOptions}
                  value={row.doctorId}
                  onChange={(val) => updateRow(idx, "doctorId", val ?? "")}
                  searchable
                  w={180}
                  size="xs"
                />
                <Select
                  label="Dept"
                  placeholder="Department"
                  data={groupDeptOptions}
                  value={row.departmentId}
                  onChange={(val) => updateRow(idx, "departmentId", val ?? "")}
                  searchable
                  w={150}
                  size="xs"
                />
                <TextInput
                  label="Date"
                  type="date"
                  value={row.date}
                  onChange={(e) => updateRow(idx, "date", e.currentTarget.value)}
                  min={minDate}
                  w={140}
                  size="xs"
                />
                <TextInput
                  label="Start"
                  type="time"
                  value={row.slotStart}
                  onChange={(e) => updateRow(idx, "slotStart", e.currentTarget.value)}
                  w={100}
                  size="xs"
                />
                <TextInput
                  label="End"
                  type="time"
                  value={row.slotEnd}
                  onChange={(e) => updateRow(idx, "slotEnd", e.currentTarget.value)}
                  w={100}
                  size="xs"
                />
                <TextInput
                  label="Notes"
                  placeholder="Optional"
                  value={row.notes}
                  onChange={(e) => updateRow(idx, "notes", e.currentTarget.value)}
                  style={{ flex: 1 }}
                  size="xs"
                />
                {rows.length > 2 && (
                  <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => removeRow(idx)} mt={18}>
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
            </Card>
          ))}
          <Button variant="subtle" size="xs" leftSection={<IconPlus size={14} />} onClick={addRow}>
            Add Another Doctor
          </Button>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={close}>Cancel</Button>
            <Button onClick={handleSubmit} loading={bookGroupMutation.isPending} disabled={!canSubmit}>
              Book {rows.length} Appointments
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
