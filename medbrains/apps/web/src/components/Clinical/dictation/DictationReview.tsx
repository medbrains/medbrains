import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type {
  DictationDecision,
  MedicineDecision,
  ModelMedicine,
  SectionDecision,
  SessionView,
} from "@medbrains/types";
import { IconCheck, IconPill, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { AiLabel, Badge, Button, Card, TextArea } from "@/components/ui";
import styles from "./dictation.module.scss";

interface DictationReviewProps {
  session: SessionView;
  saving: boolean;
  /** Every suggestion has a decision; save the accepted ones. */
  onSave: (sections: SectionDecision[], medicines: MedicineDecision[]) => void;
}

type Decided = DictationDecision | null;

/** A drafted medicine as the one line the doctor reads and decides on. */
export function medicineLine(m: ModelMedicine): string {
  return [m.name, m.dose, m.frequency, m.duration, m.route].filter(Boolean).join(" ");
}

/**
 * The draft beside what was said: each section editable, each accepted or
 * rejected by the doctor; each medicine accepted onto the prescription pad
 * (still to be prescribed there) or rejected. Nothing is saved until every
 * suggestion has a decision and the doctor presses Save.
 */
export function DictationReview({ session, saving, onSave }: DictationReviewProps) {
  const draft = session.draft ?? { sections: [], medicines: [] };
  const [texts, setTexts] = useState(() => draft.sections.map((s) => s.text));
  const [sectionCalls, setSectionCalls] = useState<Decided[]>(() => draft.sections.map(() => null));
  const [medicineCalls, setMedicineCalls] = useState<Decided[]>(() =>
    draft.medicines.map(() => null),
  );
  const undecided = [...sectionCalls, ...medicineCalls].filter((d) => d === null).length;

  /** Hand every decision to the caller; an undecided suggestion counts as rejected. */
  const save = (rejectAll: boolean) =>
    onSave(
      draft.sections.map((s, i) => ({
        code: s.code,
        decision: rejectAll ? "rejected" : (sectionCalls[i] ?? "rejected"),
        text: texts[i],
      })),
      draft.medicines.map((_, index) => ({
        index,
        decision: rejectAll ? "rejected" : (medicineCalls[index] ?? "rejected"),
      })),
    );

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Text fw={600} size="sm">
              What you said
            </Text>
            <Text size="xs" c="dimmed">
              Speech-to-text (
              {session.stt_adapter === "cloud" ? "cloud service" : "this hospital's server"})
            </Text>
            <Text size="sm" className={styles.transcript} data-testid="dictation-transcript">
              {session.transcript}
            </Text>
          </Stack>
        </Card>
        <Stack gap="sm">
          <Group gap="xs">
            <Text fw={600} size="sm">
              Draft note
            </Text>
            <AiLabel size="xs" text="generated" aria-label="AI-drafted from your dictation" />
          </Group>
          {draft.sections.map((section, i) => (
            <Card key={section.code} withBorder padding="sm">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600} size="sm">
                    {section.title}
                  </Text>
                  <DecisionBadge
                    decision={sectionCalls[i] ?? null}
                    edited={texts[i] !== section.text}
                  />
                </Group>
                <TextArea
                  label={`${section.title} as drafted`}
                  autosize
                  minRows={2}
                  value={texts[i]}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setTexts((all) => all.map((t, j) => (j === i ? value : t)));
                  }}
                />
                <DecisionButtons
                  subject={section.title}
                  acceptLabel="Accept"
                  decision={sectionCalls[i] ?? null}
                  onDecide={(d) => setSectionCalls((all) => all.map((c, j) => (j === i ? d : c)))}
                />
              </Stack>
            </Card>
          ))}
          {draft.medicines.length > 0 && (
            <Card withBorder padding="sm">
              <Stack gap="xs">
                <Group gap="xs">
                  <IconPill size={16} aria-hidden />
                  <Text fw={600} size="sm">
                    Medicines you mentioned
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  Accepted medicines wait on the Prescriptions tab. You prescribe them there,
                  through the allergy, interaction and schedule checks.
                </Text>
                {draft.medicines.map((m, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a draft never changes once made; its position is the medicine's identity, and the review is sent back by position.
                  <Group key={`${m.name}-${index}`} justify="space-between" wrap="nowrap">
                    <Text size="sm">{medicineLine(m)}</Text>
                    <DecisionButtons
                      subject={m.name}
                      acceptLabel="Add to prescription pad"
                      decision={medicineCalls[index] ?? null}
                      onDecide={(d) =>
                        setMedicineCalls((all) => all.map((c, j) => (j === index ? d : c)))
                      }
                    />
                  </Group>
                ))}
              </Stack>
            </Card>
          )}
        </Stack>
      </SimpleGrid>
      <Group justify="space-between">
        <Text size="xs" c="dimmed" aria-live="polite">
          {undecided > 0
            ? `${undecided} suggestion${undecided === 1 ? "" : "s"} still to accept or reject`
            : "Every suggestion has a decision"}
        </Text>
        <Group gap="xs">
          <Button tone="ghost" size="xs" disabled={saving} onClick={() => save(true)}>
            Reject all
          </Button>
          <Button
            tone="primary"
            size="xs"
            loading={saving}
            disabled={undecided > 0}
            onClick={() => save(false)}
          >
            Save to note
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}

interface DecisionButtonsProps {
  subject: string;
  acceptLabel: string;
  decision: Decided;
  onDecide: (decision: DictationDecision) => void;
}

/** Accept and Reject as a pressed pair, named for what they decide. */
function DecisionButtons({ subject, acceptLabel, decision, onDecide }: DecisionButtonsProps) {
  return (
    <Group gap="xs">
      <Button
        tone={decision === "accepted" ? "primary" : "tertiary"}
        size="xs"
        leftSection={<IconCheck size={16} aria-hidden />}
        aria-pressed={decision === "accepted"}
        aria-label={`${acceptLabel}: ${subject}`}
        onClick={() => onDecide("accepted")}
      >
        {acceptLabel}
      </Button>
      <Button
        tone={decision === "rejected" ? "danger" : "danger-ghost"}
        size="xs"
        leftSection={<IconX size={16} aria-hidden />}
        aria-pressed={decision === "rejected"}
        aria-label={`Reject: ${subject}`}
        onClick={() => onDecide("rejected")}
      >
        Reject
      </Button>
    </Group>
  );
}

/** The decision in words, never colour alone. */
function DecisionBadge({ decision, edited }: { decision: Decided; edited: boolean }) {
  if (decision === "rejected") return <Badge tone="danger">Rejected</Badge>;
  if (decision === "accepted")
    return <Badge tone="success">{edited ? "Edited" : "Accepted"}</Badge>;
  return <Badge tone="neutral">{edited ? "Edited, not decided" : "Not decided"}</Badge>;
}
