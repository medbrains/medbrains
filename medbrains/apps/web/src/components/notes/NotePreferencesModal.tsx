import { Group, Loader, Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Checkbox, Modal, toast } from "@/components/ui";
import { notesService } from "@/services/notes.service";
import { toggleKind } from "./notes-logic";

const PREFERENCES_KEY = ["notes", "preferences"];

interface NotePreferencesModalProps {
  onClose: () => void;
}

/** Choose the kinds of notification that always land in my notes as they arrive. */
export function NotePreferencesModal({ onClose }: NotePreferencesModalProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () => notesService.preferences(),
  });
  const [kinds, setKinds] = useState<string[] | null>(null);
  const chosen = kinds ?? data?.kinds ?? [];
  const save = useMutation({
    mutationFn: () => notesService.setPreferences(chosen),
    onSuccess: (saved) => {
      queryClient.setQueryData(PREFERENCES_KEY, saved);
      toast.success("Saved");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save" }),
  });

  return (
    <Modal opened onClose={onClose} title="Notifications that become notes">
      {isLoading && <Loader m="md" />}
      {isError && (
        <Alert tone="danger" title="Could not load your choices">
          Nothing was changed. Try again in a moment.
        </Alert>
      )}
      {data && (
        <Stack>
          <Text size="sm" c="dimmed">
            These arrive in your notes as well as the bell. Notes about something that gets resolved
            — a critical value acknowledged, a request reviewed — clear themselves.
          </Text>
          {data.choices.map((c) => (
            <Checkbox
              key={c.key}
              label={c.label}
              checked={chosen.includes(c.key)}
              onChange={(e) => setKinds(toggleKind(chosen, c.key, e.currentTarget.checked))}
            />
          ))}
          <Group justify="flex-end">
            <Button tone="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button tone="primary" loading={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
