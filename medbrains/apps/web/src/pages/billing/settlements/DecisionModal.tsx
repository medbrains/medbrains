// Approve, reject or reverse one insurer settlement, with claim vs bill vs
// settlement side by side so the decision is made on the numbers.

import { SimpleGrid, Stack, Text } from "@mantine/core";
import type { ClaimSettlementPosting } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { rupees } from "@/components/payments/collect/collect-math";
import { Alert, Checkbox, Modal, Table, TextArea, toast } from "@/components/ui";
import { settlementView } from "@/lib/claim-settlements";
import { billingService } from "@/services/billing.service";

export type DecisionKind = "approve" | "reject" | "reverse";

const TITLES: Record<DecisionKind, string> = {
  approve: "Approve insurer settlement",
  reject: "Reject insurer settlement",
  reverse: "Reverse an approved settlement",
};

interface DecisionModalProps {
  kind: DecisionKind;
  posting: ClaimSettlementPosting;
  onClose: () => void;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600}>
        {value}
      </Text>
    </Stack>
  );
}

function decide(kind: DecisionKind, id: string, acceptExcess: boolean, reason: string) {
  if (kind === "approve")
    return billingService.approveClaimSettlement(id, { accept_excess: acceptExcess });
  if (kind === "reject") return billingService.rejectClaimSettlement(id, { reason });
  return billingService.reverseClaimSettlement(id, { reason });
}

export function DecisionModal({ kind, posting, onClose }: DecisionModalProps) {
  const queryClient = useQueryClient();
  const v = settlementView(posting);
  const [acceptExcess, setAcceptExcess] = useState(false);
  const [reason, setReason] = useState("");
  const needsReason = kind !== "approve";
  const reasonValid = reason.trim().length >= 3;

  const mutation = useMutation({
    mutationFn: () => decide(kind, posting.id, acceptExcess, reason.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success(
        kind === "approve"
          ? "Settlement posted to the bill"
          : kind === "reject"
            ? "Settlement rejected"
            : "Posting reversed",
      );
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const blocked =
    (needsReason && !reasonValid) || (kind === "approve" && v.excess > 0 && !acceptExcess);

  return (
    <Modal
      opened
      onClose={onClose}
      title={TITLES[kind]}
      size="lg"
      danger={kind !== "approve"}
      primaryAction={{
        label:
          kind === "approve"
            ? `Post ${rupees(v.toPost)}`
            : kind === "reject"
              ? "Reject"
              : "Reverse",
        onClick: () => mutation.mutate(),
        loading: mutation.isPending,
        disabled: blocked,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack>
        <Text size="sm">
          {posting.patient_name} · {posting.uhid} · claim {posting.claim_number ?? "—"} ·{" "}
          {posting.payer}
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Figure label="Claimed" value={rupees(Number(posting.claim_amount ?? 0))} />
          <Figure
            label="Approved by insurer"
            value={rupees(Number(posting.approved_amount ?? 0))}
          />
          <Figure label="Settled (gross)" value={rupees(v.settled)} />
          <Figure label="Received after TDS" value={rupees(v.net)} />
          <Figure label="Bill total" value={rupees(Number(posting.invoice_total))} />
          <Figure label="Bill open now" value={rupees(v.open)} />
          {kind === "approve" ? (
            <Figure label="Left owing after posting" value={rupees(v.leftOwing)} />
          ) : (
            <Figure label="Posted to the bill" value={rupees(Number(posting.posted_amount ?? 0))} />
          )}
          <Figure label="Hospital writes off" value={rupees(v.writeOff)} />
        </SimpleGrid>
        {posting.deductions.length > 0 && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Deduction</Table.Th>
                <Table.Th>Borne by</Table.Th>
                <Table.Th>Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {posting.deductions.map((d) => (
                <Table.Tr key={`${d.reason}-${d.amount}`}>
                  <Table.Td>{d.reason}</Table.Td>
                  <Table.Td>
                    {d.treatment === "patient" ? "Patient" : "Hospital (write-off)"}
                  </Table.Td>
                  <Table.Td>{rupees(Number(d.amount))}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {posting.needs_review && posting.review_reason && (
          <Alert tone="warning" title="Flagged for review">
            {posting.review_reason}
          </Alert>
        )}
        {kind === "approve" && v.excess > 0 && (
          <Checkbox
            checked={acceptExcess}
            onChange={(e) => setAcceptExcess(e.currentTarget.checked)}
            label={`Post ${rupees(v.toPost)} and keep the ${rupees(v.excess)} excess on this posting for refund or adjustment`}
          />
        )}
        {kind === "reverse" && (
          <Alert tone="warning" title="The bill will owe again">
            The insurance payment of {rupees(Number(posting.posted_amount ?? 0))} and any write-off
            come off the bill. The posting stays on record as reversed.
          </Alert>
        )}
        {needsReason && (
          <TextArea
            label="Reason"
            required
            minRows={2}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            error={
              reason.length > 0 && !reasonValid
                ? "Give a reason of at least 3 characters"
                : undefined
            }
          />
        )}
      </Stack>
    </Modal>
  );
}
