// IPD ConsumptionView — split from pharmacy.tsx (pure move).

import { Text } from "@mantine/core";
import { useFieldAccess } from "@medbrains/stores";
import type { PharmacyConsumptionRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable, TableValueBadge } from "@/components";
import { pharmacyService } from "@/services/pharmacy.service";
import { renderPharmacySensitiveCurrency } from "./shared";

export function ConsumptionView() {
  const valueAccess = useFieldAccess("pharmacy.analytics.value");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-consumption"],
    queryFn: () => pharmacyService.getPharmacyConsumption(),
  });

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      sortable: true,
      searchable: true,
      accessor: (row: PharmacyConsumptionRow) => row.drug_name,
      render: (row: PharmacyConsumptionRow) => <Text size="sm">{row.drug_name}</Text>,
    },
    {
      key: "category",
      label: "Category",
      searchable: true,
      accessor: (row: PharmacyConsumptionRow) => row.category ?? "",
      render: (row: PharmacyConsumptionRow) =>
        row.category ? <TableValueBadge value={row.category} kind="pharmacy" /> : "\u2014",
    },
    {
      key: "total_dispensed",
      label: "Total Dispensed",
      sortable: true,
      sortValue: (row: PharmacyConsumptionRow) => row.total_dispensed,
      accessor: (row: PharmacyConsumptionRow) => row.total_dispensed,
      render: (row: PharmacyConsumptionRow) => (
        <Text size="sm" fw={700}>
          {row.total_dispensed}
        </Text>
      ),
    },
    {
      key: "total_value",
      label: "Total Value",
      sortable: true,
      sortValue: (row: PharmacyConsumptionRow) => Number(row.total_value),
      accessor: (row: PharmacyConsumptionRow) => Number(row.total_value),
      render: (row: PharmacyConsumptionRow) => (
        <Text size="sm">{renderPharmacySensitiveCurrency(valueAccess, row.total_value)}</Text>
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
      searchPlaceholder="Search consumption"
      exportable
      exportFileName="pharmacy-consumption"
    />
  );
}
