// The lab-to-clinician phone call for a critical value, documented: who took
// the call, when, how many attempts, and the value read back. NABL and NABH
// ask for this record. Calls are append-only (one row each); the caller is
// the signed-in user and the server decides whether the read-back matched.

import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Stack, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type LabCriticalAlert, type LabCriticalCall, P } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge, Button, Modal, NumberField, toast } from "@/components/ui";
import { labService } from "@/services/lab.service";

const callSchema = z.object({
  received_by: z.string().trim().min(2, "Say who took the call"),
  attempts: z.number().int().min(1).max(20),
  readback_value: z.string().trim().min(1, "Type the value they read back"),
});
type CallInput = z.infer<typeof callSchema>;

interface CriticalCallProps {
  alert: LabCriticalAlert;
}

/** One recorded call, with whether its read-back matched, in words. */
function CallBadge({ call }: { call: LabCriticalCall }) {
  return (
    <Badge tone={call.readback_confirmed ? "success" : "danger"} size="sm">
      Called {call.received_by} at {new Date(call.called_at).toLocaleTimeString()} ({call.attempts}{" "}
      {call.attempts === 1 ? "attempt" : "attempts"}, read back "{call.readback_value}"
      {call.readback_confirmed ? "" : ": DOES NOT MATCH"})
    </Badge>
  );
}

/**
 * The recorded calls, a blocked escalation in words, and a "Record call"
 * button for holders of `lab.results.critical_call`. Another call can always
 * be added: a mismatched read-back needs a second one.
 */
export function CriticalCall({ alert }: CriticalCallProps) {
  const canRecord = useHasPermission(P.LAB.RESULTS_CRITICAL_CALL);
  const [open, setOpen] = useState(false);
  const calls = alert.calls ?? [];
  return (
    <>
      {alert.escalation_blocked_reason && (
        <Badge tone="warning" size="sm">
          {alert.escalation_blocked_reason}
        </Badge>
      )}
      {calls.map((c) => (
        <CallBadge key={c.id} call={c} />
      ))}
      {canRecord && (
        <Button tone="danger-tertiary" size="xs" onClick={() => setOpen(true)}>
          {calls.length === 0 ? "Record call" : "Record another call"}
        </Button>
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
    defaultValues: { received_by: "", attempts: 1, readback_value: "" },
  });
  const save = useMutation({
    mutationFn: (data: CallInput) => labService.recordCriticalCall(alert.id, data),
    onSuccess: (call) => {
      void qc.invalidateQueries({ queryKey: ["lab-critical-alerts"] });
      if (call.readback_confirmed) {
        toast.success("Call recorded");
      } else {
        toast.error("The value read back does not match. Call again.", {
          title: "Call recorded: read-back mismatch",
        });
      }
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record the call" }),
  });
  return (
    <Modal opened onClose={onClose} title="Record the critical-value call" size="sm">
      <Box component="form" onSubmit={form.handleSubmit((data) => save.mutate(data))}>
        <Stack gap="sm">
          <Text size="sm">
            {alert.parameter_name}:{" "}
            <Text span fw={700}>
              {alert.value}
            </Text>
            . You are recorded as the caller.
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
            name="readback_value"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextInput
                {...field}
                label="Value they read back"
                placeholder="As they said it"
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
          <Button type="submit" tone="primary" loading={save.isPending}>
            Save call record
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
}
