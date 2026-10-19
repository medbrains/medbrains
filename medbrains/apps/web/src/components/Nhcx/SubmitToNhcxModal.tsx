import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { NhcxParticipant } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Modal, SegmentedControl, toast } from "@/components/ui";
import { nhcxSettingsService } from "@/services/nhcxSettings.service";
import { NhcxPayerSelect } from "./NhcxPayerSelect";
import { NhcxSetupAlert } from "./NhcxSetupAlert";

interface SubmitToNhcxModalProps {
  claimId: string;
  /** `claim` for the final claim from the final bill. */
  defaultUse?: "preauthorization" | "claim";
  opened: boolean;
  onClose: () => void;
}

/** Submit a claim / pre-authorisation to NHCX: pick the payer from the
 * directory and the message type, then queue the exchange. */
export function SubmitToNhcxModal({
  claimId,
  defaultUse = "preauthorization",
  opened,
  onClose,
}: SubmitToNhcxModalProps) {
  const queryClient = useQueryClient();
  const [recipientCode, setRecipientCode] = useState<string | null>(null);
  const [payer, setPayer] = useState<NhcxParticipant | undefined>();
  const [use, setUse] = useState<string>(defaultUse);

  const status = useQuery({
    queryKey: ["nhcx", "status"],
    queryFn: nhcxSettingsService.status,
    enabled: opened,
  });

  const submit = useMutation({
    mutationFn: () => api.submitClaimToNhcx(claimId, { recipient_code: recipientCode ?? "", use }),
    onSuccess: (queued) => {
      void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] });
      void queryClient.invalidateQueries({ queryKey: ["claim-nhcx", claimId] });
      toast.success(
        `Waiting to send — correlation ID ${queued.correlation_id}. The payer's answer will appear on the claim.`,
        { title: "Queued for NHCX" },
      );
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not sent to NHCX" }),
  });

  const ready = status.data?.ready === true;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={use === "claim" ? "Submit final claim" : "Submit to NHCX"}
    >
      <Stack gap="sm">
        <NhcxSetupAlert status={status.data} isError={status.isError} />
        <NhcxPayerSelect
          value={recipientCode}
          enabled={opened}
          onChange={(code, chosen) => {
            setRecipientCode(code);
            setPayer(chosen);
          }}
        />
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Type
          </Text>
          <SegmentedControl
            value={use}
            onChange={setUse}
            data={[
              { value: "preauthorization", label: "Pre-authorization" },
              { value: "claim", label: "Claim" },
            ]}
          />
        </Stack>
        {use === "claim" && (
          <Text size="xs" c="dimmed">
            Sends the final bill line by line, the bill's split between payer and patient, the
            finalised discharge summary and the pre-auth reference.
          </Text>
        )}
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => submit.mutate()}
            loading={submit.isPending}
            disabled={!ready || !payer?.has_encryption_cert}
          >
            Submit to NHCX
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
