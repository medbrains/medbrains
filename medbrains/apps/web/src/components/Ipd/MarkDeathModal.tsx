// Mark death modal — captures cause of death + MLC + autopsy flags
// and creates an `ipd_mortality_reviews` row. Server stamps
// review_due_at = death + 72h (NABH M&M conference deadline).
//
// Today this modal does NOT yet flip the admission status to
// 'expired' — that lives in the discharge tab. Operator workflow:
// (1) Mark death here → mortality queue + Form 4/4A obligations.
// (2) Generate death summary doc.
// (3) Then discharge with disposition='expired'.
import { Alert, Button, Checkbox, Group, Modal, Stack, Textarea, TextInput } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { IpdMortalityCreate } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface MarkDeathModalProps {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
}

export function MarkDeathModal({ admissionId, opened, onClose }: MarkDeathModalProps) {
  const queryClient = useQueryClient();
  const [deathAt, setDeathAt] = useState<Date | null>(new Date());
  const [cause, setCause] = useState("");
  const [primaryDx, setPrimaryDx] = useState("");
  const [isMlc, setIsMlc] = useState(false);
  const [autopsy, setAutopsy] = useState(false);

  const mutation = useMutation({
    mutationFn: (body: IpdMortalityCreate) => api.createIpdMortalityReview(body),
    onSuccess: () => {
      notifications.show({
        title: "Death recorded",
        message: "M&M review scheduled within 72h. Form 4 / 4A pending.",
        color: "danger",
      });
      void queryClient.invalidateQueries({ queryKey: ["ipd-mortality"] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-admission", admissionId] });
      onClose();
    },
  });

  const submit = () => {
    if (!deathAt) {
      notifications.show({
        title: "Time of death required",
        message: "Civil registration requires the exact death timestamp.",
        color: "danger",
      });
      return;
    }
    mutation.mutate({
      admission_id: admissionId,
      death_at: deathAt.toISOString(),
      cause_of_death: cause || undefined,
      primary_dx: primaryDx || undefined,
      is_mlc_case: isMlc,
      autopsy_required: autopsy,
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Mark patient death" size="lg">
      <Stack gap="sm">
        <Alert color="danger" variant="light">
          Records the death event and queues the case for M&M review. Civil registration (Form 4
          medical, Form 4A cause of death) and the discharge-with-`expired` disposition are separate
          steps that follow.
        </Alert>

        <DateTimePicker
          label="Time of death"
          value={deathAt}
          onChange={(v) => setDeathAt(v ? new Date(v) : null)}
          required
        />

        <TextInput
          label="Cause of death"
          value={cause}
          onChange={(e) => setCause(e.currentTarget.value)}
          placeholder="ICD-10 root preferred (e.g. I46.9 cardiac arrest, unspecified)"
        />

        <TextInput
          label="Primary diagnosis"
          value={primaryDx}
          onChange={(e) => setPrimaryDx(e.currentTarget.value)}
          placeholder="Underlying condition driving the case"
        />

        <Checkbox
          label="MLC case — police liaison + autopsy obligation"
          checked={isMlc}
          onChange={(e) => setIsMlc(e.currentTarget.checked)}
        />

        <Checkbox
          label="Autopsy required"
          checked={autopsy}
          onChange={(e) => setAutopsy(e.currentTarget.checked)}
        />

        <Textarea
          label="Additional notes"
          autosize
          minRows={2}
          placeholder="Family present? Resuscitation duration? Time of last vitals?"
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button color="danger" loading={mutation.isPending} onClick={submit}>
            Confirm death recorded
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
