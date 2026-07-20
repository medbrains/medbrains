// IPD MgpsTab — split from facilities.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateFmsGasComplianceRequest,
  CreateFmsGasReadingRequest,
  FmsGasCompliance,
  FmsGasReading,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { facilitiesService } from "@/services/facilities.service";

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

export function MgpsTab() {
  const canManage = useHasPermission(P.FACILITIES.GAS_MANAGE);
  const canManageCompliance = useHasPermission(P.FACILITIES.COMPLIANCE_MANAGE);
  const [readingOpen, { open: openReading, close: closeReading }] = useDisclosure(false);
  const [complianceOpen, { open: openCompliance, close: closeCompliance }] = useDisclosure(false);
  const qc = useQueryClient();

  const readings = useQuery({
    queryKey: ["fms-gas-readings"],
    queryFn: () => facilitiesService.listFmsGasReadings(),
  });
  const compliance = useQuery({
    queryKey: ["fms-gas-compliance"],
    queryFn: () => facilitiesService.listFmsGasCompliance(),
  });

  const [gasForm, setGasForm] = useState<CreateFmsGasReadingRequest>({
    gas_type: "oxygen",
    source_type: "pipeline",
  });
  const [compForm, setCompForm] = useState<CreateFmsGasComplianceRequest>({ gas_type: "oxygen" });

  const createReading = useMutation({
    mutationFn: () => facilitiesService.createFmsGasReading(gasForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-gas-readings"] });
      closeReading();
      notifications.show({ title: "Success", message: "Gas reading recorded" });
    },
  });
  const createCompliance = useMutation({
    mutationFn: () => facilitiesService.createFmsGasCompliance(compForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-gas-compliance"] });
      closeCompliance();
      notifications.show({ title: "Success", message: "Compliance record created" });
    },
  });

  const readingCols: Column<FmsGasReading>[] = [
    {
      key: "gas_type",
      label: "Gas",
      render: (r) => <Badge>{r.gas_type.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "source_type",
      label: "Source",
      render: (r) => <Text size="sm">{r.source_type.replace(/_/g, " ")}</Text>,
    },
    {
      key: "purity_percent",
      label: "Purity %",
      render: (r) => <Text size="sm">{r.purity_percent ?? "—"}</Text>,
    },
    {
      key: "pressure_bar",
      label: "Pressure (bar)",
      render: (r) => <Text size="sm">{r.pressure_bar ?? "—"}</Text>,
    },
    {
      key: "flow_lpm",
      label: "Flow (LPM)",
      render: (r) => <Text size="sm">{r.flow_lpm ?? "—"}</Text>,
    },
    {
      key: "tank_level_percent",
      label: "Tank %",
      render: (r) => <Text size="sm">{r.tank_level_percent ?? "—"}</Text>,
    },
    {
      key: "is_alarm",
      label: "Alarm",
      render: (r) =>
        r.is_alarm ? <Badge tone="danger">ALARM</Badge> : <Badge tone="success">OK</Badge>,
    },
    {
      key: "reading_at",
      label: "Time",
      render: (r) => <Text size="sm">{new Date(r.reading_at).toLocaleString()}</Text>,
    },
  ];

  const compCols: Column<FmsGasCompliance>[] = [
    {
      key: "gas_type",
      label: "Gas",
      render: (r) => <Badge>{r.gas_type.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "peso_license_number",
      label: "PESO License",
      render: (r) => <Text size="sm">{r.peso_license_number ?? "—"}</Text>,
    },
    {
      key: "peso_valid_to",
      label: "PESO Valid To",
      render: (r) => <Text size="sm">{r.peso_valid_to ?? "—"}</Text>,
    },
    {
      key: "drug_license_number",
      label: "Drug License",
      render: (r) => <Text size="sm">{r.drug_license_number ?? "—"}</Text>,
    },
    {
      key: "compliance_status",
      label: "Status",
      render: (r) => (
        <Badge tone={r.compliance_status === "compliant" ? "success" : "danger"}>
          {r.compliance_status ?? "—"}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Gas Readings
        </Text>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openReading}>
            Record Reading
          </Button>
        )}
      </Group>
      <DataTable
        columns={readingCols}
        data={readings.data ?? []}
        loading={readings.isLoading}
        rowKey={(r) => r.id}
      />

      <Group justify="space-between" mt="lg">
        <Text fw={600} size="lg">
          PESO / Drug License Compliance
        </Text>
        {canManageCompliance && (
          <Button tone="secondary" leftSection={<IconPlus size={16} />} onClick={openCompliance}>
            Add Compliance
          </Button>
        )}
      </Group>
      <DataTable
        columns={compCols}
        data={compliance.data ?? []}
        loading={compliance.isLoading}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={readingOpen}
        onClose={closeReading}
        title="Record Gas Reading"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Gas Type"
            data={GAS_TYPES}
            value={gasForm.gas_type}
            onChange={(v) =>
              setGasForm({ ...gasForm, gas_type: v as CreateFmsGasReadingRequest["gas_type"] })
            }
          />
          <Select
            label="Source"
            data={GAS_SOURCE_TYPES}
            value={gasForm.source_type}
            onChange={(v) =>
              setGasForm({
                ...gasForm,
                source_type: v as CreateFmsGasReadingRequest["source_type"],
              })
            }
          />
          <NumberInput
            label="Purity %"
            value={gasForm.purity_percent ?? ""}
            onChange={(v) =>
              setGasForm({ ...gasForm, purity_percent: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Pressure (bar)"
            value={gasForm.pressure_bar ?? ""}
            onChange={(v) =>
              setGasForm({ ...gasForm, pressure_bar: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Flow (LPM)"
            value={gasForm.flow_lpm ?? ""}
            onChange={(v) =>
              setGasForm({ ...gasForm, flow_lpm: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Tank Level %"
            value={gasForm.tank_level_percent ?? ""}
            onChange={(v) =>
              setGasForm({ ...gasForm, tank_level_percent: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Cylinder Count"
            value={gasForm.cylinder_count ?? ""}
            onChange={(v) =>
              setGasForm({ ...gasForm, cylinder_count: typeof v === "number" ? v : undefined })
            }
          />
          <Switch
            label="Alarm"
            checked={gasForm.is_alarm ?? false}
            onChange={(e) => setGasForm({ ...gasForm, is_alarm: e.currentTarget.checked })}
          />
          {gasForm.is_alarm && (
            <TextInput
              label="Alarm Reason"
              value={gasForm.alarm_reason ?? ""}
              onChange={(e) => setGasForm({ ...gasForm, alarm_reason: e.currentTarget.value })}
            />
          )}
          <Textarea
            label="Notes"
            value={gasForm.notes ?? ""}
            onChange={(e) => setGasForm({ ...gasForm, notes: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => createReading.mutate()}
            loading={createReading.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={complianceOpen}
        onClose={closeCompliance}
        title="Add Gas Compliance"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Gas Type"
            data={GAS_TYPES}
            value={compForm.gas_type}
            onChange={(v) =>
              setCompForm({ ...compForm, gas_type: v as CreateFmsGasComplianceRequest["gas_type"] })
            }
          />
          <TextInput
            label="PESO License Number"
            value={compForm.peso_license_number ?? ""}
            onChange={(e) =>
              setCompForm({ ...compForm, peso_license_number: e.currentTarget.value })
            }
          />
          <TextInput
            label="Drug License Number"
            value={compForm.drug_license_number ?? ""}
            onChange={(e) =>
              setCompForm({ ...compForm, drug_license_number: e.currentTarget.value })
            }
          />
          <TextInput
            label="Inspector Name"
            value={compForm.inspector_name ?? ""}
            onChange={(e) => setCompForm({ ...compForm, inspector_name: e.currentTarget.value })}
          />
          <Textarea
            label="Notes"
            value={compForm.notes ?? ""}
            onChange={(e) => setCompForm({ ...compForm, notes: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => createCompliance.mutate()}
            loading={createCompliance.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: Fire Safety
// ══════════════════════════════════════════════════════════
