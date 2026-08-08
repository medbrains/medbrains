// IPD TransferLogTab — split from ipd.tsx (pure move).

import { Card, Group, Select, Stack, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreateTransferRequest, IpdTransferLog, TransferType } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Table, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

const TRANSFER_TYPE_OPTIONS: { value: TransferType; label: string }[] = [
  { value: "inter_ward", label: "Inter-Ward" },
  { value: "inter_department", label: "Inter-Department" },
  { value: "inter_hospital", label: "Inter-Hospital" },
];

function isTransferType(value: string | null): value is TransferType {
  return TRANSFER_TYPE_OPTIONS.some((option) => option.value === value);
}

export function TransferLogTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.TRANSFERS_CREATE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [transferType, setTransferType] = useState<TransferType | null>(null);
  const [reason, setReason] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");

  const { data: transfers, isLoading } = useQuery({
    queryKey: ["ipd-transfers", admissionId],
    queryFn: () => ipdService.listTransfers(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTransferRequest) => ipdService.createTransfer(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-transfers", admissionId] });
      toast.success("Transfer logged", { title: "Recorded" });
      formHandlers.close();
      setTransferType(null);
      setReason("");
      setClinicalSummary("");
    },
  });

  const rows = transfers ?? [];

  return (
    <Stack mt="md">
      <Group justify="space-between">
        <Text fw={500}>Transfer History</Text>
        {canCreate && (
          <Button
            tone="primary"
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() => formHandlers.open()}
          >
            Log Transfer
          </Button>
        )}
      </Group>

      {formOpened && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <Select
              label="Transfer Type"
              data={TRANSFER_TYPE_OPTIONS}
              value={transferType}
              onChange={(value) => setTransferType(isTransferType(value) ? value : null)}
              required
            />
            <Textarea
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
            />
            <Textarea
              label="Clinical Summary"
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.currentTarget.value)}
            />
            <Group>
              <Button
                tone="primary"
                size="sm"
                onClick={() => {
                  if (!transferType || !reason.trim()) return;
                  createMutation.mutate({
                    transfer_type: transferType,
                    reason: reason.trim(),
                    clinical_summary: clinicalSummary.trim() || undefined,
                  });
                }}
                loading={createMutation.isPending}
                disabled={!transferType || !reason.trim()}
              >
                Save
              </Button>
              <Button tone="ghost" size="sm" onClick={() => formHandlers.close()}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No transfers recorded.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Transferred At</Table.Th>
              <Table.Th>Reason</Table.Th>
              <Table.Th>Clinical Summary</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((t: IpdTransferLog) => (
              <Table.Tr key={t.id}>
                <Table.Td>
                  <Badge size="sm">{t.transfer_type.replace(/_/g, " ")}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{new Date(t.transferred_at).toLocaleString()}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{t.reason ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={2}>
                    {t.clinical_summary ?? "—"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  IPD Phase 2b — Discharge TAT Tracking
// ══════════════════════════════════════════════════════════
