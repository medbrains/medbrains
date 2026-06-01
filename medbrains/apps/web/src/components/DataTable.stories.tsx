import { Badge, Box, Button, Group, Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconActivity, IconPlus, IconRoute } from "@tabler/icons-react";
import type { ComponentProps } from "react";
import { type Column, DataTable } from "./DataTable";

interface QueueRow {
  id: string;
  module: "OPD" | "IPD" | "Emergency" | "Camp" | "Billing" | "Pharmacy";
  nextAction: string;
  patient: string;
  risk: "routine" | "watch" | "critical";
  token: string;
  waitMinutes: number;
}

const modules: QueueRow["module"][] = ["OPD", "IPD", "Emergency", "Camp", "Billing", "Pharmacy"];
const risks: QueueRow["risk"][] = ["routine", "watch", "critical"];
const nextActions = [
  "Open encounter",
  "Capture vitals",
  "Assign bed",
  "Dispense medicines",
  "Finalize bill",
  "Review reports",
];

const queueRows: QueueRow[] = Array.from({ length: 2_000 }, (_, index) => ({
  id: `queue-${index + 1}`,
  module: modules[index % modules.length],
  nextAction: nextActions[index % nextActions.length],
  patient: `Patient ${String(index + 1).padStart(4, "0")}`,
  risk: risks[index % risks.length],
  token: `T-${String(index + 1).padStart(4, "0")}`,
  waitMinutes: (index * 7) % 180,
}));

const riskColor: Record<QueueRow["risk"], string> = {
  critical: "danger",
  routine: "success",
  watch: "warning",
};

const columns: Column<QueueRow>[] = [
  {
    key: "token",
    label: "Token",
    render: (row) => (
      <Text size="sm" fw={700}>
        {row.token}
      </Text>
    ),
  },
  {
    key: "patient",
    label: "Patient",
    accessor: (row) => row.patient,
    fieldAccessKey: "patient.identity.name",
    render: (row) => <Text size="sm">{row.patient}</Text>,
  },
  {
    key: "module",
    label: "Module",
    render: (row) => <Badge variant="light">{row.module}</Badge>,
  },
  {
    key: "risk",
    label: "Risk",
    render: (row) => (
      <Badge color={riskColor[row.risk]} variant="light">
        {row.risk}
      </Badge>
    ),
  },
  {
    key: "wait",
    label: "Wait",
    render: (row) => <Text size="sm">{row.waitMinutes} min</Text>,
  },
  {
    key: "next",
    label: "Next action",
    render: (row) => (
      <Button size="xs" variant="light" leftSection={<IconRoute size={14} />}>
        {row.nextAction}
      </Button>
    ),
  },
];

type QueueDataTableProps = ComponentProps<typeof DataTable<QueueRow>>;

const meta = {
  title: "Components/DataTable",
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <Box p={32}>
      <DataTable<QueueRow> {...args} />
    </Box>
  ),
} satisfies Meta<QueueDataTableProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VirtualizedOperationalQueue: Story = {
  args: {
    caption: "Virtualized operational queue with 2000 rows",
    columns,
    data: queueRows,
    density: "compact",
    rowKey: (row) => row.id,
    tableMaxHeight: 520,
    tableActions: (
      <Button size="xs" leftSection={<IconPlus size={14} />}>
        New action
      </Button>
    ),
    toolbar: (
      <Group gap="xs">
        <IconActivity size={16} />
        <Text size="sm" fw={700}>
          Live patient flow queue
        </Text>
      </Group>
    ),
    total: queueRows.length,
    totalPages: 1,
    virtualized: true,
    virtualizeAt: 40,
  },
};
