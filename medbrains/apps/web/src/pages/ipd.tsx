import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Drawer,
  Group,
  Modal,
  NumberInput,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArrowsTransferDown,
  IconBed,
  IconBuildingHospital,
  IconCalendarTime,
  IconChartBar,
  IconCheck,
  IconDoor,
  IconEye,
  IconFileDescription,
  IconLayoutGrid,
  IconLink,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdmissionAttender,
  AdmissionChecklist,
  AdmissionDetailResponse,
  AdmissionRow,
  AdmissionSource,
  AnesthesiaComplicationEntry,
  BedDashboardRow,
  BedDashboardSummary,
  BedTurnaroundLog,
  BillingSummaryResponse,
  CensusWardRow,
  CreateAdmissionRequest,
  CreateAttenderRequest,
  CreateBirthRecordRequest,
  CreateClinicalDocRequest,
  CreateDeathSummaryRequest,
  CreateDischargeSummaryRequest,
  CreateNursingTaskRequest,
  CreateRestraintCheckRequest,
  CreateTransferRequest,
  CreateWardRequest,
  ClinicalAssessmentType,
  DeathCertFormType,
  DietOrder,
  DischargeType,
  EstimatedCostResponse,
  InvestigationsResponse,
  IpTypeConfiguration,
  IpdBirthRecord,
  IpdCarePlan,
  IpdClinicalAssessment,
  IpdClinicalDocType,
  IpdClinicalDocumentation,
  IpdDeathSummary,
  IpdDischargeSummary,
  IpdDischargeChecklist,
  IpdDischargeTatLog,
  IpdHandoverReport,
  IpdIntakeOutput,
  IpdMedicationAdministration,
  IpdProgressNote,
  IpdTransferLog,
  MlcCase,
  NursingTask,
  PriorAuthRequestRow,
  ProcedureConsent,
  ProgressNoteType,
  Receipt,
  RestraintCheckStatus,
  RestraintMonitoringLog,
  SurgeonCaseloadEntry,
  TransferType,
  UpdateDischargeSummaryRequest,
  UpdateWardRequest,
  WardBedRow,
  WardListRow,
  AdmissionPrintData,
  DischargeSummary as DischargeSummaryGenerated,
  BedTransferRequest,
  ExpectedDischargeRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { ClinicalEventProvider, useClinicalEmit, DataTable, PageHeader, StatusDot } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

const statusColors: Record<string, string> = {
  admitted: "success",
  transferred: "primary",
  discharged: "slate",
  absconded: "danger",
  deceased: "dark",
};

const bedStatusColors: Record<string, string> = {
  vacant_clean: "success",
  vacant_dirty: "warning",
  occupied: "primary",
  reserved: "orange",
  maintenance: "slate",
  blocked: "danger",
};

// Dropdown options for categorical fields
const NURSING_TASK_TYPES = [
  { value: "medication", label: "Medication Administration" },
  { value: "vitals", label: "Vitals Monitoring" },
  { value: "wound_care", label: "Wound Care/Dressing" },
  { value: "catheter_care", label: "Catheter Care" },
  { value: "hygiene", label: "Patient Hygiene" },
  { value: "feeding", label: "Feeding/Nutrition" },
  { value: "mobilization", label: "Mobilization/PT" },
  { value: "specimen", label: "Specimen Collection" },
  { value: "documentation", label: "Documentation" },
  { value: "discharge_prep", label: "Discharge Preparation" },
  { value: "other", label: "Other" },
];

const ID_PROOF_TYPES = [
  { value: "aadhar", label: "Aadhaar Card" },
  { value: "pan", label: "PAN Card" },
  { value: "passport", label: "Passport" },
  { value: "voter_id", label: "Voter ID" },
  { value: "driving_license", label: "Driving License" },
  { value: "ration_card", label: "Ration Card" },
  { value: "employee_id", label: "Employee ID" },
  { value: "other", label: "Other" },
];

export function IpdPage() {
  useRequirePermission(P.IPD.ADMISSIONS_LIST);

  return (
    <ClinicalEventProvider moduleCode="ipd" contextCode="ipd-admissions">
      <IpdPageInner />
    </ClinicalEventProvider>
  );
}

function IpdPageInner() {
  const canViewBedDashboard = useHasPermission(P.IPD.BED_DASHBOARD_VIEW);
  const canManageWards = useHasPermission(P.IPD.WARDS_MANAGE);
  const canViewReports = useHasPermission(P.IPD.REPORTS_VIEW);

  return (
    <div>
      <PageHeader
        title="IPD"
        subtitle="Inpatient department"
        icon={<IconBed size={20} stroke={1.5} />}
        color="primary"
      />

      <Tabs defaultValue="admissions">
        <Tabs.List mb="md">
          <Tabs.Tab value="admissions" leftSection={<IconBed size={16} />}>Admissions</Tabs.Tab>
          {(canManageWards || canViewBedDashboard) && (
            <Tabs.Tab value="wards" leftSection={<IconBuildingHospital size={16} />}>Wards</Tabs.Tab>
          )}
          {canViewBedDashboard && (
            <Tabs.Tab value="bed-dashboard" leftSection={<IconLayoutGrid size={16} />}>Bed Dashboard</Tabs.Tab>
          )}
          {canViewReports && (
            <Tabs.Tab value="reports" leftSection={<IconChartBar size={16} />}>Reports</Tabs.Tab>
          )}
          <Tabs.Tab value="expected-discharges" leftSection={<IconCalendarTime size={16} />}>Expected Discharges</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="admissions">
          <AdmissionsTab />
        </Tabs.Panel>
        <Tabs.Panel value="wards">
          <WardsTab />
        </Tabs.Panel>
        <Tabs.Panel value="bed-dashboard">
          <BedDashboardTab />
        </Tabs.Panel>
        <Tabs.Panel value="reports">
          <ReportsTab />
        </Tabs.Panel>
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
  const canManageBeds = useHasPermission(P.IPD.BEDS_MANAGE);
  const canDischarge = useHasPermission(P.IPD.DISCHARGE_CREATE);

  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;

  const { data, isLoading } = useQuery({
    queryKey: ["admissions", params],
    queryFn: () => api.listAdmissions(params),
  });

  const columns = [
    {
      key: "patient_name",
      label: "Patient",
      render: (row: AdmissionRow) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>{row.patient_name}</Text>
          <Text size="xs" c="dimmed">{row.uhid}</Text>
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
        <StatusDot color={statusColors[row.status] ?? "slate"} label={row.status} />
      ),
    },
    {
      key: "admitted_at",
      label: "Admitted",
      render: (row: AdmissionRow) => <Text size="sm">{new Date(row.admitted_at).toLocaleDateString()}</Text>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: AdmissionRow) => (
        <Tooltip label="View details">
          <ActionIcon variant="subtle" onClick={() => { setSelectedAdmissionId(row.id); openDetail(); }}>
            <IconEye size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

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
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
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
      />

      <CreateAdmissionDrawer opened={createOpened} onClose={closeCreate} />

      <Drawer opened={detailOpened} onClose={closeDetail} title="Admission Detail" position="right" size="xl">
        {selectedAdmissionId && (
          <AdmissionDetail
            admissionId={selectedAdmissionId}
            canCreate={canCreate}
            canManageBeds={canManageBeds}
            canDischarge={canDischarge}
          />
        )}
      </Drawer>
    </>
  );
}

function CreateAdmissionDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [bedId, setBedId] = useState("");
  const [notes, setNotes] = useState("");
  const [admissionSource, setAdmissionSource] = useState<string | null>(null);
  const [referralFrom, setReferralFrom] = useState("");
  const [referralDoctor, setReferralDoctor] = useState("");
  const [referralNotes, setReferralNotes] = useState("");
  const [weightKg, setWeightKg] = useState<number | string>("");
  const [heightCm, setHeightCm] = useState<number | string>("");
  const [expectedDischargeDate, setExpectedDischargeDate] = useState("");
  const [wardId, setWardId] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: CreateAdmissionRequest) => api.createAdmission(data),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      notifications.show({ title: "Admitted", message: "Patient admitted successfully", color: "success" });
      emit("admission.created", { patient_id: variables.patient_id, department_id: variables.department_id });
      onClose();
      setPatientId("");
      setDepartmentId("");
      setDoctorId("");
      setBedId("");
      setNotes("");
      setAdmissionSource(null);
      setReferralFrom("");
      setReferralDoctor("");
      setReferralNotes("");
      setWeightKg("");
      setHeightCm("");
      setExpectedDischargeDate("");
      setWardId("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create admission", color: "danger" });
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="New Admission" position="right" size="md">
      <Stack>
        <TextInput label="Patient ID" required value={patientId} onChange={(e) => setPatientId(e.currentTarget.value)} />
        <TextInput label="Department ID" required value={departmentId} onChange={(e) => setDepartmentId(e.currentTarget.value)} />
        <TextInput label="Doctor ID" value={doctorId} onChange={(e) => setDoctorId(e.currentTarget.value)} />
        <TextInput label="Bed ID" value={bedId} onChange={(e) => setBedId(e.currentTarget.value)} />
        <TextInput label="Ward ID" value={wardId} onChange={(e) => setWardId(e.currentTarget.value)} />
        <Select
          label="Admission Source"
          data={[
            { value: "er", label: "Emergency" },
            { value: "opd", label: "OPD" },
            { value: "direct", label: "Direct" },
            { value: "referral", label: "Referral" },
            { value: "transfer_in", label: "Transfer In" },
          ]}
          value={admissionSource}
          onChange={setAdmissionSource}
          clearable
        />
        {admissionSource === "referral" && (
          <>
            <TextInput label="Referral From" value={referralFrom} onChange={(e) => setReferralFrom(e.currentTarget.value)} />
            <TextInput label="Referral Doctor" value={referralDoctor} onChange={(e) => setReferralDoctor(e.currentTarget.value)} />
            <Textarea label="Referral Notes" value={referralNotes} onChange={(e) => setReferralNotes(e.currentTarget.value)} />
          </>
        )}
        <Group grow>
          <NumberInput label="Weight (kg)" value={weightKg} onChange={setWeightKg} min={0} max={500} decimalScale={2} />
          <NumberInput label="Height (cm)" value={heightCm} onChange={setHeightCm} min={0} max={300} decimalScale={2} />
        </Group>
        <TextInput
          label="Expected Discharge Date"
          type="date"
          value={expectedDischargeDate}
          onChange={(e) => setExpectedDischargeDate(e.currentTarget.value)}
        />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Button
          onClick={() =>
            createMutation.mutate({
              patient_id: patientId,
              department_id: departmentId,
              doctor_id: doctorId || undefined,
              bed_id: bedId || undefined,
              notes: notes || undefined,
              admission_source: (admissionSource as AdmissionSource) || undefined,
              referral_from: referralFrom || undefined,
              referral_doctor: referralDoctor || undefined,
              referral_notes: referralNotes || undefined,
              admission_weight_kg: weightKg ? Number(weightKg) : undefined,
              admission_height_cm: heightCm ? Number(heightCm) : undefined,
              expected_discharge_date: expectedDischargeDate || undefined,
              ward_id: wardId || undefined,
            })
          }
          loading={createMutation.isPending}
        >
          Admit Patient
        </Button>
      </Stack>
    </Drawer>
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
  const canCreateDischargeSummary = useHasPermission(P.IPD.DISCHARGE_SUMMARY_CREATE);
  const [dischargeSummaryOpened, { open: openDischargeSummary, close: closeDischargeSummary }] = useDisclosure(false);
  const [bedTransferOpened, { open: openBedTransfer, close: closeBedTransfer }] = useDisclosure(false);

  const { data } = useQuery({
    queryKey: ["admission-detail", admissionId],
    queryFn: () => api.getAdmission(admissionId),
  });

  if (!data) return <Text c="dimmed">Loading...</Text>;

  const detail = data as AdmissionDetailResponse;
  const adm = detail.admission;

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Text fw={700}>Admission: {adm.id.slice(0, 8)}...</Text>
          {adm.is_critical && <Badge color="danger" variant="filled" size="sm">CRITICAL</Badge>}
          {adm.mlc_case_id && <Badge color="orange" variant="filled" size="sm">MLC</Badge>}
        </Group>
        <Group gap="xs">
          <Badge color={statusColors[adm.status] ?? "slate"} variant="light" size="lg">
            {adm.status}
          </Badge>
          <PrintAdmissionButton admissionId={admissionId} />
          {canCreateDischargeSummary && adm.status === "admitted" && (
            <Tooltip label="Generate Discharge Summary">
              <Button size="xs" variant="light" color="teal" leftSection={<IconFileDescription size={14} />} onClick={openDischargeSummary}>
                Discharge Summary
              </Button>
            </Tooltip>
          )}
          {canManageBeds && adm.status === "admitted" && (
            <Tooltip label="Transfer Bed">
              <Button size="xs" variant="light" color="primary" leftSection={<IconArrowsTransferDown size={14} />} onClick={openBedTransfer}>
                Bed Transfer
              </Button>
            </Tooltip>
          )}
        </Group>
      </Group>

      <GenerateDischargeSummaryModal admissionId={admissionId} opened={dischargeSummaryOpened} onClose={closeDischargeSummary} />
      <BedTransferModal admissionId={admissionId} opened={bedTransferOpened} onClose={closeBedTransfer} />
      <Text size="sm">Admitted: {new Date(adm.admitted_at).toLocaleString()}</Text>
      {adm.discharged_at && <Text size="sm">Discharged: {new Date(adm.discharged_at).toLocaleString()}</Text>}
      {adm.provisional_diagnosis && <Text size="sm">Diagnosis: {adm.provisional_diagnosis}</Text>}
      {adm.admission_source && <Text size="sm">Source: {adm.admission_source}</Text>}

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="notes">Progress Notes</Tabs.Tab>
          <Tabs.Tab value="assessments">Clinical</Tabs.Tab>
          <Tabs.Tab value="mar">MAR</Tabs.Tab>
          <Tabs.Tab value="io">I/O Chart</Tabs.Tab>
          <Tabs.Tab value="nursing">Nursing</Tabs.Tab>
          <Tabs.Tab value="attenders">Attenders</Tabs.Tab>
          <Tabs.Tab value="clinical-docs">Clinical Docs</Tabs.Tab>
          <Tabs.Tab value="checklist">Checklist</Tabs.Tab>
          <Tabs.Tab value="transfer">Transfer</Tabs.Tab>
          <Tabs.Tab value="investigations">Investigations</Tabs.Tab>
          <Tabs.Tab value="billing-tab">Billing</Tabs.Tab>
          <Tabs.Tab value="insurance-pa">Insurance/PA</Tabs.Tab>
          <Tabs.Tab value="mlc-tab">MLC</Tabs.Tab>
          <Tabs.Tab value="diet-tab">Diet</Tabs.Tab>
          <Tabs.Tab value="consents-tab">Consents</Tabs.Tab>
          <Tabs.Tab value="death-summary">Death Summary</Tabs.Tab>
          <Tabs.Tab value="birth-records">Birth Records</Tabs.Tab>
          <Tabs.Tab value="discharge-summary">Discharge Summary</Tabs.Tab>
          <Tabs.Tab value="discharge">Discharge</Tabs.Tab>
          <Tabs.Tab value="discharge-tat">Discharge TAT</Tabs.Tab>
        </Tabs.List>

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
          <TransferTab admissionId={admissionId} canManage={canManageBeds} status={adm.status} />
          <TransferLogTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="investigations" pt="md">
          <InvestigationsTab admissionId={admissionId} />
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
          <DeathSummaryTab admissionId={admissionId} patientId={adm.patient_id} status={adm.status} />
        </Tabs.Panel>
        <Tabs.Panel value="birth-records" pt="md">
          <BirthRecordsTab admissionId={admissionId} motherPatientId={adm.patient_id} />
        </Tabs.Panel>
        <Tabs.Panel value="discharge-summary" pt="md">
          <DischargeSummaryTab admissionId={admissionId} canCreate={canCreateDischargeSummary} />
        </Tabs.Panel>
        <Tabs.Panel value="discharge" pt="md">
          <DischargeTab admissionId={admissionId} canDischarge={canDischarge} status={adm.status} />
        </Tabs.Panel>
        <Tabs.Panel value="discharge-tat" pt="md">
          <DischargeTatTab admissionId={admissionId} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

