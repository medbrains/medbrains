import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text, Textarea } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Modal } from "@/components/ui";

export interface SafetyIssue {
  /**
   * "allergy" is a sentinel-event class (danger); "interaction" is a serious
   * drug-drug pair (danger); "dose" is a ceiling breach (warning).
   */
  kind: "allergy" | "dose" | "interaction";
  name: string;
  detail: string;
}

const schema = z.object({
  reason: z.string().trim().min(5, "Give a clinical reason (at least 5 characters)."),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  opened: boolean;
  issues: SafetyIssue[];
  saving: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

function IssueGroup({ issues }: { issues: SafetyIssue[] }) {
  const allergy = issues.filter((i) => i.kind === "allergy");
  const interaction = issues.filter((i) => i.kind === "interaction");
  const dose = issues.filter((i) => i.kind === "dose");
  return (
    <>
      {allergy.length > 0 && (
        <Alert tone="danger" icon={<IconAlertTriangle size={16} />} title="Documented drug allergy">
          <Stack gap={2}>
            {allergy.map((e) => (
              <Text key={e.name} size="sm">
                <b>{e.name}</b> — {e.detail}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}
      {interaction.length > 0 && (
        <Alert
          tone="danger"
          icon={<IconAlertTriangle size={16} />}
          title="Serious drug-drug interaction"
        >
          <Stack gap={2}>
            {interaction.map((e) => (
              <Text key={e.name} size="sm">
                <b>{e.name}</b> — {e.detail}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}
      {dose.length > 0 && (
        <Alert
          tone="warning"
          icon={<IconAlertTriangle size={16} />}
          title="Dose over catalogue max"
        >
          <Stack gap={2}>
            {dose.map((e) => (
              <Text key={e.name} size="sm">
                <b>{e.name}</b> — {e.detail}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}
    </>
  );
}

/**
 * Shown when a prescription trips a safety guard — a documented drug allergy
 * and/or a daily dose over the catalogue maximum. The order is never
 * hard-blocked (clinical judgment / titration / desensitisation) — the
 * prescriber records a reason, logged to audit on save.
 */
export function SafetyOverrideModal({ opened, issues, saving, onConfirm, onClose }: Props) {
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

  const hasSentinel = issues.some((i) => i.kind === "allergy" || i.kind === "interaction");

  return (
    <Modal opened={opened} onClose={close} title="Confirm safety override" size="md">
      <Stack gap="sm">
        <IssueGroup issues={issues} />
        <Text size="sm" c="dimmed">
          {hasSentinel
            ? "Prescribing despite a documented allergy or a serious drug-drug interaction is allowed only with a recorded clinical justification (e.g. prior tolerance, monitoring, no alternative). The override is logged against this prescription."
            : "Prescribing above the daily ceiling is allowed with a recorded reason (titration, specialist regimen, etc.). The override is logged against this prescription."}
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
              placeholder="e.g. Prior documented tolerance; no suitable alternative; under specialist supervision"
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
