import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Alert,
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
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  OtAnesthesiaRecordFormInput,
  OtBookingFormInput,
  OtCaseRecordFormInput,
  OtPostopRecordFormInput,
  OtPostopRecordUpdateFormInput,
  OtPreopAssessmentFormInput,
  OtPreopAssessmentUpdateFormInput,
  OtRoomFormInput,
  OtStatusReasonActionFormValue,
  OtStatusReasonFormInput,
  OtSurgeonPreferenceFormInput,
  OtUtilizationFilterFormInput,
} from "@medbrains/schemas";
import {
  otAnesthesiaRecordFormSchema,
  otBookingFormSchema,
  otCaseRecordFormSchema,
  otConsumableFormSchema,
  otPostopRecordFormSchema,
  otPostopRecordUpdateFormSchema,
  otPreopAssessmentFormSchema,
  otPreopAssessmentUpdateFormSchema,
  otRoomFormSchema,
  otStatusReasonFormSchema,
  otSurgeonPreferenceFormSchema,
  otUtilizationFilterFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  ChecklistPhase,
  CreateSafetyChecklistRequest,
  OtAnesthesiaRecord,
  OtBooking,
  OtCaseRecord,
  OtConsumableUsage,
  OtPostopRecord,
  OtPreopAssessment,
  OtRoom,
  OtSurgeonPreference,
  OtSurgicalSafetyChecklist,
  RoomUtilization,
} from "@medbrains/types";
import { P } from "@medbrains/types";
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
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useSearchParams } from "react-router";
import { DataTable, PageHeader, StatusDot } from "../components";
import { DoctorSearchSelect } from "../components/DoctorSearchSelect";
import { PatientContextBanner } from "../components/Patient/PatientContextBanner";
import { PatientNameCell } from "../components/PatientNameCell";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import {
  DEFAULT_OT_ANESTHESIA_RECORD_FORM_VALUES,
  DEFAULT_OT_BOOKING_FORM_VALUES,
  DEFAULT_OT_CASE_RECORD_FORM_VALUES,
  DEFAULT_OT_CONSUMABLE_FORM_VALUES,
  DEFAULT_OT_POSTOP_RECORD_FORM_VALUES,
  DEFAULT_OT_POSTOP_UPDATE_FORM_VALUES,
  DEFAULT_OT_PREOP_ASSESSMENT_FORM_VALUES,
  DEFAULT_OT_PREOP_UPDATE_FORM_VALUES,
  DEFAULT_OT_ROOM_FORM_VALUES,
  DEFAULT_OT_STATUS_REASON_FORM_VALUES,
  DEFAULT_OT_SURGEON_PREFERENCE_FORM_VALUES,
  DEFAULT_OT_UTILIZATION_FILTER_FORM_VALUES,
  normalizeOtAnesthesiaType,
  normalizeOtAsaClassification,
  normalizeOtCasePriority,
  normalizeOtPostopRecoveryStatus,
  normalizeOtPreopClearanceStatus,
  OT_ANESTHESIA_TYPE_OPTIONS,
  OT_ASA_OPTIONS,
  OT_CASE_PRIORITY_OPTIONS,
  OT_CONSUMABLE_CATEGORY_OPTIONS,
  OT_POSTOP_RECOVERY_STATUS_OPTIONS,
  OT_PREOP_CLEARANCE_STATUS_OPTIONS,
  toCreateAnesthesiaRecordRequest,
  toCreateCaseRecordRequest,
  toCreateOtBookingRequest,
  toCreateOtConsumableRequest,
  toCreateOtRoomRequest,
  toCreatePostopRecordRequest,
  toCreatePreopAssessmentRequest,
  toCreateSurgeonPreferenceRequest,
  toOtUtilizationParams,
  toUpdateOtBookingStatusRequest,
  toUpdatePostopRecordRequest,
  toUpdatePreopAssessmentRequest,
} from "../forms/ot.form";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { otService } from "../services/ot.service";

const bookingStatusColors: Record<string, string> = {
  requested: "warning",
  confirmed: "primary",
  in_progress: "success",
  completed: "teal",
  cancelled: "danger",
  postponed: "orange",
};

function OtRestrictedValue() {
  return (
    <Text span size="sm" c="dimmed">
      Restricted
    </Text>
  );
}

function OtPatientCell({
  patientId,
  canViewPatientRecord,
}: {
  patientId: string;
  canViewPatientRecord: boolean;
}) {
  if (!canViewPatientRecord) return <OtRestrictedValue />;
  return <PatientNameCell patientId={patientId} showUhid={false} />;
}

