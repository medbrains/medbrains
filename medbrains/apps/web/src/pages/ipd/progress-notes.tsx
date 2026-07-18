// IPD ProgressNotesTab — split from ipd.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Select, Stack, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { IpdProgressNoteFormInput } from "@medbrains/schemas";
import { ipdProgressNoteFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { IpdProgressNote } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Badge, Button } from "@/components/ui";
import {
  DEFAULT_IPD_PROGRESS_NOTE_VALUES,
  progressNoteTypeOptions,
  toCreateProgressNoteRequest,
} from "@/forms/ipd.form";
import { ipdService } from "@/services/ipd.service";

export function ProgressNotesTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.PROGRESS_NOTES_CREATE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IpdProgressNoteFormInput>({
    resolver: zodResolver(ipdProgressNoteFormSchema),
    defaultValues: DEFAULT_IPD_PROGRESS_NOTE_VALUES,
    mode: "onTouched",
  });

  const { data: notes = [] } = useQuery<IpdProgressNote[]>({
    queryKey: ["ipd-progress-notes", admissionId],
    queryFn: () => ipdService.listProgressNotes(admissionId),
  });

  const mutation = useMutation({
    mutationFn: (values: IpdProgressNoteFormInput) =>
      ipdService.createProgressNote(admissionId, toCreateProgressNoteRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-progress-notes", admissionId] });
      formHandlers.close();
      reset(DEFAULT_IPD_PROGRESS_NOTE_VALUES);
    },
  });

  const handleCreate = handleSubmit((values) => mutation.mutate(values));
  const closeForm = () => {
    formHandlers.close();
    reset(DEFAULT_IPD_PROGRESS_NOTE_VALUES);
  };

  return (
    <Stack>
      {canCreate && (
        <Button
          tone="primary"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={formHandlers.toggle}
        >
          Add Note
        </Button>
      )}
      {formOpened && (
        <Stack component="form" gap="xs" onSubmit={handleCreate}>
          <Controller
            control={control}
            name="note_type"
            render={({ field }) => (
              <Select
                label="Note Type"
                data={progressNoteTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "doctor_round")}
                error={errors.note_type?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="subjective"
            render={({ field }) => <Textarea label="Subjective" {...field} />}
          />
          <Controller
            control={control}
            name="objective"
            render={({ field }) => <Textarea label="Objective" {...field} />}
          />
          <Controller
            control={control}
            name="assessment"
            render={({ field }) => <Textarea label="Assessment" {...field} />}
          />
          <Controller
            control={control}
            name="plan"
            render={({ field }) => <Textarea label="Plan" {...field} />}
          />
          <Group>
            <Button tone="primary" size="xs" type="submit" loading={mutation.isPending}>
              Save
            </Button>
            <Button tone="ghost" size="xs" onClick={closeForm}>
              Cancel
            </Button>
          </Group>
        </Stack>
      )}
      {(() => {
        const groups = new Map<string, IpdProgressNote[]>();
        for (const n of notes) {
          const key = n.note_date ?? n.created_at.slice(0, 10);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)?.push(n);
        }
        const sortedDates = [...groups.keys()].sort((a, b) => b.localeCompare(a));
        return sortedDates.map((date) => {
          const dayNotes =
            groups.get(date)?.sort((a, b) => b.created_at.localeCompare(a.created_at)) ?? [];
          const dateLabel = new Date(date).toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          return (
            <Stack key={date} gap="xs">
              <Group gap="xs" align="baseline">
                <Text fw={700} size="sm" c="dark.7">
                  {dateLabel}
                </Text>
                <Text size="xs" c="dimmed" ff="monospace">
                  {dayNotes.length} {dayNotes.length === 1 ? "entry" : "entries"}
                </Text>
              </Group>
              {dayNotes.map((n) => (
                <Stack
                  key={n.id}
                  gap={4}
                  p="xs"
                  style={{
                    borderLeft: "3px solid var(--fc-brand, #5B4BC4)",
                    background: "var(--fc-panel, #f7f8f6)",
                    borderRadius: 0,
                  }}
                >
                  <Group justify="space-between" gap="xs">
                    <Group gap="xs">
                      <Badge size="xs">{n.note_type}</Badge>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {new Date(n.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </Group>
                    {n.is_addendum && (
                      <Badge size="xs" tone="warning">
                        addendum
                      </Badge>
                    )}
                  </Group>
                  {n.subjective && (
                    <Text size="sm">
                      <b>S:</b> {n.subjective}
                    </Text>
                  )}
                  {n.objective && (
                    <Text size="sm">
                      <b>O:</b> {n.objective}
                    </Text>
                  )}
                  {n.assessment && (
                    <Text size="sm">
                      <b>A:</b> {n.assessment}
                    </Text>
                  )}
                  {n.plan && (
                    <Text size="sm">
                      <b>P:</b> {n.plan}
                    </Text>
                  )}
                </Stack>
              ))}
            </Stack>
          );
        });
      })()}
      {notes.length === 0 && (
        <Text c="dimmed" size="sm">
          No progress notes yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Clinical Assessments ───────────────────────────────
