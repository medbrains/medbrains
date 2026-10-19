import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxPayment } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Button, Modal, Select, toast } from "@/components/ui";
import { rupees } from "./claimNhcx";

interface NhcxPostPaymentModalProps {
  payment: NhcxPayment | null;
  onClose: () => void;
}

/** Post a payment that named no claim here to the claim it pays — only a
 * claim sent to the same payer. */
export function NhcxPostPaymentModal({ payment, onClose }: NhcxPostPaymentModalProps) {
  const queryClient = useQueryClient();
  const [claimId, setClaimId] = useState<string | null>(null);
  // The claims list is guarded by its own permission; without it there is
  // nothing to pick from.
  const canListClaims = useHasPermission(P.BILLING.CORPORATE.LIST);
  const claims = useQuery({
    queryKey: ["insurance-claims"],
    queryFn: () => api.listInsuranceClaims(),
    enabled: !!payment && canListClaims,
  });
  const options = useMemo(
    () =>
      (claims.data ?? [])
        .filter((c) => c.nhcx_recipient_code === payment?.sender_code)
        .map((c) => ({
          value: c.id,
          label: `${c.claim_number ?? c.id.slice(0, 8)} · ${c.insurance_provider} · approved ${rupees(c.approved_amount)}`,
        })),
    [claims.data, payment?.sender_code],
  );
  const post = useMutation({
    mutationFn: () => api.postNhcxPayment(payment?.id ?? "", { insurance_claim_id: claimId ?? "" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["nhcx-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] });
      toast.success("The claim is settled by this payment.", { title: "Payment posted" });
      setClaimId(null);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Payment not posted" }),
  });
  return (
    <Modal opened={!!payment} onClose={onClose} title="Post payment to a claim">
      {payment && (
        <Stack gap="sm">
          <Text size="sm">
            {payment.payer_name ?? payment.sender_code} paid {rupees(payment.net_amount)} (
            {rupees(payment.gross_amount)} approved, {rupees(payment.tds_amount)} TDS), naming claim
            “{payment.claim_reference ?? "none"}”.
          </Text>
          {!canListClaims ? (
            <Alert tone="warning" title="You cannot list claims">
              Ask for access to the insurance claims list to post this payment.
            </Alert>
          ) : claims.isError ? (
            <Alert tone="warning" title="Could not load the claims">
              Try again in a minute.
            </Alert>
          ) : (
            <Select
              label="Claim this payment settles"
              placeholder="Search claims sent to this payer"
              data={options}
              value={claimId}
              onChange={setClaimId}
              searchable
              nothingFoundMessage="No claim sent to this payer matches"
            />
          )}
          <Group justify="flex-end">
            <Button tone="secondary" onClick={onClose}>
              Close
            </Button>
            <Button loading={post.isPending} disabled={!claimId} onClick={() => post.mutate()}>
              Post payment
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
