// IPD BatchLedgerView — split from pharmacy.tsx (pure move).

import { Text } from "@mantine/core";
import { useFieldAccess } from "@medbrains/stores";
import type { PharmacyBatch } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { renderPharmacySensitiveValue } from "./shared";

export function BatchLedgerView() {
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["pharmacy-batches"],
    queryFn: () => pharmacyService.listPharmacyBatches(),
  });

  const columns = [
    {
      key: "batch_number",
      label: "Batch #",
      searchable: true,
      accessor: (row: PharmacyBatch) => row.batch_number,
      render: (row: PharmacyBatch) => (
        <Text fw={500} size="sm">
          {renderPharmacySensitiveValue(batchNumberAccess, row.batch_number)}
        </Text>
      ),
    },
    {
      key: "expiry_date",
      label: "Expiry",
      sortable: true,
      sortValue: (row: PharmacyBatch) => row.expiry_date,
      accessor: (row: PharmacyBatch) => row.expiry_date,
      render: (row: PharmacyBatch) => {
        const days = Math.ceil((new Date(row.expiry_date).getTime() - Date.now()) / 86400000);
        return (
          <Text size="sm" c={days < 30 ? "danger" : days < 60 ? "orange" : undefined}>
            {row.expiry_date}
          </Text>
        );
      },
    },
    {
      key: "quantity_received",
      label: "Received",
      render: (row: PharmacyBatch) => <Text size="sm">{row.quantity_received}</Text>,
    },
    {
      key: "quantity_dispensed",
      label: "Dispensed",
      render: (row: PharmacyBatch) => <Text size="sm">{row.quantity_dispensed}</Text>,
    },
    {
      key: "quantity_on_hand",
      label: "On Hand",
      sortable: true,
      sortValue: (row: PharmacyBatch) => row.quantity_on_hand,
      accessor: (row: PharmacyBatch) => row.quantity_on_hand,
      render: (row: PharmacyBatch) => (
        <Badge size="sm" tone={row.quantity_on_hand <= 0 ? "danger" : "success"}>
          {row.quantity_on_hand}
        </Badge>
      ),
    },
    {
      key: "store_location_id",
      label: "Location",
      render: (row: PharmacyBatch) => (
        <Text size="sm">{row.store_location_id?.slice(0, 8) ?? "\u2014"}</Text>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={batches}
      loading={isLoading}
      rowKey={(row) => row.id}
      searchable
      searchPlaceholder="Search batches"
      exportable
      exportFileName="pharmacy-batches"
    />
  );
}

// Compact expiry cell for inline use inside order detail tables. Color
// matches the NearExpiryView convention: red < 30d, orange < 60d.
