// OPD PharmacyDispatchTab — split from opd.tsx (pure move).

import { Stack, Text } from "@mantine/core";
import type { PharmacyDispatchStatus as PharmacyDispatchStatusRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import type { BadgeTone } from "@/components/ui";
import { Badge } from "@/components/ui";
import { opdService } from "@/services/opd.service";

export function PharmacyDispatchTab({ encounterId }: { encounterId: string }) {
  const { data: dispatch = [], isLoading } = useQuery({
    queryKey: ["opd-pharmacy-dispatch", encounterId],
    queryFn: () => opdService.opdPharmacyDispatchStatus(encounterId),
  });

  const dispatchStatusColors: Record<string, BadgeTone> = {
    pending: "neutral",
    partial: "warning",
    dispensed: "success",
    cancelled: "danger",
  };

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      render: (row: PharmacyDispatchStatusRow) => (
        <Text size="sm" fw={500}>
          {row.drug_name}
        </Text>
      ),
    },
    {
      key: "quantity_ordered",
      label: "Ordered",
      render: (row: PharmacyDispatchStatusRow) => <Text size="sm">{row.quantity_ordered}</Text>,
    },
    {
      key: "quantity_dispensed",
      label: "Dispensed",
      render: (row: PharmacyDispatchStatusRow) => <Text size="sm">{row.quantity_dispensed}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyDispatchStatusRow) => (
        <Badge tone={dispatchStatusColors[row.status] ?? "neutral"} variant="filled" size="sm">
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Text fw={600} size="sm">
        Pharmacy dispatch status for this visit
      </Text>
      <DataTable
        columns={columns}
        data={dispatch}
        loading={isLoading}
        rowKey={(row) => `${row.prescription_id}-${row.drug_name}`}
      />
      {!isLoading && dispatch.length === 0 && (
        <Text size="sm" c="dimmed">
          No prescriptions dispatched for this visit.
        </Text>
      )}
    </Stack>
  );
}

// ── Vitals ───────────────────────────────────────────────
