// Pharmacy-finance FreeDispensingTab — split from pharmacy-finance.tsx (pure move).

import { Text } from "@mantine/core";
import type { FieldAccessLevel } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge } from "@/components/ui";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";
import { financeAmountText } from "./shared";

interface FreeDispensingRow {
  id: string;
  pharmacy_order_id: string;
  category: string;
  scheme_code?: string | null;
  cost_value: string;
  notes?: string | null;
  created_at: string;
}

export function FreeDispensingTab({ amountAccess }: { amountAccess: FieldAccessLevel }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["pharmacy-free-dispensings"],
    queryFn: () =>
      pharmacyFinanceService.listFreeDispensings({ limit: 200 }) as Promise<FreeDispensingRow[]>,
  });

  const columns: Column<FreeDispensingRow>[] = [
    {
      key: "created_at",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
    {
      key: "category",
      label: "Category",
      render: (r) => (
        <Badge tone="neutral" size="sm">
          {r.category}
        </Badge>
      ),
    },
    {
      key: "scheme_code",
      label: "Scheme",
      render: (r) => <Text size="sm">{r.scheme_code || "—"}</Text>,
    },
    {
      key: "cost_value",
      label: "Cost",
      render: (r) => <Text size="sm">{financeAmountText(amountAccess, r.cost_value)}</Text>,
    },
    {
      key: "notes",
      label: "Notes",
      render: (r) => (
        <Text size="sm" c="dimmed">
          {r.notes || "—"}
        </Text>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isLoading}
      rowKey={(r) => r.id}
      emptyTitle="No free dispensings"
      emptyDescription="Approved free or subsidised dispensings will appear here."
    />
  );
}

// ── Margins Tab ─────────────────────────────────────────────────────
