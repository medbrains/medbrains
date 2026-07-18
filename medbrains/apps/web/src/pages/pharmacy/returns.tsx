// Pharmacy PharmacyReturnsTab — split from pharmacy.tsx (pure move).

import { Group, SegmentedControl, Stack, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { PharmacyReturn, PharmacyReturnStatusType } from "@medbrains/types";
import { PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS } from "@medbrains/types";
import {
  IconCheck,
  IconLock,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { Column } from "@/components";
import { DataTable } from "@/components";
import { Alert, Badge, Button, IconButton, toast } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { CreatePharmacyReturnModal } from "./create-return-modal";
import type { ReturnFilterStatus } from "./shared";
import {
  isReturnFilterStatus,
  PharmacyPatientCell,
  returnStatusColors,
  returnStatusLabels,
  sharedColorBadgeTone,
} from "./shared";

export function PharmacyReturnsTab({
  canViewQueue,
  canRequest,
  canApprove,
  canVoidDispensing,
  canRestock,
  canDestroy,
  canReject,
  canViewPatientRecord,
}: {
  canViewQueue: boolean;
  canRequest: boolean;
  canApprove: boolean;
  canVoidDispensing: boolean;
  canRestock: boolean;
  canDestroy: boolean;
  canReject: boolean;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<ReturnFilterStatus>("all");
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["pharmacy-returns"],
    queryFn: () => pharmacyService.listPharmacyReturns(),
    enabled: canViewQueue,
  });

  const processMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PharmacyReturnStatusType }) =>
      pharmacyService.processPharmacyReturn(id, { status }),
    onSuccess: (_row, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-returns"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-order-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-credit-notes"] });
      const returnToastTitle = returnStatusLabels[variables.status];
      const returnToastColor = returnStatusColors[variables.status];
      if (returnToastColor === "green") {
        toast.success("Return queue updated", { title: returnToastTitle });
      } else if (returnToastColor === "red") {
        toast.error("Return queue updated", { title: returnToastTitle });
      } else if (returnToastColor === "yellow") {
        toast.warning("Return queue updated", { title: returnToastTitle });
      } else {
        toast.info("Return queue updated", { title: returnToastTitle });
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update return", {
        title: "Return action failed",
      });
    },
  });

  const filteredReturns = useMemo(
    () => (filterStatus === "all" ? returns : returns.filter((row) => row.status === filterStatus)),
    [filterStatus, returns],
  );
  const requestReturnAction = canRequest ? (
    canViewPatientRecord ? (
      <Button size="xs" tone="primary" leftSection={<IconPlus size={14} />} onClick={openCreate}>
        Request Return
      </Button>
    ) : (
      <Tooltip label="Patient record access is required to pick the return order">
        <span>
          <Button size="xs" tone="primary" leftSection={<IconLock size={14} />} disabled>
            Request Return
          </Button>
        </span>
      </Tooltip>
    )
  ) : undefined;

  const columns: Column<PharmacyReturn>[] = [
    {
      key: "patient_id",
      label: "Patient",
      searchable: true,
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: PharmacyReturn) => row.patient_id,
      fieldKind: "identifier",
      hiddenLabel: "Patient restricted",
      render: (row: PharmacyReturn) => (
        <PharmacyPatientCell
          patientId={row.patient_id}
          canViewPatientRecord={canViewPatientRecord}
        />
      ),
    },
    {
      key: "order_item_id",
      label: "Order Item",
      render: (row: PharmacyReturn) => (
        <Text size="sm" ff="JetBrains Mono, monospace">
          {row.order_item_id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: "quantity_returned",
      label: "Qty",
      sortable: true,
      sortValue: (row: PharmacyReturn) => row.quantity_returned,
      accessor: (row: PharmacyReturn) => row.quantity_returned,
      render: (row: PharmacyReturn) => <Text size="sm">{row.quantity_returned}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (row: PharmacyReturn) => (
        <Text size="sm" lineClamp={1}>
          {row.reason?.trim() || "—"}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: PharmacyReturn) => returnStatusLabels[row.status] ?? row.status,
      render: (row: PharmacyReturn) => (
        <Badge size="xs" tone={sharedColorBadgeTone(returnStatusColors[row.status])}>
          {returnStatusLabels[row.status]}
        </Badge>
      ),
    },
    {
      key: "created_at",
      label: "Requested",
      sortable: true,
      sortValue: (row: PharmacyReturn) => row.created_at,
      accessor: (row: PharmacyReturn) => new Date(row.created_at).toLocaleString(),
      render: (row: PharmacyReturn) => (
        <Text size="sm">{new Date(row.created_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: PharmacyReturn) => (
        <Group gap={4} wrap="nowrap">
          {row.status === "requested" && (
            <>
              <Tooltip
                label={
                  canApprove && canVoidDispensing
                    ? "Approve post-dispense reversal"
                    : "Return approval and dispensing void permissions required"
                }
              >
                <IconButton
                  size="sm"
                  tone="success"
                  disabled={!canApprove || !canVoidDispensing || processMutation.isPending}
                  onClick={() => processMutation.mutate({ id: row.id, status: "approved" })}
                  aria-label="Approve return"
                >
                  <IconCheck size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip label={canReject ? "Reject return" : "No reject permission"}>
                <IconButton
                  size="sm"
                  tone="danger"
                  disabled={!canReject || processMutation.isPending}
                  onClick={() => processMutation.mutate({ id: row.id, status: "rejected" })}
                  aria-label="Reject return"
                >
                  <IconX size={14} />
                </IconButton>
              </Tooltip>
            </>
          )}
          {row.status === "approved" && (
            <>
              <Tooltip label={canRestock ? "Return usable stock" : "No restock permission"}>
                <IconButton
                  size="sm"
                  tone="success"
                  disabled={!canRestock || processMutation.isPending}
                  onClick={() =>
                    processMutation.mutate({ id: row.id, status: "returned_to_stock" })
                  }
                  aria-label="Return to stock"
                >
                  <IconPackage size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip label={canDestroy ? "Mark as destroyed" : "No destroy permission"}>
                <IconButton
                  size="sm"
                  tone="danger"
                  disabled={!canDestroy || processMutation.isPending}
                  onClick={() => processMutation.mutate({ id: row.id, status: "destroyed" })}
                  aria-label="Destroy returned item"
                >
                  <IconTrash size={14} />
                </IconButton>
              </Tooltip>
            </>
          )}
          {row.status !== "requested" && row.status !== "approved" && (
            <Text size="xs" c="dimmed">
              Closed
            </Text>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Alert tone="info" icon={<IconReceipt size={16} />}>
        Medicine returns are linked to already dispensed/billed order lines. Use Custom credit notes
        for supplier returns, expiry/damage write-off, or manual financial adjustments.
      </Alert>
      {!canViewQueue && (
        <Alert tone="neutral" icon={<IconLock size={16} />}>
          Return queue access requires a return list, approval, restock, destroy, or rejection role.
          You can still request a return if that action is available.
        </Alert>
      )}
      <DataTable
        columns={columns}
        data={filteredReturns}
        loading={canViewQueue && isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search returns"
        exportable
        exportFileName="pharmacy-returns"
        toolbar={
          <SegmentedControl
            size="xs"
            value={filterStatus}
            disabled={!canViewQueue}
            onChange={(value) => {
              if (isReturnFilterStatus(value)) setFilterStatus(value);
            }}
            data={[
              { value: "all", label: "All" },
              { value: "requested", label: "Requested" },
              { value: "approved", label: "Approved" },
              { value: "returned_to_stock", label: "Restocked" },
              { value: "destroyed", label: "Destroyed" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        }
        tableActions={requestReturnAction}
      />
      <CreatePharmacyReturnModal
        opened={createOpened}
        onClose={closeCreate}
        canViewPatientRecord={canViewPatientRecord}
      />
    </Stack>
  );
}
