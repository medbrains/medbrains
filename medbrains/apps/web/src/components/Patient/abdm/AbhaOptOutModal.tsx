import { Stack } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Checkbox, Modal, TextArea, toast } from "@/components/ui";
import { abhaService } from "@/services/abha.service";

interface AbhaOptOutModalProps {
  patientId: string;
  opened: boolean;
  onClose: () => void;
}

/**
 * The patient withdraws their ABHA from this hospital (M2
 * HIP_INIT_ABHA_OPTOUT_DEACTIVATE): unlinked, consents deleted, no more
 * records linked. Their ABHA itself stays theirs at ABDM.
 */
export function AbhaOptOutModal({ patientId, opened, onClose }: AbhaOptOutModalProps) {
  const [reason, setReason] = useState("");
  const [asked, setAsked] = useState(false);
  const queryClient = useQueryClient();
  const optOut = useMutation({
    mutationFn: () => abhaService.optOut(patientId, reason),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["abdm", "patient-records", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      toast.success(
        `The ABHA ending ${r.abha_ending} is off this record; ${r.consents_deleted} consent(s) deleted.`,
        { title: "Opted out of ABDM" },
      );
      onClose();
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Opt the patient out of ABDM">
      <Stack>
        {optOut.isError && (
          <Alert tone="danger" title="Could not record the opt-out">
            {optOut.error.message}
          </Alert>
        )}
        <Alert tone="warning" title="What this does">
          The patient's ABHA is removed from this record, the consents they granted this hospital
          are deleted and no more of their records are linked to ABDM. Records ABDM already holds
          stay in the patient's ABHA app. Verifying the ABHA again links it back.
        </Alert>
        <TextArea
          label="Why is the patient opting out?"
          required
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Checkbox
          label="The patient asked for this"
          checked={asked}
          onChange={(e) => setAsked(e.currentTarget.checked)}
        />
        <Button
          tone="danger"
          disabled={!asked || !reason.trim()}
          loading={optOut.isPending}
          onClick={() => optOut.mutate()}
        >
          Opt out of ABDM
        </Button>
      </Stack>
    </Modal>
  );
}
