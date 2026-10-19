import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxParticipant, PatientDocument } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Modal, SegmentedControl, toast } from "@/components/ui";
import { nhcxSettingsService } from "@/services/nhcxSettings.service";
import { claimPicks } from "./claimDocuments";
import { NhcxClaimDocumentsPicker } from "./NhcxClaimDocumentsPicker";
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
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState<PatientDocument[]>([]);
  const canSubmit = useHasPermission(P.INSURANCE.NHCX.SUBMIT);
  const isClaim = use === "claim";

  const status = useQuery({
    queryKey: ["nhcx", "status"],
    queryFn: nhcxSettingsService.status,
    enabled: opened,
  });

  // Rendering makes the PDFs once per opening; refetching would make them again.
  const prepared = useQuery({
    queryKey: ["claim-nhcx-documents", claimId],
    queryFn: () => api.prepareClaimNhcxDocuments(claimId),
    enabled: opened && isClaim && canSubmit && claimId !== "",
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const submit = useMutation({
    mutationFn: () =>
      api.submitClaimToNhcx(claimId, {
        recipient_code: recipientCode ?? "",
        use,
        documents:
          isClaim && prepared.data
            ? claimPicks(prepared.data.documents, unticked, added)
            : undefined,
      }),
    onSuccess: (queued) => {
      void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] });
      void queryClient.invalidateQueries({ queryKey: ["claim-nhcx", claimId] });
      const docs = queued.attachments;
      const docNote = docs
        ? ` ${docs.attached.length} document(s) attached${docs.left_out.length ? `, ${docs.left_out.length} left out — see the claim` : ""}.`
        : "";
      toast.success(
        `Waiting to send — correlation ID ${queued.correlation_id}.${docNote} The payer's answer will appear on the claim.`,
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
        {isClaim && (
          <Text size="xs" c="dimmed">
            Sends the final bill line by line, the bill's split between payer and patient, the
            pre-auth reference, and the documents below as PDFs.
          </Text>
        )}
        {isClaim && prepared.isLoading && (
          <Text size="sm" c="dimmed">
            Printing the discharge summary, bill and reports…
          </Text>
        )}
        {isClaim && prepared.isError && (
          <Alert tone="danger" title="The claim's documents could not be prepared">
            {prepared.error.message} The final claim cannot go without its discharge summary.
          </Alert>
        )}
        {isClaim && prepared.data && (
          <NhcxClaimDocumentsPicker
            prepared={prepared.data}
            unticked={unticked}
            onToggle={(key) =>
              setUnticked((prev) => {
                const next = new Set(prev);
                if (!next.delete(key)) next.add(key);
                return next;
              })
            }
            added={added}
            onAdd={(doc) => setAdded((prev) => [...prev, doc])}
            onRemove={(id) => setAdded((prev) => prev.filter((d) => d.id !== id))}
          />
        )}
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => submit.mutate()}
            loading={submit.isPending}
            disabled={!ready || !payer?.has_encryption_cert || (isClaim && !prepared.data)}
          >
            Submit to NHCX
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
