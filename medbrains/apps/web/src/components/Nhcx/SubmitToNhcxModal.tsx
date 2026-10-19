import { Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Modal, Select, toast } from "@/components/ui";
import { nhcxSettingsService } from "@/services/nhcxSettings.service";
import { NhcxSetupAlert } from "./NhcxSetupAlert";

interface SubmitToNhcxModalProps {
  claimId: string;
  mode?: "submit" | "eligibility";
  opened: boolean;
  onClose: () => void;
}

/** Submit a claim / pre-authorisation to NHCX, or check eligibility: pick the
 * payer from the directory and the message type, then queue the exchange. */
export function SubmitToNhcxModal({
  claimId,
  mode = "submit",
  opened,
  onClose,
}: SubmitToNhcxModalProps) {
  const queryClient = useQueryClient();
  const [recipientCode, setRecipientCode] = useState<string | null>(null);
  const [use, setUse] = useState("preauthorization");
  const isEligibility = mode === "eligibility";

  const status = useQuery({
    queryKey: ["nhcx", "status"],
    queryFn: nhcxSettingsService.status,
    enabled: opened,
  });
  const payers = useQuery({
    queryKey: ["nhcx-participants"],
    queryFn: () => api.listNhcxParticipants(),
    enabled: opened,
  });

  const submit = useMutation({
    mutationFn: () =>
      isEligibility
        ? api.checkCoverageEligibility(claimId, { recipient_code: recipientCode ?? "" })
        : api.submitClaimToNhcx(claimId, { recipient_code: recipientCode ?? "", use }),
    onSuccess: (queued) => {
      void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] });
      toast.success(
        `Waiting to send — correlation ID ${queued.correlation_id}. The payer's answer will appear on the claim.`,
        { title: isEligibility ? "Eligibility check queued" : "Queued for NHCX" },
      );
      onClose();
    },
    onError: (e: Error) =>
      toast.error(e.message, {
        title: isEligibility ? "Eligibility check not sent" : "Not sent to NHCX",
      }),
  });

  const ready = status.data?.ready === true;
  const chosen = payers.data?.find((p) => p.participant_code === recipientCode);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEligibility ? "Check coverage eligibility" : "Submit to NHCX"}
    >
      <Stack gap="sm">
        <NhcxSetupAlert status={status.data} isError={status.isError} />
        <Select
          label="Payer"
          value={recipientCode}
          onChange={setRecipientCode}
          data={(payers.data ?? []).map((p) => ({
            value: p.participant_code,
            label: p.has_encryption_cert
              ? `${p.participant_name} (${p.participant_code})`
              : `${p.participant_name} (${p.participant_code}) — no encryption certificate`,
            disabled: !p.has_encryption_cert,
          }))}
          placeholder="Select the payer"
          searchable
          error={payers.isError ? "Could not load the payer directory" : undefined}
          nothingFoundMessage="No payers — add one in the NHCX payer directory first"
        />
        {!isEligibility && (
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
        )}
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => submit.mutate()}
            loading={submit.isPending}
            disabled={!ready || !chosen?.has_encryption_cert}
          >
            {isEligibility ? "Check eligibility" : "Submit to NHCX"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
