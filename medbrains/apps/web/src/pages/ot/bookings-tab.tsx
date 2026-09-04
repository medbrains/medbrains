// OT BookingsTab — split from ot.tsx (pure move).

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
import { IconEye, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import { DataTable, StatusDot } from "@/components";
import { PatientConsumablesPanel } from "@/components/Clinical";
import { ConsentGateNotice } from "@/components/Consent/ConsentGateNotice";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { StationHandoffPanel } from "@/components/Handoff/StationHandoffPanel";
import { OtImplantRegisterPanel } from "@/components/Ot/OtImplantRegisterPanel";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { PrintDocumentButton } from "@/components/Print/PrintDocumentButton";
import { Alert, Badge, Button, IconButton, toast } from "@/components/ui";
import {
  DEFAULT_OT_BOOKING_FORM_VALUES,
  normalizeOtCasePriority,
  OT_CASE_PRIORITY_OPTIONS,
  toCreateOtBookingRequest,
} from "@/forms/ot.form";
import { useConsentGate } from "@/hooks/useConsentGate";
import { otService } from "@/services/ot.service";
import { AnesthesiaTab } from "./anesthesia-tab";
import { CaseRecordTab } from "./case-record-tab";
import { ChecklistTab } from "./checklist-tab";
import { PostopHandoffCard, PreopHandoffCard } from "./handoff-cards";
import { OverviewTab } from "./overview-tab";
import { PostopTab } from "./postop-tab";
import { PreopTab } from "./preop-tab";
import { bookingStatusColors, OtPatientCell } from "./shared";

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
  // Surgical consent, checked at the point the operation is booked rather than
  // discovered at the door of the theatre.
  const consentGate = useConsentGate({
    patientId: selectedPatientId,
    procedureType: "surgery",
    enabled: opened,
  });
  const [consentOverride, setConsentOverride] = useState(false);
  // A definite allow needs no acknowledgement. Deny and unknown both do, and
  // for different reasons the notice spells out; neither is treated as the
  // other, and neither blocks outright.
  const consentSettled =
    consentGate.outcome === "allow" || consentGate.outcome === "checking" || consentOverride;
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
        {selectedPatientId && (
          <ConsentGateNotice
            outcome={consentGate.outcome}
            procedureLabel="this operation"
            overrideAcknowledged={consentOverride}
            onOverrideChange={setConsentOverride}
            onRecheck={consentGate.recheck}
          />
        )}
        <Button
          tone="primary"
          type="submit"
          loading={mutation.isPending}
          disabled={!consentSettled}
        >
          Create Booking
        </Button>
      </Stack>
    </Drawer>
  );
}

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
          {/* Surgical and anaesthesia consent are booking-scoped: they name
              the operation, not the admission. Both had a print-data endpoint
              and no renderer. */}
          <Group gap="xs">
            <PrintDocumentButton documentKey="consent.surgical" recordId={bookingId} />
            <PrintDocumentButton documentKey="consent.anesthesia" recordId={bookingId} />
          </Group>
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

function ConsumablesSubTab({ booking }: { booking: OtBooking }) {
  return (
    <PatientConsumablesPanel
      patientId={booking.patient_id}
      encounterId={booking.id}
      admissionId={booking.admission_id ?? undefined}
    />
  );
}

export function BookingsTab({ canCreate, canList }: { canCreate: boolean; canList: boolean }) {
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
