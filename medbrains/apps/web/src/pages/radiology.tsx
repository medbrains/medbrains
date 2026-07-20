import { Group, Select, Tabs, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { RadiologyOrder } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCalendar,
  IconChartBar,
  IconEye,
  IconPlus,
  IconPrinter,
  IconRadar,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ClinicalEventProvider,
  DataTable,
  PageHeader,
  StatusDot,
  useClinicalEmit,
} from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Badge, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm";
import { statusColor } from "@/lib/status-colors";
import { radiologyService } from "@/services/radiology.service";
import { AppointmentsTab } from "./radiology/appointments-tab";
import { CreateOrderDrawer } from "./radiology/create-order-drawer";
import { DicomStudiesTab } from "./radiology/dicom-studies-tab";
import { ModalitiesTab } from "./radiology/modalities-tab";
import { OrderDetailDrawer } from "./radiology/order-detail-drawer";
import { colorToBadgeTone, printRadiologyReportPacket, statusColors } from "./radiology/shared";
import { TatAnalyticsTab } from "./radiology/tat-analytics-tab";

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function RadiologyPage() {
  useRequirePermission(P.RADIOLOGY.ORDERS_LIST);

  return (
    <ClinicalEventProvider moduleCode="radiology" contextCode="radiology-orders">
      <Tabs defaultValue="orders">
        <Tabs.List>
          <Tabs.Tab value="orders" leftSection={<IconRadar size={16} />}>
            Orders
          </Tabs.Tab>
          <Tabs.Tab value="modalities">Modalities</Tabs.Tab>
          <Tabs.Tab value="appointments" leftSection={<IconCalendar size={16} />}>
            Appointments
          </Tabs.Tab>
          <Tabs.Tab value="dicom" leftSection={<IconEye size={16} />}>
            DICOM Studies
          </Tabs.Tab>
          <Tabs.Tab value="tat" leftSection={<IconChartBar size={16} />}>
            TAT Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="orders" pt="md">
          <RadiologyOrdersTab />
        </Tabs.Panel>
        <Tabs.Panel value="modalities" pt="md">
          <ModalitiesTab />
        </Tabs.Panel>
        <Tabs.Panel value="appointments" pt="md">
          <AppointmentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="dicom" pt="md">
          <DicomStudiesTab />
        </Tabs.Panel>
        <Tabs.Panel value="tat" pt="md">
          <TatAnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </ClinicalEventProvider>
  );
}

// ══════════════════════════════════════════════════════════
//  Orders Tab
// ══════════════════════════════════════════════════════════

