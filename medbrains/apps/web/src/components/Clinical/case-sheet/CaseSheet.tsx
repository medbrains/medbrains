import { Group, Loader, Menu, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type Note, P } from "@medbrains/types";
import { IconChevronDown, IconFileExport, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DocumentActions } from "@/components/DocumentActions";
import { Alert, Button, toast } from "@/components/ui";
import { clinicalNotesService } from "@/services/clinicalNotes.service";
import { downloadBlob } from "@/utils/download";
import { type NoteActions, NoteCard } from "./NoteCard";

/** A question the sheet must ask before acting: why it is late, or in error. */
type Ask = { kind: "late" | "error" | "return"; note: Note } | null;

const ASK_COPY = {
  late: {
    title: "Late entry",
    prompt: "This note is signed well after the care it records. Say why it is written now.",
    label: "Why it is written now",
    action: "Sign",
  },
  error: {
    title: "Mark entered in error",
    prompt: "The note stays on the case sheet, struck through. Say why it is in error.",
    label: "Why it is in error",
    action: "Mark in error",
  },
  return: {
    title: "Return to author",
    prompt: "The note goes back to its author as a draft to correct and sign again.",
    label: "What needs correcting",
    action: "Return",
  },
} as const;

const notesKey = (encounterId: string) => ["clinical-notes", encounterId] as const;

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
  const canCosign = useHasPermission(P.CLINICAL_NOTES.COSIGN);
  const canPrint = useHasPermission(P.CLINICAL_NOTES.PRINT);
  const canExport = useHasPermission(P.CLINICAL_NOTES.EXPORT);
  const queryClient = useQueryClient();
  const [ask, setAsk] = useState<Ask>(null);
  const [reason, setReason] = useState("");
  const [pendingSign, setPendingSign] = useState<Note | null>(null);

  const notes = useQuery({
    queryKey: notesKey(encounterId),
    queryFn: () => clinicalNotesService.listEncounterNotes(encounterId),
    enabled: canView,
  });
  // The types this caller may start on this visit — their role, its kind.
  const types = useQuery({
    queryKey: ["note-types", encounterId],
    queryFn: () => clinicalNotesService.listNoteTypes(encounterId),
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
  // The signed notes as FHIR Compositions, for another hospital or ABDM.
  const fhirExport = useMutation({
    mutationFn: () => clinicalNotesService.exportVisitFhir(encounterId),
    onSuccess: (bundle) =>
      downloadBlob(
        new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json" }),
        `case-sheet-${encounterId}.fhir.json`,
      ),
    onError: (error: Error) => toast.error(error.message, { title: "FHIR export failed" }),
  });
  const actions: NoteActions = {
    canSign,
    canWrite,
    canMarkInError,
    canCosign,
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
    countersign: (note) => step.mutate(() => clinicalNotesService.countersignNote(note.id)),
    returnToAuthor: (note) => setAsk({ kind: "return", note }),
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

  const choices = types.data ?? [];
  const submitAsk = () => {
    if (!ask) return;
    const note = ask.note;
    const run = {
      late: () => clinicalNotesService.signNote(note.id, reason),
      error: () => clinicalNotesService.markNoteInError(note.id, reason),
      return: () => clinicalNotesService.returnNote(note.id, reason),
    }[ask.kind];
    step.mutate(run);
  };
  const copy = ASK_COPY[ask?.kind ?? "late"];

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={700}>Case sheet</Text>
        <Group gap="xs">
          {/* The print is filed to the visit's medical record as it is made. */}
          {canPrint && top.length > 0 && (
            <DocumentActions templateCode="clinical_notes" sourceId={encounterId} />
          )}
          {canExport && top.length > 0 && (
            <Button
              tone="ghost"
              size="xs"
              leftSection={<IconFileExport size={16} />}
              loading={fhirExport.isPending}
              onClick={() => fhirExport.mutate()}
            >
              FHIR
            </Button>
          )}
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

      <Modal opened={ask !== null} onClose={() => setAsk(null)} title={copy.title}>
        <Stack gap="sm">
          <Text size="sm">{copy.prompt}</Text>
          <Textarea
            label={copy.label}
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
              tone={ask?.kind === "error" ? "danger" : "primary"}
              disabled={!reason.trim()}
              loading={step.isPending}
              onClick={submitAsk}
            >
              {copy.action}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
