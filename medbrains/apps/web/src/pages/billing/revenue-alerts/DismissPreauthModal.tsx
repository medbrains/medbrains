// Dismiss a "no usable pre-auth" alert when none is coming, rightly: the
// family pays cash, or the treatment is not covered. The reason is kept on the
// audit chain and the alert is not raised again for this stay.

import { Stack, Text } from "@mantine/core";
import type { DismissPreauthReason, RevenueAlert } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, Select, TextArea, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";

interface DismissPreauthModalProps {
  alert: RevenueAlert;
  onClose: () => void;
}

const REASONS: { value: DismissPreauthReason; label: string }[] = [
  { value: "self_pay", label: "The patient is paying cash" },
  { value: "not_covered", label: "The treatment is not covered by the policy" },
  { value: "other", label: "Another reason (say why)" },
];

/** Asks why no pre-auth is needed and dismisses the alert. */
export function DismissPreauthModal({ alert, onClose }: DismissPreauthModalProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<DismissPreauthReason | null>(null);
  const [note, setNote] = useState("");
  const needsNote = reason === "other" && note.trim() === "";

  const mutation = useMutation({
    mutationFn: () =>
      billingService.dismissPreauthAlert(alert.id, {
        reason: reason ?? "other",
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "revenue-alerts"] });
      toast.success("Alert dismissed");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title="No pre-auth needed"
      size="md"
      primaryAction={{
        label: "Dismiss alert",
        onClick: () => mutation.mutate(),
        loading: mutation.isPending,
        disabled: reason === null || needsNote,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack>
        <Text size="sm">
          {alert.patient_name} · {alert.uhid} · {alert.payer ?? "Payer not recorded"}
        </Text>
        <Select
          label="Why no pre-auth is needed"
          required
          data={REASONS}
          value={reason}
          onChange={(v) => setReason(v as DismissPreauthReason | null)}
        />
        <TextArea
          label="Note"
          required={reason === "other"}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          error={needsNote ? "Say why no pre-auth is needed" : undefined}
        />
        <Text size="xs" c="dimmed">
          The alert is not raised again for this stay. Who dismissed it, and why, is kept.
        </Text>
      </Stack>
    </Modal>
  );
}
