import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import {
  CLINICAL_EVENT_I18N_KEYS,
  type WebhookSubscription,
  type WebhookWithSecret,
} from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Drawer, Input, MultiSelect, Switch, toast } from "@/components/ui";

const EVENTS = Object.keys(CLINICAL_EVENT_I18N_KEYS).map((e) => ({ value: e, label: e }));

const schema = z.object({
  name: z.string().trim().min(2, "Name the partner this goes to"),
  url: z
    .string()
    .trim()
    .regex(/^https:\/\//, "Must be an https:// address"),
  event_types: z.array(z.string()).min(1, "Pick at least one event"),
  is_active: z.boolean(),
});
type Form = z.infer<typeof schema>;

interface WebhookDrawerProps {
  /** null = closed, "new" = create, a subscription = edit. */
  target: WebhookSubscription | "new" | null;
  onClose: () => void;
  onSecret: (issued: WebhookWithSecret) => void;
}

export function WebhookDrawer({ target, onClose, onSecret }: WebhookDrawerProps) {
  const queryClient = useQueryClient();
  const editing = target !== null && target !== "new" ? target : null;
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    values: editing
      ? {
          name: editing.name,
          url: editing.url,
          event_types: editing.event_types,
          is_active: editing.is_active,
        }
      : { name: "", url: "", event_types: [], is_active: true },
  });
  const save = useMutation({
    mutationFn: async (v: Form) => {
      if (editing) {
        await api.updateWebhook(editing.id, v);
        return null;
      }
      return api.createWebhook(v);
    },
    onSuccess: (issued) => {
      void queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      onClose();
      if (issued) onSecret(issued);
      else toast.success("The webhook is updated.", { title: "Saved" });
    },
  });

  return (
    <Drawer
      opened={target !== null}
      onClose={onClose}
      title={editing ? "Edit webhook" : "New webhook"}
      position="right"
      size="md"
    >
      <form aria-label="Webhook" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <Stack gap="sm">
          {save.isError && (
            <Alert tone="danger" title="Not saved">
              {(save.error as Error).message}
            </Alert>
          )}
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Input label="Partner" required {...field} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="url"
            render={({ field, fieldState }) => (
              <Input
                label="URL"
                description="Public HTTPS. Each request is signed with the secret you are given."
                required
                {...field}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="event_types"
            render={({ field, fieldState }) => (
              <MultiSelect
                label="Events"
                description="Only identifiers are sent; the partner reads details with its API key."
                data={EVENTS}
                searchable
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <Switch
                label="Active"
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
          <Text size="xs" c="dimmed">
            Failed sends are retried with backoff; every attempt is logged under Deliveries.
          </Text>
          <Group justify="flex-end">
            <Button tone="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={save.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
