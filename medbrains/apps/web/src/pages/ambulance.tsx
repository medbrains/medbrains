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
  IconUsers,
  IconRoute,
  IconTool,
  IconChartBar,
  IconPencil,
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconAmbulance,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  AmbulanceRow,
  AmbulanceDriverRow,
  AmbulanceTripRow,
  AmbulanceMaintenanceRow,
  CreateAmbulanceRequest,
  CreateAmbulanceDriverRequest,
  CreateAmbulanceTripRequest,
  CreateAmbulanceMaintenanceRequest,
  AmbulanceType,
  AmbulanceTripType,
  AmbulanceTripPriority,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Constants ───────────────────────────────────────────

const AMB_TYPES: { value: AmbulanceType; label: string }[] = [
  { value: "bls", label: "BLS" },
  { value: "als", label: "ALS" },
  { value: "patient_transport", label: "Patient Transport" },
  { value: "mortuary", label: "Mortuary" },
  { value: "neonatal", label: "Neonatal" },
];

const AMB_STATUS_COLORS: Record<string, string> = {
  available: "green",
  on_trip: "blue",
  maintenance: "orange",
  off_duty: "gray",
  decommissioned: "red",
};

const TRIP_TYPE_COLORS: Record<string, string> = {
  emergency: "red",
  scheduled: "blue",
  inter_facility: "teal",
  discharge: "green",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "red",
  urgent: "orange",
  routine: "blue",
};

const TRIP_STATUS_COLORS: Record<string, string> = {
  requested: "gray",
  dispatched: "blue",
  en_route_pickup: "cyan",
  at_pickup: "teal",
  en_route_drop: "violet",
  at_drop: "violet",
  completed: "green",
  cancelled: "red",
};

