// IPD BatchStockPanel — split from procurement.tsx (pure move).

import { Text } from "@mantine/core";
import type { BatchStock } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable, TableValueBadge } from "@/components";
import { procurementService } from "@/services/procurement.service";

export function BatchStockPanel() {
  const { data: batches, isLoading } = useQuery({
    queryKey: ["batch-stock"],
    queryFn: () => procurementService.listBatchStock(),
  });

  const columns = [
    {
      key: "batch_number",
      label: "Batch",
      render: (row: BatchStock) => <Text fw={600}>{row.batch_number}</Text>,
    },
    {
      key: "serial_number",
      label: "Serial #",
      render: (row: BatchStock) => row.serial_number ?? "-",
    },
    { key: "quantity", label: "Qty", render: (row: BatchStock) => row.quantity },
    { key: "unit_cost", label: "Cost", render: (row: BatchStock) => `₹${row.unit_cost}` },
    {
      key: "expiry_date",
      label: "Expiry",
      render: (row: BatchStock) => {
        if (!row.expiry_date) return "-";
        const isExpiring =
          new Date(row.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        return (
          <Text c={isExpiring ? "danger" : undefined} fw={isExpiring ? 600 : undefined}>
            {row.expiry_date}
          </Text>
        );
      },
    },
    {
      key: "is_consignment",
      label: "Consignment",
      render: (row: BatchStock) =>
        row.is_consignment ? (
          <TableValueBadge value="store" kind="store" color="orange" label="Yes" variant="filled" />
        ) : (
          "-"
        ),
    },
    {
      key: "created_at",
      label: "Received",
      render: (row: BatchStock) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={batches ?? []}
      loading={isLoading}
      rowKey={(row) => row.id}
      emptyTitle="No batch stock records"
    />
  );
}

// ══════════════════════════════════════════════════════════
//  Store Locations Panel
// ══════════════════════════════════════════════════════════
