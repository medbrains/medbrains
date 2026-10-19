import { Code, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import {
  P,
  type WebhookDelivery,
  type WebhookSubscription,
  type WebhookWithSecret,
} from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Alert, Badge, type BadgeTone, Button, Drawer, Modal } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { formatDateTime } from "@/lib/date-utils";
import { WebhookDrawer } from "./WebhookDrawer";

const DELIVERY_TONE: Record<WebhookDelivery["status"], BadgeTone> = {
  delivered: "success",
  retrying: "warning",
  failed: "danger",
};

/** Where the hospital's events go, signed, with every attempt on record. */
export function WebhooksPage() {
  useRequirePermission(P.ADMIN.WEBHOOKS.LIST);
  const canManage = useHasPermission(P.ADMIN.WEBHOOKS.MANAGE);
  const [editing, setEditing] = useState<WebhookSubscription | "new" | null>(null);
  const [secret, setSecret] = useState<WebhookWithSecret | null>(null);
  const [watching, setWatching] = useState<WebhookSubscription | null>(null);
  const list = useQuery({ queryKey: ["webhooks"], queryFn: () => api.listWebhooks() });
  const deliveries = useQuery({
    queryKey: ["webhook-deliveries", watching?.id],
    queryFn: () => api.listWebhookDeliveries(watching?.id ?? ""),
    enabled: watching !== null,
  });
  const rotate = useMutation({
    mutationFn: (id: string) => api.rotateWebhookSecret(id),
    onSuccess: setSecret,
  });

  return (
    <Stack gap="md" p="md">
      <PageHeader
        title="Webhooks"
        subtitle="Tell partner systems when events happen — signed, retried, and logged."
        actions={
          canManage ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              onClick={() => setEditing("new")}
            >
              New webhook
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={[
          {
            key: "name",
            label: "Partner",
            render: (w: WebhookSubscription) => <Text fw={500}>{w.name}</Text>,
          },
          {
            key: "url",
            label: "URL",
            render: (w: WebhookSubscription) => <Text size="sm">{w.url}</Text>,
          },
          {
            key: "events",
            label: "Events",
            render: (w: WebhookSubscription) => w.event_types.length,
          },
          {
            key: "active",
            label: "Status",
            render: (w: WebhookSubscription) => (
              <Badge tone={w.is_active ? "success" : "neutral"}>
                {w.is_active ? "Active" : "Off"}
              </Badge>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (w: WebhookSubscription) => (
              <Group gap={4} wrap="nowrap">
                <Button size="xs" tone="ghost" onClick={() => setWatching(w)}>
                  Deliveries
                </Button>
                {canManage && (
                  <>
                    <Button size="xs" tone="ghost" onClick={() => setEditing(w)}>
                      Edit
                    </Button>
                    <Button
                      size="xs"
                      tone="ghost"
                      onClick={() => rotate.mutate(w.id)}
                      loading={rotate.isPending}
                    >
                      New secret
                    </Button>
                  </>
                )}
              </Group>
            ),
          },
        ]}
        data={list.data ?? []}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        rowKey={(w) => w.id}
        emptyTitle="No webhooks yet"
      />
      <WebhookDrawer target={editing} onClose={() => setEditing(null)} onSecret={setSecret} />
      <Modal opened={secret !== null} onClose={() => setSecret(null)} title="Signing secret">
        <Stack gap="sm">
          <Alert tone="warning" title="This is the only time you will see this secret">
            Give it to the partner now. They check each request&apos;s X-MedBrains-Signature with
            it.
          </Alert>
          <Code block aria-label="Signing secret">
            {secret?.signing_secret}
          </Code>
          <Button tone="primary" onClick={() => setSecret(null)}>
            Done
          </Button>
        </Stack>
      </Modal>
      <Drawer
        opened={watching !== null}
        onClose={() => setWatching(null)}
        title={`Deliveries — ${watching?.name ?? ""}`}
        position="right"
        size="lg"
      >
        <DataTable
          columns={[
            {
              key: "at",
              label: "When",
              render: (d: WebhookDelivery) => formatDateTime(d.created_at),
            },
            { key: "event", label: "Event", render: (d: WebhookDelivery) => d.event_type },
            { key: "attempt", label: "Attempt", render: (d: WebhookDelivery) => d.attempt },
            {
              key: "status",
              label: "Result",
              render: (d: WebhookDelivery) => (
                <Badge tone={DELIVERY_TONE[d.status]}>
                  {d.status}
                  {d.response_status ? ` · ${d.response_status}` : ""}
                </Badge>
              ),
            },
            { key: "error", label: "Error", render: (d: WebhookDelivery) => d.error ?? "—" },
          ]}
          data={deliveries.data ?? []}
          loading={deliveries.isLoading}
          error={deliveries.error}
          onRetry={() => void deliveries.refetch()}
          rowKey={(d) => d.id}
          emptyTitle="Nothing sent yet"
        />
      </Drawer>
    </Stack>
  );
}
