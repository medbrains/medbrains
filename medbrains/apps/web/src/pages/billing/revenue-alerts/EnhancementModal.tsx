// Request an enhancement on a pre-auth nearly used up: how much more to ask
// the payer for, and a note. The pre-auth becomes an enhancement request for
// the new total and the alert closes.

import { Stack, Text } from "@mantine/core";
import type { RevenueAlert } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, NumberField, TextArea, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { evidenceNumber, inr } from "./revenue-alerts-labels";

interface EnhancementModalProps {
  alert: RevenueAlert;
  onClose: () => void;
}

/** Asks for the extra amount (above zero) and requests the enhancement. */
export function EnhancementModal({ alert, onClose }: EnhancementModalProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const approved = evidenceNumber(alert, "approved_amount");

  const mutation = useMutation({
    mutationFn: () =>
      billingService.requestPreauthEnhancement(alert.id, {
        additional_amount: Number(amount),
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "revenue-alerts"] });
      toast.success("Enhancement requested");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title="Request an enhancement"
      size="md"
      primaryAction={{
        label: "Request enhancement",
        onClick: () => mutation.mutate(),
        loading: mutation.isPending,
        disabled: typeof amount !== "number" || amount <= 0,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack>
        <Text size="sm">
          {alert.patient_name} · {alert.uhid} · {alert.payer ?? "Payer"} · approved {inr(approved)},
          bill so far {inr(alert.amount)}
        </Text>
        <NumberField
          label="Extra amount to ask for (₹)"
          required
          min={1}
          value={amount}
          onChange={(v) => setAmount(typeof v === "number" ? v : "")}
        />
        {typeof amount === "number" && amount > 0 && approved !== null && (
          <Text size="sm" c="dimmed">
            New total asked: {inr(approved + amount)}
          </Text>
        )}
        <TextArea
          label="Note for the payer"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Text size="xs" c="dimmed">
          Send it from the pre-auth screen, through NHCX or the payer's portal.
        </Text>
      </Stack>
    </Modal>
  );
}
