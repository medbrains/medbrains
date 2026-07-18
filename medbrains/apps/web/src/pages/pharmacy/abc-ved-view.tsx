// IPD AbcVedView — split from pharmacy.tsx (pure move).

import { Text } from "@mantine/core";
import { useFieldAccess } from "@medbrains/stores";
import type { PharmacyAbcVedRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import type { BadgeTone } from "@/components/ui";
import { Badge } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { renderPharmacySensitiveCurrency } from "./shared";

export function AbcVedView() {
  const valueAccess = useFieldAccess("pharmacy.analytics.value");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-abc-ved"],
    queryFn: () => pharmacyService.getPharmacyAbcVed(),
  });

  const abcColors: Record<string, BadgeTone> = { A: "danger", B: "warning", C: "success" };
  const vedColors: Record<string, BadgeTone> = { V: "danger", E: "warning", D: "success" };

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      sortable: true,
      searchable: true,
      accessor: (row: PharmacyAbcVedRow) => row.drug_name,
      render: (row: PharmacyAbcVedRow) => <Text size="sm">{row.drug_name}</Text>,
    },
    {
      key: "annual_value",
      label: "Annual Value",
      sortable: true,
      sortValue: (row: PharmacyAbcVedRow) => Number(row.annual_value),
      accessor: (row: PharmacyAbcVedRow) => Number(row.annual_value),
      render: (row: PharmacyAbcVedRow) => (
        <Text size="sm">{renderPharmacySensitiveCurrency(valueAccess, row.annual_value)}</Text>
      ),
    },
    {
      key: "abc_class",
      label: "ABC",
      sortable: true,
      accessor: (row: PharmacyAbcVedRow) => row.abc_class,
      render: (row: PharmacyAbcVedRow) => (
        <Badge size="xs" tone={abcColors[row.abc_class] ?? "neutral"}>
          {row.abc_class}
        </Badge>
      ),
    },
    {
      key: "ved_class",
      label: "VED",
      render: (row: PharmacyAbcVedRow) =>
        row.ved_class ? (
          <Badge size="xs" tone={vedColors[row.ved_class] ?? "neutral"}>
            {row.ved_class}
          </Badge>
        ) : (
          <Text size="sm">{"\u2014"}</Text>
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
      searchPlaceholder="Search ABC-VED"
      exportable
      exportFileName="pharmacy-abc-ved"
    />
  );
}
