// IPD TransfersView — split from pharmacy.tsx (pure move).

import { DataTable, TableValueBadge } from "@/components";
import { Alert, IconButton, toast } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { Group, Text, Tooltip } from "@mantine/core";
import type { PharmacyTransferRequest } from "@medbrains/types";
import { IconCheck, IconPackageImport, IconTruck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function TransfersView({
  canViewStores,
  canManage,
}: {
  canViewStores: boolean;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["pharmacy-transfers"],
    queryFn: () => pharmacyService.listPharmacyTransfers(),
    enabled: canViewStores,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => pharmacyService.approvePharmacyTransfer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-transfers"] });
      toast.success("Transfer request approved", { title: "Transfer Approved" });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: (id: string) => pharmacyService.dispatchPharmacyTransfer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-transfers"] });
      toast.success("Stock dispatched (FEFO) from the source pharmacy", { title: "Dispatched" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Dispatch failed" }),
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => pharmacyService.receivePharmacyTransfer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-transfers"] });
      toast.success("Stock received at the destination pharmacy", { title: "Received" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Receive failed" }),
  });

  const transferStatusColors: Record<string, string> = {
    draft: "gray",
    approved: "primary",
    dispatched: "warning",
    received: "success",
    transferred: "success",
    cancelled: "danger",
  };

  const columns = [
    {
      key: "from_location_id",
      label: "From",
      searchable: true,
      accessor: (row: PharmacyTransferRequest) => row.from_location_id,
      render: (row: PharmacyTransferRequest) => (
        <Text size="sm">{row.from_location_id.slice(0, 8)}...</Text>
      ),
    },
    {
      key: "to_location_id",
      label: "To",
      searchable: true,
      accessor: (row: PharmacyTransferRequest) => row.to_location_id,
      render: (row: PharmacyTransferRequest) => (
        <Text size="sm">{row.to_location_id.slice(0, 8)}...</Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: PharmacyTransferRequest) => row.status,
      render: (row: PharmacyTransferRequest) => (
        <TableValueBadge
          value={row.status}
          kind="stock"
          color={transferStatusColors[row.status] ?? "gray"}
          size="xs"
          variant="filled"
        />
      ),
    },
    {
      key: "created_at",
      label: "Date",
      sortable: true,
      sortValue: (row: PharmacyTransferRequest) => row.created_at,
      accessor: (row: PharmacyTransferRequest) => new Date(row.created_at).toLocaleDateString(),
      render: (row: PharmacyTransferRequest) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: PharmacyTransferRequest) => (
        <Group gap="xs">
          {canManage && row.status === "draft" && (
            <Tooltip label="Approve">
              <IconButton
                tone="success"
                aria-label="Approve store transfer"
                onClick={() => approveMutation.mutate(row.id)}
              >
                <IconCheck size={16} />
              </IconButton>
            </Tooltip>
          )}
          {canManage && row.status === "approved" && (
            <Tooltip label="Dispatch (FEFO from source)">
              <IconButton
                tone="primary"
                aria-label="Dispatch store transfer"
                onClick={() => dispatchMutation.mutate(row.id)}
              >
                <IconTruck size={16} />
              </IconButton>
            </Tooltip>
          )}
          {canManage && row.status === "dispatched" && (
            <Tooltip label="Receive at destination">
              <IconButton
                tone="success"
                aria-label="Receive store transfer"
                onClick={() => receiveMutation.mutate(row.id)}
              >
                <IconPackageImport size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return canViewStores ? (
    <DataTable
      columns={columns}
      data={transfers}
      loading={isLoading}
      rowKey={(row) => row.id}
      searchable
      searchPlaceholder="Search transfers"
      exportable
      exportFileName="pharmacy-transfers"
    />
  ) : (
    <Alert tone="warning">
      Transfer queue requires `pharmacy.stores.list` or `pharmacy.stores.manage`.
    </Alert>
  );
}

// ══════════════════════════════════════════════════════════
//  Analytics & Reports Tab
// ══════════════════════════════════════════════════════════
