import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
  Card,
  SimpleGrid,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconFirstAidKit,
  IconUsers,
  IconStethoscope,
  IconCalendarCheck,
  IconChartBar,
  IconPencil,
  IconCheck,
  IconPlayerPlay,
  IconX,
  IconTrash,
} from "@tabler/icons-react";
import { BarChart } from "@mantine/charts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  Camp,
  CampTeamMember,
  CampRegistration,
  CampScreening,
  CampLabSample,
  CampFollowup,
  CreateCampRequest,
  CreateCampRegistrationRequest,
  CreateCampScreeningRequest,
  CreateCampLabSampleRequest,
  CreateCampFollowupRequest,
  UpdateCampFollowupRequest,
  CampAnalytics as CampAnalyticsType,
  CampReport as CampReportType,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { EmployeeSearchSelect } from "../components/EmployeeSearchSelect";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Constants ──────────────────────────────────────────

const CAMP_TYPES = [
  { value: "general_health", label: "General Health" },
  { value: "blood_donation", label: "Blood Donation" },
  { value: "vaccination", label: "Vaccination" },
  { value: "eye_screening", label: "Eye Screening" },
  { value: "dental", label: "Dental" },
  { value: "awareness", label: "Awareness" },
  { value: "specialized", label: "Specialized" },
];

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

const SAMPLE_TYPES = [
  { value: "blood", label: "Blood" },
  { value: "urine", label: "Urine" },
  { value: "sputum", label: "Sputum" },
  { value: "swab", label: "Swab" },
  { value: "other", label: "Other" },
];

const FOLLOWUP_TYPES = [
  { value: "phone_call", label: "Phone Call" },
  { value: "hospital_visit", label: "Hospital Visit" },
  { value: "home_visit", label: "Home Visit" },
];

// ── Main Page ──────────────────────────────────────────

