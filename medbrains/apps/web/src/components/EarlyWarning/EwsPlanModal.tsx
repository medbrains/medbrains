// Set a patient's early-warning scoring plan: SpO₂ Scale 2 for confirmed
// hypercapnic respiratory failure (with its target range), or an explicit
// tool. RCP NEWS2 makes Scale 2 a clinical decision maker's prescription;
// callers show this only to holders of `nurse.ews.plan`.

import { zodResolver } from "@hookform/resolvers/zod";
import type { EwsTool } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormModal } from "@/components";
import { Input, Select, Switch, TextArea, toast } from "@/components/ui";
import { nurseActivitiesService } from "@/services/nurseActivities.service";

const schema = z
  .object({
    spo2_scale2: z.boolean(),
    scale2_target: z.string(),
    tool_override: z.enum(["auto", "news2", "pews", "meows"]),
    reason: z.string().trim().min(3, "Give the clinical reason"),
  })
  .refine((v) => !v.spo2_scale2 || v.scale2_target.trim().length > 0, {
    path: ["scale2_target"],
    message: "Scale 2 needs the target saturation range, e.g. 88–92%",
  });

type FormValues = z.infer<typeof schema>;

const TOOLS = [
  { value: "auto", label: "Automatic (by age and pregnancy)" },
  { value: "news2", label: "NEWS2" },
  { value: "pews", label: "PEWS" },
  { value: "meows", label: "MEOWS" },
];

interface EwsPlanModalProps {
  encounterId: string;
  opened: boolean;
  onClose: () => void;
}

export function EwsPlanModal({ encounterId, opened, onClose }: EwsPlanModalProps) {
  const qc = useQueryClient();
  // The current plan, so saving never silently drops a prescribed Scale 2.
  const { data: plan } = useQuery({
    queryKey: ["ews-plan", encounterId],
    queryFn: () => nurseActivitiesService.getEwsPlan(encounterId),
    enabled: opened,
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      spo2_scale2: plan?.spo2_scale2 ?? false,
      scale2_target: plan?.scale2_target ?? "",
      tool_override: plan?.tool_override ?? "auto",
      reason: "",
    },
  });
  const save = useMutation({
    mutationFn: (v: FormValues) =>
      nurseActivitiesService.setEwsPlan(encounterId, {
        spo2_scale2: v.spo2_scale2,
        scale2_target: v.spo2_scale2 ? v.scale2_target.trim() : undefined,
        tool_override: v.tool_override === "auto" ? null : (v.tool_override as EwsTool),
        reason: v.reason.trim(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ews-plan", encounterId] });
      toast.success("Scoring plan saved — it applies from the next reading");
      onClose();
    },
  });
  const scale2 = form.watch("spo2_scale2");
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title="Early-warning scoring plan"
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitLabel="Save plan"
      submitting={save.isPending}
      error={save.error?.message ?? null}
    >
      <Controller
        control={form.control}
        name="spo2_scale2"
        render={({ field }) => (
          <Switch
            label="Use SpO₂ Scale 2 (confirmed hypercapnic respiratory failure)"
            checked={field.value}
            onChange={(e) => field.onChange(e.currentTarget.checked)}
          />
        )}
      />
      {scale2 && (
        <Controller
          control={form.control}
          name="scale2_target"
          render={({ field, fieldState }) => (
            <Input
              label="Target saturation range"
              placeholder="88–92%"
              {...field}
              error={fieldState.error?.message}
            />
          )}
        />
      )}
      <Controller
        control={form.control}
        name="tool_override"
        render={({ field }) => (
          <Select
            label="Scoring tool"
            data={TOOLS}
            value={field.value}
            onChange={(v) => field.onChange(v ?? "auto")}
            allowDeselect={false}
          />
        )}
      />
      <Controller
        control={form.control}
        name="reason"
        render={({ field, fieldState }) => (
          <TextArea
            label="Clinical reason"
            required
            minRows={2}
            {...field}
            error={fieldState.error?.message}
          />
        )}
      />
    </FormModal>
  );
}
