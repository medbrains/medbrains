// DAMA / LAMA modal — records discharge against medical advice with
// witnessed consent. Backend POST /api/ipd/admissions/{id}/dama
// accepts patient + relative + witness signatures plus risks-explained
// acknowledgment. MLC notification fires automatically when the case
// is flagged.
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  Radio,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { IpdDamaRequest } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface DamaModalProps {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
}

export function DamaModal({ admissionId, opened, onClose }: DamaModalProps) {
  const queryClient = useQueryClient();
  const [recordType, setRecordType] = useState<"dama" | "lama">("dama");
  const [patientSigned, setPatientSigned] = useState(false);
  const [relativeName, setRelativeName] = useState("");
  const [relativeRelation, setRelativeRelation] = useState("");
  const [relativeSigned, setRelativeSigned] = useState(false);
  const [witnessName, setWitnessName] = useState("");
  const [witnessSigned, setWitnessSigned] = useState(false);
  const [risksExplained, setRisksExplained] = useState("");
  const [reason, setReason] = useState("");
  const [isMlc, setIsMlc] = useState(false);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (body: IpdDamaRequest) => api.recordIpdDama(admissionId, body),
    onSuccess: () => {
      notifications.show({
        title: recordType === "dama" ? "DAMA recorded" : "LAMA recorded",
        message: "Refusal documented. MLC notified if applicable.",
        color: "warning",
      });
      void queryClient.invalidateQueries({ queryKey: ["ipd-dama", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-admission", admissionId] });
      onClose();
    },
  });

  const submit = () => {
    if (!patientSigned && !relativeSigned) {
      notifications.show({
        title: "Signature required",
        message: "Either patient or relative must sign before recording.",
        color: "danger",
      });
      return;
    }
    mutation.mutate({
      record_type: recordType,
      patient_signed: patientSigned,
      relative_name: relativeName || undefined,
      relative_relation: relativeRelation || undefined,
      relative_signed: relativeSigned,
      witness_name: witnessName || undefined,
      witness_signed: witnessSigned,
      risks_explained: risksExplained || undefined,
      reason_for_leaving: reason || undefined,
      is_mlc_case: isMlc,
      notes: notes || undefined,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Discharge / Leave Against Medical Advice"
      size="xl"
    >
      <Stack gap="sm">
        <Alert color="warning" variant="light">
          This records a formal refusal of medical care. The patient (or authorised relative) and a
          witness must sign. If this is an MLC, notification will fire to the police liaison.
        </Alert>

        <Radio.Group
          label="Record type"
          value={recordType}
          onChange={(v) => setRecordType(v as "dama" | "lama")}
          required
        >
          <Group mt="xs">
            <Radio value="dama" label="DAMA — formal discharge against advice" />
            <Radio value="lama" label="LAMA — left without formal discharge" />
          </Group>
        </Radio.Group>

        <Textarea
          label="Risks explained to patient/family"
          autosize
          minRows={2}
          value={risksExplained}
          onChange={(e) => setRisksExplained(e.currentTarget.value)}
          placeholder="What was explained — risk of complications, mortality, alternative care options"
        />

        <Textarea
          label="Reason for leaving"
          autosize
          minRows={2}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          placeholder="Patient-stated reason"
        />

        <Checkbox
          label="Patient signed (or thumb impression)"
          checked={patientSigned}
          onChange={(e) => setPatientSigned(e.currentTarget.checked)}
        />

        <Group grow>
          <TextInput
            label="Authorised relative — name"
            value={relativeName}
            onChange={(e) => setRelativeName(e.currentTarget.value)}
          />
          <TextInput
            label="Relation"
            value={relativeRelation}
            onChange={(e) => setRelativeRelation(e.currentTarget.value)}
          />
        </Group>
        <Checkbox
          label="Relative signed"
          checked={relativeSigned}
          onChange={(e) => setRelativeSigned(e.currentTarget.checked)}
        />

        <TextInput
          label="Witness name (staff or independent)"
          value={witnessName}
          onChange={(e) => setWitnessName(e.currentTarget.value)}
        />
        <Checkbox
          label="Witness signed"
          checked={witnessSigned}
          onChange={(e) => setWitnessSigned(e.currentTarget.checked)}
        />

        <Checkbox
          label="MLC case — notify police liaison"
          checked={isMlc}
          onChange={(e) => setIsMlc(e.currentTarget.checked)}
        />

        <Textarea
          label="Internal notes"
          autosize
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button color="warning" loading={mutation.isPending} onClick={submit}>
            Record refusal
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
