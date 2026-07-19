// IPD VendorPerformancePanel — split from procurement.tsx (pure move).

import { Group, Modal, Select, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { VendorComparisonRow, VendorPerformanceRow } from "@medbrains/types";
import { IconChartBar } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button } from "@/components/ui";
import { procurementService } from "@/services/procurement.service";

function VendorComparisonView({
  itemId,
  onItemChange,
}: {
  itemId: string;
  onItemChange: (id: string) => void;
}) {
  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => procurementService.listStoreCatalog({ active_only: "true" }),
  });

  const { data: comparison, isLoading } = useQuery({
    queryKey: ["vendor-comparison", itemId],
    queryFn: () => procurementService.getVendorComparison(itemId),
    enabled: !!itemId,
  });

  const columns = [
    {
      key: "vendor_name",
      label: "Vendor",
      render: (row: VendorComparisonRow) => <Text fw={600}>{row.vendor_name}</Text>,
    },
    {
      key: "item_name",
      label: "Item",
      render: (row: VendorComparisonRow) => row.item_name,
    },
    {
      key: "unit_price",
      label: "Unit Price",
      render: (row: VendorComparisonRow) => `₹${row.unit_price}`,
    },
    {
      key: "delivery_days",
      label: "Delivery (days)",
      render: (row: VendorComparisonRow) => row.delivery_days ?? "-",
    },
    {
      key: "rejection_rate",
      label: "Rejection Rate",
      render: (row: VendorComparisonRow) => {
        if (row.rejection_rate == null) return "-";
        const rate = Number(row.rejection_rate);
        const tone = rate <= 5 ? "success" : rate <= 15 ? "warning" : "danger";
        return (
          <Badge tone={tone} size="sm">
            {row.rejection_rate}%
          </Badge>
        );
      },
    },
  ];

  return (
    <Stack>
      <Select
        label="Select Catalog Item"
        placeholder="Choose an item to compare vendors"
        data={(catalog ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
        value={itemId || null}
        onChange={(v) => onItemChange(v ?? "")}
        searchable
      />

      {itemId && (
        <DataTable
          columns={columns}
          data={comparison ?? []}
          loading={isLoading}
          rowKey={(row) => `${row.vendor_name}-${row.item_name}`}
          emptyTitle="No comparison data for this item"
        />
      )}
    </Stack>
  );
}

export function VendorPerformancePanel() {
  const [compareOpened, { open: openCompare, close: closeCompare }] = useDisclosure(false);
  const [compareItemId, setCompareItemId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-performance"],
    queryFn: () => procurementService.getVendorPerformance(),
  });

  const columns = [
    {
      key: "vendor_name",
      label: "Vendor",
      render: (row: VendorPerformanceRow) => <Text fw={600}>{row.vendor_name}</Text>,
    },
    {
      key: "total_orders",
      label: "Orders",
      render: (row: VendorPerformanceRow) => row.total_orders,
    },
    {
      key: "on_time_pct",
      label: "On-Time %",
      render: (row: VendorPerformanceRow) => {
        const pct = Number(row.on_time_pct);
        const tone = pct >= 80 ? "success" : pct >= 60 ? "warning" : "danger";
        return <Badge tone={tone}>{row.on_time_pct}%</Badge>;
      },
    },
    {
      key: "rejection_rate",
      label: "Rejection Rate",
      render: (row: VendorPerformanceRow) => {
        const rate = Number(row.rejection_rate);
        const tone = rate <= 5 ? "success" : rate <= 15 ? "warning" : "danger";
        return <Badge tone={tone}>{row.rejection_rate}%</Badge>;
      },
    },
    {
      key: "avg_delivery_days",
      label: "Avg Delivery (days)",
      render: (row: VendorPerformanceRow) => row.avg_delivery_days,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button tone="secondary" leftSection={<IconChartBar size={16} />} onClick={openCompare}>
          Compare Vendors
        </Button>
      </Group>

      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.vendor_name}
        emptyTitle="No vendor performance data"
      />

      <Modal
        opened={compareOpened}
        onClose={closeCompare}
        title="Compare Vendors by Item"
        closeButtonProps={{ "aria-label": "Close Compare Vendors" }}
        size="lg"
      >
        <VendorComparisonView itemId={compareItemId} onItemChange={setCompareItemId} />
      </Modal>
    </>
  );
}
