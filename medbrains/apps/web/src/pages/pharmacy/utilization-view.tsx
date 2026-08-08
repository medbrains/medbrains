// IPD UtilizationView — split from pharmacy.tsx (pure move).

import { Text } from "@mantine/core";
import type { DrugUtilizationRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";

export function UtilizationView() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-utilization"],
    queryFn: () => pharmacyService.getDrugUtilization(),
  });

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      sortable: true,
      searchable: true,
      accessor: (row: DrugUtilizationRow) => row.drug_name,
      render: (row: DrugUtilizationRow) => <Text size="sm">{row.drug_name}</Text>,
    },
    {
      key: "generic_name",
      label: "Generic",
      searchable: true,
      accessor: (row: DrugUtilizationRow) => row.generic_name ?? "",
      render: (row: DrugUtilizationRow) => <Text size="sm">{row.generic_name ?? "\u2014"}</Text>,
    },
    {
      key: "aware_category",
      label: "AWaRe",
      render: (row: DrugUtilizationRow) =>
        row.aware_category ? (
          <Badge
            size="xs"
            tone={
              row.aware_category === "reserve"
                ? "danger"
                : row.aware_category === "watch"
                  ? "warning"
                  : "success"
            }
          >
            {row.aware_category}
          </Badge>
        ) : (
          <Text size="sm">{"\u2014"}</Text>
        ),
    },
    {
      key: "total_dispensed",
      label: "Dispensed",
      sortable: true,
      sortValue: (row: DrugUtilizationRow) => row.total_dispensed,
      accessor: (row: DrugUtilizationRow) => row.total_dispensed,
      render: (row: DrugUtilizationRow) => (
        <Text size="sm" fw={700}>
          {row.total_dispensed}
        </Text>
      ),
    },
    {
      key: "unique_patients",
      label: "Patients",
      sortable: true,
      sortValue: (row: DrugUtilizationRow) => row.unique_patients,
      accessor: (row: DrugUtilizationRow) => row.unique_patients,
      render: (row: DrugUtilizationRow) => <Text size="sm">{row.unique_patients}</Text>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={isLoading}
      rowKey={(row) => row.drug_name}
      searchable
      searchPlaceholder="Search utilization"
      exportable
      exportFileName="pharmacy-utilization"
    />
  );
}

// ══════════════════════════════════════════════════════════
//  Rx Queue Tab (Phase 3)
// ══════════════════════════════════════════════════════════
