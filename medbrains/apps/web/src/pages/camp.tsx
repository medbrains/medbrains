import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart } from "@mantine/charts";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  CampClinicalVisitFormInput,
  CampCreateFormInput,
  CampFollowupFormInput,
  CampLabSampleFormInput,
  CampRegistrationFormInput,
  CampScreeningFormInput,
} from "@medbrains/schemas";
import {
  campClinicalVisitFormSchema,
  campCreateFormSchema,
  campFollowupFormSchema,
  campLabSampleFormSchema,
  campRegistrationFormSchema,
  campScreeningFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  Camp,
  CampAnalytics as CampAnalyticsType,
  CampFollowup,
  CampIncident,
  CampLabSample,
  CampOpenEncounterResponse,
  CampRegistration,
  CampReport as CampReportType,
  CampScreening,
  CampSupplyItem,
  CampTeamMember,
  ClinicalJourneyContext,
  CreateCampFollowupRequest,
  CreateCampLabSampleRequest,
  CreateCampRegistrationRequest,
  CreateCampRequest,
  CreateCampScreeningRequest,
  CreateVitalRequest,
  DepartmentRow,
  UpdateCampFollowupRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconArrowRight,
  IconCalendarCheck,
  IconChartBar,
  IconCheck,
  IconDownload,
  IconFirstAidKit,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconSearch,
  IconStethoscope,
  IconTransferIn,
  IconTrash,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { DataTable, DoctorSearchSelect, PageHeader } from "@/components";
import { VitalsRecorder } from "@/components/Clinical/VitalsRecorder";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import {
  campFollowupTypeOptions,
  campIdProofTypeOptions,
  campOptionalInteger,
  campOptionalNumber,
  campOptionalText,
  campTypeOptions,
} from "@/forms/camp.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { EncounterDetail } from "@/pages/opd";
import { campService } from "@/services/camp.service";
import { lookupsService } from "@/services/lookups.service";

// ── Constants ──────────────────────────────────────────

const CAMP_STATUS_COLORS: Record<string, string> = {
  planned: "slate",
  approved: "primary",
  setup: "primary",
  active: "success",
  completed: "teal",
  cancelled: "danger",
};

const REG_STATUS_COLORS: Record<string, string> = {
  registered: "slate",
  screened: "primary",
  referred: "orange",
  converted: "success",
  no_show: "danger",
};

const FOLLOWUP_STATUS_COLORS: Record<string, string> = {
  scheduled: "primary",
  completed: "success",
  missed: "danger",
  cancelled: "slate",
};

const TEAM_ROLES = [
  { value: "coordinator", label: "Coordinator" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "lab_tech", label: "Lab Technician" },
  { value: "volunteer", label: "Volunteer" },
  { value: "driver", label: "Driver" },
];

const SAMPLE_TYPES = [
  { value: "blood", label: "Blood" },
  { value: "urine", label: "Urine" },
  { value: "sputum", label: "Sputum" },
  { value: "swab", label: "Swab" },
  { value: "other", label: "Other" },
];

const CAMP_SERVICE_LINE_OPTIONS = [
  { value: "opinion", label: "Opinion / specialist review" },
  { value: "consultation", label: "Consultation" },
  { value: "xray", label: "X-ray / imaging" },
  { value: "lab", label: "Lab test" },
  { value: "procedure", label: "Procedure" },
  { value: "pharmacy", label: "Pharmacy / medicines" },
  { value: "emergency", label: "Emergency" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Other" },
];

const patientContextQuery = (patientId: string) =>
  patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";

function CampPatientActionBar({ patientId }: { patientId: string }) {
  const journeyContext = useMemo<ClinicalJourneyContext>(() => ({ patientId }), [patientId]);

  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" gap="sm" align="center">
        <Stack gap={2}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            Patient handoff
          </Text>
          <Text size="xs" c="dimmed">
            Continue from camp to OPD, emergency, IPD, billing or pharmacy without re-searching.
          </Text>
        </Stack>
        <PatientJourneyActions
          context={journeyContext}
          hiddenActionIds={["camp.open_context"]}
          size="xs"
        />
      </Group>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────

export function CampPage() {
  useRequirePermission(P.CAMP.LIST);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";
  const [activeTab, setActiveTab] = useState<string | null>("camps");
  const openCampWorkspace = (campId: string) => {
    navigate(`/camp/${campId}/work${patientContextQuery(contextPatientId)}`);
  };

  return (
    <div>
      <PageHeader
        title="Camp Management"
        subtitle="Plan, approve, activate, and close outreach camps. Open an active camp to work inside it."
      />
      {contextPatientId && <CampPatientContextPanel patientId={contextPatientId} />}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="camps" leftSection={<IconFirstAidKit size={16} />}>
            Camps
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="camps" pt="md">
          <CampsTab onWorkCamp={openCampWorkspace} />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <CampAnalyticsTab campId={null} selectedCamp={null} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

interface CampWorkPageProps {
  initialTab?: string;
}

export function CampWorkPage({ initialTab = "registrations" }: CampWorkPageProps = {}) {
  useRequirePermission(P.CAMP.LIST);
  const navigate = useNavigate();
  const { campId, registrationId } = useParams();
  const [searchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";
  const [activeTab, setActiveTab] = useState<string | null>(
    registrationId ? "screenings" : initialTab,
  );
  const [focusedRegistrationId, setFocusedRegistrationId] = useState<string | null>(
    registrationId ?? null,
  );

  const { data: camps = [] } = useQuery({
    queryKey: ["camps"],
    queryFn: () => campService.listCamps(),
  });

  const activeCamps = useMemo(
    () =>
      camps
        .filter((camp) => camp.status === "active")
        .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
    [camps],
  );
  const selectedCamp = camps.find((camp) => camp.id === campId) ?? null;

  const openRegistrationClinicalFlow = (registrationId: string) => {
    setFocusedRegistrationId(registrationId);
    setActiveTab("screenings");
  };

  return (
    <div>
      <PageHeader
        title={selectedCamp ? `Work Camp · ${selectedCamp.name}` : "Work Camp"}
        subtitle={
          selectedCamp
            ? `${selectedCamp.camp_code} · ${selectedCamp.scheduled_date} · ${selectedCamp.venue_name ?? "Venue not set"}`
            : "Choose an active camp to start registration and screening"
        }
        actions={
          <Button
            variant="light"
            onClick={() => navigate(`/camp${patientContextQuery(contextPatientId)}`)}
          >
            Back to Camp Management
          </Button>
        }
      />
      <CampContextBar
        activeCamps={activeCamps}
        selectedCamp={selectedCamp}
        selectedCampId={campId ?? null}
        onSelectCamp={(nextCampId) => {
          setFocusedRegistrationId(null);
          if (nextCampId) {
            navigate(`/camp/${nextCampId}/work${patientContextQuery(contextPatientId)}`);
          }
        }}
      />
      {contextPatientId && (
        <>
          <PatientContextBanner patientId={contextPatientId} hideLoadingState />
          <PatientFlowNavigator patientId={contextPatientId} active="camp" compact />
          <CampPatientActionBar patientId={contextPatientId} />
        </>
      )}

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="registrations" leftSection={<IconUsers size={16} />}>
            Registrations
          </Tabs.Tab>
          <Tabs.Tab value="screenings" leftSection={<IconStethoscope size={16} />}>
            Clinical Screening
          </Tabs.Tab>
          <Tabs.Tab value="followups" leftSection={<IconCalendarCheck size={16} />}>
            Follow-up
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Report
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="registrations" pt="md">
          <RegistrationsTab
            campId={campId ?? null}
            selectedCamp={selectedCamp}
            contextPatientId={contextPatientId}
            onScreenRegistration={openRegistrationClinicalFlow}
          />
        </Tabs.Panel>
        <Tabs.Panel value="screenings" pt="md">
          <ScreeningsTab
            key={`${campId ?? "none"}-${focusedRegistrationId ?? "none"}`}
            campId={campId ?? null}
            selectedCamp={selectedCamp}
            focusedRegistrationId={focusedRegistrationId}
            onClearFocusedRegistration={() => setFocusedRegistrationId(null)}
          />
        </Tabs.Panel>
        <Tabs.Panel value="followups" pt="md">
          <FollowupsTab campId={campId ?? null} selectedCamp={selectedCamp} />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <CampAnalyticsTab campId={campId ?? null} selectedCamp={selectedCamp} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

export function CampCreatePage() {
  return <CampPage />;
}

export function CampPlanEditPage() {
  return <CampWorkPage initialTab="analytics" />;
}

export function CampClinicalRoutePage() {
  return <CampWorkPage initialTab="screenings" />;
}

export function CampScreeningCreatePage() {
  return <CampWorkPage initialTab="screenings" />;
}

export function CampLabSampleCreatePage() {
  return <CampWorkPage initialTab="screenings" />;
}

export function CampTeamMemberAddPage() {
  return <CampWorkPage initialTab="analytics" />;
}

export function CampAssetReturnPage() {
  return <CampWorkPage initialTab="analytics" />;
}

export function CampBillingCreatePage() {
  return <CampWorkPage initialTab="registrations" />;
}

export function CampFollowupCreatePage() {
  return <CampWorkPage initialTab="followups" />;
}

interface PatientCampRegistrationRow extends CampRegistration {
  camp_name: string;
  camp_code: string;
  camp_status: string;
}

function CampPatientContextPanel({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const canViewRegistrations = useHasPermission(P.CAMP.REGISTRATIONS_LIST);
  const { data: camps = [] } = useQuery({
    queryKey: ["camps"],
    queryFn: () => campService.listCamps(),
    enabled: canViewRegistrations,
  });
  const { data: registrations = [], isLoading } = useQuery<PatientCampRegistrationRow[]>({
    queryKey: ["camp-patient-registrations", patientId, camps.map((camp) => camp.id).join("|")],
    queryFn: async () => {
      const rows = await Promise.all(
        camps.map(async (camp) => {
          const registrationsForCamp = await campService.listCampRegistrations({
            camp_id: camp.id,
            patient_id: patientId,
          });
          return registrationsForCamp.map((registration) => ({
            ...registration,
            camp_name: camp.name,
            camp_code: camp.camp_code,
            camp_status: camp.status,
          }));
        }),
      );
      return rows.flat();
    },
    enabled: canViewRegistrations && camps.length > 0 && patientId.length > 0,
  });

  const activeCamps = camps.filter((camp) => camp.status === "active");
  const columns: Column<PatientCampRegistrationRow>[] = [
    {
      key: "camp_code",
      label: "Camp",
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            {row.camp_code}
          </Text>
          <Text size="xs" c="dimmed">
            {row.camp_name}
          </Text>
        </Stack>
      ),
    },
    {
      key: "registration_number",
      label: "Registration",
      render: (row) => row.registration_number,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge color={REG_STATUS_COLORS[row.status] ?? "slate"} variant="filled" size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "chief_complaint",
      label: "Complaint",
      render: (row) => row.chief_complaint ?? "—",
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            onClick={() =>
              navigate(
                `/camp/${row.camp_id}/work/registrations/${row.id}/clinical-route${patientContextQuery(
                  patientId,
                )}`,
              )
            }
          >
            Open Flow
          </Button>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => navigate(`/camp/${row.camp_id}/work${patientContextQuery(patientId)}`)}
          >
            Work Camp
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <Stack mb="md">
      <PatientContextBanner patientId={patientId} hideLoadingState />
      <PatientFlowNavigator patientId={patientId} active="camp" compact />
      <CampPatientActionBar patientId={patientId} />
      {canViewRegistrations ? (
        <Card withBorder>
          <Stack>
            <Group justify="space-between" align="center">
              <Stack gap={0}>
                <Text fw={700}>Camp history for this patient</Text>
                <Text size="xs" c="dimmed">
                  Open a previous camp registration or choose an active camp to register this
                  patient.
                </Text>
              </Stack>
              {activeCamps.length > 0 && (
                <Select
                  placeholder="Register in active camp"
                  data={activeCamps.map((camp) => ({
                    value: camp.id,
                    label: `${camp.camp_code} - ${camp.name}`,
                  }))}
                  onChange={(campId) => {
                    if (campId) {
                      navigate(`/camp/${campId}/work${patientContextQuery(patientId)}`);
                    }
                  }}
                  w={320}
                  searchable
                />
              )}
            </Group>
            <DataTable
              columns={columns}
              data={registrations}
              loading={isLoading}
              rowKey={(row) => row.id}
            />
          </Stack>
        </Card>
      ) : (
        <Alert color="orange" variant="light">
          Camp registration history is restricted for this role.
        </Alert>
      )}
    </Stack>
  );
}

function CampContextBar({
  activeCamps,
  selectedCamp,
  selectedCampId,
  onSelectCamp,
}: {
  activeCamps: Camp[];
  selectedCamp: Camp | null;
  selectedCampId: string | null;
  onSelectCamp: (campId: string | null) => void;
}) {
  return (
    <Card withBorder p="sm" mb="md">
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Group gap="xs">
            <Badge color={selectedCamp ? "success" : "slate"} variant="filled">
              {selectedCamp ? "Active camp context" : "No active camp"}
            </Badge>
            {selectedCamp && (
              <Text size="sm" fw={600}>
                {selectedCamp.camp_code} · {selectedCamp.name}
              </Text>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            Registration, screening, lab, follow-up, and reports use this camp automatically.
          </Text>
        </Stack>
        <Select
          placeholder="Select active camp"
          data={activeCamps.map((camp) => ({
            value: camp.id,
            label: `${camp.camp_code} - ${camp.name}`,
          }))}
          value={selectedCampId}
          onChange={onSelectCamp}
          searchable
          w={360}
          disabled={activeCamps.length === 0}
        />
      </Group>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  Camps Tab
// ══════════════════════════════════════════════════════════

function CampsTab({ onWorkCamp }: { onWorkCamp: (campId: string) => void }) {
  const canCreate = useHasPermission(P.CAMP.CREATE);
  const canUpdate = useHasPermission(P.CAMP.UPDATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [detailOpen, detailHandlers] = useDisclosure(false);
  const [selectedCamp, setSelectedCamp] = useState<Camp | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const campDefaults: CampCreateFormInput = {
    name: "",
    camp_type: "general_health",
    organizing_department_id: null,
    supporting_department_ids: [],
    coordinator_id: null,
    planned_doctor_ids: [],
    planned_staff_ids: [],
    external_people: [],
    service_lines: [],
    service_offerings: [],
    doctor_engagements: [],
    planned_medicines: [],
    planned_medicine_ids: [],
    planned_medicine_refs: [],
    camp_charge_mode: "free",
    department_charge_mode: "free",
    doctor_charge_mode: "free",
    medicine_charge_mode: "free",
    free_medicine_approval_required: true,
    service_policy_notes: "",
    budget_doctor_amount: "",
    budget_medicine_amount: "",
    budget_diagnostics_amount: "",
    budget_consumables_amount: "",
    budget_transport_amount: "",
    budget_food_amount: "",
    budget_other_amount: "",
    sponsor_covered_amount: "",
    patient_expected_collection: "",
    budget_notes: "",
    scheduled_date: "",
    start_time: "",
    end_time: "",
    venue_name: "",
    venue_address: "",
    venue_city: "",
    venue_state: "",
    venue_pincode: "",
    expected_participants: "",
    budget_allocated: "",
    is_free: true,
    logistics_notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CampCreateFormInput>({
    resolver: zodResolver(campCreateFormSchema),
    defaultValues: campDefaults,
  });

  const { data: camps = [], isLoading } = useQuery({
    queryKey: ["camps", statusFilter],
    queryFn: () => campService.listCamps(statusFilter ? { status: statusFilter } : undefined),
  });
  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["departments"],
    queryFn: () => lookupsService.listDepartments(),
    staleTime: 600_000,
  });
  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) =>
          ["clinical", "para_clinical", "diagnostic"].includes(department.department_type),
        )
        .map((department) => ({ value: department.id, label: department.name })),
    [departments],
  );

  const createMut = useMutation({
    mutationFn: (data: CreateCampRequest) => campService.createCamp(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      createHandlers.close();
      reset(campDefaults);
      notifications.show({
        title: "Camp Created",
        message: "Camp planned successfully",
        color: "success",
      });
    },
  });

  const handleCreateCamp = (values: CampCreateFormInput) => {
    createMut.mutate({
      name: values.name.trim(),
      camp_type: values.camp_type,
      organizing_department_id: values.organizing_department_id ?? undefined,
      coordinator_id: values.coordinator_id ?? undefined,
      scheduled_date: values.scheduled_date.trim(),
      start_time: campOptionalText(values.start_time),
      end_time: campOptionalText(values.end_time),
      venue_name: campOptionalText(values.venue_name),
      venue_address: campOptionalText(values.venue_address),
      venue_city: campOptionalText(values.venue_city),
      venue_state: campOptionalText(values.venue_state),
      venue_pincode: campOptionalText(values.venue_pincode),
      expected_participants: campOptionalInteger(values.expected_participants),
      budget_allocated: campOptionalNumber(values.budget_allocated),
      is_free: values.is_free,
      logistics_notes: campOptionalText(values.logistics_notes),
    });
  };

  const approveMut = useMutation({
    mutationFn: (id: string) => campService.approveCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Approved", message: "Camp approved", color: "success" });
    },
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => campService.activateCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Activated", message: "Camp is now active", color: "success" });
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => campService.completeCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({
        title: "Completed",
        message: "Camp marked as completed",
        color: "teal",
      });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => campService.cancelCamp(id, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Cancelled", message: "Camp cancelled", color: "danger" });
    },
  });

  const columns: Column<Camp>[] = [
    {
      key: "camp_code",
      label: "Code",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.camp_code}
        </Text>
      ),
    },
    { key: "name", label: "Name", render: (r) => r.name },
    {
      key: "camp_type",
      label: "Type",
      render: (r) => (
        <Badge variant="light" size="sm">
          {campTypeOptions.find((t) => t.value === r.camp_type)?.label ?? r.camp_type}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge color={CAMP_STATUS_COLORS[r.status] ?? "slate"} variant="filled" size="sm">
          {r.status}
        </Badge>
      ),
    },
    { key: "scheduled_date", label: "Date", render: (r) => r.scheduled_date },
    { key: "venue_city", label: "City", render: (r) => r.venue_city ?? "—" },
    {
      key: "expected_participants",
      label: "Expected",
      render: (r) => r.expected_participants?.toString() ?? "—",
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          <Tooltip label="View Details">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => {
                setSelectedCamp(r);
                detailHandlers.open();
              }}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
          {r.status === "active" && (
            <Tooltip label="Work in this camp" closeDelay={0} withinPortal={false}>
              <ActionIcon
                variant="subtle"
                color="success"
                size="sm"
                onClick={(event) => {
                  event.currentTarget.blur();
                  onWorkCamp(r.id);
                }}
                aria-label="Work in this camp"
              >
                <IconUsers size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {canUpdate && r.status === "planned" && (
            <Tooltip label="Approve">
              <ActionIcon
                variant="subtle"
                color="primary"
                size="sm"
                onClick={() => approveMut.mutate(r.id)}
                aria-label="Confirm"
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {canUpdate && (r.status === "approved" || r.status === "setup") && (
            <Tooltip label="Activate">
              <ActionIcon
                variant="subtle"
                color="success"
                size="sm"
                onClick={() => activateMut.mutate(r.id)}
                aria-label="Play"
              >
                <IconPlayerPlay size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {canUpdate && r.status === "active" && (
            <Tooltip label="Complete">
              <ActionIcon
                variant="subtle"
                color="teal"
                size="sm"
                onClick={() => completeMut.mutate(r.id)}
                aria-label="Confirm"
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {canUpdate && !["completed", "cancelled"].includes(r.status) && (
            <Tooltip label="Cancel">
              <ActionIcon
                variant="subtle"
                color="danger"
                size="sm"
                onClick={() => cancelMut.mutate(r.id)}
                aria-label="Close"
              >
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          clearable
          data={Object.keys(CAMP_STATUS_COLORS).map((s) => ({
            value: s,
            label: s.charAt(0).toUpperCase() + s.slice(1),
          }))}
          value={statusFilter}
          onChange={setStatusFilter}
          w={200}
        />
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Plan Camp
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={camps} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={() => {
          createHandlers.close();
          reset(campDefaults);
        }}
        title="Plan New Camp"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateCamp)}>
          <TextInput
            label="Camp Name"
            required
            error={errors.name?.message}
            {...register("name")}
          />
          <Controller
            control={control}
            name="camp_type"
            render={({ field }) => (
              <Select
                label="Camp Type"
                required
                data={campTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "general_health")}
                error={errors.camp_type?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="organizing_department_id"
            render={({ field }) => (
              <Select
                label="Organizing department"
                description="This becomes the OPD department when a camp participant is opened clinically."
                placeholder="Select service department"
                data={departmentOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? null)}
                error={errors.organizing_department_id?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            control={control}
            name="coordinator_id"
            render={({ field }) => (
              <EmployeeSearchSelect
                label="Camp coordinator / attending doctor"
                value={field.value ?? ""}
                onChange={(value) => field.onChange(value || null)}
              />
            )}
          />
          <Controller
            control={control}
            name="scheduled_date"
            render={({ field }) => (
              <DateInput
                label="Scheduled Date"
                required
                value={field.value ? new Date(field.value) : null}
                onChange={(date) =>
                  field.onChange(date ? new Date(date).toISOString().slice(0, 10) : "")
                }
                error={errors.scheduled_date?.message}
              />
            )}
          />
          <TextInput
            label="Start Time"
            placeholder="09:00"
            error={errors.start_time?.message}
            {...register("start_time")}
          />
          <TextInput
            label="End Time"
            placeholder="17:00"
            error={errors.end_time?.message}
            {...register("end_time")}
          />
          <TextInput
            label="Venue Name"
            error={errors.venue_name?.message}
            {...register("venue_name")}
          />
          <TextInput
            label="Venue Address"
            error={errors.venue_address?.message}
            {...register("venue_address")}
          />
          <Group grow>
            <TextInput
              label="City"
              error={errors.venue_city?.message}
              {...register("venue_city")}
            />
            <TextInput
              label="State"
              error={errors.venue_state?.message}
              {...register("venue_state")}
            />
            <TextInput
              label="Pincode"
              error={errors.venue_pincode?.message}
              {...register("venue_pincode")}
            />
          </Group>
          <Controller
            control={control}
            name="expected_participants"
            render={({ field }) => (
              <NumberInput
                label="Expected Participants"
                min={0}
                value={field.value}
                onChange={field.onChange}
                error={errors.expected_participants?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="budget_allocated"
            render={({ field }) => (
              <NumberInput
                label="Budget Allocated"
                min={0}
                decimalScale={2}
                value={field.value}
                onChange={field.onChange}
                error={errors.budget_allocated?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="is_free"
            render={({ field }) => (
              <Switch
                label="Free Camp"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Textarea
            label="Logistics Notes"
            error={errors.logistics_notes?.message}
            {...register("logistics_notes")}
          />
          <Button type="submit" loading={createMut.isPending}>
            Create Camp
          </Button>
        </Stack>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        opened={detailOpen}
        onClose={detailHandlers.close}
        title={selectedCamp?.name ?? "Camp Detail"}
        position="right"
        size="lg"
      >
        {selectedCamp && <CampDetail camp={selectedCamp} />}
      </Drawer>
    </>
  );
}

// ── Camp Detail (team management + stats) ────────────

function CampDetail({ camp }: { camp: Camp }) {
  const canUpdate = useHasPermission(P.CAMP.UPDATE);
  const canListRegistrations = useHasPermission(P.CAMP.REGISTRATIONS_LIST);
  const canListScreenings = useHasPermission(P.CAMP.SCREENINGS_LIST);
  const canListLab = useHasPermission(P.CAMP.LAB_LIST);
  const qc = useQueryClient();
  const [addOpen, addHandlers] = useDisclosure(false);
  const [teamForm, setTeamForm] = useState({ employee_id: "", role_in_camp: "volunteer" });
  const [supplyForm, setSupplyForm] = useState<{
    category: CampSupplyItem["category"];
    item_name: string;
    unit: string;
    planned_qty: number;
    is_critical: boolean;
  }>({
    category: "consumable",
    item_name: "",
    unit: "pcs",
    planned_qty: 0,
    is_critical: false,
  });
  const [incidentForm, setIncidentForm] = useState<{
    incident_type: CampIncident["incident_type"];
    severity: CampIncident["severity"];
    description: string;
  }>({
    incident_type: "patient_safety",
    severity: "low",
    description: "",
  });
  const canDownloadPacket = canListRegistrations && canListScreenings && canListLab;

  const { data: team = [] } = useQuery({
    queryKey: ["camp-team", camp.id],
    queryFn: () => campService.listCampTeamMembers(camp.id),
  });

  const { data: stats } = useQuery({
    queryKey: ["camp-stats", camp.id],
    queryFn: () => campService.getCampStats(camp.id),
  });

  const { data: remoteOps } = useQuery({
    queryKey: ["camp-remote-operations", camp.id],
    queryFn: () => campService.getCampRemoteOperations(camp.id),
  });

  const addMut = useMutation({
    mutationFn: () =>
      campService.addCampTeamMember(camp.id, {
        employee_id: teamForm.employee_id,
        role_in_camp: teamForm.role_in_camp,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-team", camp.id] });
      addHandlers.close();
      setTeamForm({ employee_id: "", role_in_camp: "volunteer" });
    },
  });

  const removeMut = useMutation({
    mutationFn: (memberId: string) => campService.removeCampTeamMember(camp.id, memberId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["camp-team", camp.id] }),
  });

  const packetMut = useMutation({
    mutationFn: () => campService.getCampPacket(camp.id, { device_id: "web-admin-preview" }),
    onSuccess: (packet) => {
      notifications.show({
        title: "Packet ready",
        message: `${packet.registrations.length} registrations, ${packet.screenings.length} screenings, ${packet.lab_samples.length} samples, ${packet.patient_summaries.length} linked patients`,
        color: "success",
      });
    },
  });

  const checklistMut = useMutation({
    mutationFn: (input: { id: string; status: "ok" | "issue" | "not_applicable" }) =>
      campService.updateCampRemoteChecklistItem(input.id, { status: input.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-remote-operations", camp.id] });
    },
  });

  const supplyMut = useMutation({
    mutationFn: () =>
      campService.createCampSupplyItem(camp.id, {
        category: supplyForm.category,
        item_name: supplyForm.item_name,
        unit: supplyForm.unit || undefined,
        planned_qty: supplyForm.planned_qty,
        is_critical: supplyForm.is_critical,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-remote-operations", camp.id] });
      setSupplyForm({
        category: "consumable",
        item_name: "",
        unit: "pcs",
        planned_qty: 0,
        is_critical: false,
      });
    },
  });

  const incidentMut = useMutation({
    mutationFn: () =>
      campService.createCampIncident(camp.id, {
        incident_type: incidentForm.incident_type,
        severity: incidentForm.severity,
        description: incidentForm.description,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-remote-operations", camp.id] });
      setIncidentForm({
        incident_type: "patient_safety",
        severity: "low",
        description: "",
      });
    },
  });

  const teamCols: Column<CampTeamMember>[] = [
    { key: "employee_id", label: "Employee ID", render: (r) => r.employee_id.slice(0, 8) },
    {
      key: "role_in_camp",
      label: "Role",
      render: (r) => TEAM_ROLES.find((t) => t.value === r.role_in_camp)?.label ?? r.role_in_camp,
    },
    {
      key: "is_confirmed",
      label: "Confirmed",
      render: (r) =>
        r.is_confirmed ? (
          <Badge color="success" size="xs">
            Yes
          </Badge>
        ) : (
          <Badge color="slate" size="xs">
            No
          </Badge>
        ),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate ? (
          <ActionIcon
            variant="subtle"
            color="danger"
            size="sm"
            onClick={() => removeMut.mutate(r.id)}
            aria-label="Delete"
          >
            <IconTrash size={14} />
          </ActionIcon>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Stack gap={2}>
          <Text fw={600}>Camp Packet</Text>
          <Text size="sm" c="dimmed">
            Segmented camp data for offline intake, screening, vitals, and sample collection.
          </Text>
        </Stack>
        {canDownloadPacket && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconDownload size={14} />}
            loading={packetMut.isPending}
            onClick={() => packetMut.mutate()}
          >
            Check Packet
          </Button>
        )}
      </Group>

      {stats && (
        <SimpleGrid cols={4}>
          <StatCard label="Registrations" value={stats.total_registrations} />
          <StatCard label="Screened" value={stats.screened} />
          <StatCard label="Referred" value={stats.referred} />
          <StatCard label="Converted" value={stats.converted} />
          <StatCard label="Lab Samples" value={stats.lab_samples} />
          <StatCard label="Follow-ups" value={stats.followups_scheduled} />
          <StatCard label="FU Completed" value={stats.followups_completed} />
          <StatCard label="Billing Total" value={stats.billing_total} prefix="₹" />
        </SimpleGrid>
      )}

      {remoteOps && (
        <Card withBorder>
          <Group justify="space-between" mb="sm">
            <Stack gap={2}>
              <Text fw={600}>Remote Village Readiness</Text>
              <Text size="sm" c="dimmed">
                NABH mapped controls for site safety, IPC/BMW, privacy, referral, staff briefing,
                and offline records.
              </Text>
            </Stack>
            <Badge
              color={remoteOps.readiness.ready ? "success" : "orange"}
              variant="filled"
              size="lg"
            >
              {remoteOps.readiness.score}% ready
            </Badge>
          </Group>

          <SimpleGrid cols={4} mb="sm">
            <StatCard label="Required Done" value={remoteOps.readiness.required_done} />
            <StatCard label="Required Total" value={remoteOps.readiness.required_total} />
            <StatCard label="Issues" value={remoteOps.readiness.issue_count} />
            <StatCard label="Supplies" value={remoteOps.supplies.length} />
          </SimpleGrid>

          <Stack gap="xs">
            {remoteOps.checklist.map((item) => (
              <Group key={item.id} justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={2} style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Badge size="xs" variant="light">
                      {item.nabh_chapter}
                    </Badge>
                    <Badge
                      size="xs"
                      color={
                        item.status === "ok" || item.status === "not_applicable"
                          ? "success"
                          : item.status === "issue"
                            ? "danger"
                            : "slate"
                      }
                    >
                      {item.status.replace("_", " ")}
                    </Badge>
                  </Group>
                  <Text size="sm">{item.label}</Text>
                </Stack>
                {canUpdate && (
                  <Group gap={4} wrap="nowrap">
                    <Button
                      size="compact-xs"
                      variant="light"
                      color="success"
                      onClick={() => checklistMut.mutate({ id: item.id, status: "ok" })}
                    >
                      OK
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="light"
                      color="danger"
                      onClick={() => checklistMut.mutate({ id: item.id, status: "issue" })}
                    >
                      Issue
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => checklistMut.mutate({ id: item.id, status: "not_applicable" })}
                    >
                      N/A
                    </Button>
                  </Group>
                )}
              </Group>
            ))}
          </Stack>

          <SimpleGrid cols={2} mt="md">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600}>Supplies</Text>
                <Badge variant="light">{remoteOps.supplies.length}</Badge>
              </Group>
              {remoteOps.supplies.slice(0, 6).map((item) => (
                <Group key={item.id} justify="space-between" wrap="nowrap">
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>
                      {item.item_name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {item.category} · packed {item.packed_qty}/{item.planned_qty}{" "}
                      {item.unit ?? ""}
                    </Text>
                  </Stack>
                  {item.is_critical && (
                    <Badge size="xs" color="danger">
                      Critical
                    </Badge>
                  )}
                </Group>
              ))}
              {canUpdate && (
                <Stack gap="xs">
                  <Select
                    label="Category"
                    size="xs"
                    value={supplyForm.category}
                    data={[
                      "equipment",
                      "consumable",
                      "medicine",
                      "ppe",
                      "biomedical_waste",
                      "document",
                      "it",
                      "other",
                    ]}
                    onChange={(value) =>
                      value &&
                      setSupplyForm((current) => ({
                        ...current,
                        category: value as CampSupplyItem["category"],
                      }))
                    }
                  />
                  <TextInput
                    label="Item"
                    size="xs"
                    value={supplyForm.item_name}
                    onChange={(event) =>
                      setSupplyForm((current) => ({
                        ...current,
                        item_name: event.currentTarget.value,
                      }))
                    }
                  />
                  <Group grow align="flex-end">
                    <NumberInput
                      label="Planned"
                      size="xs"
                      min={0}
                      value={supplyForm.planned_qty}
                      onChange={(value) =>
                        setSupplyForm((current) => ({
                          ...current,
                          planned_qty: typeof value === "number" ? value : 0,
                        }))
                      }
                    />
                    <TextInput
                      label="Unit"
                      size="xs"
                      value={supplyForm.unit}
                      onChange={(event) =>
                        setSupplyForm((current) => ({
                          ...current,
                          unit: event.currentTarget.value,
                        }))
                      }
                    />
                  </Group>
                  <Switch
                    size="xs"
                    label="Critical item"
                    checked={supplyForm.is_critical}
                    onChange={(event) =>
                      setSupplyForm((current) => ({
                        ...current,
                        is_critical: event.currentTarget.checked,
                      }))
                    }
                  />
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPlus size={14} />}
                    disabled={!supplyForm.item_name}
                    loading={supplyMut.isPending}
                    onClick={() => supplyMut.mutate()}
                  >
                    Add Supply
                  </Button>
                </Stack>
              )}
            </Stack>

            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600}>Incidents / Near Miss</Text>
                <Badge variant="light" color={remoteOps.incidents.length > 0 ? "danger" : "slate"}>
                  {remoteOps.incidents.length}
                </Badge>
              </Group>
              {remoteOps.incidents.slice(0, 6).map((item) => (
                <Group key={item.id} justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>
                      {item.incident_type.replace("_", " ")}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {item.description}
                    </Text>
                  </Stack>
                  <Badge size="xs" color={item.severity === "critical" ? "danger" : "orange"}>
                    {item.severity}
                  </Badge>
                </Group>
              ))}
              {canUpdate && (
                <Stack gap="xs">
                  <Group grow>
                    <Select
                      label="Type"
                      size="xs"
                      value={incidentForm.incident_type}
                      data={[
                        "patient_safety",
                        "infection_control",
                        "biomedical_waste",
                        "facility_safety",
                        "staff_safety",
                        "data_privacy",
                        "equipment",
                        "network",
                        "crowd_control",
                        "other",
                      ]}
                      onChange={(value) =>
                        value &&
                        setIncidentForm((current) => ({
                          ...current,
                          incident_type: value as CampIncident["incident_type"],
                        }))
                      }
                    />
                    <Select
                      label="Severity"
                      size="xs"
                      value={incidentForm.severity}
                      data={["low", "moderate", "high", "critical"]}
                      onChange={(value) =>
                        value &&
                        setIncidentForm((current) => ({
                          ...current,
                          severity: value as CampIncident["severity"],
                        }))
                      }
                    />
                  </Group>
                  <Textarea
                    label="Description"
                    size="xs"
                    minRows={2}
                    value={incidentForm.description}
                    onChange={(event) =>
                      setIncidentForm((current) => ({
                        ...current,
                        description: event.currentTarget.value,
                      }))
                    }
                  />
                  <Button
                    size="xs"
                    variant="light"
                    color="danger"
                    leftSection={<IconPlus size={14} />}
                    disabled={!incidentForm.description}
                    loading={incidentMut.isPending}
                    onClick={() => incidentMut.mutate()}
                  >
                    Record Incident
                  </Button>
                </Stack>
              )}
            </Stack>
          </SimpleGrid>
        </Card>
      )}

      <Group justify="space-between">
        <Text fw={600}>Team Members ({team.length})</Text>
        {canUpdate && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addHandlers.open}>
            Add Member
          </Button>
        )}
      </Group>

      <DataTable columns={teamCols} data={team} rowKey={(r) => r.id} />

      <Drawer
        opened={addOpen}
        onClose={addHandlers.close}
        title="Add Team Member"
        position="right"
        size="sm"
      >
        <Stack>
          <EmployeeSearchSelect
            value={teamForm.employee_id}
            onChange={(id) => setTeamForm({ ...teamForm, employee_id: id })}
            required
          />
          <Select
            label="Role"
            data={TEAM_ROLES}
            value={teamForm.role_in_camp}
            onChange={(v) => setTeamForm({ ...teamForm, role_in_camp: v ?? "volunteer" })}
          />
          <Button
            onClick={() => addMut.mutate()}
            loading={addMut.isPending}
            disabled={!teamForm.employee_id}
          >
            Add
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function StatCard({ label, value, prefix }: { label: string; value: number; prefix?: string }) {
  return (
    <Card withBorder p="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="lg" fw={700}>
        {prefix}
        {value}
      </Text>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  Registrations Tab
// ══════════════════════════════════════════════════════════

function RegistrationsTab({
  campId,
  selectedCamp,
  contextPatientId,
  onScreenRegistration,
}: {
  campId: string | null;
  selectedCamp: Camp | null;
  contextPatientId: string;
  onScreenRegistration: (registrationId: string) => void;
}) {
  const canCreate = useHasPermission(P.CAMP.REGISTRATIONS_CREATE);
  const canOpenClinicalVisit = useHasPermission(P.OPD.VISIT_CREATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [routeOpen, routeHandlers] = useDisclosure(false);
  const [clinicalOpen, clinicalHandlers] = useDisclosure(false);
  const [clinicalContext, setClinicalContext] = useState<CampOpenEncounterResponse | null>(null);
  const [selectedRegistrationForClinical, setSelectedRegistrationForClinical] =
    useState<CampRegistration | null>(null);
  const [statusTab, setStatusTab] = useState<string | null>("all");
  const [patientSearch, setPatientSearch] = useState("");
  const registrationDefaults: CampRegistrationFormInput = {
    person_name: "",
    age: "",
    gender: "",
    phone: "",
    address: "",
    id_proof_type: "",
    id_proof_number: "",
    clinical_department_id: null,
    attending_doctor_id: null,
    service_line: "",
    chief_complaint: "",
    is_walk_in: true,
  };
  const clinicalVisitDefaults: CampClinicalVisitFormInput = {
    department_id: null,
    doctor_id: null,
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CampRegistrationFormInput>({
    resolver: zodResolver(campRegistrationFormSchema),
    defaultValues: registrationDefaults,
  });
  const {
    control: clinicalControl,
    reset: resetClinicalVisit,
    handleSubmit: handleClinicalVisitSubmit,
    formState: { errors: clinicalErrors },
  } = useForm<CampClinicalVisitFormInput>({
    resolver: zodResolver(campClinicalVisitFormSchema),
    defaultValues: clinicalVisitDefaults,
  });

  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["departments"],
    queryFn: () => lookupsService.listDepartments(),
    staleTime: 600_000,
  });
  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) =>
          ["clinical", "para_clinical", "diagnostic"].includes(department.department_type),
        )
        .map((department) => ({ value: department.id, label: department.name })),
    [departments],
  );

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ["camp-registrations", campId, contextPatientId],
    queryFn: () =>
      campService.listCampRegistrations({
        camp_id: campId ?? "",
        patient_id: contextPatientId || undefined,
      }),
    enabled: !!campId,
  });
  const filteredRegs = useMemo(() => {
    const byStatus = statusTab === "all" ? regs : regs.filter((row) => row.status === statusTab);
    const needle = patientSearch.trim().toLowerCase();
    if (!needle) return byStatus;

    return byStatus.filter((row) => {
      const haystack = [
        row.registration_number,
        row.person_name,
        row.phone,
        row.id_proof_number,
        row.patient_id,
        row.chief_complaint,
      ].filter((value): value is string => Boolean(value));

      return haystack.some((value) => value.toLowerCase().includes(needle));
    });
  }, [patientSearch, regs, statusTab]);

  const createMut = useMutation({
    mutationFn: (data: CreateCampRegistrationRequest) => campService.createCampRegistration(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      createHandlers.close();
      reset(registrationDefaults);
      notifications.show({
        title: "Registered",
        message: "Participant registered",
        color: "success",
      });
    },
  });

  const openClinicalVisitMut = useMutation({
    mutationFn: ({
      registrationId,
      values,
    }: {
      registrationId: string;
      values: CampClinicalVisitFormInput;
    }) =>
      campService.openCampRegistrationEncounter(registrationId, {
        department_id: values.department_id,
        doctor_id: values.doctor_id,
      }),
    onSuccess: (result) => {
      setClinicalContext(result);
      routeHandlers.close();
      setSelectedRegistrationForClinical(null);
      resetClinicalVisit(clinicalVisitDefaults);
      clinicalHandlers.open();
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      void qc.invalidateQueries({ queryKey: ["opd-queue"] });
    },
    onError: () => {
      notifications.show({
        title: "Unable to open clinical drawer",
        message: "Select a department for the clinical visit and check OPD create permission.",
        color: "danger",
      });
    },
  });

  const openClinicalRouting = (registration: CampRegistration, forceRoute = false) => {
    const departmentId =
      registration.clinical_department_id ?? selectedCamp?.organizing_department_id ?? null;
    const doctorId = registration.attending_doctor_id ?? null;
    const values: CampClinicalVisitFormInput = {
      department_id: departmentId,
      doctor_id: doctorId,
    };

    if (!forceRoute && registration.clinical_department_id) {
      openClinicalVisitMut.mutate({ registrationId: registration.id, values });
      return;
    }

    setSelectedRegistrationForClinical(registration);
    resetClinicalVisit(values);
    routeHandlers.open();
  };

  const submitClinicalRouting = (values: CampClinicalVisitFormInput) => {
    if (!selectedRegistrationForClinical) return;
    openClinicalVisitMut.mutate({
      registrationId: selectedRegistrationForClinical.id,
      values,
    });
  };

  const handleCreateRegistration = (values: CampRegistrationFormInput) => {
    if (!campId) return;
    createMut.mutate({
      camp_id: campId,
      person_name: values.person_name.trim(),
      age: campOptionalInteger(values.age),
      gender: campOptionalText(values.gender),
      phone: campOptionalText(values.phone),
      address: campOptionalText(values.address),
      id_proof_type: campOptionalText(values.id_proof_type),
      id_proof_number: campOptionalText(values.id_proof_number),
      clinical_department_id: values.clinical_department_id ?? undefined,
      attending_doctor_id: values.attending_doctor_id ?? undefined,
      service_line: campOptionalText(values.service_line),
      chief_complaint: campOptionalText(values.chief_complaint),
      is_walk_in: values.is_walk_in,
      patient_id: contextPatientId || undefined,
    });
  };

  const columns: Column<CampRegistration>[] = [
    {
      key: "registration_number",
      label: "Reg #",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.registration_number}
        </Text>
      ),
    },
    { key: "person_name", label: "Name", render: (r) => r.person_name },
    { key: "age", label: "Age", render: (r) => r.age?.toString() ?? "—" },
    { key: "gender", label: "Gender", render: (r) => r.gender ?? "—" },
    { key: "phone", label: "Phone", render: (r) => r.phone ?? "—" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge color={REG_STATUS_COLORS[r.status] ?? "slate"} variant="filled" size="sm">
          {r.status}
        </Badge>
      ),
    },
    { key: "chief_complaint", label: "Complaint", render: (r) => r.chief_complaint ?? "—" },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <Group gap={4}>
          <Tooltip label="Record screening / vitals" closeDelay={0} withinPortal={false}>
            <ActionIcon
              variant="subtle"
              color="primary"
              size="sm"
              onClick={(event) => {
                event.currentTarget.blur();
                onScreenRegistration(r.id);
              }}
              aria-label="Record screening"
            >
              <IconStethoscope size={14} />
            </ActionIcon>
          </Tooltip>
          {canOpenClinicalVisit && (
            <Tooltip
              label={
                r.clinical_department_id ? "Open OPD drawer" : "Select department and open OPD"
              }
              closeDelay={0}
              withinPortal={false}
            >
              <ActionIcon
                variant="subtle"
                color="success"
                size="sm"
                loading={openClinicalVisitMut.isPending}
                onClick={(event) => {
                  event.currentTarget.blur();
                  openClinicalRouting(r);
                }}
                aria-label="Open OPD drawer"
              >
                <IconArrowRight size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {canOpenClinicalVisit && r.clinical_department_id && (
            <Tooltip label="Change department / doctor" closeDelay={0} withinPortal={false}>
              <ActionIcon
                variant="subtle"
                color="orange"
                size="sm"
                onClick={(event) => {
                  event.currentTarget.blur();
                  openClinicalRouting(r, true);
                }}
                aria-label="Change department or doctor"
              >
                <IconTransferIn size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Text fw={600}>{selectedCamp ? selectedCamp.name : "Select an active camp"}</Text>
          <Text size="xs" c="dimmed">
            {contextPatientId
              ? "Showing camp registrations linked to the selected patient."
              : "New camp participants are registered against the selected camp context."}
          </Text>
        </Stack>
        {canCreate && campId && (
          <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Register Participant
          </Button>
        )}
      </Group>

      {campId ? (
        <Stack>
          <TextInput
            label="Patient search"
            placeholder={
              contextPatientId
                ? "Search within this patient's camp registrations"
                : "Search name, registration number, phone, ID, complaint"
            }
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            rightSection={
              patientSearch ? (
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label="Clear patient search"
                  onClick={() => setPatientSearch("")}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : null
            }
          />
          <Tabs value={statusTab} onChange={setStatusTab}>
            <Tabs.List>
              <Tabs.Tab value="all">All</Tabs.Tab>
              <Tabs.Tab value="registered">Registered</Tabs.Tab>
              <Tabs.Tab value="screened">Screened</Tabs.Tab>
              <Tabs.Tab value="referred">Referred</Tabs.Tab>
              <Tabs.Tab value="converted">Converted</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <DataTable
            columns={columns}
            data={filteredRegs}
            loading={isLoading}
            rowKey={(r) => r.id}
          />
        </Stack>
      ) : (
        <Text c="dimmed" ta="center" mt="xl">
          Select an active camp to view registrations
        </Text>
      )}

      <Drawer
        opened={createOpen}
        onClose={() => {
          createHandlers.close();
          reset(registrationDefaults);
        }}
        title="Register Participant"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateRegistration)}>
          <TextInput
            label="Person Name"
            required
            error={errors.person_name?.message}
            {...register("person_name")}
          />
          <Group grow>
            <Controller
              control={control}
              name="age"
              render={({ field }) => (
                <NumberInput
                  label="Age"
                  min={0}
                  max={150}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.age?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select
                  label="Gender"
                  data={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ]}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.gender?.message}
                  clearable
                />
              )}
            />
          </Group>
          <TextInput label="Phone" error={errors.phone?.message} {...register("phone")} />
          <Textarea label="Address" error={errors.address?.message} {...register("address")} />
          <Group grow>
            <Controller
              control={control}
              name="clinical_department_id"
              render={({ field }) => (
                <Select
                  label="Service department"
                  placeholder="Optional at registration"
                  data={departmentOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? null)}
                  error={errors.clinical_department_id?.message}
                  clearable
                  searchable
                />
              )}
            />
            <Controller
              control={control}
              name="attending_doctor_id"
              render={({ field }) => (
                <DoctorSearchSelect
                  label="Attending doctor"
                  placeholder="Optional at registration"
                  value={field.value ?? ""}
                  onChange={(value) => field.onChange(value || null)}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="service_line"
            render={({ field }) => (
              <Select
                label="Camp service needed"
                placeholder="Opinion, X-ray, lab, pharmacy..."
                data={CAMP_SERVICE_LINE_OPTIONS}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.service_line?.message}
                clearable
                searchable
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="id_proof_type"
              render={({ field }) => (
                <Select
                  label="ID Proof Type"
                  data={campIdProofTypeOptions}
                  placeholder="Select ID type"
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.id_proof_type?.message}
                  clearable
                  searchable
                />
              )}
            />
            <TextInput
              label="ID Proof Number"
              error={errors.id_proof_number?.message}
              {...register("id_proof_number")}
            />
          </Group>
          <Textarea
            label="Chief Complaint"
            error={errors.chief_complaint?.message}
            {...register("chief_complaint")}
          />
          <Controller
            control={control}
            name="is_walk_in"
            render={({ field }) => (
              <Switch
                label="Walk-in"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button type="submit" loading={createMut.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={routeOpen}
        onClose={() => {
          routeHandlers.close();
          setSelectedRegistrationForClinical(null);
          resetClinicalVisit(clinicalVisitDefaults);
        }}
        title={
          selectedRegistrationForClinical?.clinical_department_id
            ? "Change department / doctor"
            : "Open OPD clinical drawer"
        }
        position="right"
        size="md"
      >
        <Stack component="form" onSubmit={handleClinicalVisitSubmit(submitClinicalRouting)}>
          <Stack gap={2}>
            <Text fw={600}>{selectedRegistrationForClinical?.person_name ?? "Participant"}</Text>
            <Text size="xs" c="dimmed">
              Select the department and doctor for this camp participant. Saved values will be
              reused next time.
            </Text>
          </Stack>
          <Controller
            control={clinicalControl}
            name="department_id"
            render={({ field }) => (
              <Select
                label="Department"
                placeholder="Select department"
                data={departmentOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? null)}
                error={clinicalErrors.department_id?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            control={clinicalControl}
            name="doctor_id"
            render={({ field }) => (
              <DoctorSearchSelect
                label="Doctor"
                placeholder="Select doctor if assigned"
                value={field.value ?? ""}
                onChange={(value) => field.onChange(value || null)}
              />
            )}
          />
          <Button type="submit" loading={openClinicalVisitMut.isPending}>
            Open OPD Drawer
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={clinicalOpen}
        onClose={() => {
          clinicalHandlers.close();
          setClinicalContext(null);
        }}
        position="right"
        size="100%"
        withCloseButton
        title={
          <Button
            variant="subtle"
            size="xs"
            onClick={() => {
              clinicalHandlers.close();
              setClinicalContext(null);
            }}
            leftSection={<IconArrowRight size={14} style={{ transform: "rotate(180deg)" }} />}
          >
            Back to Camp Work
          </Button>
        }
        styles={{
          header: {
            padding: "6px 12px",
            minHeight: 36,
            borderBottom: "1px solid var(--fc-rule, #e7ebe8)",
          },
          body: { padding: 0, height: "calc(100vh - 36px)", overflow: "hidden" },
        }}
      >
        {clinicalContext && (
          <EncounterDetail
            encounterId={clinicalContext.encounter_id}
            patientId={clinicalContext.patient_id}
            patientName={clinicalContext.patient_name}
            uhid={clinicalContext.uhid}
            doctorId={clinicalContext.doctor_id ?? null}
            departmentId={clinicalContext.department_id}
            canUpdate={canOpenClinicalVisit}
          />
        )}
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Screenings & Lab Tab
// ══════════════════════════════════════════════════════════

function ScreeningsTab({
  campId,
  selectedCamp,
  focusedRegistrationId,
  onClearFocusedRegistration,
}: {
  campId: string | null;
  selectedCamp: Camp | null;
  focusedRegistrationId: string | null;
  onClearFocusedRegistration: () => void;
}) {
  const canManageScreenings = useHasPermission(P.CAMP.SCREENINGS_MANAGE);
  const canManageLab = useHasPermission(P.CAMP.LAB_MANAGE);
  const qc = useQueryClient();
  const [scrOpen, scrHandlers] = useDisclosure(Boolean(focusedRegistrationId));
  const [labOpen, labHandlers] = useDisclosure(false);
  const [screeningVitals, setScreeningVitals] = useState<CreateVitalRequest>({});
  const currentCampId = campId;

  const { data: screenings = [], isLoading: scrLoading } = useQuery({
    queryKey: ["camp-screenings", currentCampId],
    queryFn: () =>
      campService.listCampScreenings(currentCampId ? { camp_id: currentCampId } : undefined),
    enabled: !!currentCampId,
  });

  const { data: labSamples = [], isLoading: labLoading } = useQuery({
    queryKey: ["camp-lab-samples", currentCampId],
    queryFn: () =>
      campService.listCampLabSamples(currentCampId ? { camp_id: currentCampId } : undefined),
    enabled: !!currentCampId,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["camp-registrations", currentCampId, "screening-selector"],
    queryFn: () => campService.listCampRegistrations({ camp_id: currentCampId ?? "" }),
    enabled: !!currentCampId,
  });

  const screeningDefaults: CampScreeningFormInput = {
    registration_id: focusedRegistrationId ?? "",
    bp_systolic: "",
    bp_diastolic: "",
    pulse_rate: "",
    spo2: "",
    temperature: "",
    blood_sugar_random: "",
    bmi: "",
    height_cm: "",
    weight_kg: "",
    visual_acuity_left: "",
    visual_acuity_right: "",
    findings: "",
    diagnosis: "",
    advice: "",
    referred_to_hospital: false,
    referral_department: "",
    referral_urgency: "",
  };
  const labSampleDefaults: CampLabSampleFormInput = {
    registration_id: "",
    sample_type: "blood",
    test_requested: "",
    barcode: "",
  };
  const {
    control: screeningControl,
    register: registerScreening,
    reset: resetScreening,
    handleSubmit: handleSubmitScreening,
    watch: watchScreening,
    formState: { errors: screeningErrors },
  } = useForm<CampScreeningFormInput>({
    resolver: zodResolver(campScreeningFormSchema),
    defaultValues: screeningDefaults,
  });
  const {
    control: labControl,
    register: registerLab,
    reset: resetLab,
    handleSubmit: handleSubmitLab,
    formState: { errors: labErrors },
  } = useForm<CampLabSampleFormInput>({
    resolver: zodResolver(campLabSampleFormSchema),
    defaultValues: labSampleDefaults,
  });
  const referredToHospital = watchScreening("referred_to_hospital");
  const closeScreeningDrawer = () => {
    scrHandlers.close();
    resetScreening(screeningDefaults);
    setScreeningVitals({});
    onClearFocusedRegistration();
  };
  const openScreeningDrawer = (registrationId?: string) => {
    resetScreening({ ...screeningDefaults, registration_id: registrationId ?? "" });
    setScreeningVitals({});
    scrHandlers.open();
  };
  const registrationOptions = useMemo(
    () =>
      registrations.map((registration) => ({
        value: registration.id,
        label: [
          registration.registration_number,
          registration.person_name,
          registration.status,
          registration.phone ?? undefined,
        ]
          .filter(Boolean)
          .join(" - "),
      })),
    [registrations],
  );
  const registrationsById = useMemo(
    () => new Map(registrations.map((registration) => [registration.id, registration])),
    [registrations],
  );
  const renderRegistrationCell = (registrationId: string) => {
    const registration = registrationsById.get(registrationId);
    if (!registration) {
      return (
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            Unlinked registration
          </Text>
          <Text size="xs" c="dimmed">
            {registrationId.slice(0, 8)}
          </Text>
        </Stack>
      );
    }

    return (
      <Stack gap={2}>
        <Text size="sm" fw={600}>
          {registration.person_name}
        </Text>
        <Text size="xs" c="dimmed">
          {registration.registration_number}
          {registration.phone ? ` · ${registration.phone}` : ""}
        </Text>
      </Stack>
    );
  };

  const scrMut = useMutation({
    mutationFn: (data: CreateCampScreeningRequest) => campService.createCampScreening(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-screenings"] });
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      closeScreeningDrawer();
      notifications.show({
        title: "Screening Recorded",
        message: "Screening saved",
        color: "success",
      });
    },
  });

  const labMut = useMutation({
    mutationFn: (data: CreateCampLabSampleRequest) => campService.createCampLabSample(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-lab-samples"] });
      labHandlers.close();
      resetLab(labSampleDefaults);
      notifications.show({
        title: "Sample Recorded",
        message: "Lab sample recorded",
        color: "success",
      });
    },
  });

  const handleCreateScreening = (values: CampScreeningFormInput) => {
    const heightCm = screeningVitals.height_cm ?? campOptionalNumber(values.height_cm);
    const weightKg = screeningVitals.weight_kg ?? campOptionalNumber(values.weight_kg);
    const enteredBmi = campOptionalNumber(values.bmi);
    const calculatedBmi =
      enteredBmi ??
      (heightCm && weightKg
        ? Math.round((weightKg / (heightCm / 100) ** 2) * 100) / 100
        : undefined);

    scrMut.mutate({
      registration_id: values.registration_id.trim(),
      bp_systolic: screeningVitals.systolic_bp ?? campOptionalInteger(values.bp_systolic),
      bp_diastolic: screeningVitals.diastolic_bp ?? campOptionalInteger(values.bp_diastolic),
      pulse_rate: screeningVitals.pulse ?? campOptionalInteger(values.pulse_rate),
      spo2: screeningVitals.spo2 ?? campOptionalInteger(values.spo2),
      temperature: screeningVitals.temperature ?? campOptionalNumber(values.temperature),
      blood_sugar_random: campOptionalNumber(values.blood_sugar_random),
      bmi: calculatedBmi,
      height_cm: heightCm,
      weight_kg: weightKg,
      visual_acuity_left: campOptionalText(values.visual_acuity_left),
      visual_acuity_right: campOptionalText(values.visual_acuity_right),
      findings: campOptionalText(values.findings),
      diagnosis: campOptionalText(values.diagnosis),
      advice: campOptionalText(values.advice),
      referred_to_hospital: values.referred_to_hospital,
      referral_department: values.referred_to_hospital
        ? campOptionalText(values.referral_department)
        : undefined,
      referral_urgency: values.referred_to_hospital
        ? campOptionalText(values.referral_urgency)
        : undefined,
    });
  };

  const handleCreateLabSample = (values: CampLabSampleFormInput) => {
    labMut.mutate({
      registration_id: values.registration_id.trim(),
      sample_type: values.sample_type.trim(),
      test_requested: values.test_requested.trim(),
      barcode: campOptionalText(values.barcode),
    });
  };

  const scrCols: Column<CampScreening>[] = [
    {
      key: "registration_id",
      label: "Participant",
      render: (r) => renderRegistrationCell(r.registration_id),
    },
    {
      key: "bp",
      label: "BP",
      render: (r) => (r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : "—"),
    },
    { key: "pulse_rate", label: "Pulse", render: (r) => r.pulse_rate?.toString() ?? "—" },
    { key: "spo2", label: "SpO2", render: (r) => (r.spo2 ? `${r.spo2}%` : "—") },
    {
      key: "blood_sugar_random",
      label: "BSR",
      render: (r) => r.blood_sugar_random?.toString() ?? "—",
    },
    { key: "bmi", label: "BMI", render: (r) => r.bmi?.toString() ?? "—" },
    { key: "findings", label: "Findings", render: (r) => r.findings ?? "—" },
    {
      key: "referred",
      label: "Referred",
      render: (r) =>
        r.referred_to_hospital ? (
          <Badge color="orange" size="sm">
            {r.referral_urgency ?? "Yes"}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            No
          </Text>
        ),
    },
  ];

  const labCols: Column<CampLabSample>[] = [
    {
      key: "registration_id",
      label: "Participant",
      render: (r) => renderRegistrationCell(r.registration_id),
    },
    { key: "sample_type", label: "Sample", render: (r) => r.sample_type },
    { key: "test_requested", label: "Test", render: (r) => r.test_requested ?? "—" },
    { key: "barcode", label: "Barcode", render: (r) => r.barcode ?? "—" },
    {
      key: "sent_to_lab",
      label: "Sent to Lab",
      render: (r) =>
        r.sent_to_lab ? (
          <Badge color="success" size="sm">
            Yes
          </Badge>
        ) : (
          <Badge color="slate" size="sm">
            No
          </Badge>
        ),
    },
    { key: "result_summary", label: "Result", render: (r) => r.result_summary ?? "—" },
  ];

  return (
    <>
      {currentCampId ? (
        <Stack>
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={600} size="lg">
                Screenings
              </Text>
              <Text size="xs" c="dimmed">
                {selectedCamp
                  ? `${selectedCamp.camp_code} · ${selectedCamp.name}`
                  : "Selected camp"}
              </Text>
            </Stack>
            {canManageScreenings && (
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => openScreeningDrawer()}
              >
                Record Screening
              </Button>
            )}
          </Group>
          <DataTable
            columns={scrCols}
            data={screenings}
            loading={scrLoading}
            rowKey={(r) => r.id}
          />

          <Group justify="space-between" mt="lg">
            <Text fw={600} size="lg">
              Lab Samples
            </Text>
            {canManageLab && (
              <Button size="xs" leftSection={<IconPlus size={14} />} onClick={labHandlers.open}>
                Record Sample
              </Button>
            )}
          </Group>
          <DataTable
            columns={labCols}
            data={labSamples}
            loading={labLoading}
            rowKey={(r) => r.id}
          />
        </Stack>
      ) : (
        <Text c="dimmed" ta="center" mt="xl">
          Select an active camp to view screenings and lab samples
        </Text>
      )}

      {/* Screening Drawer */}
      <Drawer
        opened={scrOpen}
        onClose={closeScreeningDrawer}
        title="Record Screening"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmitScreening(handleCreateScreening)}>
          <Controller
            control={screeningControl}
            name="registration_id"
            render={({ field }) => (
              <Select
                label="Camp participant"
                placeholder="Search registration, name, phone"
                data={registrationOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                required
                searchable
                error={screeningErrors.registration_id?.message}
              />
            )}
          />
          <Stack gap="xs">
            <Text fw={600} size="sm">
              Vitals
            </Text>
            <VitalsRecorder onChange={setScreeningVitals} showActions={false} showNotes={false} />
          </Stack>
          <Controller
            control={screeningControl}
            name="blood_sugar_random"
            render={({ field }) => (
              <NumberInput
                label="Random Blood Sugar"
                decimalScale={1}
                value={field.value}
                onChange={field.onChange}
                min={0}
                error={screeningErrors.blood_sugar_random?.message}
              />
            )}
          />
          <Group grow>
            <TextInput label="Visual Acuity (L)" {...registerScreening("visual_acuity_left")} />
            <TextInput label="Visual Acuity (R)" {...registerScreening("visual_acuity_right")} />
          </Group>
          <Textarea label="Findings" {...registerScreening("findings")} />
          <Textarea label="Provisional Diagnosis" {...registerScreening("diagnosis")} />
          <Textarea label="Advice" {...registerScreening("advice")} />
          <Controller
            control={screeningControl}
            name="referred_to_hospital"
            render={({ field }) => (
              <Switch
                label="Refer to hospital / OPD"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {referredToHospital && (
            <Group grow>
              <TextInput
                label="Referral Department"
                {...registerScreening("referral_department")}
              />
              <Controller
                control={screeningControl}
                name="referral_urgency"
                render={({ field }) => (
                  <Select
                    label="Urgency"
                    data={[
                      { value: "routine", label: "Routine" },
                      { value: "urgent", label: "Urgent" },
                      { value: "emergency", label: "Emergency" },
                    ]}
                    value={field.value || null}
                    onChange={(value) => field.onChange(value ?? "")}
                    clearable
                  />
                )}
              />
            </Group>
          )}
          <Button type="submit" loading={scrMut.isPending}>
            Save Screening
          </Button>
        </Stack>
      </Drawer>

      {/* Lab Sample Drawer */}
      <Drawer
        opened={labOpen}
        onClose={labHandlers.close}
        title="Record Lab Sample"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleSubmitLab(handleCreateLabSample)}>
          <Controller
            control={labControl}
            name="registration_id"
            render={({ field }) => (
              <Select
                label="Camp participant"
                placeholder="Search registration, name, phone"
                data={registrationOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                required
                searchable
                error={labErrors.registration_id?.message}
              />
            )}
          />
          <Controller
            control={labControl}
            name="sample_type"
            render={({ field }) => (
              <Select
                label="Sample Type"
                required
                data={SAMPLE_TYPES}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "blood")}
                error={labErrors.sample_type?.message}
              />
            )}
          />
          <TextInput
            label="Test Requested"
            error={labErrors.test_requested?.message}
            {...registerLab("test_requested")}
          />
          <TextInput
            label="Barcode"
            error={labErrors.barcode?.message}
            {...registerLab("barcode")}
          />
          <Button type="submit" loading={labMut.isPending}>
            Save Sample
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Follow-ups & Conversion Tab
// ══════════════════════════════════════════════════════════

function FollowupsTab({
  campId,
  selectedCamp,
}: {
  campId: string | null;
  selectedCamp: Camp | null;
}) {
  const canManage = useHasPermission(P.CAMP.FOLLOWUPS_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [statusTab, setStatusTab] = useState<string | null>("all");
  const followupDefaults: CampFollowupFormInput = {
    registration_id: "",
    followup_date: "",
    followup_type: "phone_call",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CampFollowupFormInput>({
    resolver: zodResolver(campFollowupFormSchema),
    defaultValues: followupDefaults,
  });

  const { data: followups = [], isLoading } = useQuery({
    queryKey: ["camp-followups", campId],
    queryFn: () => campService.listCampFollowups(campId ? { camp_id: campId } : undefined),
    enabled: !!campId,
  });

  const { data: stats } = useQuery({
    queryKey: ["camp-stats", campId],
    queryFn: () => campService.getCampStats(campId ?? ""),
    enabled: !!campId,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["camp-registrations", campId, "followup-selector"],
    queryFn: () => campService.listCampRegistrations({ camp_id: campId ?? "" }),
    enabled: !!campId,
  });

  const registrationOptions = useMemo(
    () =>
      registrations.map((registration) => ({
        value: registration.id,
        label: [
          registration.registration_number,
          registration.person_name,
          registration.status,
          registration.phone ?? undefined,
        ]
          .filter(Boolean)
          .join(" - "),
      })),
    [registrations],
  );
  const registrationsById = useMemo(
    () => new Map(registrations.map((registration) => [registration.id, registration])),
    [registrations],
  );
  const filteredFollowups = useMemo(
    () => (statusTab === "all" ? followups : followups.filter((row) => row.status === statusTab)),
    [followups, statusTab],
  );
  const renderRegistrationCell = (registrationId: string) => {
    const registration = registrationsById.get(registrationId);
    if (!registration) {
      return (
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            Unlinked registration
          </Text>
          <Text size="xs" c="dimmed">
            {registrationId.slice(0, 8)}
          </Text>
        </Stack>
      );
    }

    return (
      <Stack gap={2}>
        <Text size="sm" fw={600}>
          {registration.person_name}
        </Text>
        <Text size="xs" c="dimmed">
          {registration.registration_number}
          {registration.phone ? ` · ${registration.phone}` : ""}
        </Text>
      </Stack>
    );
  };

  const createMut = useMutation({
    mutationFn: (data: CreateCampFollowupRequest) => campService.createCampFollowup(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-followups"] });
      void qc.invalidateQueries({ queryKey: ["camp-stats"] });
      createHandlers.close();
      reset(followupDefaults);
      notifications.show({
        title: "Follow-up Created",
        message: "Follow-up scheduled",
        color: "success",
      });
    },
  });

  const handleCreateFollowup = (values: CampFollowupFormInput) => {
    createMut.mutate({
      registration_id: values.registration_id.trim(),
      followup_date: values.followup_date.trim(),
      followup_type: values.followup_type,
      notes: campOptionalText(values.notes),
    });
  };

  const completeMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCampFollowupRequest }) =>
      campService.updateCampFollowup(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-followups"] });
      void qc.invalidateQueries({ queryKey: ["camp-stats"] });
    },
  });

  const columns: Column<CampFollowup>[] = [
    {
      key: "registration_id",
      label: "Participant",
      render: (r) => renderRegistrationCell(r.registration_id),
    },
    { key: "followup_date", label: "Date", render: (r) => r.followup_date },
    {
      key: "followup_type",
      label: "Type",
      render: (r) =>
        campFollowupTypeOptions.find((t) => t.value === r.followup_type)?.label ?? r.followup_type,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge color={FOLLOWUP_STATUS_COLORS[r.status] ?? "slate"} variant="filled" size="sm">
          {r.status}
        </Badge>
      ),
    },
    {
      key: "converted",
      label: "Converted",
      render: (r) =>
        r.converted_to_patient ? (
          <Badge color="success" size="sm">
            Yes
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            No
          </Text>
        ),
    },
    { key: "outcome", label: "Outcome", render: (r) => r.outcome ?? "—" },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage && r.status === "scheduled" ? (
          <Group gap={4}>
            <Tooltip label="Mark Completed">
              <ActionIcon
                variant="subtle"
                color="success"
                size="sm"
                onClick={() => completeMut.mutate({ id: r.id, data: { status: "completed" } })}
                aria-label="Confirm"
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Mark Missed">
              <ActionIcon
                variant="subtle"
                color="danger"
                size="sm"
                onClick={() => completeMut.mutate({ id: r.id, data: { status: "missed" } })}
                aria-label="Close"
              >
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null,
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Text fw={600}>{selectedCamp ? selectedCamp.name : "Select an active camp"}</Text>
          <Text size="xs" c="dimmed">
            Follow-ups are scheduled from the current camp registration list.
          </Text>
        </Stack>
        {canManage && campId && (
          <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Schedule Follow-up
          </Button>
        )}
      </Group>

      {stats && campId && (
        <SimpleGrid cols={5} mb="md">
          <StatCard label="Total Registrations" value={stats.total_registrations} />
          <StatCard label="Referred" value={stats.referred} />
          <StatCard label="Follow-ups" value={stats.followups_scheduled} />
          <StatCard label="Converted" value={stats.converted} />
          <StatCard
            label="Conversion Rate"
            value={
              stats.total_registrations > 0
                ? Math.round((stats.converted / stats.total_registrations) * 100)
                : 0
            }
            prefix=""
          />
        </SimpleGrid>
      )}

      {campId ? (
        <Stack>
          <Tabs value={statusTab} onChange={setStatusTab}>
            <Tabs.List>
              <Tabs.Tab value="all">All</Tabs.Tab>
              <Tabs.Tab value="scheduled">Scheduled</Tabs.Tab>
              <Tabs.Tab value="completed">Completed</Tabs.Tab>
              <Tabs.Tab value="missed">Missed</Tabs.Tab>
              <Tabs.Tab value="cancelled">Cancelled</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <DataTable
            columns={columns}
            data={filteredFollowups}
            loading={isLoading}
            rowKey={(r) => r.id}
          />
        </Stack>
      ) : (
        <Text c="dimmed" ta="center" mt="xl">
          Open an active camp workspace to view follow-ups
        </Text>
      )}

      <Drawer
        opened={createOpen}
        onClose={() => {
          createHandlers.close();
          reset(followupDefaults);
        }}
        title="Schedule Follow-up"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateFollowup)}>
          <Controller
            control={control}
            name="registration_id"
            render={({ field }) => (
              <Select
                label="Camp participant"
                placeholder="Search registration, name, phone"
                data={registrationOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                required
                searchable
                error={errors.registration_id?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="followup_date"
            render={({ field }) => (
              <DateInput
                label="Follow-up Date"
                required
                value={field.value ? new Date(field.value) : null}
                onChange={(date) =>
                  field.onChange(date ? new Date(date).toISOString().slice(0, 10) : "")
                }
                error={errors.followup_date?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="followup_type"
            render={({ field }) => (
              <Select
                label="Follow-up Type"
                data={campFollowupTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "phone_call")}
                error={errors.followup_type?.message}
              />
            )}
          />
          <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />
          <Button type="submit" loading={createMut.isPending}>
            Schedule
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Analytics & Reports Tab
// ══════════════════════════════════════════════════════════

function CampAnalyticsTab({
  campId,
  selectedCamp,
}: {
  campId: string | null;
  selectedCamp: Camp | null;
}) {
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["camp-analytics"],
    queryFn: () => campService.campAnalytics(),
  });

  const { data: report } = useQuery({
    queryKey: ["camp-report", campId],
    queryFn: () => campService.campReport(campId ?? ""),
    enabled: !!campId,
  });

  const stats = analytics as CampAnalyticsType | undefined;
  const campReport = report as CampReportType | undefined;

  const chartData = stats?.by_type
    ? Object.entries(stats.by_type).map(([type, count]) => ({
        type: type.replace(/_/g, " "),
        camps: count,
      }))
    : [];

  return (
    <Stack>
      <Text fw={600} size="lg">
        Camp Analytics
      </Text>
      {analyticsLoading && (
        <Text size="sm" c="dimmed">
          Loading analytics...
        </Text>
      )}

      {stats && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
            <StatCard label="Total Camps" value={stats.total_camps} />
            <StatCard label="Total Registrations" value={stats.total_registrations} />
            <StatCard label="Total Screenings" value={stats.total_screened} />
            <StatCard
              label="Conversion Rate"
              value={Math.round(stats.conversion_rate_pct)}
              prefix=""
            />
            <StatCard
              label="Avg Cost/Patient"
              value={Math.round(stats.avg_cost_per_patient)}
              prefix="₹"
            />
            <StatCard
              label="Followup Compliance"
              value={Math.round(stats.followup_compliance_pct)}
              prefix=""
            />
          </SimpleGrid>

          {chartData.length > 0 && (
            <Card withBorder p="md" mt="md">
              <Text fw={600} size="sm" mb="md">
                Camps by Type
              </Text>
              <BarChart
                h={250}
                data={chartData}
                dataKey="type"
                series={[{ name: "camps", color: "teal" }]}
              />
            </Card>
          )}
        </>
      )}

      <Text fw={600} size="lg" mt="lg">
        Camp Report
      </Text>
      <Text size="xs" c="dimmed">
        {selectedCamp
          ? `${selectedCamp.camp_code} · ${selectedCamp.name}`
          : "Open a camp workspace for the per-camp report."}
      </Text>

      {campReport && (
        <Card withBorder p="md">
          <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
            <StatCard label="Registrations" value={campReport.stats.total_registrations} />
            <StatCard label="Screenings" value={campReport.stats.total_screenings} />
            <StatCard label="Referred" value={campReport.stats.referred} />
            <StatCard label="Follow-ups" value={campReport.stats.followups_total} />
            <StatCard label="Billing Total" value={campReport.stats.billing_total} prefix="₹" />
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}
