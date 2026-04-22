import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
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
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconBuildingFactory2,
  IconCalendarRepeat,
  IconFlame,
  IconDroplet,
  IconBolt,
  IconTool,
  IconPencil,
} from "@tabler/icons-react";
import { BarChart } from "@mantine/charts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  FmsGasReading,
  FmsGasCompliance,
  FmsFireEquipment,
  FmsFireInspection,
  FmsFireDrill,
  FmsFireNoc,
  FmsWaterTest,
  FmsWaterSchedule,
  FmsEnergyReading,
  FmsWorkOrder,
  CreateFmsGasReadingRequest,
  CreateFmsGasComplianceRequest,
  CreateFmsFireEquipmentRequest,
  CreateFmsFireDrillRequest,
  CreateFmsWaterTestRequest,
  CreateFmsWaterScheduleRequest,
  CreateFmsEnergyReadingRequest,
  CreateFmsWorkOrderRequest,
  UpdateFmsWorkOrderStatusRequest,
  SchedulePmRequest,
  EnergyAnalytics as EnergyAnalyticsType,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Constants ──────────────────────────────────────────

const GAS_TYPES = [
  { value: "oxygen", label: "Oxygen" },
  { value: "nitrous_oxide", label: "Nitrous Oxide" },
  { value: "nitrogen", label: "Nitrogen" },
  { value: "medical_air", label: "Medical Air" },
  { value: "vacuum", label: "Vacuum" },
  { value: "co2", label: "CO2" },
  { value: "heliox", label: "Heliox" },
];

const GAS_SOURCE_TYPES = [
  { value: "psa_plant", label: "PSA Plant" },
  { value: "lmo_tank", label: "LMO Tank" },
  { value: "cylinder_manifold", label: "Cylinder Manifold" },
  { value: "pipeline", label: "Pipeline" },
];

const FIRE_EQUIPMENT_TYPES = [
  { value: "extinguisher_abc", label: "ABC Extinguisher" },
  { value: "extinguisher_co2", label: "CO2 Extinguisher" },
  { value: "extinguisher_water", label: "Water Extinguisher" },
  { value: "hydrant", label: "Hydrant" },
  { value: "hose_reel", label: "Hose Reel" },
  { value: "smoke_detector", label: "Smoke Detector" },
  { value: "heat_detector", label: "Heat Detector" },
  { value: "sprinkler", label: "Sprinkler" },
  { value: "fire_alarm_panel", label: "Fire Alarm Panel" },
  { value: "emergency_light", label: "Emergency Light" },
];

const DRILL_TYPES = [
  { value: "fire", label: "Fire" },
  { value: "code_red", label: "Code Red" },
  { value: "evacuation", label: "Evacuation" },
  { value: "chemical_spill", label: "Chemical Spill" },
  { value: "bomb_threat", label: "Bomb Threat" },
];

const WATER_SOURCE_TYPES = [
  { value: "municipal", label: "Municipal" },
  { value: "borewell", label: "Borewell" },
  { value: "tanker", label: "Tanker" },
  { value: "ro_plant", label: "RO Plant" },
  { value: "stp_recycled", label: "STP Recycled" },
];

const WATER_TEST_TYPES = [
  { value: "bacteriological", label: "Bacteriological" },
  { value: "chemical", label: "Chemical" },
  { value: "endotoxin", label: "Endotoxin" },
  { value: "conductivity", label: "Conductivity" },
];

const ENERGY_SOURCE_TYPES = [
  { value: "grid", label: "Grid" },
  { value: "dg_set", label: "DG Set" },
  { value: "ups", label: "UPS" },
  { value: "solar", label: "Solar" },
  { value: "inverter", label: "Inverter" },
];

const WO_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const WO_STATUSES = [
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const MAINTENANCE_CATEGORIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "civil", label: "Civil" },
  { value: "carpentry", label: "Carpentry" },
  { value: "painting", label: "Painting" },
  { value: "fire_safety", label: "Fire Safety" },
  { value: "elevator", label: "Elevator" },
  { value: "generator", label: "Generator/DG Set" },
  { value: "medical_gas", label: "Medical Gas" },
  { value: "water_treatment", label: "Water Treatment" },
  { value: "other", label: "Other" },
];

const SCHEDULE_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
];

const WATER_SCHEDULE_TYPES = [
  { value: "tank_cleaning", label: "Tank Cleaning" },
  { value: "legionella_testing", label: "Legionella Testing" },
  { value: "water_quality_test", label: "Water Quality Test" },
  { value: "stp_maintenance", label: "STP Maintenance" },
  { value: "ro_servicing", label: "RO Servicing" },
  { value: "filter_replacement", label: "Filter Replacement" },
  { value: "other", label: "Other" },
];

function priorityColor(p: string) {
  switch (p) {
    case "critical": return "danger";
    case "high": return "orange";
    case "medium": return "primary";
    default: return "gray";
  }
}

function woStatusColor(s: string) {
  switch (s) {
    case "open": return "primary";
    case "assigned": return "cyan";
    case "in_progress": return "warning";
    case "on_hold": return "orange";
    case "completed": return "success";
    case "cancelled": return "gray";
    default: return "gray";
  }
}

// ── Main Page ─────────────────────────────────────────

