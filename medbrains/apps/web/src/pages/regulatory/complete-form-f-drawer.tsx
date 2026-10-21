/**
 * Completing a PC-PNDT Form F: indication, performing doctor, living children,
 * result, and the two declarations. Until it is complete the scan's report
 * cannot be verified. Opened from the PCPNDT register or the radiology order.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { PcpndtForm } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import {
  Alert,
  Button,
  Checkbox,
  Modal,
  NumberField,
  Select,
  Switch,
  TextArea,
  toast,
} from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";
import { FORM_F_INDICATIONS } from "./form-f-indications";

const schema = z.object({
  indication: z.string().min(3, "Choose or write the indication"),
  performing_doctor_id: z.string().min(1, "Who performed the scan?"),
  living_sons: z.number().int().min(0).optional(),
  living_daughters: z.number().int().min(0).optional(),
  self_referred: z.boolean(),
  result_summary: z.string().optional(),
  woman_declares: z.literal(true, { message: "Her declaration is required" }),
  doctor_declares: z.literal(true, { message: "Your declaration is required" }),
});
type Values = z.infer<typeof schema>;

interface CompleteFormFDrawerProps {
  form: PcpndtForm | null;
  onClose: () => void;
}

export function CompleteFormFDrawer({ form, onClose }: CompleteFormFDrawerProps) {
  const qc = useQueryClient();
  const { control, handleSubmit, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    values: form
      ? {
          indication: form.indication ?? "",
          performing_doctor_id: form.performing_doctor_id ?? "",
          living_sons: form.living_sons ?? undefined,
          living_daughters: form.living_daughters ?? undefined,
          self_referred: form.self_referred,
          result_summary: form.result_summary ?? "",
          woman_declares: false as unknown as true,
          doctor_declares: false as unknown as true,
        }
      : undefined,
  });
  const complete = useMutation({
    mutationFn: (v: Values) => regulatoryService.completePcpndtForm(form?.id ?? "", v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-pcpndt"] });
      void qc.invalidateQueries({ queryKey: ["form-f-for-order"] });
      toast.success("Form F completed");
      reset();
      onClose();
    },
  });

  return (
    <Modal
      opened={Boolean(form)}
      onClose={onClose}
      title={`Form F ${form?.form_number ?? ""}`}
      fullScreen
    >
      <Stack
        component="form"
        gap="md"
        aria-label="Complete Form F"
        onSubmit={handleSubmit((v) => complete.mutate(v))}
      >
        <Text size="sm" c="dimmed">
          {form?.procedure_type}
          {form?.gestational_age_weeks ? ` · ${form.gestational_age_weeks} weeks` : ""}
        </Text>
        <Controller
          control={control}
          name="indication"
          render={({ field, fieldState }) => (
            <Select
              label="Indication"
              data={[...FORM_F_INDICATIONS]}
              searchable
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              error={fieldState.error?.message}
              withAsterisk
            />
          )}
        />
        <Controller
          control={control}
          name="performing_doctor_id"
          render={({ field, fieldState }) => (
            <DoctorSearchSelect
              label="Performed by"
              value={field.value}
              onChange={(v) => field.onChange(v ?? "")}
              error={fieldState.error?.message}
            />
          )}
        />
        <SimpleGrid cols={2}>
          <Controller
            control={control}
            name="living_sons"
            render={({ field }) => (
              <NumberField
                label="Living sons"
                min={0}
                allowDecimal={false}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
              />
            )}
          />
          <Controller
            control={control}
            name="living_daughters"
            render={({ field }) => (
              <NumberField
                label="Living daughters"
                min={0}
                allowDecimal={false}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
              />
            )}
          />
        </SimpleGrid>
        <Controller
          control={control}
          name="self_referred"
          render={({ field }) => (
            <Switch
              label="Self-referred (no referring doctor)"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="result_summary"
          render={({ field }) => (
            <TextArea
              {...field}
              label="Result of the scan"
              description="Never the sex of the foetus"
              minRows={2}
            />
          )}
        />
        <Controller
          control={control}
          name="woman_declares"
          render={({ field, fieldState }) => (
            <Checkbox
              checked={field.value === true}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
              error={fieldState.error?.message}
              label="She has declared she does not want to know the sex of her foetus"
            />
          )}
        />
        <Controller
          control={control}
          name="doctor_declares"
          render={({ field, fieldState }) => (
            <Checkbox
              checked={field.value === true}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
              error={fieldState.error?.message}
              label="I declare I have neither detected nor disclosed the sex of the foetus"
            />
          )}
        />
        {complete.isError && <Alert tone="danger">{complete.error.message}</Alert>}
        <Group justify="flex-end">
          <Button type="submit" tone="primary" loading={complete.isPending}>
            Complete Form F
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
