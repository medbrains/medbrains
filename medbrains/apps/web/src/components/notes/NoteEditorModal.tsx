import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { MAX_NOTE_CHARS, NOTE_COLOURS, type StickyNote } from "@medbrains/types";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Modal, SegmentedControl, Select, Switch, TextArea } from "@/components/ui";

const CLEAR_OPTIONS = [
  { value: "never", label: "Keep until I remove it" },
  { value: "8h", label: "In 8 hours" },
  { value: "today", label: "At the end of today" },
  { value: "date", label: "On a date I pick" },
] as const;

const schema = z
  .object({
    body: z.string().trim().min(1, "Write something first").max(MAX_NOTE_CHARS),
    colour: z.enum(NOTE_COLOURS),
    pinned: z.boolean(),
    clear: z.enum(["never", "8h", "today", "date"]),
    clearAt: z.date().nullable(),
  })
  .refine((v) => v.clear !== "date" || (v.clearAt && v.clearAt > new Date()), {
    path: ["clearAt"],
    message: "Pick a time in the future",
  });
type FormValues = z.infer<typeof schema>;

export interface NoteDraft {
  body: string;
  colour: FormValues["colour"];
  pinned: boolean;
  expires_at: string | null;
}

function expiresAt(v: FormValues): string | null {
  if (v.clear === "8h") return new Date(Date.now() + 8 * 3_600_000).toISOString();
  if (v.clear === "today") {
    const end = new Date();
    end.setHours(23, 59, 0, 0);
    return end.toISOString();
  }
  return v.clear === "date" && v.clearAt ? v.clearAt.toISOString() : null;
}

interface NoteEditorModalProps {
  /** The note being edited; absent for a new note. */
  note?: StickyNote;
  saving: boolean;
  onSave: (draft: NoteDraft) => void;
  onClose: () => void;
}

/** Write or edit a note: text, colour, pin, and when it clears itself. */
export function NoteEditorModal({ note, saving, onSave, onClose }: NoteEditorModalProps) {
  const { control, handleSubmit, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      body: note?.body ?? "",
      colour: note?.colour ?? "yellow",
      pinned: note?.pinned ?? false,
      clear: note?.expires_at ? "date" : "never",
      clearAt: note?.expires_at ? new Date(note.expires_at) : null,
    },
  });
  const submit = handleSubmit((v) =>
    onSave({ body: v.body.trim(), colour: v.colour, pinned: v.pinned, expires_at: expiresAt(v) }),
  );

  return (
    <Modal
      opened
      onClose={onClose}
      title={note ? "Edit note" : "New note"}
      primaryAction={{ label: "Save note", onClick: () => void submit(), loading: saving }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack>
        <Controller
          control={control}
          name="body"
          render={({ field }) => (
            <TextArea
              {...field}
              label="Note"
              description="For the team's logistics. Patient details belong in the patient's chart."
              autosize
              minRows={3}
              maxLength={MAX_NOTE_CHARS}
              error={formState.errors.body?.message}
              data-autofocus
            />
          )}
        />
        <Controller
          control={control}
          name="colour"
          render={({ field }) => (
            <Stack gap={4}>
              <Text size="sm" fw={500} id="note-colour">
                Colour
              </Text>
              <SegmentedControl
                aria-labelledby="note-colour"
                value={field.value}
                onChange={field.onChange}
                data={NOTE_COLOURS.map((c) => ({
                  value: c,
                  label: c[0]?.toUpperCase() + c.slice(1),
                }))}
              />
            </Stack>
          )}
        />
        <Controller
          control={control}
          name="pinned"
          render={({ field }) => (
            <Switch
              label="Pin to the top"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="clear"
          render={({ field }) => (
            <Select
              label="Clears itself"
              data={[...CLEAR_OPTIONS]}
              value={field.value}
              onChange={(v) => v && field.onChange(v)}
              allowDeselect={false}
            />
          )}
        />
        {watch("clear") === "date" && (
          <Controller
            control={control}
            name="clearAt"
            render={({ field }) => (
              <DateTimePicker
                label="Clear on"
                value={field.value}
                onChange={(v) => field.onChange(v ? new Date(v) : null)}
                minDate={new Date()}
                error={formState.errors.clearAt?.message}
              />
            )}
          />
        )}
      </Stack>
    </Modal>
  );
}