export function FacilitiesPage() {
  useRequirePermission(P.FACILITIES.GAS_LIST);
  const [tab, setTab] = useState<string | null>("mgps");

  return (
    <div>
      <PageHeader title="Facilities Management" subtitle="MGPS, Fire Safety, Water Quality, Energy, Work Orders" />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="mgps" leftSection={<IconBuildingFactory2 size={16} />}>MGPS</Tabs.Tab>
          <Tabs.Tab value="fire" leftSection={<IconFlame size={16} />}>Fire Safety</Tabs.Tab>
          <Tabs.Tab value="water" leftSection={<IconDroplet size={16} />}>Water Quality</Tabs.Tab>
          <Tabs.Tab value="energy" leftSection={<IconBolt size={16} />}>Energy</Tabs.Tab>
          <Tabs.Tab value="work-orders" leftSection={<IconTool size={16} />}>Work Orders</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="mgps" pt="md"><MgpsTab /></Tabs.Panel>
        <Tabs.Panel value="fire" pt="md"><FireSafetyTab /></Tabs.Panel>
        <Tabs.Panel value="water" pt="md"><WaterQualityTab /></Tabs.Panel>
        <Tabs.Panel value="energy" pt="md"><EnergyTab /></Tabs.Panel>
        <Tabs.Panel value="work-orders" pt="md"><WorkOrdersTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: MGPS (Medical Gas Pipeline System)
// ══════════════════════════════════════════════════════════

function MgpsTab() {
  const canManage = useHasPermission(P.FACILITIES.GAS_MANAGE);
  const canManageCompliance = useHasPermission(P.FACILITIES.COMPLIANCE_MANAGE);
  const [readingOpen, { open: openReading, close: closeReading }] = useDisclosure(false);
  const [complianceOpen, { open: openCompliance, close: closeCompliance }] = useDisclosure(false);
  const qc = useQueryClient();

  const readings = useQuery({ queryKey: ["fms-gas-readings"], queryFn: () => api.listFmsGasReadings() });
  const compliance = useQuery({ queryKey: ["fms-gas-compliance"], queryFn: () => api.listFmsGasCompliance() });

  const [gasForm, setGasForm] = useState<CreateFmsGasReadingRequest>({ gas_type: "oxygen", source_type: "pipeline" });
  const [compForm, setCompForm] = useState<CreateFmsGasComplianceRequest>({ gas_type: "oxygen" });

  const createReading = useMutation({
    mutationFn: () => api.createFmsGasReading(gasForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fms-gas-readings"] }); closeReading(); notifications.show({ title: "Success", message: "Gas reading recorded" }); },
  });
  const createCompliance = useMutation({
    mutationFn: () => api.createFmsGasCompliance(compForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fms-gas-compliance"] }); closeCompliance(); notifications.show({ title: "Success", message: "Compliance record created" }); },
  });

  const readingCols: Column<FmsGasReading>[] = [
    { key: "gas_type", label: "Gas", render: (r) => <Badge variant="light">{r.gas_type.replace(/_/g, " ")}</Badge> },
    { key: "source_type", label: "Source", render: (r) => <Text size="sm">{r.source_type.replace(/_/g, " ")}</Text> },
    { key: "purity_percent", label: "Purity %", render: (r) => <Text size="sm">{r.purity_percent ?? "—"}</Text> },
    { key: "pressure_bar", label: "Pressure (bar)", render: (r) => <Text size="sm">{r.pressure_bar ?? "—"}</Text> },
    { key: "flow_lpm", label: "Flow (LPM)", render: (r) => <Text size="sm">{r.flow_lpm ?? "—"}</Text> },
    { key: "tank_level_percent", label: "Tank %", render: (r) => <Text size="sm">{r.tank_level_percent ?? "—"}</Text> },
    { key: "is_alarm", label: "Alarm", render: (r) => r.is_alarm ? <Badge color="danger">ALARM</Badge> : <Badge color="success">OK</Badge> },
    { key: "reading_at", label: "Time", render: (r) => <Text size="sm">{new Date(r.reading_at).toLocaleString()}</Text> },
  ];

  const compCols: Column<FmsGasCompliance>[] = [
    { key: "gas_type", label: "Gas", render: (r) => <Badge variant="light">{r.gas_type.replace(/_/g, " ")}</Badge> },
    { key: "peso_license_number", label: "PESO License", render: (r) => <Text size="sm">{r.peso_license_number ?? "—"}</Text> },
    { key: "peso_valid_to", label: "PESO Valid To", render: (r) => <Text size="sm">{r.peso_valid_to ?? "—"}</Text> },
    { key: "drug_license_number", label: "Drug License", render: (r) => <Text size="sm">{r.drug_license_number ?? "—"}</Text> },
    { key: "compliance_status", label: "Status", render: (r) => <Badge color={r.compliance_status === "compliant" ? "success" : "danger"}>{r.compliance_status ?? "—"}</Badge> },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">Gas Readings</Text>
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openReading}>Record Reading</Button>}
      </Group>
      <DataTable columns={readingCols} data={readings.data ?? []} loading={readings.isLoading} rowKey={(r) => r.id} />

      <Group justify="space-between" mt="lg">
        <Text fw={600} size="lg">PESO / Drug License Compliance</Text>
        {canManageCompliance && <Button leftSection={<IconPlus size={16} />} onClick={openCompliance} variant="light">Add Compliance</Button>}
      </Group>
      <DataTable columns={compCols} data={compliance.data ?? []} loading={compliance.isLoading} rowKey={(r) => r.id} />

      <Drawer opened={readingOpen} onClose={closeReading} title="Record Gas Reading" position="right" size="md">
        <Stack>
          <Select label="Gas Type" data={GAS_TYPES} value={gasForm.gas_type} onChange={(v) => setGasForm({ ...gasForm, gas_type: v as CreateFmsGasReadingRequest["gas_type"] })} />
          <Select label="Source" data={GAS_SOURCE_TYPES} value={gasForm.source_type} onChange={(v) => setGasForm({ ...gasForm, source_type: v as CreateFmsGasReadingRequest["source_type"] })} />
          <NumberInput label="Purity %" value={gasForm.purity_percent ?? ""} onChange={(v) => setGasForm({ ...gasForm, purity_percent: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Pressure (bar)" value={gasForm.pressure_bar ?? ""} onChange={(v) => setGasForm({ ...gasForm, pressure_bar: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Flow (LPM)" value={gasForm.flow_lpm ?? ""} onChange={(v) => setGasForm({ ...gasForm, flow_lpm: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Tank Level %" value={gasForm.tank_level_percent ?? ""} onChange={(v) => setGasForm({ ...gasForm, tank_level_percent: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Cylinder Count" value={gasForm.cylinder_count ?? ""} onChange={(v) => setGasForm({ ...gasForm, cylinder_count: typeof v === "number" ? v : undefined })} />
          <Switch label="Alarm" checked={gasForm.is_alarm ?? false} onChange={(e) => setGasForm({ ...gasForm, is_alarm: e.currentTarget.checked })} />
          {gasForm.is_alarm && <TextInput label="Alarm Reason" value={gasForm.alarm_reason ?? ""} onChange={(e) => setGasForm({ ...gasForm, alarm_reason: e.currentTarget.value })} />}
          <Textarea label="Notes" value={gasForm.notes ?? ""} onChange={(e) => setGasForm({ ...gasForm, notes: e.currentTarget.value })} />
          <Button onClick={() => createReading.mutate()} loading={createReading.isPending}>Save</Button>
        </Stack>
      </Drawer>

      <Drawer opened={complianceOpen} onClose={closeCompliance} title="Add Gas Compliance" position="right" size="md">
        <Stack>
          <Select label="Gas Type" data={GAS_TYPES} value={compForm.gas_type} onChange={(v) => setCompForm({ ...compForm, gas_type: v as CreateFmsGasComplianceRequest["gas_type"] })} />
          <TextInput label="PESO License Number" value={compForm.peso_license_number ?? ""} onChange={(e) => setCompForm({ ...compForm, peso_license_number: e.currentTarget.value })} />
          <TextInput label="Drug License Number" value={compForm.drug_license_number ?? ""} onChange={(e) => setCompForm({ ...compForm, drug_license_number: e.currentTarget.value })} />
          <TextInput label="Inspector Name" value={compForm.inspector_name ?? ""} onChange={(e) => setCompForm({ ...compForm, inspector_name: e.currentTarget.value })} />
          <Textarea label="Notes" value={compForm.notes ?? ""} onChange={(e) => setCompForm({ ...compForm, notes: e.currentTarget.value })} />
          <Button onClick={() => createCompliance.mutate()} loading={createCompliance.isPending}>Save</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: Fire Safety
// ══════════════════════════════════════════════════════════

function FireSafetyTab() {
  const canManage = useHasPermission(P.FACILITIES.FIRE_MANAGE);
  const [equipOpen, { open: openEquip, close: closeEquip }] = useDisclosure(false);
  const [drillOpen, { open: openDrill, close: closeDrill }] = useDisclosure(false);
  const qc = useQueryClient();

  const equipment = useQuery({ queryKey: ["fms-fire-equipment"], queryFn: () => api.listFmsFireEquipment() });
  const inspections = useQuery({ queryKey: ["fms-fire-inspections"], queryFn: () => api.listFmsFireInspections() });
  const drills = useQuery({ queryKey: ["fms-fire-drills"], queryFn: () => api.listFmsFireDrills() });
  const nocs = useQuery({ queryKey: ["fms-fire-noc"], queryFn: () => api.listFmsFireNoc() });

  const [equipForm, setEquipForm] = useState<CreateFmsFireEquipmentRequest>({ name: "", equipment_type: "extinguisher_abc" });
  const [drillForm, setDrillForm] = useState<CreateFmsFireDrillRequest>({ drill_type: "fire", drill_date: new Date().toISOString().slice(0, 10) });

  const createEquip = useMutation({
    mutationFn: () => api.createFmsFireEquipment(equipForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fms-fire-equipment"] }); closeEquip(); notifications.show({ title: "Success", message: "Equipment added" }); },
  });
  const createDrill = useMutation({
    mutationFn: () => api.createFmsFireDrill(drillForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fms-fire-drills"] }); closeDrill(); notifications.show({ title: "Success", message: "Drill recorded" }); },
  });

  const equipCols: Column<FmsFireEquipment>[] = [
    { key: "name", label: "Name", render: (r) => <Text size="sm" fw={500}>{r.name}</Text> },
    { key: "equipment_type", label: "Type", render: (r) => <Badge variant="light">{r.equipment_type.replace(/_/g, " ")}</Badge> },
    { key: "serial_number", label: "Serial", render: (r) => <Text size="sm">{r.serial_number ?? "—"}</Text> },
    { key: "expiry_date", label: "Expiry", render: (r) => <Text size="sm" c={r.expiry_date && new Date(r.expiry_date) < new Date() ? "danger" : undefined}>{r.expiry_date ?? "—"}</Text> },
    { key: "is_active", label: "Active", render: (r) => <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Yes" : "No"}</Badge> },
  ];

  const inspCols: Column<FmsFireInspection>[] = [
    { key: "inspection_date", label: "Date", render: (r) => <Text size="sm">{r.inspection_date}</Text> },
    { key: "is_functional", label: "Functional", render: (r) => <Badge color={r.is_functional ? "success" : "danger"}>{r.is_functional ? "OK" : "Failed"}</Badge> },
    { key: "findings", label: "Findings", render: (r) => <Text size="sm" lineClamp={1}>{r.findings ?? "—"}</Text> },
    { key: "next_inspection_date", label: "Next Due", render: (r) => <Text size="sm">{r.next_inspection_date ?? "—"}</Text> },
  ];

  const drillCols: Column<FmsFireDrill>[] = [
    { key: "drill_type", label: "Type", render: (r) => <Badge variant="light" color="danger">{r.drill_type.replace(/_/g, " ")}</Badge> },
    { key: "drill_date", label: "Date", render: (r) => <Text size="sm">{r.drill_date}</Text> },
    { key: "duration_minutes", label: "Duration (min)", render: (r) => <Text size="sm">{r.duration_minutes ?? "—"}</Text> },
    { key: "participants_count", label: "Participants", render: (r) => <Text size="sm">{r.participants_count ?? "—"}</Text> },
    { key: "evacuation_time_seconds", label: "Evac Time (s)", render: (r) => <Text size="sm">{r.evacuation_time_seconds ?? "—"}</Text> },
    { key: "next_drill_due", label: "Next Due", render: (r) => <Text size="sm" c={r.next_drill_due && new Date(r.next_drill_due) < new Date() ? "danger" : undefined}>{r.next_drill_due ?? "—"}</Text> },
  ];

  const nocCols: Column<FmsFireNoc>[] = [
    { key: "noc_number", label: "NOC Number", render: (r) => <Text size="sm" fw={500}>{r.noc_number}</Text> },
    { key: "issuing_authority", label: "Authority", render: (r) => <Text size="sm">{r.issuing_authority ?? "—"}</Text> },
    { key: "valid_to", label: "Valid To", render: (r) => <Text size="sm" c={r.valid_to && new Date(r.valid_to) < new Date() ? "danger" : undefined}>{r.valid_to ?? "—"}</Text> },
    { key: "is_active", label: "Active", render: (r) => <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Yes" : "No"}</Badge> },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">Fire Equipment</Text>
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openEquip}>Add Equipment</Button>}
      </Group>
      <DataTable columns={equipCols} data={equipment.data ?? []} loading={equipment.isLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="lg">Inspections</Text>
      <DataTable columns={inspCols} data={inspections.data ?? []} loading={inspections.isLoading} rowKey={(r) => r.id} />

      <Group justify="space-between" mt="lg">
        <Text fw={600} size="lg">Mock Drills</Text>
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openDrill} variant="light" color="danger">Record Drill</Button>}
      </Group>
      <DataTable columns={drillCols} data={drills.data ?? []} loading={drills.isLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="lg">Fire NOC</Text>
      <DataTable columns={nocCols} data={nocs.data ?? []} loading={nocs.isLoading} rowKey={(r) => r.id} />

      <Drawer opened={equipOpen} onClose={closeEquip} title="Add Fire Equipment" position="right" size="md">
        <Stack>
          <TextInput label="Name" required value={equipForm.name} onChange={(e) => setEquipForm({ ...equipForm, name: e.currentTarget.value })} />
          <Select label="Type" data={FIRE_EQUIPMENT_TYPES} value={equipForm.equipment_type} onChange={(v) => setEquipForm({ ...equipForm, equipment_type: v as CreateFmsFireEquipmentRequest["equipment_type"] })} />
          <TextInput label="Serial Number" value={equipForm.serial_number ?? ""} onChange={(e) => setEquipForm({ ...equipForm, serial_number: e.currentTarget.value })} />
          <TextInput label="Make" value={equipForm.make ?? ""} onChange={(e) => setEquipForm({ ...equipForm, make: e.currentTarget.value })} />
          <TextInput label="Capacity" value={equipForm.capacity ?? ""} onChange={(e) => setEquipForm({ ...equipForm, capacity: e.currentTarget.value })} />
          <TextInput label="Barcode" value={equipForm.barcode_value ?? ""} onChange={(e) => setEquipForm({ ...equipForm, barcode_value: e.currentTarget.value })} />
          <Textarea label="Notes" value={equipForm.notes ?? ""} onChange={(e) => setEquipForm({ ...equipForm, notes: e.currentTarget.value })} />
          <Button onClick={() => createEquip.mutate()} loading={createEquip.isPending}>Save</Button>
        </Stack>
      </Drawer>

      <Drawer opened={drillOpen} onClose={closeDrill} title="Record Fire Drill" position="right" size="md">
        <Stack>
          <Select label="Type" data={DRILL_TYPES} value={drillForm.drill_type} onChange={(v) => setDrillForm({ ...drillForm, drill_type: v as CreateFmsFireDrillRequest["drill_type"] })} />
          <DateInput label="Drill Date" value={drillForm.drill_date ? new Date(drillForm.drill_date) : null} onChange={(v) => setDrillForm({ ...drillForm, drill_date: v ? new Date(v).toISOString().slice(0, 10) : "" })} />
          <NumberInput label="Duration (minutes)" value={drillForm.duration_minutes ?? ""} onChange={(v) => setDrillForm({ ...drillForm, duration_minutes: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Participants" value={drillForm.participants_count ?? ""} onChange={(v) => setDrillForm({ ...drillForm, participants_count: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Evacuation Time (seconds)" value={drillForm.evacuation_time_seconds ?? ""} onChange={(v) => setDrillForm({ ...drillForm, evacuation_time_seconds: typeof v === "number" ? v : undefined })} />
          <Textarea label="Scenario" value={drillForm.scenario_description ?? ""} onChange={(e) => setDrillForm({ ...drillForm, scenario_description: e.currentTarget.value })} />
          <Textarea label="Findings" value={drillForm.findings ?? ""} onChange={(e) => setDrillForm({ ...drillForm, findings: e.currentTarget.value })} />
          <Textarea label="Improvement Actions" value={drillForm.improvement_actions ?? ""} onChange={(e) => setDrillForm({ ...drillForm, improvement_actions: e.currentTarget.value })} />
          <Button onClick={() => createDrill.mutate()} loading={createDrill.isPending}>Save</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: Water Quality
// ══════════════════════════════════════════════════════════

function WaterQualityTab() {
  const canManage = useHasPermission(P.FACILITIES.WATER_MANAGE);
  const [testOpen, { open: openTest, close: closeTest }] = useDisclosure(false);
  const [schedOpen, { open: openSched, close: closeSched }] = useDisclosure(false);
  const qc = useQueryClient();

  const tests = useQuery({ queryKey: ["fms-water-tests"], queryFn: () => api.listFmsWaterTests() });
  const schedules = useQuery({ queryKey: ["fms-water-schedules"], queryFn: () => api.listFmsWaterSchedules() });

  const [testForm, setTestForm] = useState<CreateFmsWaterTestRequest>({ source_type: "municipal", test_type: "bacteriological", sample_date: new Date().toISOString().slice(0, 10), parameter_name: "" });
  const [schedForm, setSchedForm] = useState<CreateFmsWaterScheduleRequest>({ schedule_type: "", frequency: "" });

  const createTest = useMutation({
    mutationFn: () => api.createFmsWaterTest(testForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fms-water-tests"] }); closeTest(); notifications.show({ title: "Success", message: "Test result recorded" }); },
  });
  const createSched = useMutation({
    mutationFn: () => api.createFmsWaterSchedule(schedForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fms-water-schedules"] }); closeSched(); notifications.show({ title: "Success", message: "Schedule created" }); },
  });

  const testCols: Column<FmsWaterTest>[] = [
    { key: "source_type", label: "Source", render: (r) => <Badge variant="light">{r.source_type.replace(/_/g, " ")}</Badge> },
    { key: "test_type", label: "Test", render: (r) => <Text size="sm">{r.test_type}</Text> },
    { key: "parameter_name", label: "Parameter", render: (r) => <Text size="sm">{r.parameter_name}</Text> },
    { key: "result_value", label: "Result", render: (r) => <Text size="sm">{r.result_value ?? "—"} {r.unit ?? ""}</Text> },
    { key: "is_within_limits", label: "Status", render: (r) => r.is_within_limits === null || r.is_within_limits === undefined ? <Badge color="slate">Pending</Badge> : r.is_within_limits ? <Badge color="success">Pass</Badge> : <Badge color="danger">Fail</Badge> },
    { key: "sample_date", label: "Sampled", render: (r) => <Text size="sm">{r.sample_date}</Text> },
  ];

  const schedCols: Column<FmsWaterSchedule>[] = [
    { key: "schedule_type", label: "Type", render: (r) => <Text size="sm" fw={500}>{r.schedule_type}</Text> },
    { key: "frequency", label: "Frequency", render: (r) => <Text size="sm">{r.frequency}</Text> },
    { key: "last_completed_date", label: "Last Done", render: (r) => <Text size="sm">{r.last_completed_date ?? "—"}</Text> },
    { key: "next_due_date", label: "Next Due", render: (r) => <Text size="sm" c={r.next_due_date && new Date(r.next_due_date) < new Date() ? "danger" : undefined}>{r.next_due_date ?? "—"}</Text> },
    { key: "is_active", label: "Active", render: (r) => <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Yes" : "No"}</Badge> },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">Water Test Results</Text>
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openTest}>Record Test</Button>}
      </Group>
      <DataTable columns={testCols} data={tests.data ?? []} loading={tests.isLoading} rowKey={(r) => r.id} />

      <Group justify="space-between" mt="lg">
        <Text fw={600} size="lg">Cleaning / Testing Schedules</Text>
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openSched} variant="light">Add Schedule</Button>}
      </Group>
      <DataTable columns={schedCols} data={schedules.data ?? []} loading={schedules.isLoading} rowKey={(r) => r.id} />

      <Drawer opened={testOpen} onClose={closeTest} title="Record Water Test" position="right" size="md">
        <Stack>
          <Select label="Source" data={WATER_SOURCE_TYPES} value={testForm.source_type} onChange={(v) => setTestForm({ ...testForm, source_type: v as CreateFmsWaterTestRequest["source_type"] })} />
          <Select label="Test Type" data={WATER_TEST_TYPES} value={testForm.test_type} onChange={(v) => setTestForm({ ...testForm, test_type: v as CreateFmsWaterTestRequest["test_type"] })} />
          <TextInput label="Parameter" required value={testForm.parameter_name} onChange={(e) => setTestForm({ ...testForm, parameter_name: e.currentTarget.value })} />
          <NumberInput label="Result Value" value={testForm.result_value ?? ""} onChange={(v) => setTestForm({ ...testForm, result_value: typeof v === "number" ? v : undefined })} />
          <TextInput label="Unit" value={testForm.unit ?? ""} onChange={(e) => setTestForm({ ...testForm, unit: e.currentTarget.value })} />
          <NumberInput label="Min Acceptable" value={testForm.acceptable_min ?? ""} onChange={(v) => setTestForm({ ...testForm, acceptable_min: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Max Acceptable" value={testForm.acceptable_max ?? ""} onChange={(v) => setTestForm({ ...testForm, acceptable_max: typeof v === "number" ? v : undefined })} />
          <TextInput label="Lab Name" value={testForm.lab_name ?? ""} onChange={(e) => setTestForm({ ...testForm, lab_name: e.currentTarget.value })} />
          <Textarea label="Notes" value={testForm.notes ?? ""} onChange={(e) => setTestForm({ ...testForm, notes: e.currentTarget.value })} />
          <Button onClick={() => createTest.mutate()} loading={createTest.isPending}>Save</Button>
        </Stack>
      </Drawer>

      <Drawer opened={schedOpen} onClose={closeSched} title="Add Water Schedule" position="right" size="md">
        <Stack>
          <Select label="Schedule Type" required data={WATER_SCHEDULE_TYPES} value={schedForm.schedule_type || null} onChange={(v) => setSchedForm({ ...schedForm, schedule_type: v ?? "" })} searchable />
          <Select label="Frequency" required data={SCHEDULE_FREQUENCIES} value={schedForm.frequency || null} onChange={(v) => setSchedForm({ ...schedForm, frequency: v ?? "" })} searchable />
          <Textarea label="Notes" value={schedForm.notes ?? ""} onChange={(e) => setSchedForm({ ...schedForm, notes: e.currentTarget.value })} />
          <Button onClick={() => createSched.mutate()} loading={createSched.isPending}>Save</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: Energy
// ══════════════════════════════════════════════════════════

function EnergyTab() {
  const canManage = useHasPermission(P.FACILITIES.ENERGY_MANAGE);
  const [readingOpen, { open: openReading, close: closeReading }] = useDisclosure(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const qc = useQueryClient();

  const readings = useQuery({ queryKey: ["fms-energy-readings"], queryFn: () => api.listFmsEnergyReadings() });

  const [form, setForm] = useState<CreateFmsEnergyReadingRequest>({ source_type: "grid" });

  const createReading = useMutation({
    mutationFn: () => api.createFmsEnergyReading(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fms-energy-readings"] }); closeReading(); notifications.show({ title: "Success", message: "Reading recorded" }); },
  });

  const cols: Column<FmsEnergyReading>[] = [
    { key: "source_type", label: "Source", render: (r) => <Badge variant="light">{r.source_type.replace(/_/g, " ").toUpperCase()}</Badge> },
    { key: "equipment_name", label: "Equipment", render: (r) => <Text size="sm">{r.equipment_name ?? "—"}</Text> },
    { key: "voltage", label: "Voltage", render: (r) => <Text size="sm">{r.voltage ?? "—"}</Text> },
    { key: "power_kw", label: "Power (kW)", render: (r) => <Text size="sm">{r.power_kw ?? "—"}</Text> },
    { key: "load_percent", label: "Load %", render: (r) => <Text size="sm">{r.load_percent ?? "—"}</Text> },
    { key: "fuel_level_percent", label: "Fuel %", render: (r) => <Text size="sm">{r.fuel_level_percent ?? "—"}</Text> },
    { key: "battery_health_percent", label: "Battery %", render: (r) => <Text size="sm">{r.battery_health_percent ?? "—"}</Text> },
    { key: "is_alarm", label: "Alarm", render: (r) => r.is_alarm ? <Badge color="danger">ALARM</Badge> : <Badge color="success">OK</Badge> },
    { key: "reading_at", label: "Time", render: (r) => <Text size="sm">{new Date(r.reading_at).toLocaleString()}</Text> },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">Energy Readings</Text>
        <Group gap="xs">
          {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openReading}>Record Reading</Button>}
          <Button variant="light" onClick={() => setShowAnalytics(!showAnalytics)}>
            {showAnalytics ? "Hide Analytics" : "Show Analytics"}
          </Button>
        </Group>
      </Group>
      <DataTable columns={cols} data={readings.data ?? []} loading={readings.isLoading} rowKey={(r) => r.id} />

      {showAnalytics && <EnergyAnalyticsView />}

      <Drawer opened={readingOpen} onClose={closeReading} title="Record Energy Reading" position="right" size="md">
        <Stack>
          <Select label="Source" data={ENERGY_SOURCE_TYPES} value={form.source_type} onChange={(v) => setForm({ ...form, source_type: v as CreateFmsEnergyReadingRequest["source_type"] })} />
          <TextInput label="Equipment Name" value={form.equipment_name ?? ""} onChange={(e) => setForm({ ...form, equipment_name: e.currentTarget.value })} />
          <NumberInput label="Voltage" value={form.voltage ?? ""} onChange={(v) => setForm({ ...form, voltage: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Current (A)" value={form.current_amps ?? ""} onChange={(v) => setForm({ ...form, current_amps: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Power (kW)" value={form.power_kw ?? ""} onChange={(v) => setForm({ ...form, power_kw: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Load %" value={form.load_percent ?? ""} onChange={(v) => setForm({ ...form, load_percent: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Fuel %" value={form.fuel_level_percent ?? ""} onChange={(v) => setForm({ ...form, fuel_level_percent: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Runtime (hrs)" value={form.runtime_hours ?? ""} onChange={(v) => setForm({ ...form, runtime_hours: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Battery Voltage" value={form.battery_voltage ?? ""} onChange={(v) => setForm({ ...form, battery_voltage: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Battery Health %" value={form.battery_health_percent ?? ""} onChange={(v) => setForm({ ...form, battery_health_percent: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Backup (min)" value={form.backup_minutes ?? ""} onChange={(v) => setForm({ ...form, backup_minutes: typeof v === "number" ? v : undefined })} />
          <Switch label="Alarm" checked={form.is_alarm ?? false} onChange={(e) => setForm({ ...form, is_alarm: e.currentTarget.checked })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Button onClick={() => createReading.mutate()} loading={createReading.isPending}>Save</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Energy Analytics Sub-View ────────────────────────────

function EnergyAnalyticsView() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["energy-analytics", from, to],
    queryFn: () => api.energyAnalytics({ from: from || undefined, to: to || undefined }),
  });

  const analytics = data as EnergyAnalyticsType | undefined;

  const bySourceChart = analytics
    ? analytics.by_source.map((s) => ({
        source: s.source_type.replace(/_/g, " ").toUpperCase(),
        kWh: s.total_kwh,
        cost: s.total_cost,
      }))
    : [];

  return (
    <Card withBorder p="md" mt="md">
      <Stack>
        <Text fw={600} size="lg">Energy Analytics</Text>
        <Group>
          <TextInput placeholder="From date" type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} w={160} />
          <TextInput placeholder="To date" type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} w={160} />
        </Group>

        {isLoading && <Text size="sm" c="dimmed">Loading analytics...</Text>}

        {analytics && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Card withBorder p="sm">
                <Text fw={600} size="sm" mb="sm">Consumption by Source</Text>
                {bySourceChart.length > 0 ? (
                  <BarChart
                    h={200}
                    data={bySourceChart}
                    dataKey="source"
                    series={[
                      { name: "kWh", color: "warning" },
                      { name: "cost", color: "primary" },
                    ]}
                  />
                ) : (
                  <Text size="sm" c="dimmed">No data</Text>
                )}
              </Card>
              <Card withBorder p="sm">
                <Text fw={600} size="sm" mb="sm">Monthly Trend</Text>
                {analytics.monthly_trend.length > 0 ? (
                  <BarChart
                    h={200}
                    data={analytics.monthly_trend.map((m) => ({
                      month: m.month,
                      kWh: m.total_kwh,
                      cost: m.total_cost,
                    }))}
                    dataKey="month"
                    series={[
                      { name: "kWh", color: "orange" },
                      { name: "cost", color: "success" },
                    ]}
                  />
                ) : (
                  <Text size="sm" c="dimmed">No data</Text>
                )}
              </Card>
            </SimpleGrid>
          </>
        )}
      </Stack>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: Work Orders
// ══════════════════════════════════════════════════════════

function WorkOrdersTab() {
  const canCreate = useHasPermission(P.FACILITIES.WORK_ORDERS_CREATE);
  const canManage = useHasPermission(P.FACILITIES.WORK_ORDERS_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [statusOpen, { open: openStatus, close: closeStatus }] = useDisclosure(false);
  const [pmOpen, { open: openPm, close: closePm }] = useDisclosure(false);
  const [selectedWo, setSelectedWo] = useState<FmsWorkOrder | null>(null);
  const qc = useQueryClient();

  const orders = useQuery({ queryKey: ["fms-work-orders"], queryFn: () => api.listFmsWorkOrders() });

  const [form, setForm] = useState<CreateFmsWorkOrderRequest>({ description: "" });
  const [statusForm, setStatusForm] = useState<UpdateFmsWorkOrderStatusRequest>({ status: "assigned" });
  const [pmForm, setPmForm] = useState<SchedulePmRequest>({ frequency: "monthly", start_date: new Date().toISOString().slice(0, 10) });

  const createWo = useMutation({
    mutationFn: () => api.createFmsWorkOrder(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fms-work-orders"] }); closeCreate(); notifications.show({ title: "Success", message: "Work order created" }); },
  });
  const updateStatus = useMutation({
    mutationFn: () => {
      if (!selectedWo) return Promise.reject(new Error("No WO selected"));
      return api.updateFmsWorkOrderStatus(selectedWo.id, statusForm);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fms-work-orders"] }); closeStatus(); notifications.show({ title: "Success", message: "Status updated" }); },
  });
  const schedulePm = useMutation({
    mutationFn: () => api.schedulePm(pmForm),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["fms-work-orders"] });
      closePm();
      notifications.show({ title: "PM Scheduled", message: `${(res as { created: number }).created} work order(s) created` });
    },
  });

  const cols: Column<FmsWorkOrder>[] = [
    { key: "work_order_number", label: "WO #", render: (r) => <Text size="sm" fw={500}>{r.work_order_number}</Text> },
    { key: "category", label: "Category", render: (r) => <Text size="sm">{r.category ?? "—"}</Text> },
    { key: "priority", label: "Priority", render: (r) => <Badge color={priorityColor(r.priority)}>{r.priority}</Badge> },
    { key: "status", label: "Status", render: (r) => <Badge color={woStatusColor(r.status)}>{r.status.replace(/_/g, " ")}</Badge> },
    { key: "description", label: "Description", render: (r) => <Text size="sm" lineClamp={1}>{r.description}</Text> },
    { key: "total_cost", label: "Cost", render: (r) => <Text size="sm">{r.total_cost != null ? `${r.total_cost}` : "—"}</Text> },
    { key: "requested_at", label: "Requested", render: (r) => <Text size="sm">{new Date(r.requested_at).toLocaleDateString()}</Text> },
    { key: "actions", label: "", render: (r) => canManage && r.status !== "completed" && r.status !== "cancelled" ? (
      <Tooltip label="Update Status">
        <ActionIcon variant="subtle" onClick={() => { setSelectedWo(r); setStatusForm({ status: r.status === "open" ? "assigned" : "in_progress" }); openStatus(); }}>
          <IconPencil size={16} />
        </ActionIcon>
      </Tooltip>
    ) : null },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">Infrastructure Work Orders</Text>
        <Group gap="xs">
          {canManage && <Button variant="light" leftSection={<IconCalendarRepeat size={16} />} onClick={openPm}>Schedule PM</Button>}
          {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Create Work Order</Button>}
        </Group>
      </Group>
      <DataTable columns={cols} data={orders.data ?? []} loading={orders.isLoading} rowKey={(r) => r.id} />

      <Drawer opened={createOpen} onClose={closeCreate} title="Create Work Order" position="right" size="md">
        <Stack>
          <Select label="Category" data={MAINTENANCE_CATEGORIES} placeholder="Select category" value={form.category ?? null} onChange={(v) => setForm({ ...form, category: v || undefined })} clearable searchable />
          <Select label="Priority" data={WO_PRIORITIES} value={form.priority ?? "medium"} onChange={(v) => setForm({ ...form, priority: v ?? "medium" })} />
          <Textarea label="Description" required minRows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Button onClick={() => createWo.mutate()} loading={createWo.isPending}>Submit</Button>
        </Stack>
      </Drawer>

      <Drawer opened={statusOpen} onClose={closeStatus} title={`Update WO: ${selectedWo?.work_order_number ?? ""}`} position="right" size="md">
        <Stack>
          <Select label="Status" data={WO_STATUSES} value={statusForm.status} onChange={(v) => setStatusForm({ ...statusForm, status: (v ?? "assigned") as UpdateFmsWorkOrderStatusRequest["status"] })} />
          <Textarea label="Findings" value={statusForm.findings ?? ""} onChange={(e) => setStatusForm({ ...statusForm, findings: e.currentTarget.value })} />
          <Textarea label="Actions Taken" value={statusForm.actions_taken ?? ""} onChange={(e) => setStatusForm({ ...statusForm, actions_taken: e.currentTarget.value })} />
          <NumberInput label="Vendor Cost" value={statusForm.vendor_cost ?? ""} onChange={(v) => setStatusForm({ ...statusForm, vendor_cost: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Material Cost" value={statusForm.material_cost ?? ""} onChange={(v) => setStatusForm({ ...statusForm, material_cost: typeof v === "number" ? v : undefined })} />
          <NumberInput label="Labor Cost" value={statusForm.labor_cost ?? ""} onChange={(v) => setStatusForm({ ...statusForm, labor_cost: typeof v === "number" ? v : undefined })} />
          <Textarea label="Notes" value={statusForm.notes ?? ""} onChange={(e) => setStatusForm({ ...statusForm, notes: e.currentTarget.value })} />
          <Button onClick={() => updateStatus.mutate()} loading={updateStatus.isPending}>Update</Button>
        </Stack>
      </Drawer>

      <Drawer opened={pmOpen} onClose={closePm} title="Schedule Preventive Maintenance" position="right" size="md">
        <Stack>
          <TextInput label="Equipment IDs (comma-separated)" placeholder="e.g. id1, id2, id3" onChange={(e) => {
            const ids = e.currentTarget.value.split(",").map((s) => s.trim()).filter(Boolean);
            setPmForm({ ...pmForm, equipment_ids: ids.length > 0 ? ids : undefined });
          }} />
          <Select label="Frequency" data={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "biweekly", label: "Bi-Weekly" },
            { value: "monthly", label: "Monthly" },
            { value: "quarterly", label: "Quarterly" },
            { value: "semi_annual", label: "Semi-Annual" },
            { value: "annual", label: "Annual" },
          ]} value={pmForm.frequency} onChange={(v) => setPmForm({ ...pmForm, frequency: v ?? "monthly" })} />
          <TextInput label="Start Date" type="date" value={pmForm.start_date} onChange={(e) => setPmForm({ ...pmForm, start_date: e.currentTarget.value })} />
          <Button onClick={() => schedulePm.mutate()} loading={schedulePm.isPending} disabled={!pmForm.start_date || !pmForm.frequency}>Schedule</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
