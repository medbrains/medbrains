import { Badge, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import type { AuditLogSummary } from "@medbrains/types";
import { IconSearch, IconUserSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type Column, DataTable } from "@/components/DataTable";
import { formatDateTime } from "@/lib/date-utils";
import { auditService } from "@/services/audit.service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACTION_COLORS: Record<string, string> = {
  create: "success",
  update: "primary",
  delete: "danger",
  login: "info",
  logout: "slate",
};

export function UserActivityTab() {
  const [userId, setUserId] = useState("");
  const [submittedUserId, setSubmittedUserId] = useState("");
  const trimmedUserId = userId.trim();
  const canSearch = UUID_PATTERN.test(trimmedUserId);

  const { data: activity = [], isLoading } = useQuery({
    queryKey: ["audit-user-activity", submittedUserId],
    queryFn: () => auditService.getUserActivity(submittedUserId),
    enabled: UUID_PATTERN.test(submittedUserId),
  });

  const columns: Column<AuditLogSummary>[] = [
    {
      key: "created_at",
      label: "Time",
      render: (row) => <Text size="sm">{formatDateTime(row.created_at)}</Text>,
    },
    {
      key: "action",
      label: "Action",
      render: (row) => (
        <Badge color={ACTION_COLORS[row.action] ?? "slate"} variant="light" size="sm">
          {row.action}
        </Badge>
      ),
    },
    {
      key: "module",
      label: "Module",
      render: (row) => <Text size="sm">{row.module ?? "-"}</Text>,
    },
    {
      key: "entity_type",
      label: "Entity",
      render: (row) => <Text size="sm">{row.entity_type}</Text>,
    },
    {
      key: "entity_id",
      label: "Entity ID",
      render: (row) => (
        <Text size="xs" ff="monospace" c="dimmed">
          {row.entity_id ? row.entity_id.slice(0, 8) : "-"}
        </Text>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (row) => (
        <Text size="sm" lineClamp={1}>
          {row.description ?? "-"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Group gap="xs">
            <IconUserSearch size={18} />
            <Text fw={600}>User activity</Text>
          </Group>
          <Text size="sm" c="dimmed">
            Audit trail entries for one staff user.
          </Text>
        </Stack>
        <Group align="end" gap="xs">
          <TextInput
            label="User ID"
            placeholder="Paste user UUID"
            value={userId}
            onChange={(event) => setUserId(event.currentTarget.value)}
            error={trimmedUserId && !canSearch ? "Enter a valid user UUID" : undefined}
            w={320}
          />
          <Button
            leftSection={<IconSearch size={14} />}
            disabled={!canSearch}
            onClick={() => setSubmittedUserId(trimmedUserId)}
          >
            Load
          </Button>
        </Group>
      </Group>

      <DataTable
        columns={columns}
        data={activity}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle={submittedUserId ? "No activity found" : "No user selected"}
        emptyDescription={
          submittedUserId
            ? "This user has no matching activity in the latest audit window."
            : "Paste a staff user UUID to inspect recent activity."
        }
      />
    </Stack>
  );
}
