import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import {
  IconCalendar,
  IconChartBar,
  IconCheck,
  IconCircleCheck,
  IconCircleDashed,
  IconClock,
  IconEye,
  IconPlayerPlay,
  IconPlus,
  IconScissors,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  AnesthesiaType,
  AsaClassification,
  ChecklistPhase,
  CreateAnesthesiaRecordRequest,
  CreateCaseRecordRequest,
  CreateOtBookingRequest,
  CreateOtConsumableRequest,
  CreateOtRoomRequest,
  CreatePostopRecordRequest,
  CreatePreopAssessmentRequest,
  CreateSafetyChecklistRequest,
  CreateSurgeonPreferenceRequest,
  OtAnesthesiaRecord,
  OtBooking,
  OtCaseRecord,
  OtCasePriority,
  OtConsumableCategory,
  OtConsumableUsage,
  OtPostopRecord,
  OtPreopAssessment,
  OtRoom,
  OtSurgeonPreference,
  OtSurgicalSafetyChecklist,
  PostopRecoveryStatus,
  PreopClearanceStatus,
  RoomUtilization,
  UpdatePostopRecordRequest,
  UpdatePreopAssessmentRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader, StatusDot } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

const bookingStatusColors: Record<string, string> = {
  requested: "warning",
  confirmed: "primary",
  in_progress: "success",
  completed: "teal",
  cancelled: "danger",
  postponed: "orange",
};

