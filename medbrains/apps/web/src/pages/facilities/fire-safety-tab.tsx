// IPD FireSafetyTab — split from facilities.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateFmsFireDrillRequest,
  CreateFmsFireEquipmentRequest,
  FmsFireDrill,
  FmsFireEquipment,
  FmsFireInspection,
  FmsFireNoc,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { facilitiesService } from "@/services/facilities.service";

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

export function FireSafetyTab() {
  const canManage = useHasPermission(P.FACILITIES.FIRE_MANAGE);
  const [equipOpen, { open: openEquip, close: closeEquip }] = useDisclosure(false);
  const [drillOpen, { open: openDrill, close: closeDrill }] = useDisclosure(false);
  const qc = useQueryClient();

  const equipment = useQuery({
    queryKey: ["fms-fire-equipment"],
    queryFn: () => facilitiesService.listFmsFireEquipment(),
  });
  const inspections = useQuery({
    queryKey: ["fms-fire-inspections"],
    queryFn: () => facilitiesService.listFmsFireInspections(),
  });
  const drills = useQuery({
    queryKey: ["fms-fire-drills"],
    queryFn: () => facilitiesService.listFmsFireDrills(),
  });
  const nocs = useQuery({
    queryKey: ["fms-fire-noc"],
    queryFn: () => facilitiesService.listFmsFireNoc(),
  });

  const [equipForm, setEquipForm] = useState<CreateFmsFireEquipmentRequest>({
    name: "",
    equipment_type: "extinguisher_abc",
  });
  const [drillForm, setDrillForm] = useState<CreateFmsFireDrillRequest>({
    drill_type: "fire",
    drill_date: new Date().toISOString().slice(0, 10),
  });

  const createEquip = useMutation({
    mutationFn: () => facilitiesService.createFmsFireEquipment(equipForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-fire-equipment"] });
      closeEquip();
      notifications.show({ title: "Success", message: "Equipment added" });
    },
  });
  const createDrill = useMutation({
    mutationFn: () => facilitiesService.createFmsFireDrill(drillForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-fire-drills"] });
      closeDrill();
      notifications.show({ title: "Success", message: "Drill recorded" });
    },
  });

  const equipCols: Column<FmsFireEquipment>[] = [
    {
      key: "name",
      label: "Name",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.name}
        </Text>
      ),
    },
    {
      key: "equipment_type",
      label: "Type",
      render: (r) => <Badge>{r.equipment_type.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "serial_number",
      label: "Serial",
      render: (r) => <Text size="sm">{r.serial_number ?? "—"}</Text>,
    },
    {
      key: "expiry_date",
      label: "Expiry",
      render: (r) => (
        <Text
          size="sm"
          c={r.expiry_date && new Date(r.expiry_date) < new Date() ? "danger" : undefined}
        >
          {r.expiry_date ?? "—"}
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
  ];

  const inspCols: Column<FmsFireInspection>[] = [
    {
      key: "inspection_date",
      label: "Date",
      render: (r) => <Text size="sm">{r.inspection_date}</Text>,
    },
    {
      key: "is_functional",
      label: "Functional",
      render: (r) => (
        <Badge tone={r.is_functional ? "success" : "danger"}>
          {r.is_functional ? "OK" : "Failed"}
        </Badge>
      ),
    },
    {
      key: "findings",
      label: "Findings",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.findings ?? "—"}
        </Text>
      ),
    },
    {
      key: "next_inspection_date",
      label: "Next Due",
      render: (r) => <Text size="sm">{r.next_inspection_date ?? "—"}</Text>,
    },
  ];

  const drillCols: Column<FmsFireDrill>[] = [
    {
      key: "drill_type",
      label: "Type",
      render: (r) => <Badge tone="danger">{r.drill_type.replace(/_/g, " ")}</Badge>,
    },
    { key: "drill_date", label: "Date", render: (r) => <Text size="sm">{r.drill_date}</Text> },
    {
      key: "duration_minutes",
      label: "Duration (min)",
      render: (r) => <Text size="sm">{r.duration_minutes ?? "—"}</Text>,
    },
    {
      key: "participants_count",
      label: "Participants",
      render: (r) => <Text size="sm">{r.participants_count ?? "—"}</Text>,
    },
    {
      key: "evacuation_time_seconds",
      label: "Evac Time (s)",
      render: (r) => <Text size="sm">{r.evacuation_time_seconds ?? "—"}</Text>,
    },
    {
      key: "next_drill_due",
      label: "Next Due",
      render: (r) => (
        <Text
          size="sm"
          c={r.next_drill_due && new Date(r.next_drill_due) < new Date() ? "danger" : undefined}
        >
          {r.next_drill_due ?? "—"}
        </Text>
      ),
    },
  ];

  const nocCols: Column<FmsFireNoc>[] = [
    {
      key: "noc_number",
      label: "NOC Number",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.noc_number}
        </Text>
      ),
    },
    {
      key: "issuing_authority",
      label: "Authority",
      render: (r) => <Text size="sm">{r.issuing_authority ?? "—"}</Text>,
    },
    {
      key: "valid_to",
      label: "Valid To",
      render: (r) => (
        <Text size="sm" c={r.valid_to && new Date(r.valid_to) < new Date() ? "danger" : undefined}>
          {r.valid_to ?? "—"}
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Fire Equipment
        </Text>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openEquip}>
            Add Equipment
          </Button>
        )}
      </Group>
      <DataTable
        columns={equipCols}
        data={equipment.data ?? []}
        loading={equipment.isLoading}
        rowKey={(r) => r.id}
      />

      <Text fw={600} size="lg" mt="lg">
        Inspections
      </Text>
      <DataTable
        columns={inspCols}
        data={inspections.data ?? []}
        loading={inspections.isLoading}
        rowKey={(r) => r.id}
      />

      <Group justify="space-between" mt="lg">
        <Text fw={600} size="lg">
          Mock Drills
        </Text>
        {canManage && (
          <Button tone="subtle-danger" leftSection={<IconPlus size={16} />} onClick={openDrill}>
            Record Drill
          </Button>
        )}
      </Group>
      <DataTable
        columns={drillCols}
        data={drills.data ?? []}
        loading={drills.isLoading}
        rowKey={(r) => r.id}
      />

      <Text fw={600} size="lg" mt="lg">
        Fire NOC
      </Text>
      <DataTable
        columns={nocCols}
        data={nocs.data ?? []}
        loading={nocs.isLoading}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={equipOpen}
        onClose={closeEquip}
        title="Add Fire Equipment"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Name"
            required
            value={equipForm.name}
            onChange={(e) => setEquipForm({ ...equipForm, name: e.currentTarget.value })}
          />
          <Select
            label="Type"
            data={FIRE_EQUIPMENT_TYPES}
            value={equipForm.equipment_type}
            onChange={(v) =>
              setEquipForm({
                ...equipForm,
                equipment_type: v as CreateFmsFireEquipmentRequest["equipment_type"],
              })
            }
          />
          <TextInput
            label="Serial Number"
            value={equipForm.serial_number ?? ""}
            onChange={(e) => setEquipForm({ ...equipForm, serial_number: e.currentTarget.value })}
          />
          <TextInput
            label="Make"
            value={equipForm.make ?? ""}
            onChange={(e) => setEquipForm({ ...equipForm, make: e.currentTarget.value })}
          />
          <TextInput
            label="Capacity"
            value={equipForm.capacity ?? ""}
            onChange={(e) => setEquipForm({ ...equipForm, capacity: e.currentTarget.value })}
          />
          <TextInput
            label="Barcode"
            value={equipForm.barcode_value ?? ""}
            onChange={(e) => setEquipForm({ ...equipForm, barcode_value: e.currentTarget.value })}
          />
          <Textarea
            label="Notes"
            value={equipForm.notes ?? ""}
            onChange={(e) => setEquipForm({ ...equipForm, notes: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => createEquip.mutate()}
            loading={createEquip.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={drillOpen}
        onClose={closeDrill}
        title="Record Fire Drill"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Type"
            data={DRILL_TYPES}
            value={drillForm.drill_type}
            onChange={(v) =>
              setDrillForm({
                ...drillForm,
                drill_type: v as CreateFmsFireDrillRequest["drill_type"],
              })
            }
          />
          <DateInput
            label="Drill Date"
            value={drillForm.drill_date ? new Date(drillForm.drill_date) : null}
            onChange={(v) =>
              setDrillForm({
                ...drillForm,
                drill_date: v ? new Date(v).toISOString().slice(0, 10) : "",
              })
            }
          />
          <NumberInput
            label="Duration (minutes)"
            value={drillForm.duration_minutes ?? ""}
            onChange={(v) =>
              setDrillForm({
                ...drillForm,
                duration_minutes: typeof v === "number" ? v : undefined,
              })
            }
          />
          <NumberInput
            label="Participants"
            value={drillForm.participants_count ?? ""}
            onChange={(v) =>
              setDrillForm({
                ...drillForm,
                participants_count: typeof v === "number" ? v : undefined,
              })
            }
          />
          <NumberInput
            label="Evacuation Time (seconds)"
            value={drillForm.evacuation_time_seconds ?? ""}
            onChange={(v) =>
              setDrillForm({
                ...drillForm,
                evacuation_time_seconds: typeof v === "number" ? v : undefined,
              })
            }
          />
          <Textarea
            label="Scenario"
            value={drillForm.scenario_description ?? ""}
            onChange={(e) =>
              setDrillForm({ ...drillForm, scenario_description: e.currentTarget.value })
            }
          />
          <Textarea
            label="Findings"
            value={drillForm.findings ?? ""}
            onChange={(e) => setDrillForm({ ...drillForm, findings: e.currentTarget.value })}
          />
          <Textarea
            label="Improvement Actions"
            value={drillForm.improvement_actions ?? ""}
            onChange={(e) =>
              setDrillForm({ ...drillForm, improvement_actions: e.currentTarget.value })
            }
          />
          <Button
            tone="primary"
            onClick={() => createDrill.mutate()}
            loading={createDrill.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: Water Quality
// ══════════════════════════════════════════════════════════
