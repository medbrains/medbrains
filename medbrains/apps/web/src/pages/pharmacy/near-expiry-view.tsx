// IPD NearExpiryView — split from pharmacy.tsx (pure move).

import { Text } from "@mantine/core";
import { useFieldAccess } from "@medbrains/stores";
import type { NearExpiryRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { renderPharmacySensitiveValue } from "./shared";

export function NearExpiryView() {
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-near-expiry"],
    queryFn: () => pharmacyService.getNearExpiryReport({ days: "90" }),
  });

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      sortable: true,
      searchable: true,
      accessor: (row: NearExpiryRow) => row.drug_name,
      render: (row: NearExpiryRow) => <Text size="sm">{row.drug_name}</Text>,
    },
    {
      key: "batch_number",
      label: "Batch #",
      searchable: true,
      accessor: (row: NearExpiryRow) => row.batch_number,
      render: (row: NearExpiryRow) => (
        <Text size="sm">{renderPharmacySensitiveValue(batchNumberAccess, row.batch_number)}</Text>
      ),
    },
    {
      key: "expiry_date",
      label: "Expiry",
      sortable: true,
      sortValue: (row: NearExpiryRow) => row.expiry_date,
      accessor: (row: NearExpiryRow) => row.expiry_date,
      render: (row: NearExpiryRow) => (
        <Text
          size="sm"
          c={
            row.days_until_expiry < 30
              ? "danger"
              : row.days_until_expiry < 60
                ? "orange"
                : "warning"
          }
          fw={700}
        >
          {row.expiry_date}
        </Text>
      ),
    },
    {
      key: "quantity_on_hand",
      label: "On Hand",
      render: (row: NearExpiryRow) => <Text size="sm">{row.quantity_on_hand}</Text>,
    },
    {
      key: "days_until_expiry",
      label: "Days Left",
      sortable: true,
      sortValue: (row: NearExpiryRow) => row.days_until_expiry,
      accessor: (row: NearExpiryRow) => row.days_until_expiry,
      render: (row: NearExpiryRow) => (
        <Badge
          size="sm"
          tone={
            row.days_until_expiry < 30
              ? "danger"
              : row.days_until_expiry < 60
                ? "warning"
                : "warning"
          }
        >
          {row.days_until_expiry}d
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={isLoading}
      rowKey={(row) => `${row.batch_number}-${row.expiry_date}`}
      searchable
      searchPlaceholder="Search near-expiry"
      exportable
      exportFileName="pharmacy-near-expiry"
    />
  );
}
