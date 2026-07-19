import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Checkbox,
  Drawer,
  Group,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import type {
  OtAnesthesiaRecordFormInput,
  OtBookingFormInput,
  OtRoomFormInput,
  OtStatusReasonActionFormValue,
  OtStatusReasonFormInput,
  OtSurgeonPreferenceFormInput,
  OtUtilizationFilterFormInput,
} from "@medbrains/schemas";
import {
  otAnesthesiaRecordFormSchema,
  otBookingFormSchema,
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
  OtHandoffItem,
  OtRoom,
  OtSurgeonPreference,
  OtSurgicalSafetyChecklist,
  RoomUtilization,
  SetupUser,
  UpsertPreopHandoffInput,
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
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useSearchParams } from "react-router";
import { DataTable, PageHeader, StatusDot } from "@/components";
import { PatientConsumablesPanel } from "@/components/Clinical";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { StationHandoffPanel } from "@/components/Handoff/StationHandoffPanel";
import { OtImplantRegisterPanel } from "@/components/Ot/OtImplantRegisterPanel";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, type BadgeTone, Button, IconButton, Table, toast } from "@/components/ui";
import {
  DEFAULT_OT_ANESTHESIA_RECORD_FORM_VALUES,
  DEFAULT_OT_BOOKING_FORM_VALUES,
  DEFAULT_OT_ROOM_FORM_VALUES,
  DEFAULT_OT_STATUS_REASON_FORM_VALUES,
  DEFAULT_OT_SURGEON_PREFERENCE_FORM_VALUES,
  DEFAULT_OT_UTILIZATION_FILTER_FORM_VALUES,
  normalizeOtAnesthesiaType,
  normalizeOtAsaClassification,
  normalizeOtCasePriority,
  OT_ANESTHESIA_TYPE_OPTIONS,
  OT_ASA_OPTIONS,
  OT_CASE_PRIORITY_OPTIONS,
  toCreateAnesthesiaRecordRequest,
  toCreateOtBookingRequest,
  toCreateOtRoomRequest,
  toCreateSurgeonPreferenceRequest,
  toOtUtilizationParams,
  toUpdateOtBookingStatusRequest,
} from "@/forms/ot.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { adminAccessService } from "@/services/adminAccess.service";
import { otService } from "@/services/ot.service";
import { CaseRecordTab } from "./ot/case-record-tab";
import { PostopTab } from "./ot/postop-tab";
import { PreopTab } from "./ot/preop-tab";

const bookingStatusColors: Record<string, string> = {
  requested: "warning",
  confirmed: "primary",
  in_progress: "success",
  completed: "teal",
  cancelled: "danger",
  postponed: "orange",
};

