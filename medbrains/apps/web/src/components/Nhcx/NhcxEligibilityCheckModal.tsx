import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { NhcxParticipant } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Modal, toast } from "@/components/ui";
import { nhcxSettingsService } from "@/services/nhcxSettings.service";
import { NhcxPayerSelect } from "./NhcxPayerSelect";
import { NhcxSetupAlert } from "./NhcxSetupAlert";

interface NhcxEligibilityCheckModalProps {
  patientId: string;
  triggerPoint: string;
  triggerEntityId?: string;
  serviceCategories?: string[];
  opened: boolean;
  onClose: () => void;
}

/** Ask a payer through NHCX whether the patient's policy is in force. */
export function NhcxEligibilityCheckModal({
  patientId,
  triggerPoint,
  triggerEntityId,
  serviceCategories,
  opened,
  onClose,
}: NhcxEligibilityCheckModalProps) {
  const queryClient = useQueryClient();
  const [recipientCode, setRecipientCode] = useState<string | null>(null);
  const [payer, setPayer] = useState<NhcxParticipant | undefined>();
  const status = useQuery({
    queryKey: ["nhcx", "status"],
    queryFn: nhcxSettingsService.status,
    enabled: opened,
  });

  const check = useMutation({
    mutationFn: () =>
      api.checkNhcxEligibility({
        patient_id: patientId,
        recipient_code: recipientCode ?? "",
        trigger_point: triggerPoint,
        trigger_entity_id: triggerEntityId,
        service_categories: serviceCategories,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["nhcx-eligibility", patientId] });
      toast.success("The payer's answer will appear here when it arrives.", {
        title: "Eligibility check sent",
      });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Eligibility check not sent" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Check coverage through NHCX">
      <Stack gap="sm">
        <NhcxSetupAlert status={status.data} isError={status.isError} />
        <Text size="sm">
          The check uses the patient's active insurance policy, their UHID and their verified ABHA
          number.
        </Text>
        <NhcxPayerSelect
          value={recipientCode}
          enabled={opened}
          onChange={(code, chosen) => {
            setRecipientCode(code);
            setPayer(chosen);
          }}
        />
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => check.mutate()}
            loading={check.isPending}
            disabled={status.data?.ready !== true || !payer?.has_encryption_cert}
          >
            Check eligibility
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
