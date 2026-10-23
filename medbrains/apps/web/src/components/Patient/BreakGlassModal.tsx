/**
 * Emergency (break-glass) access to one patient. A reason, a time limit and
 * the user's password again; the reviewers, their head of department and the
 * patient's doctor are told at once. `requestedModules` names what the
 * session is for — psychiatric records open only when it names psychiatry.
 */
import { NumberInput, Stack, Text, Textarea } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Modal } from "@/components/ui";
import { auditService } from "@/services/audit.service";

const MIN_REASON = 5;
const DEFAULT_MINUTES = 60;

interface BreakGlassModalProps {
  patientId: string;
  opened: boolean;
  onClose: () => void;
  title?: string;
  requestedModules?: string[];
}

export function BreakGlassModal({
  patientId,
  opened,
  onClose,
  title = "Emergency access",
  requestedModules,
}: BreakGlassModalProps) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState<number>(DEFAULT_MINUTES);
  const start = useMutation({
    mutationFn: () =>
      auditService.startBreakGlass({
        patient_id: patientId,
        reason: reason.trim(),
        expires_in_minutes: minutes,
        requested_modules: requestedModules,
      }),
    onSuccess: () => {
      onClose();
      // Everything about this patient may now read differently.
      void qc.invalidateQueries();
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="md">
      <Stack gap="sm">
        <Text size="sm">
          Use this only when the patient's care cannot wait. It is recorded, the reviewers and the
          patient's doctor are told at once, and you will be asked why.
        </Text>
        <Textarea
          label="Why you need this record now"
          withAsterisk
          autosize
          minRows={2}
          value={reason}
          onChange={(e) => {
            const { value } = e.currentTarget;
            setReason(value);
          }}
          error={
            reason.length > 0 && reason.trim().length < MIN_REASON
              ? "Say why, in a few words"
              : undefined
          }
        />
        <NumberInput
          label="For how many minutes"
          min={5}
          max={240}
          step={15}
          value={minutes}
          onChange={(v) => setMinutes(typeof v === "number" ? v : DEFAULT_MINUTES)}
        />
        {start.isError && <Alert tone="danger">{start.error.message}</Alert>}
        <Button
          tone="danger"
          disabled={reason.trim().length < MIN_REASON}
          loading={start.isPending}
          onClick={() => start.mutate()}
        >
          Open the record
        </Button>
      </Stack>
    </Modal>
  );
}