// ── Overview (tasks) ───────────────────────────────────

function OverviewTab({ admissionId, tasks, canCreate }: { admissionId: string; tasks: NursingTask[]; canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateNursingTaskRequest>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateNursingTaskRequest) => api.createNursingTask(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      setShowForm(false);
      setForm({});
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      api.updateNursingTask(admissionId, taskId, { is_completed: completed }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] }),
  });

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
            Add Task
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Select label="Task Type" required data={NURSING_TASK_TYPES} onChange={(v) => setForm({ ...form, task_type: v ?? "" })} searchable />
          <TextInput label="Description" required onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <TextInput label="Assigned To (User ID)" onChange={(e) => setForm({ ...form, assigned_to: e.currentTarget.value || undefined })} />
          <TextInput label="Notes" onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateNursingTaskRequest)} loading={createMutation.isPending}>
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
                  onChange={() => toggleMutation.mutate({ taskId: t.id, completed: !t.is_completed })}
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
  const [showForm, setShowForm] = useState(false);
  const [noteType, setNoteType] = useState("doctor_round");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");

  const { data } = useQuery({
    queryKey: ["ipd-progress-notes", admissionId],
    queryFn: () => api.listProgressNotes(admissionId),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.createProgressNote(admissionId, {
        note_type: noteType as ProgressNoteType,
        note_date: new Date().toISOString().split("T")[0],
        subjective: subjective || undefined,
        objective: objective || undefined,
        assessment: assessment || undefined,
        plan: plan || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-progress-notes", admissionId] });
      setShowForm(false);
      setSubjective("");
      setObjective("");
      setAssessment("");
      setPlan("");
    },
  });

  const notes = (data ?? []) as IpdProgressNote[];

  return (
    <Stack>
      {canCreate && (
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
          Add Note
        </Button>
      )}
      {showForm && (
        <Stack gap="xs">
          <Select
            label="Note Type"
            data={[
              { value: "doctor_round", label: "Doctor Round" },
              { value: "nursing_note", label: "Nursing Note" },
              { value: "specialist_opinion", label: "Specialist Opinion" },
              { value: "dietitian_note", label: "Dietitian Note" },
              { value: "physiotherapy_note", label: "Physiotherapy" },
              { value: "discharge_note", label: "Discharge Note" },
            ]}
            value={noteType}
            onChange={(v) => setNoteType(v ?? "doctor_round")}
          />
          <Textarea label="Subjective" value={subjective} onChange={(e) => setSubjective(e.currentTarget.value)} />
          <Textarea label="Objective" value={objective} onChange={(e) => setObjective(e.currentTarget.value)} />
          <Textarea label="Assessment" value={assessment} onChange={(e) => setAssessment(e.currentTarget.value)} />
          <Textarea label="Plan" value={plan} onChange={(e) => setPlan(e.currentTarget.value)} />
          <Button size="xs" onClick={() => mutation.mutate()} loading={mutation.isPending}>Save</Button>
        </Stack>
      )}
      {notes.map((n) => (
        <Stack key={n.id} gap="xs" p="xs" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
          <Group justify="space-between">
            <Badge size="sm">{n.note_type}</Badge>
            <Text size="xs" c="dimmed">{new Date(n.created_at).toLocaleString()}</Text>
          </Group>
          {n.subjective && <Text size="sm"><b>S:</b> {n.subjective}</Text>}
          {n.objective && <Text size="sm"><b>O:</b> {n.objective}</Text>}
          {n.assessment && <Text size="sm"><b>A:</b> {n.assessment}</Text>}
          {n.plan && <Text size="sm"><b>P:</b> {n.plan}</Text>}
        </Stack>
      ))}
      {notes.length === 0 && <Text c="dimmed" size="sm">No progress notes yet.</Text>}
    </Stack>
  );
}

// ── Clinical Assessments ───────────────────────────────

function AssessmentsTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.ASSESSMENTS_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [assessmentType, setAssessmentType] = useState("morse_fall_scale");
  const [scoreValue, setScoreValue] = useState("");
  const [riskLevel, setRiskLevel] = useState("");

  const { data } = useQuery({
    queryKey: ["ipd-assessments", admissionId],
    queryFn: () => api.listAssessments(admissionId),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.createAssessment(admissionId, {
        assessment_type: assessmentType as ClinicalAssessmentType,
        score_value: scoreValue ? Number(scoreValue) : undefined,
        risk_level: riskLevel || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-assessments", admissionId] });
      setShowForm(false);
      setScoreValue("");
      setRiskLevel("");
    },
  });

  const assessments = (data ?? []) as IpdClinicalAssessment[];

  const riskColors: Record<string, string> = { low: "success", moderate: "warning", high: "orange", critical: "danger" };

  return (
    <Stack>
      {canCreate && (
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
          Add Assessment
        </Button>
      )}
      {showForm && (
        <Stack gap="xs">
          <Select
            label="Assessment Type"
            data={[
              { value: "morse_fall_scale", label: "Morse Fall Scale" },
              { value: "braden_scale", label: "Braden Scale" },
              { value: "gcs", label: "GCS" },
              { value: "pain_vas", label: "Pain (VAS)" },
              { value: "pain_nrs", label: "Pain (NRS)" },
              { value: "news2", label: "NEWS2" },
              { value: "mews", label: "MEWS" },
            ]}
            value={assessmentType}
            onChange={(v) => setAssessmentType(v ?? "morse_fall_scale")}
          />
          <TextInput label="Score" value={scoreValue} onChange={(e) => setScoreValue(e.currentTarget.value)} />
          <Select
            label="Risk Level"
            data={["low", "moderate", "high", "critical"]}
            value={riskLevel}
            onChange={(v) => setRiskLevel(v ?? "")}
            clearable
          />
          <Button size="xs" onClick={() => mutation.mutate()} loading={mutation.isPending}>Save</Button>
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
              <Table.Td><Badge size="sm">{a.assessment_type}</Badge></Table.Td>
              <Table.Td>{a.score_value ?? "—"}</Table.Td>
              <Table.Td>
                {a.risk_level ? (
                  <Badge color={riskColors[a.risk_level] ?? "slate"} size="sm">{a.risk_level}</Badge>
                ) : "—"}
              </Table.Td>
              <Table.Td><Text size="xs">{new Date(a.assessed_at).toLocaleString()}</Text></Table.Td>
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
    queryFn: () => api.listMar(admissionId),
  });

  const marStatusColors: Record<string, string> = {
    scheduled: "primary",
    given: "success",
    held: "warning",
    refused: "orange",
    missed: "danger",
    self_administered: "teal",
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
                  <Text size="sm" fw={500}>{m.drug_name}</Text>
                  {m.is_high_alert && (
                    <Tooltip label="High-Alert Medication — requires double-check">
                      <Badge color="danger" size="xs" leftSection={<IconAlertTriangle size={10} />}>HIGH ALERT</Badge>
                    </Tooltip>
                  )}
                </Group>
              </Table.Td>
              <Table.Td><Text size="sm">{m.dose}</Text></Table.Td>
              <Table.Td><Text size="sm">{m.route}</Text></Table.Td>
              <Table.Td><Text size="xs">{new Date(m.scheduled_at).toLocaleString()}</Text></Table.Td>
              <Table.Td>
                <Badge color={marStatusColors[m.status] ?? "slate"} size="sm">{m.status}</Badge>
                {m.is_high_alert && m.status === "given" && !m.double_checked_by && (
                  <Badge color="orange" size="xs" ml={4}>Needs witness</Badge>
                )}
              </Table.Td>
              <Table.Td>
                {m.double_checked_by ? (
                  <Badge color="success" size="xs" variant="light">Verified</Badge>
                ) : m.is_high_alert ? (
                  <Badge color="slate" size="xs" variant="light">Pending</Badge>
                ) : null}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {rows.length === 0 && <Text c="dimmed" size="sm">No medication records yet.</Text>}
    </Stack>
  );
}

// ── I/O Chart ──────────────────────────────────────────

function IoChartTab({ admissionId }: { admissionId: string }) {
  const { data: ioData } = useQuery({
    queryKey: ["ipd-io", admissionId],
    queryFn: () => api.listIntakeOutput(admissionId),
  });
  const { data: balance } = useQuery({
    queryKey: ["ipd-io-balance", admissionId],
    queryFn: () => api.getIoBalance(admissionId),
  });

  const rows = (ioData ?? []) as IpdIntakeOutput[];

  return (
    <Stack>
      {balance && (
        <Group gap="lg">
          <Badge color="primary" size="lg">Intake: {balance.total_intake_ml} ml</Badge>
          <Badge color="orange" size="lg">Output: {balance.total_output_ml} ml</Badge>
          <Badge color={Number(balance.balance_ml) >= 0 ? "success" : "danger"} size="lg">
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
                <Badge color={r.is_intake ? "primary" : "orange"} size="sm">
                  {r.is_intake ? "Intake" : "Output"}
                </Badge>
              </Table.Td>
              <Table.Td><Text size="sm">{r.category}</Text></Table.Td>
              <Table.Td><Text size="sm">{r.volume_ml}</Text></Table.Td>
              <Table.Td><Text size="sm">{r.shift}</Text></Table.Td>
              <Table.Td><Text size="xs">{new Date(r.recorded_at).toLocaleString()}</Text></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {rows.length === 0 && <Text c="dimmed" size="sm">No intake/output records yet.</Text>}
    </Stack>
  );
}

// ── Nursing Tab (care plans + handovers) ───────────────

function NursingTab({ admissionId }: { admissionId: string }) {
  const { data: carePlans } = useQuery({
    queryKey: ["ipd-care-plans", admissionId],
    queryFn: () => api.listCarePlans(admissionId),
  });
  const { data: handovers } = useQuery({
    queryKey: ["ipd-handovers", admissionId],
    queryFn: () => api.listHandovers(admissionId),
  });

  const plans = (carePlans ?? []) as IpdCarePlan[];
  const reports = (handovers ?? []) as IpdHandoverReport[];

  return (
    <Stack>
      <Group justify="flex-end">
        <Button
          size="xs"
          variant="light"
          color="orange"
          leftSection={<IconAlertTriangle size={14} />}
          component="a"
          href="/quality"
          target="_blank"
        >
          Report Incident
        </Button>
      </Group>

      <Text fw={600} size="sm">Care Plans</Text>
      {plans.map((cp) => (
        <Stack key={cp.id} gap={4} p="xs" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
          <Group justify="space-between">
            <Text size="sm" fw={500}>{cp.nursing_diagnosis}</Text>
            <Badge size="xs" color={cp.status === "active" ? "success" : cp.status === "resolved" ? "slate" : "danger"}>
              {cp.status}
            </Badge>
          </Group>
          {cp.goals && <Text size="xs">Goals: {cp.goals}</Text>}
          {cp.evaluation && <Text size="xs">Eval: {cp.evaluation}</Text>}
        </Stack>
      ))}
      {plans.length === 0 && <Text c="dimmed" size="sm">No care plans yet.</Text>}

      <Text fw={600} size="sm" mt="md">Handover Reports (ISBAR)</Text>
      {reports.map((h) => (
        <Stack key={h.id} gap={4} p="xs" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
          <Group justify="space-between">
            <Badge size="xs">{h.shift} shift</Badge>
            <Text size="xs" c="dimmed">{h.handover_date}</Text>
            {h.acknowledged_at && <Badge size="xs" color="success">Acknowledged</Badge>}
          </Group>
          {h.situation && <Text size="xs"><b>S:</b> {h.situation}</Text>}
          {h.background && <Text size="xs"><b>B:</b> {h.background}</Text>}
          {h.assessment && <Text size="xs"><b>A:</b> {h.assessment}</Text>}
          {h.recommendation && <Text size="xs"><b>R:</b> {h.recommendation}</Text>}
        </Stack>
      ))}
      {reports.length === 0 && <Text c="dimmed" size="sm">No handover reports yet.</Text>}
    </Stack>
  );
}

// ── Attenders ──────────────────────────────────────────

function AttendersTab({ admissionId, canCreate }: { admissionId: string; canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [address, setAddress] = useState("");
  const [idProofType, setIdProofType] = useState("");
  const [idProofNumber, setIdProofNumber] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const { data } = useQuery({
    queryKey: ["ipd-attenders", admissionId],
    queryFn: () => api.listAttenders(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateAttenderRequest) => api.createAttender(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-attenders", admissionId] });
      setShowForm(false);
      setName("");
      setRelationship("");
      setPhone("");
      setAltPhone("");
      setAddress("");
      setIdProofType("");
      setIdProofNumber("");
      setIsPrimary(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attenderId: string) => api.deleteAttender(admissionId, attenderId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["ipd-attenders", admissionId] }),
  });

  const attenders = (data ?? []) as AdmissionAttender[];

  return (
    <Stack>
      {canCreate && (
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
          Add Attender
        </Button>
      )}
      {showForm && (
        <Stack gap="xs">
          <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput label="Relationship" required value={relationship} onChange={(e) => setRelationship(e.currentTarget.value)} />
          <Group grow>
            <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
            <TextInput label="Alt Phone" value={altPhone} onChange={(e) => setAltPhone(e.currentTarget.value)} />
          </Group>
          <Textarea label="Address" value={address} onChange={(e) => setAddress(e.currentTarget.value)} />
          <Group grow>
            <Select label="ID Proof Type" data={ID_PROOF_TYPES} value={idProofType || null} onChange={(v) => setIdProofType(v ?? "")} clearable searchable />
            <TextInput label="ID Proof Number" value={idProofNumber} onChange={(e) => setIdProofNumber(e.currentTarget.value)} />
          </Group>
          <Checkbox label="Primary attender" checked={isPrimary} onChange={(e) => setIsPrimary(e.currentTarget.checked)} />
          <Button
            size="xs"
            onClick={() =>
              createMutation.mutate({
                name,
                relationship,
                phone: phone || undefined,
                alt_phone: altPhone || undefined,
                address: address || undefined,
                id_proof_type: idProofType || undefined,
                id_proof_number: idProofNumber || undefined,
                is_primary: isPrimary || undefined,
              })
            }
            loading={createMutation.isPending}
          >
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
              <Table.Td><Text size="sm">{a.name}</Text></Table.Td>
              <Table.Td><Text size="sm">{a.relationship}</Text></Table.Td>
              <Table.Td><Text size="sm">{a.phone ?? "—"}</Text></Table.Td>
              <Table.Td>{a.is_primary && <Badge size="xs" color="primary">Primary</Badge>}</Table.Td>
              <Table.Td>
                {canCreate && (
                  <ActionIcon variant="subtle" color="danger" onClick={() => deleteMutation.mutate(a.id)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {attenders.length === 0 && <Text c="dimmed" size="sm">No attenders recorded yet.</Text>}
    </Stack>
  );
}

// ── Discharge Summary ─────────────────────────────────

function DischargeSummaryTab({ admissionId, canCreate }: { admissionId: string; canCreate: boolean }) {
  const canFinalize = useHasPermission(P.IPD.DISCHARGE_SUMMARY_FINALIZE);
  const queryClient = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["ipd-discharge-summary", admissionId],
    queryFn: () => api.getDischargeSummary(admissionId).catch(() => null),
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
    mutationFn: (d: CreateDischargeSummaryRequest) => api.createDischargeSummary(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-summary", admissionId] });
      setEditing(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (d: UpdateDischargeSummaryRequest) => api.updateDischargeSummary(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-summary", admissionId] });
      setEditing(false);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => api.finalizeDischargeSummary(admissionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-summary", admissionId] });
      notifications.show({ title: "Finalized", message: "Discharge summary finalized", color: "success" });
    },
  });

  if (summary && !editing) {
    return (
      <Stack>
        <Group justify="space-between">
          <Badge size="lg" color={summary.status === "finalized" ? "success" : "warning"}>
            {summary.status}
          </Badge>
          <Group>
            {summary.status === "draft" && canCreate && (
              <Button size="xs" variant="light" leftSection={<IconPencil size={14} />} onClick={() => {
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
              }}>
                Edit
              </Button>
            )}
            {summary.status === "draft" && canFinalize && (
              <Button size="xs" color="success" onClick={() => finalizeMutation.mutate()} loading={finalizeMutation.isPending}>
                Finalize
              </Button>
            )}
          </Group>
        </Group>
        {summary.final_diagnosis && <Text size="sm"><b>Diagnosis:</b> {summary.final_diagnosis}</Text>}
        {summary.condition_at_discharge && <Text size="sm"><b>Condition:</b> {summary.condition_at_discharge}</Text>}
        {summary.course_in_hospital && <Text size="sm"><b>Course:</b> {summary.course_in_hospital}</Text>}
        {summary.treatment_given && <Text size="sm"><b>Treatment:</b> {summary.treatment_given}</Text>}
        {summary.investigation_summary && <Text size="sm"><b>Investigations:</b> {summary.investigation_summary}</Text>}
        {summary.follow_up_instructions && <Text size="sm"><b>Follow-up:</b> {summary.follow_up_instructions}</Text>}
        {summary.follow_up_date && <Text size="sm"><b>Follow-up Date:</b> {summary.follow_up_date}</Text>}
        {summary.dietary_advice && <Text size="sm"><b>Diet:</b> {summary.dietary_advice}</Text>}
        {summary.activity_restrictions && <Text size="sm"><b>Activity:</b> {summary.activity_restrictions}</Text>}
        {summary.warning_signs && <Text size="sm"><b>Warning Signs:</b> {summary.warning_signs}</Text>}
        {summary.finalized_at && <Text size="xs" c="dimmed">Finalized: {new Date(summary.finalized_at).toLocaleString()}</Text>}
      </Stack>
    );
  }

  if (!canCreate) {
    return <Text c="dimmed" size="sm">No discharge summary. You do not have permission to create one.</Text>;
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
      <Text fw={600} size="sm">{summary ? "Edit Discharge Summary" : "Create Discharge Summary"}</Text>
      <Textarea label="Final Diagnosis" value={finalDiagnosis} onChange={(e) => setFinalDiagnosis(e.currentTarget.value)} autosize minRows={2} />
      <Textarea label="Condition at Discharge" value={conditionAtDischarge} onChange={(e) => setConditionAtDischarge(e.currentTarget.value)} />
      <Textarea label="Course in Hospital" value={courseInHospital} onChange={(e) => setCourseInHospital(e.currentTarget.value)} autosize minRows={3} />
      <Textarea label="Treatment Given" value={treatmentGiven} onChange={(e) => setTreatmentGiven(e.currentTarget.value)} autosize minRows={2} />
      <Textarea label="Investigation Summary" value={investigationSummary} onChange={(e) => setInvestigationSummary(e.currentTarget.value)} />
      <Textarea label="Follow-up Instructions" value={followUpInstructions} onChange={(e) => setFollowUpInstructions(e.currentTarget.value)} />
      <TextInput label="Follow-up Date" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.currentTarget.value)} />
      <Textarea label="Dietary Advice" value={dietaryAdvice} onChange={(e) => setDietaryAdvice(e.currentTarget.value)} />
      <Textarea label="Activity Restrictions" value={activityRestrictions} onChange={(e) => setActivityRestrictions(e.currentTarget.value)} />
      <Textarea label="Warning Signs" value={warningSigns} onChange={(e) => setWarningSigns(e.currentTarget.value)} />
      <Group>
        <Button onClick={handleSave} loading={createMutation.isPending || updateMutation.isPending}>
          Save
        </Button>
        {editing && <Button variant="subtle" onClick={() => setEditing(false)}>Cancel</Button>}
      </Group>
    </Stack>
  );
}

// ── Transfer ───────────────────────────────────────────

function TransferTab({ admissionId, canManage, status }: { admissionId: string; canManage: boolean; status: string }) {
  const queryClient = useQueryClient();
  const [bedId, setBedId] = useState("");
  const [notes, setNotes] = useState("");
  const emit = useClinicalEmit();

  const transferMutation = useMutation({
    mutationFn: () => api.transferBed(admissionId, { bed_id: bedId, notes: notes || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      notifications.show({ title: "Transferred", message: "Bed transfer recorded", color: "success" });
      emit("transfer.completed", { admission_id: admissionId, new_bed_id: bedId });
      setBedId("");
      setNotes("");
    },
  });

  if (status !== "admitted") {
    return <Text c="dimmed" size="sm">Transfer is only available for admitted patients.</Text>;
  }

  return (
    <Stack>
      {canManage ? (
        <>
          <TextInput label="New Bed ID" required value={bedId} onChange={(e) => setBedId(e.currentTarget.value)} />
          <Textarea label="Transfer Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
          <Button leftSection={<IconBed size={16} />} onClick={() => transferMutation.mutate()} loading={transferMutation.isPending}>
            Transfer Bed
          </Button>
        </>
      ) : (
        <Text c="dimmed" size="sm">You do not have permission to transfer beds.</Text>
      )}
    </Stack>
  );
}

// ── Discharge ──────────────────────────────────────────

function DischargeTab({ admissionId, canDischarge, status }: { admissionId: string; canDischarge: boolean; status: string }) {
  const queryClient = useQueryClient();
  const [dischargeType, setDischargeType] = useState<string>("normal");
  const [summary, setSummary] = useState("");
  const emit = useClinicalEmit();

  const { data: checklist } = useQuery({
    queryKey: ["ipd-discharge-checklist", admissionId],
    queryFn: () => api.listDischargeChecklist(admissionId),
  });

  const dischargeMutation = useMutation({
    mutationFn: () =>
      api.dischargePatient(admissionId, {
        discharge_type: dischargeType as DischargeType,
        discharge_summary: summary || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      notifications.show({ title: "Discharged", message: "Patient discharged", color: "success" });
      emit("discharge.completed", { admission_id: admissionId, discharge_type: dischargeType });
    },
  });

  if (status === "discharged" || status === "absconded" || status === "deceased") {
    return <Text c="dimmed" size="sm">This patient has already been discharged.</Text>;
  }

  const items = (checklist ?? []) as IpdDischargeChecklist[];

  return (
    <Stack>
      {items.length > 0 && (
        <>
          <Text fw={600} size="sm">Discharge Checklist</Text>
          {items.map((it) => (
            <Group key={it.id} gap="xs">
              <Checkbox checked={it.status === "completed"} readOnly size="xs" />
              <Text size="sm">{it.item_label}</Text>
              <Badge size="xs" color={it.status === "completed" ? "success" : it.status === "not_applicable" ? "slate" : "warning"}>
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
            data={[
              { value: "normal", label: "Normal" },
              { value: "lama", label: "LAMA" },
              { value: "dama", label: "DAMA" },
              { value: "absconded", label: "Absconded" },
              { value: "referred", label: "Referred" },
              { value: "deceased", label: "Deceased" },
            ]}
            value={dischargeType}
            onChange={(v) => setDischargeType(v ?? "normal")}
          />
          <Textarea label="Discharge Summary" value={summary} onChange={(e) => setSummary(e.currentTarget.value)} autosize minRows={3} />
          <Button color="danger" leftSection={<IconDoor size={16} />} onClick={() => dischargeMutation.mutate()} loading={dischargeMutation.isPending}>
            Discharge Patient
          </Button>
        </>
      ) : (
        <Text c="dimmed" size="sm">You do not have permission to discharge patients.</Text>
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
    queryFn: () => api.listWards(),
  });

  const wards = (data ?? []) as WardListRow[];

  const columns = [
    { key: "code", label: "Code", render: (row: WardListRow) => <Text size="sm" fw={500}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: WardListRow) => <Text size="sm">{row.name}</Text> },
    { key: "department_name", label: "Department", render: (row: WardListRow) => <Text size="sm">{row.department_name ?? "—"}</Text> },
    { key: "ward_type", label: "Type", render: (row: WardListRow) => <Badge size="sm" variant="light">{row.ward_type}</Badge> },
    {
      key: "beds",
      label: "Beds",
      render: (row: WardListRow) => (
        <Text size="sm">{row.vacant_beds}/{row.total_beds} available</Text>
      ),
    },
    { key: "is_active", label: "Active", render: (row: WardListRow) => <Badge size="xs" color={row.is_active ? "success" : "slate"}>{row.is_active ? "Yes" : "No"}</Badge> },
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
          <Button size="sm" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New Ward
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={wards}
        loading={isLoading}
        rowKey={(row) => row.id}
      />

      <CreateWardDrawer opened={createOpened} onClose={closeCreate} />
      <EditWardDrawer ward={editWard} onClose={() => setEditWard(null)} />

      <Drawer opened={!!selectedWardId} onClose={() => setSelectedWardId(null)} title="Ward Beds" position="right" size="lg">
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
    mutationFn: (d: CreateWardRequest) => api.createWard(d),
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
    <Drawer opened={opened} onClose={onClose} title="New Ward" position="right" size="md">
      <Stack>
        <TextInput label="Code" required value={code} onChange={(e) => setCode(e.currentTarget.value)} />
        <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Department ID" value={departmentId} onChange={(e) => setDepartmentId(e.currentTarget.value)} />
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
    mutationFn: (d: UpdateWardRequest) => api.updateWard(ward?.id ?? "", d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
      onClose();
    },
  });

  if (!ward) return null;

  return (
    <Drawer opened={!!ward} onClose={onClose} title={`Edit Ward: ${ward.code}`} position="right" size="md">
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
        <Checkbox label="Active" checked={isActive} onChange={(e) => setIsActive(e.currentTarget.checked)} />
        <Button
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
  const [bedLocationId, setBedLocationId] = useState("");
  const [bedTypeId, setBedTypeId] = useState("");

  const { data } = useQuery({
    queryKey: ["ipd-ward-beds", wardId],
    queryFn: () => api.listWardBeds(wardId),
  });

  const assignMutation = useMutation({
    mutationFn: () => api.assignBedToWard(wardId, { bed_location_id: bedLocationId, bed_type_id: bedTypeId || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-ward-beds", wardId] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
      setBedLocationId("");
      setBedTypeId("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (mappingId: string) => api.removeBedFromWard(wardId, mappingId),
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
          <TextInput placeholder="Bed Location ID" value={bedLocationId} onChange={(e) => setBedLocationId(e.currentTarget.value)} />
          <TextInput placeholder="Bed Type ID" value={bedTypeId} onChange={(e) => setBedTypeId(e.currentTarget.value)} />
          <Button size="sm" onClick={() => assignMutation.mutate()} loading={assignMutation.isPending}>
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
          {beds.map((b) => (
            <Table.Tr key={b.mapping_id}>
              <Table.Td><Text size="sm">{b.bed_name}</Text></Table.Td>
              <Table.Td><Text size="sm">{b.bed_type_name ?? "—"}</Text></Table.Td>
              <Table.Td><Badge size="xs" color={bedStatusColors[b.status] ?? "slate"}>{b.status}</Badge></Table.Td>
              <Table.Td>
                {b.patient_name ? (
                  <Stack gap={0}>
                    <Text size="xs">{b.patient_name}</Text>
                    <Text size="xs" c="dimmed">{b.patient_uhid}</Text>
                  </Stack>
                ) : "—"}
              </Table.Td>
              {canManage && (
                <Table.Td>
                  <Tooltip label="Remove from ward">
                    <ActionIcon variant="subtle" color="danger" onClick={() => removeMutation.mutate(b.mapping_id)} disabled={b.status === "occupied"}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {beds.length === 0 && <Text c="dimmed" size="sm">No beds assigned to this ward.</Text>}
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
    queryFn: () => api.listIpTypes(),
    enabled: expanded,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...rest }: { id: string; billing_alert_threshold?: number; auto_billing_enabled?: boolean }) =>
      api.updateIpType(id, rest),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-ip-types"] });
      notifications.show({ title: "Updated", message: "IP type configuration updated", color: "success" });
      setEditingId(null);
    },
  });

  const configs = (data ?? []) as IpTypeConfiguration[];

  return (
    <Card withBorder mt="md">
      <Group justify="space-between" p="sm" style={{ cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>
        <Text fw={600}>IP Type Configurations</Text>
        <Badge variant="light">{expanded ? "Hide" : "Show"}</Badge>
      </Group>
      {expanded && (
        <Stack p="sm" pt={0}>
          {isLoading ? (
            <Text c="dimmed">Loading...</Text>
          ) : configs.length === 0 ? (
            <Text c="dimmed" size="sm">No IP type configurations found.</Text>
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
                    <Table.Td><Badge size="sm" variant="light">{c.ip_type}</Badge></Table.Td>
                    <Table.Td><Text size="sm">{c.label}</Text></Table.Td>
                    <Table.Td><Text size="sm">{c.daily_rate}</Text></Table.Td>
                    <Table.Td><Text size="sm">{c.nursing_charge}</Text></Table.Td>
                    <Table.Td><Text size="sm">{c.deposit_required}</Text></Table.Td>
                    <Table.Td>
                      {editingId === c.id ? (
                        <NumberInput size="xs" value={editThreshold} onChange={setEditThreshold} w={120} />
                      ) : (
                        <Text size="sm">{c.billing_alert_threshold ?? "—"}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {editingId === c.id ? (
                        <Checkbox size="xs" checked={editAutoBilling} onChange={(e) => setEditAutoBilling(e.currentTarget.checked)} />
                      ) : (
                        <Badge size="xs" color={c.auto_billing_enabled ? "success" : "slate"}>{c.auto_billing_enabled ? "On" : "Off"}</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {editingId === c.id ? (
                        <Group gap={4}>
                          <Button size="xs" onClick={() => updateMutation.mutate({
                            id: c.id,
                            billing_alert_threshold: editThreshold ? Number(editThreshold) : undefined,
                            auto_billing_enabled: editAutoBilling,
                          })} loading={updateMutation.isPending}>Save</Button>
                          <Button size="xs" variant="subtle" onClick={() => setEditingId(null)}>Cancel</Button>
                        </Group>
                      ) : (
                        <ActionIcon variant="subtle" onClick={() => {
                          setEditingId(c.id);
                          setEditThreshold(c.billing_alert_threshold ?? "");
                          setEditAutoBilling(c.auto_billing_enabled);
                        }}>
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
  const canManageBeds = useHasPermission(P.IPD.BEDS_MANAGE);
  const queryClient = useQueryClient();
  const [filterWard, setFilterWard] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterIpType, setFilterIpType] = useState<string | null>(null);
  const [showTurnaround, setShowTurnaround] = useState(false);

  const { data: summaryData } = useQuery({
    queryKey: ["ipd-bed-dashboard-summary"],
    queryFn: () => api.bedDashboardSummary(),
  });

  const bedParams: Record<string, string> = {};
  if (filterWard) bedParams.ward_id = filterWard;
  if (filterStatus) bedParams.status = filterStatus;

  const { data: bedsData, isLoading } = useQuery({
    queryKey: ["ipd-bed-dashboard-beds", bedParams],
    queryFn: () => api.bedDashboardBeds(Object.keys(bedParams).length > 0 ? bedParams : undefined),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      api.updateBedStatus(bedId, { status }),
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
    { total: 0, vacant_clean: 0, vacant_dirty: 0, occupied: 0, reserved: 0, maintenance: 0, blocked: 0 },
  );

  const wardOptions = summaryRows
    .filter((r) => r.ward_id)
    .map((r) => ({ value: r.ward_id as string, label: r.ward_name ?? "Unknown" }));

  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, sm: 4, md: 7 }}>
        <Card withBorder p="xs"><Text size="xs" c="dimmed">Total</Text><Text fw={700}>{totals.total}</Text></Card>
        <Card withBorder p="xs"><Text size="xs" c="dimmed">Vacant (Clean)</Text><Text fw={700} c="success">{totals.vacant_clean}</Text></Card>
        <Card withBorder p="xs"><Text size="xs" c="dimmed">Vacant (Dirty)</Text><Text fw={700} c="warning">{totals.vacant_dirty}</Text></Card>
        <Card withBorder p="xs"><Text size="xs" c="dimmed">Occupied</Text><Text fw={700} c="primary">{totals.occupied}</Text></Card>
        <Card withBorder p="xs"><Text size="xs" c="dimmed">Reserved</Text><Text fw={700} c="orange">{totals.reserved}</Text></Card>
        <Card withBorder p="xs"><Text size="xs" c="dimmed">Maintenance</Text><Text fw={700} c="slate">{totals.maintenance}</Text></Card>
        <Card withBorder p="xs"><Text size="xs" c="dimmed">Blocked</Text><Text fw={700} c="danger">{totals.blocked}</Text></Card>
      </SimpleGrid>

      <Group>
        <Select
          placeholder="Filter by ward"
          data={wardOptions}
          value={filterWard}
          onChange={setFilterWard}
          clearable
          w={200}
        />
        <Select
          placeholder="Filter by status"
          data={["vacant_clean", "vacant_dirty", "occupied", "reserved", "maintenance", "blocked"]}
          value={filterStatus}
          onChange={setFilterStatus}
          clearable
          w={200}
        />
        <Select
          placeholder="Filter by unit type"
          data={[
            { value: "icu", label: "ICU" },
            { value: "nicu", label: "NICU" },
            { value: "picu", label: "PICU" },
            { value: "hdu", label: "HDU" },
            { value: "nursery", label: "Nursery" },
            { value: "isolation", label: "Isolation" },
          ]}
          value={filterIpType}
          onChange={setFilterIpType}
          clearable
          w={200}
        />
        <Button
          variant={showTurnaround ? "filled" : "light"}
          size="sm"
          onClick={() => setShowTurnaround((v) => !v)}
        >
          Bed Turnaround
        </Button>
      </Group>

      {showTurnaround && <BedTurnaroundView />}

      {isLoading ? (
        <Text c="dimmed">Loading beds...</Text>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }}>
          {beds.map((bed) => (
            <Card
              key={bed.bed_id}
              withBorder
              p="xs"
              style={{ borderLeft: `4px solid var(--mantine-color-${bedStatusColors[bed.status] ?? "slate"}-5)` }}
            >
              <Text size="sm" fw={600}>{bed.bed_name}</Text>
              <Text size="xs" c="dimmed">{bed.ward_name ?? "Unassigned"}</Text>
              <Badge size="xs" color={bedStatusColors[bed.status] ?? "slate"} mt={4}>
                {bed.status.replace("_", " ")}
              </Badge>
              {bed.patient_name && (
                <Stack gap={0} mt={4}>
                  <Text size="xs">{bed.patient_name}</Text>
                  <Text size="xs" c="dimmed">{bed.patient_uhid}</Text>
                </Stack>
              )}
              {canManageBeds && bed.status !== "occupied" && (
                <Select
                  size="xs"
                  mt={4}
                  placeholder="Change status"
                  data={["vacant_clean", "vacant_dirty", "maintenance", "blocked"].filter((s) => s !== bed.status)}
                  onChange={(v) => {
                    if (v) updateStatusMutation.mutate({ bedId: bed.bed_id, status: v });
                  }}
                  clearable
                />
              )}
            </Card>
          ))}
        </SimpleGrid>
      )}
      {beds.length === 0 && !isLoading && <Text c="dimmed" size="sm">No beds found.</Text>}
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
            <TextInput label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.currentTarget.value)} />
            <TextInput label="To" type="date" value={toDate} onChange={(e) => setToDate(e.currentTarget.value)} />
          </>
        )}
      </Group>

      {reportType === "census" && <CensusReport />}
      {reportType === "occupancy" && <OccupancyReport from={fromDate} to={toDate} />}
      {reportType === "alos" && <AlosReport from={fromDate} to={toDate} />}
      {reportType === "discharge-stats" && <DischargeStatsReport from={fromDate} to={toDate} />}
      {reportType === "surgeon-caseload" && <SurgeonCaseloadReport from={fromDate} to={toDate} />}
      {reportType === "anesthesia-complications" && <AnesthesiaComplicationsReport from={fromDate} to={toDate} />}
    </Stack>
  );
}

function CensusReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-census"],
    queryFn: () => api.reportCensus(),
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
          <Table.Tr><Table.Td colSpan={4}><Text c="dimmed">Loading...</Text></Table.Td></Table.Tr>
        ) : rows.map((r, i) => (
          <Table.Tr key={r.ward_id ?? `unassigned-${i}`}>
            <Table.Td><Text size="sm">{r.ward_name ?? "Unassigned"}</Text></Table.Td>
            <Table.Td><Text size="sm">{r.total_beds}</Text></Table.Td>
            <Table.Td><Text size="sm">{r.occupied}</Text></Table.Td>
            <Table.Td><Text size="sm">{r.vacant}</Text></Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function OccupancyReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-occupancy", from, to],
    queryFn: () => api.reportOccupancy({ from, to }),
    enabled: !!from && !!to,
  });

  if (!from || !to) return <Text c="dimmed" size="sm">Select a date range to view occupancy.</Text>;

  const rows = (data ?? []) as Array<{ ward_id: string | null; ward_name: string | null; total_beds: number; occupied_bed_days: number; total_bed_days: number; occupancy_pct: number }>;

  return (
    <Stack>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.map((r, i) => (
        <Card key={r.ward_id ?? `unassigned-${i}`} withBorder p="sm">
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={500}>{r.ward_name ?? "Unassigned"}</Text>
            <Text size="sm" fw={700}>{r.occupancy_pct.toFixed(1)}%</Text>
          </Group>
          <Progress value={r.occupancy_pct} size="lg" color={r.occupancy_pct > 90 ? "danger" : r.occupancy_pct > 70 ? "warning" : "success"} />
          <Text size="xs" c="dimmed" mt={4}>{r.occupied_bed_days} bed-days / {r.total_bed_days} total</Text>
        </Card>
      ))}
    </Stack>
  );
}

function AlosReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-alos", from, to],
    queryFn: () => api.reportAlos({ from, to }),
    enabled: !!from && !!to,
  });

  if (!from || !to) return <Text c="dimmed" size="sm">Select a date range to view ALOS.</Text>;

  const rows = (data ?? []) as Array<{ department_name: string | null; discharge_type: string; avg_los_days: number; count: number }>;

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
          <Table.Tr><Table.Td colSpan={4}><Text c="dimmed">Loading...</Text></Table.Td></Table.Tr>
        ) : rows.map((r, i) => (
          <Table.Tr key={`${r.department_name}-${r.discharge_type}-${i}`}>
            <Table.Td><Text size="sm">{r.department_name ?? "—"}</Text></Table.Td>
            <Table.Td><Badge size="sm">{r.discharge_type}</Badge></Table.Td>
            <Table.Td><Text size="sm" fw={500}>{r.avg_los_days.toFixed(1)}</Text></Table.Td>
            <Table.Td><Text size="sm">{r.count}</Text></Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function DischargeStatsReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-discharge-stats", from, to],
    queryFn: () => api.reportDischargeStats({ from, to }),
    enabled: !!from && !!to,
  });

  if (!from || !to) return <Text c="dimmed" size="sm">Select a date range to view discharge statistics.</Text>;

  const rows = (data ?? []) as Array<{ discharge_type: string; count: number }>;
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Stack>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.map((r) => (
        <Group key={r.discharge_type} justify="space-between" p="xs" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
          <Group>
            <Badge size="lg">{r.discharge_type}</Badge>
            <Text size="sm">{r.count} discharges</Text>
          </Group>
          <Text size="sm" c="dimmed">{total > 0 ? ((r.count / total) * 100).toFixed(1) : 0}%</Text>
        </Group>
      ))}
      {rows.length === 0 && <Text c="dimmed" size="sm">No discharges in this period.</Text>}
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
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [showRestraintForm, setShowRestraintForm] = useState<string | null>(null);
  const [restraintStatus, setRestraintStatus] = useState<string | null>(null);
  const [restraintNotes, setRestraintNotes] = useState("");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["ipd-clinical-docs", admissionId, filterType],
    queryFn: () => api.listClinicalDocs(admissionId, filterType ? { doc_type: filterType } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateClinicalDocRequest) => api.createClinicalDoc(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-clinical-docs", admissionId] });
      notifications.show({ title: "Created", message: "Clinical documentation saved", color: "success" });
      setShowForm(false);
      setDocType(null);
      setTitle("");
      setNotes("");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (docId: string) => api.resolveClinicalDoc(admissionId, docId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-clinical-docs", admissionId] });
      notifications.show({ title: "Resolved", message: "Documentation marked as resolved", color: "success" });
    },
  });

  const restraintMutation = useMutation({
    mutationFn: (data: CreateRestraintCheckRequest) => api.createRestraintCheck(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-clinical-docs", admissionId] });
      notifications.show({ title: "Recorded", message: "Restraint check logged", color: "success" });
      setShowRestraintForm(null);
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
          <Button leftSection={<IconPlus size={16} />} size="sm" onClick={() => setShowForm(true)}>
            Add Documentation
          </Button>
        )}
      </Group>

      {showForm && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <Select label="Type" data={DOC_TYPE_OPTIONS} value={docType} onChange={setDocType} required />
            <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
            {docType === "central_line" && (
              <Text size="xs" c="dimmed">Structured: insertion site (subclavian/jugular/femoral), line type, daily assessment — stored in body JSONB</Text>
            )}
            {docType === "catheter" && (
              <Text size="xs" c="dimmed">Structured: catheter type (Foley/suprapubic/condom), size, daily assessment — stored in body JSONB</Text>
            )}
            {docType === "transfusion" && (
              <Text size="xs" c="dimmed">Structured: blood product type, unit number, donation ID, pre-transfusion vitals, reaction monitoring — stored in body JSONB</Text>
            )}
            {docType === "restraint" && (
              <Text size="xs" c="dimmed">Structured: restraint type, reason, physician order. 30-min monitoring checks logged separately.</Text>
            )}
            {docType === "blood_transfusion_checklist" && (
              <Card withBorder p="xs" bg="blue.0">
                <Text size="xs" fw={500} mb={4}>Blood Transfusion Checklist (WHO Protocol)</Text>
                <Text size="xs" c="dimmed">Pre-transfusion: patient ID (2 identifiers), consent verified, blood group crossmatch, vitals (temp/BP/HR/RR/SpO2).</Text>
                <Text size="xs" c="dimmed">Interval checks: 15-min, 30-min, 60-min, 120-min — vitals + reaction monitoring at each.</Text>
                <Text size="xs" c="dimmed">Reaction types: febrile, allergic, hemolytic, TRALI, TACO, other. Severity + action taken logged.</Text>
              </Card>
            )}
            {docType === "elopement_risk" && (
              <Card withBorder p="xs" bg="orange.0">
                <Text size="xs" fw={500} mb={4}>Elopement Risk Assessment</Text>
                <Text size="xs" c="dimmed">Risk factors: psychiatric diagnosis, MLC patient, confused state, dementia, substance withdrawal, previous elopement, suicidal ideation.</Text>
                <Text size="xs" c="dimmed">Auto-scores risk (low/medium/high/critical). Precautions: 1:1 watch, door alarms, colored wristband, family notification.</Text>
              </Card>
            )}
            {docType === "dialysis" && (
              <Card withBorder p="xs" bg="teal.0">
                <Text size="xs" fw={500} mb={4}>Dialysis Nursing (Pre/Intra/Post)</Text>
                <Text size="xs" c="dimmed">Pre: dry weight, access type/site, machine params (blood flow, dialysate flow, UF goal).</Text>
                <Text size="xs" c="dimmed">Intra: hourly vitals, UF removed, machine alarms, interventions.</Text>
                <Text size="xs" c="dimmed">Post: post-weight, fluid removed, access site check, complications.</Text>
              </Card>
            )}
            {docType === "endoscopy" && (
              <Card withBorder p="xs" bg="grape.0">
                <Text size="xs" fw={500} mb={4}>Endoscopy Nursing (Aldrete Score)</Text>
                <Text size="xs" c="dimmed">Sedation: drugs (name, dose, time), sedation level. Monitoring: vitals at 5-min intervals.</Text>
                <Text size="xs" c="dimmed">Modified Aldrete: activity (0-2), respiration (0-2), circulation (0-2), consciousness (0-2), SpO2 (0-2).</Text>
                <Text size="xs" c="dimmed">Score 9+ = discharge ready. Complications: perforation, bleeding, aspiration, cardiopulmonary.</Text>
              </Card>
            )}
            {docType === "chemotherapy" && (
              <Card withBorder p="xs" bg="red.0">
                <Text size="xs" fw={500} mb={4}>Chemotherapy Administration (CTCAE Grading)</Text>
                <Text size="xs" c="dimmed">Protocol, cycle number, drug list, doses, infusion rates. Pre-medications administered.</Text>
                <Text size="xs" c="dimmed">Vitals: baseline + q15min x4 + q30min. Adverse reactions (CTCAE grade 1-5), extravasation check.</Text>
                <Badge size="xs" color="danger" variant="light" mt={4}>Requires chemo certification verification</Badge>
              </Card>
            )}
            <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
            <Group>
              <Button
                size="sm"
                onClick={() => createMutation.mutate({
                  doc_type: docType as IpdClinicalDocType,
                  title,
                  notes: notes || undefined,
                })}
                loading={createMutation.isPending}
                disabled={!docType || !title}
              >
                Save
              </Button>
              <Button size="sm" variant="subtle" onClick={() => setShowForm(false)}>Cancel</Button>
            </Group>
          </Stack>
        </Card>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">No clinical documentation recorded yet.</Text>
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
                <Table.Td><Badge size="sm" variant="light">{doc.doc_type.replace(/_/g, " ")}</Badge></Table.Td>
                <Table.Td><Text size="sm">{doc.title}</Text></Table.Td>
                <Table.Td><Text size="sm">{new Date(doc.recorded_at).toLocaleString()}</Text></Table.Td>
                <Table.Td>
                  {doc.is_resolved ? (
                    <Badge color="success" size="sm">Resolved</Badge>
                  ) : (
                    <Badge color="warning" size="sm">Active</Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {!doc.is_resolved && canCreate && (
                      <ActionIcon size="sm" variant="light" color="success" onClick={() => resolveMutation.mutate(doc.id)}>
                        <IconCheck size={14} />
                      </ActionIcon>
                    )}
                    {doc.doc_type === "restraint" && !doc.is_resolved && (
                      <>
                        <Button size="xs" variant="light" onClick={() => setShowRestraintForm(doc.id)}>
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

      {showRestraintForm && (
        <Card withBorder p="sm">
          <Text fw={500} size="sm" mb="xs">30-Minute Restraint Check</Text>
          <Stack gap="xs">
            <Select label="Status" data={RESTRAINT_STATUS_OPTIONS} value={restraintStatus} onChange={setRestraintStatus} required />
            <Textarea label="Notes" value={restraintNotes} onChange={(e) => setRestraintNotes(e.currentTarget.value)} />
            <Group>
              <Button
                size="sm"
                onClick={() => restraintMutation.mutate({
                  clinical_doc_id: showRestraintForm,
                  status: restraintStatus as RestraintCheckStatus,
                  notes: restraintNotes || undefined,
                })}
                loading={restraintMutation.isPending}
                disabled={!restraintStatus}
              >
                Record Check
              </Button>
              <Button size="sm" variant="subtle" onClick={() => setShowRestraintForm(null)}>Cancel</Button>
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
    queryFn: () => api.listAdmissionChecklist(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createAdmissionChecklist(admissionId, {
      items: [{ item_label: newLabel, category: newCategory || undefined }],
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-checklist", admissionId] });
      notifications.show({ title: "Added", message: "Checklist item added", color: "success" });
      setNewLabel("");
      setNewCategory("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      api.toggleChecklistItem(admissionId, itemId, { is_completed: completed }),
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
          <Progress value={rows.length > 0 ? (completed / rows.length) * 100 : 0} size="lg" w={200} />
        )}
      </Group>

      {canCreate && (
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
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newLabel} loading={createMutation.isPending}>
            Add
          </Button>
        </Group>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">No checklist items yet. Add items to track admission readiness.</Text>
      ) : (
        <Stack gap="xs">
          {rows.map((item: AdmissionChecklist) => (
            <Group key={item.id} p="xs" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
              <Checkbox
                checked={item.is_completed}
                onChange={(e) => toggleMutation.mutate({ itemId: item.id, completed: e.currentTarget.checked })}
              />
              <div style={{ flex: 1 }}>
                <Text size="sm" td={item.is_completed ? "line-through" : undefined}>{item.item_label}</Text>
                {item.category && <Text size="xs" c="dimmed">{item.category}</Text>}
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

function TransferLogTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.TRANSFERS_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [transferType, setTransferType] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");

  const { data: transfers, isLoading } = useQuery({
    queryKey: ["ipd-transfers", admissionId],
    queryFn: () => api.listTransfers(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTransferRequest) => api.createTransfer(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-transfers", admissionId] });
      notifications.show({ title: "Recorded", message: "Transfer logged", color: "success" });
      setShowForm(false);
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
          <Button size="sm" leftSection={<IconPlus size={16} />} onClick={() => setShowForm(true)}>
            Log Transfer
          </Button>
        )}
      </Group>

      {showForm && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <Select label="Transfer Type" data={TRANSFER_TYPE_OPTIONS} value={transferType} onChange={setTransferType} required />
            <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
            <Textarea label="Clinical Summary" value={clinicalSummary} onChange={(e) => setClinicalSummary(e.currentTarget.value)} />
            <Group>
              <Button
                size="sm"
                onClick={() => createMutation.mutate({
                  transfer_type: transferType as TransferType,
                  reason: reason || undefined,
                  clinical_summary: clinicalSummary || undefined,
                })}
                loading={createMutation.isPending}
                disabled={!transferType}
              >
                Save
              </Button>
              <Button size="sm" variant="subtle" onClick={() => setShowForm(false)}>Cancel</Button>
            </Group>
          </Stack>
        </Card>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">No transfers recorded.</Text>
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
                <Table.Td><Badge size="sm">{t.transfer_type.replace(/_/g, " ")}</Badge></Table.Td>
                <Table.Td><Text size="sm">{new Date(t.transferred_at).toLocaleString()}</Text></Table.Td>
                <Table.Td><Text size="sm">{t.reason ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="sm" lineClamp={2}>{t.clinical_summary ?? "—"}</Text></Table.Td>
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
    queryFn: () => api.getDischargeTat(admissionId),
    enabled: canView,
  });

  const initMutation = useMutation({
    mutationFn: () => api.initiateDischargeTat(admissionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-tat", admissionId] });
      notifications.show({ title: "Initiated", message: "Discharge TAT tracking started", color: "success" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.updateDischargeTat(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-tat", admissionId] });
      notifications.show({ title: "Updated", message: "Discharge milestone recorded", color: "success" });
    },
  });

  if (!canView) return <Text c="dimmed" size="sm">No permission to view discharge TAT.</Text>;
  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const log = tat as IpdDischargeTatLog | null;

  if (!log) {
    return (
      <Stack>
        <Text c="dimmed" size="sm">Discharge TAT tracking has not been initiated for this admission.</Text>
        <Button size="sm" onClick={() => initMutation.mutate()} loading={initMutation.isPending}>
          Start Discharge TAT Tracking
        </Button>
      </Stack>
    );
  }

  const milestones = [
    { key: "discharge_initiated_at", label: "Discharge Initiated", value: log.discharge_initiated_at },
    { key: "billing_cleared_at", label: "Billing Cleared", value: log.billing_cleared_at },
    { key: "pharmacy_cleared_at", label: "Pharmacy Cleared", value: log.pharmacy_cleared_at },
    { key: "nursing_cleared_at", label: "Nursing Cleared", value: log.nursing_cleared_at },
    { key: "doctor_cleared_at", label: "Doctor Cleared", value: log.doctor_cleared_at },
    { key: "discharge_completed_at", label: "Discharge Completed", value: log.discharge_completed_at },
  ];

  return (
    <Stack>
      <Text fw={500}>Discharge TAT Timeline</Text>
      {log.total_tat_minutes != null && (
        <Badge size="lg" color="primary" variant="light">Total TAT: {log.total_tat_minutes} minutes</Badge>
      )}
      <Stack gap="xs">
        {milestones.map((m) => (
          <Group key={m.key} p="xs" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }} justify="space-between">
            <Group>
              {m.value ? (
                <Badge color="success" size="sm" variant="dot">Done</Badge>
              ) : (
                <Badge color="slate" size="sm" variant="dot">Pending</Badge>
              )}
              <Text size="sm">{m.label}</Text>
            </Group>
            {m.value ? (
              <Text size="xs" c="dimmed">{new Date(m.value).toLocaleString()}</Text>
            ) : (
              <Button
                size="xs"
                variant="light"
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

function InvestigationsTab({ admissionId }: { admissionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-investigations", admissionId],
    queryFn: () => api.getAdmissionInvestigations(admissionId),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const inv = data as InvestigationsResponse | undefined;
  if (!inv) return <Text c="dimmed">No data.</Text>;

  return (
    <Stack>
      <Text fw={600}>Lab Orders ({inv.lab_orders.length})</Text>
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
                  <Table.Td><Text size="sm" fw={500}>{lo.test_name}</Text></Table.Td>
                  <Table.Td><Text size="xs">{new Date(lo.ordered_at).toLocaleDateString()}</Text></Table.Td>
                  <Table.Td><Badge size="sm" variant="light">{lo.status}</Badge></Table.Td>
                  <Table.Td>
                    {results.length > 0 ? (
                      <Stack gap={2}>
                        {results.map((r) => (
                          <Group key={r.id} gap={4}>
                            <Text size="xs" c={r.is_abnormal ? "danger" : undefined} fw={r.is_abnormal ? 600 : undefined}>
                              {r.parameter_name}: {r.value ?? "—"} {r.unit ?? ""}
                            </Text>
                            {r.reference_range && <Text size="xs" c="dimmed">({r.reference_range})</Text>}
                            {r.is_abnormal && <Badge color="danger" size="xs">Abnormal</Badge>}
                          </Group>
                        ))}
                      </Stack>
                    ) : (
                      <Text size="xs" c="dimmed">Pending</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">No lab orders during admission.</Text>
      )}

      <Text fw={600} mt="md">Radiology Orders ({inv.radiology_orders.length})</Text>
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
                <Table.Td><Text size="sm">{ro.modality}</Text></Table.Td>
                <Table.Td><Text size="sm">{ro.body_part ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="xs">{new Date(ro.ordered_at).toLocaleDateString()}</Text></Table.Td>
                <Table.Td><Badge size="sm" variant="light">{ro.status}</Badge></Table.Td>
                <Table.Td><Text size="xs">{ro.findings ?? "Pending"}</Text></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">No radiology orders during admission.</Text>
      )}
    </Stack>
  );
}

function BillingTab({ admissionId }: { admissionId: string }) {
  const { data: costData } = useQuery({
    queryKey: ["ipd-estimated-cost", admissionId],
    queryFn: () => api.getEstimatedCost(admissionId),
  });
  const { data: summaryData } = useQuery({
    queryKey: ["ipd-billing-summary", admissionId],
    queryFn: () => api.getAdmissionBillingSummary(admissionId),
  });
  const { data: advances } = useQuery({
    queryKey: ["ipd-advances", admissionId],
    queryFn: () => api.getAdmissionAdvances(admissionId),
  });
  const { data: ipTypes } = useQuery({
    queryKey: ["ipd-ip-types"],
    queryFn: () => api.listIpTypes(),
  });

  const cost = costData as EstimatedCostResponse | undefined;
  const billing = summaryData as BillingSummaryResponse | undefined;
  const ipTypeConfigs = (ipTypes ?? []) as IpTypeConfiguration[];
  const configWithThreshold = ipTypeConfigs.find((c) => c.billing_alert_threshold != null && c.billing_alert_threshold > 0);
  const thresholdExceeded = billing && configWithThreshold
    ? billing.total_charges > configWithThreshold.billing_alert_threshold!
    : false;

  return (
    <Stack>
      {thresholdExceeded && configWithThreshold && (
        <Card withBorder p="sm" bg="red.0" style={{ borderColor: "var(--mantine-color-red-4)" }}>
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
            <Text size="sm" fw={600} c="red.8">
              Billing Alert: Total charges ({billing?.total_charges}) exceed threshold ({configWithThreshold.billing_alert_threshold})
            </Text>
          </Group>
        </Card>
      )}

      {cost && (
        <Card withBorder p="sm">
          <Text fw={600} mb="xs">Estimated Cost</Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <div><Text size="xs" c="dimmed">Daily Rate</Text><Text fw={500}>{cost.daily_rate}</Text></div>
            <div><Text size="xs" c="dimmed">Nursing/day</Text><Text fw={500}>{cost.nursing_charge}</Text></div>
            <div><Text size="xs" c="dimmed">Est. Days</Text><Text fw={500}>{cost.estimated_days}</Text></div>
            <div><Text size="xs" c="dimmed">Deposit Required</Text><Text fw={500}>{cost.deposit_required}</Text></div>
          </SimpleGrid>
          <Group mt="xs">
            <Badge size="lg" color="primary" variant="light">Room: {cost.room_total}</Badge>
            <Badge size="lg" color="teal" variant="light">Nursing: {cost.nursing_total}</Badge>
            <Badge size="lg" color="primary" variant="filled">Total Est.: {cost.total_estimated}</Badge>
          </Group>
        </Card>
      )}

      {billing && (
        <Card withBorder p="sm">
          <Text fw={600} mb="xs">Charges Summary</Text>
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
                    <Table.Td><Text size="sm">{d.department_name}</Text></Table.Td>
                    <Table.Td style={{ textAlign: "right" }}><Text size="sm">{d.total}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="sm" c="dimmed">No charges recorded yet.</Text>
          )}
          <Group mt="sm">
            <Badge size="lg" variant="light">Charges: {billing.total_charges}</Badge>
            <Badge size="lg" color="success" variant="light">Payments: {billing.total_payments}</Badge>
            <Badge size="lg" color={billing.outstanding_balance > 0 ? "danger" : "success"} variant="filled">
              Outstanding: {billing.outstanding_balance}
            </Badge>
          </Group>
        </Card>
      )}

      <Card withBorder p="sm">
        <Text fw={600} mb="xs">Advance Payments</Text>
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
                  <Table.Td><Text size="sm">{r.receipt_number}</Text></Table.Td>
                  <Table.Td><Text size="sm">{String(r.amount)}</Text></Table.Td>
                  <Table.Td><Text size="xs">{new Date(r.receipt_date).toLocaleDateString()}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed">No advance payments recorded.</Text>
        )}
      </Card>
    </Stack>
  );
}

function InsurancePaTab({ admissionId }: { admissionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-prior-auth", admissionId],
    queryFn: () => api.getAdmissionPriorAuth(admissionId),
  });

  const paStatusColors: Record<string, string> = {
    draft: "slate", submitted: "primary", approved: "success",
    partially_approved: "warning", denied: "danger", cancelled: "dark",
    expired: "orange",
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
                <Table.Td><Text size="sm" fw={500}>{pa.pa_number}</Text></Table.Td>
                <Table.Td><Text size="sm">{pa.service_type}</Text></Table.Td>
                <Table.Td>
                  <Badge color={paStatusColors[pa.status] ?? "slate"} size="sm">
                    {pa.status}
                  </Badge>
                </Table.Td>
                <Table.Td><Badge size="sm" variant="light">{pa.urgency}</Badge></Table.Td>
                <Table.Td>
                  <Text size="xs">{pa.submitted_at ? new Date(pa.submitted_at).toLocaleDateString() : "—"}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">No prior authorization requests for this admission.</Text>
      )}
    </Stack>
  );
}

function MlcTab({ admissionId, canCreate }: { admissionId: string; canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [mlcIdInput, setMlcIdInput] = useState("");

  const { data: mlcData, isLoading } = useQuery({
    queryKey: ["ipd-mlc", admissionId],
    queryFn: () => api.getAdmissionMlc(admissionId),
  });

  const linkMutation = useMutation({
    mutationFn: (mlcCaseId: string) => api.linkMlc(admissionId, { mlc_case_id: mlcCaseId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-mlc", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      notifications.show({ title: "Linked", message: "MLC case linked to admission", color: "success" });
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
            <div><Text size="xs" c="dimmed">MLC Number</Text><Text fw={500}>{mlc.mlc_number}</Text></div>
            <div><Text size="xs" c="dimmed">Status</Text><Badge size="sm">{mlc.status}</Badge></div>
            <div><Text size="xs" c="dimmed">Case Type</Text><Text size="sm">{mlc.case_type ?? "—"}</Text></div>
            <div><Text size="xs" c="dimmed">FIR Number</Text><Text size="sm">{mlc.fir_number ?? "—"}</Text></div>
            <div><Text size="xs" c="dimmed">Police Station</Text><Text size="sm">{mlc.police_station ?? "—"}</Text></div>
            <div><Text size="xs" c="dimmed">Brought By</Text><Text size="sm">{mlc.brought_by ?? "—"}</Text></div>
          </SimpleGrid>
          {mlc.history_of_incident && (
            <div>
              <Text size="xs" c="dimmed" mt="xs">History of Incident</Text>
              <Text size="sm">{mlc.history_of_incident}</Text>
            </div>
          )}
        </Card>
      ) : (
        <>
          <Text size="sm" c="dimmed">No MLC case linked to this admission.</Text>
          {canCreate && (
            <Group>
              <TextInput
                placeholder="MLC Case ID"
                value={mlcIdInput}
                onChange={(e) => setMlcIdInput(e.currentTarget.value)}
                w={300}
              />
              <Button
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
    queryFn: () => api.getAdmissionDietOrders(admissionId),
  });

  const rows = (data ?? []) as DietOrder[];
  const dietTypeColors: Record<string, string> = {
    regular: "primary", soft: "teal", liquid: "info", npo: "danger",
    diabetic: "orange", renal: "violet", cardiac: "danger", custom: "slate",
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
                  <Badge color={dietTypeColors[d.diet_type] ?? "slate"} size="sm">{d.diet_type}</Badge>
                </Table.Td>
                <Table.Td><Badge variant="light" size="sm">{d.status}</Badge></Table.Td>
                <Table.Td>{d.is_npo ? <Badge color="danger" size="xs">NPO</Badge> : "—"}</Table.Td>
                <Table.Td><Text size="xs">{d.special_instructions ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="xs">{d.start_date}</Text></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">No diet orders for this admission.</Text>
      )}
    </Stack>
  );
}

function ConsentsTab({ admissionId }: { admissionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-consents", admissionId],
    queryFn: () => api.getAdmissionConsents(admissionId),
  });

  const rows = (data ?? []) as ProcedureConsent[];
  const consentStatusColors: Record<string, string> = {
    pending: "warning", signed: "success", refused: "danger", withdrawn: "orange", expired: "slate",
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
                <Table.Td><Text size="sm" fw={500}>{c.procedure_name}</Text></Table.Td>
                <Table.Td><Badge size="sm" variant="light">{c.consent_type}</Badge></Table.Td>
                <Table.Td>
                  <Badge color={consentStatusColors[c.status] ?? "slate"} size="sm">{c.status}</Badge>
                </Table.Td>
                <Table.Td><Text size="xs">{c.signed_at ? new Date(c.signed_at).toLocaleDateString() : "—"}</Text></Table.Td>
                <Table.Td><Text size="xs">{c.consented_by_name ?? "—"}</Text></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">No procedure consents for this encounter.</Text>
      )}
    </Stack>
  );
}

// ── Admission Print ────────────────────────────────────

function PrintAdmissionButton({ admissionId }: { admissionId: string }) {
  const [printing, setPrinting] = useState(false);
  const { data } = useQuery({
    queryKey: ["ipd-print", admissionId],
    queryFn: () => api.getAdmissionPrintData(admissionId),
    enabled: printing,
  });

  const printData = data as AdmissionPrintData | undefined;

  if (!printing) {
    return (
      <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />} onClick={() => setPrinting(true)}>
        Print Slip
      </Button>
    );
  }

  if (!printData) return <Text size="xs" c="dimmed">Loading print data...</Text>;

  return (
    <Drawer opened onClose={() => setPrinting(false)} title="Admission Slip" size="md">
      <Stack p="md" id="admission-slip-print">
        <Text ta="center" fw={700} size="lg">Admission Slip</Text>
        <SimpleGrid cols={2}>
          <div><Text size="xs" c="dimmed">Patient Name</Text><Text fw={500}>{printData.patient_name}</Text></div>
          <div><Text size="xs" c="dimmed">UHID</Text><Text fw={500}>{printData.uhid}</Text></div>
          <div><Text size="xs" c="dimmed">Age</Text><Text>{printData.age ?? "—"}</Text></div>
          <div><Text size="xs" c="dimmed">Gender</Text><Text>{printData.gender ?? "—"}</Text></div>
          <div><Text size="xs" c="dimmed">Admission Date</Text><Text>{new Date(printData.admission_date).toLocaleString()}</Text></div>
          <div><Text size="xs" c="dimmed">Ward</Text><Text>{printData.ward_name ?? "—"}</Text></div>
          <div><Text size="xs" c="dimmed">Bed</Text><Text>{printData.bed_number ?? "—"}</Text></div>
          <div><Text size="xs" c="dimmed">Department</Text><Text>{printData.department_name ?? "—"}</Text></div>
          <div><Text size="xs" c="dimmed">Attending Doctor</Text><Text>{printData.doctor_name ?? "—"}</Text></div>
          <div><Text size="xs" c="dimmed">IP Type</Text><Text>{printData.ip_type ?? "—"}</Text></div>
        </SimpleGrid>
        {printData.provisional_diagnosis && (
          <div>
            <Text size="xs" c="dimmed">Provisional Diagnosis</Text>
            <Text>{printData.provisional_diagnosis}</Text>
          </div>
        )}
        <Button mt="md" onClick={() => window.print()}>Print</Button>
      </Stack>
    </Drawer>
  );
}

// ── Bed Turnaround View ────────────────────────────────

function BedTurnaroundView() {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-bed-turnaround-recent"],
    queryFn: () => api.listBedTurnaround(),
  });

  const rows = (data ?? []) as BedTurnaroundLog[];
  const avgTat = rows.length > 0
    ? Math.round(rows.filter((r) => r.turnaround_minutes != null).reduce((sum, r) => sum + (r.turnaround_minutes ?? 0), 0) / Math.max(rows.filter((r) => r.turnaround_minutes != null).length, 1))
    : 0;

  return (
    <Card withBorder p="sm">
      <Group justify="space-between" mb="xs">
        <Text fw={600}>Bed Turnaround Log</Text>
        {avgTat > 0 && <Badge size="lg" color="primary" variant="light">Avg TAT: {avgTat} min</Badge>}
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
                <Table.Td><Text size="sm">{r.bed_id.slice(0, 8)}</Text></Table.Td>
                <Table.Td><Text size="xs">{r.vacated_at ? new Date(r.vacated_at).toLocaleString() : "—"}</Text></Table.Td>
                <Table.Td><Text size="xs">{r.cleaning_started_at ? new Date(r.cleaning_started_at).toLocaleString() : "—"}</Text></Table.Td>
                <Table.Td><Text size="xs">{r.cleaning_completed_at ? new Date(r.cleaning_completed_at).toLocaleString() : "—"}</Text></Table.Td>
                <Table.Td>
                  {r.turnaround_minutes != null ? (
                    <Badge color={r.turnaround_minutes <= 60 ? "success" : "orange"} size="sm">{r.turnaround_minutes}</Badge>
                  ) : (
                    <Badge color="warning" size="sm">In progress</Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">No turnaround records.</Text>
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
    queryFn: () => api.listRestraintChecks(admissionId, docId),
    refetchInterval: 60_000,
  });

  const checks = (data ?? []) as RestraintMonitoringLog[];
  const lastCheck = checks.length > 0 ? checks[checks.length - 1] : null;
  const isOverdue = lastCheck
    ? (Date.now() - new Date(lastCheck.check_time).getTime()) > 30 * 60 * 1000
    : true;

  return (
    <Group gap={4}>
      <Badge size="xs" variant="light">{checks.length} checks</Badge>
      {lastCheck && (
        <Tooltip label={`Last: ${new Date(lastCheck.check_time).toLocaleString()} — ${lastCheck.status.replace(/_/g, " ")}`}>
          <Badge size="xs" color={isOverdue ? "danger" : "success"} variant="filled">
            {isOverdue ? "OVERDUE" : "OK"}
          </Badge>
        </Tooltip>
      )}
      {!lastCheck && <Badge size="xs" color="danger" variant="filled">No checks</Badge>}
    </Group>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 3b — Death Summary Tab
// ══════════════════════════════════════════════════════════

function DeathSummaryTab({ admissionId, patientId, status }: { admissionId: string; patientId: string; status: string }) {
  const canCreate = useHasPermission(P.IPD.CLINICAL_DOCS_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
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
    queryFn: () => api.getDeathSummary(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateDeathSummaryRequest) => api.createDeathSummary(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-death-summary", admissionId] });
      notifications.show({ title: "Created", message: "Death summary recorded", color: "success" });
      setShowForm(false);
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
            <div><Text size="xs" c="dimmed">Date of Death</Text><Text fw={500}>{summary.date_of_death}</Text></div>
            <div><Text size="xs" c="dimmed">Time of Death</Text><Text fw={500}>{summary.time_of_death}</Text></div>
            <div><Text size="xs" c="dimmed">Primary Cause</Text><Text size="sm">{summary.cause_of_death_primary ?? "—"}</Text></div>
            <div><Text size="xs" c="dimmed">Secondary Cause</Text><Text size="sm">{summary.cause_of_death_secondary ?? "—"}</Text></div>
            <div><Text size="xs" c="dimmed">Underlying Cause</Text><Text size="sm">{summary.cause_of_death_underlying ?? "—"}</Text></div>
            <div><Text size="xs" c="dimmed">Manner of Death</Text><Text size="sm">{summary.manner_of_death ?? "—"}</Text></div>
            <div><Text size="xs" c="dimmed">Form Type</Text><Badge size="sm">{summary.form_type === "form_4" ? "Form 4 (Institutional)" : "Form 4a (Non-Institutional)"}</Badge></div>
            <div>
              <Text size="xs" c="dimmed">Flags</Text>
              <Group gap={4}>
                {summary.autopsy_requested && <Badge size="xs" color="orange">Autopsy Requested</Badge>}
                {summary.is_medico_legal && <Badge size="xs" color="danger">Medico-Legal</Badge>}
              </Group>
            </div>
          </SimpleGrid>
          {summary.notes && <div><Text size="xs" c="dimmed" mt="xs">Notes</Text><Text size="sm">{summary.notes}</Text></div>}
        </Card>
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Death Summary</Text>
        {canCreate && status === "deceased" && !showForm && (
          <Button size="sm" leftSection={<IconPlus size={16} />} onClick={() => setShowForm(true)}>
            Create Death Summary
          </Button>
        )}
      </Group>

      {status !== "deceased" && <Text size="sm" c="dimmed">Death summary is only applicable for deceased patients.</Text>}

      {showForm && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Date of Death" type="date" value={dateOfDeath} onChange={(e) => setDateOfDeath(e.currentTarget.value)} required />
              <TextInput label="Time of Death" type="time" value={timeOfDeath} onChange={(e) => setTimeOfDeath(e.currentTarget.value)} required />
            </SimpleGrid>
            <TextInput label="Primary Cause of Death (ICD)" value={causePrimary} onChange={(e) => setCausePrimary(e.currentTarget.value)} required />
            <TextInput label="Secondary Cause" value={causeSecondary} onChange={(e) => setCauseSecondary(e.currentTarget.value)} />
            <TextInput label="Underlying Cause" value={causeUnderlying} onChange={(e) => setCauseUnderlying(e.currentTarget.value)} />
            <TextInput label="Manner of Death" value={mannerOfDeath} onChange={(e) => setMannerOfDeath(e.currentTarget.value)} placeholder="Natural / Accident / Suicide / Homicide / Undetermined" />
            <Select label="Certificate Form" data={[{ value: "form_4", label: "Form 4 (Institutional)" }, { value: "form_4a", label: "Form 4a (Non-Institutional)" }]} value={formType} onChange={setFormType} />
            <Group>
              <Checkbox label="Autopsy Requested" checked={autopsyRequested} onChange={(e) => setAutopsyRequested(e.currentTarget.checked)} />
              <Checkbox label="Medico-Legal Case" checked={isMedicoLegal} onChange={(e) => setIsMedicoLegal(e.currentTarget.checked)} />
            </Group>
            <TextInput label="Witness Name" value={witnessName} onChange={(e) => setWitnessName(e.currentTarget.value)} />
            <Textarea label="Notes" value={dsNotes} onChange={(e) => setDsNotes(e.currentTarget.value)} />
            <Group>
              <Button
                size="sm"
                onClick={() => createMutation.mutate({
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
                })}
                loading={createMutation.isPending}
                disabled={!dateOfDeath || !timeOfDeath}
              >
                Save Death Summary
              </Button>
              <Button size="sm" variant="subtle" onClick={() => setShowForm(false)}>Cancel</Button>
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

function BirthRecordsTab({ admissionId, motherPatientId }: { admissionId: string; motherPatientId: string }) {
  const canCreate = useHasPermission(P.IPD.CLINICAL_DOCS_CREATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
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
    queryFn: () => api.listBirthRecords(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateBirthRecordRequest) => api.createBirthRecord(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-birth-records", admissionId] });
      notifications.show({ title: "Created", message: "Birth record saved", color: "success" });
      setShowForm(false);
      setDob(""); setTob(""); setGender(null); setWeightGrams(""); setLengthCm("");
      setHeadCirc(""); setApgar1(""); setApgar5(""); setDeliveryType(null);
      setCertNumber(""); setComplications(""); setBrNotes("");
    },
  });

  const records = (data ?? []) as IpdBirthRecord[];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Birth Records</Text>
        {canCreate && (
          <Button size="sm" leftSection={<IconPlus size={16} />} onClick={() => setShowForm(true)}>
            Add Birth Record
          </Button>
        )}
      </Group>

      {showForm && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Date of Birth" type="date" value={dob} onChange={(e) => setDob(e.currentTarget.value)} required />
              <TextInput label="Time of Birth" type="time" value={tob} onChange={(e) => setTob(e.currentTarget.value)} required />
              <Select label="Gender" data={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "indeterminate", label: "Indeterminate" }]} value={gender} onChange={setGender} />
              <Select label="Delivery Type" data={[{ value: "vaginal", label: "Normal Vaginal" }, { value: "lscs", label: "LSCS (C-Section)" }, { value: "assisted", label: "Assisted (Forceps/Vacuum)" }, { value: "breech", label: "Breech" }]} value={deliveryType} onChange={setDeliveryType} />
              <NumberInput label="Weight (grams)" value={weightGrams} onChange={setWeightGrams} min={0} />
              <NumberInput label="Length (cm)" value={lengthCm} onChange={setLengthCm} min={0} />
              <NumberInput label="Head Circumference (cm)" value={headCirc} onChange={setHeadCirc} min={0} />
              <Group>
                <NumberInput label="Apgar 1 min" value={apgar1} onChange={setApgar1} min={0} max={10} w={100} />
                <NumberInput label="Apgar 5 min" value={apgar5} onChange={setApgar5} min={0} max={10} w={100} />
              </Group>
            </SimpleGrid>
            <Checkbox label="Live Birth" checked={isLiveBirth} onChange={(e) => setIsLiveBirth(e.currentTarget.checked)} />
            <TextInput label="Birth Certificate Number" value={certNumber} onChange={(e) => setCertNumber(e.currentTarget.value)} />
            <Textarea label="Complications" value={complications} onChange={(e) => setComplications(e.currentTarget.value)} />
            <Textarea label="Notes" value={brNotes} onChange={(e) => setBrNotes(e.currentTarget.value)} />
            <Group>
              <Button
                size="sm"
                onClick={() => createMutation.mutate({
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
                })}
                loading={createMutation.isPending}
                disabled={!dob || !tob}
              >
                Save
              </Button>
              <Button size="sm" variant="subtle" onClick={() => setShowForm(false)}>Cancel</Button>
            </Group>
          </Stack>
        </Card>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : records.length === 0 ? (
        <Text c="dimmed" size="sm">No birth records for this admission.</Text>
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
                <Table.Td><Text size="sm">{r.date_of_birth} {r.time_of_birth}</Text></Table.Td>
                <Table.Td><Badge size="sm" color={r.gender === "male" ? "primary" : r.gender === "female" ? "danger" : "slate"}>{r.gender ?? "—"}</Badge></Table.Td>
                <Table.Td><Text size="sm">{r.weight_grams ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="sm">{r.delivery_type ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="sm">{r.apgar_1min != null ? `${r.apgar_1min}/${r.apgar_5min}` : "—"}</Text></Table.Td>
                <Table.Td>{r.is_live_birth ? <Badge color="success" size="xs">Yes</Badge> : <Badge color="danger" size="xs">No</Badge>}</Table.Td>
                <Table.Td><Text size="sm">{r.birth_certificate_number ?? "—"}</Text></Table.Td>
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
    queryFn: () => api.getSurgeonCaseload({ from: from || undefined, to: to || undefined }),
  });

  const rows = (data ?? []) as SurgeonCaseloadEntry[];

  return (
    <Stack>
      <Text fw={500}>Surgeon Caseload Analysis</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">No OT case records in this period.</Text>
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
                <Table.Td><Text size="sm" fw={500}>{r.surgeon_name}</Text></Table.Td>
                <Table.Td><Text size="sm">{r.total_cases}</Text></Table.Td>
                <Table.Td><Text size="sm">{r.avg_duration_minutes != null ? Math.round(r.avg_duration_minutes) : "—"}</Text></Table.Td>
                <Table.Td>
                  {r.complication_count > 0 ? (
                    <Badge color="danger" size="sm">{r.complication_count}</Badge>
                  ) : (
                    <Badge color="success" size="sm">0</Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  {r.cancellation_count > 0 ? (
                    <Badge color="orange" size="sm">{r.cancellation_count}</Badge>
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

function GenerateDischargeSummaryModal({ admissionId, opened, onClose }: { admissionId: string; opened: boolean; onClose: () => void }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["generated-discharge-summary", admissionId],
    queryFn: () => api.generateDischargeSummary(admissionId),
    enabled: false,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.generateDischargeSummary(admissionId),
    onSuccess: () => {
      refetch();
      notifications.show({ title: "Generated", message: "Discharge summary generated", color: "success" });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to generate discharge summary", color: "danger" });
    },
  });

  const summary = data as DischargeSummaryGenerated | undefined;

  return (
    <Modal opened={opened} onClose={onClose} title="Discharge Summary" size="lg">
      <Stack>
        {!summary && !isLoading && (
          <Button onClick={() => generateMutation.mutate()} loading={generateMutation.isPending}>
            Generate Discharge Summary
          </Button>
        )}
        {(isLoading || generateMutation.isPending) && <Text c="dimmed">Generating...</Text>}
        {summary && (
          <Stack gap="sm">
            <Group>
              <Text fw={600}>Patient:</Text>
              <Text>{summary.patient_name}</Text>
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
                {summary.diagnoses.map((d, i) => (
                  <Badge key={i} variant="light" size="sm">{d}</Badge>
                ))}
              </Stack>
            )}
            {summary.procedures.length > 0 && (
              <Stack gap={2}>
                <Text fw={600}>Procedures:</Text>
                {summary.procedures.map((p, i) => (
                  <Badge key={i} variant="light" color="primary" size="sm">{p}</Badge>
                ))}
              </Stack>
            )}
            {summary.medications.length > 0 && (
              <Stack gap={2}>
                <Text fw={600}>Medications at Discharge:</Text>
                {summary.medications.map((m, i) => (
                  <Badge key={i} variant="light" color="success" size="sm">{m}</Badge>
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

function BedTransferModal({ admissionId, opened, onClose }: { admissionId: string; opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [toBedId, setToBedId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const transferMutation = useMutation({
    mutationFn: (data: BedTransferRequest) => api.bedTransfer(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      void queryClient.invalidateQueries({ queryKey: ["bed-dashboard"] });
      notifications.show({ title: "Transferred", message: "Bed transfer completed", color: "success" });
      onClose();
      setToBedId("");
      setReason("");
      setNotes("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to transfer bed", color: "danger" });
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Bed Transfer" size="md">
      <Stack>
        <TextInput
          label="Target Bed ID"
          placeholder="Enter the bed UUID to transfer to"
          value={toBedId}
          onChange={(e) => setToBedId(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Reason"
          placeholder="Reason for transfer"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          required
        />
        <Textarea
          label="Notes"
          placeholder="Optional transfer notes"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />
        <Button
          onClick={() => transferMutation.mutate({ to_bed_id: toBedId, reason, notes: notes || undefined })}
          loading={transferMutation.isPending}
          disabled={!toBedId.trim() || !reason.trim()}
        >
          Transfer
        </Button>
      </Stack>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Expected Discharges Tab ───────────────────────────────
// ═══════════════════════════════════════════════════════════

function ExpectedDischargesTab() {
  const [hours, setHours] = useState<number | string>(48);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["expected-discharges", hours],
    queryFn: () => api.expectedDischarges({ hours: typeof hours === "number" ? hours : 48 }),
  });

  const columns = [
    {
      key: "patient_name",
      label: "Patient",
      render: (row: ExpectedDischargeRow) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>{row.patient_name}</Text>
          <Text size="xs" c="dimmed">{row.patient_id.slice(0, 8)}...</Text>
        </Stack>
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
      render: (row: ExpectedDischargeRow) => <Text size="sm">{new Date(row.expected_discharge_date).toLocaleString()}</Text>,
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
        <Badge color={row.days_admitted > 14 ? "danger" : row.days_admitted > 7 ? "orange" : "primary"} variant="light" size="sm">
          {row.days_admitted} days
        </Badge>
      ),
    },
  ];

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
        <Text size="sm" c="dimmed" ta="center">No expected discharges within the next {typeof hours === "number" ? hours : 48} hours.</Text>
      )}
    </Stack>
  );
}

function AnesthesiaComplicationsReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ot-anesthesia-complications", from, to],
    queryFn: () => api.listAnesthesiaComplications({ from: from || undefined, to: to || undefined }),
  });

  const rows = (data ?? []) as AnesthesiaComplicationEntry[];

  return (
    <Stack>
      <Text fw={500}>Anesthesia Complications</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">No anesthesia complications recorded in this period.</Text>
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
            {rows.map((r) => (
              <Table.Tr key={r.case_id}>
                <Table.Td><Text size="sm">{r.case_date}</Text></Table.Td>
                <Table.Td><Text size="sm" fw={500}>{r.patient_name}</Text></Table.Td>
                <Table.Td><Text size="sm">{r.procedure_name}</Text></Table.Td>
                <Table.Td><Badge size="sm" variant="light">{r.anesthesia_type}</Badge></Table.Td>
                <Table.Td>
                  <Text size="sm" c="danger" lineClamp={2}>{r.complications ?? "—"}</Text>
                  {r.adverse_events != null && typeof r.adverse_events === "object" ? (
                    <Badge size="xs" color="danger" variant="light" mt={2}>Has adverse events</Badge>
                  ) : null}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
