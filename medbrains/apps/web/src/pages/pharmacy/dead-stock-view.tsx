// IPD DeadStockView — split from pharmacy.tsx (pure move).

import { Text } from "@mantine/core";
import { useFieldAccess } from "@medbrains/stores";
import type { PharmacyDeadStockRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { renderPharmacySensitiveCurrency } from "./shared";

export function DeadStockView() {
  const valueAccess = useFieldAccess("pharmacy.analytics.value");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-dead-stock"],
    queryFn: () => pharmacyService.getPharmacyDeadStock({ idle_days: "90" }),
  });

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      sortable: true,
      searchable: true,
      accessor: (row: PharmacyDeadStockRow) => row.drug_name,
      render: (row: PharmacyDeadStockRow) => <Text size="sm">{row.drug_name}</Text>,
    },
    {
      key: "current_stock",
      label: "Stock",
      sortable: true,
      sortValue: (row: PharmacyDeadStockRow) => row.current_stock,
      accessor: (row: PharmacyDeadStockRow) => row.current_stock,
      render: (row: PharmacyDeadStockRow) => <Text size="sm">{row.current_stock}</Text>,
    },
    {
      key: "stock_value",
      label: "Value",
      sortable: true,
      sortValue: (row: PharmacyDeadStockRow) => Number(row.stock_value),
      accessor: (row: PharmacyDeadStockRow) => Number(row.stock_value),
      render: (row: PharmacyDeadStockRow) => (
        <Text size="sm">{renderPharmacySensitiveCurrency(valueAccess, row.stock_value)}</Text>
      ),
    },
    {
      key: "last_dispensed_date",
      label: "Last Dispensed",
      render: (row: PharmacyDeadStockRow) => (
        <Text size="sm">
          {row.last_dispensed_date
            ? new Date(row.last_dispensed_date).toLocaleDateString()
            : "Never"}
        </Text>
      ),
    },
    {
      key: "days_idle",
      label: "Days Idle",
      sortable: true,
      sortValue: (row: PharmacyDeadStockRow) => row.days_idle ?? -1,
      accessor: (row: PharmacyDeadStockRow) => row.days_idle ?? "",
      render: (row: PharmacyDeadStockRow) => (
        <Badge size="sm" tone="warning">
          {row.days_idle ?? "N/A"}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={isLoading}
      rowKey={(row) => row.drug_name}
      searchable
      searchPlaceholder="Search dead stock"
      exportable
      exportFileName="pharmacy-dead-stock"
    />
  );
}

// ══════════════════════════════════════════════════════════
//  Stores & Transfers Tab
// ══════════════════════════════════════════════════════════
