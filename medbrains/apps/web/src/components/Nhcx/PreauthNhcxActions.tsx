import { Group } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconRefresh, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, toast } from "@/components/ui";
import { NhcxClaimTaskModal } from "./NhcxClaimTaskModal";
import { canWithdrawPreauth } from "./nhcxSummary";

interface PreauthNhcxActionsProps {
  priorAuthId: string;
  status: string;
  recipient: string | null;
}

/** What the desk can ask the payer about a sent pre-auth through NHCX: where
 * it stands, and to withdraw it — each gated on the permission its call needs. */
export function PreauthNhcxActions({ priorAuthId, status, recipient }: PreauthNhcxActionsProps) {
  const queryClient = useQueryClient();
  const canSubmit = useHasPermission(P.INSURANCE.NHCX.SUBMIT);
  const canCancel = useHasPermission(P.INSURANCE.NHCX.CANCEL_PREAUTH);
  const [isCancelling, setCancelling] = useState(false);
  const check = useMutation({
    mutationFn: () => api.checkPreauthNhcxStatus(priorAuthId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["preauth-nhcx", priorAuthId] });
      toast.success("The payer's answer will update this pre-auth.", {
        title: "Status check sent",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Status check not sent" }),
  });
  if (!recipient || (!canSubmit && !canCancel)) return null;
  return (
    <Group justify="flex-end" gap="xs">
      {canSubmit && (
        <Button
          size="xs"
          tone="tertiary"
          leftSection={<IconRefresh size={16} />}
          loading={check.isPending}
          onClick={() => check.mutate()}
        >
          Check status with the payer
        </Button>
      )}
      {canCancel && (
        <Button
          size="xs"
          tone="danger-tertiary"
          leftSection={<IconX size={16} />}
          disabled={!canWithdrawPreauth(status, recipient)}
          onClick={() => setCancelling(true)}
        >
          Cancel pre-auth
        </Button>
      )}
      <NhcxClaimTaskModal
        subjectId={priorAuthId}
        action={isCancelling ? "cancel-preauth" : null}
        onClose={() => setCancelling(false)}
      />
    </Group>
  );
}
