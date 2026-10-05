import { Group, Loader, Menu, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useHasPermission, usePermissionStore } from "@medbrains/stores";
import { type Note, type NoteType, P } from "@medbrains/types";
import { IconChevronDown, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Button, toast } from "@/components/ui";
import { clinicalNotesService } from "@/services/clinicalNotes.service";
import { type NoteActions, NoteCard } from "./NoteCard";

/** A question the sheet must ask before acting: why it is late, or in error. */
type Ask = { kind: "late"; note: Note } | { kind: "error"; note: Note } | null;

const notesKey = (encounterId: string) => ["clinical-notes", encounterId] as const;

/** Nurses write nursing notes; everyone else who writes notes, the rest. */
function writableTypes(types: NoteType[], role: string | null): NoteType[] {
  const nurse = role === "nurse";
  return types.filter((t) => (t.category === "nursing") === nurse);
}

/**
 * The visit's case sheet: every clinician's entries in the order care
 * happened, each with its author, time and signature, addenda beneath the
 * note they add to — the paper sheet, kept by the server.
 */
export function CaseSheet({ encounterId }: { encounterId: string }) {
  const canView = useHasPermission(P.CLINICAL_NOTES.VIEW);
  const canWrite = useHasPermission(P.CLINICAL_NOTES.WRITE);
  const canSign = useHasPermission(P.CLINICAL_NOTES.SIGN);
  const canMarkInError = useHasPermission(P.CLINICAL_NOTES.MARK_IN_ERROR);
  const role = usePermissionStore((s) => s.userRole);
  const queryClient = useQueryClient();
  const [ask, setAsk] = useState<Ask>(null);
  const [reason, setReason] = useState("");
  const [pendingSign, setPendingSign] = useState<Note | null>(null);

  const notes = useQuery({
    queryKey: notesKey(encounterId),
    queryFn: () => clinicalNotesService.listEncounterNotes(encounterId),
    enabled: canView,
  });
  const types = useQuery({
    queryKey: ["note-types"],
    queryFn: () => clinicalNotesService.listNoteTypes(),
    enabled: canWrite,
    staleTime: 300_000,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: notesKey(encounterId) });
  const step = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => {
      refresh();
      setAsk(null);
      setReason("");
    },
    onError: (error: Error) => {
      // A late entry is refused until it says why; ask, then sign again.
      if (/late entry/i.test(error.message) && ask === null && pendingSign) {
        setAsk({ kind: "late", note: pendingSign });
        return;
      }
      toast.error(error.message, { title: "Note not updated" });
    },
  });
  const actions: NoteActions = {
    canSign,
    canWrite,
    canMarkInError,
    saveDraft: async (note, patches) => {
      const saved = await clinicalNotesService.saveNoteDraft(note.id, patches);
      queryClient.setQueryData<Note[]>(notesKey(encounterId), (old) =>
        old?.map((n) => (n.id === saved.id ? saved : n)),
      );
    },
    sign: async (note) => {
      setPendingSign(note);
      await step.mutateAsync(() => clinicalNotesService.signNote(note.id)).catch(() => undefined);
    },
    revise: (note) => step.mutate(() => clinicalNotesService.reviseNote(note.id)),
    discard: (note) => step.mutate(() => clinicalNotesService.discardNote(note.id)),
    addendum: (note) =>
      step.mutate(() =>
        clinicalNotesService.createNote(encounterId, {
          note_type_code: note.note_type_code,
          amends_note_id: note.id,
        }),
      ),
    markInError: (note) => setAsk({ kind: "error", note }),
  };

  const { top, addendaOf } = useMemo(() => {
    const all = notes.data ?? [];
    const byParent = new Map<string, Note[]>();
    for (const n of all) {
      if (!n.amends_note_id) continue;
      byParent.set(n.amends_note_id, [...(byParent.get(n.amends_note_id) ?? []), n]);
    }
    return { top: all.filter((n) => !n.amends_note_id), addendaOf: byParent };
  }, [notes.data]);

  if (!canView) return null;
  if (notes.isLoading) return <Loader size="sm" />;
  // An unanswered sheet is not an empty one.
  if (notes.isError) {
    return (
      <Alert tone="danger" title="The case sheet could not be loaded">
        <Text size="sm">Reload the page; if it keeps failing, tell IT.</Text>
      </Alert>
    );
  }

  const choices = writableTypes(types.data ?? [], role);
  const submitAsk = () => {
    if (!ask) return;
    const note = ask.note;
    step.mutate(() =>
      ask.kind === "late"
        ? clinicalNotesService.signNote(note.id, reason)
        : clinicalNotesService.markNoteInError(note.id, reason),
    );
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={700}>Case sheet</Text>
        {canWrite && choices.length > 0 && (
          <Menu position="bottom-end">
            <Menu.Target>
              <Button
                tone="primary"
                size="xs"
                leftSection={<IconPlus size={16} />}
                rightSection={<IconChevronDown size={16} />}
              >
                New note
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {choices.map((t) => (
                <Menu.Item
                  key={t.code}
                  onClick={() =>
                    step.mutate(() =>
                      clinicalNotesService.createNote(encounterId, { note_type_code: t.code }),
                    )
                  }
                >
                  {t.name}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
      {top.length === 0 && (
        <Text size="sm" c="dimmed">
          No notes on this visit yet.
        </Text>
      )}
      {top.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          addenda={addendaOf.get(note.id) ?? []}
          actions={actions}
        />
      ))}

      <Modal
        opened={ask !== null}
        onClose={() => setAsk(null)}
        title={ask?.kind === "late" ? "Late entry" : "Mark entered in error"}
      >
        <Stack gap="sm">
          <Text size="sm">
            {ask?.kind === "late"
              ? "This note is signed well after the care it records. Say why it is written now."
              : "The note stays on the case sheet, struck through. Say why it is in error."}
          </Text>
          <Textarea
            label={ask?.kind === "late" ? "Why it is written now" : "Why it is in error"}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            autosize
            minRows={2}
            required
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={() => setAsk(null)}>
              Cancel
            </Button>
            <Button
              tone={ask?.kind === "late" ? "primary" : "danger"}
              disabled={!reason.trim()}
              loading={step.isPending}
              onClick={submitAsk}
            >
              {ask?.kind === "late" ? "Sign" : "Mark in error"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
