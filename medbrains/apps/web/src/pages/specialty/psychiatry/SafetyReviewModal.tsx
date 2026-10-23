import { Stack, Text } from "@mantine/core";
import type { PsychSafetyReviewRequest } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Modal, Select, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { REVIEW_OUTCOMES } from "./instruments";

interface SafetyReviewModalProps {
  screeningId: string | null;
  onClose: () => void;
}

/** Record the suicide-risk review a positive PHQ-9 item 9 opened. */
export function SafetyReviewModal({ screeningId, onClose }: SafetyReviewModalProps) {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<PsychSafetyReviewRequest["outcome"] | null>(null);
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: (id: string) =>
      psychiatryService.completeSafetyReview(id, { outcome: outcome ?? "low", note: note.trim() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["psych-screenings"] });
      void qc.invalidateQueries({ queryKey: ["psych-safety-pending"] });
      setOutcome(null);
      setNote("");
      onClose();
    },
  });
  return (
    <Modal
      opened={screeningId !== null}
      onClose={onClose}
      title="Suicide-risk review"
      primaryAction={{
        label: "Record review",
        onClick: () => screeningId && save.mutate(screeningId),
        loading: save.isPending,
        disabled: !outcome || note.trim().length === 0,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Text size="sm">
          Assess the patient in person: current thoughts, plan, intent, means and protective
          factors. Do not leave a patient at high risk alone.
        </Text>
        <Select
          label="Assessed risk"
          required
          data={REVIEW_OUTCOMES}
          value={outcome}
          onChange={(v) => setOutcome(v as PsychSafetyReviewRequest["outcome"] | null)}
        />
        <TextArea
          label="Assessment and safety plan"
          required
          autosize
          minRows={3}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
      </Stack>
    </Modal>
  );
}
