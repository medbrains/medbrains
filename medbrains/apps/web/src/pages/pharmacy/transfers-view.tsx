// IPD TransfersView — split from pharmacy.tsx (pure move).

import { Group, Stack, Text, Tooltip } from "@mantine/core";
import type { PharmacyTransferRequest } from "@medbrains/types";
import { IconCheck, IconPackageImport, IconPlus, IconTruck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, TableValueBadge } from "@/components";
import { Alert, Button, IconButton, toast } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { TransferCreateDrawer } from "./transfer-create-drawer";

export function TransfersView({
  canViewStores,
  canManage,
}: {
  canViewStores: boolean;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);

  const {
    data: transfers = [],
    isLoading,
    isError: transfersFailed,
  } = useQuery({
    queryKey: ["pharmacy-transfers"],
    queryFn: () => pharmacyService.listPharmacyTransfers(),
    enabled: canViewStores,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => pharmacyService.listStoreLocations(),
    enabled: canViewStores,
  });

  // Index once: the From and To columns each need a name per row, and a
  // find() per cell would scan the store list twice for every transfer.
  const storeNames = useMemo(
    () => new Map(stores.map((store) => [store.id, store.name])),
    [stores],
  );

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
      accessor: (row: PharmacyTransferRequest) =>
        storeNames.get(row.from_location_id) ?? row.from_location_id,
      render: (row: PharmacyTransferRequest) => (
        <Text size="sm">{storeNames.get(row.from_location_id) ?? "Unknown store"}</Text>
      ),
    },
    {
      key: "to_location_id",
      label: "To",
      searchable: true,
      accessor: (row: PharmacyTransferRequest) =>
        storeNames.get(row.to_location_id) ?? row.to_location_id,
      render: (row: PharmacyTransferRequest) => (
        <Text size="sm">{storeNames.get(row.to_location_id) ?? "Unknown store"}</Text>
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

  if (!canViewStores) {
    return (
      <Alert tone="warning">
        Transfer queue requires `pharmacy.stores.list` or `pharmacy.stores.manage`.
      </Alert>
    );
  }

  // An empty transfer queue reads as "nothing is in transit", which a store
  // manager reorders against. An outage must not wear that answer.
  if (transfersFailed) {
    return (
      <Alert tone="danger" title="Transfers could not be loaded">
        The transfer queue is unavailable. This is not the same as having no transfers in flight —
        do not treat stock as settled until this list loads.
      </Alert>
    );
  }

  return (
    <Stack gap="sm">
      {canManage && (
        <Group justify="flex-end">
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreateOpen(true)}
          >
            New transfer
          </Button>
        </Group>
      )}
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
      <TransferCreateDrawer opened={createOpen} onClose={() => setCreateOpen(false)} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Analytics & Reports Tab
// ══════════════════════════════════════════════════════════
