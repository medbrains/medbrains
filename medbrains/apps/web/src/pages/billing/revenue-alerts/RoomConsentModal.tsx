// Record, after the bed was allocated, that the patient or a relative agreed
// to pay the proportionate deduction for a room above the policy limit.

import { Stack, Text } from "@mantine/core";
import type { RevenueAlert, RoomConsentInput } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { emptyConsent, isConsentComplete, RoomConsentFields } from "@/components/RoomConsentFields";
import { roomDisclosure } from "@/components/room-disclosure";
import { Modal, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { evidenceNumber, inr } from "./revenue-alerts-labels";

interface RoomConsentModalProps {
  alert: RevenueAlert;
  onClose: () => void;
}

/** Shows the cut the family is agreeing to and records who agreed. */
export function RoomConsentModal({ alert, onClose }: RoomConsentModalProps) {
  const queryClient = useQueryClient();
  const [who, setWho] = useState<RoomConsentInput>(emptyConsent);
  const ratio = evidenceNumber(alert, "payable_ratio");

  const mutation = useMutation({
    mutationFn: () => billingService.recordRoomConsent(alert.id, who),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "revenue-alerts"] });
      toast.success("Consent recorded");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title="Record room consent"
      size="md"
      primaryAction={{
        label: "Record consent",
        onClick: () => mutation.mutate(),
        loading: mutation.isPending,
        disabled: !isConsentComplete(who),
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack>
        <Text size="sm">
          {alert.patient_name} · {alert.uhid}: room {inr(evidenceNumber(alert, "room_rate"))} a day,
          policy allows {inr(evidenceNumber(alert, "eligible_rate"))}. The insurer may pay{" "}
          {ratio === null ? "less" : `${Math.round(ratio * 1000) / 10}%`} of room-linked charges;
          expected deduction {inr(alert.amount)}.
        </Text>
        {ratio !== null && <Text size="sm">{roomDisclosure(Math.floor(ratio * 1000) / 10)}</Text>}
        <RoomConsentFields value={who} onChange={setWho} />
      </Stack>
    </Modal>
  );
}
