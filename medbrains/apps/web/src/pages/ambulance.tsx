import { zodResolver } from "@hookform/resolvers/zod";
import {
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
  AmbulanceDriverFormInput,
  AmbulanceFleetFormInput,
  AmbulanceMaintenanceFormInput,
  AmbulanceTripFormInput,
} from "@medbrains/schemas";
import {
  ambulanceDriverFormSchema,
  ambulanceFleetFormSchema,
  ambulanceMaintenanceFormSchema,
  ambulanceTripFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AmbulanceDriverRow,
  AmbulanceMaintenanceRow,
  AmbulanceMaintenanceStatus,
  AmbulanceRow,
  AmbulanceTripRow,
  AmbulanceTripStatus,
  CreateAmbulanceDriverRequest,
  CreateAmbulanceMaintenanceRequest,
  CreateAmbulanceRequest,
  CreateAmbulanceTripRequest,
  UpdateAmbulanceRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAmbulance,
  IconChartBar,
  IconCheck,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconRoute,
  IconTool,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  ambulanceFuelTypeOptions,
  ambulanceLicenseTypeOptions,
  ambulanceMaintenanceTypeOptions,
  ambulanceOptionalInteger,
  ambulanceOptionalNumber,
  ambulanceOptionalText,
  ambulanceShiftPatternOptions,
  ambulanceTripPriorityOptions,
  ambulanceTripTypeOptions,
  ambulanceTypeOptions,
  normalizeAmbulanceFuelType,
} from "@/forms/ambulance.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { ambulanceService } from "@/services/ambulance.service";

// ── Constants ───────────────────────────────────────────

const AMB_STATUS_COLORS: Record<string, BadgeTone> = {
  available: "success",
  on_trip: "info",
  maintenance: "warning",
  off_duty: "neutral",
  decommissioned: "danger",
};

const TRIP_TYPE_COLORS: Record<string, BadgeTone> = {
  emergency: "danger",
  scheduled: "info",
  inter_facility: "success",
  discharge: "success",
};

const PRIORITY_COLORS: Record<string, BadgeTone> = {
  critical: "danger",
  urgent: "warning",
  routine: "info",
};

const TRIP_STATUS_COLORS: Record<AmbulanceTripStatus, BadgeTone> = {
  requested: "neutral",
  dispatched: "info",
  en_route_pickup: "info",
  at_pickup: "success",
  en_route_drop: "accent",
  at_drop: "accent",
  completed: "success",
  cancelled: "danger",
};

const MAINT_STATUS_COLORS: Record<AmbulanceMaintenanceStatus, BadgeTone> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  overdue: "danger",
  cancelled: "neutral",
};

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

const emptyFleetForm: AmbulanceFleetFormInput = {
  vehicle_number: "",
  ambulance_type: "bls",
  make: "",
  model: "",
  year_of_manufacture: "",
  chassis_number: "",
  engine_number: "",
  fuel_type: "",
  has_ventilator: false,
  has_defibrillator: false,
  has_oxygen: true,
  gps_device_id: "",
  notes: "",
};

const emptyTripForm: AmbulanceTripFormInput = {
  trip_type: "emergency",
  priority: "routine",
  ambulance_id: "",
  driver_id: "",
  patient_name: "",
  patient_phone: "",
  pickup_address: "",
  drop_address: "",
};

const emptyDriverForm: AmbulanceDriverFormInput = {
  employee_id: "",
  license_number: "",
  license_type: "LMV",
  license_expiry: "",
  bls_certified: false,
  defensive_driving: false,
  shift_pattern: "",
  phone: "",
};

const emptyMaintenanceForm: AmbulanceMaintenanceFormInput = {
  ambulance_id: "",
  maintenance_type: "routine_service",
  scheduled_date: "",
  description: "",
  vendor_name: "",
  cost: "",
};

function toDateInputValue(value: string): Date | null {
  return value ? new Date(value) : null;
}