const bookingStatusTones: Record<string, BadgeTone> = {
  requested: "warning",
  confirmed: "primary",
  in_progress: "success",
  completed: "success",
  cancelled: "danger",
  postponed: "warning",
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
      <DataTable
        columns={[
          {
            key: "time",
            label: "Time",
            render: (b: OtBooking) => (
              <Text size="sm">
                {new Date(b.scheduled_start).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            ),
          },
          {
            key: "procedure",
            label: "Procedure",
            render: (b: OtBooking) => (
              <Text size="sm" fw={500}>
                {b.procedure_name}
              </Text>
            ),
          },
          {
            key: "patient",
            label: "Patient",
            render: (b: OtBooking) => (
              <OtPatientCell patientId={b.patient_id} canViewPatientRecord={canViewPatientRecord} />
            ),
          },
          {
            key: "priority",
            label: "Priority",
            render: (b: OtBooking) => (
              <Badge
                size="sm"
                tone={
                  b.priority === "emergency"
                    ? "danger"
                    : b.priority === "urgent"
                      ? "warning"
                      : "neutral"
                }
              >
                {b.priority}
              </Badge>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (b: OtBooking) => (
              <StatusDot color={bookingStatusColors[b.status] ?? "slate"} label={b.status} />
            ),
          },
        ]}
        data={data ?? []}
        loading={isLoading}
        rowKey={(b) => b.id}
        emptyTitle="No bookings for this date"
      />
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
          tone={
            r.priority === "emergency" ? "danger" : r.priority === "urgent" ? "warning" : "neutral"
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
          <IconButton
            tone="default"
            onClick={() => {
              setDetailId(r.id);
              openDetail();
            }}
            aria-label="View details"
          >
            <IconEye size={16} />
          </IconButton>
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
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New Booking
          </Button>
        )}
      </Group>

      {isIpdLinked && (
        <Alert tone="info">
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
        <Alert tone="warning">
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
      toast.success("OT booking created", { title: "Created" });
      onClose();
      reset(defaultValues);
    },
    onError: () => toast.error("Failed to create booking", { title: "Error" }),
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="New OT Booking" position="right" size="xl">
      <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {linkedAdmissionId && (
          <Alert tone="info">
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
            <Alert tone="warning">
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
        <Button tone="primary" type="submit" loading={mutation.isPending}>
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
        <Stack>
          <OverviewTab booking={data} />
          {data.ot_room_id && (
            <StationHandoffPanel
              module="ot"
              stationType="ot_room"
              stationKey={data.ot_room_id}
              stationLabel="OT room"
            />
          )}
        </Stack>
      </Tabs.Panel>
      <Tabs.Panel value="preop" pt="md">
        <Stack>
          <PreopTab bookingId={bookingId} />
          <PreopHandoffCard bookingId={bookingId} />
        </Stack>
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
        <Stack>
          <PostopTab bookingId={bookingId} />
          <PostopHandoffCard bookingId={bookingId} />
        </Stack>
      </Tabs.Panel>
      <Tabs.Panel value="consumables" pt="md">
        <Stack>
          <ConsumablesSubTab booking={data} />
          <OtImplantRegisterPanel booking={data} />
        </Stack>
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
      toast.success("Booking status updated", { title: "Updated" });
      closeStatusReasonEditor();
    },
    onError: () => toast.error("Status update failed", { title: "Error" }),
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700} size="lg">
          {b.procedure_name}
        </Text>
        <Badge tone={bookingStatusTones[b.status] ?? "neutral"} size="lg">
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
                tone="primary"
                size="sm"
                leftSection={<IconCheck size={14} />}
                loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ status: "confirmed" })}
              >
                Confirm
              </Button>
              <Button
                tone="subtle-danger"
                size="sm"
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
                tone="primary"
                size="sm"
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
                tone="secondary"
                size="sm"
                leftSection={<IconClock size={14} />}
                onClick={() => openStatusReasonEditor("postpone")}
              >
                Postpone
              </Button>
              <Button
                tone="subtle-danger"
                size="sm"
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
                tone="primary"
                size="sm"
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
                tone="subtle-danger"
                size="sm"
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
                  tone={reasonAction === "cancel" ? "danger" : "primary"}
                  type="submit"
                  size="sm"
                  loading={statusMutation.isPending}
                >
                  Confirm {reasonAction === "cancel" ? "Cancellation" : "Postpone"}
                </Button>
                <Button tone="ghost" size="sm" onClick={closeStatusReasonEditor}>
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

// ── OT handoff cards (pre-op send-off + post-op handoff) ──

const PREOP_HANDOFF_TEMPLATE: OtHandoffItem[] = [
  { key: "consent_verified", label: "Informed consent signed and verified", checked: false },
  { key: "id_band", label: "Patient ID band present and correct", checked: false },
  { key: "npo_confirmed", label: "Fasting / NPO status confirmed", checked: false },
  { key: "site_marked", label: "Surgical site marked (or not applicable)", checked: false },
  { key: "allergies_checked", label: "Allergies reviewed and band applied", checked: false },
  {
    key: "prosthetics_removed",
    label: "Dentures, lenses, jewellery and prosthetics removed",
    checked: false,
  },
  { key: "preop_meds_given", label: "Pre-op medication given as ordered", checked: false },
  { key: "valuables_secured", label: "Valuables handed to relatives / secured", checked: false },
  {
    key: "records_available",
    label: "Case notes, imaging and investigations available",
    checked: false,
  },
  {
    key: "blood_arranged",
    label: "Blood arranged if required (or not applicable)",
    checked: false,
  },
];

