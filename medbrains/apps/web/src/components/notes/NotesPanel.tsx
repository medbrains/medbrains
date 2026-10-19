import { Loader, ScrollArea, Stack, Tabs, Text } from "@mantine/core";
import { useAuthStore } from "@medbrains/stores";
import type { StickyNote, StickyNotesView } from "@medbrains/types";
import { IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, IconButton, toast } from "@/components/ui";
import { notesService } from "@/services/notes.service";
import { MyNotes } from "./MyNotes";
import { NoteCard } from "./NoteCard";
import { type NoteDraft, NoteEditorModal } from "./NoteEditorModal";
import { NotePreferencesModal } from "./NotePreferencesModal";
import { filterMine } from "./notes-logic";
import { ShareNoteModal } from "./ShareNoteModal";

export const NOTES_KEY = ["notes"];

type Dialog =
  | { kind: "edit"; note?: StickyNote }
  | { kind: "share"; note: StickyNote }
  | { kind: "settings" }
  | null;

function useNoteMutations(onDone: () => void) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: NOTES_KEY });
    onDone();
  };
  const fail = (title: string) => (e: Error) => toast.error(e.message, { title });
  return {
    save: useMutation({
      mutationFn: ({ id, draft }: { id?: string; draft: NoteDraft }) =>
        id ? notesService.update(id, draft) : notesService.create(draft),
      onSuccess: refresh,
      onError: fail("Could not save the note"),
    }),
    share: useMutation({
      mutationFn: (v: { id: string; department_ids: string[]; user_ids: string[] }) =>
        notesService.setShares(v.id, v),
      onSuccess: refresh,
      onError: fail("Could not share the note"),
    }),
    remove: useMutation({
      mutationFn: (id: string) => notesService.remove(id),
      onSuccess: refresh,
      onError: fail("Could not remove the note"),
    }),
    autoResolve: useMutation({
      mutationFn: ({ id, on }: { id: string; on: boolean }) => notesService.setAutoResolve(id, on),
      onSuccess: refresh,
      onError: fail("Could not change auto-resolve"),
    }),
    unshare: useMutation({
      mutationFn: (shareId: string) => notesService.removeShare(shareId),
      onSuccess: refresh,
      onError: fail("Could not take the note off"),
    }),
  };
}

function Empty({ children }: { children: string }) {
  return (
    <Text size="sm" c="dimmed" ta="center" py="xl">
      {children}
    </Text>
  );
}

/** The notes drawer's content: my notes, notes handed to me, my departments' boards. */
export function NotesPanel() {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const m = useNoteMutations(close);
  const { data, isLoading, isError } = useQuery({
    queryKey: NOTES_KEY,
    queryFn: () => notesService.list(),
  });

  if (isLoading) return <Loader m="xl" />;
  // A failed load must not read as "no notes".
  if (isError || !data) {
    return (
      <Alert tone="danger" title="Could not load notes">
        Your notes are safe — they just could not be fetched. Try again in a moment.
      </Alert>
    );
  }
  return (
    <>
      <NotesTabs view={data} onDialog={setDialog} m={m} />
      {dialog?.kind === "edit" && (
        <NoteEditorModal
          note={dialog.note}
          saving={m.save.isPending}
          onSave={(draft) => m.save.mutate({ id: dialog.note?.id, draft })}
          onClose={close}
        />
      )}
      {dialog?.kind === "share" && (
        <ShareNoteModal
          note={dialog.note}
          saving={m.share.isPending}
          onSave={(department_ids, user_ids) =>
            m.share.mutate({ id: dialog.note.id, department_ids, user_ids })
          }
          onClose={close}
        />
      )}
      {dialog?.kind === "settings" && <NotePreferencesModal onClose={close} />}
    </>
  );
}

interface NotesTabsProps {
  view: StickyNotesView;
  onDialog: (d: Dialog) => void;
  m: ReturnType<typeof useNoteMutations>;
}

function NotesTabs({ view, onDialog, m }: NotesTabsProps) {
  const me = useAuthStore((s) => s.user?.id);
  const activeMine = filterMine(view.mine, "active").length;
  const takeOff = (note: StickyNote, label: string) =>
    note.share_id ? (
      <IconButton
        aria-label={label}
        onClick={() => note.share_id && m.unshare.mutate(note.share_id)}
      >
        <IconX size={16} />
      </IconButton>
    ) : null;

  return (
    <Tabs defaultValue="mine" keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="mine">Mine ({activeMine})</Tabs.Tab>
        <Tabs.Tab value="shared">Shared with me ({view.shared_with_me.length})</Tabs.Tab>
        {view.boards.map((b) => (
          <Tabs.Tab key={b.department_id} value={b.department_id}>
            {b.department_name} ({b.notes.length})
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <ScrollArea.Autosize mah="calc(100dvh - 180px)" mt="md">
        <Tabs.Panel value="mine">
          <MyNotes
            notes={view.mine}
            handlers={{
              onNew: () => onDialog({ kind: "edit" }),
              onSettings: () => onDialog({ kind: "settings" }),
              onEdit: (note) => onDialog({ kind: "edit", note }),
              onShare: (note) => onDialog({ kind: "share", note }),
              onRemove: (id) => m.remove.mutate(id),
              onAutoResolve: (id, on) => m.autoResolve.mutate({ id, on }),
            }}
          />
        </Tabs.Panel>
        <Tabs.Panel value="shared">
          <Stack>
            {view.shared_with_me.length === 0 && <Empty>Nobody has shared a note with you.</Empty>}
            {view.shared_with_me.map((note) => (
              <NoteCard
                key={note.share_id ?? note.id}
                note={note}
                actions={takeOff(note, "Dismiss note")}
              />
            ))}
          </Stack>
        </Tabs.Panel>
        {view.boards.map((b) => (
          <Tabs.Panel key={b.department_id} value={b.department_id}>
            <Stack>
              {b.notes.length === 0 && (
                <Empty>{`Nothing on the ${b.department_name} board.`}</Empty>
              )}
              {b.notes.map((note) => (
                <NoteCard
                  key={note.share_id ?? note.id}
                  note={note}
                  actions={
                    view.can_moderate || note.author_id === me
                      ? takeOff(note, `Take off the ${b.department_name} board`)
                      : null
                  }
                />
              ))}
            </Stack>
          </Tabs.Panel>
        ))}
      </ScrollArea.Autosize>
    </Tabs>
  );
}
