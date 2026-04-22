import { Badge, Card, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { ModuleCount, UserActionCount, ActionCount } from "@medbrains/types";

// ── Constants ──────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  create: "success",
  update: "primary",
  delete: "danger",
};

// ── Component ──────────────────────────────────────────

export function AuditStatsTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["audit-stats"],
    queryFn: () => api.getAuditStats(),
    refetchInterval: 60_000,
  });

  if (isLoading || !stats) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        Loading statistics...
      </Text>
    );
  }

  return (
    <Stack gap="lg">
      {/* Stat Cards */}
      <SimpleGrid cols={2}>
        <StatCard label="Total Entries" value={stats.total_entries.toLocaleString()} />
        <StatCard label="Today's Entries" value={stats.today_entries.toLocaleString()} />
      </SimpleGrid>

      {/* Top Modules */}
      <Card withBorder>
        <Text fw={600} mb="sm">
          Top Modules
        </Text>
        <ModuleTable data={stats.top_modules} />
      </Card>

      {/* Top Users */}
      <Card withBorder>
        <Text fw={600} mb="sm">
          Top Users
        </Text>
        <UserTable data={stats.top_users} />
      </Card>

      {/* Action Breakdown */}
      <Card withBorder>
        <Text fw={600} mb="sm">
          Action Breakdown
        </Text>
        <ActionTable data={stats.action_breakdown} />
      </Card>
    </Stack>
  );
}

// ── Sub-components ─────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder p="lg">
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Text fw={700} size="xl">
        {value}
      </Text>
    </Card>
  );
}

function ModuleTable({ data }: { data: ModuleCount[] }) {
  if (data.length === 0) {
    return <Text c="dimmed" size="sm">No data</Text>;
  }

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Module</Table.Th>
          <Table.Th>Count</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data.map((row) => (
          <Table.Tr key={row.module ?? "unknown"}>
            <Table.Td>
              <Text size="sm">{row.module ?? "Unknown"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>
                {row.count.toLocaleString()}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function UserTable({ data }: { data: UserActionCount[] }) {
  if (data.length === 0) {
    return <Text c="dimmed" size="sm">No data</Text>;
  }

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>User</Table.Th>
          <Table.Th>Count</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data.map((row) => (
          <Table.Tr key={row.user_name ?? "unknown"}>
            <Table.Td>
              <Text size="sm">{row.user_name ?? "System"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>
                {row.count.toLocaleString()}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function ActionTable({ data }: { data: ActionCount[] }) {
  if (data.length === 0) {
    return <Text c="dimmed" size="sm">No data</Text>;
  }

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Action</Table.Th>
          <Table.Th>Count</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data.map((row) => (
          <Table.Tr key={row.action}>
            <Table.Td>
              <Badge color={ACTION_COLORS[row.action] ?? "slate"} variant="light" size="sm">
                {row.action}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>
                {row.count.toLocaleString()}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
