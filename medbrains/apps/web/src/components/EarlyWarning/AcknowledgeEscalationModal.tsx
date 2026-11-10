// Acknowledge an early-warning escalation by recording what was done. The
// response is required: an acknowledgement without one is not a response.

import { zodResolver } from "@hookform/resolvers/zod";
import { Text } from "@mantine/core";
import type { EwsEscalation, EwsResponseAction } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormModal } from "@/components";
import { Select, TextArea, toast } from "@/components/ui";
import { careViewService } from "@/services/careView.service";
import { EWS_BAND_LABEL, EWS_RESPONSE_LABEL, EWS_TOOL_LABEL, ewsTotalText } from "./ews-display";

const schema = z.object({
  response_action: z.enum([
    "bedside_review",
    "medical_review",
    "plan_changed",
    "rapid_response_called",
    "transfer_higher_care",
    "other",
  ]),
  response_note: z.string().trim().min(3, "Say what was done"),
});

type FormValues = z.infer<typeof schema>;

const ACTIONS = (Object.keys(EWS_RESPONSE_LABEL) as EwsResponseAction[]).map((value) => ({
  value,
  label: EWS_RESPONSE_LABEL[value],
}));

export function AcknowledgeEscalationModal({
  escalation,
  onClose,
}: {
  escalation: EwsEscalation;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { response_action: "bedside_review", response_note: "" },
  });
  const ack = useMutation({
    mutationFn: (v: FormValues) => careViewService.acknowledgeEwsEscalation(escalation.id, v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["care-view"] });
      toast.success("Escalation acknowledged");
      onClose();
    },
  });
  return (
    <FormModal
      opened
      onClose={onClose}
      title="Acknowledge escalation"
      onSubmit={form.handleSubmit((v) => ack.mutate(v))}
      submitLabel="Acknowledge"
      submitting={ack.isPending}
      error={ack.error?.message ?? null}
    >
      <Text size="sm">
        {escalation.patient_name} ({escalation.uhid}) — {EWS_TOOL_LABEL[escalation.ews_tool]}{" "}
        {ewsTotalText(escalation.ews_total, escalation.incomplete)},{" "}
        {EWS_BAND_LABEL[escalation.band].toLowerCase()}
      </Text>
      <Controller
        control={form.control}
        name="response_action"
        render={({ field }) => (
          <Select
            label="What was done"
            data={ACTIONS}
            value={field.value}
            onChange={(v) => field.onChange(v ?? "bedside_review")}
            allowDeselect={false}
          />
        )}
      />
      <Controller
        control={form.control}
        name="response_note"
        render={({ field, fieldState }) => (
          <TextArea
            label="Response"
            required
            minRows={3}
            placeholder="Who reviewed, findings, plan"
            {...field}
            error={fieldState.error?.message}
          />
        )}
      />
    </FormModal>
  );
}
