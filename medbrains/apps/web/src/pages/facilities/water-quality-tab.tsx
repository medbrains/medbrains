// IPD WaterQualityTab — split from facilities.tsx (pure move).

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
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateFmsWaterScheduleRequest,
  CreateFmsWaterTestRequest,
  FmsWaterSchedule,
  FmsWaterTest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { facilitiesService } from "@/services/facilities.service";

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

export function WaterQualityTab() {
  const canManage = useHasPermission(P.FACILITIES.WATER_MANAGE);
  const [testOpen, { open: openTest, close: closeTest }] = useDisclosure(false);
  const [schedOpen, { open: openSched, close: closeSched }] = useDisclosure(false);
  const qc = useQueryClient();

  const tests = useQuery({
    queryKey: ["fms-water-tests"],
    queryFn: () => facilitiesService.listFmsWaterTests(),
  });
  const schedules = useQuery({
    queryKey: ["fms-water-schedules"],
    queryFn: () => facilitiesService.listFmsWaterSchedules(),
  });

  const [testForm, setTestForm] = useState<CreateFmsWaterTestRequest>({
    source_type: "municipal",
    test_type: "bacteriological",
    sample_date: new Date().toISOString().slice(0, 10),
    parameter_name: "",
  });
  const [schedForm, setSchedForm] = useState<CreateFmsWaterScheduleRequest>({
    schedule_type: "",
    frequency: "",
  });

  const createTest = useMutation({
    mutationFn: () => facilitiesService.createFmsWaterTest(testForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-water-tests"] });
      closeTest();
      notifications.show({ title: "Success", message: "Test result recorded" });
    },
  });
  const createSched = useMutation({
    mutationFn: () => facilitiesService.createFmsWaterSchedule(schedForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-water-schedules"] });
      closeSched();
      notifications.show({ title: "Success", message: "Schedule created" });
    },
  });

  const testCols: Column<FmsWaterTest>[] = [
    {
      key: "source_type",
      label: "Source",
      render: (r) => <Badge>{r.source_type.replace(/_/g, " ")}</Badge>,
    },
    { key: "test_type", label: "Test", render: (r) => <Text size="sm">{r.test_type}</Text> },
    {
      key: "parameter_name",
      label: "Parameter",
      render: (r) => <Text size="sm">{r.parameter_name}</Text>,
    },
    {
      key: "result_value",
      label: "Result",
      render: (r) => (
        <Text size="sm">
          {r.result_value ?? "—"} {r.unit ?? ""}
        </Text>
      ),
    },
    {
      key: "is_within_limits",
      label: "Status",
      render: (r) =>
        r.is_within_limits === null || r.is_within_limits === undefined ? (
          <Badge tone="neutral">Pending</Badge>
        ) : r.is_within_limits ? (
          <Badge tone="success">Pass</Badge>
        ) : (
          <Badge tone="danger">Fail</Badge>
        ),
    },
    { key: "sample_date", label: "Sampled", render: (r) => <Text size="sm">{r.sample_date}</Text> },
  ];

  const schedCols: Column<FmsWaterSchedule>[] = [
    {
      key: "schedule_type",
      label: "Type",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.schedule_type}
        </Text>
      ),
    },
    { key: "frequency", label: "Frequency", render: (r) => <Text size="sm">{r.frequency}</Text> },
    {
      key: "last_completed_date",
      label: "Last Done",
      render: (r) => <Text size="sm">{r.last_completed_date ?? "—"}</Text>,
    },
    {
      key: "next_due_date",
      label: "Next Due",
      render: (r) => (
        <Text
          size="sm"
          c={r.next_due_date && new Date(r.next_due_date) < new Date() ? "danger" : undefined}
        >
          {r.next_due_date ?? "—"}
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
          Water Test Results
        </Text>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openTest}>
            Record Test
          </Button>
        )}
      </Group>
      <DataTable
        columns={testCols}
        data={tests.data ?? []}
        loading={tests.isLoading}
        rowKey={(r) => r.id}
      />

      <Group justify="space-between" mt="lg">
        <Text fw={600} size="lg">
          Cleaning / Testing Schedules
        </Text>
        {canManage && (
          <Button tone="secondary" leftSection={<IconPlus size={16} />} onClick={openSched}>
            Add Schedule
          </Button>
        )}
      </Group>
      <DataTable
        columns={schedCols}
        data={schedules.data ?? []}
        loading={schedules.isLoading}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={testOpen}
        onClose={closeTest}
        title="Record Water Test"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Source"
            data={WATER_SOURCE_TYPES}
            value={testForm.source_type}
            onChange={(v) =>
              setTestForm({
                ...testForm,
                source_type: v as CreateFmsWaterTestRequest["source_type"],
              })
            }
          />
          <Select
            label="Test Type"
            data={WATER_TEST_TYPES}
            value={testForm.test_type}
            onChange={(v) =>
              setTestForm({ ...testForm, test_type: v as CreateFmsWaterTestRequest["test_type"] })
            }
          />
          <TextInput
            label="Parameter"
            required
            value={testForm.parameter_name}
            onChange={(e) => setTestForm({ ...testForm, parameter_name: e.currentTarget.value })}
          />
          <NumberInput
            label="Result Value"
            value={testForm.result_value ?? ""}
            onChange={(v) =>
              setTestForm({ ...testForm, result_value: typeof v === "number" ? v : undefined })
            }
          />
          <TextInput
            label="Unit"
            value={testForm.unit ?? ""}
            onChange={(e) => setTestForm({ ...testForm, unit: e.currentTarget.value })}
          />
          <NumberInput
            label="Min Acceptable"
            value={testForm.acceptable_min ?? ""}
            onChange={(v) =>
              setTestForm({ ...testForm, acceptable_min: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Max Acceptable"
            value={testForm.acceptable_max ?? ""}
            onChange={(v) =>
              setTestForm({ ...testForm, acceptable_max: typeof v === "number" ? v : undefined })
            }
          />
          <TextInput
            label="Lab Name"
            value={testForm.lab_name ?? ""}
            onChange={(e) => setTestForm({ ...testForm, lab_name: e.currentTarget.value })}
          />
          <Textarea
            label="Notes"
            value={testForm.notes ?? ""}
            onChange={(e) => setTestForm({ ...testForm, notes: e.currentTarget.value })}
          />
          <Button tone="primary" onClick={() => createTest.mutate()} loading={createTest.isPending}>
            Save
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={schedOpen}
        onClose={closeSched}
        title="Add Water Schedule"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Schedule Type"
            required
            data={WATER_SCHEDULE_TYPES}
            value={schedForm.schedule_type || null}
            onChange={(v) => setSchedForm({ ...schedForm, schedule_type: v ?? "" })}
            searchable
          />
          <Select
            label="Frequency"
            required
            data={SCHEDULE_FREQUENCIES}
            value={schedForm.frequency || null}
            onChange={(v) => setSchedForm({ ...schedForm, frequency: v ?? "" })}
            searchable
          />
          <Textarea
            label="Notes"
            value={schedForm.notes ?? ""}
            onChange={(e) => setSchedForm({ ...schedForm, notes: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => createSched.mutate()}
            loading={createSched.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: Energy
// ══════════════════════════════════════════════════════════
