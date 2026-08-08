import { Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Modal, Select, toast } from "@/components/ui";

/** Submit a claim / pre-authorisation to NHCX: pick the payer from the directory
 * and the message type, then queue the FHIR exchange. */
export function SubmitToNhcxModal({
  claimId,
  mode = "submit",
  opened,
  onClose,
}: {
  claimId: string;
  mode?: "submit" | "eligibility";
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [recipientCode, setRecipientCode] = useState<string | null>(null);
  const [use, setUse] = useState("preauthorization");
  const isEligibility = mode === "eligibility";

  const { data: payers = [] } = useQuery({
    queryKey: ["nhcx-participants"],
    queryFn: () => api.listNhcxParticipants(),
    enabled: opened,
  });

  const submit = useMutation({
    mutationFn: () =>
      isEligibility
        ? api.checkCoverageEligibility(claimId, { recipient_code: recipientCode ?? "" })
        : api.submitClaimToNhcx(claimId, { recipient_code: recipientCode ?? "", use }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] });
      toast.success("Queued to NHCX — the payer response will arrive on the claim.", {
        title: isEligibility ? "Eligibility check queued" : "Submitted",
      });
      onClose();
    },
    onError: (e: Error) =>
      toast.error(e.message, {
        title: isEligibility ? "Eligibility check failed" : "NHCX submission failed",
      }),
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEligibility ? "Check coverage eligibility" : "Submit to NHCX"}
    >
      <Stack gap="sm">
        <Select
          label="Payer"
          value={recipientCode}
          onChange={setRecipientCode}
          data={payers.map((p) => ({
            value: p.participant_code,
            label: `${p.participant_name} (${p.participant_code})`,
          }))}
          placeholder="Select the payer"
          searchable
          nothingFoundMessage="No payers — add one in the NHCX directory first"
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
            disabled={!recipientCode}
          >
            {isEligibility ? "Check eligibility" : "Submit to NHCX"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
