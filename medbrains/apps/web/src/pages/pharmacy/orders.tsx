// Pharmacy PharmacyOrdersTab — split from pharmacy.tsx (pure move).

import { Group, Select, Stack, Text, Tooltip } from "@mantine/core";
import type { PharmacyOrder } from "@medbrains/types";
import { P, PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS } from "@medbrains/types";
import { IconCheck, IconEye, IconPlus, IconShoppingCart, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { Column, SortState } from "@/components";
import { DataTable, StatusDot, TableValueBadge, useClinicalEmit } from "@/components";
import { Alert, Button, IconButton, toast } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { pharmacyService } from "@/services/pharmacy.service";
import {
  dispensingTypeLabels,
  PHARMACY_ORDER_STATUS_OPTIONS,
  PharmacyPatientCell,
  PharmacyPatientContext,
  pharmacyOrderEventItems,
  statusColors,
} from "./shared";

export function PharmacyOrdersTab({
  canViewOrders,
  canDispense,
  canCancelOrder,
  canViewOrderDetail,
  canViewPatientRecord,
  headerActions,
}: {
  canViewOrders: boolean;
  canDispense: boolean;
  canCancelOrder: boolean;
  canViewOrderDetail: boolean;
  canViewPatientRecord: boolean;
  headerActions?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [orderSort, setOrderSort] = useState<SortState | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const patientIdFilter = searchParams.get("patient_id") ?? "";
  const isDispenseHandoff = searchParams.get("action") === "dispense";
  const effectiveFilterStatus = filterStatus ?? (isDispenseHandoff ? "ordered" : null);
  const clearPharmacyHandoff = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };
  const setOrderStatusFilter = (value: string | null) => {
    setFilterStatus(value);
    if (isDispenseHandoff) {
      clearPharmacyHandoff();
    }
  };

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (effectiveFilterStatus) params.status = effectiveFilterStatus;
  if (patientIdFilter) params.patient_id = patientIdFilter;
  if (orderSort) {
    params.sort = orderSort.key;
    params.order = orderSort.dir;
  }

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-orders", params],
    queryFn: () => pharmacyService.listPharmacyOrders(params),
    enabled: canViewOrders,
  });

  const emit = useClinicalEmit();

  const dispenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const detail = await pharmacyService.getPharmacyOrder(id);
      const order = await pharmacyService.dispenseOrder(id);
      return { admissionId: detail.admission_id, items: detail.items, order };
    },
    onSuccess: ({ admissionId, items, order }, id) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", order.patient_id] });
      toast.success("Order dispensed and linked billing charges refreshed", {
        title: "Dispensed",
      });
      emit("pharmacy.order.dispensed", {
        admission_id: admissionId,
        dispensing_type: order.dispensing_type,
        encounter_id: order.encounter_id,
        items: pharmacyOrderEventItems(items),
        order_id: id,
        order_type: "pharmacy",
        patient_id: order.patient_id,
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not dispense order" }),
  });
  const orders = data?.orders ?? [];
  const firstDispensableOrder = orders.find((order) => order.status === "ordered");

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const detail = await pharmacyService.getPharmacyOrder(id);
      const order = await pharmacyService.cancelPharmacyOrder(id);
      return { admissionId: detail.admission_id, order };
    },
    onSuccess: ({ admissionId, order }, id) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", order.patient_id] });
      emit("order.cancelled", {
        admission_id: admissionId,
        dispensing_type: order.dispensing_type,
        encounter_id: order.encounter_id,
        order_id: id,
        order_type: "pharmacy",
        patient_id: order.patient_id,
        reason: "cancelled_from_pharmacy_queue",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not cancel order" }),
  });

  const columns: Column<PharmacyOrder>[] = [
    {
      key: "patient_id",
      label: "Patient",
      requiredPermissions: [P.PHARMACY.PRESCRIPTIONS_LIST],
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: PharmacyOrder) => row.patient_id,
      fieldKind: "identifier",
      hiddenLabel: "Patient restricted",
      render: (row: PharmacyOrder) => (
        <PharmacyPatientCell
          patientId={row.patient_id}
          canViewPatientRecord={canViewPatientRecord}
        />
      ),
    },
    {
      key: "dispensing_type",
      label: "Type",
      render: (row: PharmacyOrder) => (
        <TableValueBadge
          value={row.dispensing_type}
          kind="pharmacy"
          label={dispensingTypeLabels[row.dispensing_type] ?? row.dispensing_type}
          size="xs"
          color={
            row.dispensing_type === "otc"
              ? "teal"
              : row.dispensing_type === "emergency"
                ? "danger"
                : "primary"
          }
        />
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: PharmacyOrder) => (
        <StatusDot color={statusColors[row.status] ?? "gray"} label={row.status} />
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: PharmacyOrder) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      requiredPermissions: [
        P.PHARMACY.PRESCRIPTIONS_VIEW,
        P.PHARMACY.DISPENSING_CREATE,
        P.PHARMACY.DISPENSING_CANCEL,
      ],
      permissionMode: "any",
      render: (row: PharmacyOrder) => (
        <Group gap="xs">
          <Tooltip label={canViewOrderDetail ? "View" : "No permission to view order detail"}>
            <IconButton
              tone="primary"
              disabled={!canViewOrderDetail}
              aria-label="View pharmacy order"
              onClick={() => {
                if (!canViewOrderDetail) return;
                navigate(`/pharmacy/orders/${row.id}`);
              }}
            >
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
          {row.status === "ordered" && (
            <Group gap={4} wrap="nowrap">
              {canDispense && (
                <Tooltip label="Dispense">
                  <IconButton
                    tone="success"
                    aria-label="Dispense pharmacy order"
                    onClick={() => dispenseMutation.mutate(row.id)}
                  >
                    <IconCheck size={16} />
                  </IconButton>
                </Tooltip>
              )}
              {canCancelOrder && (
                <Tooltip label="Cancel">
                  <IconButton
                    tone="danger"
                    aria-label="Cancel pharmacy order"
                    onClick={() =>
                      confirmDestructive({
                        title: "Cancel order",
                        message: "Cancel this pharmacy order? This cannot be undone.",
                        confirmLabel: "Cancel order",
                        onConfirm: () => cancelMutation.mutate(row.id),
                      })
                    }
                  >
                    <IconX size={16} />
                  </IconButton>
                </Tooltip>
              )}
            </Group>
          )}
        </Group>
      ),
    },
  ] satisfies Column<PharmacyOrder>[];

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        {canViewOrders ? (
          <Select
            placeholder="Status"
            data={PHARMACY_ORDER_STATUS_OPTIONS}
            value={effectiveFilterStatus}
            onChange={setOrderStatusFilter}
            clearable
            w={160}
          />
        ) : (
          <Text size="sm" c="dimmed">
            Order queue requires prescription-list permission.
          </Text>
        )}
        <Group gap="xs">
          {headerActions}
          {canDispense && (
            <>
              <Button
                size="xs"
                tone="primary"
                leftSection={<IconPlus size={14} />}
                onClick={() =>
                  navigate(
                    patientIdFilter
                      ? `/pharmacy/orders/new?patient_id=${patientIdFilter}`
                      : "/pharmacy/orders/new",
                  )
                }
              >
                New Order
              </Button>
              <Button
                size="xs"
                tone="secondary"
                leftSection={<IconShoppingCart size={14} />}
                onClick={() => navigate("/pharmacy/otc-sale")}
              >
                OTC Sale
              </Button>
            </>
          )}
        </Group>
      </Group>

      {canViewOrders ? (
        <Stack>
          {patientIdFilter && (
            <PharmacyPatientContext
              patientId={patientIdFilter}
              canViewPatientRecord={canViewPatientRecord}
            />
          )}
          {isDispenseHandoff && (
            <Alert tone="success" title="Dispense handoff">
              <Group justify="space-between" align="center" gap="sm">
                <Text size="sm">
                  Ordered pharmacy items are filtered for this patient. Review FEFO and safety
                  context before dispensing.
                </Text>
                <Group gap="xs">
                  {firstDispensableOrder && canDispense && (
                    <Button
                      size="xs"
                      tone="primary"
                      leftSection={<IconCheck size={14} />}
                      loading={dispenseMutation.isPending}
                      onClick={() => dispenseMutation.mutate(firstDispensableOrder.id)}
                    >
                      Dispense First Order
                    </Button>
                  )}
                  {firstDispensableOrder && canViewOrderDetail && (
                    <Button
                      size="xs"
                      tone="secondary"
                      leftSection={<IconEye size={14} />}
                      onClick={() => navigate(`/pharmacy/orders/${firstDispensableOrder.id}`)}
                    >
                      Open Order
                    </Button>
                  )}
                  <Button size="xs" tone="ghost" onClick={clearPharmacyHandoff}>
                    Dismiss
                  </Button>
                </Group>
              </Group>
            </Alert>
          )}
          <DataTable
            columns={columns}
            data={orders}
            loading={isLoading}
            page={page}
            totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
            onPageChange={setPage}
            sort={orderSort}
            onSortChange={(next) => {
              setOrderSort(next);
              setPage(1);
            }}
            rowKey={(row) => row.id}
            virtualized="auto"
            virtualizeAt={40}
            virtualRowHeight={58}
            tableMaxHeight="calc(100vh - 360px)"
          />
        </Stack>
      ) : (
        <Alert tone="warning">
          This role can create or process pharmacy orders, but the order queue and patient list stay
          hidden until `pharmacy.prescriptions.list` is granted.
        </Alert>
      )}
    </Stack>
  );
}
