import { Chip, Group, Stack, Text } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { api } from "@medbrains/api";
import type { QueueRow, QueueSession } from "@medbrains/types";
import { IconClock, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Alert, Button, Card, Drawer, IconButton, Input, toast } from "@/components/ui";

interface QueueHoursDrawerProps {
  queue: QueueRow | null;
  onClose: () => void;
}

interface HoursForm {
  sessions: QueueSession[];
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** The server keeps seconds; the time picker shows hours and minutes. */
const toMinutes = (time: string) => time.slice(0, 5);
const toServer = (time: string) => (time.length === 5 ? `${time}:00` : time);

const NEW_SESSION: QueueSession = {
  label: "",
  days: [],
  opens: "09:00",
  closes: "13:00",
  prefix: null,
};

/**
 * When a queue gives out tokens. Sessions govern issuing only: a doctor
 * finishing the morning list after it closes is normal, and nobody waiting is
 * touched.
 */
export function QueueHoursDrawer({ queue, onClose }: QueueHoursDrawerProps) {
  const queryClient = useQueryClient();
  const hours = useQuery({
    queryKey: ["queue-hours", queue?.id],
    queryFn: () => api.listQueueSessions(queue?.id ?? ""),
    enabled: Boolean(queue),
  });
  const { control, register, handleSubmit } = useForm<HoursForm>({
    values: {
      sessions: (hours.data ?? []).map((s) => ({
        ...s,
        opens: toMinutes(s.opens),
        closes: toMinutes(s.closes),
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "sessions" });
  const perSession = queue?.reset_rule === "session";

  const save = useMutation({
    mutationFn: (values: HoursForm) =>
      api.replaceQueueSessions(
        queue?.id ?? "",
        values.sessions.map((s) => ({
          ...s,
          opens: toServer(s.opens),
          closes: toServer(s.closes),
          prefix: s.prefix?.trim().toUpperCase() || null,
        })),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-hours", queue?.id] });
      void queryClient.invalidateQueries({ queryKey: ["queues"] });
      toast.success("Hours saved");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Hours not saved" }),
  });

  return (
    <Drawer
      opened={Boolean(queue)}
      onClose={onClose}
      title={`Hours — ${queue?.name ?? ""}`}
      size="lg"
    >
      <form onSubmit={handleSubmit((values) => save.mutate(values))}>
        <Stack gap="md">
          <Text size="sm">
            Tokens are given out during these hours
            {queue?.early_issue_minutes
              ? `, and from ${queue.early_issue_minutes} minutes before each opens`
              : ""}
            . Patients already waiting are always seen.
          </Text>
          {hours.isError && <Alert tone="danger">Could not load this queue's hours.</Alert>}
          {hours.isSuccess && fields.length === 0 && (
            <Text size="sm" c="dimmed">
              No hours set — this queue gives out tokens all day.
            </Text>
          )}
          {fields.map((field, index) => (
            <Card key={field.id} data-testid={`row-session-${index}`}>
              <Stack gap="sm">
                <Group align="flex-end" wrap="nowrap" gap="xs">
                  <Input
                    label="Session"
                    placeholder="Morning"
                    {...register(`sessions.${index}.label`)}
                    style={{ flex: 2 }}
                    data-testid={`field-session-label-${index}`}
                  />
                  <Controller
                    control={control}
                    name={`sessions.${index}.opens`}
                    render={({ field: opens }) => (
                      <TimeInput
                        label="Opens"
                        value={opens.value}
                        onChange={(event) => opens.onChange(event.currentTarget.value)}
                        leftSection={<IconClock size={16} aria-hidden />}
                        data-testid={`field-session-opens-${index}`}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`sessions.${index}.closes`}
                    render={({ field: closes }) => (
                      <TimeInput
                        label="Closes"
                        value={closes.value}
                        onChange={(event) => closes.onChange(event.currentTarget.value)}
                        leftSection={<IconClock size={16} aria-hidden />}
                        data-testid={`field-session-closes-${index}`}
                      />
                    )}
                  />
                  <Input
                    label="Prefix"
                    placeholder={perSession ? "M" : queue?.prefix}
                    {...register(`sessions.${index}.prefix`)}
                    style={{ flex: 1 }}
                    data-testid={`field-session-prefix-${index}`}
                  />
                  <IconButton
                    aria-label={`Remove session ${index + 1}`}
                    tone="danger"
                    onClick={() => remove(index)}
                  >
                    <IconTrash size={16} />
                  </IconButton>
                </Group>
                <Controller
                  control={control}
                  name={`sessions.${index}.days`}
                  render={({ field: days }) => (
                    <Stack gap={4}>
                      <Text size="xs" c="dimmed" id={`session-days-${index}`}>
                        Days — none chosen means every day
                      </Text>
                      <Chip.Group
                        multiple
                        value={days.value.map(String)}
                        onChange={(value) => days.onChange(value.map(Number).sort())}
                      >
                        <Group gap={6} role="group" aria-labelledby={`session-days-${index}`}>
                          {WEEKDAYS.map((day, i) => (
                            <Chip key={day} value={String(i + 1)} size="xs">
                              {day}
                            </Chip>
                          ))}
                        </Group>
                      </Chip.Group>
                    </Stack>
                  )}
                />
              </Stack>
            </Card>
          ))}
          {perSession && (
            <Text size="xs" c="dimmed">
              This queue restarts its numbers each session, so each session needs its own prefix —
              otherwise two waiting patients could hold the same number.
            </Text>
          )}
          <Group justify="space-between">
            <Button
              tone="tertiary"
              onClick={() => append(NEW_SESSION)}
              disabled={fields.length >= 6}
              data-testid="btn-add-session"
            >
              Add session
            </Button>
            <Group>
              <Button tone="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                tone="primary"
                type="submit"
                loading={save.isPending}
                data-testid="btn-save-hours"
              >
                Save hours
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
