import { useState } from "react";
import {
  Badge,
  Button,
  Code,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { IconDownload, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import type { AuditLogSummary, AuditLogEntry, AuditLogQuery } from "@medbrains/types";
import { DataTable } from "../../components";
import type { Column } from "../../components/DataTable";

// ── Constants ──────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
];

const ACTION_COLORS: Record<string, string> = {
  create: "success",
  update: "primary",
  delete: "danger",
};

const PER_PAGE = 50;

// ── Component ──────────────────────────────────────────

export function AuditLogTab() {
  const canExport = useHasPermission(P.AUDIT.LOG_EXPORT);

  // Filter state
  const [module, setModule] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [page, setPage] = useState(1);

  // Detail drawer
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Build query params
  const buildQuery = (): AuditLogQuery => {
    const q: AuditLogQuery = { page, per_page: PER_PAGE };
    if (module) q.module = module;
    if (entityType) q.entity_type = entityType;
    if (action) q.action = action;
    if (userSearch) q.user_id = userSearch;
    if (fromDate) q.from = fromDate.toISOString().split("T")[0];
    if (toDate) q.to = toDate.toISOString().split("T")[0];
    return q;
  };

  const filters = buildQuery();

  // Queries
  const { data: modules } = useQuery({
    queryKey: ["audit-modules"],
    queryFn: () => api.listAuditModules(),
  });

  const { data: entityTypes } = useQuery({
    queryKey: ["audit-entity-types"],
    queryFn: () => api.listAuditEntityTypes(),
  });

  const { data: logEntries, isLoading } = useQuery({
    queryKey: ["audit-log", filters],
    queryFn: () => api.listAuditLog(filters),
    refetchInterval: 60_000,
  });

  const { data: detailEntry } = useQuery({
    queryKey: ["audit-entry", selectedId],
    queryFn: () => api.getAuditEntry(selectedId as string),
    enabled: !!selectedId,
  });

  // Handlers
  const handleRowClick = (entry: AuditLogSummary) => {
    setSelectedId(entry.id);
    openDetail();
  };

  const handleExport = () => {
    api.exportAuditLog(buildQuery());
  };

  const handleClearFilters = () => {
    setModule(null);
    setEntityType(null);
    setAction(null);
    setUserSearch("");
    setFromDate(null);
    setToDate(null);
    setPage(1);
  };

  // Columns
  const columns: Column<AuditLogSummary>[] = [
    {
      key: "created_at",
      label: "Time",
      render: (r) => (
        <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "user_name",
      label: "User",
      render: (r) => <Text size="sm">{r.user_name ?? "System"}</Text>,
    },
    {
      key: "action",
      label: "Action",
      render: (r) => (
        <Badge color={ACTION_COLORS[r.action] ?? "slate"} variant="light" size="sm">
          {r.action}
        </Badge>
      ),
    },
    {
      key: "module",
      label: "Module",
      render: (r) => <Text size="sm">{r.module ?? "-"}</Text>,
    },
    {
      key: "entity_type",
      label: "Entity Type",
      render: (r) => <Text size="sm">{r.entity_type}</Text>,
    },
    {
      key: "entity_id",
      label: "Entity ID",
      render: (r) => (
        <Text size="xs" ff="monospace" c="dimmed">
          {r.entity_id ? r.entity_id.substring(0, 8) : "-"}
        </Text>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.description ?? "-"}
        </Text>
      ),
    },
  ];

  const totalPages = logEntries ? Math.ceil(logEntries.length / PER_PAGE) : 0;

  return (
    <Stack gap="md">
      {/* Filters */}
      <Group gap="sm" wrap="wrap">
        <Select
          placeholder="Module"
          data={modules?.map((m) => ({ value: m, label: m })) ?? []}
          value={module}
          onChange={setModule}
          clearable
          size="sm"
          w={160}
        />
        <Select
          placeholder="Entity Type"
          data={entityTypes?.map((e) => ({ value: e, label: e })) ?? []}
          value={entityType}
          onChange={setEntityType}
          clearable
          size="sm"
          w={160}
        />
        <Select
          placeholder="Action"
          data={ACTION_OPTIONS}
          value={action}
          onChange={setAction}
          clearable
          size="sm"
          w={130}
        />
        <DateInput
          placeholder="From date"
          value={fromDate}
          onChange={(v) => setFromDate(v ? new Date(v) : null)}
          clearable
          size="sm"
          w={150}
        />
        <DateInput
          placeholder="To date"
          value={toDate}
          onChange={(v) => setToDate(v ? new Date(v) : null)}
          clearable
          size="sm"
          w={150}
        />
        <TextInput
          placeholder="Search user..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.currentTarget.value)}
          leftSection={<IconSearch size={14} />}
          size="sm"
          w={180}
        />
        <Button variant="subtle" size="sm" onClick={handleClearFilters}>
          Clear
        </Button>
        {canExport && (
          <Button
            variant="light"
            size="sm"
            leftSection={<IconDownload size={14} />}
            onClick={handleExport}
          >
            Export
          </Button>
        )}
      </Group>

      {/* Table */}
      <div
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          const row = (e.target as HTMLElement).closest("tr");
          if (!row) return;
          const idx = row.rowIndex - 1; // header is row 0
          const entry = logEntries?.[idx];
          if (entry) handleRowClick(entry);
        }}
      >
        <DataTable
          columns={columns}
          data={logEntries ?? []}
          loading={isLoading}
          rowKey={(r) => r.id}
          page={page}
          totalPages={totalPages}
          perPage={PER_PAGE}
          onPageChange={setPage}
          total={logEntries?.length}
          emptyTitle="No audit entries found"
          emptyDescription="Adjust your filters or wait for new activity."
        />
      </div>

      {/* Detail Drawer */}
      <AuditDetailDrawer
        entry={detailEntry ?? null}
        opened={detailOpened}
        onClose={closeDetail}
      />
    </Stack>
  );
}

