// A GRN's lines, and posting it to stock — the one moment received stock moves.

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { GrnIssue } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPackageImport } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Table, toast } from "@/components/ui";
import { procurementService } from "@/services/procurement.service";
import { colorToBadgeTone } from "./shared";

export const grnStatusColors: Record<string, string> = {
  draft: "slate",
  inspecting: "primary",
  accepted: "success",
  partially_accepted: "teal",
  rejected: "danger",
  completed: "violet",
};

const money = (value: number | string | null) => (value === null ? "-" : `₹${value}`);

interface GrnDetailViewProps {
  id: string;
  /** Findings returned when the draft was saved. */
  warnings?: GrnIssue[];
}

export function GrnDetailView({ id, warnings = [] }: GrnDetailViewProps) {
  const qc = useQueryClient();
  const canPost = useHasPermission(P.PROCUREMENT.GRN_POST);
  const { data, isLoading, error } = useQuery({
    queryKey: ["grn", id],
    queryFn: () => procurementService.getGrn(id),
  });
  const post = useMutation({
    mutationFn: () => procurementService.completeGrn(id),
    onSuccess: () => {
      toast.success("Posted. The stock is now in the store.", { title: "GRN posted" });
      for (const key of [["grn", id], ["grns"], ["purchase-orders"], ["batch-stock"]]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not post" }),
  });

  if (error) return <Alert tone="danger">Could not load this GRN: {error.message}</Alert>;
  if (isLoading || !data) return <Text>Loading…</Text>;
  const { grn, items } = data;
  const posted = grn.posted_at !== null;

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Badge tone={colorToBadgeTone(grnStatusColors[grn.status])} variant="filled">
            {posted ? "posted" : grn.status}
          </Badge>
          <Text size="sm" c="dimmed">
            GRN #{grn.grn_number}
          </Text>
        </Group>
        {canPost && !posted && (
          <Button
            tone="primary"
            leftSection={<IconPackageImport size={16} />}
            loading={post.isPending}
            onClick={() => post.mutate()}
          >
            Post to stock
          </Button>
        )}
      </Group>
      {!posted && (
        <Alert tone="info">
          This GRN is a draft. No stock has moved; it moves when the GRN is posted.
        </Alert>
      )}
      {warnings.map((w) => (
        <Alert key={w.field + w.message} tone="warning">
          {w.message}
        </Alert>
      ))}
      <Text size="sm">Receipt date: {grn.receipt_date}</Text>
      {grn.invoice_number && (
        <Text size="sm">
          Invoice {grn.invoice_number}
          {grn.invoice_date ? ` of ${grn.invoice_date}` : ""} · {money(grn.invoice_amount)}
        </Text>
      )}

      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Batch</Table.Th>
            <Table.Th>Expiry</Table.Th>
            <Table.Th>Accepted</Table.Th>
            <Table.Th>Free</Table.Th>
            <Table.Th>Rejected</Table.Th>
            <Table.Th>Rate</Table.Th>
            <Table.Th>MRP</Table.Th>
            <Table.Th>GST</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.item_name}</Table.Td>
              <Table.Td>{item.batch_number ?? "-"}</Table.Td>
              <Table.Td>{item.expiry_date ?? "-"}</Table.Td>
              <Table.Td>{item.quantity_accepted}</Table.Td>
              <Table.Td>{item.free_quantity || "-"}</Table.Td>
              <Table.Td>{item.quantity_rejected || "-"}</Table.Td>
              <Table.Td>{money(item.unit_price)}</Table.Td>
              <Table.Td>{money(item.mrp)}</Table.Td>
              <Table.Td>{item.gst_rate === null ? "-" : `${item.gst_rate}%`}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Text fw={600}>Total: {money(grn.total_amount)}</Text>
    </Stack>
  );
}
