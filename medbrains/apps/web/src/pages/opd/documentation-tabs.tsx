// History, Review of systems and Physical exam: sections of the doctor's own
// Consultation note, edited on their tabs, signed with the note on the case
// sheet (RFCs/RFC-MODULE-clinical-notes.md, phase 1b).

import { Group, Loader, Stack, Text } from "@mantine/core";
import type {
  FamilyHistoryEntry,
  PastMedicalEntry,
  PastSurgicalEntry,
  PhysicalExamination,
  ReviewOfSystems as ROSType,
  SocialHistory,
} from "@medbrains/types";
import { useState } from "react";
import { PhysicalExamPanel, ReviewOfSystems, StructuredHistory } from "@/components";
import type {
  ExaminationData,
  HistoryData,
} from "@/components/Clinical/case-sheet/section-summary";
import { Alert, Button, toast } from "@/components/ui";
import { type SectionCode, type SectionSource, useNoteSection } from "./use-note-section";

interface EncounterTabProps {
  encounterId: string;
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";

/** Who recorded what is on screen, and when — the margin of the paper sheet. */
function Provenance({ source, canWrite }: { source: SectionSource; canWrite: boolean }) {
  let text = canWrite
    ? "Not recorded yet — what you enter starts your consultation note."
    : "Not recorded yet.";
  if (source.kind === "my_draft") {
    text = "In your unsigned consultation note — sign it on the Consultation tab.";
  } else if (source.kind === "signed") {
    const n = source.note;
    text = `Recorded by ${n.author_name} · ${when(n.signed_at)}${canWrite ? " — editing starts your own note from it." : ""}`;
  } else if (source.kind === "legacy") {
    text = "Recorded before notes were signed.";
  }
  return (
    <Text size="xs" c="dimmed" aria-live="polite">
      {text}
    </Text>
  );
}

function useSection(encounterId: string, code: SectionCode) {
  return useNoteSection(encounterId, code, (error) =>
    toast.error(error.message, { title: "Not saved" }),
  );
}

function Unavailable() {
  return (
    <Alert tone="danger" title="This section could not be loaded">
      <Text size="sm">Reload the page; if it keeps failing, tell IT.</Text>
    </Alert>
  );
}

// ── History ──────────────────────────────────────────────

export function HistoryTab({ encounterId }: EncounterTabProps) {
  const section = useSection(encounterId, "history");
  if (section.isPending) return <Loader size="sm" />;
  if (section.isError) return <Unavailable />;
  const history = (section.data ?? {}) as HistoryData;
  return (
    <Stack gap="xs">
      <Provenance source={section.source} canWrite={section.canWrite} />
      <StructuredHistory
        hpi={history.hpi ?? ""}
        pastMedical={(history.past_medical_history ?? []) as PastMedicalEntry[]}
        pastSurgical={(history.past_surgical_history ?? []) as PastSurgicalEntry[]}
        familyHistory={(history.family_history ?? []) as FamilyHistoryEntry[]}
        socialHistory={(history.social_history ?? {}) as SocialHistory}
        canUpdate={section.canWrite}
        onUpdate={(change) => void section.save({ ...history, ...change }, true)}
      />
    </Stack>
  );
}

// ── Review of Systems ────────────────────────────────────

export function ROSTab({ encounterId }: EncounterTabProps) {
  const section = useSection(encounterId, "ros");
  if (section.isPending) return <Loader size="sm" />;
  if (section.isError) return <Unavailable />;
  return (
    <Stack gap="xs">
      <Provenance source={section.source} canWrite={section.canWrite} />
      <ROSEditor
        initial={(section.data ?? {}) as ROSType}
        canWrite={section.canWrite}
        onSave={(ros) => section.save(ros, true)}
      />
    </Stack>
  );
}

function ROSEditor({
  initial,
  canWrite,
  onSave,
}: {
  initial: ROSType;
  canWrite: boolean;
  onSave: (ros: ROSType) => Promise<unknown>;
}) {
  const [ros, setRos] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <Stack>
      <ReviewOfSystems
        data={ros}
        canUpdate={canWrite}
        onUpdate={(next) => {
          setRos(next);
          setDirty(true);
        }}
      />
      {canWrite && (
        <Group justify="flex-end">
          <Button
            tone="primary"
            disabled={!dirty}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(ros);
                setDirty(false);
              } catch (error) {
                toast.error((error as Error).message, { title: "Not saved" });
              } finally {
                setSaving(false);
              }
            }}
          >
            Save to my note
          </Button>
        </Group>
      )}
    </Stack>
  );
}

// ── Physical Examination ─────────────────────────────────

export function PhysicalExamTab({ encounterId }: EncounterTabProps) {
  const section = useSection(encounterId, "examination");
  if (section.isPending) return <Loader size="sm" />;
  if (section.isError) return <Unavailable />;
  const exam = (section.data ?? {}) as ExaminationData;
  return (
    <Stack gap="xs">
      <Provenance source={section.source} canWrite={section.canWrite} />
      <PhysicalExamPanel
        data={(exam.exam ?? {}) as PhysicalExamination}
        generalAppearance={exam.general_appearance ?? ""}
        canUpdate={section.canWrite}
        onUpdate={(next, generalAppearance) =>
          void section.save(
            {
              exam: next,
              general_appearance: generalAppearance ?? exam.general_appearance ?? null,
            },
            // Typing waits for a pause; adding or removing a finding is one act
            // and is saved at once.
            JSON.stringify(next.findings ?? []) !== JSON.stringify(exam.exam?.findings ?? []),
          )
        }
      />
    </Stack>
  );
}