const MAINT_STATUS_COLORS: Record<string, string> = {
  scheduled: "blue",
  in_progress: "orange",
  completed: "green",
  overdue: "red",
  cancelled: "gray",
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

// ── Fleet Tab ───────────────────────────────────────────

function FleetTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.AMBULANCE.FLEET_CREATE);
  const canUpdate = useHasPermission(P.AMBULANCE.FLEET_UPDATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<AmbulanceRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulances", statusFilter],
    queryFn: () => api.listAmbulances({ status: statusFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceRequest) => api.createAmbulance(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["ambulances"] }); close(); notifications.show({ title: "Ambulance added", message: "Fleet updated", color: "green" }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Record<string, unknown>) => api.updateAmbulance(id, d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["ambulances"] }); close(); setEditing(null); notifications.show({ title: "Updated", message: "Ambulance updated", color: "green" }); },
  });

  const columns: Column<AmbulanceRow>[] = [
    { key: "ambulance_code", label: "Code", render: (r) => <Text fw={600} size="sm">{r.ambulance_code}</Text> },
    { key: "vehicle_number", label: "Vehicle #", render: (r) => <Text size="sm">{r.vehicle_number}</Text> },
    { key: "ambulance_type", label: "Type", render: (r) => <Badge size="sm" variant="light">{r.ambulance_type.toUpperCase()}</Badge> },
    { key: "status", label: "Status", render: (r) => <Badge size="sm" color={AMB_STATUS_COLORS[r.status] ?? "gray"}>{r.status.replace(/_/g, " ")}</Badge> },
    { key: "make", label: "Make/Model", render: (r) => <Text size="sm">{[r.make, r.model].filter(Boolean).join(" ") || "—"}</Text> },
    {
      key: "certificates", label: "Certificates", render: (r) => {
        const certs = [
          { label: "Fitness", d: r.fitness_certificate_expiry },
          { label: "Insurance", d: r.insurance_expiry },
          { label: "PUC", d: r.pollution_certificate_expiry },
          { label: "Permit", d: r.permit_expiry },
        ];
        const issues = certs.filter((c) => isExpired(c.d) || isExpiringSoon(c.d));
        if (issues.length === 0) return <Badge size="xs" color="green">OK</Badge>;
        return (
          <Group gap={4}>
            {issues.map((c) => (
              <Tooltip key={c.label} label={`${c.label}: ${isExpired(c.d) ? "EXPIRED" : "Expiring soon"}`}>
                <Badge size="xs" color={isExpired(c.d) ? "red" : "orange"}>{c.label}</Badge>
              </Tooltip>
            ))}
          </Group>
        );
      },
    },
    {
      key: "actions", label: "", render: (r) => canUpdate ? (
        <ActionIcon variant="subtle" size="sm" onClick={() => { setEditing(r); setForm(r); open(); }} aria-label="Edit">
          <IconPencil size={14} />
        </ActionIcon>
      ) : null,
    },
  ];

  const handleSave = () => {
    if (editing) {
      updateMut.mutate({ id: editing.id, ...form });
    } else {
      if (!form.vehicle_number || !form.ambulance_type) return;
      createMut.mutate(form as CreateAmbulanceRequest);
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
          data={Object.keys(AMB_STATUS_COLORS).map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
          w={200}
        />
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(null); setForm({}); open(); }}>
            Add Ambulance
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={() => { close(); setEditing(null); }} title={editing ? "Edit Ambulance" : "Add Ambulance"} position="right" size="md">
        <Stack>
          <TextInput label="Vehicle Number" required value={form.vehicle_number ?? ""} onChange={(e) => setForm({ ...form, vehicle_number: e.currentTarget.value })} />
          <Select label="Type" required data={AMB_TYPES} value={form.ambulance_type ?? null} onChange={(v) => setForm({ ...form, ambulance_type: v as AmbulanceType })} />
          <Group grow>
            <TextInput label="Make" value={form.make ?? ""} onChange={(e) => setForm({ ...form, make: e.currentTarget.value })} />
            <TextInput label="Model" value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.currentTarget.value })} />
          </Group>
          <NumberInput label="Year" value={form.year_of_manufacture ?? ""} onChange={(v) => setForm({ ...form, year_of_manufacture: v as number })} />
          <TextInput label="Chassis #" value={form.chassis_number ?? ""} onChange={(e) => setForm({ ...form, chassis_number: e.currentTarget.value })} />
          <TextInput label="Engine #" value={form.engine_number ?? ""} onChange={(e) => setForm({ ...form, engine_number: e.currentTarget.value })} />
          <Select label="Fuel Type" data={["diesel", "petrol", "cng", "electric"]} value={(form as Record<string, unknown>).fuel_type as string ?? null} onChange={(v) => setForm({ ...form, fuel_type: v ?? undefined })} />
          <Group grow>
            <Switch label="Ventilator" checked={form.has_ventilator ?? false} onChange={(e) => setForm({ ...form, has_ventilator: e.currentTarget.checked })} />
            <Switch label="Defibrillator" checked={form.has_defibrillator ?? false} onChange={(e) => setForm({ ...form, has_defibrillator: e.currentTarget.checked })} />
            <Switch label="Oxygen" checked={form.has_oxygen ?? true} onChange={(e) => setForm({ ...form, has_oxygen: e.currentTarget.checked })} />
          </Group>
          <TextInput label="GPS Device ID" value={form.gps_device_id ?? ""} onChange={(e) => setForm({ ...form, gps_device_id: e.currentTarget.value })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Button onClick={handleSave} loading={createMut.isPending || updateMut.isPending}>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>({});

  const { data: ambulances = [] } = useQuery({
    queryKey: ["ambulances"],
    queryFn: () => api.listAmbulances({ status: "available" }),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["ambulance-drivers-active"],
    queryFn: () => api.listAmbulanceDrivers({ is_active: true }),
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulance-trips", statusFilter, typeFilter],
    queryFn: () => api.listAmbulanceTrips({ status: statusFilter ?? undefined, trip_type: typeFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceTripRequest) => api.createAmbulanceTrip(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["ambulance-trips"] }); void qc.invalidateQueries({ queryKey: ["ambulances"] }); close(); notifications.show({ title: "Trip created", message: "Trip booked", color: "green" }); },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateAmbulanceTripStatus(id, { status: status as AmbulanceTripRow["status"] }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["ambulance-trips"] }); void qc.invalidateQueries({ queryKey: ["ambulances"] }); notifications.show({ title: "Status updated", message: "Trip status changed", color: "blue" }); },
  });

  const getNextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
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
    { key: "trip_code", label: "Trip Code", render: (r) => <Text fw={600} size="sm">{r.trip_code}</Text> },
    { key: "trip_type", label: "Type", render: (r) => <Badge size="sm" color={TRIP_TYPE_COLORS[r.trip_type] ?? "gray"}>{r.trip_type.replace(/_/g, " ")}</Badge> },
    { key: "priority", label: "Priority", render: (r) => <Badge size="sm" color={PRIORITY_COLORS[r.priority] ?? "gray"}>{r.priority}</Badge> },
    { key: "status", label: "Status", render: (r) => <Badge size="sm" color={TRIP_STATUS_COLORS[r.status] ?? "gray"}>{r.status.replace(/_/g, " ")}</Badge> },
    { key: "patient_name", label: "Patient", render: (r) => <Text size="sm">{r.patient_name ?? "—"}</Text> },
    { key: "pickup_address", label: "Pickup", render: (r) => <Text size="sm" lineClamp={1}>{r.pickup_address}</Text> },
    { key: "drop_address", label: "Drop", render: (r) => <Text size="sm" lineClamp={1}>{r.drop_address ?? "—"}</Text> },
    {
      key: "response_time", label: "Response", render: (r) => {
        if (!r.dispatched_at || !r.pickup_arrived_at) return <Text size="sm">—</Text>;
        const mins = Math.round((new Date(r.pickup_arrived_at).getTime() - new Date(r.dispatched_at).getTime()) / 60000);
        return <Badge size="sm" color={mins <= 15 ? "green" : mins <= 30 ? "orange" : "red"}>{mins}m</Badge>;
      },
    },
    {
      key: "actions", label: "", render: (r) => {
        if (!canUpdate) return null;
        const next = getNextStatus(r.status);
        if (!next) return null;
        return (
          <Group gap={4}>
            <Tooltip label={next.replace(/_/g, " ")}>
              <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => statusMut.mutate({ id: r.id, status: next })} aria-label="Play">
                <IconPlayerPlay size={14} />
              </ActionIcon>
            </Tooltip>
            {r.status !== "completed" && r.status !== "cancelled" && (
              <Tooltip label="Cancel">
                <ActionIcon variant="subtle" color="red" size="sm" onClick={() => statusMut.mutate({ id: r.id, status: "cancelled" })} aria-label="Close">
                  <IconX size={14} />
                </ActionIcon>
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
          <Select placeholder="Status" clearable value={statusFilter} onChange={setStatusFilter} data={Object.keys(TRIP_STATUS_COLORS).map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} w={180} />
          <Select placeholder="Type" clearable value={typeFilter} onChange={setTypeFilter} data={Object.keys(TRIP_TYPE_COLORS).map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} w={160} />
        </Group>
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => { setForm({}); open(); }}>
            New Trip
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Book Ambulance Trip" position="right" size="md">
        <Stack>
          <Select label="Trip Type" required data={[{ value: "emergency", label: "Emergency" }, { value: "scheduled", label: "Scheduled" }, { value: "inter_facility", label: "Inter-Facility" }, { value: "discharge", label: "Discharge" }]} value={form.trip_type ?? null} onChange={(v) => setForm({ ...form, trip_type: v as AmbulanceTripType })} />
          <Select label="Priority" data={[{ value: "critical", label: "Critical" }, { value: "urgent", label: "Urgent" }, { value: "routine", label: "Routine" }]} value={form.priority ?? null} onChange={(v) => setForm({ ...form, priority: v as AmbulanceTripPriority })} />
          <Select label="Ambulance" clearable searchable data={ambulances.map((a: AmbulanceRow) => ({ value: a.id, label: `${a.ambulance_code} (${a.ambulance_type.toUpperCase()})` }))} value={(form.ambulance_id as string) ?? null} onChange={(v) => setForm({ ...form, ambulance_id: v ?? undefined })} />
          <Select label="Driver" clearable searchable data={drivers.map((d: AmbulanceDriverRow) => ({ value: d.employee_id, label: `${d.license_number} (${d.license_type})` }))} value={(form.driver_id as string) ?? null} onChange={(v) => setForm({ ...form, driver_id: v ?? undefined })} />
          <TextInput label="Patient Name" value={form.patient_name ?? ""} onChange={(e) => setForm({ ...form, patient_name: e.currentTarget.value })} />
          <TextInput label="Patient Phone" value={form.patient_phone ?? ""} onChange={(e) => setForm({ ...form, patient_phone: e.currentTarget.value })} />
          <Textarea label="Pickup Address" required value={form.pickup_address ?? ""} onChange={(e) => setForm({ ...form, pickup_address: e.currentTarget.value })} />
          <Textarea label="Drop Address" value={form.drop_address ?? ""} onChange={(e) => setForm({ ...form, drop_address: e.currentTarget.value })} />
          <Button onClick={() => { if (!form.trip_type || !form.pickup_address) return; createMut.mutate(form as CreateAmbulanceTripRequest); }} loading={createMut.isPending}>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulance-drivers"],
    queryFn: () => api.listAmbulanceDrivers(),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceDriverRequest) => api.createAmbulanceDriver(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["ambulance-drivers"] }); close(); notifications.show({ title: "Driver added", message: "Driver registered", color: "green" }); },
  });

  const columns: Column<AmbulanceDriverRow>[] = [
    { key: "employee_id", label: "Employee ID", render: (r) => <Text size="sm">{r.employee_id.slice(0, 8)}</Text> },
    { key: "license_number", label: "License #", render: (r) => <Text fw={600} size="sm">{r.license_number}</Text> },
    { key: "license_type", label: "Type", render: (r) => <Badge size="sm" variant="light">{r.license_type}</Badge> },
    {
      key: "license_expiry", label: "Expiry", render: (r) => {
        const exp = r.license_expiry;
        const color = isExpired(exp) ? "red" : isExpiringSoon(exp) ? "orange" : "green";
        return <Badge size="sm" color={color}>{exp}</Badge>;
      },
    },
    { key: "is_active", label: "Active", render: (r) => <Badge size="sm" color={r.is_active ? "green" : "gray"}>{r.is_active ? "Yes" : "No"}</Badge> },
    { key: "bls_certified", label: "BLS", render: (r) => r.bls_certified ? <Badge size="sm" color="teal">Certified</Badge> : <Text size="sm" c="dimmed">No</Text> },
    { key: "shift_pattern", label: "Shift", render: (r) => <Text size="sm">{r.shift_pattern ?? "—"}</Text> },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => { setForm({}); open(); }}>
            Add Driver
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Add Driver" position="right" size="md">
        <Stack>
          <TextInput label="Employee ID" required value={form.employee_id ?? ""} onChange={(e) => setForm({ ...form, employee_id: e.currentTarget.value })} />
          <TextInput label="License Number" required value={form.license_number ?? ""} onChange={(e) => setForm({ ...form, license_number: e.currentTarget.value })} />
          <Select label="License Type" required data={["HMV", "LMV", "HPMV"]} value={form.license_type ?? null} onChange={(v) => setForm({ ...form, license_type: v ?? "" })} />
          <DateInput label="License Expiry" required value={form.license_expiry ? new Date(form.license_expiry as string) : null} onChange={(d) => setForm({ ...form, license_expiry: d ? new Date(d as unknown as string).toISOString().split("T")[0] : undefined })} />
          <Switch label="BLS Certified" checked={form.bls_certified ?? false} onChange={(e) => setForm({ ...form, bls_certified: e.currentTarget.checked })} />
          <Switch label="Defensive Driving Trained" checked={form.defensive_driving ?? false} onChange={(e) => setForm({ ...form, defensive_driving: e.currentTarget.checked })} />
          <Select label="Shift Pattern" data={["day", "night", "rotating"]} value={form.shift_pattern ?? null} onChange={(v) => setForm({ ...form, shift_pattern: v ?? undefined })} />
          <TextInput label="Phone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })} />
          <Button onClick={() => { if (!form.employee_id || !form.license_number || !form.license_type || !form.license_expiry) return; createMut.mutate(form as CreateAmbulanceDriverRequest); }} loading={createMut.isPending}>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>({});

  const { data: ambulances = [] } = useQuery({
    queryKey: ["ambulances"],
    queryFn: () => api.listAmbulances(),
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulance-maintenance", statusFilter],
    queryFn: () => api.listAmbulanceMaintenance({ status: statusFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceMaintenanceRequest) => api.createAmbulanceMaintenance(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["ambulance-maintenance"] }); close(); notifications.show({ title: "Scheduled", message: "Maintenance scheduled", color: "green" }); },
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateAmbulanceMaintenance(id, { status: status as AmbulanceMaintenanceRow["status"] }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["ambulance-maintenance"] }); notifications.show({ title: "Updated", message: "Maintenance updated", color: "blue" }); },
  });

  const columns: Column<AmbulanceMaintenanceRow>[] = [
    { key: "ambulance_id", label: "Ambulance", render: (r) => { const a = ambulances.find((x: AmbulanceRow) => x.id === r.ambulance_id); return <Text size="sm">{a?.ambulance_code ?? r.ambulance_id.slice(0, 8)}</Text>; } },
    { key: "maintenance_type", label: "Type", render: (r) => <Badge size="sm" variant="light">{r.maintenance_type.replace(/_/g, " ")}</Badge> },
    { key: "scheduled_date", label: "Scheduled", render: (r) => <Text size="sm">{r.scheduled_date}</Text> },
    { key: "status", label: "Status", render: (r) => <Badge size="sm" color={MAINT_STATUS_COLORS[r.status] ?? "gray"}>{r.status.replace(/_/g, " ")}</Badge> },
    { key: "cost", label: "Cost", render: (r) => <Text size="sm">{r.cost != null ? `₹${r.cost}` : "—"}</Text> },
    { key: "vendor_name", label: "Vendor", render: (r) => <Text size="sm">{r.vendor_name ?? "—"}</Text> },
    {
      key: "actions", label: "", render: (r) => {
        if (!canManage || r.status === "completed" || r.status === "cancelled") return null;
        const next = r.status === "scheduled" ? "in_progress" : "completed";
        return (
          <Group gap={4}>
            <Tooltip label={next === "in_progress" ? "Start" : "Complete"}>
              <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => updateStatusMut.mutate({ id: r.id, status: next })}>
                {next === "in_progress" ? <IconPlayerPlay size={14} /> : <IconCheck size={14} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        );
      },
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select placeholder="Filter by status" clearable value={statusFilter} onChange={setStatusFilter} data={Object.keys(MAINT_STATUS_COLORS).map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} w={200} />
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => { setForm({}); open(); }}>
            Schedule Maintenance
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Schedule Maintenance" position="right" size="md">
        <Stack>
          <Select label="Ambulance" required searchable data={ambulances.map((a: AmbulanceRow) => ({ value: a.id, label: a.ambulance_code }))} value={(form.ambulance_id as string) ?? null} onChange={(v) => setForm({ ...form, ambulance_id: v ?? "" })} />
          <Select label="Type" required data={["routine_service", "repair", "inspection", "fitness_renewal", "insurance_renewal"]} value={form.maintenance_type ?? null} onChange={(v) => setForm({ ...form, maintenance_type: v ?? "" })} />
          <DateInput label="Scheduled Date" required value={form.scheduled_date ? new Date(form.scheduled_date as string) : null} onChange={(d) => setForm({ ...form, scheduled_date: d ? new Date(d as unknown as string).toISOString().split("T")[0] : undefined })} />
          <Textarea label="Description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <TextInput label="Vendor" value={form.vendor_name ?? ""} onChange={(e) => setForm({ ...form, vendor_name: e.currentTarget.value })} />
          <NumberInput label="Estimated Cost" prefix="₹" value={form.cost ?? ""} onChange={(v) => setForm({ ...form, cost: v as number })} />
          <Button onClick={() => { if (!form.ambulance_id || !form.maintenance_type || !form.scheduled_date) return; createMut.mutate(form as CreateAmbulanceMaintenanceRequest); }} loading={createMut.isPending}>
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
    queryFn: () => api.listAmbulanceTrips(),
  });

  const { data: ambulances = [] } = useQuery({
    queryKey: ["ambulances"],
    queryFn: () => api.listAmbulances(),
  });

  const today = new Date().toISOString().split("T")[0] ?? "";
  const tripsToday = trips.filter((t) => t.requested_at.startsWith(today));
  const activeTrips = trips.filter((t) => !["completed", "cancelled"].includes(t.status));
  const completedTrips = trips.filter((t) => t.status === "completed" && t.dispatched_at && t.pickup_arrived_at);
  const avgResponseMin = completedTrips.length > 0
    ? Math.round(completedTrips.reduce((sum, t) => sum + (new Date(t.pickup_arrived_at!).getTime() - new Date(t.dispatched_at!).getTime()) / 60000, 0) / completedTrips.length)
    : 0;
  const fleetUtil = ambulances.length > 0
    ? Math.round((ambulances.filter((a) => a.status === "on_trip").length / ambulances.filter((a) => a.status !== "decommissioned").length) * 100)
    : 0;

  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Card withBorder>
          <Text size="xs" c="dimmed">Trips Today</Text>
          <Text size="xl" fw={700}>{tripsToday.length}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Active Trips</Text>
          <Text size="xl" fw={700} c="blue">{activeTrips.length}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Avg Response Time</Text>
          <Text size="xl" fw={700} c={avgResponseMin <= 15 ? "green" : "orange"}>{avgResponseMin}m</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Fleet Utilization</Text>
          <Text size="xl" fw={700}>{fleetUtil}%</Text>
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
          <Tabs.Tab value="fleet" leftSection={<IconAmbulance size={16} />}>Fleet</Tabs.Tab>
          <Tabs.Tab value="trips" leftSection={<IconRoute size={16} />}>Trips & Dispatch</Tabs.Tab>
          <Tabs.Tab value="drivers" leftSection={<IconUsers size={16} />}>Drivers</Tabs.Tab>
          <Tabs.Tab value="maintenance" leftSection={<IconTool size={16} />}>Maintenance</Tabs.Tab>
          <Tabs.Tab value="reports" leftSection={<IconChartBar size={16} />}>Reports</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="fleet" pt="md"><FleetTab /></Tabs.Panel>
        <Tabs.Panel value="trips" pt="md"><TripsTab /></Tabs.Panel>
        <Tabs.Panel value="drivers" pt="md"><DriversTab /></Tabs.Panel>
        <Tabs.Panel value="maintenance" pt="md"><MaintenanceTab /></Tabs.Panel>
        <Tabs.Panel value="reports" pt="md"><ReportsTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