function RadiologyOrdersTab() {
  const canCreate = useHasPermission(P.RADIOLOGY.ORDERS_CREATE);
  const canReport = useHasPermission(P.RADIOLOGY.REPORTS_CREATE);
  const canVerify = useHasPermission(P.RADIOLOGY.REPORTS_VERIFY);
  const canCancel = useHasPermission(P.RADIOLOGY.ORDERS_CANCEL);
  const canPrintReports = useHasPermission(P.RADIOLOGY.ORDERS_VIEW);
  const qc = useQueryClient();
  const emit = useClinicalEmit();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, createHandlers] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["radiology-orders", params],
    queryFn: () => radiologyService.listRadiologyOrders(params),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      radiologyService.cancelRadiologyOrder(id, { cancellation_reason: "Cancelled by user" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      notifications.show({ title: "Order cancelled", message: "", color: "danger" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not cancel order", message: e.message, color: "red" }),
  });

  const statusTransitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      radiologyService.updateRadiologyOrderStatus(id, status),
    onSuccess: (result, variables) => {
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      if (variables.status === "completed") {
        emit("radiology.order.completed", {
          body_part: result.body_part,
          encounter_id: result.encounter_id,
          modality_id: result.modality_id,
          order_id: result.id,
          patient_id: result.patient_id,
          priority: result.priority,
        });
      }
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not update status", message: e.message, color: "red" }),
  });

  const orders = data?.orders ?? [];
  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1;

  const columns = [
    {
      key: "patient_id" as const,
      label: "Patient",
      render: (o: RadiologyOrder) => <PatientNameCell patientId={o.patient_id} showUhid={false} />,
    },
    {
      key: "priority" as const,
      label: "Priority",
      render: (o: RadiologyOrder) => (
        <Badge size="xs" tone={colorToBadgeTone(statusColor(o.priority))}>
          {o.priority}
        </Badge>
      ),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (o: RadiologyOrder) => (
        <StatusDot label={o.status} color={statusColors[o.status] ?? "slate"} />
      ),
    },
    {
      key: "body_part" as const,
      label: "Body Part",
      render: (o: RadiologyOrder) => o.body_part ?? "—",
    },
    {
      key: "flags" as const,
      label: "Flags",
      render: (o: RadiologyOrder) => (
        <Group gap={4}>
          {o.contrast_required && (
            <Badge size="xs" tone="warning">
              Contrast
            </Badge>
          )}
          {o.allergy_flagged && (
            <Badge size="xs" tone="danger">
              Allergy
            </Badge>
          )}
          {o.pregnancy_checked && (
            <Badge size="xs" tone="danger">
              Preg-Chk
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "created_at" as const,
      label: "Date",
      render: (o: RadiologyOrder) => new Date(o.created_at).toLocaleDateString(),
    },
    {
      key: "actions" as const,
      label: "",
      render: (o: RadiologyOrder) => (
        <Group gap={4}>
          <Tooltip label="View">
            <IconButton tone="default" onClick={() => setDetailId(o.id)} aria-label="View details">
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
          {o.status === "ordered" && canCancel && (
            <Tooltip label="Cancel">
              <IconButton
                tone="danger"
                onClick={() =>
                  confirmDestructive({
                    title: "Cancel order",
                    message: "Cancel this order? This cannot be undone.",
                    confirmLabel: "Cancel order",
                    cancelLabel: "Keep",
                    onConfirm: () => cancelMutation.mutate(o.id),
                  })
                }
                aria-label="Close"
              >
                <IconX size={16} />
              </IconButton>
            </Tooltip>
          )}
          {canPrintReports && o.status === "verified" && (
            <Tooltip label="Print report">
              <IconButton
                tone="success"
                onClick={() => {
                  void printRadiologyReportPacket(o.id);
                }}
                aria-label="Print report"
              >
                <IconPrinter size={16} />
              </IconButton>
            </Tooltip>
          )}
          {o.status === "ordered" && (
            <Button
              tone="secondary"
              size="xs"
              onClick={() => statusTransitionMutation.mutate({ id: o.id, status: "in_progress" })}
            >
              Start
            </Button>
          )}
          {o.status === "in_progress" && (
            <Button
              tone="secondary"
              size="xs"
              onClick={() => statusTransitionMutation.mutate({ id: o.id, status: "completed" })}
            >
              Complete
            </Button>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Radiology Orders"
        subtitle="Imaging order management"
        actions={
          <Group>
            <Select
              placeholder="Filter by status"
              clearable
              size="xs"
              w={160}
              data={[
                "ordered",
                "scheduled",
                "in_progress",
                "completed",
                "reported",
                "verified",
                "cancelled",
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            {canCreate && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                size="xs"
                onClick={createHandlers.open}
              >
                New Order
              </Button>
            )}
          </Group>
        }
      />

      <DataTable
        columns={columns}
        data={orders}
        rowKey={(o) => o.id}
        loading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <CreateOrderDrawer opened={createOpen} onClose={createHandlers.close} />

      {detailId && (
        <OrderDetailDrawer
          id={detailId}
          onClose={() => setDetailId(null)}
          canReport={canReport}
          canVerify={canVerify}
          canPrintReports={canPrintReports}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Create Order Drawer
// ══════════════════════════════════════════════════════════
