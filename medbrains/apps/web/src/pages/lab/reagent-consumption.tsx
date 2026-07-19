// Lab ReagentConsumptionSection — split from lab.tsx (pure move).

import { Stack, Text } from "@mantine/core";
import type { ReagentConsumptionRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { labService } from "@/services/lab.service";

export function ReagentConsumptionSection() {
  const { t } = useTranslation("lab");
  const { data: consumption = [], isLoading } = useQuery({
    queryKey: ["lab-reagent-consumption"],
    queryFn: () => labService.getReagentConsumption(),
  });

  const columns = [
    {
      key: "reagent_name",
      label: "Reagent",
      render: (row: ReagentConsumptionRow) => <Text fw={500}>{row.reagent_name}</Text>,
    },
    {
      key: "lot_number",
      label: "Lot #",
      render: (row: ReagentConsumptionRow) => <Text size="sm">{row.lot_number}</Text>,
    },
    {
      key: "quantity",
      label: "Qty",
      render: (row: ReagentConsumptionRow) => (
        <Text size="sm">
          {row.quantity != null ? `${row.quantity} ${row.quantity_unit ?? ""}` : "—"}
        </Text>
      ),
    },
    {
      key: "reorder_level",
      label: "Reorder",
      render: (row: ReagentConsumptionRow) => <Text size="sm">{row.reorder_level ?? "—"}</Text>,
    },
    {
      key: "consumption_per_test",
      label: "Per Test",
      render: (row: ReagentConsumptionRow) => (
        <Text size="sm">{row.consumption_per_test ?? "—"}</Text>
      ),
    },
    {
      key: "below_reorder",
      label: "Status",
      render: (row: ReagentConsumptionRow) => {
        if (row.reorder_level == null || row.quantity == null)
          return (
            <Text size="sm" c="dimmed">
              —
            </Text>
          );
        return row.quantity <= row.reorder_level ? (
          <Badge tone="danger" size="sm">
            Below Reorder
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            OK
          </Badge>
        );
      },
    },
    {
      key: "expiry_date",
      label: "Expiry",
      render: (row: ReagentConsumptionRow) => {
        if (!row.expiry_date) return <Text size="sm">—</Text>;
        const isExpired = new Date(row.expiry_date) < new Date();
        return (
          <Badge tone={isExpired ? "danger" : "success"} size="sm">
            {row.expiry_date}
          </Badge>
        );
      },
    },
  ];

  return (
    <Stack>
      <Text fw={600}>{t("reagentConsumption&ReorderReport")}</Text>
      <DataTable
        columns={columns}
        data={consumption}
        loading={isLoading}
        rowKey={(row) => row.id}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  TAT Analytics Section (Batch 2)
// ══════════════════════════════════════════════════════════
