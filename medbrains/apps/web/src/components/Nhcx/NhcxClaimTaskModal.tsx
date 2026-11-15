import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Modal, TextArea, toast } from "@/components/ui";

/** What the desk asks the payer: about a claim, or to withdraw a pre-auth. */
export type ClaimTaskAction = "cancel" | "reprocess" | "cancel-preauth";

interface NhcxClaimTaskModalProps {
  /** The claim, or for `cancel-preauth` the pre-authorisation. */
  subjectId: string;
  action: ClaimTaskAction | null;
  onClose: () => void;
}

const MIN_REASON = 3;
const MAX_REASON = 1000;

const COPY: Record<ClaimTaskAction, { title: string; prompt: string; send: string }> = {
  cancel: {
    title: "Cancel claim",
    prompt: "Why is this claim being withdrawn? The payer sees this.",
    send: "Ask the payer to cancel",
  },
  reprocess: {
    title: "Ask payer to reprocess",
    prompt: "What was answered or corrected since the payer's decision? The payer sees this.",
    send: "Ask the payer to reprocess",
  },
  "cancel-preauth": {
    title: "Cancel pre-auth",
    prompt: "Why is this pre-auth being withdrawn? The payer sees this.",
    send: "Ask the payer to cancel",
  },
};

/** Send the ask for one action. */
function sendTask(action: ClaimTaskAction, id: string, reason: string) {
  if (action === "cancel-preauth") return api.cancelNhcxPreauth(id, { reason });
  if (action === "cancel") return api.cancelNhcxClaim(id, { reason });
  return api.reprocessNhcxClaim(id, { reason });
}

/** Ask the payer, through NHCX, to cancel or reprocess a claim, or to cancel a
 * pre-auth — with the reason. */
export function NhcxClaimTaskModal({ subjectId, action, onClose }: NhcxClaimTaskModalProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const send = useMutation({
    mutationFn: (a: ClaimTaskAction) => sendTask(a, subjectId, reason.trim()),
    onSuccess: (_, a) => {
      const key = a === "cancel-preauth" ? "preauth-nhcx" : "claim-nhcx";
      void queryClient.invalidateQueries({ queryKey: [key, subjectId] });
      toast.success("The payer's answer will appear here.", { title: "Request sent" });
      setReason("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Request not sent" }),
  });
  const length = reason.trim().length;
  const valid = length >= MIN_REASON && length <= MAX_REASON;
  const copy = action ? COPY[action] : null;
  return (
    <Modal opened={!!action} onClose={onClose} title={copy?.title ?? ""}>
      <Stack gap="sm">
        <TextArea
          label="Reason"
          description={copy?.prompt}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          error={length > MAX_REASON ? `Keep it under ${MAX_REASON} characters` : undefined}
          minRows={3}
          required
        />
        {action === "cancel-preauth" && (
          <Text size="xs" c="dimmed">
            The payer confirms the cancellation; until then the pre-auth stays as it is.
          </Text>
        )}
        {action === "cancel" && (
          <Text size="xs" c="dimmed">
            A claim the payer has already paid is not undone by a cancellation.
          </Text>
        )}
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            tone={action === "reprocess" ? "primary" : "danger"}
            loading={send.isPending}
            disabled={!valid}
            onClick={() => action && send.mutate(action)}
          >
            {copy?.send ?? "Send"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
