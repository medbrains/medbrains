import { Group } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { InsuranceClaim } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconFileInvoice,
  IconRefresh,
  IconRotateClockwise,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, toast } from "@/components/ui";
import { type ClaimTaskAction, NhcxClaimTaskModal } from "./NhcxClaimTaskModal";

interface NhcxClaimActionsProps {
  claim: InsuranceClaim;
  /** Whether NHCX is set up; `true` when it cannot be known (the server still refuses). */
  isReady: boolean;
  onSubmit: (claim: InsuranceClaim, use: "preauthorization" | "claim") => void;
}

const CLOSED = new Set(["settled", "partially_settled", "cancelled"]);

/** What the claim desk can ask the payer through NHCX, each gated on the
 * permission its call needs. */
export function NhcxClaimActions({ claim, isReady, onSubmit }: NhcxClaimActionsProps) {
  const queryClient = useQueryClient();
  const canSubmit = useHasPermission(P.INSURANCE.NHCX.SUBMIT);
  const canCancel = useHasPermission(P.INSURANCE.NHCX.CANCEL);
  const [action, setAction] = useState<ClaimTaskAction | null>(null);
  const status = useMutation({
    mutationFn: () => api.checkClaimNhcxStatus(claim.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["claim-nhcx", claim.id] });
      toast.success("The payer's answer will appear under Requests to the payer.", {
        title: "Status check sent",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Status check not sent" }),
  });
  const wasSent = !!claim.nhcx_recipient_code;
  const isClosed = CLOSED.has(claim.status);
  if (!canSubmit && !canCancel) return null;
  return (
    <Group justify="flex-end" gap="xs">
      {canSubmit && (
        <>
          <Button
            size="xs"
            tone="secondary"
            leftSection={<IconShieldCheck size={16} />}
            disabled={!isReady || isClosed}
            onClick={() => onSubmit(claim, "preauthorization")}
          >
            Send pre-auth
          </Button>
          <Button
            size="xs"
            leftSection={<IconFileInvoice size={16} />}
            disabled={!isReady || isClosed}
            onClick={() => onSubmit(claim, "claim")}
          >
            Submit final claim
          </Button>
          <Button
            size="xs"
            tone="tertiary"
            leftSection={<IconRefresh size={16} />}
            disabled={!isReady || !wasSent}
            loading={status.isPending}
            onClick={() => status.mutate()}
          >
            Check status
          </Button>
        </>
      )}
      {canCancel && (
        <>
          <Button
            size="xs"
            tone="tertiary"
            leftSection={<IconRotateClockwise size={16} />}
            disabled={!isReady || !wasSent || isClosed}
            onClick={() => setAction("reprocess")}
          >
            Ask payer to reprocess
          </Button>
          <Button
            size="xs"
            tone="danger-tertiary"
            leftSection={<IconX size={16} />}
            disabled={!isReady || !wasSent || isClosed}
            onClick={() => setAction("cancel")}
          >
            Cancel claim
          </Button>
        </>
      )}
      <NhcxClaimTaskModal claimId={claim.id} action={action} onClose={() => setAction(null)} />
    </Group>
  );
}
