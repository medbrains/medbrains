import { Group, Stack, Text } from "@mantine/core";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import { type ExpiredBatchRow, P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { renderPharmacySensitiveValue } from "./shared";
import { WriteOffExpiredModal } from "./write-off-expired-modal";

/**
 * Stock past its date, apart from "expiring soon": it may not be dispensed at
 * all. Non-controlled batches are written off here under one witnessed
 * certificate; controlled drugs are marked and destroyed through the NDPS
 * register instead.
 */
export function ExpiredStockPanel() {
  const canManage = useHasPermission(P.PHARMACY.STOCK.MANAGE);
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const [writingOff, setWritingOff] = useState(false);
  const {
    data: rows = [],
    isError,
    isLoading,
  } = useQuery({
    queryKey: ["pharmacy-expired"],
    queryFn: () => pharmacyService.listExpiredBatches(),
    enabled: canManage,
  });

  if (!canManage || isLoading) return null;
  if (isError) {
    return (
      <Alert tone="warning" title="Expired stock could not be loaded">
        The list of expired batches did not load. Check again before dispensing from an old shelf.
      </Alert>
    );
  }
  if (rows.length === 0) return null;

  const destroyable = rows.filter((row) => !row.is_controlled).length;
  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      render: (row: ExpiredBatchRow) => (
        <Group gap="xs">
          <Text size="sm">{row.drug_name}</Text>
          {row.is_controlled && (
            <Badge tone="danger" size="xs">
              Controlled — destroy via NDPS register
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "batch_number",
      label: "Batch #",
      render: (row: ExpiredBatchRow) => (
        <Text size="sm">{renderPharmacySensitiveValue(batchNumberAccess, row.batch_number)}</Text>
      ),
    },
    {
      key: "expiry_date",
      label: "Expired on",
      render: (row: ExpiredBatchRow) => (
        <Text size="sm">
          {row.expiry_date} ({row.days_expired}d ago)
        </Text>
      ),
    },
    {
      key: "quantity_on_hand",
      label: "On hand",
      render: (row: ExpiredBatchRow) => <Text size="sm">{row.quantity_on_hand}</Text>,
    },
  ];

  return (
    <Stack data-testid="expired-stock-panel">
      <Alert tone="danger" title={`${rows.length} expired batch(es) — do not dispense`}>
        <Group justify="space-between" align="center">
          <Text size="sm">Quarantine these and destroy them with a witness.</Text>
          <Button
            tone="danger"
            size="xs"
            disabled={destroyable === 0}
            onClick={() => setWritingOff(true)}
            data-testid="write-off-expired"
          >
            Write off expired
          </Button>
        </Group>
      </Alert>
      <DataTable columns={columns} data={rows} rowKey={(row) => row.batch_id} />
      <WriteOffExpiredModal
        opened={writingOff}
        onClose={() => setWritingOff(false)}
        batchCount={destroyable}
      />
    </Stack>
  );
}