export function CampPage() {
  useRequirePermission(P.CAMP.LIST);
  const [activeTab, setActiveTab] = useState<string | null>("camps");

  return (
    <div>
      <PageHeader
        title="Camp Management"
        subtitle="Outreach camps — planning, registration, screening, follow-up"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="camps" leftSection={<IconFirstAidKit size={16} />}>
            Camps
          </Tabs.Tab>
          <Tabs.Tab value="registrations" leftSection={<IconUsers size={16} />}>
            Registrations
          </Tabs.Tab>
          <Tabs.Tab value="screenings" leftSection={<IconStethoscope size={16} />}>
            Screenings & Lab
          </Tabs.Tab>
          <Tabs.Tab value="followups" leftSection={<IconCalendarCheck size={16} />}>
            Follow-up & Conversion
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics & Reports
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="camps" pt="md">
          <CampsTab />
        </Tabs.Panel>
        <Tabs.Panel value="registrations" pt="md">
          <RegistrationsTab />
        </Tabs.Panel>
        <Tabs.Panel value="screenings" pt="md">
          <ScreeningsTab />
        </Tabs.Panel>
        <Tabs.Panel value="followups" pt="md">
          <FollowupsTab />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <CampAnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Camps Tab
// ══════════════════════════════════════════════════════════

function CampsTab() {
  const canCreate = useHasPermission(P.CAMP.CREATE);
  const canUpdate = useHasPermission(P.CAMP.UPDATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [detailOpen, detailHandlers] = useDisclosure(false);
  const [selectedCamp, setSelectedCamp] = useState<Camp | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: camps = [], isLoading } = useQuery({
    queryKey: ["camps", statusFilter],
    queryFn: () =>
      api.listCamps(statusFilter ? { status: statusFilter } : undefined),
  });

  // Create form state
  const [form, setForm] = useState<CreateCampRequest>({
    name: "",
    camp_type: "general_health",
    scheduled_date: "",
  });

  const createMut = useMutation({
    mutationFn: () => api.createCamp(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      createHandlers.close();
      setForm({ name: "", camp_type: "general_health", scheduled_date: "" });
      notifications.show({ title: "Camp Created", message: "Camp planned successfully", color: "success" });
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.approveCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Approved", message: "Camp approved", color: "success" });
    },
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => api.activateCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Activated", message: "Camp is now active", color: "success" });
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => api.completeCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Completed", message: "Camp marked as completed", color: "teal" });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.cancelCamp(id, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Cancelled", message: "Camp cancelled", color: "danger" });
    },
  });

  const columns: Column<Camp>[] = [
    { key: "camp_code", label: "Code", render: (r) => <Text size="sm" fw={500}>{r.camp_code}</Text> },
    { key: "name", label: "Name", render: (r) => r.name },
    {
      key: "camp_type",
      label: "Type",
      render: (r) => (
        <Badge variant="light" size="sm">
          {CAMP_TYPES.find((t) => t.value === r.camp_type)?.label ?? r.camp_type}
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
      <Drawer opened={createOpen} onClose={createHandlers.close} title="Plan New Camp" position="right" size="xl">
        <Stack>
          <TextInput label="Camp Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <Select label="Camp Type" required data={CAMP_TYPES} value={form.camp_type} onChange={(v) => setForm({ ...form, camp_type: v ?? "general_health" })} />
          <DateInput label="Scheduled Date" required value={form.scheduled_date ? new Date(form.scheduled_date) : null} onChange={(d) => setForm({ ...form, scheduled_date: d ? new Date(d).toISOString().slice(0, 10) : "" })} />
          <TextInput label="Start Time" placeholder="09:00" value={form.start_time ?? ""} onChange={(e) => setForm({ ...form, start_time: e.currentTarget.value || undefined })} />
          <TextInput label="End Time" placeholder="17:00" value={form.end_time ?? ""} onChange={(e) => setForm({ ...form, end_time: e.currentTarget.value || undefined })} />
          <TextInput label="Venue Name" value={form.venue_name ?? ""} onChange={(e) => setForm({ ...form, venue_name: e.currentTarget.value || undefined })} />
          <TextInput label="Venue Address" value={form.venue_address ?? ""} onChange={(e) => setForm({ ...form, venue_address: e.currentTarget.value || undefined })} />
          <Group grow>
            <TextInput label="City" value={form.venue_city ?? ""} onChange={(e) => setForm({ ...form, venue_city: e.currentTarget.value || undefined })} />
            <TextInput label="State" value={form.venue_state ?? ""} onChange={(e) => setForm({ ...form, venue_state: e.currentTarget.value || undefined })} />
            <TextInput label="Pincode" value={form.venue_pincode ?? ""} onChange={(e) => setForm({ ...form, venue_pincode: e.currentTarget.value || undefined })} />
          </Group>
          <NumberInput label="Expected Participants" min={0} value={form.expected_participants ?? ""} onChange={(v) => setForm({ ...form, expected_participants: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Budget Allocated" min={0} decimalScale={2} value={form.budget_allocated ?? ""} onChange={(v) => setForm({ ...form, budget_allocated: typeof v === "number" ? v : undefined })} />
          <Switch label="Free Camp" checked={form.is_free !== false} onChange={(e) => setForm({ ...form, is_free: e.currentTarget.checked })} />
          <Textarea label="Logistics Notes" value={form.logistics_notes ?? ""} onChange={(e) => setForm({ ...form, logistics_notes: e.currentTarget.value || undefined })} />
          <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!form.name || !form.scheduled_date}>
            Create Camp
          </Button>
        </Stack>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer opened={detailOpen} onClose={detailHandlers.close} title={selectedCamp?.name ?? "Camp Detail"} position="right" size="lg">
        {selectedCamp && <CampDetail camp={selectedCamp} />}
      </Drawer>
    </>
  );
}

// ── Camp Detail (team management + stats) ────────────

function CampDetail({ camp }: { camp: Camp }) {
  const canUpdate = useHasPermission(P.CAMP.UPDATE);
  const qc = useQueryClient();
  const [addOpen, addHandlers] = useDisclosure(false);
  const [teamForm, setTeamForm] = useState({ employee_id: "", role_in_camp: "volunteer" });

  const { data: team = [] } = useQuery({
    queryKey: ["camp-team", camp.id],
    queryFn: () => api.listCampTeamMembers(camp.id),
  });

  const { data: stats } = useQuery({
    queryKey: ["camp-stats", camp.id],
    queryFn: () => api.getCampStats(camp.id),
  });

  const addMut = useMutation({
    mutationFn: () =>
      api.addCampTeamMember(camp.id, {
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
    mutationFn: (memberId: string) => api.removeCampTeamMember(camp.id, memberId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["camp-team", camp.id] }),
  });

  const teamCols: Column<CampTeamMember>[] = [
    { key: "employee_id", label: "Employee ID", render: (r) => r.employee_id.slice(0, 8) },
    { key: "role_in_camp", label: "Role", render: (r) => TEAM_ROLES.find((t) => t.value === r.role_in_camp)?.label ?? r.role_in_camp },
    { key: "is_confirmed", label: "Confirmed", render: (r) => r.is_confirmed ? <Badge color="success" size="xs">Yes</Badge> : <Badge color="slate" size="xs">No</Badge> },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate ? (
          <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => removeMut.mutate(r.id)} aria-label="Delete">
            <IconTrash size={14} />
          </ActionIcon>
        ) : null,
    },
  ];

  return (
    <Stack>
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

      <Group justify="space-between">
        <Text fw={600}>Team Members ({team.length})</Text>
        {canUpdate && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addHandlers.open}>
            Add Member
          </Button>
        )}
      </Group>

      <DataTable columns={teamCols} data={team} rowKey={(r) => r.id} />

      <Drawer opened={addOpen} onClose={addHandlers.close} title="Add Team Member" position="right" size="sm">
        <Stack>
          <EmployeeSearchSelect value={teamForm.employee_id} onChange={(id) => setTeamForm({ ...teamForm, employee_id: id })} required />
          <Select label="Role" data={TEAM_ROLES} value={teamForm.role_in_camp} onChange={(v) => setTeamForm({ ...teamForm, role_in_camp: v ?? "volunteer" })} />
          <Button onClick={() => addMut.mutate()} loading={addMut.isPending} disabled={!teamForm.employee_id}>
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
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="lg" fw={700}>{prefix}{value}</Text>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  Registrations Tab
// ══════════════════════════════════════════════════════════

function RegistrationsTab() {
  const canCreate = useHasPermission(P.CAMP.REGISTRATIONS_CREATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);

  const { data: camps = [] } = useQuery({
    queryKey: ["camps"],
    queryFn: () => api.listCamps(),
  });

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ["camp-registrations", selectedCampId],
    queryFn: () => api.listCampRegistrations({ camp_id: selectedCampId ?? "" }),
    enabled: !!selectedCampId,
  });

  const [form, setForm] = useState<CreateCampRegistrationRequest>({
    camp_id: "",
    person_name: "",
  });

  const createMut = useMutation({
    mutationFn: () => api.createCampRegistration({ ...form, camp_id: selectedCampId ?? "" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      createHandlers.close();
      setForm({ camp_id: "", person_name: "" });
      notifications.show({ title: "Registered", message: "Participant registered", color: "success" });
    },
  });

  const columns: Column<CampRegistration>[] = [
    { key: "registration_number", label: "Reg #", render: (r) => <Text size="sm" fw={500}>{r.registration_number}</Text> },
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
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Select Camp"
          data={camps.map((c) => ({ value: c.id, label: `${c.camp_code} — ${c.name}` }))}
          value={selectedCampId}
          onChange={setSelectedCampId}
          w={400}
          searchable
        />
        {canCreate && selectedCampId && (
          <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Register Participant
          </Button>
        )}
      </Group>

      {selectedCampId ? (
        <DataTable columns={columns} data={regs} loading={isLoading} rowKey={(r) => r.id} />
      ) : (
        <Text c="dimmed" ta="center" mt="xl">Select a camp to view registrations</Text>
      )}

      <Drawer opened={createOpen} onClose={createHandlers.close} title="Register Participant" position="right" size="xl">
        <Stack>
          <TextInput label="Person Name" required value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.currentTarget.value })} />
          <Group grow>
            <NumberInput label="Age" min={0} max={150} value={form.age ?? ""} onChange={(v) => setForm({ ...form, age: typeof v === "number" ? v : undefined })} />
            <Select label="Gender" data={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]} value={form.gender ?? null} onChange={(v) => setForm({ ...form, gender: v ?? undefined })} />
          </Group>
          <TextInput label="Phone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.currentTarget.value || undefined })} />
          <Textarea label="Address" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.currentTarget.value || undefined })} />
          <Group grow>
            <Select label="ID Proof Type" data={ID_PROOF_TYPES} placeholder="Select ID type" value={form.id_proof_type ?? null} onChange={(v) => setForm({ ...form, id_proof_type: v || undefined })} clearable searchable />
            <TextInput label="ID Proof Number" value={form.id_proof_number ?? ""} onChange={(e) => setForm({ ...form, id_proof_number: e.currentTarget.value || undefined })} />
          </Group>
          <Textarea label="Chief Complaint" value={form.chief_complaint ?? ""} onChange={(e) => setForm({ ...form, chief_complaint: e.currentTarget.value || undefined })} />
          <Switch label="Walk-in" checked={form.is_walk_in !== false} onChange={(e) => setForm({ ...form, is_walk_in: e.currentTarget.checked })} />
          <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!form.person_name}>
            Register
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Screenings & Lab Tab
// ══════════════════════════════════════════════════════════

