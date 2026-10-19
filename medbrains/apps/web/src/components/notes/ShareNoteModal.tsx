import { Stack, Text } from "@mantine/core";
import type { NoteRecipient, StickyNote } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useDebounce } from "react-use";
import { Modal, MultiSelect } from "@/components/ui";
import { notesService } from "@/services/notes.service";

interface ShareNoteModalProps {
  note: StickyNote;
  saving: boolean;
  onSave: (departmentIds: string[], userIds: string[]) => void;
  onClose: () => void;
}

/** Merge search results with what is already chosen, so chosen chips keep their names. */
function options(found: NoteRecipient[] | undefined, chosen: { id: string; label: string }[]) {
  const byId = new Map(chosen.map((c) => [c.id, c.label]));
  for (const r of found ?? []) byId.set(r.id, r.name);
  return [...byId].map(([value, label]) => ({ value, label }));
}

/** Choose the department boards and colleagues a note is shared with. */
export function ShareNoteModal({ note, saving, onSave, onClose }: ShareNoteModalProps) {
  const current = note.shares;
  const [departmentIds, setDepartmentIds] = useState(
    current.flatMap((s) => (s.department_id ? [s.department_id] : [])),
  );
  const [userIds, setUserIds] = useState(current.flatMap((s) => (s.user_id ? [s.user_id] : [])));
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useDebounce(() => setQuery(search), 250, [search]);

  const { data, isError } = useQuery({
    queryKey: ["notes", "recipients", query],
    queryFn: () => notesService.recipients(query),
  });
  const chosen = useMemo(
    () => current.map((s) => ({ id: s.department_id ?? s.user_id ?? s.id, label: s.label })),
    [current],
  );

  return (
    <Modal
      opened
      onClose={onClose}
      title="Share note"
      primaryAction={{
        label: "Save sharing",
        onClick: () => onSave(departmentIds, userIds),
        loading: saving,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          The note stays yours: you can edit it or take it back at any time. People you share it
          with can read it.
        </Text>
        <MultiSelect
          label="Department boards"
          placeholder="Search departments"
          searchable
          onSearchChange={setSearch}
          data={options(data?.departments, chosen)}
          value={departmentIds}
          onChange={setDepartmentIds}
          error={isError ? "Could not load departments — try again" : undefined}
        />
        <MultiSelect
          label="Colleagues"
          placeholder="Search by name"
          searchable
          onSearchChange={setSearch}
          data={options(data?.users, chosen)}
          value={userIds}
          onChange={setUserIds}
          error={isError ? "Could not load colleagues — try again" : undefined}
        />
      </Stack>
    </Modal>
  );
}
