// The lab-to-clinician phone call for a critical value, documented on the
// alert: who took the call, when, how many attempts, read-back confirmed.
// NABL and NABH ask for this record; the caller is the signed-in user.

import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type LabCriticalAlert, P } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge, Button, Checkbox, Modal, NumberField, toast } from "@/components/ui";
import { labService } from "@/services/lab.service";

const callSchema = z.object({
  received_by: z.string().trim().min(2, "Say who took the call"),
  attempts: z.number().int().min(1).max(20),
  readback_confirmed: z.boolean(),
});
type CallInput = z.infer<typeof callSchema>;

interface CriticalCallProps {
  alert: LabCriticalAlert;
}

/**
 * The recorded call as a badge, or a "Record call" button for holders of
 * `lab.results.critical_call`. A blocked escalation is shown in words.
 */
export function CriticalCall({ alert }: CriticalCallProps) {
  const canRecord = useHasPermission(P.LAB.RESULTS_CRITICAL_CALL);
  const [open, setOpen] = useState(false);
  return (
    <>
      {alert.escalation_blocked_reason && (
        <Badge tone="warning" size="sm">
          {alert.escalation_blocked_reason}
        </Badge>
      )}
      {alert.phone_called_at ? (
        <Badge tone={alert.phone_readback_confirmed ? "success" : "warning"} size="sm">
          Called {alert.phone_received_by} at {new Date(alert.phone_called_at).toLocaleTimeString()}{" "}
          ({alert.phone_attempts} {alert.phone_attempts === 1 ? "attempt" : "attempts"}
          {alert.phone_readback_confirmed ? ", read back" : ", NOT read back"})
        </Badge>
      ) : (
        canRecord && (
          <Button tone="danger-tertiary" size="xs" onClick={() => setOpen(true)}>
            Record call
          </Button>
        )
      )}
      {open && <CallModal alert={alert} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The call form. */
function CallModal({ alert, onClose }: { alert: LabCriticalAlert; onClose: () => void }) {
  const qc = useQueryClient();
  const form = useForm<CallInput>({
    resolver: zodResolver(callSchema),
    defaultValues: { received_by: "", attempts: 1, readback_confirmed: false },
  });
  const save = useMutation({
    mutationFn: (data: CallInput) => labService.recordCriticalCall(alert.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lab-critical-alerts"] });
      toast.success("Call recorded");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record the call" }),
  });
  return (
    <Modal opened onClose={onClose} title="Record the critical-value call" size="sm">
      <form onSubmit={form.handleSubmit((data) => save.mutate(data))}>
        <Stack gap="sm">
          <Text size="sm">
            {alert.parameter_name}: <b>{alert.value}</b>. You are recorded as the caller.
          </Text>
          <Controller
            name="received_by"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextInput
                {...field}
                label="Who took the call"
                placeholder="Name and role, e.g. Dr Rao, ward 4 SR"
                error={fieldState.error?.message}
                required
              />
            )}
          />
          <Controller
            name="attempts"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberField
                label="Attempts, this call included"
                min={1}
                max={20}
                value={field.value}
                onChange={(v) => field.onChange(Number(v) || 1)}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="readback_confirmed"
            control={form.control}
            render={({ field }) => (
              <Checkbox
                label="The receiver read the value back and it matched"
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
          <Button type="submit" tone="primary" loading={save.isPending}>
            Save call record
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