function ScreeningsTab() {
  const canManageScreenings = useHasPermission(P.CAMP.SCREENINGS_MANAGE);
  const canManageLab = useHasPermission(P.CAMP.LAB_MANAGE);
  const qc = useQueryClient();
  const [scrOpen, scrHandlers] = useDisclosure(false);
  const [labOpen, labHandlers] = useDisclosure(false);
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);

  const { data: camps = [] } = useQuery({
    queryKey: ["camps"],
    queryFn: () => api.listCamps(),
  });

  const { data: screenings = [], isLoading: scrLoading } = useQuery({
    queryKey: ["camp-screenings", selectedCampId],
    queryFn: () => api.listCampScreenings(selectedCampId ? { camp_id: selectedCampId } : undefined),
    enabled: !!selectedCampId,
  });

  const { data: labSamples = [], isLoading: labLoading } = useQuery({
    queryKey: ["camp-lab-samples", selectedCampId],
    queryFn: () => api.listCampLabSamples(selectedCampId ? { camp_id: selectedCampId } : undefined),
    enabled: !!selectedCampId,
  });

  const [scrForm, setScrForm] = useState<CreateCampScreeningRequest>({ registration_id: "" });
  const [labForm, setLabForm] = useState<CreateCampLabSampleRequest>({ registration_id: "", sample_type: "blood" });

  const scrMut = useMutation({
    mutationFn: () => api.createCampScreening(scrForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-screenings"] });
      scrHandlers.close();
      setScrForm({ registration_id: "" });
      notifications.show({ title: "Screening Recorded", message: "Screening saved", color: "success" });
    },
  });

  const labMut = useMutation({
    mutationFn: () => api.createCampLabSample(labForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-lab-samples"] });
      labHandlers.close();
      setLabForm({ registration_id: "", sample_type: "blood" });
      notifications.show({ title: "Sample Recorded", message: "Lab sample recorded", color: "success" });
    },
  });

  const scrCols: Column<CampScreening>[] = [
    { key: "registration_id", label: "Reg ID", render: (r) => r.registration_id.slice(0, 8) },
    { key: "bp", label: "BP", render: (r) => r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : "—" },
    { key: "pulse_rate", label: "Pulse", render: (r) => r.pulse_rate?.toString() ?? "—" },
    { key: "spo2", label: "SpO2", render: (r) => r.spo2 ? `${r.spo2}%` : "—" },
    { key: "blood_sugar_random", label: "BSR", render: (r) => r.blood_sugar_random?.toString() ?? "—" },
    { key: "bmi", label: "BMI", render: (r) => r.bmi?.toString() ?? "—" },
    { key: "findings", label: "Findings", render: (r) => r.findings ?? "—" },
    {
      key: "referred",
      label: "Referred",
      render: (r) =>
        r.referred_to_hospital ? (
          <Badge color="orange" size="sm">{r.referral_urgency ?? "Yes"}</Badge>
        ) : (
          <Text size="sm" c="dimmed">No</Text>
        ),
    },
  ];

  const labCols: Column<CampLabSample>[] = [
    { key: "registration_id", label: "Reg ID", render: (r) => r.registration_id.slice(0, 8) },
    { key: "sample_type", label: "Sample", render: (r) => r.sample_type },
    { key: "test_requested", label: "Test", render: (r) => r.test_requested ?? "—" },
    { key: "barcode", label: "Barcode", render: (r) => r.barcode ?? "—" },
    {
      key: "sent_to_lab",
      label: "Sent to Lab",
      render: (r) =>
        r.sent_to_lab ? (
          <Badge color="success" size="sm">Yes</Badge>
        ) : (
          <Badge color="slate" size="sm">No</Badge>
        ),
    },
    { key: "result_summary", label: "Result", render: (r) => r.result_summary ?? "—" },
  ];

  return (
    <>
      <Select
        placeholder="Select Camp"
        data={camps.map((c) => ({ value: c.id, label: `${c.camp_code} — ${c.name}` }))}
        value={selectedCampId}
        onChange={setSelectedCampId}
        w={400}
        mb="md"
        searchable
      />

      {selectedCampId ? (
        <Stack>
          <Group justify="space-between">
            <Text fw={600} size="lg">Screenings</Text>
            {canManageScreenings && (
              <Button size="xs" leftSection={<IconPlus size={14} />} onClick={scrHandlers.open}>
                Record Screening
              </Button>
            )}
          </Group>
          <DataTable columns={scrCols} data={screenings} loading={scrLoading} rowKey={(r) => r.id} />

          <Group justify="space-between" mt="lg">
            <Text fw={600} size="lg">Lab Samples</Text>
            {canManageLab && (
              <Button size="xs" leftSection={<IconPlus size={14} />} onClick={labHandlers.open}>
                Record Sample
              </Button>
            )}
          </Group>
          <DataTable columns={labCols} data={labSamples} loading={labLoading} rowKey={(r) => r.id} />
        </Stack>
      ) : (
        <Text c="dimmed" ta="center" mt="xl">Select a camp to view screenings and lab samples</Text>
      )}

      {/* Screening Drawer */}
      <Drawer opened={scrOpen} onClose={scrHandlers.close} title="Record Screening" position="right" size="xl">
        <Stack>
          <TextInput label="Registration ID" required value={scrForm.registration_id} onChange={(e) => setScrForm({ ...scrForm, registration_id: e.currentTarget.value })} />
          <Group grow>
            <NumberInput label="BP Systolic" value={scrForm.bp_systolic ?? ""} onChange={(v) => setScrForm({ ...scrForm, bp_systolic: typeof v === "number" ? v : undefined })} />
            <NumberInput label="BP Diastolic" value={scrForm.bp_diastolic ?? ""} onChange={(v) => setScrForm({ ...scrForm, bp_diastolic: typeof v === "number" ? v : undefined })} />
          </Group>
          <Group grow>
            <NumberInput label="Pulse Rate" value={scrForm.pulse_rate ?? ""} onChange={(v) => setScrForm({ ...scrForm, pulse_rate: typeof v === "number" ? v : undefined })} />
            <NumberInput label="SpO2 (%)" value={scrForm.spo2 ?? ""} onChange={(v) => setScrForm({ ...scrForm, spo2: typeof v === "number" ? v : undefined })} />
          </Group>
          <Group grow>
            <NumberInput label="Temperature" decimalScale={1} value={scrForm.temperature ?? ""} onChange={(v) => setScrForm({ ...scrForm, temperature: typeof v === "number" ? v : undefined })} />
            <NumberInput label="Blood Sugar (Random)" decimalScale={1} value={scrForm.blood_sugar_random ?? ""} onChange={(v) => setScrForm({ ...scrForm, blood_sugar_random: typeof v === "number" ? v : undefined })} />
          </Group>
          <Group grow>
            <NumberInput label="Height (cm)" decimalScale={1} value={scrForm.height_cm ?? ""} onChange={(v) => setScrForm({ ...scrForm, height_cm: typeof v === "number" ? v : undefined })} />
            <NumberInput label="Weight (kg)" decimalScale={1} value={scrForm.weight_kg ?? ""} onChange={(v) => setScrForm({ ...scrForm, weight_kg: typeof v === "number" ? v : undefined })} />
          </Group>
          <Group grow>
            <TextInput label="Visual Acuity (L)" value={scrForm.visual_acuity_left ?? ""} onChange={(e) => setScrForm({ ...scrForm, visual_acuity_left: e.currentTarget.value || undefined })} />
            <TextInput label="Visual Acuity (R)" value={scrForm.visual_acuity_right ?? ""} onChange={(e) => setScrForm({ ...scrForm, visual_acuity_right: e.currentTarget.value || undefined })} />
          </Group>
          <Textarea label="Findings" value={scrForm.findings ?? ""} onChange={(e) => setScrForm({ ...scrForm, findings: e.currentTarget.value || undefined })} />
          <Textarea label="Diagnosis" value={scrForm.diagnosis ?? ""} onChange={(e) => setScrForm({ ...scrForm, diagnosis: e.currentTarget.value || undefined })} />
          <Textarea label="Advice" value={scrForm.advice ?? ""} onChange={(e) => setScrForm({ ...scrForm, advice: e.currentTarget.value || undefined })} />
          <Switch label="Referred to Hospital" checked={scrForm.referred_to_hospital === true} onChange={(e) => setScrForm({ ...scrForm, referred_to_hospital: e.currentTarget.checked })} />
          {scrForm.referred_to_hospital && (
            <Group grow>
              <TextInput label="Referral Department" value={scrForm.referral_department ?? ""} onChange={(e) => setScrForm({ ...scrForm, referral_department: e.currentTarget.value || undefined })} />
              <Select label="Urgency" data={[{ value: "routine", label: "Routine" }, { value: "urgent", label: "Urgent" }, { value: "emergency", label: "Emergency" }]} value={scrForm.referral_urgency ?? null} onChange={(v) => setScrForm({ ...scrForm, referral_urgency: v ?? undefined })} />
            </Group>
          )}
          <Button onClick={() => scrMut.mutate()} loading={scrMut.isPending} disabled={!scrForm.registration_id}>
            Save Screening
          </Button>
        </Stack>
      </Drawer>

      {/* Lab Sample Drawer */}
      <Drawer opened={labOpen} onClose={labHandlers.close} title="Record Lab Sample" position="right" size="sm">
        <Stack>
          <TextInput label="Registration ID" required value={labForm.registration_id} onChange={(e) => setLabForm({ ...labForm, registration_id: e.currentTarget.value })} />
          <Select label="Sample Type" required data={SAMPLE_TYPES} value={labForm.sample_type} onChange={(v) => setLabForm({ ...labForm, sample_type: v ?? "blood" })} />
          <TextInput label="Test Requested" value={labForm.test_requested ?? ""} onChange={(e) => setLabForm({ ...labForm, test_requested: e.currentTarget.value || undefined })} />
          <TextInput label="Barcode" value={labForm.barcode ?? ""} onChange={(e) => setLabForm({ ...labForm, barcode: e.currentTarget.value || undefined })} />
          <Button onClick={() => labMut.mutate()} loading={labMut.isPending} disabled={!labForm.registration_id}>
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

function FollowupsTab() {
  const canManage = useHasPermission(P.CAMP.FOLLOWUPS_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);

  const { data: camps = [] } = useQuery({
    queryKey: ["camps"],
    queryFn: () => api.listCamps(),
  });

  const { data: followups = [], isLoading } = useQuery({
    queryKey: ["camp-followups", selectedCampId],
    queryFn: () => api.listCampFollowups(selectedCampId ? { camp_id: selectedCampId } : undefined),
    enabled: !!selectedCampId,
  });

  const { data: stats } = useQuery({
    queryKey: ["camp-stats", selectedCampId],
    queryFn: () => api.getCampStats(selectedCampId ?? ""),
    enabled: !!selectedCampId,
  });

  const [form, setForm] = useState<CreateCampFollowupRequest>({
    registration_id: "",
    followup_date: "",
    followup_type: "phone_call",
  });

  const createMut = useMutation({
    mutationFn: () => api.createCampFollowup(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-followups"] });
      void qc.invalidateQueries({ queryKey: ["camp-stats"] });
      createHandlers.close();
      setForm({ registration_id: "", followup_date: "", followup_type: "phone_call" });
      notifications.show({ title: "Follow-up Created", message: "Follow-up scheduled", color: "success" });
    },
  });

  const completeMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCampFollowupRequest }) =>
      api.updateCampFollowup(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-followups"] });
      void qc.invalidateQueries({ queryKey: ["camp-stats"] });
    },
  });

  const columns: Column<CampFollowup>[] = [
    { key: "registration_id", label: "Reg ID", render: (r) => r.registration_id.slice(0, 8) },
    { key: "followup_date", label: "Date", render: (r) => r.followup_date },
    { key: "followup_type", label: "Type", render: (r) => FOLLOWUP_TYPES.find((t) => t.value === r.followup_type)?.label ?? r.followup_type },
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
          <Badge color="success" size="sm">Yes</Badge>
        ) : (
          <Text size="sm" c="dimmed">No</Text>
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
                onClick={() =>
                  completeMut.mutate({ id: r.id, data: { status: "completed" } })
                }
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
                onClick={() =>
                  completeMut.mutate({ id: r.id, data: { status: "missed" } })
                }
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
        <Select
          placeholder="Select Camp"
          data={camps.map((c) => ({ value: c.id, label: `${c.camp_code} — ${c.name}` }))}
          value={selectedCampId}
          onChange={setSelectedCampId}
          w={400}
          searchable
        />
        {canManage && selectedCampId && (
          <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Schedule Follow-up
          </Button>
        )}
      </Group>

      {stats && selectedCampId && (
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

      {selectedCampId ? (
        <DataTable columns={columns} data={followups} loading={isLoading} rowKey={(r) => r.id} />
      ) : (
        <Text c="dimmed" ta="center" mt="xl">Select a camp to view follow-ups</Text>
      )}

      <Drawer opened={createOpen} onClose={createHandlers.close} title="Schedule Follow-up" position="right" size="sm">
        <Stack>
          <TextInput label="Registration ID" required value={form.registration_id} onChange={(e) => setForm({ ...form, registration_id: e.currentTarget.value })} />
          <DateInput label="Follow-up Date" required value={form.followup_date ? new Date(form.followup_date) : null} onChange={(d) => setForm({ ...form, followup_date: d ? new Date(d).toISOString().slice(0, 10) : "" })} />
          <Select label="Follow-up Type" data={FOLLOWUP_TYPES} value={form.followup_type} onChange={(v) => setForm({ ...form, followup_type: v ?? "phone_call" })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!form.registration_id || !form.followup_date}>
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

function CampAnalyticsTab() {
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);

  const { data: camps = [] } = useQuery({
    queryKey: ["camps"],
    queryFn: () => api.listCamps(),
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["camp-analytics"],
    queryFn: () => api.campAnalytics(),
  });

  const { data: report } = useQuery({
    queryKey: ["camp-report", selectedCampId],
    queryFn: () => api.campReport(selectedCampId ?? ""),
    enabled: !!selectedCampId,
  });

  const stats = analytics as CampAnalyticsType | undefined;
  const campReport = report as CampReportType | undefined;

  const chartData = stats
    ? Object.entries(stats.by_type).map(([type, count]) => ({
        type: type.replace(/_/g, " "),
        camps: count,
      }))
    : [];

  return (
    <Stack>
      <Text fw={600} size="lg">Camp Analytics</Text>
      {analyticsLoading && <Text size="sm" c="dimmed">Loading analytics...</Text>}

      {stats && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
            <StatCard label="Total Camps" value={stats.total_camps} />
            <StatCard label="Total Registrations" value={stats.total_registrations} />
            <StatCard label="Total Screenings" value={stats.total_screenings} />
            <StatCard label="Conversion Rate" value={Math.round(stats.conversion_rate * 100)} prefix="" />
            <StatCard label="Avg Cost/Patient" value={Math.round(stats.avg_cost_per_patient)} prefix="₹" />
            <StatCard label="Followup Compliance" value={Math.round(stats.followup_compliance * 100)} prefix="" />
          </SimpleGrid>

          {chartData.length > 0 && (
            <Card withBorder p="md" mt="md">
              <Text fw={600} size="sm" mb="md">Camps by Type</Text>
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

      <Text fw={600} size="lg" mt="lg">Per-Camp Report</Text>
      <Select
        placeholder="Select a camp for detailed report"
        data={camps.map((c) => ({ value: c.id, label: `${c.camp_code} — ${c.name}` }))}
        value={selectedCampId}
        onChange={setSelectedCampId}
        w={400}
        searchable
        clearable
      />

      {campReport && (
        <Card withBorder p="md">
          <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
            <StatCard label="Registrations" value={campReport.registrations} />
            <StatCard label="Screenings" value={campReport.screenings} />
            <StatCard label="Lab Samples" value={campReport.lab_samples} />
            <StatCard label="Follow-ups" value={campReport.followups} />
            <StatCard label="Billing Total" value={campReport.billing_total} prefix="₹" />
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}