const POSTOP_HANDOFF_TEMPLATE: OtHandoffItem[] = [
  { key: "airway_patent", label: "Airway patent — extubated or secured", checked: false },
  { key: "vitals_stable", label: "Vital signs stable and documented", checked: false },
  { key: "pain_assessed", label: "Pain assessed and controlled", checked: false },
  { key: "ponv_assessed", label: "Nausea / vomiting assessed", checked: false },
  { key: "dressing_intact", label: "Surgical dressing dry and intact", checked: false },
  { key: "drains_lines", label: "Drains, catheters and IV lines documented", checked: false },
  { key: "bleeding_output", label: "Bleeding / drain output assessed", checked: false },
  { key: "aldrete_recorded", label: "Aldrete score recorded", checked: false },
  { key: "postop_orders", label: "Post-op orders and analgesia handed over", checked: false },
  {
    key: "belongings_notes",
    label: "Patient belongings and case notes accompany patient",
    checked: false,
  },
];

interface HandoffLike {
  items: OtHandoffItem[];
  completed: boolean;
  completed_at: string | null;
}

interface OtHandoffCardProps {
  bookingId: string;
  title: string;
  template: OtHandoffItem[];
  queryKey: string;
  canEdit: boolean;
  receiverLabel: string;
  confirmLabel: string;
  doneMessage: string;
  fetchHandoff: (bookingId: string) => Promise<HandoffLike | null>;
  upsertHandoff: (bookingId: string, data: UpsertPreopHandoffInput) => Promise<HandoffLike>;
}

