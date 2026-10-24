import { Group, Radio, Stack, Text } from "@mantine/core";
import type { PsychScreening, ScreeningInstrument } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Modal, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { ANSWER_OPTIONS, INSTRUMENT_ITEMS, INSTRUMENT_LABEL } from "./instruments";

interface ScreeningFormProps {
  psychPatientId: string;
  instrument: ScreeningInstrument;
  opened: boolean;
  onClose: () => void;
  onSaved: (row: PsychScreening) => void;
}

/** One questionnaire, item by item. Scoring happens on the server. */
export function ScreeningForm({
  psychPatientId,
  instrument,
  opened,
  onClose,
  onSaved,
}: ScreeningFormProps) {
  const qc = useQueryClient();
  const items = INSTRUMENT_ITEMS[instrument];
  const [answers, setAnswers] = useState<(number | null)[]>(() => items.map(() => null));
  const [notes, setNotes] = useState("");
  const complete = answers.every((a) => a !== null);
  const save = useMutation({
    mutationFn: () =>
      psychiatryService.createScreening(psychPatientId, {
        instrument,
        answers: answers.map((a) => a ?? 0),
        notes: notes.trim() || undefined,
      }),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["psych-screenings", psychPatientId] });
      setAnswers(items.map(() => null));
      setNotes("");
      onSaved(row);
      onClose();
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={INSTRUMENT_LABEL[instrument]}
      size="xl"
      primaryAction={{
        label: "Save and score",
        onClick: () => save.mutate(),
        loading: save.isPending,
        disabled: !complete,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Over the last two weeks, how often has the patient been bothered by the following?
        </Text>
        {items.map((text, i) => (
          <Radio.Group
            key={text}
            label={`${i + 1}. ${text}`}
            value={answers[i] === null ? null : String(answers[i])}
            onChange={(v) => setAnswers((prev) => prev.map((a, j) => (j === i ? Number(v) : a)))}
            required
          >
            <Group gap="md" mt={4}>
              {ANSWER_OPTIONS.map((o) => (
                <Radio key={o.value} value={o.value} label={`${o.label} (${o.value})`} />
              ))}
            </Group>
          </Radio.Group>
        ))}
        <TextArea
          label="Notes"
          autosize
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />
        {!complete && (
          <Text size="xs" c="dimmed">
            Answer every item to score the questionnaire.
          </Text>
        )}
        {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
      </Stack>
    </Modal>
  );
}