export function OtPage() {
  useRequirePermission([
    P.OT.BOOKINGS_LIST,
    P.OT.BOOKINGS_CREATE,
    P.OT.ROOMS_LIST,
    P.OT.ROOMS_MANAGE,
    P.OT.PREFERENCES_LIST,
    P.OT.PREFERENCES_MANAGE,
    P.OT.REPORTS_VIEW,
  ]);

  const [searchParams, setSearchParams] = useSearchParams();
  const canListBookings = useHasPermission(P.OT.BOOKINGS_LIST);
  const canCreateBooking = useHasPermission(P.OT.BOOKINGS_CREATE);
  const canViewRooms = useHasPermission(P.OT.ROOMS_LIST);
  const canManageRooms = useHasPermission(P.OT.ROOMS_MANAGE);
  const canViewPrefs = useHasPermission(P.OT.PREFERENCES_LIST);
  const canManagePrefs = useHasPermission(P.OT.PREFERENCES_MANAGE);
  const canViewReports = useHasPermission(P.OT.REPORTS_VIEW);
  const visibleTabs = useMemo(
    () =>
      [
        { value: "schedule", label: "Schedule", visible: canListBookings },
        { value: "bookings", label: "Bookings", visible: canListBookings || canCreateBooking },
        { value: "rooms", label: "Rooms", visible: canViewRooms || canManageRooms },
        {
          value: "preferences",
          label: "Surgeon Preferences",
          visible: canViewPrefs || canManagePrefs,
        },
        { value: "reports", label: "Reports", visible: canViewReports },
      ].filter((tab) => tab.visible),
    [
      canListBookings,
      canCreateBooking,
      canViewRooms,
      canManageRooms,
      canViewPrefs,
      canManagePrefs,
      canViewReports,
    ],
  );
  const defaultTab = visibleTabs[0]?.value ?? "bookings";
  const requestedTab = searchParams.get("tab");
  const selectedTab = visibleTabs.some((tab) => tab.value === requestedTab)
    ? (requestedTab ?? defaultTab)
    : defaultTab;
  const setSelectedTab = (value: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value ?? defaultTab);
    params.delete("action");
    setSearchParams(params, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Operation Theatre"
        subtitle="OT booking & surgical management"
        icon={<IconScissors size={20} stroke={1.5} />}
        color="violet"
      />

      <Tabs value={selectedTab} onChange={setSelectedTab}>
        <Tabs.List>
          {visibleTabs.map((tab) => (
            <Tabs.Tab
              key={tab.value}
              value={tab.value}
              leftSection={tab.value === "reports" ? <IconChartBar size={16} /> : undefined}
            >
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {canListBookings && (
          <Tabs.Panel value="schedule" pt="md">
            <ScheduleTab />
          </Tabs.Panel>
        )}
        {(canListBookings || canCreateBooking) && (
          <Tabs.Panel value="bookings" pt="md">
            <BookingsTab canCreate={canCreateBooking} canList={canListBookings} />
          </Tabs.Panel>
        )}
        {(canViewRooms || canManageRooms) && (
          <Tabs.Panel value="rooms" pt="md">
            <RoomsTab canManage={canManageRooms} />
          </Tabs.Panel>
        )}
        {(canViewPrefs || canManagePrefs) && (
          <Tabs.Panel value="preferences" pt="md">
            <PreferencesTab canManage={canManagePrefs} />
          </Tabs.Panel>
        )}
        {canViewReports && (
          <Tabs.Panel value="reports" pt="md">
            <OtReportsTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ── Schedule Tab ───────────────────────────────────────

function ScheduleTab() {
  const [date, setDate] = useState<string | null>(new Date().toISOString().slice(0, 10));
  const [roomId, setRoomId] = useState<string | null>(null);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);

  const { data: rooms } = useQuery({
    queryKey: ["ot-rooms"],
    queryFn: () => otService.listOtRooms(),
  });

  const dateStr = date ?? undefined;
  const params: Record<string, string> = {};
  if (dateStr) params.date = dateStr;
  if (roomId) params.room_id = roomId;

  const { data, isLoading } = useQuery({
    queryKey: ["ot-schedule", dateStr, roomId],
    queryFn: () => otService.getOtSchedule(params),
    enabled: !!dateStr,
  });

  const roomOptions = (rooms ?? []).map((r: OtRoom) => ({ value: r.id, label: r.name }));

  return (
    <Stack>
      <Group>
        <DatePickerInput
          label="Date"
          value={date}
          onChange={setDate}
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
            <Table.Th>Patient</Table.Th>
            <Table.Th>Priority</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text c="dimmed">Loading...</Text>
              </Table.Td>
            </Table.Tr>
          )}
          {(data ?? []).map((b: OtBooking) => (
            <Table.Tr key={b.id}>
              <Table.Td>
                <Text size="sm">
                  {new Date(b.scheduled_start).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {b.procedure_name}
                </Text>
              </Table.Td>
              <Table.Td>
                <OtPatientCell
                  patientId={b.patient_id}
                  canViewPatientRecord={canViewPatientRecord}
                />
              </Table.Td>
              <Table.Td>
                <Badge
                  size="sm"
                  variant="light"
                  color={
                    b.priority === "emergency"
                      ? "danger"
                      : b.priority === "urgent"
                        ? "orange"
                        : "slate"
                  }
                >
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
              <Table.Td colSpan={5}>
                <Text c="dimmed" size="sm">
                  No bookings for this date
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

// ── Bookings Tab ───────────────────────────────────────

function BookingsTab({ canCreate, canList }: { canCreate: boolean; canList: boolean }) {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);
  const admissionId = searchParams.get("admission_id") ?? "";
  const patientId = searchParams.get("patient_id") ?? "";
  const isIpdLinked = searchParams.get("from") === "ipd" && admissionId.length > 0;
  const defaultBookingValues = useMemo<OtBookingFormInput>(
    () => ({
      ...DEFAULT_OT_BOOKING_FORM_VALUES,
      patient_id: patientId,
      admission_id: admissionId,
    }),
    [admissionId, patientId],
  );
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(
    canCreate && searchParams.get("action") === "new",
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;
  if (admissionId) params.admission_id = admissionId;

  const { data, isLoading } = useQuery({
    queryKey: ["ot-bookings", params],
    queryFn: () => otService.listOtBookings(params),
    enabled: canList,
  });

  const closeCreateAndClearAction = () => {
    closeCreate();
    if (searchParams.get("action")) {
      const params = new URLSearchParams(searchParams);
      params.delete("action");
      setSearchParams(params, { replace: true });
    }
  };

  const columns = [
    {
      key: "procedure_name",
      label: "Procedure",
      render: (r: OtBooking) => (
        <Text size="sm" fw={500}>
          {r.procedure_name}
        </Text>
      ),
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r: OtBooking) => (
        <OtPatientCell patientId={r.patient_id} canViewPatientRecord={canViewPatientRecord} />
      ),
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
        <Badge
          size="sm"
          variant="light"
          color={
            r.priority === "emergency" ? "danger" : r.priority === "urgent" ? "orange" : "slate"
          }
        >
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: OtBooking) => (
        <StatusDot color={bookingStatusColors[r.status] ?? "slate"} label={r.status} />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r: OtBooking) => (
        <Tooltip label="View">
          <ActionIcon
            variant="subtle"
            onClick={() => {
              setDetailId(r.id);
              openDetail();
            }}
            aria-label="View details"
          >
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

      {isIpdLinked && (
        <Alert color="violet" variant="light">
          Showing OT work for the linked IPD admission. New bookings from here keep the admission
          and patient context attached for ward billing and clinical notes.
        </Alert>
      )}

      {canList ? (
        <DataTable
          columns={columns}
          data={data?.bookings ?? []}
          loading={isLoading}
          page={page}
          totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
          onPageChange={setPage}
          rowKey={(r) => r.id}
        />
      ) : (
        <Alert color="warning" variant="light">
          This role can create OT bookings, but the OT booking list stays hidden until
          `ot.bookings.list` is granted.
        </Alert>
      )}

      <CreateBookingDrawer
        opened={createOpened}
        onClose={closeCreateAndClearAction}
        defaultValues={defaultBookingValues}
        canViewPatientRecord={canViewPatientRecord}
      />

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Booking Detail"
        position="right"
        size="xl"
      >
        {detailId && <BookingDetail bookingId={detailId} />}
      </Drawer>
    </Stack>
  );
}

function CreateBookingDrawer({
  opened,
  onClose,
  defaultValues,
  canViewPatientRecord,
}: {
  opened: boolean;
  onClose: () => void;
  defaultValues: OtBookingFormInput;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<OtBookingFormInput>({
    resolver: zodResolver(otBookingFormSchema),
    defaultValues,
  });
  const selectedPatientId = watch("patient_id");
  const linkedAdmissionId = watch("admission_id");
  const { data: rooms } = useQuery({
    queryKey: ["ot-rooms"],
    queryFn: () => otService.listOtRooms(),
    enabled: opened,
  });
  const roomOptions = (rooms ?? []).map((room: OtRoom) => ({
    value: room.id,
    label: `${room.name} (${room.code})`,
  }));

  const mutation = useMutation({
    mutationFn: (values: OtBookingFormInput) =>
      otService.createOtBooking(toCreateOtBookingRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["ot-schedule"] });
      notifications.show({ title: "Created", message: "OT booking created", color: "success" });
      onClose();
      reset(defaultValues);
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to create booking", color: "danger" }),
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="New OT Booking" position="right" size="xl">
      <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {linkedAdmissionId && (
          <Alert color="violet" variant="light">
            This booking is linked to IPD admission {linkedAdmissionId.slice(0, 8)}. OT notes,
            consumables, and billing can reconcile against the admission context.
          </Alert>
        )}
        <Controller
          control={control}
          name="admission_id"
          render={({ field }) =>
            linkedAdmissionId ? (
              <TextInput label="Linked IPD Admission" readOnly {...field} />
            ) : (
              <input type="hidden" {...field} />
            )
          }
        />
        <Controller
          control={control}
          name="patient_id"
          render={({ field }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              required
              error={errors.patient_id?.message}
            />
          )}
        />
        {canViewPatientRecord ? (
          <PatientContextBanner patientId={selectedPatientId} hideLoadingState />
        ) : (
          selectedPatientId && (
            <Alert color="warning" variant="light">
              Patient identity is restricted for this role. The booking will keep the linked patient
              id without displaying the patient profile.
            </Alert>
          )
        )}
        <Controller
          control={control}
          name="ot_room_id"
          render={({ field }) => (
            <Select
              label="OT Room"
              data={roomOptions}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "")}
              required
              searchable
              error={errors.ot_room_id?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="primary_surgeon_id"
          render={({ field }) => (
            <DoctorSearchSelect
              label="Primary Surgeon"
              value={field.value}
              onChange={field.onChange}
              required
              error={errors.primary_surgeon_id?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="procedure_name"
          render={({ field }) => (
            <TextInput
              label="Procedure Name"
              required
              {...field}
              error={errors.procedure_name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="scheduled_date"
          render={({ field }) => (
            <TextInput
              label="Scheduled Date"
              placeholder="YYYY-MM-DD"
              {...field}
              error={errors.scheduled_date?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="scheduled_start"
          render={({ field }) => (
            <TextInput
              label="Scheduled Start (ISO)"
              {...field}
              error={errors.scheduled_start?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="scheduled_end"
          render={({ field }) => (
            <TextInput
              label="Scheduled End (ISO)"
              {...field}
              error={errors.scheduled_end?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <Select
              label="Priority"
              data={OT_CASE_PRIORITY_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(normalizeOtCasePriority(value))}
              error={errors.priority?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => <Textarea label="Notes" {...field} />}
        />
        <Button type="submit" loading={mutation.isPending}>
          Create Booking
        </Button>
      </Stack>
    </Drawer>
  );
}

// ── Booking Detail (Tabbed Surgical Workflow) ──────────

function BookingDetail({ bookingId }: { bookingId: string }) {
  const { data } = useQuery<OtBooking>({
    queryKey: ["ot-booking", bookingId],
    queryFn: () => otService.getOtBooking(bookingId),
  });

  if (!data) return <Text c="dimmed">Loading...</Text>;

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
        <OverviewTab booking={data} />
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
  const [reasonAction, setReasonAction] = useState<OtStatusReasonActionFormValue>("cancel");
  const [reasonOpened, { open: openReasonEditor, close: closeReasonEditor }] = useDisclosure(false);
  const {
    control: reasonControl,
    handleSubmit: handleReasonSubmit,
    reset: resetReason,
    formState: { errors: reasonErrors },
  } = useForm<OtStatusReasonFormInput>({
    resolver: zodResolver(otStatusReasonFormSchema),
    defaultValues: DEFAULT_OT_STATUS_REASON_FORM_VALUES,
  });

  const openStatusReasonEditor = (action: OtStatusReasonActionFormValue) => {
    setReasonAction(action);
    resetReason(DEFAULT_OT_STATUS_REASON_FORM_VALUES);
    openReasonEditor();
  };

  const closeStatusReasonEditor = () => {
    closeReasonEditor();
    resetReason(DEFAULT_OT_STATUS_REASON_FORM_VALUES);
  };

  const statusMutation = useMutation({
    mutationFn: (payload: Parameters<typeof otService.updateOtBookingStatus>[1]) =>
      otService.updateOtBookingStatus(b.id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-booking", b.id] });
      void queryClient.invalidateQueries({ queryKey: ["ot-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["ot-schedule"] });
      notifications.show({ title: "Updated", message: "Booking status updated", color: "success" });
      closeStatusReasonEditor();
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Status update failed", color: "danger" }),
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700} size="lg">
          {b.procedure_name}
        </Text>
        <Badge color={bookingStatusColors[b.status] ?? "slate"} variant="light" size="lg">
          {b.status.replace("_", " ")}
        </Badge>
      </Group>

      <Text size="sm">Date: {b.scheduled_date}</Text>
      <Text size="sm">
        Time: {new Date(b.scheduled_start).toLocaleTimeString()} -{" "}
        {new Date(b.scheduled_end).toLocaleTimeString()}
      </Text>
      <PatientContextBanner patientId={b.patient_id} hideLoadingState />
      {b.laterality && <Text size="sm">Laterality: {b.laterality}</Text>}
      {b.estimated_duration_min && (
        <Text size="sm">Estimated Duration: {b.estimated_duration_min} min</Text>
      )}

      <Group gap="xs">
        <Checkbox label="Consent" checked={b.consent_obtained} readOnly size="xs" />
        <Checkbox label="Site Marked" checked={b.site_marked} readOnly size="xs" />
        <Checkbox label="Blood Arranged" checked={b.blood_arranged} readOnly size="xs" />
      </Group>
      {b.notes && (
        <Text size="sm" c="dimmed">
          {b.notes}
        </Text>
      )}

      {canUpdate && (
        <Stack gap="xs" mt="md">
          <Text size="sm" fw={600}>
            Status Transitions
          </Text>

          {b.status === "requested" && (
            <Group>
              <Button
                size="sm"
                color="primary"
                leftSection={<IconCheck size={14} />}
                loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ status: "confirmed" })}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                color="danger"
                variant="light"
                leftSection={<IconX size={14} />}
                onClick={() => openStatusReasonEditor("cancel")}
              >
                Cancel
              </Button>
            </Group>
          )}

          {b.status === "confirmed" && (
            <Group>
              <Button
                size="sm"
                color="success"
                leftSection={<IconPlayerPlay size={14} />}
                loading={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    status: "in_progress",
                    actual_start: new Date().toISOString(),
                  })
                }
              >
                Start Surgery
              </Button>
              <Button
                size="sm"
                color="orange"
                variant="light"
                leftSection={<IconClock size={14} />}
                onClick={() => openStatusReasonEditor("postpone")}
              >
                Postpone
              </Button>
              <Button
                size="sm"
                color="danger"
                variant="light"
                leftSection={<IconX size={14} />}
                onClick={() => openStatusReasonEditor("cancel")}
              >
                Cancel
              </Button>
            </Group>
          )}

          {b.status === "in_progress" && (
            <Group>
              <Button
                size="sm"
                color="teal"
                leftSection={<IconCircleCheck size={14} />}
                loading={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    status: "completed",
                    actual_end: new Date().toISOString(),
                  })
                }
              >
                Complete Surgery
              </Button>
              <Button
                size="sm"
                color="danger"
                variant="light"
                leftSection={<IconX size={14} />}
                onClick={() => openStatusReasonEditor("cancel")}
              >
                Cancel
              </Button>
            </Group>
          )}

          {reasonOpened && (
            <Stack
              component="form"
              gap="xs"
              onSubmit={handleReasonSubmit((values) =>
                statusMutation.mutate(toUpdateOtBookingStatusRequest(reasonAction, values)),
              )}
            >
              <Controller
                control={reasonControl}
                name="reason"
                render={({ field }) => (
                  <TextInput
                    label={reasonAction === "cancel" ? "Cancellation Reason" : "Postpone Reason"}
                    error={reasonErrors.reason?.message}
                    {...field}
                  />
                )}
              />
              <Group>
                <Button
                  type="submit"
                  size="sm"
                  color={reasonAction === "cancel" ? "danger" : "orange"}
                  loading={statusMutation.isPending}
                >
                  Confirm {reasonAction === "cancel" ? "Cancellation" : "Postpone"}
                </Button>
                <Button size="sm" variant="subtle" onClick={closeStatusReasonEditor}>
                  Back
                </Button>
              </Group>
            </Stack>
          )}

          {(b.status === "completed" || b.status === "cancelled" || b.status === "postponed") && (
            <Text size="sm" c="dimmed">
              No further transitions available.
            </Text>
          )}
          {b.cancellation_reason && (
            <Text size="sm" c="danger">
              Cancellation reason: {b.cancellation_reason}
            </Text>
          )}
          {b.postpone_reason && (
            <Text size="sm" c="orange">
              Postpone reason: {b.postpone_reason}
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}

// ── Pre-Op Sub-Tab ────────────────────────────────────

function PreopTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.PREOP_CREATE);
  const [editing, { open: openEditing, close: closeEditing }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ot-preop", bookingId],
    queryFn: () => otService.listPreopAssessments(bookingId),
  });

  const assessments: OtPreopAssessment[] = data ?? [];
  const assessment = assessments[0];
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OtPreopAssessmentFormInput>({
    resolver: zodResolver(otPreopAssessmentFormSchema),
    defaultValues: DEFAULT_OT_PREOP_ASSESSMENT_FORM_VALUES,
  });

  const createMutation = useMutation({
    mutationFn: (values: OtPreopAssessmentFormInput) =>
      otService.createPreopAssessment(bookingId, toCreatePreopAssessmentRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-preop", bookingId] });
      notifications.show({
        title: "Saved",
        message: "Pre-op assessment recorded",
        color: "success",
      });
      reset(DEFAULT_OT_PREOP_ASSESSMENT_FORM_VALUES);
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to save assessment", color: "danger" }),
  });

  const {
    control: updateControl,
    handleSubmit: handleUpdateSubmit,
    reset: resetUpdate,
    formState: { errors: updateErrors },
  } = useForm<OtPreopAssessmentUpdateFormInput>({
    resolver: zodResolver(otPreopAssessmentUpdateFormSchema),
    defaultValues: DEFAULT_OT_PREOP_UPDATE_FORM_VALUES,
  });

  const updateMutation = useMutation({
    mutationFn: (values: OtPreopAssessmentUpdateFormInput) =>
      otService.updatePreopAssessment(bookingId, toUpdatePreopAssessmentRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-preop", bookingId] });
      notifications.show({ title: "Updated", message: "Assessment updated", color: "success" });
      closeEditing();
      resetUpdate(DEFAULT_OT_PREOP_UPDATE_FORM_VALUES);
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Update failed", color: "danger" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  if (assessment && !editing) {
    const a = assessment;
    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>Pre-Operative Assessment</Text>
          <Badge
            color={
              a.clearance_status === "cleared"
                ? "success"
                : a.clearance_status === "not_cleared"
                  ? "danger"
                  : "warning"
            }
          >
            {a.clearance_status.replace("_", " ")}
          </Badge>
        </Group>
        {a.asa_class && (
          <Text size="sm">ASA Class: {a.asa_class.replace("_", " ").toUpperCase()}</Text>
        )}
        <Group gap="md">
          <Checkbox label="Fasting" checked={a.fasting_status} readOnly size="xs" />
          <Checkbox label="Labs Reviewed" checked={a.lab_results_reviewed} readOnly size="xs" />
          <Checkbox label="Imaging Reviewed" checked={a.imaging_reviewed} readOnly size="xs" />
          <Checkbox
            label="Blood Group Confirmed"
            checked={a.blood_group_confirmed}
            readOnly
            size="xs"
          />
        </Group>
        {a.npo_since && <Text size="sm">NPO Since: {a.npo_since}</Text>}
        {a.allergies_noted && <Text size="sm">Allergies: {a.allergies_noted}</Text>}
        {a.current_medications && <Text size="sm">Medications: {a.current_medications}</Text>}
        {a.conditions && <Text size="sm">Conditions: {a.conditions}</Text>}
        <Text size="xs" c="dimmed">
          Assessed at: {new Date(a.assessed_at).toLocaleString()}
        </Text>
        {canCreate && (
          <Button
            size="sm"
            variant="light"
            onClick={() => {
              resetUpdate({
                clearance_status: a.clearance_status,
                asa_class: a.asa_class,
              });
              openEditing();
            }}
          >
            Edit Assessment
          </Button>
        )}
      </Stack>
    );
  }

  if (assessment && editing) {
    return (
      <Stack
        component="form"
        onSubmit={handleUpdateSubmit((values) => updateMutation.mutate(values))}
      >
        <Text fw={600}>Edit Assessment</Text>
        <Controller
          control={updateControl}
          name="clearance_status"
          render={({ field }) => (
            <Select
              label="Clearance Status"
              data={OT_PREOP_CLEARANCE_STATUS_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(normalizeOtPreopClearanceStatus(value))}
              error={updateErrors.clearance_status?.message}
            />
          )}
        />
        <Controller
          control={updateControl}
          name="asa_class"
          render={({ field }) => (
            <Select
              label="ASA Class"
              data={OT_ASA_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(normalizeOtAsaClassification(value))}
              error={updateErrors.asa_class?.message}
              clearable
            />
          )}
        />
        <Group>
          <Button size="sm" type="submit" loading={updateMutation.isPending}>
            Save
          </Button>
          <Button
            size="sm"
            variant="subtle"
            onClick={() => {
              closeEditing();
              resetUpdate(DEFAULT_OT_PREOP_UPDATE_FORM_VALUES);
            }}
          >
            Cancel
          </Button>
        </Group>
      </Stack>
    );
  }

  if (!canCreate)
    return (
      <Text c="dimmed" size="sm">
        No pre-op assessment recorded.
      </Text>
    );

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
      <Text fw={600}>Create Pre-Op Assessment</Text>
      <Controller
        control={control}
        name="asa_class"
        render={({ field }) => (
          <Select
            label="ASA Class"
            data={OT_ASA_OPTIONS}
            value={field.value}
            onChange={(value) => field.onChange(normalizeOtAsaClassification(value))}
            error={errors.asa_class?.message}
            clearable
          />
        )}
      />
      <Controller
        control={control}
        name="fasting_status"
        render={({ field }) => (
          <Checkbox
            label="Fasting"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="npo_since"
        render={({ field }) => <TextInput label="NPO Since" placeholder="e.g. 22:00" {...field} />}
      />
      <Controller
        control={control}
        name="lab_results_reviewed"
        render={({ field }) => (
          <Checkbox
            label="Lab Results Reviewed"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="imaging_reviewed"
        render={({ field }) => (
          <Checkbox
            label="Imaging Reviewed"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="blood_group_confirmed"
        render={({ field }) => (
          <Checkbox
            label="Blood Group Confirmed"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="allergies_noted"
        render={({ field }) => <TextInput label="Allergies" {...field} />}
      />
      <Controller
        control={control}
        name="current_medications"
        render={({ field }) => <TextInput label="Current Medications" {...field} />}
      />
      <Controller
        control={control}
        name="conditions"
        render={({ field }) => <Textarea label="Conditions" {...field} />}
      />
      <Button type="submit" loading={createMutation.isPending}>
        Save Assessment
      </Button>
    </Stack>
  );
}

// ── WHO Safety Checklist Sub-Tab ──────────────────────

const PHASES: ChecklistPhase[] = ["sign_in", "time_out", "sign_out"];
const phaseLabels: Record<ChecklistPhase, string> = {
  sign_in: "Sign In",
  time_out: "Time Out",
  sign_out: "Sign Out",
};

function previousChecklistPhase(phase: ChecklistPhase): ChecklistPhase | null {
  const index = PHASES.indexOf(phase);
  if (index <= 0) {
    return null;
  }

  return PHASES[index - 1] ?? null;
}

function ChecklistTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.SAFETY_CHECKLIST_CREATE);

  const { data: checklists = [], isLoading } = useQuery<OtSurgicalSafetyChecklist[]>({
    queryKey: ["ot-checklists", bookingId],
    queryFn: () => otService.listSafetyChecklists(bookingId),
  });

  const byPhase = new Map(checklists.map((c) => [c.phase, c]));

  const createMutation = useMutation({
    mutationFn: (d: CreateSafetyChecklistRequest) => otService.createSafetyChecklist(bookingId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-checklists", bookingId] });
      notifications.show({
        title: "Created",
        message: "Checklist phase started",
        color: "success",
      });
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed to create checklist",
        color: "danger",
      }),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      otService.updateSafetyChecklist(bookingId, id, { completed: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-checklists", bookingId] });
      notifications.show({ title: "Completed", message: "Phase completed", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to complete phase", color: "danger" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const isPhaseBlocked = (phase: ChecklistPhase): boolean => {
    const prevPhase = previousChecklistPhase(phase);
    if (!prevPhase) {
      return false;
    }
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
        const previousPhase = previousChecklistPhase(phase);

        return (
          <Card
            key={phase}
            withBorder
            padding="sm"
            style={{
              borderColor: completed
                ? "var(--mantine-color-green-5)"
                : checklist
                  ? "var(--mantine-color-yellow-5)"
                  : undefined,
            }}
          >
            <Group justify="space-between">
              <Group gap="sm">
                <ThemeIcon
                  size="sm"
                  variant="light"
                  color={completed ? "success" : checklist ? "warning" : "slate"}
                >
                  {completed ? <IconCircleCheck size={14} /> : <IconCircleDashed size={14} />}
                </ThemeIcon>
                <Text fw={500}>{phaseLabels[phase]}</Text>
              </Group>
              {completed && (
                <Badge color="success" size="sm">
                  Completed
                </Badge>
              )}
              {checklist && !completed && (
                <Badge color="warning" size="sm">
                  In Progress
                </Badge>
              )}
              {!checklist && (
                <Badge color="slate" size="sm">
                  Not Started
                </Badge>
              )}
            </Group>

            {checklist?.completed_at && (
              <Text size="xs" c="dimmed" mt={4}>
                Completed at: {new Date(checklist.completed_at).toLocaleString()}
              </Text>
            )}

            {canCreate && !checklist && (
              <Button
                size="xs"
                mt="xs"
                variant="light"
                disabled={blocked}
                loading={createMutation.isPending}
                onClick={() => createMutation.mutate({ phase, items: {} })}
              >
                {blocked
                  ? `Complete ${previousPhase ? phaseLabels[previousPhase] : "previous phase"} first`
                  : `Start ${phaseLabels[phase]}`}
              </Button>
            )}

            {canCreate && checklist && !completed && (
              <Button
                size="xs"
                mt="xs"
                color="success"
                loading={completeMutation.isPending}
                onClick={() => completeMutation.mutate({ id: checklist.id })}
              >
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

  const { data: record = null, isLoading } = useQuery<OtCaseRecord | null>({
    queryKey: ["ot-case-record", bookingId],
    queryFn: () => otService.getCaseRecord(bookingId),
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<OtCaseRecordFormInput>({
    resolver: zodResolver(otCaseRecordFormSchema),
    defaultValues: DEFAULT_OT_CASE_RECORD_FORM_VALUES,
  });
  const instrumentCountBefore = watch("instrument_count_correct_before");
  const instrumentCountAfter = watch("instrument_count_correct_after");
  const spongeCountCorrect = watch("sponge_count_correct");

  const createMutation = useMutation({
    mutationFn: (values: OtCaseRecordFormInput) =>
      otService.createCaseRecord(bookingId, toCreateCaseRecordRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-case-record", bookingId] });
      notifications.show({ title: "Saved", message: "Case record created", color: "success" });
      reset(DEFAULT_OT_CASE_RECORD_FORM_VALUES);
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed to save case record",
        color: "danger",
      }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  if (record) {
    return (
      <Stack>
        <Text fw={600}>Surgical Case Record</Text>
        <Text size="sm" fw={500}>
          Procedure: {record.procedure_performed}
        </Text>
        {record.incision_time && (
          <Text size="sm">Incision: {new Date(record.incision_time).toLocaleTimeString()}</Text>
        )}
        {record.closure_time && (
          <Text size="sm">Closure: {new Date(record.closure_time).toLocaleTimeString()}</Text>
        )}
        {record.patient_in_time && (
          <Text size="sm">Patient In: {new Date(record.patient_in_time).toLocaleTimeString()}</Text>
        )}
        {record.patient_out_time && (
          <Text size="sm">
            Patient Out: {new Date(record.patient_out_time).toLocaleTimeString()}
          </Text>
        )}
        {record.findings && <Text size="sm">Findings: {record.findings}</Text>}
        {record.technique && <Text size="sm">Technique: {record.technique}</Text>}
        {record.complications && (
          <Text size="sm" c="danger">
            Complications: {record.complications}
          </Text>
        )}
        {record.blood_loss_ml != null && (
          <Text size="sm">Blood Loss: {record.blood_loss_ml} ml</Text>
        )}

        <Text size="sm" fw={500} mt="xs">
          Counts
        </Text>
        <Group gap="md">
          <Checkbox
            label="Instruments (before)"
            checked={record.instrument_count_correct_before ?? false}
            readOnly
            size="xs"
            color={record.instrument_count_correct_before ? "success" : "danger"}
          />
          <Checkbox
            label="Instruments (after)"
            checked={record.instrument_count_correct_after ?? false}
            readOnly
            size="xs"
            color={record.instrument_count_correct_after ? "success" : "danger"}
          />
          <Checkbox
            label="Sponges"
            checked={record.sponge_count_correct ?? false}
            readOnly
            size="xs"
            color={record.sponge_count_correct ? "success" : "danger"}
          />
        </Group>
        {(record.instrument_count_correct_before === false ||
          record.instrument_count_correct_after === false ||
          record.sponge_count_correct === false) && (
          <Text size="xs" c="danger" fw={600}>
            WARNING: Count discrepancy detected — verify immediately!
          </Text>
        )}
        {record.notes && (
          <Text size="sm" c="dimmed">
            {record.notes}
          </Text>
        )}
      </Stack>
    );
  }

  if (!canCreate)
    return (
      <Text c="dimmed" size="sm">
        No case record yet.
      </Text>
    );

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
      <Text fw={600}>Create Case Record</Text>
      <Controller
        control={control}
        name="procedure_performed"
        render={({ field }) => (
          <TextInput
            label="Procedure Performed"
            required
            {...field}
            error={errors.procedure_performed?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="findings"
        render={({ field }) => <Textarea label="Findings" {...field} />}
      />
      <Controller
        control={control}
        name="technique"
        render={({ field }) => <Textarea label="Technique" {...field} />}
      />
      <Controller
        control={control}
        name="complications"
        render={({ field }) => <Textarea label="Complications" {...field} />}
      />
      <Controller
        control={control}
        name="blood_loss_ml"
        render={({ field }) => (
          <NumberInput
            label="Blood Loss (ml)"
            min={0}
            value={field.value}
            onChange={field.onChange}
            error={errors.blood_loss_ml?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="incision_time"
        render={({ field }) => (
          <TextInput label="Incision Time (ISO)" placeholder="Auto-filled or manual" {...field} />
        )}
      />
      <Controller
        control={control}
        name="closure_time"
        render={({ field }) => <TextInput label="Closure Time (ISO)" {...field} />}
      />
      <Controller
        control={control}
        name="patient_in_time"
        render={({ field }) => <TextInput label="Patient In Time (ISO)" {...field} />}
      />
      <Controller
        control={control}
        name="patient_out_time"
        render={({ field }) => <TextInput label="Patient Out Time (ISO)" {...field} />}
      />

      <Text size="sm" fw={500} mt="xs">
        Instrument & Sponge Counts
      </Text>
      <Controller
        control={control}
        name="instrument_count_correct_before"
        render={({ field }) => (
          <Checkbox
            label="Instruments correct (before)"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="instrument_count_correct_after"
        render={({ field }) => (
          <Checkbox
            label="Instruments correct (after)"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="sponge_count_correct"
        render={({ field }) => (
          <Checkbox
            label="Sponges correct"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      {(!instrumentCountBefore || !instrumentCountAfter || !spongeCountCorrect) && (
        <Text size="xs" c="danger" fw={600}>
          WARNING: Unchecked counts require verification before closure.
        </Text>
      )}

      <Controller
        control={control}
        name="specimens"
        render={({ field }) => (
          <Textarea label="Specimens" placeholder="List specimens collected" {...field} />
        )}
      />
      <Controller
        control={control}
        name="implants"
        render={({ field }) => (
          <Textarea label="Implants" placeholder="List implants used" {...field} />
        )}
      />
      <Controller
        control={control}
        name="drains"
        render={({ field }) => (
          <Textarea label="Drains" placeholder="List drains placed" {...field} />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <Textarea label="Notes" {...field} />}
      />

      <Button type="submit" loading={createMutation.isPending}>
        Save Case Record
      </Button>
    </Stack>
  );
}

// ── Anesthesia Sub-Tab ────────────────────────────────

function AnesthesiaTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.ANESTHESIA_CREATE);

  const { data: record = null, isLoading } = useQuery<OtAnesthesiaRecord | null>({
    queryKey: ["ot-anesthesia", bookingId],
    queryFn: () => otService.getAnesthesiaRecord(bookingId),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OtAnesthesiaRecordFormInput>({
    resolver: zodResolver(otAnesthesiaRecordFormSchema),
    defaultValues: DEFAULT_OT_ANESTHESIA_RECORD_FORM_VALUES,
  });

  const createMutation = useMutation({
    mutationFn: (values: OtAnesthesiaRecordFormInput) =>
      otService.createAnesthesiaRecord(bookingId, toCreateAnesthesiaRecordRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-anesthesia", bookingId] });
      notifications.show({
        title: "Saved",
        message: "Anesthesia record created",
        color: "success",
      });
      reset(DEFAULT_OT_ANESTHESIA_RECORD_FORM_VALUES);
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed to save anesthesia record",
        color: "danger",
      }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  if (record) {
    return (
      <Stack>
        <Text fw={600}>Anesthesia Record</Text>
        <Text size="sm">Type: {record.anesthesia_type.replace("_", " ")}</Text>
        {record.asa_class && (
          <Text size="sm">ASA Class: {record.asa_class.replace("_", " ").toUpperCase()}</Text>
        )}
        {record.induction_time && (
          <Text size="sm">Induction: {new Date(record.induction_time).toLocaleTimeString()}</Text>
        )}
        {record.intubation_time && (
          <Text size="sm">Intubation: {new Date(record.intubation_time).toLocaleTimeString()}</Text>
        )}
        {record.extubation_time && (
          <Text size="sm">Extubation: {new Date(record.extubation_time).toLocaleTimeString()}</Text>
        )}
        {record.complications && (
          <Text size="sm" c="danger">
            Complications: {record.complications}
          </Text>
        )}
        {record.notes && (
          <Text size="sm" c="dimmed">
            {record.notes}
          </Text>
        )}
      </Stack>
    );
  }

  if (!canCreate)
    return (
      <Text c="dimmed" size="sm">
        No anesthesia record yet.
      </Text>
    );

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
      <Text fw={600}>Create Anesthesia Record</Text>
      <Controller
        control={control}
        name="anesthesia_type"
        render={({ field }) => (
          <Select
            label="Anesthesia Type"
            data={OT_ANESTHESIA_TYPE_OPTIONS}
            required
            value={field.value}
            onChange={(value) => field.onChange(normalizeOtAnesthesiaType(value))}
            error={errors.anesthesia_type?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="asa_class"
        render={({ field }) => (
          <Select
            label="ASA Class"
            data={OT_ASA_OPTIONS}
            value={field.value}
            onChange={(value) => field.onChange(normalizeOtAsaClassification(value))}
            error={errors.asa_class?.message}
            clearable
          />
        )}
      />
      <Controller
        control={control}
        name="induction_time"
        render={({ field }) => <TextInput label="Induction Time (ISO)" {...field} />}
      />
      <Controller
        control={control}
        name="intubation_time"
        render={({ field }) => <TextInput label="Intubation Time (ISO)" {...field} />}
      />
      <Controller
        control={control}
        name="airway_details"
        render={({ field }) => (
          <Textarea label="Airway Details" placeholder="Airway assessment details" {...field} />
        )}
      />
      <Controller
        control={control}
        name="drugs_administered"
        render={({ field }) => (
          <Textarea label="Drugs Administered" placeholder="List drugs, doses, routes" {...field} />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <Textarea label="Notes" {...field} />}
      />
      <Button type="submit" loading={createMutation.isPending}>
        Save Anesthesia Record
      </Button>
    </Stack>
  );
}

// ── Post-Op / PACU Sub-Tab ────────────────────────────

function PostopTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.POSTOP_CREATE);

  const { data: record = null, isLoading } = useQuery<OtPostopRecord | null>({
    queryKey: ["ot-postop", bookingId],
    queryFn: () => otService.getPostopRecord(bookingId),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OtPostopRecordFormInput>({
    resolver: zodResolver(otPostopRecordFormSchema),
    defaultValues: DEFAULT_OT_POSTOP_RECORD_FORM_VALUES,
  });

  const createMutation = useMutation({
    mutationFn: (values: OtPostopRecordFormInput) =>
      otService.createPostopRecord(bookingId, toCreatePostopRecordRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-postop", bookingId] });
      notifications.show({ title: "Saved", message: "Post-op record created", color: "success" });
      reset(DEFAULT_OT_POSTOP_RECORD_FORM_VALUES);
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed to save post-op record",
        color: "danger",
      }),
  });

  const [editing, { open: openEditing, close: closeEditing }] = useDisclosure(false);
  const {
    control: updateControl,
    handleSubmit: handleUpdateSubmit,
    reset: resetUpdate,
    formState: { errors: updateErrors },
  } = useForm<OtPostopRecordUpdateFormInput>({
    resolver: zodResolver(otPostopRecordUpdateFormSchema),
    defaultValues: DEFAULT_OT_POSTOP_UPDATE_FORM_VALUES,
  });

  const updateMutation = useMutation({
    mutationFn: (values: OtPostopRecordUpdateFormInput) =>
      otService.updatePostopRecord(bookingId, toUpdatePostopRecordRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-postop", bookingId] });
      notifications.show({ title: "Updated", message: "Post-op record updated", color: "success" });
      closeEditing();
      resetUpdate(DEFAULT_OT_POSTOP_UPDATE_FORM_VALUES);
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Update failed", color: "danger" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  if (record && !editing) {
    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>Post-Op / PACU Recovery</Text>
          <Badge
            color={
              record.recovery_status === "discharged" ||
              record.recovery_status === "shifted_to_ward"
                ? "success"
                : record.recovery_status === "shifted_to_icu"
                  ? "orange"
                  : "primary"
            }
          >
            {record.recovery_status.replace(/_/g, " ")}
          </Badge>
        </Group>
        {record.arrival_time && (
          <Text size="sm">Arrival: {new Date(record.arrival_time).toLocaleTimeString()}</Text>
        )}
        {record.discharge_time && (
          <Text size="sm">Discharge: {new Date(record.discharge_time).toLocaleTimeString()}</Text>
        )}
        {record.aldrete_score_arrival != null && (
          <Text size="sm">Aldrete (arrival): {record.aldrete_score_arrival}/10</Text>
        )}
        {record.aldrete_score_discharge != null && (
          <Text size="sm">Aldrete (discharge): {record.aldrete_score_discharge}/10</Text>
        )}
        {record.pain_assessment && <Text size="sm">Pain: {record.pain_assessment}</Text>}
        {record.fluid_orders && <Text size="sm">Fluid Orders: {record.fluid_orders}</Text>}
        {record.diet_orders && <Text size="sm">Diet: {record.diet_orders}</Text>}
        {record.activity_orders && <Text size="sm">Activity: {record.activity_orders}</Text>}
        {record.disposition && <Text size="sm">Disposition: {record.disposition}</Text>}
        {record.notes && (
          <Text size="sm" c="dimmed">
            {record.notes}
          </Text>
        )}
        {canCreate && (
          <Button
            size="sm"
            variant="light"
            onClick={() => {
              resetUpdate({
                recovery_status: record.recovery_status,
                aldrete_score_discharge: record.aldrete_score_discharge ?? "",
                discharge_time: "",
                disposition: record.disposition ?? "",
                notes: record.notes ?? "",
              });
              openEditing();
            }}
          >
            Update Recovery
          </Button>
        )}
      </Stack>
    );
  }

  if (record && editing) {
    return (
      <Stack
        component="form"
        onSubmit={handleUpdateSubmit((values) => updateMutation.mutate(values))}
      >
        <Text fw={600}>Update Post-Op Recovery</Text>
        <Controller
          control={updateControl}
          name="recovery_status"
          render={({ field }) => (
            <Select
              label="Recovery Status"
              data={OT_POSTOP_RECOVERY_STATUS_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(normalizeOtPostopRecoveryStatus(value))}
              error={updateErrors.recovery_status?.message}
            />
          )}
        />
        <Controller
          control={updateControl}
          name="aldrete_score_discharge"
          render={({ field }) => (
            <NumberInput
              label="Aldrete Score (discharge)"
              min={0}
              max={10}
              value={field.value}
              onChange={field.onChange}
              error={updateErrors.aldrete_score_discharge?.message}
            />
          )}
        />
        <Controller
          control={updateControl}
          name="discharge_time"
          render={({ field }) => (
            <TextInput label="Discharge Time (ISO)" placeholder="Auto or manual" {...field} />
          )}
        />
        <Controller
          control={updateControl}
          name="disposition"
          render={({ field }) => <TextInput label="Disposition" {...field} />}
        />
        <Controller
          control={updateControl}
          name="notes"
          render={({ field }) => <Textarea label="Notes" {...field} />}
        />
        <Group>
          <Button size="sm" type="submit" loading={updateMutation.isPending}>
            Save
          </Button>
          <Button
            size="sm"
            variant="subtle"
            onClick={() => {
              closeEditing();
              resetUpdate(DEFAULT_OT_POSTOP_UPDATE_FORM_VALUES);
            }}
          >
            Cancel
          </Button>
        </Group>
      </Stack>
    );
  }

  if (!canCreate)
    return (
      <Text c="dimmed" size="sm">
        No post-op record yet.
      </Text>
    );

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
      <Text fw={600}>Create Post-Op Record</Text>
      <Controller
        control={control}
        name="arrival_time"
        render={({ field }) => (
          <TextInput label="Arrival Time (ISO)" placeholder="PACU arrival" {...field} />
        )}
      />
      <Controller
        control={control}
        name="aldrete_score_arrival"
        render={({ field }) => (
          <NumberInput
            label="Aldrete Score (arrival)"
            min={0}
            max={10}
            value={field.value}
            onChange={field.onChange}
            error={errors.aldrete_score_arrival?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="pain_assessment"
        render={({ field }) => (
          <TextInput label="Pain Assessment" placeholder="e.g. NRS 4/10" {...field} />
        )}
      />
      <Controller
        control={control}
        name="fluid_orders"
        render={({ field }) => <TextInput label="Fluid Orders" {...field} />}
      />
      <Controller
        control={control}
        name="diet_orders"
        render={({ field }) => <TextInput label="Diet Orders" {...field} />}
      />
      <Controller
        control={control}
        name="activity_orders"
        render={({ field }) => <TextInput label="Activity Orders" {...field} />}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <Textarea label="Notes" {...field} />}
      />
      <Button type="submit" loading={createMutation.isPending}>
        Save Post-Op Record
      </Button>
    </Stack>
  );
}

// ── Rooms Tab ──────────────────────────────────────────

function RoomsTab({ canManage }: { canManage: boolean }) {
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data = [], isLoading } = useQuery<OtRoom[]>({
    queryKey: ["ot-rooms"],
    queryFn: () => otService.listOtRooms(),
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
          <Text size="sm" fw={500}>
            {r.name}
          </Text>
          <Text size="xs" c="dimmed">
            {r.code}
          </Text>
        </Stack>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: OtRoom) => (
        <StatusDot color={roomStatusColors[r.status] ?? "slate"} label={r.status} />
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (r: OtRoom) => (
        <Badge variant="light" color={r.is_active ? "success" : "slate"}>
          {r.is_active ? "Yes" : "No"}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Room
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <CreateRoomDrawer opened={createOpened} onClose={closeCreate} />
    </Stack>
  );
}

function CreateRoomDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OtRoomFormInput>({
    resolver: zodResolver(otRoomFormSchema),
    defaultValues: DEFAULT_OT_ROOM_FORM_VALUES,
  });

  const mutation = useMutation({
    mutationFn: (values: OtRoomFormInput) => otService.createOtRoom(toCreateOtRoomRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-rooms"] });
      notifications.show({ title: "Created", message: "OT room created", color: "success" });
      onClose();
      reset(DEFAULT_OT_ROOM_FORM_VALUES);
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="New OT Room" position="right" size="sm">
      <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput label="Room Name" required error={errors.name?.message} {...field} />
          )}
        />
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextInput label="Code" required error={errors.code?.message} {...field} />
          )}
        />
        <Button type="submit" loading={mutation.isPending}>
          Create
        </Button>
      </Stack>
    </Drawer>
  );
}

// ── Preferences Tab ────────────────────────────────────

function PreferencesTab({ canManage }: { canManage: boolean }) {
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data = [], isLoading } = useQuery<OtSurgeonPreference[]>({
    queryKey: ["ot-surgeon-preferences"],
    queryFn: () => otService.listSurgeonPreferences(),
  });

  const columns = [
    {
      key: "procedure_name",
      label: "Procedure",
      render: (r: OtSurgeonPreference) => (
        <Text size="sm" fw={500}>
          {r.procedure_name}
        </Text>
      ),
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
      render: (r: OtSurgeonPreference) => (
        <Text size="sm" lineClamp={1}>
          {r.special_instructions ?? "\u2014"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Preference Card
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <CreatePreferenceDrawer opened={createOpened} onClose={closeCreate} />
    </Stack>
  );
}

function CreatePreferenceDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OtSurgeonPreferenceFormInput>({
    resolver: zodResolver(otSurgeonPreferenceFormSchema),
    defaultValues: DEFAULT_OT_SURGEON_PREFERENCE_FORM_VALUES,
  });

  const mutation = useMutation({
    mutationFn: (values: OtSurgeonPreferenceFormInput) =>
      otService.createSurgeonPreference(toCreateSurgeonPreferenceRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-surgeon-preferences"] });
      notifications.show({ title: "Created", message: "Preference card saved", color: "success" });
      onClose();
      reset(DEFAULT_OT_SURGEON_PREFERENCE_FORM_VALUES);
    },
  });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Surgeon Preference Card"
      position="right"
      size="xl"
    >
      <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <Controller
          control={control}
          name="surgeon_id"
          render={({ field }) => (
            <TextInput label="Surgeon ID" required {...field} error={errors.surgeon_id?.message} />
          )}
        />
        <Controller
          control={control}
          name="procedure_name"
          render={({ field }) => (
            <TextInput
              label="Procedure Name"
              required
              {...field}
              error={errors.procedure_name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="position"
          render={({ field }) => <TextInput label="Position" {...field} />}
        />
        <Controller
          control={control}
          name="skin_prep"
          render={({ field }) => <TextInput label="Skin Prep" {...field} />}
        />
        <Controller
          control={control}
          name="draping"
          render={({ field }) => <TextInput label="Draping" {...field} />}
        />
        <Controller
          control={control}
          name="special_instructions"
          render={({ field }) => <Textarea label="Special Instructions" {...field} />}
        />
        <Button type="submit" loading={mutation.isPending}>
          Save
        </Button>
      </Stack>
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  OT Phase 2b — Consumables Sub-Tab
// ══════════════════════════════════════════════════════════

function ConsumablesSubTab({ bookingId }: { bookingId: string }) {
  const canManage = useHasPermission(P.OT.CONSUMABLES_MANAGE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(otConsumableFormSchema),
    defaultValues: DEFAULT_OT_CONSUMABLE_FORM_VALUES,
    mode: "onTouched",
  });
  const consumableValues = watch();

  const { data: consumables = [], isLoading } = useQuery<OtConsumableUsage[]>({
    queryKey: ["ot-consumables", bookingId],
    queryFn: () => otService.listOtConsumables(bookingId),
  });

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof toCreateOtConsumableRequest>) =>
      otService.createOtConsumable(bookingId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-consumables", bookingId] });
      notifications.show({ title: "Added", message: "Consumable recorded", color: "success" });
      formHandlers.close();
      reset(DEFAULT_OT_CONSUMABLE_FORM_VALUES);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => otService.deleteOtConsumable(bookingId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-consumables", bookingId] });
      notifications.show({ title: "Removed", message: "Consumable removed", color: "success" });
    },
  });

  const rows = consumables;
  const totalCost = rows.reduce((sum, r) => sum + (r.unit_price ?? 0) * r.quantity, 0);
  const handleCreate = handleSubmit((values) => {
    createMutation.mutate(toCreateOtConsumableRequest(values));
  });
  const closeForm = () => {
    formHandlers.close();
    reset(DEFAULT_OT_CONSUMABLE_FORM_VALUES);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={500}>Consumables Used</Text>
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} size="sm" onClick={formHandlers.open}>
            Add Consumable
          </Button>
        )}
      </Group>

      {totalCost > 0 && (
        <Badge size="lg" variant="light" color="primary">
          Total Cost: {totalCost.toFixed(2)}
        </Badge>
      )}

      {formOpened && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <Controller
              control={control}
              name="item_name"
              render={({ field }) => (
                <TextInput
                  label="Item Name"
                  error={errors.item_name?.message}
                  required
                  {...field}
                />
              )}
            />
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  label="Category"
                  data={OT_CONSUMABLE_CATEGORY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.category?.message}
                  required
                />
              )}
            />
            <Group grow>
              <Controller
                control={control}
                name="quantity"
                render={({ field }) => (
                  <NumberInput
                    label="Quantity"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.quantity?.message}
                    min={0.01}
                    decimalScale={2}
                    required
                  />
                )}
              />
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <TextInput label="Unit" placeholder="pcs, ml, etc." {...field} />
                )}
              />
            </Group>
            <Group grow>
              <Controller
                control={control}
                name="unit_price"
                render={({ field }) => (
                  <NumberInput
                    label="Unit Price"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.unit_price?.message}
                    min={0}
                    decimalScale={2}
                  />
                )}
              />
              <Controller
                control={control}
                name="batch_number"
                render={({ field }) => <TextInput label="Batch Number" {...field} />}
              />
            </Group>
            <Group>
              <Button
                size="sm"
                onClick={handleCreate}
                loading={createMutation.isPending}
                disabled={!consumableValues.item_name.trim() || !consumableValues.category}
              >
                Save
              </Button>
              <Button size="sm" variant="subtle" onClick={closeForm}>
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
          No consumables recorded for this surgery.
        </Text>
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
                <Table.Td>
                  <Text size="sm">{c.item_name}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light">
                    {c.category.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {c.quantity} {c.unit ?? ""}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{c.unit_price?.toFixed(2) ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {((c.unit_price ?? 0) * c.quantity).toFixed(2)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{c.batch_number ?? "—"}</Text>
                </Table.Td>
                {canManage && (
                  <Table.Td>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="danger"
                      onClick={() => deleteMutation.mutate(c.id)}
                      aria-label="Delete"
                    >
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
  const {
    control,
    formState: { errors },
  } = useForm<OtUtilizationFilterFormInput>({
    resolver: zodResolver(otUtilizationFilterFormSchema),
    defaultValues: DEFAULT_OT_UTILIZATION_FILTER_FORM_VALUES,
    mode: "onChange",
  });
  const watchedFilters = useWatch({ control });
  const filterValues: OtUtilizationFilterFormInput = {
    from: watchedFilters.from ?? "",
    to: watchedFilters.to ?? "",
  };
  const utilizationParams = toOtUtilizationParams(filterValues);

  const { data: rows = [], isLoading } = useQuery<RoomUtilization[]>({
    queryKey: ["ot-utilization", utilizationParams?.from ?? "", utilizationParams?.to ?? ""],
    queryFn: () => otService.otUtilization(utilizationParams),
    enabled: !errors.to,
  });

  return (
    <Stack>
      <Text fw={500} size="lg">
        OT Utilization Report
      </Text>
      <Group>
        <Controller
          control={control}
          name="from"
          render={({ field }) => (
            <TextInput label="From" type="date" error={errors.from?.message} w={180} {...field} />
          )}
        />
        <Controller
          control={control}
          name="to"
          render={({ field }) => (
            <TextInput label="To" type="date" error={errors.to?.message} w={180} {...field} />
          )}
        />
      </Group>

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No data for the selected period.
        </Text>
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
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {r.room_name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.total_bookings}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.total_surgery_minutes ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {r.avg_turnaround_minutes != null ? r.avg_turnaround_minutes.toFixed(1) : "—"}
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
