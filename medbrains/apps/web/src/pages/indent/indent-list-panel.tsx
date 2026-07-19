// INDENT IndentListPanel — split from indent.tsx (pure move).

import { Drawer, Group, NumberInput, Stack, Stepper, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type {
  ApproveIndentItemInput,
  IndentRequisition,
  IndentRequisitionDetailResponse,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconEye, IconSend, IconTruckDelivery, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, StatusDot, useClinicalEmit } from "@/components";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";
import { indentService } from "@/services/indent.service";
import { colorToBadgeTone, indentTypeLabels, statusColors, statusToStep } from "./shared";

const priorityColors: Record<string, string> = {
  normal: "slate",
  urgent: "orange",
  emergency: "danger",
};

function indentWorkflowPayload(
  requisition: IndentRequisition,
  actorKey: "approved_by" | "issued_by" | "requested_by",
  actorId?: string | null,
  itemsCount?: number,
): Record<string, unknown> {
  return {
    requisition_id: requisition.id,
    indent_number: requisition.indent_number,
    department_id: requisition.department_id,
    indent_type: requisition.indent_type,
    priority: requisition.priority,
    status: requisition.status,
    total_amount: requisition.total_amount,
    ...(itemsCount == null ? {} : { items_count: itemsCount }),
    [actorKey]: actorId ?? requisition.requested_by,
  };
}

function IndentDetailView({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const canApprove = useHasPermission(P.INDENT.APPROVE);
  const canStock = useHasPermission(P.INDENT.STOCK_MANAGE);
  const canCreate = useHasPermission(P.INDENT.CREATE);

  const { data, isLoading } = useQuery({
    queryKey: ["indent-requisition", id],
    queryFn: () => indentService.getIndentRequisition(id),
  });

  const emit = useClinicalEmit();

  const submitMutation = useMutation({
    mutationFn: () => indentService.submitIndentRequisition(id),
    onSuccess: (result) => {
      toast.success("Indent submitted for approval", { title: "Submitted" });
      emit("indent.requisition.submitted", indentWorkflowPayload(result, "requested_by"));
      void queryClient.invalidateQueries({ queryKey: ["indent-requisition"] });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => indentService.rejectIndentRequisition(id),
    onSuccess: () => {
      toast.error("Indent rejected", { title: "Rejected" });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisition"] });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => indentService.cancelIndentRequisition(id),
    onSuccess: () => {
      toast.warning("Indent cancelled", { title: "Cancelled" });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisition"] });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
      onClose();
    },
  });

  if (isLoading || !data) return <Text>Loading...</Text>;

  const { requisition, items } = data;
  const step = statusToStep(requisition.status);

  return (
    <Stack>
      <Stepper active={step} size="xs">
        <Stepper.Step label="Draft" />
        <Stepper.Step label="Submitted" />
        <Stepper.Step label="Approved" />
        <Stepper.Step label="Issued" />
        <Stepper.Step label="Closed" />
      </Stepper>

      <Group>
        <Badge tone={colorToBadgeTone(statusColors[requisition.status])} variant="filled">
          {requisition.status.replace(/_/g, " ")}
        </Badge>
        <Badge tone={colorToBadgeTone(priorityColors[requisition.priority])} variant="outline">
          {requisition.priority}
        </Badge>
        <Badge tone="neutral">
          {indentTypeLabels[requisition.indent_type] ?? requisition.indent_type}
        </Badge>
      </Group>

      <Text size="sm" c="dimmed">
        Indent #{requisition.indent_number}
      </Text>
      {requisition.notes && <Text size="sm">{requisition.notes}</Text>}

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Requested</Table.Th>
            <Table.Th>Approved</Table.Th>
            <Table.Th>Issued</Table.Th>
            <Table.Th>Price</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.item_name}</Table.Td>
              <Table.Td>{item.quantity_requested}</Table.Td>
              <Table.Td>{item.quantity_approved}</Table.Td>
              <Table.Td>{item.quantity_issued}</Table.Td>
              <Table.Td>₹{item.total_price}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Text fw={600}>Total: ₹{requisition.total_amount}</Text>

      <Group>
        {requisition.status === "draft" && canCreate && (
          <>
            <Button
              tone="primary"
              leftSection={<IconSend size={16} />}
              loading={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              Submit
            </Button>
            <Button
              tone="subtle-danger"
              leftSection={<IconX size={16} />}
              loading={cancelMutation.isPending}
              onClick={() =>
                confirmDestructive({
                  title: "Cancel indent",
                  message: "Cancel this indent? This cannot be undone.",
                  confirmLabel: "Cancel indent",
                  cancelLabel: "Keep",
                  onConfirm: () => cancelMutation.mutate(),
                })
              }
            >
              Cancel
            </Button>
          </>
        )}

        {requisition.status === "submitted" && canApprove && (
          <>
            <ApproveButton requisitionId={id} items={items} />
            <Button
              tone="subtle-danger"
              leftSection={<IconX size={16} />}
              loading={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              Reject
            </Button>
          </>
        )}

        {["approved", "partially_approved", "partially_issued"].includes(requisition.status) &&
          canStock && <IssueButton requisitionId={id} items={items} />}
      </Group>
    </Stack>
  );
}

function ApproveButton({
  requisitionId,
  items,
}: {
  requisitionId: string;
  items: IndentRequisitionDetailResponse["items"];
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const [opened, { open, close }] = useDisclosure(false);
  const [approvals, setApprovals] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.quantity_requested])),
  );

  const mutation = useMutation({
    mutationFn: () => {
      const approveItems: ApproveIndentItemInput[] = items.map((i) => ({
        item_id: i.id,
        quantity_approved: approvals[i.id] ?? i.quantity_requested,
      }));
      return indentService.approveIndentRequisition(requisitionId, { items: approveItems });
    },
    onSuccess: (result) => {
      toast.success("Indent approved", { title: "Approved" });
      emit(
        "indent.requisition.approved",
        indentWorkflowPayload(
          result.requisition,
          "approved_by",
          result.requisition.approved_by ?? userId,
          result.items.length,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ["indent-requisition"] });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
      close();
    },
  });

  return (
    <>
      <Button tone="primary" leftSection={<IconCheck size={16} />} onClick={open}>
        Approve
      </Button>
      <Drawer
        opened={opened}
        onClose={close}
        title="Approve Indent Items"
        position="right"
        size="xl"
      >
        <Stack>
          {items.map((item) => (
            <Group key={item.id}>
              <Text size="sm" style={{ flex: 1 }}>
                {item.item_name}
              </Text>
              <NumberInput
                size="xs"
                w={80}
                min={0}
                max={item.quantity_requested}
                value={approvals[item.id] ?? item.quantity_requested}
                onChange={(v) => setApprovals((prev) => ({ ...prev, [item.id]: Number(v) }))}
              />
              <Text size="xs" c="dimmed">
                / {item.quantity_requested}
              </Text>
            </Group>
          ))}
          <Button tone="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Confirm Approval
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

function IssueButton({
  requisitionId,
  items,
}: {
  requisitionId: string;
  items: IndentRequisitionDetailResponse["items"];
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const [opened, { open, close }] = useDisclosure(false);
  const [issues, setIssues] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.quantity_approved - i.quantity_issued])),
  );

  const mutation = useMutation({
    mutationFn: () => {
      const issueItems = items.map((i) => ({
        item_id: i.id,
        quantity_issued: issues[i.id] ?? 0,
      }));
      return indentService.issueIndentRequisition(requisitionId, { items: issueItems });
    },
    onSuccess: (result) => {
      toast.success("Items issued and stock updated", { title: "Issued" });
      emit(
        "indent.requisition.issued",
        indentWorkflowPayload(result.requisition, "issued_by", userId, result.items.length),
      );
      void queryClient.invalidateQueries({ queryKey: ["indent-requisition"] });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
      close();
    },
  });

  return (
    <>
      <Button tone="primary" leftSection={<IconTruckDelivery size={16} />} onClick={open}>
        Issue Items
      </Button>
      <Drawer opened={opened} onClose={close} title="Issue Indent Items" position="right" size="xl">
        <Stack>
          {items.map((item) => {
            const remaining = item.quantity_approved - item.quantity_issued;
            return (
              <Group key={item.id}>
                <Text size="sm" style={{ flex: 1 }}>
                  {item.item_name}
                </Text>
                <NumberInput
                  size="xs"
                  w={80}
                  min={0}
                  max={remaining}
                  value={issues[item.id] ?? remaining}
                  onChange={(v) => setIssues((prev) => ({ ...prev, [item.id]: Number(v) }))}
                />
                <Text size="xs" c="dimmed">
                  / {remaining} remaining
                </Text>
              </Group>
            );
          })}
          <Button tone="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Confirm Issue
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

export function IndentListPanel({
  status,
  requestedBy,
}: {
  status?: string;
  requestedBy?: string;
}) {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (status) params.status = status;
  if (requestedBy) params.requested_by = requestedBy;

  const { data, isLoading } = useQuery({
    queryKey: ["indent-requisitions", params],
    queryFn: () => indentService.listIndentRequisitions(params),
  });

  const columns = [
    {
      key: "indent_number",
      label: "Indent #",
      render: (row: IndentRequisition) => <Text fw={600}>{row.indent_number}</Text>,
    },
    {
      key: "indent_type",
      label: "Type",
      render: (row: IndentRequisition) => (
        <Badge tone="neutral">{indentTypeLabels[row.indent_type] ?? row.indent_type}</Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (row: IndentRequisition) => (
        <StatusDot color={priorityColors[row.priority] ?? "slate"} label={row.priority} size="sm" />
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: IndentRequisition) => (
        <StatusDot
          color={statusColors[row.status] ?? "slate"}
          label={row.status.replace(/_/g, " ")}
          size="sm"
        />
      ),
    },
    {
      key: "total_amount",
      label: "Amount",
      render: (row: IndentRequisition) => `₹${row.total_amount}`,
    },
    {
      key: "created_at",
      label: "Created",
      render: (row: IndentRequisition) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "",
      render: (row: IndentRequisition) => (
        <Tooltip label="View details">
          <IconButton
            onClick={() => {
              setDetailId(row.id);
              openDetail();
            }}
            aria-label="View details"
          >
            <IconEye size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.requisitions ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((data?.total ?? 0) / 20)}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyTitle="No indent requisitions found"
      />

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Indent Details"
        position="right"
        size="lg"
      >
        {detailId && <IndentDetailView id={detailId} onClose={closeDetail} />}
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Indent Detail View (Drawer)
// ══════════════════════════════════════════════════════════
