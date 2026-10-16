/**
 * Recall a whole sterilisation load, and see where its packs went.
 *
 * A biological indicator is read hours after the cycle, by which time packs
 * from the load may be open on a theatre table. Recall bars every pack of the
 * load from issue and flags every issuance already made, so the list below is
 * the retrieval list: which department holds which set.
 */
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CssdSterilizationLoad } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Table, TextArea, toast } from "@/components/ui";
import { cssdService } from "@/services/cssd.service";

const RECALL_PERMISSION = P.CSSD.STERILIZATION_RECALL;

export function LoadRecallPanel({ load }: { load: CssdSterilizationLoad }) {
  const qc = useQueryClient();
  const canRecall = useHasPermission(RECALL_PERMISSION);
  const canListIssuances = useHasPermission(P.CSSD.ISSUANCE_LIST);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  const issuances = useQuery({
    queryKey: ["cssd-load-issuances", load.id],
    queryFn: () => cssdService.listCssdLoadIssuances(load.id),
    enabled: canListIssuances,
  });

  const recall = useMutation({
    mutationFn: () => cssdService.recallCssdLoad(load.id, reason.trim()),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["cssd-loads"] });
      void qc.invalidateQueries({ queryKey: ["cssd-load-items", load.id] });
      void qc.invalidateQueries({ queryKey: ["cssd-issuances"] });
      qc.setQueryData(["cssd-load-issuances", load.id], res.issuances);
      setConfirming(false);
      toast.success(`${res.issuances.length} issued pack(s) flagged for retrieval`, {
        title: `Load ${load.load_number} recalled`,
      });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Recall failed" }),
  });

  // The drawer's load prop predates the recall; the recall answers with the new row.
  const current = recall.data?.load ?? load;

  return (
    <Stack gap="xs">
      {current.recalled_at ? (
        <Alert tone="danger" title={`Load ${current.load_number} is recalled`}>
          {current.recall_reason ?? "No reason recorded."} No pack from this load can be issued.
        </Alert>
      ) : (
        canRecall &&
        (confirming ? (
          <Stack gap="xs">
            <TextArea
              label="Reason for recall"
              description="e.g. biological indicator failed. Every pack from this load is barred from issue and every issued pack is flagged for retrieval."
              required
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
            />
            <Group gap="xs">
              <Button
                tone="danger"
                disabled={reason.trim().length === 0}
                loading={recall.isPending}
                onClick={() => recall.mutate()}
              >
                Recall load {load.load_number}
              </Button>
              <Button tone="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </Group>
          </Stack>
        ) : (
          <Group>
            <Button
              tone="danger"
              leftSection={<IconAlertTriangle size={16} />}
              onClick={() => setConfirming(true)}
            >
              Recall this load
            </Button>
          </Group>
        ))
      )}

      <Text fw={600} size="sm">
        Where the packs went
      </Text>
      {!canListIssuances ? (
        <Text size="sm" c="dimmed">
          Viewing issued packs needs the issuance-log permission (cssd.issuance.list).
        </Text>
      ) : issuances.isError ? (
        <Alert tone="danger" title="Issued packs could not be read">
          This is a failed read, not "nothing was issued". Try again before closing a recall.
        </Alert>
      ) : issuances.isLoading ? (
        <Text size="sm" c="dimmed">
          Reading issued packs…
        </Text>
      ) : (issuances.data ?? []).length === 0 ? (
        <Text size="sm" c="dimmed">
          No pack from this load has been issued.
        </Text>
      ) : (
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Set</Table.Th>
              <Table.Th>Department</Table.Th>
              <Table.Th>Issued</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(issuances.data ?? []).map((i) => (
              <Table.Tr key={i.issuance_id}>
                <Table.Td>{i.set_name ?? "—"}</Table.Td>
                <Table.Td>{i.issued_to_department}</Table.Td>
                <Table.Td>{new Date(i.issued_at).toLocaleString()}</Table.Td>
                <Table.Td>
                  {i.is_recalled ? (
                    <Badge tone="danger">Recalled</Badge>
                  ) : i.returned_at ? (
                    <Badge tone="neutral">Returned</Badge>
                  ) : (
                    <Badge tone="success">Issued</Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
