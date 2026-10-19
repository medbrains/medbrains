import { Box, Card, Group, Badge as MantineBadge, Stack, Text } from "@mantine/core";
import type { Note, NoteSectionPatch } from "@medbrains/types";
import type { ReactNode } from "react";
import { Badge, Button, RichTextEditor } from "@/components/ui";
import { NoteDraftEditor } from "./NoteDraftEditor";
import { STRUCTURED_SECTIONS, summariseSection } from "./section-summary";

export interface NoteActions {
  canSign: boolean;
  canWrite: boolean;
  canMarkInError: boolean;
  canCosign: boolean;
  saveDraft: (note: Note, patches: NoteSectionPatch[]) => Promise<void>;
  sign: (note: Note) => Promise<void>;
  revise: (note: Note) => void;
  discard: (note: Note) => void;
  addendum: (note: Note) => void;
  markInError: (note: Note) => void;
  countersign: (note: Note) => void;
  returnToAuthor: (note: Note) => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/** "Signed 5 Oct 10:42", "Recorded …" for notes from before signing, … */
function statusOf(note: Note): {
  label: string;
  tone: "success" | "warning" | "neutral" | "danger";
} {
  if (note.status === "entered_in_error") return { label: "Entered in error", tone: "danger" };
  if (note.status === "draft") {
    return {
      label: note.current_version > 1 ? "Revising — not signed" : "Draft — not signed",
      tone: "warning",
    };
  }
  if (note.migrated_from)
    return { label: `Recorded ${when(note.signed_at ?? note.created_at)}`, tone: "neutral" };
  const revised = note.current_version > 1 ? " · revised" : "";
  return { label: `Signed ${when(note.signed_at ?? note.created_at)}${revised}`, tone: "success" };
}

/** Where the consultant's countersignature stands, when one is asked for. */
function CosignLine({ note }: { note: Note }) {
  if (!note.cosign_status || note.status === "entered_in_error") return null;
  const by = note.cosigner_name ?? "the consultant";
  const text =
    note.cosign_status === "pending"
      ? `Awaiting countersign by ${by}`
      : note.cosign_status === "countersigned"
        ? `Countersigned by ${by} ${note.cosigned_at ? when(note.cosigned_at) : ""}`
        : `Returned by ${by}: ${note.cosign_comment ?? ""}`;
  return (
    <Text size="xs" c={note.cosign_status === "returned" ? "var(--mb-support-warning)" : "dimmed"}>
      {text.trim()}
    </Text>
  );
}

/** Who wrote it, as the sheet's margin would: name, role, registration, unit. */
function AuthorLine({ note }: { note: Note }) {
  const parts = [
    note.author_name,
    note.author_role.replace(/_/g, " "),
    note.author_registration && `Reg ${note.author_registration}`,
    note.department_name,
  ].filter(Boolean);
  return (
    <Text size="xs" c="dimmed">
      {parts.join(" · ")} · for care at {when(note.service_at)}
    </Text>
  );
}

function Sections({ note }: { note: Note }) {
  if (note.withheld) {
    return (
      <Text size="sm" c="dimmed">
        Content withheld: your access to consultation notes is restricted.
      </Text>
    );
  }
  const written = note.sections
    .map((s) => ({
      ...s,
      lines: STRUCTURED_SECTIONS[s.code] ? summariseSection(s.code, s.data) : [],
      hasText: s.text.replace(/<[^>]*>/g, "").trim() !== "",
    }))
    .filter((s) => s.hasText || s.lines.length > 0);
  if (written.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nothing written yet.
      </Text>
    );
  }
  return (
    <Stack gap={6}>
      {written.map((s) => (
        <Box key={s.code}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            {s.title}
          </Text>
          {s.lines.map((line) => (
            <Text key={line} size="sm">
              {line}
            </Text>
          ))}
          {s.hasText && <RichTextEditor value={s.text} readOnly minHeight={0} />}
        </Box>
      ))}
    </Stack>
  );
}

interface NoteCardProps {
  note: Note;
  addenda: Note[];
  actions: NoteActions;
}

/** One entry on the case sheet, with its addenda beneath it. */
export function NoteCard({ note, addenda, actions }: NoteCardProps) {
  const status = statusOf(note);
  const title = note.amends_note_id ? "Addendum" : note.note_type_name;
  const inError = note.status === "entered_in_error";
  const editing = note.is_mine && note.status === "draft" && actions.canWrite;
  const controls: ReactNode[] = [];
  if (editing) {
    controls.push(
      <Button key="discard" tone="ghost" size="xs" onClick={() => actions.discard(note)}>
        {note.current_version > 1 ? "Cancel revision" : "Discard draft"}
      </Button>,
    );
  }
  if (note.revisable && actions.canSign) {
    controls.push(
      <Button key="revise" tone="tertiary" size="xs" onClick={() => actions.revise(note)}>
        Revise
      </Button>,
    );
  }
  if (note.is_mine && note.status === "signed" && !note.amends_note_id && actions.canWrite) {
    controls.push(
      <Button key="addendum" tone="tertiary" size="xs" onClick={() => actions.addendum(note)}>
        Add addendum
      </Button>,
    );
  }
  if (note.is_my_cosign && actions.canCosign) {
    controls.push(
      <Button key="cosign" tone="primary" size="xs" onClick={() => actions.countersign(note)}>
        Countersign
      </Button>,
      <Button key="return" tone="tertiary" size="xs" onClick={() => actions.returnToAuthor(note)}>
        Return to author
      </Button>,
    );
  }
  if (note.is_mine && note.status === "signed" && actions.canMarkInError) {
    controls.push(
      <Button key="error" tone="danger-ghost" size="xs" onClick={() => actions.markInError(note)}>
        Entered in error
      </Button>,
    );
  }

  return (
    <Card withBorder padding="sm" aria-label={`${title} by ${note.author_name}`}>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={700} size="sm" td={inError ? "line-through" : undefined}>
              {title}
            </Text>
            <AuthorLine note={note} />
          </Stack>
          <Group gap={6}>
            {note.late_entry_reason && (
              <MantineBadge size="xs" variant="outline" title={note.late_entry_reason}>
                Late entry
              </MantineBadge>
            )}
            <Badge size="xs" tone={status.tone}>
              {status.label}
            </Badge>
          </Group>
        </Group>
        {inError && (
          <Text size="xs" c="var(--mb-support-error)">
            Entered in error: {note.entered_in_error_reason}
          </Text>
        )}
        <CosignLine note={note} />
        {note.late_entry_reason && (
          <Text size="xs" c="dimmed">
            Late entry: {note.late_entry_reason}
          </Text>
        )}
        <Box td={inError ? "line-through" : undefined} opacity={inError ? 0.6 : 1}>
          {editing ? (
            <NoteDraftEditor
              initialSections={note.sections}
              liveSections={note.sections}
              onSave={(patches) => actions.saveDraft(note, patches)}
              onSign={actions.canSign ? () => actions.sign(note) : undefined}
            />
          ) : (
            <Sections note={note} />
          )}
        </Box>
        {controls.length > 0 && <Group gap="xs">{controls}</Group>}
        {addenda.length > 0 && (
          <Stack gap="xs" pl="md" style={{ borderLeft: "2px solid var(--mb-border-subtle)" }}>
            {addenda.map((a) => (
              <NoteCard key={a.id} note={a} addenda={[]} actions={actions} />
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
