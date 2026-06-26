/**
 * Unified inventory cockpit — one "what do we have, and where" view across
 * consumable store stock and capital assets. Stock lines carry on-hand
 * quantity, value and a reorder status (in-stock / low / out); asset lines
 * carry their location and book value. A header strip rolls up total
 * inventory value and the low/out-of-stock count so the storekeeper sees
 * the position at a glance.
 */
import { SimpleGrid, Stack, Text } from "@mantine/core";
import type { InventoryItem } from "@medbrains/types";
import { IconBox, IconPackages, IconTool } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Column, DataTableFilter } from "@/components/DataTable";
import { DataTable } from "@/components/DataTable";
import { Badge, type BadgeTone, Card } from "@/components/ui";
import { assetsService } from "@/services/assets.service";

const STOCK_TONE: Record<string, BadgeTone> = {
  in_stock: "success",
  low: "warning",
  out: "danger",
  na: "neutral",
};

function money(value: string | null): string {
  if (value == null) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="sm">
      <Stack gap={2}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
        <Text size="lg" fw={700}>
          {value}
        </Text>
      </Stack>
    </Card>
  );
}

export function InventoryView() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["materials-inventory"],
    queryFn: () => assetsService.listInventory(),
    refetchInterval: 120_000,
  });

  const summary = useMemo(() => {
    let totalValue = 0;
    let lowOrOut = 0;
    let stockLines = 0;
    let assetLines = 0;
    for (const it of items) {
      if (it.total_value != null) totalValue += Number(it.total_value) || 0;
      if (it.stock_status === "low" || it.stock_status === "out") lowOrOut += 1;
      if (it.kind === "stock") stockLines += 1;
      else assetLines += 1;
    }
    return { totalValue, lowOrOut, stockLines, assetLines };
  }, [items]);

  const columns: Column<InventoryItem>[] = [
    {
      key: "kind",
      label: "Type",
      render: (r) =>
        r.kind === "asset" ? (
          <Badge size="xs" tone="info" leftSection={<IconTool size={10} />}>
            Asset
          </Badge>
        ) : (
          <Badge size="xs" tone="neutral" leftSection={<IconBox size={10} />}>
            Stock
          </Badge>
        ),
    },
    {
      key: "item",
      label: "Item",
      searchable: true,
      accessor: (r) => `${r.name} ${r.code ?? ""}`,
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm" fw={600} lineClamp={1}>
            {r.name}
          </Text>
          {r.code && (
            <Text size="xs" c="dimmed" ff="monospace">
              {r.code}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "category",
      label: "Category",
      searchable: true,
      accessor: (r) => r.category ?? "",
      render: (r) => <Text size="sm">{r.category ?? "—"}</Text>,
    },
    {
      key: "department",
      label: "Location",
      render: (r) => <Text size="sm">{r.department_name ?? "—"}</Text>,
    },
    {
      key: "on_hand",
      label: "On hand",
      sortable: true,
      sortValue: (r) => Number(r.on_hand) || 0,
      accessor: (r) => `${Number(r.on_hand)} ${r.unit ?? ""}`.trim(),
      render: (r) => (
        <Text size="sm" fw={500}>
          {Number(r.on_hand)} {r.unit ?? ""}
        </Text>
      ),
    },
    {
      key: "value",
      label: "Value",
      sortable: true,
      sortValue: (r) => Number(r.total_value ?? 0),
      accessor: (r) => money(r.total_value),
      render: (r) => <Text size="sm">{money(r.total_value)}</Text>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (r) => r.stock_status,
      render: (r) =>
        r.stock_status === "na" ? (
          <Text size="xs" c="dimmed">
            —
          </Text>
        ) : (
          <Badge size="xs" tone={STOCK_TONE[r.stock_status] ?? "neutral"}>
            {r.stock_status === "in_stock" ? "in stock" : r.stock_status}
            {r.reorder_level != null && r.kind === "stock" ? ` · ROL ${r.reorder_level}` : ""}
          </Badge>
        ),
    },
  ];

  const filters: DataTableFilter<InventoryItem>[] = [
    {
      key: "kind",
      label: "Type",
      options: [
        { value: "stock", label: "Store stock" },
        { value: "asset", label: "Assets" },
      ],
      matches: (r, v) => r.kind === v,
    },
    {
      key: "status",
      label: "Stock status",
      options: [
        { value: "in_stock", label: "In stock" },
        { value: "low", label: "Low" },
        { value: "out", label: "Out of stock" },
      ],
      matches: (r, v) => r.stock_status === v,
    },
  ];

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <StatCard label="Inventory value" value={money(String(summary.totalValue))} />
        <StatCard label="Low / out of stock" value={String(summary.lowOrOut)} />
        <StatCard label="Stock items" value={String(summary.stockLines)} />
        <StatCard label="Assets" value={String(summary.assetLines)} />
      </SimpleGrid>

      <DataTable<InventoryItem>
        columns={columns}
        data={items}
        loading={isLoading}
        rowKey={(r) => `${r.kind}:${r.id}`}
        searchable
        searchPlaceholder="Search item, code, category"
        filters={filters}
        exportable
        exportFileName="inventory"
        emptyIcon={<IconPackages size={28} stroke={1.5} />}
        emptyTitle="No inventory"
      />
    </Stack>
  );
}