// ── Detail Drawer ──────────────────────────────────────

function AuditDetailDrawer({
  entry,
  opened,
  onClose,
}: {
  entry: AuditLogEntry | null;
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Audit Entry Detail"
      position="right"
      size="lg"
    >
      {entry ? (
        <Stack gap="md">
          <Group gap="xs">
            <Text fw={600} size="sm" w={100}>
              Time:
            </Text>
            <Text size="sm">{new Date(entry.created_at).toLocaleString()}</Text>
          </Group>
          <Group gap="xs">
            <Text fw={600} size="sm" w={100}>
              User:
            </Text>
            <Text size="sm">{entry.user_name ?? "System"}</Text>
          </Group>
          <Group gap="xs">
            <Text fw={600} size="sm" w={100}>
              Action:
            </Text>
            <Badge color={ACTION_COLORS[entry.action] ?? "slate"} variant="light">
              {entry.action}
            </Badge>
          </Group>
          <Group gap="xs">
            <Text fw={600} size="sm" w={100}>
              Module:
            </Text>
            <Text size="sm">{entry.module ?? "-"}</Text>
          </Group>
          <Group gap="xs">
            <Text fw={600} size="sm" w={100}>
              Entity Type:
            </Text>
            <Text size="sm">{entry.entity_type}</Text>
          </Group>
          <Group gap="xs">
            <Text fw={600} size="sm" w={100}>
              Entity ID:
            </Text>
            <Text size="sm" ff="monospace">
              {entry.entity_id ?? "-"}
            </Text>
          </Group>
          <Group gap="xs">
            <Text fw={600} size="sm" w={100}>
              IP Address:
            </Text>
            <Text size="sm" ff="monospace">
              {entry.ip_address ?? "-"}
            </Text>
          </Group>
          {entry.description && (
            <div>
              <Text fw={600} size="sm" mb={4}>
                Description:
              </Text>
              <Text size="sm">{entry.description}</Text>
            </div>
          )}
          {entry.old_values != null && (
            <div>
              <Text fw={600} size="sm" mb={4}>
                Old Values:
              </Text>
              <Code block>{JSON.stringify(entry.old_values, null, 2)}</Code>
            </div>
          )}
          {entry.new_values != null && (
            <div>
              <Text fw={600} size="sm" mb={4}>
                New Values:
              </Text>
              <Code block>{JSON.stringify(entry.new_values, null, 2)}</Code>
            </div>
          )}
        </Stack>
      ) : (
        <Text c="dimmed">Loading...</Text>
      )}
    </Drawer>
  );
}