function toIsoDateInputValue(date: Date | string | null): string {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

function toFleetForm(row: AmbulanceRow): AmbulanceFleetFormInput {
  return {
    vehicle_number: row.vehicle_number,
    ambulance_type: row.ambulance_type,
    make: row.make ?? "",
    model: row.model ?? "",
    year_of_manufacture: row.year_of_manufacture ?? "",
    chassis_number: row.chassis_number ?? "",
    engine_number: row.engine_number ?? "",
    fuel_type: normalizeAmbulanceFuelType(row.fuel_type),
    has_ventilator: row.has_ventilator,
    has_defibrillator: row.has_defibrillator,
    has_oxygen: row.has_oxygen,
    gps_device_id: row.gps_device_id ?? "",
    notes: row.notes ?? "",
  };
}

// ── Fleet Tab ───────────────────────────────────────────

function FleetTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.AMBULANCE.FLEET_CREATE);
  const canUpdate = useHasPermission(P.AMBULANCE.FLEET_UPDATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<AmbulanceRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AmbulanceFleetFormInput>({
    resolver: zodResolver(ambulanceFleetFormSchema),
    defaultValues: emptyFleetForm,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulances", statusFilter],
    queryFn: () => ambulanceService.listAmbulances({ status: statusFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceRequest) => ambulanceService.createAmbulance(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulances"] });
      close();
      notifications.show({ title: "Ambulance added", message: "Fleet updated", color: "green" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAmbulanceRequest }) =>
      ambulanceService.updateAmbulance(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulances"] });
      close();
      setEditing(null);
      notifications.show({ title: "Updated", message: "Ambulance updated", color: "green" });
    },
  });

  const columns: Column<AmbulanceRow>[] = [
    {
      key: "ambulance_code",
      label: "Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.ambulance_code}
        </Text>
      ),
    },
    {
      key: "vehicle_number",
      label: "Vehicle #",
      render: (r) => <Text size="sm">{r.vehicle_number}</Text>,
    },
    {
      key: "ambulance_type",
      label: "Type",
      render: (r) => (
        <Badge size="sm" tone="neutral" variant="light">
          {r.ambulance_type.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" tone={AMB_STATUS_COLORS[r.status] ?? "neutral"}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "make",
      label: "Make/Model",
      render: (r) => <Text size="sm">{[r.make, r.model].filter(Boolean).join(" ") || "—"}</Text>,
    },
    {
      key: "certificates",
      label: "Certificates",
      render: (r) => {
        const certs = [
          { label: "Fitness", d: r.fitness_certificate_expiry },
          { label: "Insurance", d: r.insurance_expiry },
          { label: "PUC", d: r.pollution_certificate_expiry },
          { label: "Permit", d: r.permit_expiry },
        ];
        const issues = certs.filter((c) => isExpired(c.d) || isExpiringSoon(c.d));
        if (issues.length === 0)
          return (
            <Badge size="xs" tone="success">
              OK
            </Badge>
          );
        return (
          <Group gap={4}>
            {issues.map((c) => (
              <Tooltip
                key={c.label}
                label={`${c.label}: ${isExpired(c.d) ? "EXPIRED" : "Expiring soon"}`}
              >
                <Badge size="xs" tone={isExpired(c.d) ? "danger" : "warning"}>
                  {c.label}
                </Badge>
              </Tooltip>
            ))}
          </Group>
        );
      },
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate ? (
          <IconButton
            size="sm"
            onClick={() => {
              setEditing(r);
              reset(toFleetForm(r));
              open();
            }}
            aria-label="Edit"
          >
            <IconPencil size={14} />
          </IconButton>
        ) : null,
    },
  ];

  const submitFleet = (values: AmbulanceFleetFormInput) => {
    const payload: CreateAmbulanceRequest = {
      vehicle_number: values.vehicle_number.trim(),
      ambulance_type: values.ambulance_type,
      make: ambulanceOptionalText(values.make),
      model: ambulanceOptionalText(values.model),
      year_of_manufacture: ambulanceOptionalInteger(values.year_of_manufacture),
      chassis_number: ambulanceOptionalText(values.chassis_number),
      engine_number: ambulanceOptionalText(values.engine_number),
      fuel_type: values.fuel_type || undefined,
      has_ventilator: values.has_ventilator,
      has_defibrillator: values.has_defibrillator,
      has_oxygen: values.has_oxygen,
      gps_device_id: ambulanceOptionalText(values.gps_device_id),
      notes: ambulanceOptionalText(values.notes),
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={Object.keys(AMB_STATUS_COLORS).map((s) => ({
            value: s,
            label: s.replace(/_/g, " "),
          }))}
          w={200}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing(null);
              reset(emptyFleetForm);
              open();
            }}
          >
            Add Ambulance
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer
        opened={opened}
        onClose={() => {
          close();
          setEditing(null);
        }}
        title={editing ? "Edit Ambulance" : "Add Ambulance"}
        position="right"
        size="md"
      >
        <Stack component="form" onSubmit={handleSubmit(submitFleet)}>
          <Controller
            name="vehicle_number"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Vehicle Number"
                required
                {...field}
                error={errors.vehicle_number?.message}
              />
            )}
          />
          <Controller
            name="ambulance_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Type"
                required
                data={ambulanceTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "bls")}
                error={errors.ambulance_type?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              name="make"
              control={control}
              render={({ field }) => <TextInput label="Make" {...field} />}
            />
            <Controller
              name="model"
              control={control}
              render={({ field }) => <TextInput label="Model" {...field} />}
            />
          </Group>
          <Controller
            name="year_of_manufacture"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Year"
                value={field.value}
                onChange={field.onChange}
                error={errors.year_of_manufacture?.message}
              />
            )}
          />
          <Controller
            name="chassis_number"
            control={control}
            render={({ field }) => <TextInput label="Chassis #" {...field} />}
          />
          <Controller
            name="engine_number"
            control={control}
            render={({ field }) => <TextInput label="Engine #" {...field} />}
          />
          <Controller
            name="fuel_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Fuel Type"
                data={ambulanceFuelTypeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.fuel_type?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              name="has_ventilator"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Ventilator"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
            <Controller
              name="has_defibrillator"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Defibrillator"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
            <Controller
              name="has_oxygen"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Oxygen"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
          </Group>
          <Controller
            name="gps_device_id"
            control={control}
            render={({ field }) => <TextInput label="GPS Device ID" {...field} />}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending || updateMut.isPending}>
            {editing ? "Update" : "Create"}
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Trips Tab ───────────────────────────────────────────

function TripsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.AMBULANCE.TRIPS_CREATE);
  const canUpdate = useHasPermission(P.AMBULANCE.TRIPS_UPDATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AmbulanceTripFormInput>({
    resolver: zodResolver(ambulanceTripFormSchema),
    defaultValues: emptyTripForm,
  });

  const { data: ambulances = [] } = useQuery({
    queryKey: ["ambulances"],
    queryFn: () => ambulanceService.listAmbulances({ status: "available" }),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["ambulance-drivers-active"],
    queryFn: () => ambulanceService.listAmbulanceDrivers({ is_active: true }),
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulance-trips", statusFilter, typeFilter],
    queryFn: () =>
      ambulanceService.listAmbulanceTrips({
        status: statusFilter ?? undefined,
        trip_type: typeFilter ?? undefined,
      }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceTripRequest) => ambulanceService.createAmbulanceTrip(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulance-trips"] });
      void qc.invalidateQueries({ queryKey: ["ambulances"] });
      close();
      notifications.show({ title: "Trip created", message: "Trip booked", color: "green" });
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AmbulanceTripStatus }) =>
      ambulanceService.updateAmbulanceTripStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulance-trips"] });
      void qc.invalidateQueries({ queryKey: ["ambulances"] });
      notifications.show({
        title: "Status updated",
        message: "Trip status changed",
        color: "blue",
      });
    },
  });

  const getNextStatus = (current: AmbulanceTripStatus): AmbulanceTripStatus | null => {
    const flow: Partial<Record<AmbulanceTripStatus, AmbulanceTripStatus>> = {
      requested: "dispatched",
      dispatched: "en_route_pickup",
      en_route_pickup: "at_pickup",
      at_pickup: "en_route_drop",
      en_route_drop: "at_drop",
      at_drop: "completed",
    };
    return flow[current] ?? null;
  };

  const columns: Column<AmbulanceTripRow>[] = [
    {
      key: "trip_code",
      label: "Trip Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.trip_code}
        </Text>
      ),
    },
    {
      key: "trip_type",
      label: "Type",
      render: (r) => (
        <Badge size="sm" tone={TRIP_TYPE_COLORS[r.trip_type] ?? "neutral"}>
          {r.trip_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge size="sm" tone={PRIORITY_COLORS[r.priority] ?? "neutral"}>
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" tone={TRIP_STATUS_COLORS[r.status] ?? "neutral"}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "patient_name",
      label: "Patient",
      render: (r) => <Text size="sm">{r.patient_name ?? "—"}</Text>,
    },
    {
      key: "pickup_address",
      label: "Pickup",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.pickup_address}
        </Text>
      ),
    },
    {
      key: "drop_address",
      label: "Drop",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.drop_address ?? "—"}
        </Text>
      ),
    },
    {
      key: "response_time",
      label: "Response",
      render: (r) => {
        if (!r.dispatched_at || !r.pickup_arrived_at) return <Text size="sm">—</Text>;
        const mins = Math.round(
          (new Date(r.pickup_arrived_at).getTime() - new Date(r.dispatched_at).getTime()) / 60000,
        );
        return (
          <Badge size="sm" tone={mins <= 15 ? "success" : mins <= 30 ? "warning" : "danger"}>
            {mins}m
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        if (!canUpdate) return null;
        const next = getNextStatus(r.status);
        if (!next) return null;
        return (
          <Group gap={4}>
            <Tooltip label={next.replace(/_/g, " ")}>
              <IconButton
                tone="primary"
                size="sm"
                onClick={() => statusMut.mutate({ id: r.id, status: next })}
                aria-label="Play"
              >
                <IconPlayerPlay size={14} />
              </IconButton>
            </Tooltip>
            {r.status !== "completed" && r.status !== "cancelled" && (
              <Tooltip label="Cancel">
                <IconButton
                  tone="danger"
                  size="sm"
                  onClick={() => statusMut.mutate({ id: r.id, status: "cancelled" })}
                  aria-label="Cancel"
                >
                  <IconX size={14} />
                </IconButton>
              </Tooltip>
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <Select
            placeholder="Status"
            clearable
            value={statusFilter}
            onChange={setStatusFilter}
            data={Object.keys(TRIP_STATUS_COLORS).map((s) => ({
              value: s,
              label: s.replace(/_/g, " "),
            }))}
            w={180}
          />
          <Select
            placeholder="Type"
            clearable
            value={typeFilter}
            onChange={setTypeFilter}
            data={Object.keys(TRIP_TYPE_COLORS).map((s) => ({
              value: s,
              label: s.replace(/_/g, " "),
            }))}
            w={160}
          />
        </Group>
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(emptyTripForm);
              open();
            }}
          >
            New Trip
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer
        opened={opened}
        onClose={close}
        title="Book Ambulance Trip"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={handleSubmit((values) =>
            createMut.mutate({
              trip_type: values.trip_type,
              priority: values.priority,
              ambulance_id: ambulanceOptionalText(values.ambulance_id),
              driver_id: ambulanceOptionalText(values.driver_id),
              patient_name: ambulanceOptionalText(values.patient_name),
              patient_phone: ambulanceOptionalText(values.patient_phone),
              pickup_address: values.pickup_address.trim(),
              drop_address: ambulanceOptionalText(values.drop_address),
            }),
          )}
        >
          <Controller
            name="trip_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Trip Type"
                required
                data={ambulanceTripTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "emergency")}
                error={errors.trip_type?.message}
              />
            )}
          />
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select
                label="Priority"
                data={ambulanceTripPriorityOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "routine")}
                error={errors.priority?.message}
              />
            )}
          />
          <Controller
            name="ambulance_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Ambulance"
                clearable
                searchable
                data={ambulances.map((a: AmbulanceRow) => ({
                  value: a.id,
                  label: `${a.ambulance_code} (${a.ambulance_type.toUpperCase()})`,
                }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
              />
            )}
          />
          <Controller
            name="driver_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Driver"
                clearable
                searchable
                data={drivers.map((d: AmbulanceDriverRow) => ({
                  value: d.employee_id,
                  label: `${d.license_number} (${d.license_type})`,
                }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
              />
            )}
          />
          <Controller
            name="patient_name"
            control={control}
            render={({ field }) => <TextInput label="Patient Name" {...field} />}
          />
          <Controller
            name="patient_phone"
            control={control}
            render={({ field }) => (
              <TextInput label="Patient Phone" {...field} error={errors.patient_phone?.message} />
            )}
          />
          <Controller
            name="pickup_address"
            control={control}
            render={({ field }) => (
              <Textarea
                label="Pickup Address"
                required
                {...field}
                error={errors.pickup_address?.message}
              />
            )}
          />
          <Controller
            name="drop_address"
            control={control}
            render={({ field }) => <Textarea label="Drop Address" {...field} />}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Book Trip
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Drivers Tab ─────────────────────────────────────────

function DriversTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.AMBULANCE.DRIVERS_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AmbulanceDriverFormInput>({
    resolver: zodResolver(ambulanceDriverFormSchema),
    defaultValues: emptyDriverForm,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulance-drivers"],
    queryFn: () => ambulanceService.listAmbulanceDrivers(),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceDriverRequest) => ambulanceService.createAmbulanceDriver(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulance-drivers"] });
      close();
      notifications.show({ title: "Driver added", message: "Driver registered", color: "green" });
    },
  });

  const columns: Column<AmbulanceDriverRow>[] = [
    {
      key: "employee_id",
      label: "Employee ID",
      render: (r) => <Text size="sm">{r.employee_id.slice(0, 8)}</Text>,
    },
    {
      key: "license_number",
      label: "License #",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.license_number}
        </Text>
      ),
    },
    {
      key: "license_type",
      label: "Type",
      render: (r) => (
        <Badge size="sm" tone="neutral" variant="light">
          {r.license_type}
        </Badge>
      ),
    },
    {
      key: "license_expiry",
      label: "Expiry",
      render: (r) => {
        const exp = r.license_expiry;
        const tone: BadgeTone = isExpired(exp)
          ? "danger"
          : isExpiringSoon(exp)
            ? "warning"
            : "success";
        return (
          <Badge size="sm" tone={tone}>
            {exp}
          </Badge>
        );
      },
    },
    {
      key: "is_active",
      label: "Active",
      render: (r) => (
        <Badge size="sm" tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "bls_certified",
      label: "BLS",
      render: (r) =>
        r.bls_certified ? (
          <Badge size="sm" tone="success">
            Certified
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            No
          </Text>
        ),
    },
    {
      key: "shift_pattern",
      label: "Shift",
      render: (r) => <Text size="sm">{r.shift_pattern ?? "—"}</Text>,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(emptyDriverForm);
              open();
            }}
          >
            Add Driver
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Add Driver" position="right" size="xl">
        <Stack
          component="form"
          onSubmit={handleSubmit((values) =>
            createMut.mutate({
              employee_id: values.employee_id.trim(),
              license_number: values.license_number.trim(),
              license_type: values.license_type,
              license_expiry: values.license_expiry,
              bls_certified: values.bls_certified,
              defensive_driving: values.defensive_driving,
              shift_pattern: values.shift_pattern || undefined,
              phone: ambulanceOptionalText(values.phone),
            }),
          )}
        >
          <Controller
            name="employee_id"
            control={control}
            render={({ field }) => (
              <EmployeeSearchSelect
                label="Employee"
                required
                value={field.value}
                onChange={field.onChange}
                error={errors.employee_id?.message}
              />
            )}
          />
          <Controller
            name="license_number"
            control={control}
            render={({ field }) => (
              <TextInput
                label="License Number"
                required
                {...field}
                error={errors.license_number?.message}
              />
            )}
          />
          <Controller
            name="license_type"
            control={control}
            render={({ field }) => (
              <Select
                label="License Type"
                required
                data={ambulanceLicenseTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "LMV")}
                error={errors.license_type?.message}
              />
            )}
          />
          <Controller
            name="license_expiry"
            control={control}
            render={({ field }) => (
              <DateInput
                label="License Expiry"
                required
                value={toDateInputValue(field.value)}
                onChange={(date) => field.onChange(toIsoDateInputValue(date))}
                error={errors.license_expiry?.message}
              />
            )}
          />
          <Controller
            name="bls_certified"
            control={control}
            render={({ field }) => (
              <Switch
                label="BLS Certified"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            name="defensive_driving"
            control={control}
            render={({ field }) => (
              <Switch
                label="Defensive Driving Trained"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            name="shift_pattern"
            control={control}
            render={({ field }) => (
              <Select
                label="Shift Pattern"
                data={ambulanceShiftPatternOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.shift_pattern?.message}
              />
            )}
          />
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <TextInput label="Phone" {...field} error={errors.phone?.message} />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Add Driver
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Maintenance Tab ─────────────────────────────────────

function MaintenanceTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.AMBULANCE.MAINTENANCE_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AmbulanceMaintenanceFormInput>({
    resolver: zodResolver(ambulanceMaintenanceFormSchema),
    defaultValues: emptyMaintenanceForm,
  });

  const { data: ambulances = [] } = useQuery({
    queryKey: ["ambulances"],
    queryFn: () => ambulanceService.listAmbulances(),
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulance-maintenance", statusFilter],
    queryFn: () => ambulanceService.listAmbulanceMaintenance({ status: statusFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceMaintenanceRequest) =>
      ambulanceService.createAmbulanceMaintenance(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulance-maintenance"] });
      close();
      notifications.show({ title: "Scheduled", message: "Maintenance scheduled", color: "green" });
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AmbulanceMaintenanceStatus }) =>
      ambulanceService.updateAmbulanceMaintenanceStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulance-maintenance"] });
      notifications.show({ title: "Updated", message: "Maintenance updated", color: "blue" });
    },
  });

  const columns: Column<AmbulanceMaintenanceRow>[] = [
    {
      key: "ambulance_id",
      label: "Ambulance",
      render: (r) => {
        const a = ambulances.find((x: AmbulanceRow) => x.id === r.ambulance_id);
        return <Text size="sm">{a?.ambulance_code ?? r.ambulance_id.slice(0, 8)}</Text>;
      },
    },
    {
      key: "maintenance_type",
      label: "Type",
      render: (r) => (
        <Badge size="sm" tone="neutral" variant="light">
          {r.maintenance_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "scheduled_date",
      label: "Scheduled",
      render: (r) => <Text size="sm">{r.scheduled_date}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" tone={MAINT_STATUS_COLORS[r.status] ?? "neutral"}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "cost",
      label: "Cost",
      render: (r) => <Text size="sm">{r.cost != null ? `₹${r.cost}` : "—"}</Text>,
    },
    {
      key: "vendor_name",
      label: "Vendor",
      render: (r) => <Text size="sm">{r.vendor_name ?? "—"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        if (!canManage || r.status === "completed" || r.status === "cancelled") return null;
        const next = r.status === "scheduled" ? "in_progress" : "completed";
        return (
          <Group gap={4}>
            <Tooltip label={next === "in_progress" ? "Start" : "Complete"}>
              <IconButton
                tone="primary"
                size="sm"
                onClick={() => updateStatusMut.mutate({ id: r.id, status: next })}
                aria-label={next === "in_progress" ? "Start" : "Complete"}
              >
                {next === "in_progress" ? <IconPlayerPlay size={14} /> : <IconCheck size={14} />}
              </IconButton>
            </Tooltip>
          </Group>
        );
      },
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={Object.keys(MAINT_STATUS_COLORS).map((s) => ({
            value: s,
            label: s.replace(/_/g, " "),
          }))}
          w={200}
        />
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(emptyMaintenanceForm);
              open();
            }}
          >
            Schedule Maintenance
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer
        opened={opened}
        onClose={close}
        title="Schedule Maintenance"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={handleSubmit((values) =>
            createMut.mutate({
              ambulance_id: values.ambulance_id,
              maintenance_type: values.maintenance_type,
              scheduled_date: values.scheduled_date,
              description: ambulanceOptionalText(values.description),
              vendor_name: ambulanceOptionalText(values.vendor_name),
              cost: ambulanceOptionalNumber(values.cost),
            }),
          )}
        >
          <Controller
            name="ambulance_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Ambulance"
                required
                searchable
                data={ambulances.map((a: AmbulanceRow) => ({
                  value: a.id,
                  label: a.ambulance_code,
                }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.ambulance_id?.message}
              />
            )}
          />
          <Controller
            name="maintenance_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Type"
                required
                data={ambulanceMaintenanceTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "routine_service")}
                error={errors.maintenance_type?.message}
              />
            )}
          />
          <Controller
            name="scheduled_date"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Scheduled Date"
                required
                value={toDateInputValue(field.value)}
                onChange={(date) => field.onChange(toIsoDateInputValue(date))}
                error={errors.scheduled_date?.message}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => <Textarea label="Description" {...field} />}
          />
          <Controller
            name="vendor_name"
            control={control}
            render={({ field }) => <TextInput label="Vendor" {...field} />}
          />
          <Controller
            name="cost"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Estimated Cost"
                prefix="₹"
                value={field.value}
                onChange={field.onChange}
                error={errors.cost?.message}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Schedule
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Reports Tab ─────────────────────────────────────────

function ReportsTab() {
  const { data: trips = [] } = useQuery({
    queryKey: ["ambulance-trips"],
    queryFn: () => ambulanceService.listAmbulanceTrips(),
  });

  const { data: ambulances = [] } = useQuery({
    queryKey: ["ambulances"],
    queryFn: () => ambulanceService.listAmbulances(),
  });

  const today = new Date().toISOString().split("T")[0] ?? "";
  const tripsToday = trips.filter((t) => t.requested_at.startsWith(today));
  const activeTrips = trips.filter((t) => !["completed", "cancelled"].includes(t.status));
  const completedTrips = trips.filter(
    (t) => t.status === "completed" && t.dispatched_at && t.pickup_arrived_at,
  );
  const avgResponseMin =
    completedTrips.length > 0
      ? Math.round(
          completedTrips.reduce((sum, trip) => {
            if (!trip.pickup_arrived_at || !trip.dispatched_at) return sum;
            return (
              sum +
              (new Date(trip.pickup_arrived_at).getTime() -
                new Date(trip.dispatched_at).getTime()) /
                60000
            );
          }, 0) / completedTrips.length,
        )
      : 0;
  const fleetUtil =
    ambulances.length > 0
      ? Math.round(
          (ambulances.filter((a) => a.status === "on_trip").length /
            ambulances.filter((a) => a.status !== "decommissioned").length) *
            100,
        )
      : 0;

  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Trips Today
          </Text>
          <Text size="xl" fw={700}>
            {tripsToday.length}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Active Trips
          </Text>
          <Text size="xl" fw={700} c="blue">
            {activeTrips.length}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Avg Response Time
          </Text>
          <Text size="xl" fw={700} c={avgResponseMin <= 15 ? "green" : "orange"}>
            {avgResponseMin}m
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Fleet Utilization
          </Text>
          <Text size="xl" fw={700}>
            {fleetUtil}%
          </Text>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

// ── Main Page ───────────────────────────────────────────

export function AmbulancePage() {
  useRequirePermission(P.AMBULANCE.FLEET_LIST);
  const [activeTab, setActiveTab] = useState<string | null>("fleet");

  return (
    <div>
      <PageHeader
        title="Ambulance Fleet Management"
        subtitle="Fleet, trips, dispatch, drivers & maintenance"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="fleet" leftSection={<IconAmbulance size={16} />}>
            Fleet
          </Tabs.Tab>
          <Tabs.Tab value="trips" leftSection={<IconRoute size={16} />}>
            Trips & Dispatch
          </Tabs.Tab>
          <Tabs.Tab value="drivers" leftSection={<IconUsers size={16} />}>
            Drivers
          </Tabs.Tab>
          <Tabs.Tab value="maintenance" leftSection={<IconTool size={16} />}>
            Maintenance
          </Tabs.Tab>
          <Tabs.Tab value="reports" leftSection={<IconChartBar size={16} />}>
            Reports
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="fleet" pt="md">
          <FleetTab />
        </Tabs.Panel>
        <Tabs.Panel value="trips" pt="md">
          <TripsTab />
        </Tabs.Panel>
        <Tabs.Panel value="drivers" pt="md">
          <DriversTab />
        </Tabs.Panel>
        <Tabs.Panel value="maintenance" pt="md">
          <MaintenanceTab />
        </Tabs.Panel>
        <Tabs.Panel value="reports" pt="md">
          <ReportsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
