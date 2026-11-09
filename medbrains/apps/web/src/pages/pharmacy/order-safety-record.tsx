import { Card, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { PharmacySafetyRecordRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { type Column, DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";

const ACTION_LABEL: Record<PharmacySafetyRecordRow["action_taken"], string> = {
  blocked: "Refused",
  overridden: "Overridden",
  warned: "Caution",
};

const ACTION_TONE = {
  blocked: "danger",
  overridden: "warning",
  warned: "info",
} as const;

/**
 * What the medication-safety gate filed on this order: refused dispenses
 * (a Schedule X without a witness), overrides with their reasons, cautions.
 * A drug inspector asks for exactly this, and before it was written only to a
 * table nobody could read.
 */
export function OrderSafetyRecord({ orderId }: { orderId: string }) {
  const canView = useHasPermission(P.PHARMACY.SAFETY_VIEW);
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["pharmacy-order-safety-record", orderId],
    queryFn: () => pharmacyService.getPharmacyOrderSafetyRecord(orderId),
    enabled: canView,
    // A refusal from the order list is filed while this screen is closed;
    // a cached empty record would hide it.
    refetchOnMount: "always",
  });
  if (!canView) return null;

  const columns = [
    {
      key: "action",
      label: "Outcome",
      render: (row: PharmacySafetyRecordRow) => (
        <Badge tone={ACTION_TONE[row.action_taken]}>{ACTION_LABEL[row.action_taken]}</Badge>
      ),
    },
    {
      key: "message",
      label: "Finding",
      render: (row: PharmacySafetyRecordRow) => (
        <Stack gap={2}>
          <Text size="sm">{row.message}</Text>
          {row.override_reason && (
            <Text size="xs" c="dimmed">
              Reason: {row.override_reason}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "who",
      label: "Checked",
      render: (row: PharmacySafetyRecordRow) => (
        <Text size="xs">
          {row.checked_by_name ?? "—"} · {new Date(row.checked_at).toLocaleString()}
        </Text>
      ),
    },
  ] satisfies Column<PharmacySafetyRecordRow>[];

  return (
    <Card withBorder padding="sm" component="section" aria-label="Safety record">
      <Text fw={700} size="sm" mb="xs">
        Safety record
      </Text>
      <DataTable<PharmacySafetyRecordRow>
        columns={columns}
        data={data}
        loading={isLoading}
        error={error}
        rowKey={(row) => row.id}
        emptyTitle="Nothing filed yet"
        emptyDescription="Refusals, overrides and cautions on this order appear here."
      />
    </Card>
  );
}
