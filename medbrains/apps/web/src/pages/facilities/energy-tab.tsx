// IPD EnergyTab — split from facilities.tsx (pure move).

import { BarChart } from "@mantine/charts";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
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
  CreateFmsEnergyReadingRequest,
  EnergyAnalytics as EnergyAnalyticsType,
  FmsEnergyReading,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { facilitiesService } from "@/services/facilities.service";

const ENERGY_SOURCE_TYPES = [
  { value: "grid", label: "Grid" },
  { value: "dg_set", label: "DG Set" },
  { value: "ups", label: "UPS" },
  { value: "solar", label: "Solar" },
  { value: "inverter", label: "Inverter" },
];

function EnergyAnalyticsView() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["energy-analytics", from, to],
    queryFn: () =>
      facilitiesService.energyAnalytics({ from: from || undefined, to: to || undefined }),
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
        <Text fw={600} size="lg">
          Energy Analytics
        </Text>
        <Group>
          <TextInput
            placeholder="From date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.currentTarget.value)}
            w={160}
          />
          <TextInput
            placeholder="To date"
            type="date"
            value={to}
            onChange={(e) => setTo(e.currentTarget.value)}
            w={160}
          />
        </Group>

        {isLoading && (
          <Text size="sm" c="dimmed">
            Loading analytics...
          </Text>
        )}

        {analytics && (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">
                Consumption by Source
              </Text>
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
                <Text size="sm" c="dimmed">
                  No data
                </Text>
              )}
            </Card>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">
                Monthly Trend
              </Text>
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
                <Text size="sm" c="dimmed">
                  No data
                </Text>
              )}
            </Card>
          </SimpleGrid>
        )}
      </Stack>
    </Card>
  );
}

export function EnergyTab() {
  const canManage = useHasPermission(P.FACILITIES.ENERGY_MANAGE);
  const [readingOpen, { open: openReading, close: closeReading }] = useDisclosure(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const qc = useQueryClient();

  const readings = useQuery({
    queryKey: ["fms-energy-readings"],
    queryFn: () => facilitiesService.listFmsEnergyReadings(),
  });

  const [form, setForm] = useState<CreateFmsEnergyReadingRequest>({ source_type: "grid" });

  const createReading = useMutation({
    mutationFn: () => facilitiesService.createFmsEnergyReading(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-energy-readings"] });
      closeReading();
      notifications.show({ title: "Success", message: "Reading recorded" });
    },
  });

  const cols: Column<FmsEnergyReading>[] = [
    {
      key: "source_type",
      label: "Source",
      render: (r) => <Badge>{r.source_type.replace(/_/g, " ").toUpperCase()}</Badge>,
    },
    {
      key: "equipment_name",
      label: "Equipment",
      render: (r) => <Text size="sm">{r.equipment_name ?? "—"}</Text>,
    },
    { key: "voltage", label: "Voltage", render: (r) => <Text size="sm">{r.voltage ?? "—"}</Text> },
    {
      key: "power_kw",
      label: "Power (kW)",
      render: (r) => <Text size="sm">{r.power_kw ?? "—"}</Text>,
    },
    {
      key: "load_percent",
      label: "Load %",
      render: (r) => <Text size="sm">{r.load_percent ?? "—"}</Text>,
    },
    {
      key: "fuel_level_percent",
      label: "Fuel %",
      render: (r) => <Text size="sm">{r.fuel_level_percent ?? "—"}</Text>,
    },
    {
      key: "battery_health_percent",
      label: "Battery %",
      render: (r) => <Text size="sm">{r.battery_health_percent ?? "—"}</Text>,
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

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Energy Readings
        </Text>
        <Group gap="xs">
          {canManage && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openReading}>
              Record Reading
            </Button>
          )}
          <Button tone="secondary" onClick={() => setShowAnalytics(!showAnalytics)}>
            {showAnalytics ? "Hide Analytics" : "Show Analytics"}
          </Button>
        </Group>
      </Group>
      <DataTable
        columns={cols}
        data={readings.data ?? []}
        loading={readings.isLoading}
        rowKey={(r) => r.id}
      />

      {showAnalytics && <EnergyAnalyticsView />}

      <Drawer
        opened={readingOpen}
        onClose={closeReading}
        title="Record Energy Reading"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Source"
            data={ENERGY_SOURCE_TYPES}
            value={form.source_type}
            onChange={(v) =>
              setForm({ ...form, source_type: v as CreateFmsEnergyReadingRequest["source_type"] })
            }
          />
          <TextInput
            label="Equipment Name"
            value={form.equipment_name ?? ""}
            onChange={(e) => setForm({ ...form, equipment_name: e.currentTarget.value })}
          />
          <NumberInput
            label="Voltage"
            value={form.voltage ?? ""}
            onChange={(v) => setForm({ ...form, voltage: typeof v === "number" ? v : undefined })}
          />
          <NumberInput
            label="Current (A)"
            value={form.current_amps ?? ""}
            onChange={(v) =>
              setForm({ ...form, current_amps: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Power (kW)"
            value={form.power_kw ?? ""}
            onChange={(v) => setForm({ ...form, power_kw: typeof v === "number" ? v : undefined })}
          />
          <NumberInput
            label="Load %"
            value={form.load_percent ?? ""}
            onChange={(v) =>
              setForm({ ...form, load_percent: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Fuel %"
            value={form.fuel_level_percent ?? ""}
            onChange={(v) =>
              setForm({ ...form, fuel_level_percent: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Runtime (hrs)"
            value={form.runtime_hours ?? ""}
            onChange={(v) =>
              setForm({ ...form, runtime_hours: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Battery Voltage"
            value={form.battery_voltage ?? ""}
            onChange={(v) =>
              setForm({ ...form, battery_voltage: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Battery Health %"
            value={form.battery_health_percent ?? ""}
            onChange={(v) =>
              setForm({ ...form, battery_health_percent: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Backup (min)"
            value={form.backup_minutes ?? ""}
            onChange={(v) =>
              setForm({ ...form, backup_minutes: typeof v === "number" ? v : undefined })
            }
          />
          <Switch
            label="Alarm"
            checked={form.is_alarm ?? false}
            onChange={(e) => setForm({ ...form, is_alarm: e.currentTarget.checked })}
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
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
    </Stack>
  );
}

// ── Energy Analytics Sub-View ────────────────────────────
