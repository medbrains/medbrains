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
import { useDisclosure } from "@mantine/hooks";
import type { OtBookingFormInput } from "@medbrains/schemas";
import { otBookingFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { OtBooking, OtRoom } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconChartBar, IconEye, IconPlus, IconScissors } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import { DataTable, PageHeader, StatusDot } from "@/components";
import { PatientConsumablesPanel } from "@/components/Clinical";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { StationHandoffPanel } from "@/components/Handoff/StationHandoffPanel";
import { OtImplantRegisterPanel } from "@/components/Ot/OtImplantRegisterPanel";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, IconButton, toast } from "@/components/ui";
import {
  DEFAULT_OT_BOOKING_FORM_VALUES,
  normalizeOtCasePriority,
  OT_CASE_PRIORITY_OPTIONS,
  toCreateOtBookingRequest,
} from "@/forms/ot.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { otService } from "@/services/ot.service";
import { AnesthesiaTab } from "./ot/anesthesia-tab";
import { CaseRecordTab } from "./ot/case-record-tab";
import { ChecklistTab } from "./ot/checklist-tab";
import { PostopHandoffCard, PreopHandoffCard } from "./ot/handoff-cards";
import { OverviewTab } from "./ot/overview-tab";
import { PostopTab } from "./ot/postop-tab";
import { PreferencesTab } from "./ot/preferences-tab";
import { PreopTab } from "./ot/preop-tab";
import { OtReportsTab } from "./ot/reports-tab";
import { RoomsTab } from "./ot/rooms-tab";
import { ScheduleTab } from "./ot/schedule-tab";
import { bookingStatusColors, OtPatientCell } from "./ot/shared";

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
