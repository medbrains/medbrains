import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import type {
  OtBookingFormInput,
  OtSurgeonPreferenceFormInput,
  OtUtilizationFilterFormInput,
} from "@medbrains/schemas";
import {
  otBookingFormSchema,
  otSurgeonPreferenceFormSchema,
  otUtilizationFilterFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { OtBooking, OtRoom, OtSurgeonPreference, RoomUtilization } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCalendar, IconChartBar, IconEye, IconPlus, IconScissors } from "@tabler/icons-react";
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
import { Alert, Badge, Button, IconButton, Table, toast } from "@/components/ui";
import {
  DEFAULT_OT_BOOKING_FORM_VALUES,
  DEFAULT_OT_SURGEON_PREFERENCE_FORM_VALUES,
  DEFAULT_OT_UTILIZATION_FILTER_FORM_VALUES,
  normalizeOtCasePriority,
  OT_CASE_PRIORITY_OPTIONS,
  toCreateOtBookingRequest,
  toCreateSurgeonPreferenceRequest,
  toOtUtilizationParams,
} from "@/forms/ot.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { otService } from "@/services/ot.service";
import { AnesthesiaTab } from "./ot/anesthesia-tab";
import { CaseRecordTab } from "./ot/case-record-tab";
import { ChecklistTab } from "./ot/checklist-tab";
import { PostopHandoffCard, PreopHandoffCard } from "./ot/handoff-cards";
import { OverviewTab } from "./ot/overview-tab";
import { PostopTab } from "./ot/postop-tab";
import { PreopTab } from "./ot/preop-tab";
import { RoomsTab } from "./ot/rooms-tab";

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

// ── Pre-Op Sub-Tab ────────────────────────────────────

// ── Case Record Sub-Tab ───────────────────────────────

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