export function OtPage() {
  useRequirePermission(P.OT.BOOKINGS_LIST);

  const canCreateBooking = useHasPermission(P.OT.BOOKINGS_CREATE);
  const canManageRooms = useHasPermission(P.OT.ROOMS_MANAGE);
  const canManagePrefs = useHasPermission(P.OT.PREFERENCES_MANAGE);

  return (
    <div>
      <PageHeader
        title="Operation Theatre"
        subtitle="OT booking & surgical management"
        icon={<IconScissors size={20} stroke={1.5} />}
        color="violet"
      />

      <Tabs defaultValue="schedule">
        <Tabs.List>
          <Tabs.Tab value="schedule">Schedule</Tabs.Tab>
          <Tabs.Tab value="bookings">Bookings</Tabs.Tab>
          <Tabs.Tab value="rooms">Rooms</Tabs.Tab>
          <Tabs.Tab value="preferences">Surgeon Preferences</Tabs.Tab>
          <Tabs.Tab value="reports" leftSection={<IconChartBar size={16} />}>Reports</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="schedule" pt="md">
          <ScheduleTab />
        </Tabs.Panel>
        <Tabs.Panel value="bookings" pt="md">
          <BookingsTab canCreate={canCreateBooking} />
        </Tabs.Panel>
        <Tabs.Panel value="rooms" pt="md">
          <RoomsTab canManage={canManageRooms} />
        </Tabs.Panel>
        <Tabs.Panel value="preferences" pt="md">
          <PreferencesTab canManage={canManagePrefs} />
        </Tabs.Panel>
        <Tabs.Panel value="reports" pt="md">
          <OtReportsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ── Schedule Tab ───────────────────────────────────────

function ScheduleTab() {
  const [date, setDate] = useState<Date | null>(new Date());
  const [roomId, setRoomId] = useState<string | null>(null);

  const { data: rooms } = useQuery({
    queryKey: ["ot-rooms"],
    queryFn: () => api.listOtRooms(),
  });

  const dateStr = date ? date.toISOString().split("T")[0] : undefined;
  const params: Record<string, string> = {};
  if (dateStr) params.date = dateStr;
  if (roomId) params.room_id = roomId;

  const { data, isLoading } = useQuery({
    queryKey: ["ot-schedule", dateStr, roomId],
    queryFn: () => api.getOtSchedule(params),
    enabled: !!dateStr,
  });

  const roomOptions = (rooms ?? []).map((r: OtRoom) => ({ value: r.id, label: r.name }));

  return (
    <Stack>
      <Group>
        <DatePickerInput
          label="Date"
          value={date}
          onChange={(v) => setDate(v as Date | null)}
          leftSection={<IconCalendar size={16} />}
          w={200}
        />
        <Select
          label="OT Room"
          placeholder="All rooms"
          data={roomOptions}
          value={roomId}
          onChange={setRoomId}
          clearable
          w={200}
        />
      </Group>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Time</Table.Th>
            <Table.Th>Procedure</Table.Th>
            <Table.Th>Patient ID</Table.Th>
            <Table.Th>Priority</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading && (
            <Table.Tr>
              <Table.Td colSpan={5}><Text c="dimmed">Loading...</Text></Table.Td>
            </Table.Tr>
          )}
          {(data ?? []).map((b: OtBooking) => (
            <Table.Tr key={b.id}>
              <Table.Td>
                <Text size="sm">{new Date(b.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>{b.procedure_name}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">{b.patient_id.slice(0, 8)}</Text>
              </Table.Td>
              <Table.Td>
                <Badge size="sm" variant="light" color={b.priority === "emergency" ? "danger" : b.priority === "urgent" ? "orange" : "slate"}>
                  {b.priority}
                </Badge>
              </Table.Td>
              <Table.Td>
                <StatusDot color={bookingStatusColors[b.status] ?? "slate"} label={b.status} />
              </Table.Td>
            </Table.Tr>
          ))}
          {!isLoading && (data ?? []).length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}><Text c="dimmed" size="sm">No bookings for this date</Text></Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

// ── Bookings Tab ───────────────────────────────────────

function BookingsTab({ canCreate }: { canCreate: boolean }) {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;

  const { data, isLoading } = useQuery({
    queryKey: ["ot-bookings", params],
    queryFn: () => api.listOtBookings(params),
  });

  const columns = [
    {
      key: "procedure_name",
      label: "Procedure",
      render: (r: OtBooking) => <Text size="sm" fw={500}>{r.procedure_name}</Text>,
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r: OtBooking) => <Text size="sm" c="dimmed">{r.patient_id.slice(0, 8)}</Text>,
    },
    {
      key: "scheduled_date",
      label: "Date",
      render: (r: OtBooking) => <Text size="sm">{r.scheduled_date}</Text>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (r: OtBooking) => (
        <Badge size="sm" variant="light" color={r.priority === "emergency" ? "danger" : r.priority === "urgent" ? "orange" : "slate"}>
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: OtBooking) => <StatusDot color={bookingStatusColors[r.status] ?? "slate"} label={r.status} />,
    },
    {
      key: "actions",
      label: "",
      render: (r: OtBooking) => (
        <Tooltip label="View">
          <ActionIcon variant="subtle" onClick={() => { setDetailId(r.id); openDetail(); }} aria-label="View details">
            <IconEye size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Select
          placeholder="Status"
          data={[
            { value: "requested", label: "Requested" },
            { value: "confirmed", label: "Confirmed" },
            { value: "in_progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
          clearable
          w={180}
        />
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New Booking
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={data?.bookings ?? []}
        loading={isLoading}
        page={page}
        totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
        onPageChange={setPage}
        rowKey={(r) => r.id}
      />

      <CreateBookingDrawer opened={createOpened} onClose={closeCreate} />

      <Drawer opened={detailOpened} onClose={closeDetail} title="Booking Detail" position="right" size="xl">
        {detailId && <BookingDetail bookingId={detailId} />}
      </Drawer>
    </Stack>
  );
}

function CreateBookingDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<CreateOtBookingRequest>>({});

  const mutation = useMutation({
    mutationFn: (data: CreateOtBookingRequest) => api.createOtBooking(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-bookings"] });
      notifications.show({ title: "Created", message: "OT booking created", color: "success" });
      onClose();
      setForm({});
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create booking", color: "danger" }),
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="New OT Booking" position="right" size="md">
      <Stack>
        <PatientSearchSelect value={form.patient_id ?? ""} onChange={(id) => setForm({ ...form, patient_id: id })} required />
        <TextInput label="OT Room ID" required onChange={(e) => setForm({ ...form, ot_room_id: e.currentTarget.value })} />
        <TextInput label="Primary Surgeon ID" required onChange={(e) => setForm({ ...form, primary_surgeon_id: e.currentTarget.value })} />
        <TextInput label="Procedure Name" required onChange={(e) => setForm({ ...form, procedure_name: e.currentTarget.value })} />
        <TextInput label="Scheduled Date" placeholder="YYYY-MM-DD" onChange={(e) => setForm({ ...form, scheduled_date: e.currentTarget.value })} />
        <TextInput label="Scheduled Start (ISO)" onChange={(e) => setForm({ ...form, scheduled_start: e.currentTarget.value })} />
        <TextInput label="Scheduled End (ISO)" onChange={(e) => setForm({ ...form, scheduled_end: e.currentTarget.value })} />
        <Select
          label="Priority"
          data={[
            { value: "elective", label: "Elective" },
            { value: "urgent", label: "Urgent" },
            { value: "emergency", label: "Emergency" },
          ]}
          value={form.priority ?? "elective"}
          onChange={(v) => setForm({ ...form, priority: (v ?? "elective") as OtCasePriority })}
        />
        <Textarea label="Notes" onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
        <Button onClick={() => mutation.mutate(form as CreateOtBookingRequest)} loading={mutation.isPending}>
          Create Booking
        </Button>
      </Stack>
    </Drawer>
  );
}

// ── Booking Detail (Tabbed Surgical Workflow) ──────────

function BookingDetail({ bookingId }: { bookingId: string }) {
  const { data } = useQuery({
    queryKey: ["ot-booking", bookingId],
    queryFn: () => api.getOtBooking(bookingId),
  });

  if (!data) return <Text c="dimmed">Loading...</Text>;

  const b = data as OtBooking;
  return (
    <Tabs defaultValue="overview">
      <Tabs.List>
        <Tabs.Tab value="overview">Overview</Tabs.Tab>
        <Tabs.Tab value="preop">Pre-Op</Tabs.Tab>
        <Tabs.Tab value="checklist">WHO Checklist</Tabs.Tab>
        <Tabs.Tab value="case-record">Case Record</Tabs.Tab>
        <Tabs.Tab value="anesthesia">Anesthesia</Tabs.Tab>
        <Tabs.Tab value="postop">Post-Op</Tabs.Tab>
        <Tabs.Tab value="consumables">Consumables</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="overview" pt="md">
        <OverviewTab booking={b} />
      </Tabs.Panel>
      <Tabs.Panel value="preop" pt="md">
        <PreopTab bookingId={bookingId} />
      </Tabs.Panel>
      <Tabs.Panel value="checklist" pt="md">
        <ChecklistTab bookingId={bookingId} />
      </Tabs.Panel>
      <Tabs.Panel value="case-record" pt="md">
        <CaseRecordTab bookingId={bookingId} />
      </Tabs.Panel>
      <Tabs.Panel value="anesthesia" pt="md">
        <AnesthesiaTab bookingId={bookingId} />
      </Tabs.Panel>
      <Tabs.Panel value="postop" pt="md">
        <PostopTab bookingId={bookingId} />
      </Tabs.Panel>
      <Tabs.Panel value="consumables" pt="md">
        <ConsumablesSubTab bookingId={bookingId} />
      </Tabs.Panel>
    </Tabs>
  );
}

// ── Overview Sub-Tab ──────────────────────────────────

function OverviewTab({ booking: b }: { booking: OtBooking }) {
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(P.OT.BOOKINGS_UPDATE);
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState<"cancel" | "postpone" | null>(null);

  const statusMutation = useMutation({
    mutationFn: (payload: { status: string; cancellation_reason?: string; postpone_reason?: string }) =>
      api.updateOtBookingStatus(b.id, payload as Parameters<typeof api.updateOtBookingStatus>[1]),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-booking", b.id] });
      void queryClient.invalidateQueries({ queryKey: ["ot-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["ot-schedule"] });
      notifications.show({ title: "Updated", message: "Booking status updated", color: "success" });
      setShowReason(null);
      setReason("");
    },
    onError: () => notifications.show({ title: "Error", message: "Status update failed", color: "danger" }),
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700} size="lg">{b.procedure_name}</Text>
        <Badge color={bookingStatusColors[b.status] ?? "slate"} variant="light" size="lg">
          {b.status.replace("_", " ")}
        </Badge>
      </Group>

      <Text size="sm">Date: {b.scheduled_date}</Text>
      <Text size="sm">
        Time: {new Date(b.scheduled_start).toLocaleTimeString()} - {new Date(b.scheduled_end).toLocaleTimeString()}
      </Text>
      <Text size="sm">Patient: {b.patient_id.slice(0, 8)}</Text>
      {b.laterality && <Text size="sm">Laterality: {b.laterality}</Text>}
      {b.estimated_duration_min && <Text size="sm">Estimated Duration: {b.estimated_duration_min} min</Text>}

      <Group gap="xs">
        <Checkbox label="Consent" checked={b.consent_obtained} readOnly size="xs" />
        <Checkbox label="Site Marked" checked={b.site_marked} readOnly size="xs" />
        <Checkbox label="Blood Arranged" checked={b.blood_arranged} readOnly size="xs" />
      </Group>
      {b.notes && <Text size="sm" c="dimmed">{b.notes}</Text>}

      {canUpdate && (
        <Stack gap="xs" mt="md">
          <Text size="sm" fw={600}>Status Transitions</Text>

          {b.status === "requested" && (
            <Group>
              <Button size="sm" color="primary" leftSection={<IconCheck size={14} />}
                loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ status: "confirmed" })}>
                Confirm
              </Button>
              <Button size="sm" color="danger" variant="light" leftSection={<IconX size={14} />}
                onClick={() => setShowReason("cancel")}>
                Cancel
              </Button>
            </Group>
          )}

          {b.status === "confirmed" && (
            <Group>
              <Button size="sm" color="success" leftSection={<IconPlayerPlay size={14} />}
                loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ status: "in_progress", actual_start: new Date().toISOString() } as Parameters<typeof statusMutation.mutate>[0])}>
                Start Surgery
              </Button>
              <Button size="sm" color="orange" variant="light" leftSection={<IconClock size={14} />}
                onClick={() => setShowReason("postpone")}>
                Postpone
              </Button>
              <Button size="sm" color="danger" variant="light" leftSection={<IconX size={14} />}
                onClick={() => setShowReason("cancel")}>
                Cancel
              </Button>
            </Group>
          )}

          {b.status === "in_progress" && (
            <Group>
              <Button size="sm" color="teal" leftSection={<IconCircleCheck size={14} />}
                loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ status: "completed", actual_end: new Date().toISOString() } as Parameters<typeof statusMutation.mutate>[0])}>
                Complete Surgery
              </Button>
              <Button size="sm" color="danger" variant="light" leftSection={<IconX size={14} />}
                onClick={() => setShowReason("cancel")}>
                Cancel
              </Button>
            </Group>
          )}

          {showReason && (
            <Stack gap="xs">
              <TextInput
                label={showReason === "cancel" ? "Cancellation Reason" : "Postpone Reason"}
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
              />
              <Group>
                <Button size="sm" color={showReason === "cancel" ? "danger" : "orange"}
                  loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({
                    status: showReason === "cancel" ? "cancelled" : "postponed",
                    ...(showReason === "cancel" ? { cancellation_reason: reason } : { postpone_reason: reason }),
                  })}>
                  Confirm {showReason === "cancel" ? "Cancellation" : "Postpone"}
                </Button>
                <Button size="sm" variant="subtle" onClick={() => { setShowReason(null); setReason(""); }}>
                  Back
                </Button>
              </Group>
            </Stack>
          )}

          {(b.status === "completed" || b.status === "cancelled" || b.status === "postponed") && (
            <Text size="sm" c="dimmed">No further transitions available.</Text>
          )}
          {b.cancellation_reason && <Text size="sm" c="danger">Cancellation reason: {b.cancellation_reason}</Text>}
          {b.postpone_reason && <Text size="sm" c="orange">Postpone reason: {b.postpone_reason}</Text>}
        </Stack>
      )}
    </Stack>
  );
}

// ── Pre-Op Sub-Tab ────────────────────────────────────

function PreopTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.PREOP_CREATE);
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ot-preop", bookingId],
    queryFn: () => api.listPreopAssessments(bookingId),
  });

  const assessment = (data as OtPreopAssessment[] | undefined)?.[0];

  const [form, setForm] = useState<Partial<CreatePreopAssessmentRequest>>({
    fasting_status: false,
    lab_results_reviewed: false,
    imaging_reviewed: false,
    blood_group_confirmed: false,
  });

  const createMutation = useMutation({
    mutationFn: (d: CreatePreopAssessmentRequest) => api.createPreopAssessment(bookingId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-preop", bookingId] });
      notifications.show({ title: "Saved", message: "Pre-op assessment recorded", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to save assessment", color: "danger" }),
  });

  const [updateForm, setUpdateForm] = useState<Partial<UpdatePreopAssessmentRequest>>({});
  const updateMutation = useMutation({
    mutationFn: (d: UpdatePreopAssessmentRequest) =>
      api.updatePreopAssessment(bookingId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-preop", bookingId] });
      notifications.show({ title: "Updated", message: "Assessment updated", color: "success" });
      setEditing(false);
    },
    onError: () => notifications.show({ title: "Error", message: "Update failed", color: "danger" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  if (assessment && !editing) {
    const a = assessment;
    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>Pre-Operative Assessment</Text>
          <Badge color={a.clearance_status === "cleared" ? "success" : a.clearance_status === "not_cleared" ? "danger" : "warning"}>
            {a.clearance_status.replace("_", " ")}
          </Badge>
        </Group>
        {a.asa_class && <Text size="sm">ASA Class: {a.asa_class.replace("_", " ").toUpperCase()}</Text>}
        <Group gap="md">
          <Checkbox label="Fasting" checked={a.fasting_status} readOnly size="xs" />
          <Checkbox label="Labs Reviewed" checked={a.lab_results_reviewed} readOnly size="xs" />
          <Checkbox label="Imaging Reviewed" checked={a.imaging_reviewed} readOnly size="xs" />
          <Checkbox label="Blood Group Confirmed" checked={a.blood_group_confirmed} readOnly size="xs" />
        </Group>
        {a.npo_since && <Text size="sm">NPO Since: {a.npo_since}</Text>}
        {a.allergies_noted && <Text size="sm">Allergies: {a.allergies_noted}</Text>}
        {a.current_medications && <Text size="sm">Medications: {a.current_medications}</Text>}
        {a.conditions && <Text size="sm">Conditions: {a.conditions}</Text>}
        <Text size="xs" c="dimmed">Assessed at: {new Date(a.assessed_at).toLocaleString()}</Text>
        {canCreate && (
          <Button size="sm" variant="light" onClick={() => {
            setUpdateForm({ clearance_status: a.clearance_status, asa_class: a.asa_class ?? undefined });
            setEditing(true);
          }}>Edit Assessment</Button>
        )}
      </Stack>
    );
  }

  if (assessment && editing) {
    return (
      <Stack>
        <Text fw={600}>Edit Assessment</Text>
        <Select label="Clearance Status"
          data={[
            { value: "pending", label: "Pending" },
            { value: "cleared", label: "Cleared" },
            { value: "not_cleared", label: "Not Cleared" },
            { value: "conditional", label: "Conditional" },
          ]}
          value={updateForm.clearance_status ?? assessment.clearance_status}
          onChange={(v) => setUpdateForm({ ...updateForm, clearance_status: (v ?? "pending") as PreopClearanceStatus })}
        />
        <Select label="ASA Class"
          data={asaOptions}
          value={updateForm.asa_class ?? assessment.asa_class ?? null}
          onChange={(v) => setUpdateForm({ ...updateForm, asa_class: (v ?? undefined) as AsaClassification | undefined })}
          clearable
        />
        <Group>
          <Button size="sm" onClick={() => updateMutation.mutate(updateForm as UpdatePreopAssessmentRequest)}
            loading={updateMutation.isPending}>Save</Button>
          <Button size="sm" variant="subtle" onClick={() => setEditing(false)}>Cancel</Button>
        </Group>
      </Stack>
    );
  }

  if (!canCreate) return <Text c="dimmed" size="sm">No pre-op assessment recorded.</Text>;

  return (
    <Stack>
      <Text fw={600}>Create Pre-Op Assessment</Text>
      <Select label="ASA Class" data={asaOptions} clearable
        onChange={(v) => setForm({ ...form, asa_class: (v ?? undefined) as AsaClassification | undefined })} />
      <Checkbox label="Fasting" checked={form.fasting_status ?? false}
        onChange={(e) => setForm({ ...form, fasting_status: e.currentTarget.checked })} />
      <TextInput label="NPO Since" placeholder="e.g. 22:00"
        onChange={(e) => setForm({ ...form, npo_since: e.currentTarget.value || undefined })} />
      <Checkbox label="Lab Results Reviewed" checked={form.lab_results_reviewed ?? false}
        onChange={(e) => setForm({ ...form, lab_results_reviewed: e.currentTarget.checked })} />
      <Checkbox label="Imaging Reviewed" checked={form.imaging_reviewed ?? false}
        onChange={(e) => setForm({ ...form, imaging_reviewed: e.currentTarget.checked })} />
      <Checkbox label="Blood Group Confirmed" checked={form.blood_group_confirmed ?? false}
        onChange={(e) => setForm({ ...form, blood_group_confirmed: e.currentTarget.checked })} />
      <TextInput label="Allergies" onChange={(e) => setForm({ ...form, allergies_noted: e.currentTarget.value || undefined })} />
      <TextInput label="Current Medications" onChange={(e) => setForm({ ...form, current_medications: e.currentTarget.value || undefined })} />
      <Textarea label="Conditions" onChange={(e) => setForm({ ...form, conditions: e.currentTarget.value || undefined })} />
      <Button onClick={() => createMutation.mutate(form as CreatePreopAssessmentRequest)}
        loading={createMutation.isPending}>Save Assessment</Button>
    </Stack>
  );
}

const asaOptions = [
  { value: "asa_1", label: "ASA I — Healthy" },
  { value: "asa_2", label: "ASA II — Mild systemic disease" },
  { value: "asa_3", label: "ASA III — Severe systemic disease" },
  { value: "asa_4", label: "ASA IV — Life-threatening disease" },
  { value: "asa_5", label: "ASA V — Moribund" },
  { value: "asa_6", label: "ASA VI — Brain-dead organ donor" },
];

// ── WHO Safety Checklist Sub-Tab ──────────────────────

const PHASES: ChecklistPhase[] = ["sign_in", "time_out", "sign_out"];
const phaseLabels: Record<ChecklistPhase, string> = {
  sign_in: "Sign In",
  time_out: "Time Out",
  sign_out: "Sign Out",
};

function ChecklistTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.SAFETY_CHECKLIST_CREATE);

  const { data, isLoading } = useQuery({
    queryKey: ["ot-checklists", bookingId],
    queryFn: () => api.listSafetyChecklists(bookingId),
  });

  const checklists = (data ?? []) as OtSurgicalSafetyChecklist[];
  const byPhase = new Map(checklists.map((c) => [c.phase, c]));

  const createMutation = useMutation({
    mutationFn: (d: CreateSafetyChecklistRequest) => api.createSafetyChecklist(bookingId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-checklists", bookingId] });
      notifications.show({ title: "Created", message: "Checklist phase started", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create checklist", color: "danger" }),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.updateSafetyChecklist(bookingId, id, { completed: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-checklists", bookingId] });
      notifications.show({ title: "Completed", message: "Phase completed", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to complete phase", color: "danger" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const isPhaseBlocked = (phase: ChecklistPhase): boolean => {
    const idx = PHASES.indexOf(phase);
    if (idx <= 0) return false;
    const prevPhase = PHASES[idx - 1] as ChecklistPhase;
    const prev = byPhase.get(prevPhase);
    return !prev?.completed;
  };

  return (
    <Stack>
      <Text fw={600}>WHO Surgical Safety Checklist</Text>
      {PHASES.map((phase) => {
        const checklist = byPhase.get(phase);
        const blocked = isPhaseBlocked(phase);
        const completed = checklist?.completed ?? false;

        return (
          <Card key={phase} withBorder padding="sm"
            style={{ borderColor: completed ? "var(--mantine-color-green-5)" : checklist ? "var(--mantine-color-yellow-5)" : undefined }}>
            <Group justify="space-between">
              <Group gap="sm">
                <ThemeIcon size="sm" variant="light"
                  color={completed ? "success" : checklist ? "warning" : "slate"}>
                  {completed ? <IconCircleCheck size={14} /> : <IconCircleDashed size={14} />}
                </ThemeIcon>
                <Text fw={500}>{phaseLabels[phase]}</Text>
              </Group>
              {completed && <Badge color="success" size="sm">Completed</Badge>}
              {checklist && !completed && <Badge color="warning" size="sm">In Progress</Badge>}
              {!checklist && <Badge color="slate" size="sm">Not Started</Badge>}
            </Group>

            {checklist?.completed_at && (
              <Text size="xs" c="dimmed" mt={4}>
                Completed at: {new Date(checklist.completed_at).toLocaleString()}
              </Text>
            )}

            {canCreate && !checklist && (
              <Button size="xs" mt="xs" variant="light"
                disabled={blocked}
                loading={createMutation.isPending}
                onClick={() => createMutation.mutate({ phase, items: {} })}>
                {blocked ? `Complete ${phaseLabels[PHASES[PHASES.indexOf(phase) - 1] as ChecklistPhase]} first` : `Start ${phaseLabels[phase]}`}
              </Button>
            )}

            {canCreate && checklist && !completed && (
              <Button size="xs" mt="xs" color="success"
                loading={completeMutation.isPending}
                onClick={() => completeMutation.mutate({ id: checklist.id })}>
                Mark Complete
              </Button>
            )}
          </Card>
        );
      })}
    </Stack>
  );
}

// ── Case Record Sub-Tab ───────────────────────────────

function CaseRecordTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.CASE_RECORDS_CREATE);

  const { data, isLoading } = useQuery({
    queryKey: ["ot-case-record", bookingId],
    queryFn: () => api.getCaseRecord(bookingId),
  });

  const [form, setForm] = useState<Partial<CreateCaseRecordRequest>>({
    procedure_performed: "",
    instrument_count_correct_before: false,
    instrument_count_correct_after: false,
    sponge_count_correct: false,
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateCaseRecordRequest) => api.createCaseRecord(bookingId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-case-record", bookingId] });
      notifications.show({ title: "Saved", message: "Case record created", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to save case record", color: "danger" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const record = data as OtCaseRecord | null;

  if (record) {
    return (
      <Stack>
        <Text fw={600}>Surgical Case Record</Text>
        <Text size="sm" fw={500}>Procedure: {record.procedure_performed}</Text>
        {record.incision_time && <Text size="sm">Incision: {new Date(record.incision_time).toLocaleTimeString()}</Text>}
        {record.closure_time && <Text size="sm">Closure: {new Date(record.closure_time).toLocaleTimeString()}</Text>}
        {record.patient_in_time && <Text size="sm">Patient In: {new Date(record.patient_in_time).toLocaleTimeString()}</Text>}
        {record.patient_out_time && <Text size="sm">Patient Out: {new Date(record.patient_out_time).toLocaleTimeString()}</Text>}
        {record.findings && <Text size="sm">Findings: {record.findings}</Text>}
        {record.technique && <Text size="sm">Technique: {record.technique}</Text>}
        {record.complications && <Text size="sm" c="danger">Complications: {record.complications}</Text>}
        {record.blood_loss_ml != null && <Text size="sm">Blood Loss: {record.blood_loss_ml} ml</Text>}

        <Text size="sm" fw={500} mt="xs">Counts</Text>
        <Group gap="md">
          <Checkbox label="Instruments (before)" checked={record.instrument_count_correct_before ?? false} readOnly size="xs"
            color={record.instrument_count_correct_before ? "success" : "danger"} />
          <Checkbox label="Instruments (after)" checked={record.instrument_count_correct_after ?? false} readOnly size="xs"
            color={record.instrument_count_correct_after ? "success" : "danger"} />
          <Checkbox label="Sponges" checked={record.sponge_count_correct ?? false} readOnly size="xs"
            color={record.sponge_count_correct ? "success" : "danger"} />
        </Group>
        {(record.instrument_count_correct_before === false || record.instrument_count_correct_after === false || record.sponge_count_correct === false) && (
          <Text size="xs" c="danger" fw={600}>WARNING: Count discrepancy detected — verify immediately!</Text>
        )}
        {record.notes && <Text size="sm" c="dimmed">{record.notes}</Text>}
      </Stack>
    );
  }

  if (!canCreate) return <Text c="dimmed" size="sm">No case record yet.</Text>;

  return (
    <Stack>
      <Text fw={600}>Create Case Record</Text>
      <TextInput label="Procedure Performed" required
        onChange={(e) => setForm({ ...form, procedure_performed: e.currentTarget.value })} />
      <Textarea label="Findings" onChange={(e) => setForm({ ...form, findings: e.currentTarget.value || undefined })} />
      <Textarea label="Technique" onChange={(e) => setForm({ ...form, technique: e.currentTarget.value || undefined })} />
      <Textarea label="Complications" onChange={(e) => setForm({ ...form, complications: e.currentTarget.value || undefined })} />
      <NumberInput label="Blood Loss (ml)" min={0}
        onChange={(v) => setForm({ ...form, blood_loss_ml: typeof v === "number" ? v : undefined })} />
      <TextInput label="Incision Time (ISO)" placeholder="Auto-filled or manual"
        onChange={(e) => setForm({ ...form, incision_time: e.currentTarget.value || undefined })} />
      <TextInput label="Closure Time (ISO)"
        onChange={(e) => setForm({ ...form, closure_time: e.currentTarget.value || undefined })} />
      <TextInput label="Patient In Time (ISO)"
        onChange={(e) => setForm({ ...form, patient_in_time: e.currentTarget.value || undefined })} />
      <TextInput label="Patient Out Time (ISO)"
        onChange={(e) => setForm({ ...form, patient_out_time: e.currentTarget.value || undefined })} />

      <Text size="sm" fw={500} mt="xs">Instrument & Sponge Counts</Text>
      <Checkbox label="Instruments correct (before)" checked={form.instrument_count_correct_before ?? false}
        onChange={(e) => setForm({ ...form, instrument_count_correct_before: e.currentTarget.checked })} />
      <Checkbox label="Instruments correct (after)" checked={form.instrument_count_correct_after ?? false}
        onChange={(e) => setForm({ ...form, instrument_count_correct_after: e.currentTarget.checked })} />
      <Checkbox label="Sponges correct" checked={form.sponge_count_correct ?? false}
        onChange={(e) => setForm({ ...form, sponge_count_correct: e.currentTarget.checked })} />
      {(!form.instrument_count_correct_before || !form.instrument_count_correct_after || !form.sponge_count_correct) && (
        <Text size="xs" c="danger" fw={600}>WARNING: Unchecked counts require verification before closure.</Text>
      )}

      <Textarea label="Specimens" placeholder="List specimens collected"
        onChange={(e) => setForm({ ...form, specimens: e.currentTarget.value ? [e.currentTarget.value] : undefined })} />
      <Textarea label="Implants" placeholder="List implants used"
        onChange={(e) => setForm({ ...form, implants: e.currentTarget.value ? [e.currentTarget.value] : undefined })} />
      <Textarea label="Drains" placeholder="List drains placed"
        onChange={(e) => setForm({ ...form, drains: e.currentTarget.value ? [e.currentTarget.value] : undefined })} />
      <Textarea label="Notes" onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />

      <Button onClick={() => createMutation.mutate(form as CreateCaseRecordRequest)}
        loading={createMutation.isPending}>Save Case Record</Button>
    </Stack>
  );
}

// ── Anesthesia Sub-Tab ────────────────────────────────

const anesthesiaTypeOptions = [
  { value: "general", label: "General" },
  { value: "spinal", label: "Spinal" },
  { value: "epidural", label: "Epidural" },
  { value: "regional_block", label: "Regional Block" },
  { value: "local", label: "Local" },
  { value: "sedation", label: "Sedation" },
  { value: "combined", label: "Combined" },
];

function AnesthesiaTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.ANESTHESIA_CREATE);

  const { data, isLoading } = useQuery({
    queryKey: ["ot-anesthesia", bookingId],
    queryFn: () => api.getAnesthesiaRecord(bookingId),
  });

  const [form, setForm] = useState<Partial<CreateAnesthesiaRecordRequest>>({
    anesthesia_type: "general",
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateAnesthesiaRecordRequest) => api.createAnesthesiaRecord(bookingId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-anesthesia", bookingId] });
      notifications.show({ title: "Saved", message: "Anesthesia record created", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to save anesthesia record", color: "danger" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const record = data as OtAnesthesiaRecord | null;

  if (record) {
    return (
      <Stack>
        <Text fw={600}>Anesthesia Record</Text>
        <Text size="sm">Type: {record.anesthesia_type.replace("_", " ")}</Text>
        {record.asa_class && <Text size="sm">ASA Class: {record.asa_class.replace("_", " ").toUpperCase()}</Text>}
        {record.induction_time && <Text size="sm">Induction: {new Date(record.induction_time).toLocaleTimeString()}</Text>}
        {record.intubation_time && <Text size="sm">Intubation: {new Date(record.intubation_time).toLocaleTimeString()}</Text>}
        {record.extubation_time && <Text size="sm">Extubation: {new Date(record.extubation_time).toLocaleTimeString()}</Text>}
        {record.complications && <Text size="sm" c="danger">Complications: {record.complications}</Text>}
        {record.notes && <Text size="sm" c="dimmed">{record.notes}</Text>}
      </Stack>
    );
  }

  if (!canCreate) return <Text c="dimmed" size="sm">No anesthesia record yet.</Text>;

  return (
    <Stack>
      <Text fw={600}>Create Anesthesia Record</Text>
      <Select label="Anesthesia Type" data={anesthesiaTypeOptions} required
        value={form.anesthesia_type ?? "general"}
        onChange={(v) => setForm({ ...form, anesthesia_type: (v ?? "general") as AnesthesiaType })} />
      <Select label="ASA Class" data={asaOptions} clearable
        onChange={(v) => setForm({ ...form, asa_class: (v ?? undefined) as AsaClassification | undefined })} />
      <TextInput label="Induction Time (ISO)"
        onChange={(e) => setForm({ ...form, induction_time: e.currentTarget.value || undefined })} />
      <TextInput label="Intubation Time (ISO)"
        onChange={(e) => setForm({ ...form, intubation_time: e.currentTarget.value || undefined })} />
      <Textarea label="Airway Details" placeholder="Airway assessment details"
        onChange={(e) => setForm({ ...form, airway_details: e.currentTarget.value ? { notes: e.currentTarget.value } : undefined })} />
      <Textarea label="Drugs Administered" placeholder="List drugs, doses, routes"
        onChange={(e) => setForm({ ...form, drugs_administered: e.currentTarget.value ? [e.currentTarget.value] : undefined })} />
      <Textarea label="Notes" onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
      <Button onClick={() => createMutation.mutate(form as CreateAnesthesiaRecordRequest)}
        loading={createMutation.isPending}>Save Anesthesia Record</Button>
    </Stack>
  );
}

// ── Post-Op / PACU Sub-Tab ────────────────────────────

const recoveryStatusOptions = [
  { value: "in_recovery", label: "In Recovery" },
  { value: "stable", label: "Stable" },
  { value: "shifted_to_ward", label: "Shifted to Ward" },
  { value: "shifted_to_icu", label: "Shifted to ICU" },
  { value: "discharged", label: "Discharged" },
];

function PostopTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.POSTOP_CREATE);

  const { data, isLoading } = useQuery({
    queryKey: ["ot-postop", bookingId],
    queryFn: () => api.getPostopRecord(bookingId),
  });

  const [form, setForm] = useState<Partial<CreatePostopRecordRequest>>({});

  const createMutation = useMutation({
    mutationFn: (d: CreatePostopRecordRequest) => api.createPostopRecord(bookingId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-postop", bookingId] });
      notifications.show({ title: "Saved", message: "Post-op record created", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to save post-op record", color: "danger" }),
  });

  const [editing, setEditing] = useState(false);
  const [updateForm, setUpdateForm] = useState<Partial<UpdatePostopRecordRequest>>({});

  const updateMutation = useMutation({
    mutationFn: (d: UpdatePostopRecordRequest) =>
      api.updatePostopRecord(bookingId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-postop", bookingId] });
      notifications.show({ title: "Updated", message: "Post-op record updated", color: "success" });
      setEditing(false);
    },
    onError: () => notifications.show({ title: "Error", message: "Update failed", color: "danger" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const record = data as OtPostopRecord | null;

  if (record && !editing) {
    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>Post-Op / PACU Recovery</Text>
          <Badge color={record.recovery_status === "discharged" || record.recovery_status === "shifted_to_ward" ? "success" :
            record.recovery_status === "shifted_to_icu" ? "orange" : "primary"}>
            {record.recovery_status.replace(/_/g, " ")}
          </Badge>
        </Group>
        {record.arrival_time && <Text size="sm">Arrival: {new Date(record.arrival_time).toLocaleTimeString()}</Text>}
        {record.discharge_time && <Text size="sm">Discharge: {new Date(record.discharge_time).toLocaleTimeString()}</Text>}
        {record.aldrete_score_arrival != null && <Text size="sm">Aldrete (arrival): {record.aldrete_score_arrival}/10</Text>}
        {record.aldrete_score_discharge != null && <Text size="sm">Aldrete (discharge): {record.aldrete_score_discharge}/10</Text>}
        {record.pain_assessment && <Text size="sm">Pain: {record.pain_assessment}</Text>}
        {record.fluid_orders && <Text size="sm">Fluid Orders: {record.fluid_orders}</Text>}
        {record.diet_orders && <Text size="sm">Diet: {record.diet_orders}</Text>}
        {record.activity_orders && <Text size="sm">Activity: {record.activity_orders}</Text>}
        {record.disposition && <Text size="sm">Disposition: {record.disposition}</Text>}
        {record.notes && <Text size="sm" c="dimmed">{record.notes}</Text>}
        {canCreate && (
          <Button size="sm" variant="light" onClick={() => {
            setUpdateForm({ recovery_status: record.recovery_status });
            setEditing(true);
          }}>Update Recovery</Button>
        )}
      </Stack>
    );
  }

  if (record && editing) {
    return (
      <Stack>
        <Text fw={600}>Update Post-Op Recovery</Text>
        <Select label="Recovery Status" data={recoveryStatusOptions}
          value={updateForm.recovery_status ?? record.recovery_status}
          onChange={(v) => setUpdateForm({ ...updateForm, recovery_status: (v ?? "in_recovery") as PostopRecoveryStatus })} />
        <NumberInput label="Aldrete Score (discharge)" min={0} max={10}
          value={updateForm.aldrete_score_discharge ?? record.aldrete_score_discharge ?? undefined}
          onChange={(v) => setUpdateForm({ ...updateForm, aldrete_score_discharge: typeof v === "number" ? v : undefined })} />
        <TextInput label="Discharge Time (ISO)" placeholder="Auto or manual"
          onChange={(e) => setUpdateForm({ ...updateForm, discharge_time: e.currentTarget.value || undefined })} />
        <TextInput label="Disposition"
          onChange={(e) => setUpdateForm({ ...updateForm, disposition: e.currentTarget.value || undefined })} />
        <Textarea label="Notes"
          onChange={(e) => setUpdateForm({ ...updateForm, notes: e.currentTarget.value || undefined })} />
        <Group>
          <Button size="sm" onClick={() => updateMutation.mutate(updateForm as UpdatePostopRecordRequest)}
            loading={updateMutation.isPending}>Save</Button>
          <Button size="sm" variant="subtle" onClick={() => setEditing(false)}>Cancel</Button>
        </Group>
      </Stack>
    );
  }

  if (!canCreate) return <Text c="dimmed" size="sm">No post-op record yet.</Text>;

  return (
    <Stack>
      <Text fw={600}>Create Post-Op Record</Text>
      <TextInput label="Arrival Time (ISO)" placeholder="PACU arrival"
        onChange={(e) => setForm({ ...form, arrival_time: e.currentTarget.value || undefined })} />
      <NumberInput label="Aldrete Score (arrival)" min={0} max={10}
        onChange={(v) => setForm({ ...form, aldrete_score_arrival: typeof v === "number" ? v : undefined })} />
      <TextInput label="Pain Assessment" placeholder="e.g. NRS 4/10"
        onChange={(e) => setForm({ ...form, pain_assessment: e.currentTarget.value || undefined })} />
      <TextInput label="Fluid Orders"
        onChange={(e) => setForm({ ...form, fluid_orders: e.currentTarget.value || undefined })} />
      <TextInput label="Diet Orders"
        onChange={(e) => setForm({ ...form, diet_orders: e.currentTarget.value || undefined })} />
      <TextInput label="Activity Orders"
        onChange={(e) => setForm({ ...form, activity_orders: e.currentTarget.value || undefined })} />
      <Textarea label="Notes"
        onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
      <Button onClick={() => createMutation.mutate(form as CreatePostopRecordRequest)}
        loading={createMutation.isPending}>Save Post-Op Record</Button>
    </Stack>
  );
}

// ── Rooms Tab ──────────────────────────────────────────

function RoomsTab({ canManage }: { canManage: boolean }) {
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ot-rooms"],
    queryFn: () => api.listOtRooms(),
  });

  const roomStatusColors: Record<string, string> = {
    available: "success",
    in_use: "primary",
    cleaning: "warning",
    maintenance: "orange",
    reserved: "violet",
  };

  const columns = [
    {
      key: "name",
      label: "Room",
      render: (r: OtRoom) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>{r.name}</Text>
          <Text size="xs" c="dimmed">{r.code}</Text>
        </Stack>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: OtRoom) => <StatusDot color={roomStatusColors[r.status] ?? "slate"} label={r.status} />,
    },
    {
      key: "is_active",
      label: "Active",
      render: (r: OtRoom) => <Badge variant="light" color={r.is_active ? "success" : "slate"}>{r.is_active ? "Yes" : "No"}</Badge>,
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Add Room</Button>
        </Group>
      )}
      <DataTable
        columns={columns}
        data={(data as OtRoom[]) ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
      />
      <CreateRoomDrawer opened={createOpened} onClose={closeCreate} />
    </Stack>
  );
}

function CreateRoomDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const mutation = useMutation({
    mutationFn: (data: CreateOtRoomRequest) => api.createOtRoom(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-rooms"] });
      notifications.show({ title: "Created", message: "OT room created", color: "success" });
      onClose();
      setName("");
      setCode("");
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="New OT Room" position="right" size="sm">
      <Stack>
        <TextInput label="Room Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Code" required value={code} onChange={(e) => setCode(e.currentTarget.value)} />
        <Button onClick={() => mutation.mutate({ name, code })} loading={mutation.isPending}>Create</Button>
      </Stack>
    </Drawer>
  );
}

// ── Preferences Tab ────────────────────────────────────

function PreferencesTab({ canManage }: { canManage: boolean }) {
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ot-surgeon-preferences"],
    queryFn: () => api.listSurgeonPreferences(),
  });

  const columns = [
    {
      key: "procedure_name",
      label: "Procedure",
      render: (r: OtSurgeonPreference) => <Text size="sm" fw={500}>{r.procedure_name}</Text>,
    },
    {
      key: "position",
      label: "Position",
      render: (r: OtSurgeonPreference) => <Text size="sm">{r.position ?? "\u2014"}</Text>,
    },
    {
      key: "skin_prep",
      label: "Skin Prep",
      render: (r: OtSurgeonPreference) => <Text size="sm">{r.skin_prep ?? "\u2014"}</Text>,
    },
    {
      key: "special_instructions",
      label: "Notes",
      render: (r: OtSurgeonPreference) => <Text size="sm" lineClamp={1}>{r.special_instructions ?? "\u2014"}</Text>,
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Add Preference Card</Button>
        </Group>
      )}
      <DataTable
        columns={columns}
        data={(data as OtSurgeonPreference[]) ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
      />
      <CreatePreferenceDrawer opened={createOpened} onClose={closeCreate} />
    </Stack>
  );
}

function CreatePreferenceDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<CreateSurgeonPreferenceRequest>>({});

  const mutation = useMutation({
    mutationFn: (data: CreateSurgeonPreferenceRequest) => api.createSurgeonPreference(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-surgeon-preferences"] });
      notifications.show({ title: "Created", message: "Preference card saved", color: "success" });
      onClose();
      setForm({});
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="Surgeon Preference Card" position="right" size="md">
      <Stack>
        <TextInput label="Surgeon ID" required onChange={(e) => setForm({ ...form, surgeon_id: e.currentTarget.value })} />
        <TextInput label="Procedure Name" required onChange={(e) => setForm({ ...form, procedure_name: e.currentTarget.value })} />
        <TextInput label="Position" onChange={(e) => setForm({ ...form, position: e.currentTarget.value || undefined })} />
        <TextInput label="Skin Prep" onChange={(e) => setForm({ ...form, skin_prep: e.currentTarget.value || undefined })} />
        <TextInput label="Draping" onChange={(e) => setForm({ ...form, draping: e.currentTarget.value || undefined })} />
        <Textarea label="Special Instructions" onChange={(e) => setForm({ ...form, special_instructions: e.currentTarget.value || undefined })} />
        <Button onClick={() => mutation.mutate(form as CreateSurgeonPreferenceRequest)} loading={mutation.isPending}>
          Save
        </Button>
      </Stack>
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  OT Phase 2b — Consumables Sub-Tab
// ══════════════════════════════════════════════════════════

const CONSUMABLE_CATEGORIES: { value: OtConsumableCategory; label: string }[] = [
  { value: "surgical_instrument", label: "Surgical Instrument" },
  { value: "implant", label: "Implant" },
  { value: "disposable", label: "Disposable" },
  { value: "suture", label: "Suture" },
  { value: "drug", label: "Drug" },
  { value: "blood_product", label: "Blood Product" },
  { value: "other", label: "Other" },
];

function ConsumablesSubTab({ bookingId }: { bookingId: string }) {
  const canManage = useHasPermission(P.OT.CONSUMABLES_MANAGE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState<number | string>("");
  const [batchNumber, setBatchNumber] = useState("");

  const { data: consumables, isLoading } = useQuery({
    queryKey: ["ot-consumables", bookingId],
    queryFn: () => api.listOtConsumables(bookingId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateOtConsumableRequest) => api.createOtConsumable(bookingId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-consumables", bookingId] });
      notifications.show({ title: "Added", message: "Consumable recorded", color: "success" });
      setShowForm(false);
      setItemName("");
      setCategory(null);
      setQuantity(1);
      setUnit("");
      setUnitPrice("");
      setBatchNumber("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.deleteOtConsumable(bookingId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-consumables", bookingId] });
      notifications.show({ title: "Removed", message: "Consumable removed", color: "success" });
    },
  });

  const rows = (consumables ?? []) as OtConsumableUsage[];
  const totalCost = rows.reduce((sum, r) => sum + (r.unit_price ?? 0) * r.quantity, 0);

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={500}>Consumables Used</Text>
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} size="sm" onClick={() => setShowForm(true)}>
            Add Consumable
          </Button>
        )}
      </Group>

      {totalCost > 0 && (
        <Badge size="lg" variant="light" color="primary">Total Cost: {totalCost.toFixed(2)}</Badge>
      )}

      {showForm && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <TextInput label="Item Name" required value={itemName} onChange={(e) => setItemName(e.currentTarget.value)} />
            <Select label="Category" data={CONSUMABLE_CATEGORIES} value={category} onChange={setCategory} required />
            <Group grow>
              <NumberInput label="Quantity" value={quantity} onChange={setQuantity} min={0.01} decimalScale={2} required />
              <TextInput label="Unit" placeholder="pcs, ml, etc." value={unit} onChange={(e) => setUnit(e.currentTarget.value)} />
            </Group>
            <Group grow>
              <NumberInput label="Unit Price" value={unitPrice} onChange={setUnitPrice} min={0} decimalScale={2} />
              <TextInput label="Batch Number" value={batchNumber} onChange={(e) => setBatchNumber(e.currentTarget.value)} />
            </Group>
            <Group>
              <Button
                size="sm"
                onClick={() => createMutation.mutate({
                  item_name: itemName,
                  category: category as OtConsumableCategory,
                  quantity: Number(quantity),
                  unit: unit || undefined,
                  unit_price: unitPrice ? Number(unitPrice) : undefined,
                  batch_number: batchNumber || undefined,
                })}
                loading={createMutation.isPending}
                disabled={!itemName || !category}
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
        <Text c="dimmed" size="sm">No consumables recorded for this surgery.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Qty</Table.Th>
              <Table.Th>Unit Price</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Batch</Table.Th>
              {canManage && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td><Text size="sm">{c.item_name}</Text></Table.Td>
                <Table.Td><Badge size="sm" variant="light">{c.category.replace(/_/g, " ")}</Badge></Table.Td>
                <Table.Td><Text size="sm">{c.quantity} {c.unit ?? ""}</Text></Table.Td>
                <Table.Td><Text size="sm">{c.unit_price?.toFixed(2) ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="sm" fw={500}>{((c.unit_price ?? 0) * c.quantity).toFixed(2)}</Text></Table.Td>
                <Table.Td><Text size="sm">{c.batch_number ?? "—"}</Text></Table.Td>
                {canManage && (
                  <Table.Td>
                    <ActionIcon size="sm" variant="light" color="danger" onClick={() => deleteMutation.mutate(c.id)} aria-label="Delete">
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  OT Phase 2b — Reports Tab (Utilization)
// ══════════════════════════════════════════════════════════

function OtReportsTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ot-utilization", from, to],
    queryFn: () => api.otUtilization({ from: from || undefined, to: to || undefined }),
  });

  const rows = (data ?? []) as RoomUtilization[];

  return (
    <Stack>
      <Text fw={500} size="lg">OT Utilization Report</Text>
      <Group>
        <TextInput label="From" type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} w={180} />
        <TextInput label="To" type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} w={180} />
      </Group>

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">No data for the selected period.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Room</Table.Th>
              <Table.Th>Total Bookings</Table.Th>
              <Table.Th>Total Surgery (min)</Table.Th>
              <Table.Th>Avg Turnaround (min)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.room_id}>
                <Table.Td><Text size="sm" fw={500}>{r.room_name}</Text></Table.Td>
                <Table.Td><Text size="sm">{r.total_bookings}</Text></Table.Td>
                <Table.Td><Text size="sm">{r.total_surgery_minutes ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="sm">{r.avg_turnaround_minutes != null ? r.avg_turnaround_minutes.toFixed(1) : "—"}</Text></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
