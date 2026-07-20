import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { AmbulanceFleetFormInput, AmbulanceTripFormInput } from "@medbrains/schemas";
import { ambulanceFleetFormSchema, ambulanceTripFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AmbulanceDriverRow,
  AmbulanceRow,
  AmbulanceTripRow,
  AmbulanceTripStatus,
  CreateAmbulanceRequest,
  CreateAmbulanceTripRequest,
  UpdateAmbulanceRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAmbulance,
  IconChartBar,
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
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  ambulanceFuelTypeOptions,
  ambulanceOptionalInteger,
  ambulanceOptionalText,
  ambulanceTripPriorityOptions,
  ambulanceTripTypeOptions,
  ambulanceTypeOptions,
  normalizeAmbulanceFuelType,
} from "@/forms/ambulance.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { ambulanceService } from "@/services/ambulance.service";
import { DriversTab } from "./ambulance/drivers-tab";
import { MaintenanceTab } from "./ambulance/maintenance-tab";
import { ReportsTab } from "./ambulance/reports-tab";
import { isExpired, isExpiringSoon } from "./ambulance/shared";

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
    onError: (e: Error) =>
      notifications.show({ title: "Could not add ambulance", message: e.message, color: "red" }),
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
    onError: (e: Error) =>
      notifications.show({ title: "Could not update ambulance", message: e.message, color: "red" }),
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
    onError: (e: Error) =>
      notifications.show({ title: "Could not create trip", message: e.message, color: "red" }),
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
    onError: (e: Error) =>
      notifications.show({
        title: "Could not update trip status",
        message: e.message,
        color: "red",
      }),
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