function OtHandoffCard({
  bookingId,
  title,
  template,
  queryKey,
  canEdit,
  receiverLabel,
  confirmLabel,
  doneMessage,
  fetchHandoff,
  upsertHandoff,
}: OtHandoffCardProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<OtHandoffItem[]>(template);
  const [receivedBy, setReceivedBy] = useState<string | null>(null);

  const { data: handoff } = useQuery({
    queryKey: [queryKey, bookingId],
    queryFn: () => fetchHandoff(bookingId),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
    staleTime: 300_000,
    enabled: canEdit,
  });

  const stored = handoff?.items;
  const effectiveItems = stored && stored.length > 0 ? stored : items;
  const completed = handoff?.completed ?? false;
  const allChecked = effectiveItems.every((i) => i.checked);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: [queryKey, bookingId] });

  const save = useMutation({
    mutationFn: (next: OtHandoffItem[]) => upsertHandoff(bookingId, { items: next }),
    onSuccess: invalidate,
    onError: () => toast.error("Failed to save handoff", { title: "Error" }),
  });
  const confirm = useMutation({
    mutationFn: () =>
      upsertHandoff(bookingId, {
        items: effectiveItems,
        received_by: receivedBy ?? undefined,
        completed: true,
      }),
    onSuccess: () => {
      invalidate();
      toast.success(doneMessage, { title: "Handoff complete" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Cannot confirm" }),
  });

  const toggle = (key: string) => {
    const next = effectiveItems.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i));
    setItems(next);
    save.mutate(next);
  };

  return (
    <Card withBorder padding="sm">
      <Group justify="space-between">
        <Text fw={600}>{title}</Text>
        <Badge tone={completed ? "success" : "warning"} size="sm">
          {completed ? "Handed off" : "Pending"}
        </Badge>
      </Group>
      {completed && handoff?.completed_at && (
        <Text size="xs" c="dimmed" mt={4}>
          Handed off at {new Date(handoff.completed_at).toLocaleString()}
        </Text>
      )}
      <Stack gap="xs" mt="xs">
        {effectiveItems.map((item) => (
          <Checkbox
            key={item.key}
            label={item.label}
            checked={item.checked}
            disabled={!canEdit || completed}
            onChange={() => toggle(item.key)}
            size="xs"
          />
        ))}
        {canEdit && !completed && (
          <>
            <Select
              label={receiverLabel}
              placeholder="Select staff"
              data={(users as SetupUser[]).map((u) => ({ value: u.id, label: u.full_name }))}
              value={receivedBy}
              onChange={setReceivedBy}
              searchable
              size="xs"
            />
            <Button
              tone="primary"
              size="xs"
              disabled={!allChecked || !receivedBy}
              loading={confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              {allChecked ? confirmLabel : "Check all items to confirm"}
            </Button>
          </>
        )}
      </Stack>
    </Card>
  );
}

function PreopHandoffCard({ bookingId }: { bookingId: string }) {
  const canEdit = useHasPermission(P.OT.PREOP_CREATE);
  return (
    <OtHandoffCard
      bookingId={bookingId}
      title="Ward → OT send-off"
      template={PREOP_HANDOFF_TEMPLATE}
      queryKey="ot-preop-handoff"
      canEdit={canEdit}
      receiverLabel="Received by (OT nurse)"
      confirmLabel="Confirm send-off to OT"
      doneMessage="Patient handed off to OT"
      fetchHandoff={(id) => otService.getPreopHandoff(id)}
      upsertHandoff={(id, data) => otService.upsertPreopHandoff(id, data)}
    />
  );
}

function PostopHandoffCard({ bookingId }: { bookingId: string }) {
  const canEdit = useHasPermission(P.OT.POSTOP_CREATE);
  return (
    <OtHandoffCard
      bookingId={bookingId}
      title="OT → PACU / ward handoff"
      template={POSTOP_HANDOFF_TEMPLATE}
      queryKey="ot-postop-handoff"
      canEdit={canEdit}
      receiverLabel="Received by (PACU / ward nurse)"
      confirmLabel="Confirm handoff"
      doneMessage="Patient handed off from OT"
      fetchHandoff={(id) => otService.getPostopHandoff(id)}
      upsertHandoff={(id, data) => otService.upsertPostopHandoff(id, data)}
    />
  );
}

// ── Pre-Op Sub-Tab ────────────────────────────────────

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

interface WhoChecklistItem {
  key: string;
  label: string;
  checked: boolean;
}

function readChecklistItems(checklist: OtSurgicalSafetyChecklist): WhoChecklistItem[] {
  return Array.isArray(checklist.items) ? (checklist.items as WhoChecklistItem[]) : [];
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
      toast.success("Checklist phase started", { title: "Created" });
    },
    onError: () => toast.error("Failed to create checklist", { title: "Error" }),
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
                <Badge tone="success" size="sm">
                  Completed
                </Badge>
              )}
              {checklist && !completed && (
                <Badge tone="warning" size="sm">
                  In Progress
                </Badge>
              )}
              {!checklist && (
                <Badge tone="neutral" size="sm">
                  Not Started
                </Badge>
              )}
            </Group>

            {checklist && (
              <PhaseChecklistBody
                bookingId={bookingId}
                checklist={checklist}
                canEdit={canCreate && !completed}
              />
            )}

            {checklist?.completed_at && (
              <Text size="xs" c="dimmed" mt={4}>
                Completed at: {new Date(checklist.completed_at).toLocaleString()}
              </Text>
            )}

            {canCreate && !checklist && (
              <Button
                tone="secondary"
                size="xs"
                mt="xs"
                disabled={blocked}
                loading={createMutation.isPending}
                onClick={() => createMutation.mutate({ phase, items: [] })}
              >
                {blocked
                  ? `Complete ${previousPhase ? phaseLabels[previousPhase] : "previous phase"} first`
                  : `Start ${phaseLabels[phase]}`}
              </Button>
            )}
          </Card>
        );
      })}
    </Stack>
  );
}

