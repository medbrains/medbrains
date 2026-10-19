import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text, Textarea } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Modal } from "@/components/ui";

export interface SafetyIssue {
  /**
   * "allergy" is a sentinel-event class (danger); "interaction" is a serious
   * drug-drug pair (danger); "duplicate" is a therapeutic duplication
   * (warning); "dose" is a ceiling breach (warning); "reserve_antibiotic" is
   * an AWaRe Reserve antibiotic needing a stewardship request (danger);
   * "non_formulary" is a medicine off the hospital formulary (warning).
   */
  kind: "allergy" | "dose" | "interaction" | "duplicate" | "reserve_antibiotic" | "non_formulary";
  name: string;
  detail: string;
}

/** What the prescriber records: a clinical reason, and the Reserve indication. */
export interface SafetyAnswers {
  reason: string;
  indication: string;
}

const GROUPS: { kind: SafetyIssue["kind"]; tone: "danger" | "warning"; title: string }[] = [
  { kind: "allergy", tone: "danger", title: "Documented drug allergy" },
  { kind: "interaction", tone: "danger", title: "Serious drug-drug interaction" },
  { kind: "reserve_antibiotic", tone: "danger", title: "AWaRe Reserve antibiotic" },
  { kind: "duplicate", tone: "warning", title: "Therapeutic duplication" },
  { kind: "dose", tone: "warning", title: "Dose over catalogue max" },
  { kind: "non_formulary", tone: "warning", title: "Not on the hospital formulary" },
];

const MIN_TEXT = 5;
const MIN_TEXT_MESSAGE = `At least ${MIN_TEXT} characters.`;

function answersSchema(needsReason: boolean, needsIndication: boolean) {
  return z.object({
    reason: needsReason
      ? z.string().trim().min(MIN_TEXT, `Give a clinical reason. ${MIN_TEXT_MESSAGE}`)
      : z.string(),
    indication: needsIndication
      ? z.string().trim().min(MIN_TEXT, `State the indication. ${MIN_TEXT_MESSAGE}`)
      : z.string(),
  });
}

interface Props {
  opened: boolean;
  issues: SafetyIssue[];
  saving: boolean;
  onConfirm: (answers: SafetyAnswers) => void;
  onClose: () => void;
}

function IssueGroup({ issues }: { issues: SafetyIssue[] }) {
  return (
    <>
      {GROUPS.map((group) => {
        const hits = issues.filter((i) => i.kind === group.kind);
        if (hits.length === 0) return null;
        return (
          <Alert
            key={group.kind}
            tone={group.tone}
            icon={<IconAlertTriangle size={16} />}
            title={group.title}
          >
            <Stack gap={2}>
              {hits.map((e) => (
                <Text key={e.name} size="sm">
                  <b>{e.name}</b> — {e.detail}
                </Text>
              ))}
            </Stack>
          </Alert>
        );
      })}
    </>
  );
}

/**
 * Shown when a prescription trips a safety guard. Allergy, interaction,
 * duplication, dose and non-formulary lines need a recorded clinical reason; a
 * Reserve antibiotic needs its indication, which raises an antimicrobial
 * stewardship request. Both are logged to audit on save, and the server
 * re-checks every one of them.
 */
export function SafetyOverrideModal({ opened, issues, saving, onConfirm, onClose }: Props) {
  const needsIndication = issues.some((i) => i.kind === "reserve_antibiotic");
  const needsReason = issues.some((i) => i.kind !== "reserve_antibiotic");
  const schema = useMemo(
    () => answersSchema(needsReason, needsIndication),
    [needsReason, needsIndication],
  );
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SafetyAnswers>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "", indication: "" },
    mode: "onTouched",
  });

  const close = () => {
    reset({ reason: "", indication: "" });
    onClose();
  };
  const submit = handleSubmit((values) => {
    onConfirm({ reason: values.reason.trim(), indication: values.indication.trim() });
    reset({ reason: "", indication: "" });
  });

  return (
    <Modal opened={opened} onClose={close} title="Confirm safety override" size="md">
      <Stack gap="sm">
        <IssueGroup issues={issues} />
        {needsReason && (
          <>
            <Text size="sm" c="dimmed">
              Prescribing past these is allowed only with a recorded clinical justification (e.g.
              prior tolerance, monitoring, no alternative). It is logged against this prescription,
              and a non-formulary medicine still needs the pharmacy's formulary approval.
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
                  onBlur={field.onBlur}
                  error={errors.reason?.message}
                  data-autofocus
                />
              )}
            />
          </>
        )}
        {needsIndication && (
          <Controller
            control={control}
            name="indication"
            render={({ field }) => (
              <Textarea
                label="Indication for the Reserve antibiotic"
                description="Raises an antimicrobial stewardship request unless this patient already has one for it. The pharmacy dispenses once it is approved."
                required
                autosize
                minRows={2}
                placeholder="e.g. Carbapenem-resistant Klebsiella on blood culture; failed meropenem"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.indication?.message}
              />
            )}
          />
        )}
        <Button tone="primary" loading={saving} onClick={() => void submit()}>
          Acknowledge & save
        </Button>
      </Stack>
    </Modal>
  );
}
