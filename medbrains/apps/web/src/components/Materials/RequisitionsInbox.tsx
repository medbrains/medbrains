/**
 * Unified requisitions inbox — every request a storekeeper or department
 * head handles, whether a store-item indent or an asset request/movement,
 * in one normalised worklist. Open requests (still needing action) sort to
 * the top. Acting on a request happens in its domain section (Requisitions
 * & Store for indents, Assets & Movement for asset requests); this is the
 * single cross-domain view of what is outstanding.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { Requisition } from "@medbrains/types";
import { IconBox, IconInbox, IconTool } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { Column, DataTableFilter } from "@/components/DataTable";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui";
import { assetsService } from "@/services/assets.service";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  submitted: "info",
  requested: "warning",
  approved: "info",
  partially_issued: "warning",
  completed: "success",
  issued: "success",
  rejected: "danger",
  cancelled: "neutral",
};

function statusTone(status: string): BadgeTone {
  return STATUS_TONE[status] ?? "neutral";
}

export function RequisitionsInbox() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["materials-requisitions"],
    queryFn: () => assetsService.listRequisitions(),
    refetchInterval: 60_000,
  });

  const columns: Column<Requisition>[] = [
    {
      key: "kind",
      label: "Type",
      render: (r) =>
        r.kind === "asset_request" ? (
          <Badge size="xs" tone="info" leftSection={<IconTool size={10} />}>
            Asset
          </Badge>
        ) : (
          <Badge size="xs" tone="neutral" leftSection={<IconBox size={10} />}>
            Store
          </Badge>
        ),
    },
    {
      key: "request",
      label: "Request",
      searchable: true,
      accessor: (r) => `${r.title} ${r.reference ?? ""}`,
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm" fw={600} lineClamp={1}>
            {r.title}
          </Text>
          {r.reference && (
            <Text size="xs" c="dimmed" ff="monospace">
              {r.reference}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "department",
      label: "Department",
      searchable: true,
      accessor: (r) => r.department_name ?? "",
      render: (r) => <Text size="sm">{r.department_name ?? "—"}</Text>,
    },
    {
      key: "requested_by",
      label: "Requested by",
      searchable: true,
      accessor: (r) => r.requested_by_name ?? "",
      render: (r) => <Text size="sm">{r.requested_by_name ?? "—"}</Text>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) =>
        r.priority ? (
          <Badge size="xs" tone={r.priority === "urgent" ? "danger" : "neutral"}>
            {r.priority}
          </Badge>
        ) : (
          <Text size="xs" c="dimmed">
            —
          </Text>
        ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (r) => r.status,
      render: (r) => (
        <Group gap={6} wrap="nowrap">
          <Badge size="xs" tone={statusTone(r.status)}>
            {r.status.replace(/_/g, " ")}
          </Badge>
          {r.open && (
            <Badge size="xs" tone="warning">
              open
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "created",
      label: "Raised",
      sortable: true,
      sortValue: (r) => new Date(r.created_at).getTime(),
      accessor: (r) => new Date(r.created_at).toLocaleDateString(),
      render: (r) => <Text size="xs">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
  ];

  const filters: DataTableFilter<Requisition>[] = [
    {
      key: "kind",
      label: "Type",
      options: [
        { value: "store_indent", label: "Store indent" },
        { value: "asset_request", label: "Asset request" },
      ],
      matches: (r, v) => r.kind === v,
    },
    {
      key: "state",
      label: "State",
      options: [
        { value: "open", label: "Open (needs action)" },
        { value: "closed", label: "Closed" },
      ],
      matches: (r, v) => (v === "open" ? r.open : !r.open),
    },
  ];

  const openCount = rows.filter((r) => r.open).length;

  return (
    <Stack gap="md">
      <PageHeader
        title="Requisitions"
        subtitle={`${openCount} open · ${rows.length} total — store indents and asset requests`}
        icon={<IconInbox size={20} stroke={1.5} />}
      />
      <DataTable<Requisition>
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(r) => `${r.kind}:${r.id}`}
        searchable
        searchPlaceholder="Search request, reference, department, requester"
        filters={filters}
        exportable
        exportFileName="requisitions"
        emptyIcon={<IconInbox size={28} stroke={1.5} />}
        emptyTitle="No requisitions"
      />
    </Stack>
  );
}
