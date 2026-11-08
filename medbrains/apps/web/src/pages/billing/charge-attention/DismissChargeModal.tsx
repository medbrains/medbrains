// Dismiss a queued charge: the charge should not be billed, and the reason
// why is required and kept on the record. An unbilled order offers the usual
// reasons (package-included, free by policy, duplicate) as one tap each.

import { Group, Stack, Text } from "@mantine/core";
import type { ChargeAttentionItem } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Chip, ChipGroup, Modal, TextArea, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { NO_PATIENT } from "./charge-attention-columns";
import { isDetectedReason, moduleLabel } from "./charge-attention-labels";

/** Why an order done for a patient is rightly not billed, as the desk says it. */
const UNBILLED_REASONS = [
  "Package-included",
  "Free by policy",
  "Duplicate order",
  "Billed by hand on another bill",
];

interface DismissChargeModalProps {
  item: ChargeAttentionItem;
  onClose: () => void;
}

/** Asks for a reason (3+ characters) and dismisses the queued charge. */
export function DismissChargeModal({ item, onClose }: DismissChargeModalProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const reasonValid = reason.trim().length >= 3;

  const mutation = useMutation({
    mutationFn: () => billingService.dismissChargeAttention(item.id, { reason: reason.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "charge-attention"] });
      toast.success("Charge dismissed");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title="Dismiss this charge"
      size="md"
      danger
      primaryAction={{
        label: "Dismiss",
        onClick: () => mutation.mutate(),
        loading: mutation.isPending,
        disabled: !reasonValid,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack>
        <Text size="sm">
          {item.patient_id === null ? NO_PATIENT : `${item.patient_name} · ${item.uhid}`} ·{" "}
          {item.description_override ?? item.charge_code} from {moduleLabel(item.source_module)}
        </Text>
        <Text size="sm" c="dimmed">
          The patient will not be billed for this. Say why, for whoever audits it later.
        </Text>
        {isDetectedReason(item.reason) && (
          <ChipGroup value={reason} onChange={(value) => setReason(String(value))}>
            <Group gap="xs" aria-label="Common reasons">
              {UNBILLED_REASONS.map((r) => (
                <Chip key={r} value={r}>
                  {r}
                </Chip>
              ))}
            </Group>
          </ChipGroup>
        )}
        <TextArea
          label="Reason"
          required
          minRows={2}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          error={
            reason.length > 0 && !reasonValid ? "Give a reason of at least 3 characters" : undefined
          }
        />
      </Stack>
    </Modal>
  );
}
