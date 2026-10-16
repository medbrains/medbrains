/**
 * A patient record this user cannot open. The server answers "not found"
 * whether the record is absent or simply not theirs to see, so the screen
 * says neither. A clinician allowed to break the glass can open it in an
 * emergency: a reason, a time limit, their password again — and the
 * reviewers, their head of department and the patient's doctor are told.
 */
import { NumberInput, Stack, Text, Textarea } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconLockOpen } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Alert, Button, Modal } from "@/components/ui";
import { auditService } from "@/services/audit.service";

interface PatientUnavailableProps {
  patientId: string;
}

export function PatientUnavailable({ patientId }: PatientUnavailableProps) {
  const canBreakGlass = useHasPermission(P.AUDIT.BREAK_GLASS_START);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState<number>(60);
  const start = useMutation({
    mutationFn: () =>
      auditService.startBreakGlass({
        patient_id: patientId,
        reason: reason.trim(),
        expires_in_minutes: minutes,
      }),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["patient", patientId] });
    },
  });

  return (
    <>
      <EmptyState
        icon={<IconLockOpen size={32} />}
        title="This patient record isn't available to you"
        description="It may not exist, or it belongs to patients outside your care. Ask the treating team, or your administrator, for access."
        action={
          canBreakGlass ? { label: "Emergency access", onClick: () => setOpen(true) } : undefined
        }
      />
      <Modal opened={open} onClose={() => setOpen(false)} title="Emergency access" size="md">
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
              reason.length > 0 && reason.trim().length < 5 ? "Say why, in a few words" : undefined
            }
          />
          <NumberInput
            label="For how many minutes"
            min={5}
            max={240}
            step={15}
            value={minutes}
            onChange={(v) => setMinutes(typeof v === "number" ? v : 60)}
          />
          {start.isError && <Alert tone="danger">{start.error.message}</Alert>}
          <Button
            tone="danger"
            disabled={reason.trim().length < 5}
            loading={start.isPending}
            onClick={() => start.mutate()}
          >
            Open the record
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
