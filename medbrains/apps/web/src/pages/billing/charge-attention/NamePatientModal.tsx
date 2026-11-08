// Name the patient a consignment implant was used on. The store recorded the
// usage with no patient, so the charge could not go on any bill; once named,
// the row stays open and the desk posts it like any other charge.

import { Stack, Text } from "@mantine/core";
import type { ChargeAttentionItem } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Modal, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";

interface NamePatientModalProps {
  item: ChargeAttentionItem;
  onClose: () => void;
}

/** Pick the patient and name them on the queued implant charge. */
export function NamePatientModal({ item, onClose }: NamePatientModalProps) {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");

  const mutation = useMutation({
    mutationFn: () => billingService.namePatientChargeAttention(item.id, { patient_id: patientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "charge-attention"] });
      toast.success("Patient named. Post the charge when ready.");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title="Name the patient"
      size="md"
      primaryAction={{
        label: "Name patient",
        onClick: () => mutation.mutate(),
        loading: mutation.isPending,
        disabled: !patientId,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack>
        <Text size="sm">{item.description_override ?? item.charge_code}</Text>
        <Text size="sm" c="dimmed">
          The store recorded this implant as used on no one. Name who received it, so it goes on
          their bill and the vendor's record says who has it.
        </Text>
        <PatientSearchSelect
          label="Patient"
          required
          allowCreate={false}
          value={patientId}
          onChange={setPatientId}
        />
      </Stack>
    </Modal>
  );
}
