import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { QueueCategory, QueueRow } from "@medbrains/types";
import { IconLock, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Alert, Button, Drawer, IconButton, Input, Select, Switch, toast } from "@/components/ui";

interface QueueLanesDrawerProps {
  queue: QueueRow | null;
  onClose: () => void;
}

interface LanesForm {
  lanes: QueueCategory[];
}

/** Today's built-in order, as a starting point to customise. */
const STANDARD_LANES: QueueCategory[] = [
  { code: "elderly", label: "Senior citizen", rank: 3, kiosk_selectable: true, is_active: true },
  {
    code: "disabled",
    label: "Person with disability",
    rank: 3,
    kiosk_selectable: true,
    is_active: true,
  },
  { code: "pregnant", label: "Pregnant", rank: 3, kiosk_selectable: true, is_active: true },
  {
    code: "carried_over",
    label: "Waited yesterday",
    rank: 4,
    kiosk_selectable: false,
    is_active: true,
  },
  { code: "vip", label: "VIP", rank: 5, kiosk_selectable: false, is_active: true },
  { code: "normal", label: "General", rank: 6, kiosk_selectable: true, is_active: true },
];

const ORDER = [3, 4, 5, 6, 7, 8, 9].map((rank, i) => ({
  value: String(rank),
  label: ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"][i] ?? String(rank),
}));

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "l_$1")
    .slice(0, 32);

/**
 * The priority lanes one queue offers and the order they are called in.
 * Emergencies are always first and are shown locked, so an admin sees they
 * cannot be moved rather than wondering where they went.
 */
export function QueueLanesDrawer({ queue, onClose }: QueueLanesDrawerProps) {
  const queryClient = useQueryClient();
  const lanes = useQuery({
    queryKey: ["queue-lanes", queue?.id],
    queryFn: () => api.listQueueCategories(queue?.id ?? ""),
    enabled: Boolean(queue),
  });
  // `values` keeps the form in step with the loaded lanes when the drawer is
  // reused for another queue.
  const { control, register, handleSubmit } = useForm<LanesForm>({
    values: { lanes: lanes.data ?? [] },
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: "lanes" });

  const save = useMutation({
    mutationFn: (values: LanesForm) =>
      api.replaceQueueCategories(
        queue?.id ?? "",
        values.lanes.map((lane) => ({
          ...lane,
          code: lane.code || slug(lane.label),
          rank: Number(lane.rank),
        })),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-lanes", queue?.id] });
      toast.success("Lanes saved");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Lanes not saved" }),
  });

  return (
    <Drawer
      opened={Boolean(queue)}
      onClose={onClose}
      title={`Lanes — ${queue?.name ?? ""}`}
      size="lg"
    >
      <form onSubmit={handleSubmit((values) => save.mutate(values))}>
        <Stack gap="md">
          <Group gap="xs">
            <IconLock size={16} aria-hidden />
            <Text size="sm">
              STAT, urgent and emergency referral are always called first, in every queue.
            </Text>
          </Group>
          {lanes.isError && <Alert tone="danger">Could not load this queue's lanes.</Alert>}
          {lanes.isSuccess && fields.length === 0 && (
            <Stack gap="xs" align="flex-start">
              <Text size="sm" c="dimmed">
                This queue uses the standard order: senior citizens, people with a disability and
                pregnant women, then patients who waited yesterday, VIP, and everyone else.
              </Text>
              <Button tone="secondary" onClick={() => replace(STANDARD_LANES)}>
                Customise
              </Button>
            </Stack>
          )}
          {fields.map((field, index) => (
            <Group key={field.id} align="flex-end" wrap="nowrap" gap="xs">
              <Input label="Name" {...register(`lanes.${index}.label`)} style={{ flex: 2 }} />
              <Controller
                control={control}
                name={`lanes.${index}.rank`}
                render={({ field: rank }) => (
                  <Select
                    label="Called"
                    data={ORDER}
                    value={String(rank.value)}
                    onChange={(value) => rank.onChange(Number(value ?? 6))}
                    style={{ flex: 1 }}
                  />
                )}
              />
              <Controller
                control={control}
                name={`lanes.${index}.kiosk_selectable`}
                render={({ field: kiosk }) => (
                  <Switch
                    label="At kiosk"
                    checked={kiosk.value}
                    onChange={(event) => kiosk.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                control={control}
                name={`lanes.${index}.is_active`}
                render={({ field: active }) => (
                  <Switch
                    label="In use"
                    checked={active.value}
                    onChange={(event) => active.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <IconButton
                aria-label={`Remove lane ${index + 1}`}
                tone="danger"
                onClick={() => remove(index)}
              >
                <IconTrash size={16} />
              </IconButton>
            </Group>
          ))}
          {fields.length > 0 && (
            <Button
              tone="tertiary"
              onClick={() =>
                append({ code: "", label: "", rank: 6, kiosk_selectable: false, is_active: true })
              }
            >
              Add lane
            </Button>
          )}
          <Group justify="flex-end">
            <Button tone="secondary" onClick={onClose}>
              Cancel
            </Button>
            {/* Saving no lanes puts the queue back on the standard order. */}
            <Button tone="primary" type="submit" loading={save.isPending}>
              Save lanes
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
