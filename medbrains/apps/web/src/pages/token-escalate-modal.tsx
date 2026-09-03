import { Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { type ModuleToken, TOKEN_PRIORITY_LABEL } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Modal, Select, TextArea, toast } from "@/components/ui";

/**
 * Move a waiting patient up the queue.
 *
 * Promotion already happened when a more urgent order was raised for someone
 * who already held a token. This is the other case, and the one that actually
 * hurts people: a patient deteriorating in the waiting room, noticed by
 * whoever walked past, with no order to raise. At a camp there is one waiting
 * area and no triage station, so the person who notices is the person at the
 * desk.
 *
 * A reason is required. An escalation nobody can account for is the thing this
 * is meant to prevent, not to enable — and the reason is what the board shows
 * so the patient moved up does not read as a queue-jump.
 */

/** Escalation targets, most urgent first. Demotion is refused server-side. */
const TARGETS = ["stat", "urgent", "emergency_referral", "elderly", "disabled", "pregnant"];

export function TokenEscalateModal({
  token,
  onClose,
  onDone,
}: {
  token: ModuleToken | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [priority, setPriority] = useState("urgent");
  const [reason, setReason] = useState("");

  const escalate = useMutation({
    mutationFn: () =>
      api.escalateTokenPriority(token?.id ?? "", { priority, reason: reason.trim() }),
    onSuccess: (updated) => {
      toast.success(
        `${updated.number} moved up — ${TOKEN_PRIORITY_LABEL[updated.priority] ?? updated.priority}`,
        { title: "Priority raised" },
      );
      setReason("");
      onDone();
      onClose();
    },
    // The server refuses a change that would not move the patient up. Say so:
    // a silent no-op is how somebody believes they escalated a patient they
    // did not.
    onError: (error: Error) => toast.error(error.message, { title: "Not escalated" }),
  });

  return (
    <Modal opened={Boolean(token)} onClose={onClose} title="Move this patient up the queue">
      <Stack gap="md">
        {token && (
          <Text size="sm">
            {token.number}
            {token.patient_name ? ` · ${token.patient_name}` : ""} — currently{" "}
            {TOKEN_PRIORITY_LABEL[token.priority] ?? token.priority}
          </Text>
        )}

        <Select
          label="New priority"
          data={TARGETS.map((value) => ({
            value,
            label: TOKEN_PRIORITY_LABEL[value] ?? value,
          }))}
          value={priority}
          onChange={(value) => setPriority(value ?? "urgent")}
        />

        <TextArea
          label="Why"
          placeholder="What changed — what you saw, or who asked"
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          required
        />

        <Alert tone="info">
          This can only move a patient up, never down, and never ahead of a more urgent case. The
          reason is shown on the board so the queue order can be explained.
        </Alert>

        <Button
          tone="primary"
          loading={escalate.isPending}
          disabled={!reason.trim()}
          onClick={() => escalate.mutate()}
        >
          Raise priority
        </Button>
      </Stack>
    </Modal>
  );
}
