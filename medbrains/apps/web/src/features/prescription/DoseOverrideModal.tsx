import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text, Textarea } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Modal } from "@/components/ui";

export interface DoseExceedanceView {
  name: string;
  label: string;
}

const schema = z.object({
  reason: z.string().trim().min(5, "Give a clinical reason (at least 5 characters)."),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  opened: boolean;
  exceedances: DoseExceedanceView[];
  saving: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/**
 * Shown when a prescription line exceeds the catalogue max dose. The order is
 * never hard-blocked (clinical judgment / titration) — the prescriber must
 * record a reason, which is logged to audit on save.
 */
export function DoseOverrideModal({ opened, exceedances, saving, onConfirm, onClose }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "" },
    mode: "onTouched",
  });

  const close = () => {
    reset({ reason: "" });
    onClose();
  };
  const submit = handleSubmit((values) => {
    onConfirm(values.reason.trim());
    reset({ reason: "" });
  });

  return (
    <Modal opened={opened} onClose={close} title="Dose exceeds catalogue maximum" size="md">
      <Stack gap="sm">
        <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
          <Stack gap={2}>
            {exceedances.map((e) => (
              <Text key={e.name} size="sm">
                <b>{e.name}</b> — {e.label}
              </Text>
            ))}
          </Stack>
        </Alert>
        <Text size="sm" c="dimmed">
          Prescribing above the daily ceiling is allowed with a recorded reason (titration,
          specialist regimen, etc.). The override is logged against this prescription.
        </Text>
        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <Textarea
              label="Override reason"
              required
              autosize
              minRows={2}
              placeholder="e.g. Oncology pain protocol — titrated under specialist guidance"
              value={field.value}
              onChange={field.onChange}
              error={errors.reason?.message}
              data-autofocus
            />
          )}
        />
        <Button tone="primary" loading={saving} onClick={() => void submit()}>
          Acknowledge & save
        </Button>
      </Stack>
    </Modal>
  );
}