function PhaseChecklistBody({
  bookingId,
  checklist,
  canEdit,
}: {
  bookingId: string;
  checklist: OtSurgicalSafetyChecklist;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<WhoChecklistItem[]>(() => readChecklistItems(checklist));

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["ot-checklists", bookingId] });

  const save = useMutation({
    mutationFn: (next: WhoChecklistItem[]) =>
      otService.updateSafetyChecklist(bookingId, checklist.id, { items: next }),
    onError: () => toast.error("Failed to save checklist", { title: "Error" }),
  });

  const complete = useMutation({
    mutationFn: () =>
      otService.updateSafetyChecklist(bookingId, checklist.id, { items, completed: true }),
    onSuccess: () => {
      invalidate();
      toast.success("Phase completed", { title: "Completed" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Cannot complete" }),
  });

  const toggle = (key: string) => {
    const next = items.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i));
    setItems(next);
    save.mutate(next);
  };

  const allChecked = items.length > 0 && items.every((i) => i.checked);

  return (
    <Stack gap="xs" mt="xs">
      {items.map((item) => (
        <Checkbox
          key={item.key}
          label={item.label}
          checked={item.checked}
          disabled={!canEdit}
          onChange={() => toggle(item.key)}
          size="xs"
        />
      ))}
      {canEdit && (
        <Button
          tone="primary"
          size="xs"
          mt="xs"
          disabled={!allChecked}
          loading={complete.isPending}
          onClick={() => complete.mutate()}
        >
          {allChecked ? "Mark Complete" : "Check all items to complete"}
        </Button>
      )}
    </Stack>
  );
}

// ── Case Record Sub-Tab ───────────────────────────────

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
    watch,
    formState: { errors },
  } = useForm<OtAnesthesiaRecordFormInput>({
    resolver: zodResolver(otAnesthesiaRecordFormSchema),
    defaultValues: DEFAULT_OT_ANESTHESIA_RECORD_FORM_VALUES,
  });
  const inductionTime = watch("induction_time");

  const createMutation = useMutation({
    mutationFn: (values: OtAnesthesiaRecordFormInput) =>
      otService.createAnesthesiaRecord(bookingId, toCreateAnesthesiaRecordRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-anesthesia", bookingId] });
      toast.success("Anesthesia record created", { title: "Saved" });
      reset(DEFAULT_OT_ANESTHESIA_RECORD_FORM_VALUES);
    },
    onError: (e: Error) =>
      toast.error(e.message || "Failed to save anesthesia record", { title: "Error" }),
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
      {inductionTime.trim() !== "" && (
        <Controller
          control={control}
          name="fasting_override_reason"
          render={({ field }) => (
            <Textarea
              label="Fasting override reason (emergency only)"
              description="Induction requires confirmed pre-op fasting (NPO). If fasting isn't confirmed, an emergency override reason is required — e.g. emergency RSI with aspiration precautions."
              placeholder="e.g. Emergency laparotomy — RSI with cricoid pressure, full-stomach precautions."
              {...field}
            />
          )}
        />
      )}
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
      <Button tone="primary" type="submit" loading={createMutation.isPending}>
        Save Anesthesia Record
      </Button>
    </Stack>
  );
}

// ── Post-Op / PACU Sub-Tab ────────────────────────────

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
        <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
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
      toast.success("OT room created", { title: "Created" });
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
        <Button tone="primary" type="submit" loading={mutation.isPending}>
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
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
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
      toast.success("Preference card saved", { title: "Created" });
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
            <DoctorSearchSelect
              label="Surgeon"
              required
              value={field.value}
              onChange={field.onChange}
              error={errors.surgeon_id?.message}
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
        <Button tone="primary" type="submit" loading={mutation.isPending}>
          Save
        </Button>
      </Stack>
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  OT Phase 2b — Consumables Sub-Tab
// ══════════════════════════════════════════════════════════

// OT consumables/implants are recorded through the shared
// PatientConsumablesPanel: picked from the store catalog, they decrement
// real stock and post a chargeable line. Scoped to this booking; when the
// surgery is tied to an admission the charge rolls up onto the
// consolidated discharge bill.
function ConsumablesSubTab({ booking }: { booking: OtBooking }) {
  return (
    <PatientConsumablesPanel
      patientId={booking.patient_id}
      encounterId={booking.id}
      admissionId={booking.admission_id ?? undefined}
    />
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
