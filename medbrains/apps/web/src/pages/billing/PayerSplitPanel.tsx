/**
 * The TPA desk's one screen for a bill (#294): every line with who pays it
 * and why, the insurer's share after co-pay and deductible, the patient's
 * share, and the two bills — to the insurer and to the patient.
 */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type BillPayer, P, type PayerSplitLine } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DocumentActions } from "@/components/DocumentActions";
import { Alert, Badge, Button, Input, Modal, Select, Table, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";

interface PayerSplitPanelProps {
  invoiceId: string;
}

const PAYER_LABEL: Record<BillPayer, string> = { third_party: "Insurer", patient: "Patient" };

const inr = (v: string) =>
  Number(v).toLocaleString("en-IN", { style: "currency", currency: "INR" });

interface Move {
  line: PayerSplitLine;
  payer: BillPayer | null;
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={strong ? 700 : 500}>
        {inr(value)}
      </Text>
    </Stack>
  );
}

export function PayerSplitPanel({ invoiceId }: PayerSplitPanelProps) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.BILLING.PAYER_SPLIT.MANAGE);
  const [move, setMove] = useState<Move | null>(null);
  const [reason, setReason] = useState("");
  const key = ["payer-split", invoiceId];
  const split = useQuery({ queryKey: key, queryFn: () => billingService.getPayerSplit(invoiceId) });
  const done =
    (message: string) => (data: Awaited<ReturnType<typeof billingService.getPayerSplit>>) => {
      queryClient.setQueryData(key, data);
      toast.success(message, { title: "Payer split" });
    };
  const assign = useMutation({
    mutationFn: (m: Move) =>
      billingService.assignItemPayer(invoiceId, m.line.id, {
        payer: m.payer,
        reason: m.payer ? reason : undefined,
      }),
    onSuccess: (data) => {
      done("Line moved")(data);
      setMove(null);
      setReason("");
    },
  });
  const apply = useMutation({
    mutationFn: () => billingService.applyPayerSplit(invoiceId),
    onSuccess: done("Written to the claim"),
  });

  if (split.isError) {
    return (
      <Alert tone="danger" title="The split could not be loaded">
        {(split.error as Error).message}
      </Alert>
    );
  }
  const s = split.data;
  if (!s) return <Text size="sm">Loading the split…</Text>;
  const party = s.third_party;
  const failure = apply.error ?? assign.error;

  return (
    <Stack gap="sm" aria-label="Payer split">
      {party ? (
        <Group gap="xs">
          <Badge tone="info">{party.kind}</Badge>
          <Text fw={600}>{party.name}</Text>
          {party.claim_status && (
            <Text size="sm" c="dimmed">
              Claim {party.claim_status.replace(/_/g, " ")}
            </Text>
          )}
        </Group>
      ) : (
        <Alert tone="info" title="Self-pay bill">
          No insurer, scheme or corporate is on this bill, so the patient pays every line.
        </Alert>
      )}
      {failure && (
        <Alert tone="danger" title="Not done">
          {(failure as Error).message}
        </Alert>
      )}

      <Table aria-label="Bill lines by payer">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Amount</Table.Th>
            <Table.Th>Payer</Table.Th>
            <Table.Th>Why</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {s.lines.map((line) => (
            <Table.Tr key={line.id}>
              <Table.Td>{line.description}</Table.Td>
              <Table.Td>{inr(line.total)}</Table.Td>
              <Table.Td>
                {canManage && party ? (
                  <Select
                    aria-label={`Payer for ${line.description}`}
                    size="xs"
                    w={170}
                    allowDeselect={false}
                    data={[
                      { value: "auto", label: `Automatic (${PAYER_LABEL[line.payer]})` },
                      { value: "third_party", label: "Insurer" },
                      { value: "patient", label: "Patient" },
                    ]}
                    value={line.automatic ? "auto" : line.payer}
                    onChange={(v) =>
                      v === "auto"
                        ? assign.mutate({ line, payer: null })
                        : setMove({ line, payer: v as BillPayer })
                    }
                  />
                ) : (
                  <Badge tone={line.payer === "patient" ? "warning" : "success"}>
                    {PAYER_LABEL[line.payer]}
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm" c={line.automatic ? "dimmed" : undefined}>
                  {line.reason}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <SimpleGrid cols={{ base: 2, sm: 6 }}>
        <Total label="Insurer items" value={s.third_party_gross} />
        <Total label="Co-pay" value={s.copay} />
        <Total label="Deductible" value={s.deductible} />
        <Total label="Claim from insurer" value={s.third_party_net} strong />
        <Total label="Items not covered" value={s.patient_lines} />
        <Total label="Patient pays" value={s.patient_total} strong />
      </SimpleGrid>

      <Group justify="flex-end" gap="sm">
        <DocumentActions
          templateCode="payer_split_patient"
          sourceId={invoiceId}
          size="sm"
          label="Patient share"
        />
        {party && (
          <DocumentActions
            templateCode="payer_split_insurer"
            sourceId={invoiceId}
            size="sm"
            label="Insurer bill"
          />
        )}
        {canManage && party?.claim_id && (
          <Button tone="primary" size="sm" loading={apply.isPending} onClick={() => apply.mutate()}>
            Write to claim
          </Button>
        )}
      </Group>

      <Modal
        opened={move !== null}
        onClose={() => setMove(null)}
        title={
          move
            ? `Move "${move.line.description}" to the ${move.payer === "patient" ? "patient" : "insurer"}`
            : ""
        }
      >
        <Stack gap="sm">
          <Input
            label="Why"
            placeholder="e.g. policy covers the admission kit"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button tone="secondary" onClick={() => setMove(null)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              disabled={reason.trim().length < 3}
              loading={assign.isPending}
              onClick={() => move && assign.mutate(move)}
            >
              Move line
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
