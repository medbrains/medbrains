// Pharmacy-finance MarginsTab — split from pharmacy-finance.tsx (pure move).

import { Text } from "@mantine/core";
import type { FieldAccessLevel } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone } from "@/components/ui";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";
import { financeAmountText } from "./shared";

interface DrugMarginRow {
  id: string;
  drug_id: string;
  drug_name?: string | null;
  snapshot_date: string;
  sale_price: string;
  margin_pct: string;
  qty_sold: number;
  revenue: string;
  margin_total: string;
}

function marginTone(pct: string): BadgeTone {
  const value = Number(pct);
  if (Number.isNaN(value)) return "neutral";
  if (value < 0) return "danger";
  if (value < 10) return "warning";
  return "success";
}

export function MarginsTab({ amountAccess }: { amountAccess: FieldAccessLevel }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["pharmacy-drug-margins"],
    queryFn: () =>
      pharmacyFinanceService.listDrugMargins({ limit: 500 }) as Promise<DrugMarginRow[]>,
  });

  const columns: Column<DrugMarginRow>[] = [
    {
      key: "snapshot_date",
      label: "Date",
      render: (r) => <Text size="sm">{r.snapshot_date}</Text>,
    },
    {
      key: "drug_name",
      label: "Drug",
      render: (r) => <Text size="sm">{r.drug_name || r.drug_id.slice(0, 8)}</Text>,
    },
    {
      key: "qty_sold",
      label: "Qty sold",
      render: (r) => <Text size="sm">{r.qty_sold}</Text>,
    },
    {
      key: "sale_price",
      label: "Sale price",
      render: (r) => <Text size="sm">{financeAmountText(amountAccess, r.sale_price)}</Text>,
    },
    {
      key: "margin_pct",
      label: "Margin %",
      render: (r) => (
        <Badge tone={marginTone(r.margin_pct)} size="sm">
          {r.margin_pct}%
        </Badge>
      ),
    },
    {
      key: "revenue",
      label: "Revenue",
      render: (r) => <Text size="sm">{financeAmountText(amountAccess, r.revenue)}</Text>,
    },
    {
      key: "margin_total",
      label: "Margin total",
      render: (r) => <Text size="sm">{financeAmountText(amountAccess, r.margin_total)}</Text>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isLoading}
      rowKey={(r) => r.id}
      emptyTitle="No margin data"
      emptyDescription="Daily drug-margin snapshots will appear here."
    />
  );
}
