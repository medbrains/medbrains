import { zodResolver } from "@hookform/resolvers/zod";
import { Chip, Group, Stack, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { api } from "@medbrains/api";
import { previewQueueNumber, type QueueFormInput, queueFormSchema } from "@medbrains/schemas";
import type { QueueConfig, QueueInput } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import {
  Button,
  Drawer,
  Input,
  NumberField,
  SegmentedControl,
  Select,
  toast,
} from "@/components/ui";
import { VOICE_LANGUAGES } from "@/lib/board-voice";

interface QueueFormDrawerProps {
  opened: boolean;
  onClose: () => void;
  /** Editing this queue; null to create one. */
  queue: QueueConfig | null;
}

export const QUEUE_MODULES = [
  { value: "registration", label: "Registration" },
  { value: "opd", label: "OPD consultation" },
  { value: "lab", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "billing", label: "Billing" },
];

const toDate = (value: string | null) => (value ? new Date(`${value}T00:00:00`) : null);
const toIso = (value: Date | null) =>
  value
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
    : null;

function defaults(queue: QueueConfig | null): QueueFormInput {
  return {
    name: queue?.name ?? "",
    module: queue?.module ?? "opd",
    place: queue ? `${queue.scope}:${queue.scope_id ?? ""}` : "",
    prefix: queue?.prefix ?? "",
    start_at: queue?.start_at ?? 1,
    pad_width: queue?.pad_width ?? 3,
    reset_rule: queue?.reset_rule ?? "daily",
    max_tokens_per_period: queue?.max_tokens_per_period ?? null,
    lifecycle: queue?.lifecycle ?? "permanent",
    valid_from: toDate(queue?.valid_from ?? null),
    valid_until: toDate(queue?.valid_until ?? null),
    early_issue_minutes: queue?.early_issue_minutes ?? 60,
    board_shows: queue?.board_shows ?? "number",
    voice_languages: queue?.voice_languages ?? ["en"],
    announce_repeat: queue?.announce_repeat ?? 1,
  };
}

/** Create or edit a queue: what it serves, how it numbers, how many, and when. */
export function QueueFormDrawer({ opened, onClose, queue }: QueueFormDrawerProps) {
  const queryClient = useQueryClient();
  const places = useQuery({
    queryKey: ["queue-places"],
    queryFn: () => api.listQueuePlaces(),
    enabled: opened,
  });
  const form = useForm<QueueFormInput>({
    resolver: zodResolver(queueFormSchema),
    values: defaults(queue),
  });
  const { control, register, watch, handleSubmit, formState } = form;
  const [prefix, startAt, padWidth, lifecycle, resetRule] = watch([
    "prefix",
    "start_at",
    "pad_width",
    "lifecycle",
    "reset_rule",
  ]);

  const save = useMutation({
    mutationFn: (values: QueueFormInput) => {
      const [scope, scopeId] = values.place.split(":");
      const input: QueueInput = {
        name: values.name,
        module: values.module,
        scope: scope ?? "department",
        scope_id: scopeId || null,
        prefix: values.prefix.toUpperCase(),
        start_at: values.start_at,
        pad_width: values.pad_width,
        reset_rule: values.reset_rule,
        max_tokens_per_period: values.max_tokens_per_period,
        lifecycle: values.lifecycle,
        valid_from: values.lifecycle === "temporary" ? toIso(values.valid_from) : null,
        valid_until: values.lifecycle === "temporary" ? toIso(values.valid_until) : null,
        status: queue?.status ?? "active",
        early_issue_minutes: values.early_issue_minutes,
        board_shows: values.board_shows,
        voice_languages: values.voice_languages,
        announce_repeat: values.announce_repeat,
      };
      return queue ? api.updateQueue(queue.id, input) : api.createQueue(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queues"] });
      toast.success(queue ? "Queue saved" : "Queue created");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Queue not saved" }),
  });

  const errors = formState.errors;
  return (
    <Drawer opened={opened} onClose={onClose} title={queue ? "Edit queue" : "New queue"} size="md">
      <form onSubmit={handleSubmit((values) => save.mutate(values))}>
        <Stack gap="md">
          <Input
            label="Name"
            placeholder="e.g. General OPD"
            error={errors.name?.message}
            {...register("name")}
          />
          <Controller
            control={control}
            name="module"
            render={({ field }) => (
              <Select
                label="For"
                data={QUEUE_MODULES}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "opd")}
                disabled={Boolean(queue)}
              />
            )}
          />
          <Controller
            control={control}
            name="place"
            render={({ field }) => (
              <Select
                label="Place it serves"
                placeholder="Department, room, counter or station"
                searchable
                data={(places.data ?? []).map((p) => ({
                  value: `${p.scope}:${p.scope_id}`,
                  label: `${p.label} · ${p.scope}`,
                }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={
                  errors.place?.message ?? (places.isError ? "Could not load places" : undefined)
                }
                disabled={Boolean(queue)}
              />
            )}
          />
          <Group grow align="flex-start">
            <Input
              label="Prefix"
              placeholder="GEN"
              error={errors.prefix?.message}
              {...register("prefix")}
            />
            <Controller
              control={control}
              name="start_at"
              render={({ field }) => (
                <NumberField
                  label="First number"
                  min={0}
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v) || 0)}
                  error={errors.start_at?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="pad_width"
              render={({ field }) => (
                <NumberField
                  label="Digits"
                  min={1}
                  max={6}
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v) || 1)}
                />
              )}
            />
          </Group>
          <Text size="sm">
            First token:{" "}
            <strong data-testid="queue-number-preview">
              {previewQueueNumber(prefix, startAt, padWidth)}
            </strong>
          </Text>
          <Controller
            control={control}
            name="reset_rule"
            render={({ field }) => (
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Numbering restarts
                </Text>
                <SegmentedControl
                  aria-label="Numbering restarts"
                  value={field.value}
                  onChange={field.onChange}
                  data={[
                    { value: "daily", label: "Every day" },
                    { value: "session", label: "Every session" },
                    { value: "never", label: "Never" },
                  ]}
                />
                {field.value === "session" && (
                  <Text size="xs" c="dimmed">
                    Each session needs its own prefix, like M and E — set them under Hours.
                  </Text>
                )}
              </Stack>
            )}
          />
          <Controller
            control={control}
            name="max_tokens_per_period"
            render={({ field }) => (
              <NumberField
                label={resetRule === "session" ? "Most tokens a session" : "Most tokens a day"}
                description="Leave empty for no limit"
                min={1}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                error={errors.max_tokens_per_period?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="lifecycle"
            render={({ field }) => (
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Runs
                </Text>
                <SegmentedControl
                  aria-label="Runs"
                  value={field.value}
                  onChange={field.onChange}
                  data={[
                    { value: "permanent", label: "Every day" },
                    { value: "temporary", label: "Only on certain days" },
                  ]}
                />
              </Stack>
            )}
          />
          <Controller
            control={control}
            name="early_issue_minutes"
            render={({ field }) => (
              <NumberField
                label="Start giving tokens before a session opens"
                description="Minutes. Patients who line up early are served in the order they came."
                min={0}
                max={240}
                step={15}
                value={field.value}
                onChange={(v) => field.onChange(Number(v) || 0)}
                error={errors.early_issue_minutes?.message}
                data-testid="field-early_issue_minutes"
              />
            )}
          />
          <Controller
            control={control}
            name="board_shows"
            render={({ field }) => (
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  The waiting-room board shows
                </Text>
                <SegmentedControl
                  aria-label="The waiting-room board shows"
                  value={field.value}
                  onChange={field.onChange}
                  data={[
                    { value: "number", label: "Number only" },
                    { value: "initials", label: "Number and initials" },
                  ]}
                />
                <Text size="xs" c="dimmed">
                  A board is public: the full name is never shown.
                </Text>
              </Stack>
            )}
          />
          <Controller
            control={control}
            name="voice_languages"
            render={({ field }) => (
              <Stack gap={4}>
                <Text size="sm" fw={500} id="queue-voice-languages">
                  Calls are spoken in
                </Text>
                <Chip.Group multiple value={field.value} onChange={field.onChange}>
                  <Group gap="xs" role="group" aria-labelledby="queue-voice-languages">
                    {VOICE_LANGUAGES.map((language) => (
                      <Chip
                        key={language.value}
                        value={language.value}
                        data-testid={`chip-voice-${language.value}`}
                      >
                        {language.label}
                      </Chip>
                    ))}
                  </Group>
                </Chip.Group>
                {errors.voice_languages && (
                  <Text size="xs" c="var(--mb-danger-text)">
                    {errors.voice_languages.message}
                  </Text>
                )}
              </Stack>
            )}
          />
          <Controller
            control={control}
            name="announce_repeat"
            render={({ field }) => (
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Say each call
                </Text>
                <SegmentedControl
                  aria-label="Say each call"
                  value={String(field.value)}
                  onChange={(value) => field.onChange(Number(value))}
                  data={[
                    { value: "1", label: "Once" },
                    { value: "2", label: "Twice" },
                    { value: "3", label: "Three times" },
                  ]}
                />
              </Stack>
            )}
          />
          {lifecycle === "temporary" && (
            <Group grow align="flex-start">
              <Controller
                control={control}
                name="valid_from"
                render={({ field }) => (
                  <DatePickerInput
                    label="First day"
                    value={field.value}
                    onChange={(v) => field.onChange(v ? new Date(v) : null)}
                  />
                )}
              />
              <Controller
                control={control}
                name="valid_until"
                render={({ field }) => (
                  <DatePickerInput
                    label="Last day"
                    value={field.value}
                    onChange={(v) => field.onChange(v ? new Date(v) : null)}
                    error={errors.valid_until?.message}
                  />
                )}
              />
            </Group>
          )}
          <Group justify="flex-end">
            <Button tone="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={save.isPending}>
              {queue ? "Save" : "Create queue"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
